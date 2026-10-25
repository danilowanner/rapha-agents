import { createCanvas, loadImage } from "@napi-rs/canvas";
import { PDFParse } from "pdf-parse";

const jpegQualityDefault = 80;
const defaultPageWidthPx = 930;

interface ConversionOptions {
  maxPages?: number;
  desiredWidth?: number;
  format?: "png" | "jpeg";
  jpegQuality?: number;
}

/**
 * Converts a file (PDF or image) from form data into image buffers suitable for LLM vision models.
 * PDFs are rendered page-by-page. Direct images are returned as-is.
 */
export async function fileToImageBuffers(file: File, options: ConversionOptions = {}): Promise<Buffer[]> {
  const { maxPages = 10, desiredWidth = defaultPageWidthPx, format = "png", jpegQuality = jpegQualityDefault } = options;

  if (!file || file.size === 0) {
    throw new Error("Invalid or empty file provided");
  }

  const fileType = file.type;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.length === 0) {
    throw new Error("File buffer is empty");
  }

  if (fileType === "application/pdf") {
    return await convertPdfToImages(buffer, { maxPages, desiredWidth, format, jpegQuality });
  }

  if (fileType.startsWith("image/")) {
    return [buffer];
  }

  throw new Error(`Unsupported file type: ${fileType}`);
}

async function convertPdfToImages(
  pdfBuffer: Buffer,
  options: {
    maxPages: number;
    desiredWidth: number;
    format: "png" | "jpeg";
    jpegQuality: number;
  },
): Promise<Buffer[]> {
  const parser = new PDFParse({ data: pdfBuffer });

  try {
    const result = await parser.getScreenshot({
      desiredWidth: options.desiredWidth,
      first: options.maxPages,
      imageDataUrl: false,
      imageBuffer: true,
    });

    if (result.pages.length === 0) {
      throw new Error("PDF conversion produced no images - the PDF may be empty or corrupted");
    }

    const pages = result.pages.map((page) => Buffer.from(page.data));
    if (options.format === "png") return pages;
    return Promise.all(pages.map((page) => pngToJpeg(page, options.jpegQuality)));
  } finally {
    await parser.destroy();
  }
}

const pngToJpeg = async (png: Buffer, quality: number): Promise<Buffer> => {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  return canvas.toBuffer("image/jpeg", quality);
};
