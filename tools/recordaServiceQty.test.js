import { describe, expect, it } from "vitest";
import {
  expandServiceIds,
  getServiceQty,
  setServiceQty,
  incrementServiceId,
  MAX_SERVICE_QTY_PER_ITEM,
  serviceIdsFromRecord,
  groupServiceIds,
} from "../src/Components/Sectors/Barber/Recorda/components/RecordaUtils.js";

describe("recorda service quantity", () => {
  it("expands qty from object items", () => {
    expect(
      expandServiceIds([
        { service_id: "a", qty: 4 },
        { service_id: "b", quantity: 2 },
      ]),
    ).toEqual(["a", "a", "a", "a", "b", "b"]);
  });

  it("expands flat id list", () => {
    expect(expandServiceIds(["x", "x", "y"])).toEqual(["x", "x", "y"]);
  });

  it("setServiceQty replaces duplicates for one service", () => {
    const ids = setServiceQty(["a", "b", "b"], "b", 6);
    expect(getServiceQty(ids, "b")).toBe(6);
    expect(getServiceQty(ids, "a")).toBe(1);
  });

  it("respects max per service", () => {
    let ids = [];
    for (let i = 0; i < 25; i += 1) {
      ids = incrementServiceId(ids, "s1");
    }
    expect(getServiceQty(ids, "s1")).toBe(MAX_SERVICE_QTY_PER_ITEM);
  });

  it("loads record with qty field", () => {
    const ids = serviceIdsFromRecord({
      services: [{ service_id: "inj", qty: 10 }],
    });
    expect(ids).toHaveLength(10);
    expect(groupServiceIds(ids)).toEqual([{ id: "inj", qty: 10 }]);
  });
});
