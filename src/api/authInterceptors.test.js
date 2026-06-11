import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createAuthResponseInterceptor } from "./authInterceptors";

describe("createAuthResponseInterceptor", () => {
  let api;
  let axiosLib;
  let interceptor;

  beforeEach(() => {
    localStorage.clear();
    delete window.location;
    window.location = { href: "" };

    api = {
      post: vi.fn(),
      defaults: { headers: { common: {} } },
    };
    axiosLib = vi.fn();
    interceptor = createAuthResponseInterceptor(api, axiosLib);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes through non-401 errors", async () => {
    const err = { response: { status: 500 }, config: { url: "/foo" } };
    await expect(interceptor(err)).rejects.toBe(err);
    expect(api.post).not.toHaveBeenCalled();
  });

  it("redirects to login when refresh token is missing", async () => {
    localStorage.setItem("accessToken", "old-access");
    const err = {
      response: { status: 401 },
      config: { url: "/users/profile/", headers: {} },
    };

    await expect(interceptor(err)).rejects.toBe(err);
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(window.location.href).toBe("/login");
  });

  it("refreshes token and retries the original request", async () => {
    localStorage.setItem("accessToken", "old-access");
    localStorage.setItem("refreshToken", "refresh-123");

    const originalRequest = {
      url: "/users/profile/",
      headers: {},
    };
    const err = { response: { status: 401 }, config: originalRequest };
    const retryResponse = { data: { ok: true } };

    const apiWithRetry = Object.assign(
      vi.fn().mockResolvedValue(retryResponse),
      {
        post: vi.fn().mockResolvedValue({ data: { access: "new-access" } }),
        defaults: { headers: { common: {} } },
      },
    );
    interceptor = createAuthResponseInterceptor(apiWithRetry, axiosLib);

    const result = await interceptor(err);

    expect(apiWithRetry.post).toHaveBeenCalledWith("/users/auth/refresh/", {
      refresh: "refresh-123",
    });
    expect(localStorage.getItem("accessToken")).toBe("new-access");
    expect(originalRequest.headers.Authorization).toBe("Bearer new-access");
    expect(apiWithRetry).toHaveBeenCalledWith(originalRequest);
    expect(result).toEqual(retryResponse);
  });

  it("clears tokens and redirects when refresh fails", async () => {
    localStorage.setItem("accessToken", "old-access");
    localStorage.setItem("refreshToken", "refresh-123");

    const err = {
      response: { status: 401 },
      config: { url: "/users/profile/", headers: {} },
    };
    const refreshError = new Error("refresh failed");
    refreshError.response = { status: 500 };
    api.post.mockRejectedValueOnce(refreshError);

    await expect(interceptor(err)).rejects.toBe(refreshError);
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(window.location.href).toBe("/login");
  });

  it("keeps tokens when refresh fails due to network error", async () => {
    localStorage.setItem("accessToken", "old-access");
    localStorage.setItem("refreshToken", "refresh-123");

    const err = {
      response: { status: 401 },
      config: { url: "/users/profile/", headers: {} },
    };
    const refreshError = new Error("Network Error");
    refreshError.code = "ERR_NETWORK";
    api.post.mockRejectedValueOnce(refreshError);

    await expect(interceptor(err)).rejects.toBe(refreshError);
    expect(localStorage.getItem("accessToken")).toBe("old-access");
    expect(localStorage.getItem("refreshToken")).toBe("refresh-123");
    expect(window.location.href).toBe("");
  });

  it("does not retry refresh endpoint on 401", async () => {
    localStorage.setItem("accessToken", "old-access");
    localStorage.setItem("refreshToken", "refresh-123");

    const err = {
      response: { status: 401 },
      config: { url: "/users/auth/refresh/", headers: {} },
    };

    await expect(interceptor(err)).rejects.toBe(err);
    expect(api.post).not.toHaveBeenCalled();
  });
});
