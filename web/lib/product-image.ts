export const maxProductImageBytes = 500_000;
export const productImageTypes = ["image/jpeg", "image/png", "image/webp"];

export function httpImageUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
