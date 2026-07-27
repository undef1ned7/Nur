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
});
