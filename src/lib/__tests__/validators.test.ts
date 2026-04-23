import { onboardingSchema, settingsSchema, signUpSchema } from "@/lib/validators";

describe("validators", () => {
  it("accepts a valid onboarding payload", () => {
    const result = onboardingSchema.safeParse({
      username: "rushil_1404",
      display_name: "Rushil Patil",
      status_text: "Building the next version",
    });

    expect(result.success).toBe(true);
  });

  it("rejects uppercase usernames", () => {
    const result = onboardingSchema.safeParse({
      username: "Rushil",
      display_name: "Rushil Patil",
      status_text: "",
    });

    expect(result.success).toBe(false);
  });

  it("requires matching passwords for sign up", () => {
    const result = signUpSchema.safeParse({
      email: "hello@example.com",
      password: "password123",
      confirmPassword: "different",
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid settings values", () => {
    const result = settingsSchema.safeParse({
      display_name: "Rushil Patil",
      status_text: "Hello there",
      theme: "light",
      notifications_enabled: true,
      read_receipts_enabled: true,
      last_seen_visibility: "everyone",
      media_auto_download: "wifi_only",
    });

    expect(result.success).toBe(true);
  });
});
