import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { ChatRoom } from "@/components/chats/chat-room";
import type { ConversationRow, MessageRow, MessageView, ProfileRow } from "@/lib/types";

const mocks = vi.hoisted(() => {
  const state = {
    realtimeHandler: null as null | ((payload: { new?: unknown }) => Promise<void>),
  };

  const insert = vi.fn(async () => ({ error: null }));
  const channel = {
    on: vi.fn((_event: string, _filter: unknown, callback: (payload: { new?: unknown }) => Promise<void>) => {
      state.realtimeHandler = callback;
      return channel;
    }),
    subscribe: vi.fn(() => channel),
  };
  const storageBucket = {
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://example.test/file" }, error: null })),
    remove: vi.fn(async () => ({ error: null })),
    upload: vi.fn(async () => ({ error: null })),
  };
  const supabase = {
    auth: {
      signOut: vi.fn(async () => ({ error: null })),
    },
    channel: vi.fn(() => channel),
    from: vi.fn(() => ({ insert })),
    removeChannel: vi.fn(async () => undefined),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    storage: {
      from: vi.fn(() => storageBucket),
    },
  };

  return { channel, insert, state, storageBucket, supabase };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span aria-label={alt} data-src={src} role="img" />
  ),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mocks.supabase,
}));

const conversation: ConversationRow = {
  created_at: "2026-04-24T10:00:00.000Z",
  id: "conversation-1",
  participant_key: "me:partner",
  updated_at: "2026-04-24T10:00:00.000Z",
  user_a: "me",
  user_b: "partner",
};

const partner: ProfileRow & { avatar_url: string | null } = {
  avatar_path: null,
  avatar_url: null,
  created_at: "2026-04-24T10:00:00.000Z",
  display_name: "Partner",
  id: "partner",
  status_text: null,
  updated_at: "2026-04-24T10:00:00.000Z",
  username: "partner",
};

function messageRow(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    attachment_name: null,
    attachment_path: null,
    conversation_id: conversation.id,
    created_at: "2026-04-24T10:00:00.000Z",
    id: "message-1",
    message_type: "text",
    mime_type: null,
    read_at: null,
    sender_id: "partner",
    size_bytes: null,
    text_body: "Hello",
    ...overrides,
  };
}

function messageView(overrides: Partial<MessageView> = {}): MessageView {
  const row = messageRow(overrides);

  return {
    ...row,
    is_mine: row.sender_id === "me",
    sender_avatar_url: null,
    sender_display_name: row.sender_id === "me" ? "You" : "Partner",
    sender_username: row.sender_id === "me" ? "me" : "partner",
    signed_url: null,
    ...overrides,
  };
}

function renderRoom(initialMessages: MessageView[] = [messageView()]) {
  return render(
    <ChatRoom
      conversation={conversation}
      currentUserId="me"
      initialMessages={initialMessages}
      partner={partner}
    />,
  );
}

async function pushRealtimeMessage(message: MessageRow) {
  expect(mocks.state.realtimeHandler).toBeTruthy();

  await act(async () => {
    await mocks.state.realtimeHandler?.({ new: message });
  });
}

function installVisualViewportMock({ height = 800, offsetTop = 0 } = {}) {
  let currentHeight = height;
  let currentOffsetTop = offsetTop;
  const viewport = new EventTarget() as VisualViewport;

  Object.defineProperties(viewport, {
    height: {
      configurable: true,
      get: () => currentHeight,
    },
    offsetTop: {
      configurable: true,
      get: () => currentOffsetTop,
    },
  });
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: viewport,
  });

  return {
    setHeight(nextHeight: number) {
      currentHeight = nextHeight;
      viewport.dispatchEvent(new Event("resize"));
    },
    setOffsetTop(nextOffsetTop: number) {
      currentOffsetTop = nextOffsetTop;
      viewport.dispatchEvent(new Event("scroll"));
    },
  };
}

describe("ChatRoom scrolling", () => {
  let originalRequestAnimationFrame: typeof window.requestAnimationFrame;
  let originalInnerHeight: number;
  let originalVisualViewport: VisualViewport | null;
  let scrollToMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalInnerHeight = window.innerHeight;
    originalVisualViewport = window.visualViewport;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof window.requestAnimationFrame;
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: null,
    });

    scrollToMock = vi.fn(function scrollTo(this: HTMLElement, options?: ScrollToOptions | number, y?: number) {
      if (typeof options === "object" && options) {
        this.scrollTop = Number(options.top ?? this.scrollTop);
        return;
      }

      if (typeof y === "number") {
        this.scrollTop = y;
      }
    });

    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 400;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return 1000;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "scrollTop", {
      configurable: true,
      get() {
        return Number((this as HTMLElement & { testScrollTop?: number }).testScrollTop ?? 0);
      },
      set(value: number) {
        (this as HTMLElement & { testScrollTop?: number }).testScrollTop = value;
      },
    });
    HTMLElement.prototype.scrollTo = scrollToMock;

    mocks.state.realtimeHandler = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: originalInnerHeight,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: originalVisualViewport,
    });
    cleanup();
  });

  it("scrolls to the latest message on initial render", async () => {
    renderRoom();

    await waitFor(() => {
      expect(scrollToMock).toHaveBeenCalledWith({ top: 1000, behavior: "auto" });
    });
  });

  it("auto-scrolls incoming messages when already near the bottom", async () => {
    renderRoom();
    const list = screen.getByTestId("message-list");
    list.scrollTop = 560;

    fireEvent.scroll(list);
    await pushRealtimeMessage(
      messageRow({
        created_at: "2026-04-24T10:01:00.000Z",
        id: "message-2",
        text_body: "Near bottom update",
      }),
    );

    expect(screen.queryByRole("button", { name: /new messages/i })).not.toBeInTheDocument();
    expect(scrollToMock).toHaveBeenLastCalledWith({ top: 1000, behavior: "smooth" });
  });

  it("shows a jump control for incoming messages when reading older messages", async () => {
    renderRoom();
    const list = screen.getByTestId("message-list");
    list.scrollTop = 100;

    fireEvent.scroll(list);
    await pushRealtimeMessage(
      messageRow({
        created_at: "2026-04-24T10:01:00.000Z",
        id: "message-2",
        text_body: "Unread update",
      }),
    );

    expect(await screen.findByRole("button", { name: /new messages/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /new messages/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /new messages/i })).not.toBeInTheDocument();
    });
    expect(scrollToMock).toHaveBeenLastCalledWith({ top: 1000, behavior: "smooth" });
  });

  it("scrolls to the latest own message even when reading older messages", async () => {
    renderRoom();
    const list = screen.getByTestId("message-list");
    list.scrollTop = 100;

    fireEvent.scroll(list);
    await pushRealtimeMessage(
      messageRow({
        created_at: "2026-04-24T10:01:00.000Z",
        id: "message-2",
        sender_id: "me",
        text_body: "Own update",
      }),
    );

    expect(screen.queryByRole("button", { name: /new messages/i })).not.toBeInTheDocument();
    expect(scrollToMock).toHaveBeenLastCalledWith({ top: 1000, behavior: "smooth" });
  });

  it("moves the composer above the mobile keyboard and restores it after close", async () => {
    const viewport = installVisualViewportMock({ height: 800 });
    renderRoom();
    const composer = screen.getByTestId("chat-composer");
    const room = composer.parentElement as HTMLElement;

    expect(composer).toHaveStyle("transform: translate3d(0, 0, 0)");

    act(() => {
      viewport.setHeight(470);
    });

    await waitFor(() => {
      expect(room.style.getPropertyValue("--chat-keyboard-offset")).toBe("330px");
    });
    expect(composer).toHaveStyle("transform: translate3d(0, -330px, 0)");

    act(() => {
      viewport.setHeight(800);
    });

    await waitFor(() => {
      expect(room.style.getPropertyValue("--chat-keyboard-offset")).toBe("0px");
    });
    expect(composer).toHaveStyle("transform: translate3d(0, 0, 0)");
  });
});
