import { z } from 'zod';

export const otpSchema = z.object({
  code: z
    .string()
    .length(6)
    .refine((v) => /^\d{6}$/.test(v), 'Must be 6 digits'),
});

export type OtpData = z.infer<typeof otpSchema>;
