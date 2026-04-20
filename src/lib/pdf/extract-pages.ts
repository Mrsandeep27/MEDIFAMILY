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

  // Render pages in parallel. Canvases are garbage-collected after
  // toDataURL() returns, so peak memory = N * (viewport area * 4 bytes)
  // which for 25 A4 pages at 1.7x is ~270 MB — still fine on mobile.
  let completed = 0;
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
    completed++;
    if (onProgress) onProgress(completed, total);
    return { pageNum, totalPages: total, dataUrl };
  };

  // Parallel render — all pages at once
  const rendered = await Promise.all(
    Array.from({ length: total }, (_, i) => renderOne(i + 1))
  );
  rendered.sort((a, b) => a.pageNum - b.pageNum);
  pages.push(...rendered);

  return pages;
}

/**
 * Streaming variant — yields each page AS it finishes rendering, so the
 * caller can start analyzing page N while pages N+1..N+K are still rendering.
 * This pipelines render + analyze, cutting total wall time dramatically.
 */
export async function streamPdfPages(
  file: File | Blob,
  onPageReady: (page: PdfPage) => void,
  onProgress?: (rendered: number, total: number) => void
): Promise<number> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const total = Math.min(pdf.numPages, MAX_PDF_PAGES);

  let completed = 0;
  const renderOne = async (pageNum: number) => {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.7 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as Parameters<typeof page.render>[0]).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    completed++;
    if (onProgress) onProgress(completed, total);
    // Fire the per-page callback IMMEDIATELY so analysis starts in parallel
    onPageReady({ pageNum, totalPages: total, dataUrl });
  };

  await Promise.all(Array.from({ length: total }, (_, i) => renderOne(i + 1)));
  return total;
}
