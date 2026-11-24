/**
 * Strictly validate external URLs (product images, referral URLs, transfer receipts)
 * allowing only http:// and https:// schemes.
 */
export function isSafeHttpUrl(url: string | null | undefined): url is string {
  if (!url) {
    return false;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

export function sanitizeImageUrl(url: string | null | undefined): string | null {
  return isSafeHttpUrl(url) ? url.trim() : null;
}
