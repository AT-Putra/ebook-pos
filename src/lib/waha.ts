import { env } from './env';

// INVARIANT: WAHA_BASE_URL must be https:// — validated in env.ts at startup.
// This module enforces it again at call time as a defence-in-depth check.

export type WahaSendFileParams = {
  chatId: string;        // e.g. "628123456789@c.us"
  mimeType: string;
  filename: string;
  base64Data: string;    // file contents encoded as base64
  caption?: string;
};

export type WahaMessageResult = {
  id: string;            // message id from WAHA
};

/** Sends a file to a WhatsApp chat via WAHA /api/sendFile.
 *  Always sends base64 in file.data — never a URL (invariant). */
export async function sendFile(p: WahaSendFileParams): Promise<WahaMessageResult> {
  const baseUrl = env.WAHA_BASE_URL;
  if (!baseUrl.startsWith('https://')) {
    throw new Error('WAHA_BASE_URL must start with https:// — refusing to send over plain HTTP.');
  }

  const body = {
    session: env.WAHA_SESSION,
    chatId: p.chatId,
    file: {
      mimetype: p.mimeType,
      filename: p.filename,
      data: p.base64Data, // base64 only — never file.url
    },
    caption: p.caption ?? 'Terima kasih atas pembelianmu! 🎉 Berikut e-book kamu.',
  };

  const res = await fetch(`${baseUrl}/api/sendFile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': env.WAHA_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WAHA sendFile error (${res.status}): ${text}`);
  }

  const data = await res.json() as { id?: string };
  return { id: data.id ?? '' };
}
