import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImageManipulatorContext, ImageRef, ImageResult } from 'expo-image-manipulator';

export const MAX_BACKEND_IMAGE_BYTES = 500_000;
export const SAFE_CLIENT_IMAGE_BYTES = 490_000;

export interface CompressedCampaignImage {
  uri: string;
  mimeType: 'image/jpeg';
  fileName: string;
  byteSize: number;
}

export type CampaignImageCompressionFailureReason =
  | 'SIZE_LIMIT_EXCEEDED'
  | 'FILE_READ_FAILED'
  | 'PROCESSING_FAILED';

const COMPRESSION_LADDER: readonly { maxDimension: number; quality: number }[] = [
  { maxDimension: 1200, quality: 0.8 },
  { maxDimension: 1200, quality: 0.65 },
  { maxDimension: 1000, quality: 0.55 },
  { maxDimension: 800, quality: 0.45 },
];

export class CampaignImageCompressionError extends Error {
  readonly reason: CampaignImageCompressionFailureReason;

  constructor(
    message: string,
    reason: CampaignImageCompressionFailureReason = 'PROCESSING_FAILED',
  ) {
    super(message);
    this.name = 'CampaignImageCompressionError';
    this.reason = reason;
  }
}

export function isCampaignImageCompressionError(
  error: unknown,
): error is CampaignImageCompressionError {
  return error instanceof CampaignImageCompressionError;
}

function createAbortError(): Error {
  const err = new Error('Image processing aborted.');
  err.name = 'AbortError';
  return err;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function deleteTempFileQuietly(fileUri: string, sourceUri: string): void {
  if (!fileUri || fileUri === sourceUri || !fileUri.startsWith('file://')) {
    return;
  }

  try {
    const file = new File(fileUri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Best-effort temp cache cleanup; ignore errors.
  }
}

function readLocalFileSizeViaFileSystem(uri: string): number | null {
  try {
    const file = new File(uri);
    if (!file.exists) {
      return null;
    }
    const size = file.size;
    if (typeof size === 'number' && Number.isFinite(size) && size > 0) {
      return size;
    }
    return null;
  } catch {
    return null;
  }
}

function readBlobSizeViaXhr(uri: string, signal?: AbortSignal): Promise<number> {
  assertNotAborted(signal);

  if (typeof XMLHttpRequest === 'undefined') {
    return Promise.reject(
      new CampaignImageCompressionError(
        'Unable to read local image file.',
        'FILE_READ_FAILED',
      ),
    );
  }

  return new Promise<number>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const cleanup = () => {
      signal?.removeEventListener('abort', handleAbort);
      xhr.onload = null;
      xhr.onerror = null;
      xhr.onabort = null;
    };

    const fail = (err: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(err);
    };

    const handleAbort = () => {
      try {
        xhr.abort();
      } catch {
        // Ignore abort errors from already-closed XHR.
      }
      fail(createAbortError());
    };

    if (signal) {
      signal.addEventListener('abort', handleAbort, { once: true });
    }

    xhr.responseType = 'blob';

    xhr.onload = () => {
      if (settled) {
        return;
      }
      if (signal?.aborted) {
        fail(createAbortError());
        return;
      }

      // Local file:// / content:// XHR reads often complete with status 0 or 200.
      if (xhr.status !== 0 && (xhr.status < 200 || xhr.status >= 300)) {
        fail(
          new CampaignImageCompressionError(
            'Unable to read local image file.',
            'FILE_READ_FAILED',
          ),
        );
        return;
      }

      const blob = xhr.response as
        | { size?: number; close?: () => void }
        | null
        | undefined;
      const size = blob?.size;
      if (blob && typeof blob.close === 'function') {
        try {
          blob.close();
        } catch {
          // Ignore close errors.
        }
      }

      if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
        fail(
          new CampaignImageCompressionError(
            'Could not determine local image byte size.',
            'FILE_READ_FAILED',
          ),
        );
        return;
      }

      settled = true;
      cleanup();
      resolve(size);
    };

    xhr.onerror = () => {
      fail(
        new CampaignImageCompressionError(
          'Unable to read local image file.',
          'FILE_READ_FAILED',
        ),
      );
    };

    xhr.onabort = () => {
      if (signal?.aborted) {
        fail(createAbortError());
        return;
      }
      fail(
        new CampaignImageCompressionError(
          'Unable to read local image file.',
          'FILE_READ_FAILED',
        ),
      );
    };

    try {
      xhr.open('GET', uri, true);
      xhr.send(null);
    } catch {
      fail(
        new CampaignImageCompressionError(
          'Unable to read local image file.',
          'FILE_READ_FAILED',
        ),
      );
    }
  });
}

export async function readLocalFileByteSize(
  uri: string,
  signal?: AbortSignal,
): Promise<number> {
  assertNotAborted(signal);

  const directSize = readLocalFileSizeViaFileSystem(uri);
  if (directSize !== null) {
    return directSize;
  }

  return readBlobSizeViaXhr(uri, signal);
}

async function renderCompressedAttempt(
  uri: string,
  maxDimension: number,
  quality: number,
  signal?: AbortSignal,
): Promise<ImageResult> {
  assertNotAborted(signal);

  let loadContext: ImageManipulatorContext | null = null;
  let loadedImage: ImageRef | null = null;
  let resizeContext: ImageManipulatorContext | null = null;
  let resizedImage: ImageRef | null = null;

  try {
    loadContext = ImageManipulator.manipulate(uri, {
      maxWidth: maxDimension,
      maxHeight: maxDimension,
    });
    loadedImage = await loadContext.renderAsync();
    assertNotAborted(signal);

    // Downsample only when exceeding maxDimension; never upscale smaller images.
    if (loadedImage.width > maxDimension || loadedImage.height > maxDimension) {
      const targetSize =
        loadedImage.width >= loadedImage.height
          ? { width: maxDimension }
          : { height: maxDimension };
      resizeContext = ImageManipulator.manipulate(loadedImage).resize(targetSize);
      resizedImage = await resizeContext.renderAsync();
      assertNotAborted(signal);
      return await resizedImage.saveAsync({
        format: SaveFormat.JPEG,
        compress: quality,
      });
    }

    return await loadedImage.saveAsync({
      format: SaveFormat.JPEG,
      compress: quality,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    if (isCampaignImageCompressionError(err)) {
      throw err;
    }
    throw new CampaignImageCompressionError(
      'Unable to process the selected image.',
      'PROCESSING_FAILED',
    );
  } finally {
    resizedImage?.release();
    resizeContext?.release();
    loadedImage?.release();
    loadContext?.release();
  }
}

/**
 * Compresses a local gallery/camera image into a bounded static JPEG
 * matching the backend 500,000-byte limit before network upload.
 */
export async function compressCampaignImageForUpload(
  uri: string,
  signal?: AbortSignal,
): Promise<CompressedCampaignImage> {
  const trimmedUri = uri.trim();
  if (!trimmedUri) {
    throw new CampaignImageCompressionError(
      'Missing local image URI.',
      'FILE_READ_FAILED',
    );
  }

  assertNotAborted(signal);

  let bestWithinBackendLimit: CompressedCampaignImage | null = null;

  try {
    for (const step of COMPRESSION_LADDER) {
      assertNotAborted(signal);

      const saved = await renderCompressedAttempt(
        trimmedUri,
        step.maxDimension,
        step.quality,
        signal,
      );

      let byteSize: number;
      try {
        byteSize = await readLocalFileByteSize(saved.uri, signal);
      } catch (err: unknown) {
        deleteTempFileQuietly(saved.uri, trimmedUri);
        throw err;
      }

      const candidate: CompressedCampaignImage = {
        uri: saved.uri,
        mimeType: 'image/jpeg',
        fileName: 'campaign-product.jpg',
        byteSize,
      };

      if (byteSize <= SAFE_CLIENT_IMAGE_BYTES) {
        if (bestWithinBackendLimit && bestWithinBackendLimit.uri !== saved.uri) {
          deleteTempFileQuietly(bestWithinBackendLimit.uri, trimmedUri);
        }
        return candidate;
      }

      if (
        byteSize <= MAX_BACKEND_IMAGE_BYTES &&
        (!bestWithinBackendLimit || byteSize < bestWithinBackendLimit.byteSize)
      ) {
        if (bestWithinBackendLimit && bestWithinBackendLimit.uri !== saved.uri) {
          deleteTempFileQuietly(bestWithinBackendLimit.uri, trimmedUri);
        }
        bestWithinBackendLimit = candidate;
      } else {
        deleteTempFileQuietly(saved.uri, trimmedUri);
      }
    }

    if (bestWithinBackendLimit) {
      return bestWithinBackendLimit;
    }

    throw new CampaignImageCompressionError(
      'Unable to compress image under the 500,000-byte upload limit.',
      'SIZE_LIMIT_EXCEEDED',
    );
  } catch (err: unknown) {
    if (bestWithinBackendLimit) {
      deleteTempFileQuietly(bestWithinBackendLimit.uri, trimmedUri);
    }
    throw err;
  }
}
