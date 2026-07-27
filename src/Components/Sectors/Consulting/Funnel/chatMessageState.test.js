import { describe, expect, it } from "vitest";
import {
  applyChatMessageStatus,
  reconcilePendingMessage,
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
    const pending = upsertChatMessage([], message());
    const sent = upsertChatMessage(
      pending,
      message({ status: "sent", message_id: "wamid-1" }),
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      id: "1",
      message_id: "wamid-1",
      status: "sent",
    });
  });

  it("does not add a server event without a stable id", () => {
    const list = [message()];
    expect(upsertChatMessage(list, { text: "без id" })).toBe(list);
  });

  it("does not merge different CRM ids by Wazzup message_id", () => {
    const list = [message({ id: "1", message_id: "wamid-1" })];
    const next = upsertChatMessage(
      list,
      message({ id: "2", message_id: "wamid-1" }),
    );
    expect(next).toHaveLength(2);
  });

  it("does not regress a delivered status back to sent", () => {
    const list = [message({ status: "delivered" })];
    expect(
      upsertChatMessage(list, message({ status: "sent" }))[0].status,
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
    const list = upsertChatMessage(upsertChatMessage([], later), earlier);
    expect(list.map((item) => item.id)).toEqual(["earlier", "later"]);
  });
});

describe("applyChatMessageStatus", () => {
  it("updates an existing message and never creates a new one", () => {
    const list = [message()];
    expect(
      applyChatMessageStatus(list, {
        id: "1",
        status: "delivered",
        message_id: "wamid-1",
      }),
    ).toEqual([
      expect.objectContaining({
        id: "1",
        message_id: "wamid-1",
        status: "delivered",
      }),
    ]);
    expect(
      applyChatMessageStatus(list, { id: "unknown", status: "sent" }),
    ).toBe(list);
    expect(
      applyChatMessageStatus(list, {
        message_id: "wamid-1",
        status: "sent",
      }),
    ).toBe(list);
  });
});

describe("reconcilePendingMessage", () => {
  it("marks a message unconfirmed when REST still reports pending", () => {
    const list = [message()];
    expect(
      reconcilePendingMessage(list, [message()], "1")[0].status,
    ).toBe("unconfirmed");
  });

  it("uses the final status returned by REST", () => {
    const list = [message()];
    expect(
      reconcilePendingMessage(
        list,
        [message({ status: "sent" })],
        "1",
      )[0].status,
    ).toBe("sent");
  });

  it("accepts a late final websocket status after unconfirmed", () => {
    const list = [message({ status: "unconfirmed" })];
    expect(
      applyChatMessageStatus(list, { id: "1", status: "delivered" })[0]
        .status,
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
