// ============================================================
// Document Parser (Server-Side Only)
// Parses PDF, DOCX, TXT files for RAG pipeline
// Uses 'unpdf' for PDF extraction — a cross-runtime library
// with a pre-bundled PDF.js that requires NO worker files.
// ============================================================

export interface ParseResult {
  text: string;
  pageCount?: number;
}

/**
 * Parse a document buffer based on its filename extension.
 * Uses dynamic imports for unpdf and mammoth to avoid client-side issues.
 */
export async function parseDocument(
  buffer: Buffer,
  filename: string
): Promise<ParseResult> {
  const ext = filename.toLowerCase().split('.').pop();

  switch (ext) {
    case 'txt':
      return parseTxt(buffer);
    case 'pdf':
      return parsePdf(buffer);
    case 'docx':
      return parseDocx(buffer);
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }
}

// --- Format-specific parsers ---

function parseTxt(buffer: Buffer): ParseResult {
  return {
    text: buffer.toString('utf-8'),
  };
}

async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  try {
    // unpdf includes a pre-bundled serverless build of PDF.js
    // No worker files needed — works in Node.js, serverless, and edge runtimes
    const { extractText, getDocumentProxy } = await import('unpdf');

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });

    // text is an array of strings (one per page) when mergePages is false.
    // Join pages with double-newlines so paragraph boundaries survive.
    const pages = text as string[];
    const fullText = pages.join('\n\n');

    return {
      text: fullText,
      pageCount: totalPages,
    };
  } catch (error: any) {
    console.error('PDF parsing failed:', error);
    throw new Error(
      `Failed to parse PDF: ${error.message || error}`
    );
  }
}

async function parseDocx(buffer: Buffer): Promise<ParseResult> {
  try {
    // Dynamic import to avoid client-side bundling
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value,
    };
  } catch (error) {
    console.error('DOCX parsing failed:', error);
    throw new Error(
      'Failed to parse DOCX. Make sure mammoth is installed: npm install mammoth'
    );
  }
}

// --- Text chunking for RAG ---

/**
 * Split text into overlapping chunks for embedding.
 * Attempts to split at sentence boundaries when possible.
 *
 * @param text - The text to chunk
 * @param chunkSize - Target characters per chunk (default: 800)
 * @param overlap - Characters of overlap between chunks (default: 200)
 */
export function chunkText(
  text: string,
  chunkSize: number = 800,
  overlap: number = 200
): string[] {
  if (!text || text.length === 0) return [];
  if (text.length <= chunkSize) return [text.trim()];

  const chunks: string[] = [];
  let position = 0;

  while (position < text.length) {
    let end = Math.min(position + chunkSize, text.length);

    // If not at the end of text, try to break at a sentence boundary
    if (end < text.length) {
      const segment = text.slice(position, end);
      const lastSentenceEnd = findLastSentenceEnd(segment);

      if (lastSentenceEnd > chunkSize * 0.3) {
        // Only use sentence boundary if we keep at least 30% of chunk size
        end = position + lastSentenceEnd;
      }
    }

    const chunk = text.slice(position, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    const nextPosition = end - overlap;
    if (nextPosition <= position) {
      position = end;
    } else {
      position = nextPosition;
    }
  }

  return chunks;
}

/**
 * Find the last sentence ending in a text segment.
 * Returns the position after the sentence-ending punctuation.
 */
function findLastSentenceEnd(text: string): number {
  // Match sentence-ending punctuation followed by whitespace or end of string
  const sentenceEnders = /[.!?]\s/g;
  let lastEnd = -1;
  let match;

  while ((match = sentenceEnders.exec(text)) !== null) {
    lastEnd = match.index + 1; // Position right after the punctuation
  }

  // Also check for sentence ender at the very end of text
  if (/[.!?]$/.test(text)) {
    lastEnd = text.length;
  }

  return lastEnd;
}
