import { z } from "zod";

export const adminAuthSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export type AdminAuthBody = z.infer<typeof adminAuthSchema>;

export const adminImpersonateSchema = z.object({
  userId: z.string().min(1, "userId is required"),
});

export type AdminImpersonateBody = z.infer<typeof adminImpersonateSchema>;
