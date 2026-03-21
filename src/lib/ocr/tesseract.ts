"use client";

import { createWorker, type Worker } from "tesseract.js";

let worker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (!worker) {
    worker = await createWorker("eng+hin", undefined, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          // Progress can be tracked via m.progress (0..1)
        }
      },
    });
  }
  return worker;
}

export interface OCRResult {
  text: string;
  confidence: number;
}

export async function extractText(
  imageSource: Blob | File | string,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  const w = await getWorker();

  let source: string;
  if (typeof imageSource === "string") {
    source = imageSource;
  } else {
    source = URL.createObjectURL(imageSource);
  }

  try {
    const result = await w.recognize(source);
    return {
      text: result.data.text,
      confidence: result.data.confidence,
    };
  } finally {
    if (typeof imageSource !== "string") {
      URL.revokeObjectURL(source);
    }
  }
}

export async function terminateOCR(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
