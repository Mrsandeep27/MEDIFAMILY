"use client";

/**
 * PDF page renderer — converts each page of a PDF to a high-resolution
 * JPEG image so Gemini Vision can read it as an image.
 *
 * Isolated to lab-insights; don't reuse across other AI features without
 * deliberate consideration of their rate-limit and prompt budgets.
 */

export interface PdfPage {
  pageNum: number;
  totalPages: number;
  dataUrl: string; // image/jpeg data URL
}

/** Max pages we will process from a single PDF (hard cap to prevent abuse). */
export const MAX_PDF_PAGES = 25;

export async function renderPdfPages(
  file: File | Blob,
  onProgress?: (rendered: number, total: number) => void
): Promise<PdfPage[]> {
  // Dynamic import so pdf.js only loads when needed
  const pdfjsLib = await import("pdfjs-dist");

  // Configure worker (use unpkg CDN to avoid bundler issues)
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const total = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const pages: PdfPage[] = [];

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    // Scale 2x for high-quality text (lab reports have small fonts)
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as Parameters<typeof page.render>[0]).promise;

    // JPEG at 85% quality is a good balance (usually 200-400 KB per page)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    pages.push({ pageNum: i, totalPages: total, dataUrl });

    if (onProgress) onProgress(i, total);
  }

  return pages;
}
