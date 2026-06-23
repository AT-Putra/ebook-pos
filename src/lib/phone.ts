// Indonesian WhatsApp number normalization (PRD §12.2).
// Input: user-entered number in any common format.
// Output: digits-only string like "628123456789", or throws on invalid input.

export class PhoneNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhoneNormalizationError';
  }
}

export function normalizeIndonesianPhone(raw: string): string {
  // Strip spaces, dashes, parentheses, and a leading '+'.
  let digits = raw.replace(/[\s\-().+]/g, '');

  // Keep only digit characters after stripping.
  if (!/^\d+$/.test(digits)) {
    throw new PhoneNormalizationError(
      `Nomor WhatsApp tidak valid: "${raw}". Gunakan format: 08xxx atau +628xxx.`,
    );
  }

  // Normalize prefix.
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  } else if (!digits.startsWith('62')) {
    throw new PhoneNormalizationError(
      `Nomor WhatsApp harus diawali 0, 8, atau 62. Diterima: "${raw}".`,
    );
  }

  // Indonesian mobile numbers must start with 628 (country code 62 + mobile prefix 8).
  if (!digits.startsWith('628')) {
    throw new PhoneNormalizationError(
      `Nomor WhatsApp harus berupa nomor handphone Indonesia (diawali 628). Diterima: "${raw}".`,
    );
  }

  // 628 + 7–12 digits = 10–15 total digits.
  if (digits.length < 10 || digits.length > 15) {
    throw new PhoneNormalizationError(
      `Panjang nomor WhatsApp tidak valid (${digits.length} digit). Harus 10–15 digit.`,
    );
  }

  return digits;
}

export function toChatId(normalizedPhone: string): string {
  return `${normalizedPhone}@c.us`;
}

/** Best-effort: pull an Indonesian WhatsApp number out of free-text contact info and return a
 *  `https://wa.me/<62…>` link, or null if no valid mobile number is found. Pure → testable. */
export function waLinkFromText(text: string): string | null {
  const candidates = text.match(/\+?\d[\d\s().-]{7,}\d/g);
  if (!candidates) return null;
  for (const c of candidates) {
    try {
      return `https://wa.me/${normalizeIndonesianPhone(c)}`;
    } catch {
      // not a valid Indonesian mobile — try the next candidate
    }
  }
  return null;
}
