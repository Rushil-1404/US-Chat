import { z } from "zod";

import {
  DISPLAY_NAME_MAX_LENGTH,
  LAST_SEEN_OPTIONS,
  MEDIA_AUTO_DOWNLOAD_OPTIONS,
  STATUS_MAX_LENGTH,
  THEME_OPTIONS,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/constants";

export const usernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN_LENGTH, `Username must be at least ${USERNAME_MIN_LENGTH} characters.`)
  .max(USERNAME_MAX_LENGTH, `Username must be at most ${USERNAME_MAX_LENGTH} characters.`)
  .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, or underscores only.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Display name must be at least 2 characters.")
  .max(DISPLAY_NAME_MAX_LENGTH, `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters.`);

export const statusSchema = z
  .string()
  .trim()
  .max(STATUS_MAX_LENGTH, `Status must be at most ${STATUS_MAX_LENGTH} characters.`);

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const signUpSchema = signInSchema.extend({
  confirmPassword: z.string().min(8, "Confirm your password."),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm your password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const onboardingSchema = z.object({
  username: usernameSchema,
  display_name: displayNameSchema,
  status_text: statusSchema.optional().or(z.literal("")),
});

export const settingsSchema = z.object({
  display_name: displayNameSchema,
  status_text: statusSchema.optional().or(z.literal("")),
  theme: z.enum(THEME_OPTIONS),
  notifications_enabled: z.boolean(),
  read_receipts_enabled: z.boolean(),
  last_seen_visibility: z.enum(LAST_SEEN_OPTIONS),
  media_auto_download: z.enum(MEDIA_AUTO_DOWNLOAD_OPTIONS),
});

export const usernameLookupSchema = z.object({
  username: usernameSchema,
});

export const messageSchema = z.object({
  text: z
    .string()
    .trim()
    .max(2000, "Messages must be 2000 characters or less.")
    .optional()
    .or(z.literal("")),
});
