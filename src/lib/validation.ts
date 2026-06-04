import { z } from 'zod';
import { normalizeIndonesianPhone, PhoneNormalizationError } from './phone';

export const checkoutSchema = z.object({
  productSlug: z.string().min(1, 'Product slug diperlukan.'),
  name: z.string().min(1, 'Nama diperlukan.').max(200),
  email: z.string().email('Format email tidak valid.'),
  whatsapp: z.string().min(1, 'Nomor WhatsApp diperlukan.').transform((val, ctx) => {
    try {
      return normalizeIndonesianPhone(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof PhoneNormalizationError ? err.message : 'Nomor WhatsApp tidak valid.',
      });
      return z.NEVER;
    }
  }),
  trackingId: z.string().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
