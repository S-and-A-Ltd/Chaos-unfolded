/**
 * Ensures AI response text is extracted as clean plain text.
 * Strips raw JSON objects (e.g. {"dialogue": "..."}), markdown fences, and outer quotes.
 */
export function cleanAIResponseText(raw: any): string {
  if (!raw) return '';

  let text = typeof raw === 'string' ? raw.trim() : String(raw);

  // If text starts with ``` (markdown code block), strip fences
  if (text.startsWith('```')) {
    text = text
      .replace(/^```(?:json|text|markdown)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim();
  }

  // Check if text is a JSON string or object
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.text === 'string') return cleanAIResponseText(parsed.text);
        if (typeof parsed.dialogue === 'string') return cleanAIResponseText(parsed.dialogue);
        if (typeof parsed.reply === 'string') return cleanAIResponseText(parsed.reply);
        if (typeof parsed.explanation === 'string') return cleanAIResponseText(parsed.explanation);
        if (typeof parsed.summary === 'string') return cleanAIResponseText(parsed.summary);
        if (typeof parsed.content === 'string') return cleanAIResponseText(parsed.content);
        if (Array.isArray(parsed)) return parsed.map((item) => cleanAIResponseText(item)).join('\n');
      }
    } catch {
      // Manual regex fallback if JSON.parse fails due to formatting/escapes
      const dialogueMatch =
        text.match(/"dialogue"\s*:\s*"((?:[^"\\]|\\.)*)"/s) ||
        text.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/s) ||
        text.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/s) ||
        text.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
      if (dialogueMatch && dialogueMatch[1]) {
        return dialogueMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
          .trim();
      }
    }
  }

  // Final cleanup of outer quotes
  if (text.startsWith('"') && text.endsWith('"') && text.length > 2) {
    text = text.slice(1, -1);
  }

  return text
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim();
}
