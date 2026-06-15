import { describe, expect, it, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import {
  loginUserAsync,
  getIndustriesAsync,
  registerUserAsync,
} from "./userCreators";
import userReducer from "../slices/userSlice";
import sectorReducer from "../slices/sectorSlice";

vi.mock("../../api/auth", () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  getIndustries: vi.fn(),
  getSubscriptionPlans: vi.fn(),
  migrateUserPermissions: vi.fn(),
}));

vi.mock("../../api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import {
  registerUser,
  loginUser,
  getIndustries,
  migrateUserPermissions,
} from "../../api/auth";
import api from "../../api";

const createTestStore = () =>
  configureStore({
    reducer: { user: userReducer, sector: sectorReducer },
  });

describe("userCreators", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("loginUserAsync", () => {
    it("stores tokens in localStorage on success", async () => {
      loginUser.mockResolvedValue({
        access: "access-token",
        refresh: "refresh-token",
        id: 1,
      });
      migrateUserPermissions.mockResolvedValue({});
      api.get.mockResolvedValue({
        data: { sector: { name: "Кафе" } },
      });

      const store = createTestStore();
      await store.dispatch(
        loginUserAsync({ email: "a@b.c", password: "secret" }),
      );

      expect(localStorage.getItem("accessToken")).toBe("access-token");
      expect(localStorage.getItem("refreshToken")).toBe("refresh-token");
      expect(localStorage.getItem("selectedSector")).toBe("cafe");
      expect(store.getState().sector.selected).toBe("cafe");
      expect(store.getState().user.loading).toBe(false);
    });

    it("returns rejectWithValue payload on login failure", async () => {
      loginUser.mockRejectedValue({
        response: { data: { detail: "Invalid credentials" } },
      });

      const store = createTestStore();
      const result = await store.dispatch(
        loginUserAsync({ email: "a@b.c", password: "wrong" }),
      );

      expect(result.type).toBe("user/login/rejected");
      expect(result.payload).toBe("Invalid credentials");
    });
  });

  describe("getIndustriesAsync", () => {
    it("returns industries list on success", async () => {
      const industries = [{ id: 1, name: "Кафе" }];
      getIndustries.mockResolvedValue(industries);

      const store = createTestStore();
      const result = await store.dispatch(getIndustriesAsync());

      expect(result.type).toBe("user/getIndustries/fulfilled");
      expect(result.payload).toEqual(industries);
    });
  });

  describe("registerUserAsync", () => {
    it("navigates to login when registration succeeds", async () => {
      const navigate = vi.fn();
      registerUser.mockResolvedValue({ status: true });

      const store = createTestStore();
      await store.dispatch(
        registerUserAsync({ formData: { email: "x@y.z" }, navigate }),
      );

      expect(navigate).toHaveBeenCalledWith("/login");
    });
  });
});
