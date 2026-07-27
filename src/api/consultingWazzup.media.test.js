import { describe, expect, it } from "vitest";
import {
  mediaTypeLabel,
  normalizeChatMessage,
  normalizeChatThread,
  normalizeMessageStatus,
  resolveMediaType,
  resolveMediaTypeFromFile,
} from "./consultingWazzup";

describe("normalizeMessageStatus", () => {
  it("maps failed → error", () => {
    expect(normalizeMessageStatus("failed")).toBe("error");
    expect(normalizeMessageStatus("FAILED")).toBe("error");
    expect(normalizeMessageStatus("fail")).toBe("error");
  });

  it("maps delivery statuses", () => {
    expect(normalizeMessageStatus("pending")).toBe("pending");
    expect(normalizeMessageStatus("sent")).toBe("sent");
    expect(normalizeMessageStatus("delivered")).toBe("delivered");
    expect(normalizeMessageStatus("read")).toBe("read");
  });
});

describe("resolveMediaType", () => {
  it("maps Wazzup types", () => {
    expect(resolveMediaType({ type: "photo" })).toBe("image");
    expect(resolveMediaType({ media_type: "video" })).toBe("video");
    expect(resolveMediaType({ type: "ptt" })).toBe("voice");
    expect(resolveMediaType({ type: "voice" })).toBe("voice");
    expect(resolveMediaType({ type: "document" })).toBe("document");
  });

  it("infers from URL extension", () => {
    expect(resolveMediaType({}, "https://cdn.example/a.ogg")).toBe("voice");
    expect(resolveMediaType({}, "https://cdn.example/a.mp3?x=1")).toBe("voice");
    expect(resolveMediaType({}, "https://cdn.example/p.jpg")).toBe("image");
    expect(resolveMediaType({}, "https://cdn.example/v.mp4")).toBe("video");
    expect(resolveMediaType({}, "https://cdn.example/d.pdf")).toBe("document");
  });

  it("ignores text type and falls back to URL", () => {
    expect(
      resolveMediaType(
        { type: "text" },
        "https://cdn.example/voice.ogg",
      ),
    ).toBe("voice");
  });
});

describe("normalizeChatMessage media", () => {
  it("does not synthesize unstable ids for malformed server events", () => {
    expect(normalizeChatMessage({ text: "без id" }).id).toBe("");
  });

  it("reads content_uri and media_type", () => {
    const msg = normalizeChatMessage({
      content_uri: "https://cdn.example/a.ogg",
      media_type: "voice",
      is_incoming: true,
      status: "delivered",
    });
    expect(msg.media_url).toContain(".ogg");
    expect(msg.media_type).toBe("voice");
    expect(msg.text).toBe(mediaTypeLabel("voice"));
    expect(msg.direction).toBe("in");
  });

  it("maps failed status to error", () => {
    const msg = normalizeChatMessage({
      text: "hi",
      direction: "outbound",
      status: "failed",
    });
    expect(msg.status).toBe("error");
  });

  it("treats from_me / is_echo as outbound", () => {
    expect(normalizeChatMessage({ text: "x", from_me: true }).direction).toBe(
      "out",
    );
    expect(normalizeChatMessage({ text: "x", is_echo: true }).direction).toBe(
      "out",
    );
  });
});

describe("normalizeChatThread media preview", () => {
  it("fills last_message from voice attachment", () => {
    const t = normalizeChatThread(
      {
        id: "1",
        last_message: {
          text: "",
          media_type: "voice",
          content_uri: "https://cdn.example/v.ogg",
        },
      },
      "whatsapp",
    );
    expect(t.last_message).toBe(mediaTypeLabel("voice"));
  });
});

describe("resolveMediaTypeFromFile", () => {
  it("maps MIME types", () => {
    expect(
      resolveMediaTypeFromFile(
        new File([], "a.mp3", { type: "audio/mpeg" }),
      ),
    ).toBe("voice");
    expect(
      resolveMediaTypeFromFile(new File([], "v.mp4", { type: "video/mp4" })),
    ).toBe("video");
    expect(
      resolveMediaTypeFromFile(new File([], "p.png", { type: "image/png" })),
    ).toBe("image");
  });
});
