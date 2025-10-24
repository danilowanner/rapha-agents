import { PDFParse } from "pdf-parse";

interface ConversionOptions {
  maxPages?: number;
  scale?: number;
}

/**
 * Converts a file (PDF or image) from form data into image buffers suitable for LLM vision models.
 * PDFs are converted page-by-page to PNG images. Direct images are returned as-is.
 */
export async function fileToImageBuffers(file: File, options: ConversionOptions = {}): Promise<Buffer[]> {
  const { maxPages = 10, scale = 1024 } = options;

  if (!file || file.size === 0) {
    throw new Error("Invalid or empty file provided");
  }

  const fileType = file.type;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.length === 0) {
    throw new Error("File buffer is empty");
  }

  if (fileType === "application/pdf") {
    return await convertPdfToImages(buffer, { maxPages, scale });
  }

  if (fileType.startsWith("image/")) {
    return [buffer];
  }

  throw new Error(`Unsupported file type: ${fileType}`);
}

async function convertPdfToImages(pdfBuffer: Buffer, options: { maxPages: number; scale: number }): Promise<Buffer[]> {
  const parser = new PDFParse({ data: pdfBuffer });

  try {
    const result = await parser.getScreenshot({
      scale: options.scale / 1024,
      first: options.maxPages,
      imageDataUrl: false,
      imageBuffer: true,
    });

    if (result.pages.length === 0) {
      throw new Error("PDF conversion produced no images - the PDF may be empty or corrupted");
    }

    return result.pages.map((page) => Buffer.from(page.data));
  } finally {
    await parser.destroy();
  }
}
