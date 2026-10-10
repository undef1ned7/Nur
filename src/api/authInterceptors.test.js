import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createAuthRequestInterceptor,
  createAuthResponseInterceptor,
  createTokenRefresher,
  getJwtExpiryMs,
  isAccessTokenExpiring,
} from "./authInterceptors";

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

const makeJwt = (expSec) => {
  const enc = (obj) =>
    btoa(JSON.stringify(obj))
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${enc({ alg: "HS256" })}.${enc({ exp: expSec })}.sig`;
};

describe("JWT expiry helpers", () => {
  it("reads exp from JWT payload", () => {
    expect(getJwtExpiryMs(makeJwt(1000))).toBe(1_000_000);
    expect(getJwtExpiryMs("not-a-jwt")).toBeNull();
    expect(getJwtExpiryMs(null)).toBeNull();
  });

  it("detects expired / expiring tokens", () => {
    const now = 1_000_000;
    expect(isAccessTokenExpiring(makeJwt(now / 1000 - 10), now)).toBe(true);
    expect(isAccessTokenExpiring(makeJwt(now / 1000 + 10), now)).toBe(true);
    expect(isAccessTokenExpiring(makeJwt(now / 1000 + 3600), now)).toBe(false);
    expect(isAccessTokenExpiring("opaque-token", now)).toBe(false);
  });
});

describe("createAuthRequestInterceptor (proactive refresh)", () => {
  let api;
  let refresher;
  let interceptor;

  beforeEach(() => {
    localStorage.clear();
    api = {
      post: vi.fn(),
      defaults: { headers: { common: {} } },
    };
    refresher = createTokenRefresher(api);
    interceptor = createAuthRequestInterceptor(refresher);
  });

  it("attaches current token without refresh when it is still valid", async () => {
    const token = makeJwt(Math.floor(Date.now() / 1000) + 3600);
    localStorage.setItem("accessToken", token);
    localStorage.setItem("refreshToken", "refresh-123");

    const config = await interceptor({ url: "/users/profile/", headers: {} });
    expect(config.headers.Authorization).toBe(`Bearer ${token}`);
    expect(api.post).not.toHaveBeenCalled();
  });

  it("refreshes expired token before the request, once for parallel requests", async () => {
    localStorage.setItem(
      "accessToken",
      makeJwt(Math.floor(Date.now() / 1000) - 60),
    );
    localStorage.setItem("refreshToken", "refresh-123");
    let resolvePost;
    api.post.mockReturnValue(
      new Promise((r) => {
        resolvePost = r;
      }),
    );

    const p1 = interceptor({ url: "/users/profile/", headers: {} });
    const p2 = interceptor({ url: "/users/company/", headers: {} });
    resolvePost({ data: { access: "new-access" } });
    const [c1, c2] = await Promise.all([p1, p2]);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith("/users/auth/refresh/", {
      refresh: "refresh-123",
    });
    expect(c1.headers.Authorization).toBe("Bearer new-access");
    expect(c2.headers.Authorization).toBe("Bearer new-access");
    expect(localStorage.getItem("accessToken")).toBe("new-access");
  });

  it("stores rotated refresh token when backend returns it", async () => {
    localStorage.setItem("accessToken", makeJwt(1));
    localStorage.setItem("refreshToken", "refresh-old");
    api.post.mockResolvedValue({
      data: { access: "new-access", refresh: "refresh-new" },
    });

    await interceptor({ url: "/users/profile/", headers: {} });
    expect(localStorage.getItem("refreshToken")).toBe("refresh-new");
  });

  it("sends request with old token when proactive refresh fails (network)", async () => {
    const oldToken = makeJwt(1);
    localStorage.setItem("accessToken", oldToken);
    localStorage.setItem("refreshToken", "refresh-123");
    const netErr = new Error("Network Error");
    netErr.code = "ERR_NETWORK";
    api.post.mockRejectedValue(netErr);

    const config = await interceptor({ url: "/cafe/orders/", headers: {} });
    expect(config.headers.Authorization).toBe(`Bearer ${oldToken}`);
    expect(localStorage.getItem("accessToken")).toBe(oldToken);
    expect(localStorage.getItem("refreshToken")).toBe("refresh-123");
  });

  it("does not refresh for the refresh endpoint itself", async () => {
    localStorage.setItem("accessToken", makeJwt(1));
    localStorage.setItem("refreshToken", "refresh-123");

    await interceptor({ url: "/users/auth/refresh/", headers: {} });
    expect(api.post).not.toHaveBeenCalled();
  });
});
