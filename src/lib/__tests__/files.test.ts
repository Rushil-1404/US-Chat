import { buildAttachmentPath, buildAvatarPath, getMessageTypeFromMime } from "@/lib/files";

describe("file helpers", () => {
  it("maps image mime types to image messages", () => {
    expect(getMessageTypeFromMime("image/png")).toBe("image");
  });

  it("builds avatar paths using the user id folder", () => {
    expect(buildAvatarPath("user-1", "My Avatar.png")).toBe("avatars/user-1/my-avatar.png");
  });

  it("builds attachment paths using conversation and message folders", () => {
    expect(buildAttachmentPath("conversation-1", "message-1", "Quarterly Report.pdf")).toBe(
      "attachments/conversation-1/message-1/quarterly-report.pdf",
    );
  });
});
