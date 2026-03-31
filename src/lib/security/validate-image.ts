/**
 * Server-side image validation.
 * Checks magic bytes to detect actual file type, not just the claimed MIME type.
 */

// Magic bytes for common image formats
const IMAGE_SIGNATURES: Record<string, number[]> = {
  "image/jpeg": [0xFF, 0xD8, 0xFF],
  "image/png": [0x89, 0x50, 0x4E, 0x47],
  "image/gif": [0x47, 0x49, 0x46],
  "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF header (WebP starts with RIFF....WEBP)
};

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB

interface ValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  data?: string;
}

/**
 * Validates a base64 data URL image:
 * 1. Parses and validates the data URL format
 * 2. Checks file size
 * 3. Verifies magic bytes match claimed MIME type
 */
export function validateBase64Image(
  dataUrl: string,
  maxSizeBytes: number = MAX_IMAGE_SIZE_BYTES
): ValidationResult {
  // Parse data URL
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (!match) {
    return { valid: false, error: "Invalid image format. Please upload a JPG or PNG." };
  }

  let mimeType = `image/${match[1]}`;
  const base64Data = match[2];

  // Normalize MIME
  if (mimeType === "image/jpg") mimeType = "image/jpeg";

  // Check allowed types
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { valid: false, error: "Unsupported image type. Use JPG, PNG, GIF, or WebP." };
  }

  // Check size
  const sizeInBytes = Math.ceil(base64Data.length * 0.75);
  if (sizeInBytes > maxSizeBytes) {
    const maxMB = Math.round(maxSizeBytes / (1024 * 1024));
    return { valid: false, error: `Image too large (max ${maxMB}MB).` };
  }

  // Verify magic bytes — detect if claimed type matches actual content
  try {
    const binaryStr = atob(base64Data.slice(0, 20)); // only need first few bytes
    const bytes = Array.from(binaryStr, (c) => c.charCodeAt(0));

    const signature = IMAGE_SIGNATURES[mimeType];
    if (signature) {
      const matches = signature.every((byte, i) => bytes[i] === byte);
      if (!matches) {
        return { valid: false, error: "File content does not match image type." };
      }
    }
  } catch {
    return { valid: false, error: "Invalid base64 image data." };
  }

  return { valid: true, mimeType, data: base64Data };
}
