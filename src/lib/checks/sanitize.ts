/**
 * Provider text is rendered as plain text (React escapes it), but we still strip
 * control/bidi-override characters and cap length so odd data can't distort the page.
 */
export function cleanText(value: unknown, max = 280): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+?\d[\s().-]*){10,}/;
const LINK = /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\.|\b[a-z0-9-]+\.(?:com|net|org|io|dev|me|app|co|xyz|social)\b/i;

export const textLooksLikeContact = (text: string) => EMAIL.test(text) || PHONE.test(text);
export const textLooksLikeLink = (text: string) => LINK.test(text);
