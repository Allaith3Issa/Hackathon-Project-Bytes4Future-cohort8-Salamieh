import { maxProductImageBytes, productImageTypes } from "./product-image";

const attempts = [[1200, 0.8], [1200, 0.67], [1200, 0.52], [1000, 0.67], [800, 0.63], [600, 0.6]] as const;

export async function compressProductImage(source: File): Promise<File> {
  const image = await createImageBitmap(source, { imageOrientation: "from-image" });
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    let usable: Blob | undefined;
    for (const [maxSide, quality] of attempts) {
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const encoded = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (encoded?.size && encoded.size <= maxProductImageBytes && productImageTypes.includes(encoded.type)) {
        usable ??= encoded;
        if (encoded.size <= 300_000) {
          usable = encoded;
          break;
        }
      }
    }
    if (!usable) throw new Error("No supported output within the byte limit");
    return new File([usable], usable.type === "image/webp" ? "product.webp" : "product.png", { type: usable.type });
  } finally {
    image.close();
  }
}
