import { buildParticipantKey, messagePreview, unreadCount } from "@/lib/chat";

describe("chat helpers", () => {
  it("builds a deterministic participant key", () => {
    expect(buildParticipantKey("b-user", "a-user")).toBe("a-user:b-user");
  });

  it("prefers attachment names in previews", () => {
    expect(
      messagePreview({
        text_body: "Hello",
        attachment_name: "photo.png",
        message_type: "image",
      }),
    ).toBe("photo.png");
  });

  it("counts only unread inbound messages", () => {
    expect(
      unreadCount(
        [
          { sender_id: "friend", read_at: null },
          { sender_id: "friend", read_at: "2026-04-23T12:00:00.000Z" },
          { sender_id: "me", read_at: null },
        ],
        "me",
      ),
    ).toBe(1);
  });
});
