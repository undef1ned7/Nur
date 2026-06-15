import { describe, expect, it, beforeEach } from "vitest";
import sectorReducer, {
  setSector,
  resetSector,
  selectSectorSelected,
} from "./sectorSlice";
import { mapSectorNameToSlug } from "../../utils/sectorMapping";

describe("sectorSlice", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("setSector updates selected and persists to localStorage", () => {
    const state = sectorReducer(undefined, setSector("barber"));
    expect(state.selected).toBe("barber");
    expect(localStorage.getItem("selectedSector")).toBe("barber");
  });

  it("resetSector clears selected", () => {
    const withSector = sectorReducer(undefined, setSector("cafe"));
    const state = sectorReducer(withSector, resetSector());
    expect(state.selected).toBeNull();
    expect(localStorage.getItem("selectedSector")).toBeNull();
  });

  it("syncs from getCompany.fulfilled", () => {
    const state = sectorReducer(undefined, {
      type: "user/fetchCompany/fulfilled",
      payload: { sector: { name: "Кафе" } },
    });
    expect(state.selected).toBe("cafe");
    expect(localStorage.getItem("selectedSector")).toBe("cafe");
  });

  it("selectSectorSelected reads from state shape", () => {
    expect(selectSectorSelected({ sector: { selected: "market" } })).toBe(
      "market",
    );
  });
});

describe("mapSectorNameToSlug", () => {
  it("maps known sector names", () => {
    expect(mapSectorNameToSlug("Барбершоп")).toBe("barber");
    expect(mapSectorNameToSlug("Строительная компания")).toBe("building");
  });
});
