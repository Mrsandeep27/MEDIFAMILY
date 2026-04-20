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

  // Worker is served from /public/pdf.worker.min.mjs to stay same-origin
  // (CSP forbids loading workers from CDNs).
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const total = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const pages: PdfPage[] = [];

  // Render pages in parallel (PDF.js handles this fine, main cost is
  // canvas.toDataURL on the main thread).
  const renderOne = async (pageNum: number): Promise<PdfPage> => {
    const page = await pdf.getPage(pageNum);
    // Scale 1.7x — enough for lab text (small fonts ok, ~150dpi),
    // much faster upload than 2x (payload halved)
    const viewport = page.getViewport({ scale: 1.7 });

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

    // JPEG at 82% — typical size ~150-250 KB per page
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    if (onProgress) {
      onProgress(Math.min(pageNum, total), total);
    }
    return { pageNum, totalPages: total, dataUrl };
  };

  // Sequential render to keep progress updates accurate and memory bounded
  // (8-page PDF = up to 8 canvases at once if parallel = memory spike)
  for (let i = 1; i <= total; i++) {
    pages.push(await renderOne(i));
  }

  return pages;
}
