export interface CompressToWebPOptions {
  maxSizeKB?: number;
  maxDim?: number;
  initialQuality?: number;
  minQuality?: number;
}

export interface CompressToWebPResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

export async function compressToWebP(
  file: File | Blob,
  opts: CompressToWebPOptions = {}
): Promise<CompressToWebPResult> {
  const {
    maxSizeKB = 200,
    maxDim = 512,
    initialQuality = 0.85,
    minQuality = 0.4,
  } = opts;
  const timeoutMs = 15000;

  return Promise.race([
    new Promise<CompressToWebPResult>((_, reject) =>
      setTimeout(() => reject(new Error("Image compression timed out")), timeoutMs)
    ),
    new Promise<CompressToWebPResult>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image. The file may be corrupt."));
      };

      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (!width || !height) {
          reject(new Error("Image has no dimensions"));
          return;
        }

        // Square-crop around the center for avatar framing
        const side = Math.min(width, height);
        const sx = (width - side) / 2;
        const sy = (height - side) / 2;
        const target = Math.min(side, maxDim);

        const canvas = document.createElement("canvas");
        canvas.width = target;
        canvas.height = target;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target);

        let quality = initialQuality;
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Failed to encode WebP"));
                return;
              }
              if (blob.size / 1024 > maxSizeKB && quality > minQuality) {
                quality = Math.max(minQuality, quality - 0.1);
                tryCompress();
                return;
              }
              const reader = new FileReader();
              reader.onerror = () => reject(new Error("Failed to read blob"));
              reader.onload = () =>
                resolve({
                  dataUrl: reader.result as string,
                  blob,
                  width: target,
                  height: target,
                });
              reader.readAsDataURL(blob);
            },
            "image/webp",
            quality
          );
        };
        tryCompress();
      };

      img.src = url;
    }),
  ]);
}
