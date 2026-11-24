interface ExpoGlobalLike {
  uuidv4?: () => string;
}

interface CryptoLike {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
}

function formatUuidV4Bytes(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Generates a standard 36-character lowercase RFC 4122 UUID v4
 * compatible with NestJS Idempotency-Key validation (class-validator isUUID + length 36).
 */
export function createIdempotencyKey(): string {
  const expoObj = (globalThis as { expo?: ExpoGlobalLike }).expo;
  if (typeof expoObj?.uuidv4 === 'function') {
    const nativeUuid = expoObj.uuidv4();
    if (typeof nativeUuid === 'string' && nativeUuid.length === 36) {
      return nativeUuid.toLowerCase();
    }
  }

  const cryptoObj = (globalThis as { crypto?: CryptoLike }).crypto;

  if (typeof cryptoObj?.randomUUID === 'function') {
    return cryptoObj.randomUUID().toLowerCase();
  }

  const bytes = new Uint8Array(16);
  if (typeof cryptoObj?.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
    return formatUuidV4Bytes(bytes);
  }

  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return formatUuidV4Bytes(bytes);
}
