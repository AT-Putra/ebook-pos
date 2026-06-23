import { randomBytes } from 'node:crypto';

// Protected e-book download link (slice D16, §25). The e-book is delivered as a WhatsApp text
// carrying a tokenized link; the buyer verifies their registered WhatsApp number on the download
// page to stream the PDF. Pure, dependency-free helpers (unit-tested).

/** Generates an unguessable download token: 16 random bytes (128-bit) as base64url ⇒ 22 URL-safe
 *  chars. Kept short so the link stays compact; 128-bit is far beyond brute-forcing. */
export function generateDownloadToken(): string {
  return randomBytes(16).toString('base64url');
}

/** Built-in default link message (used when a Product has no custom `linkMessageTemplate`). */
export const DEFAULT_LINK_MESSAGE_TEMPLATE =
  'Halo {{name}}! 🎉 Terima kasih sudah membeli *{{product}}*. Download e-book kamu di sini: {{link}}\n\n' +
  'Kamu akan diminta memasukkan nomor WhatsApp ini untuk download.';

/** Builds the public download URL for a token. `baseUrl` is APP_BASE_URL (no trailing slash needed). */
export function buildDownloadLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/download/${token}`;
}

/** Renders a link-message template, substituting {{name}}, {{product}}, {{link}}. Falls back to the
 *  built-in default when the template is null/blank. Pure → testable. */
export function renderLinkMessage(
  template: string | null | undefined,
  vars: { name: string; product: string; link: string },
): string {
  const tpl = template && template.trim().length > 0 ? template : DEFAULT_LINK_MESSAGE_TEMPLATE;
  return tpl
    .replaceAll('{{name}}', vars.name)
    .replaceAll('{{product}}', vars.product)
    .replaceAll('{{link}}', vars.link);
}
