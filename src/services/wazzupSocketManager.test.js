import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.sent = [];
    MockWebSocket.instances.push(this);
  }

  send(value) {
    this.sent.push(value);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }
}

describe("wazzupSocketManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    localStorage.setItem("accessToken", "test-token");
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("schedules only one connection for simultaneous holders", async () => {
    const { acquireWazzupSocket } = await import("./wazzupSocketManager");
    const releaseFirst = acquireWazzupSocket();
    const releaseSecond = acquireWazzupSocket();

    vi.runOnlyPendingTimers();
    expect(MockWebSocket.instances).toHaveLength(1);

    releaseFirst();
    releaseSecond();
  });

  it("sends the documented message frame", async () => {
    const { acquireWazzupSocket, sendWazzupChatMessage } =
      await import("./wazzupSocketManager");
    const release = acquireWazzupSocket();
    vi.runOnlyPendingTimers();
    const socket = MockWebSocket.instances[0];
    socket.readyState = MockWebSocket.OPEN;

    expect(
      sendWazzupChatMessage({
        lead_id: "lead-1",
        text: "Привет",
        content_uri: "https://cdn.example/file.pdf",
        account_id: "account-1",
      }),
    ).toBe(true);
    expect(JSON.parse(socket.sent[0])).toEqual({
      action: "send_message",
      lead_id: "lead-1",
      text: "Привет",
      content_uri: "https://cdn.example/file.pdf",
      media_url: "https://cdn.example/file.pdf",
      account_id: "account-1",
    });

    release();
  });

  it("dispatches ack, new_message and message_status to every subscriber", async () => {
    const {
      acquireWazzupSocket,
      subscribeWazzupSocket,
    } = await import("./wazzupSocketManager");
    const first = {
      onSendAck: vi.fn(),
      onNewMessage: vi.fn(),
      onStatus: vi.fn(),
    };
    const second = {
      onSendAck: vi.fn(),
      onNewMessage: vi.fn(),
      onStatus: vi.fn(),
    };
    const unsubscribeFirst = subscribeWazzupSocket(first);
    const unsubscribeSecond = subscribeWazzupSocket(second);
    const release = acquireWazzupSocket();
    vi.runOnlyPendingTimers();
    const socket = MockWebSocket.instances[0];

    const frames = [
      {
        action: "send_message_ack",
        status: "success",
        data: { id: "message-1", status: "pending" },
      },
      {
        type: "new_message",
        data: { id: "message-2", text: "Входящее" },
      },
      {
        type: "message_status",
        data: { id: "message-1", status: "sent" },
      },
    ];
    frames.forEach((frame) => {
      socket.onmessage({ data: JSON.stringify(frame) });
    });

    for (const subscriber of [first, second]) {
      expect(subscriber.onSendAck).toHaveBeenCalledWith(frames[0]);
      expect(subscriber.onNewMessage).toHaveBeenCalledWith(
        frames[1].data,
        frames[1],
      );
      expect(subscriber.onStatus).toHaveBeenCalledWith(
        frames[2].data,
        frames[2],
      );
    }

    unsubscribeFirst();
    unsubscribeSecond();
    release();
  });
});
