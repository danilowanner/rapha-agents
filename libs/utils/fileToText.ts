import { PDFParse } from "pdf-parse";

/**
 * Extracts raw text content from a PDF file.
 */
export async function fileToText(file: File): Promise<string> {
  if (!file || file.size === 0) {
    throw new Error("Invalid or empty file provided");
  }

  const fileType = file.type;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.length === 0) {
    throw new Error("File buffer is empty");
  }

  if (fileType === "application/pdf") {
    return await extractPdfText(buffer);
  }

  throw new Error(`Unsupported file type for text extraction: ${fileType}`);
}

async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: pdfBuffer });

  try {
    const result = await parser.getText();

    if (!result || result.text.trim().length === 0) {
      throw new Error("PDF text extraction produced no text - the PDF may be empty or image-based");
    }

    return result.text;
  } finally {
    await parser.destroy();
  }
}
