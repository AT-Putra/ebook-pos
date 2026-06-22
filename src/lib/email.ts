import nodemailer, { type Transporter } from 'nodemailer';
import { env } from './env';

/** A file to attach to the fallback e-book email (binary content, never a URL — invariant #4). */
export type EbookEmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

/** Pure: the fallback is usable only when enabled AND both Gmail credentials are present. */
export function emailConfigured(cfg: { enabled: boolean; user: string; password: string }): boolean {
  return Boolean(cfg.enabled && cfg.user && cfg.password);
}

/** The fallback is OFF unless explicitly enabled AND Gmail credentials are present.
 *  Keeps the whole feature a silent no-op on environments that haven't configured it. */
export function isEmailConfigured(): boolean {
  return emailConfigured({
    enabled: env.EMAIL_FALLBACK_ENABLED,
    user: env.GMAIL_USER,
    password: env.GMAIL_APP_PASSWORD,
  });
}

export type EbookEmailContent = { subject: string; text: string };

/** Pure: builds the Indonesian subject + body for the fallback e-book email. */
export function buildEbookEmail(params: {
  customerName: string;
  productName: string;
  fileNames: string[];
}): EbookEmailContent {
  const { customerName, productName, fileNames } = params;
  const subject = `E-book kamu: ${productName}`;
  const fileList = fileNames.map(n => `• ${n}`).join('\n');
  const text =
    `Halo ${customerName},\n\n` +
    `Terima kasih atas pembelianmu! 🎉\n\n` +
    `Kami mengirimkan e-book kamu lewat email ini karena pengiriman via WhatsApp ` +
    `sedang mengalami kendala. Berikut file yang terlampir pada email ini:\n\n` +
    `${fileList}\n\n` +
    `Produk: ${productName}\n\n` +
    `Jika ada pertanyaan, silakan balas email ini. Selamat membaca!\n\n` +
    `Salam,\nTim ${productName}`;
  return { subject, text };
}

// Lazy singleton transport — built from env on first send (so importing the module never
// requires the email vars to be set, mirroring lib/env.ts's fail-on-use approach).
let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // implicit TLS
      auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
    });
  }
  return _transporter;
}

/** Sends the e-book + attachments to the buyer via Gmail SMTP. Throws on any send failure
 *  (the caller records the error and retries on the next cron pass). */
export async function sendEbookEmail(params: {
  to: string;
  customerName: string;
  productName: string;
  attachments: EbookEmailAttachment[];
}): Promise<{ messageId: string }> {
  const { to, customerName, productName, attachments } = params;
  const { subject, text } = buildEbookEmail({
    customerName,
    productName,
    fileNames: attachments.map(a => a.filename),
  });
  const from = env.EMAIL_FROM || env.GMAIL_USER;
  const info = await getTransporter().sendMail({
    from,
    to,
    subject,
    text,
    attachments: attachments.map(a => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType ?? 'application/pdf',
    })),
  });
  return { messageId: info.messageId };
}
