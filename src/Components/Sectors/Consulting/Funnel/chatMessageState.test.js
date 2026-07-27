import { describe, expect, it } from "vitest";
import {
  applyChatMessageStatus,
  confirmOptimisticMessage,
  markMessageError,
  mergeChatMessages,
  reconcilePendingMessage,
  sortChatMessages,
  takePendingForAck,
  upsertChatMessage,
} from "./chatMessageState";

const message = (overrides = {}) => ({
  id: "1",
  text: "Привет",
  direction: "out",
  status: "pending",
  created_at: "2026-07-27T10:00:00Z",
  ...overrides,
});

describe("upsertChatMessage", () => {
  it("upserts by server id without duplicates", () => {
    const pending = upsertChatMessage(new Map(), message());
    const sent = upsertChatMessage(
      pending,
      message({ status: "sent", message_id: "wamid-1" }),
    );
    expect(sent.size).toBe(1);
    expect(sent.get("1")).toMatchObject({
      id: "1",
      message_id: "wamid-1",
      status: "sent",
    });
  });

  it("does not add a server event without a stable id", () => {
    const byId = new Map([["1", message()]]);
    expect(upsertChatMessage(byId, { text: "без id" })).toBe(byId);
  });

  it("does not merge different CRM ids by Wazzup message_id", () => {
    const byId = new Map([
      ["1", message({ id: "1", message_id: "wamid-1" })],
    ]);
    const next = upsertChatMessage(
      byId,
      message({ id: "2", message_id: "wamid-1" }),
    );
    expect(next.size).toBe(2);
  });

  it("does not regress a delivered status back to sent", () => {
    const byId = new Map([["1", message({ status: "delivered" })]]);
    expect(
      upsertChatMessage(byId, message({ status: "sent" })).get("1")
        .status,
    ).toBe("delivered");
  });

  it("sorts parallel events by timestamp instead of arrival order", () => {
    const later = message({
      id: "later",
      created_at: "2026-07-27T10:01:00Z",
    });
    const earlier = message({
      id: "earlier",
      created_at: "2026-07-27T10:00:00Z",
    });
    const byId = upsertChatMessage(
      upsertChatMessage(new Map(), later),
      earlier,
    );
    expect(sortChatMessages(byId).map((item) => item.id)).toEqual([
      "earlier",
      "later",
    ]);
  });

  it("sorts by absolute time across mixed timezones", () => {
    const utc = message({
      id: "utc",
      created_at: "2026-07-27T16:09:16.298835+00:00",
    });
    const localLater = message({
      id: "local",
      // тот же момент + 1 минута в +06
      created_at: "2026-07-27T22:10:16.298835+06:00",
    });
    const byId = upsertChatMessage(
      upsertChatMessage(new Map(), localLater),
      utc,
    );
    expect(sortChatMessages(byId).map((item) => item.id)).toEqual([
      "utc",
      "local",
    ]);
  });

  it("puts messages without created_at at the end", () => {
    const dated = message({
      id: "dated",
      created_at: "2026-07-27T10:00:00Z",
    });
    const bare = message({ id: "bare", created_at: "" });
    const byId = upsertChatMessage(upsertChatMessage(new Map(), bare), dated);
    expect(sortChatMessages(byId).map((item) => item.id)).toEqual([
      "dated",
      "bare",
    ]);
  });

  it("bulk-upserts REST history into the same Map model", () => {
    const byId = new Map([["1", message()]]);
    const merged = mergeChatMessages(byId, [
      message({ status: "sent" }),
      message({ id: "2", text: "Второе" }),
    ]);
    expect(merged.size).toBe(2);
    expect(merged.get("1").status).toBe("sent");
  });
});

describe("applyChatMessageStatus", () => {
  it("updates an existing message by the same data.id", () => {
    const byId = new Map([["1", message()]]);
    expect(
      applyChatMessageStatus(byId, {
        id: "1",
        status: "delivered",
        message_id: "wamid-1",
      }).get("1"),
    ).toEqual(
      expect.objectContaining({
        id: "1",
        message_id: "wamid-1",
        status: "delivered",
      }),
    );
  });

  it("upserts a status that arrives before ack and does not regress later", () => {
    const statusFirst = applyChatMessageStatus(new Map(), {
      id: "1",
      lead_id: "lead-1",
      status: "sent",
      timestamp: "2026-07-27T10:00:00Z",
    });
    const ackLater = upsertChatMessage(statusFirst, message());

    expect(ackLater.get("1")).toMatchObject({
      id: "1",
      text: "Привет",
      status: "sent",
    });
  });

  it("requires data.id and status", () => {
    const byId = new Map([["1", message()]]);
    expect(
      applyChatMessageStatus(byId, {
        message_id: "wamid-1",
        status: "sent",
      }),
    ).toBe(byId);
    expect(applyChatMessageStatus(byId, { id: "1" })).toBe(byId);
  });
});

describe("reconcilePendingMessage", () => {
  it("marks a message unconfirmed when REST still reports pending", () => {
    const byId = new Map([["1", message()]]);
    expect(
      reconcilePendingMessage(byId, [message()], "1").get("1").status,
    ).toBe("unconfirmed");
  });

  it("uses the final status returned by REST", () => {
    const byId = new Map([["1", message()]]);
    expect(
      reconcilePendingMessage(
        byId,
        [message({ status: "sent" })],
        "1",
      ).get("1").status,
    ).toBe("sent");
  });

  it("accepts a late final websocket status after unconfirmed", () => {
    const byId = new Map([
      ["1", message({ status: "unconfirmed" })],
    ]);
    expect(
      applyChatMessageStatus(byId, {
        id: "1",
        status: "delivered",
      }).get("1").status,
    ).toBe("delivered");
  });
});

describe("takePendingForAck", () => {
  const queue = [
    { tempId: "a", leadId: "lead-a", text: "Одинаково" },
    { tempId: "b", leadId: "lead-b", text: "Одинаково" },
  ];

  it("never consumes pending from another lead", () => {
    const result = takePendingForAck(
      queue,
      { lead_id: "lead-a", text: "Одинаково" },
      "lead-b",
    );
    expect(result.pending).toBeNull();
    expect(result.queue).toEqual(queue);
  });

  it("consumes only the active lead pending", () => {
    const result = takePendingForAck(
      queue,
      { lead_id: "lead-b", text: "Одинаково" },
      "lead-b",
    );
    expect(result.pending?.tempId).toBe("b");
    expect(result.queue.map((item) => item.tempId)).toEqual(["a"]);
  });
});

describe("confirmOptimisticMessage", () => {
  it("replaces local temp id with server id without duplicates", () => {
    const byId = new Map([
      [
        "local-1",
        message({
          id: "local-1",
          text: "Привет",
          status: "pending",
          optimistic: true,
        }),
      ],
    ]);
    const next = confirmOptimisticMessage(byId, "local-1", {
      id: "srv-1",
      text: "Привет",
      status: "pending",
      direction: "out",
    });
    expect(next.has("local-1")).toBe(false);
    expect(next.size).toBe(1);
    expect(next.get("srv-1")).toMatchObject({
      id: "srv-1",
      text: "Привет",
      status: "pending",
      optimistic: false,
    });
  });

  it("keeps a newer status that arrived before ack", () => {
    const byId = new Map([
      ["local-1", message({ id: "local-1", status: "pending" })],
      ["srv-1", message({ id: "srv-1", text: "", status: "sent" })],
    ]);
    const next = confirmOptimisticMessage(byId, "local-1", {
      id: "srv-1",
      text: "Привет",
      status: "pending",
    });
    expect(next.get("srv-1").status).toBe("sent");
    expect(next.get("srv-1").text).toBe("Привет");
  });
});

describe("markMessageError", () => {
  it("marks optimistic bubble as error", () => {
    const byId = new Map([["local-1", message({ id: "local-1" })]]);
    expect(markMessageError(byId, "local-1").get("local-1").status).toBe(
      "error",
    );
  });
});
