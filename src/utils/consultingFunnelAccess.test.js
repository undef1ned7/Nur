import { describe, it, expect } from "vitest";
import {
  isConsultingRegionalSupervisor,
  getUserRegionCodes,
  resolveFunnelRegionCode,
  isRegionInUserScope,
  shouldIsolateConsultingByOwner,
  canAccessConsultingLeadInbox,
  canAccessConsultingLeadSettings,
  canRedistributeRegionalLeads,
  canManageConsultingEmployees,
  canCreateElevatedEmployees,
  canCreateConsultingFunnel,
  canViewConsultingFunnel,
  filterFunnelsForUser,
  canManageLeadsInFunnel,
  isConsultingFunnelManager,
} from "./consultingFunnelAccess";
import {
  buildFunnelTree,
  resolveTopFunnel,
} from "./consultingFunnelTree";

const owner = { role: "owner" };
const supOsh = {
  role: "supervisor",
  consulting_region_codes: ["osh"],
  can_view_funnel: true,
};
const supMulti = {
  role: "supervisor",
  consulting_region_codes: ["osh", "bishkek"],
};
const seller = {
  role: "salesperson",
  can_view_funnel: true,
  can_manage_funnel_leads: true,
};

const funnels = [
  { id: "f-osh", name: "Ош", region_code: "osh" },
  { id: "f-bish", name: "Бишкек", region_code: "bishkek" },
  { id: "f-main", name: "Основная воронка", is_main: true },
  { id: "f-impl", name: "Внедрение" },
];

describe("consultingFunnelAccess — supervisor / regions", () => {
  it("распознаёт роль supervisor", () => {
    expect(isConsultingRegionalSupervisor(supOsh)).toBe(true);
    expect(isConsultingRegionalSupervisor(owner)).toBe(false);
    expect(isConsultingFunnelManager(supOsh)).toBe(false);
  });

  it("нормализует коды регионов пользователя", () => {
    expect(getUserRegionCodes(supOsh)).toEqual(["osh"]);
    expect(getUserRegionCodes({ consulting_region_codes: [" Osh ", "", "BISHKEK"] })).toEqual([
      "osh",
      "bishkek",
    ]);
    expect(getUserRegionCodes(owner)).toEqual([]);
  });

  it("resolveFunnelRegionCode читает region_code / region", () => {
    expect(resolveFunnelRegionCode({ region_code: "OSH" })).toBe("osh");
    expect(resolveFunnelRegionCode({ region: "bishkek" })).toBe("bishkek");
    expect(resolveFunnelRegionCode({ name: "x" })).toBe(null);
  });

  it("isRegionInUserScope: manager — любой, supervisor — только свой", () => {
    expect(isRegionInUserScope(owner, "osh")).toBe(true);
    expect(isRegionInUserScope(supOsh, "osh")).toBe(true);
    expect(isRegionInUserScope(supOsh, "bishkek")).toBe(false);
  });

  it("supervisor не изолируется по owner (видит весь регион)", () => {
    expect(shouldIsolateConsultingByOwner(supOsh)).toBe(false);
    expect(shouldIsolateConsultingByOwner(seller)).toBe(true);
  });

  it("supervisor видит inbox и воронку, но не настройки распределения", () => {
    expect(canAccessConsultingLeadInbox(supOsh)).toBe(true);
    expect(canViewConsultingFunnel(supOsh)).toBe(true);
    expect(canAccessConsultingLeadSettings(supOsh)).toBe(false);
    expect(canRedistributeRegionalLeads(supOsh)).toBe(false);
    expect(canRedistributeRegionalLeads(owner)).toBe(true);
  });

  it("supervisor может заводить сотрудников, но не эскалировать роли", () => {
    expect(canManageConsultingEmployees(supOsh)).toBe(true);
    expect(canCreateElevatedEmployees(supOsh)).toBe(false);
    expect(canCreateElevatedEmployees(owner)).toBe(true);
  });

  it("filterFunnelsForUser: supervisor видит только воронки своих регионов", () => {
    const visible = filterFunnelsForUser(funnels, supOsh).map((f) => f.id);
    expect(visible).toEqual(["f-osh"]);

    const multi = filterFunnelsForUser(funnels, supMulti).map((f) => f.id);
    expect(multi.sort()).toEqual(["f-bish", "f-osh"]);

    expect(filterFunnelsForUser(funnels, owner)).toHaveLength(4);
  });

  it("filterFunnelsForUser: учитывает явные funnel_grants supervisor", () => {
    const withGrant = {
      ...supOsh,
      funnel_grants: [{ funnel_id: "f-impl", can_manage_leads: true }],
    };
    const ids = filterFunnelsForUser(funnels, withGrant).map((f) => f.id);
    expect(ids.sort()).toEqual(["f-impl", "f-osh"]);
  });

  it("canManageLeadsInFunnel: supervisor — только в воронке своего региона", () => {
    expect(canManageLeadsInFunnel(supOsh, funnels[0])).toBe(true); // Ош
    expect(canManageLeadsInFunnel(supOsh, funnels[1])).toBe(false); // Бишкек
  });
});

describe("consultingFunnelAccess — создание воронок сотрудником", () => {
  it("canCreateConsultingFunnel: manager всегда, сотрудник — по праву", () => {
    expect(canCreateConsultingFunnel(owner)).toBe(true);
    expect(canCreateConsultingFunnel(seller)).toBe(false);
    expect(
      canCreateConsultingFunnel({ ...seller, can_create_funnel: true }),
    ).toBe(true);
    expect(canCreateConsultingFunnel(null)).toBe(false);
  });

  it("filterFunnelsForUser: автор видит свою подворонку по owner_user", () => {
    const sellerOsh = {
      ...seller,
      id: "u-1",
      consulting_region_codes: ["osh"],
    };
    const withChild = [
      ...funnels,
      {
        id: "f-osh-u1",
        name: "Ош · Айбек",
        region_code: "osh",
        parent_funnel: "f-osh",
        owner_user: "u-1",
      },
      {
        id: "f-osh-u2",
        name: "Ош · Нур",
        region_code: "osh",
        parent_funnel: "f-osh",
        owner_user: "u-2",
      },
    ];
    const ids = filterFunnelsForUser(withChild, sellerOsh).map((f) => f.id);
    expect(ids).toContain("f-osh-u1");
    expect(ids).not.toContain("f-osh-u2");
  });
});

describe("consultingFunnelTree", () => {
  const tree = buildFunnelTree([
    { id: "f-osh", name: "Ош", region_code: "osh" },
    { id: "f-bish", name: "Бишкек", region_code: "bishkek" },
    { id: "f-main", name: "Основная воронка", is_main: true },
    { id: "c-1", name: "Ош · Айбек", parent_funnel: "f-osh", created_at: "2026-01-02" },
    { id: "c-2", name: "Ош · Нур", parent_funnel: "f-osh", created_at: "2026-01-01" },
    { id: "orphan", name: "Осиротевшая", parent_funnel: "missing" },
  ]);

  it("roots — только воронки без видимого родителя", () => {
    expect(tree.roots.map((f) => f.id).sort()).toEqual(
      ["f-bish", "f-main", "f-osh", "orphan"].sort(),
    );
  });

  it("подворонки сгруппированы по родителю и отсортированы по дате", () => {
    expect(tree.childrenByParent.get("f-osh").map((f) => f.id)).toEqual([
      "c-2",
      "c-1",
    ]);
  });

  it("resolveTopFunnel поднимается к региональной воронке", () => {
    expect(resolveTopFunnel(tree.byId.get("c-1"), tree.byId).id).toBe("f-osh");
    expect(resolveTopFunnel(tree.byId.get("f-osh"), tree.byId).id).toBe("f-osh");
    expect(resolveTopFunnel(tree.byId.get("orphan"), tree.byId).id).toBe(
      "orphan",
    );
  });
});
