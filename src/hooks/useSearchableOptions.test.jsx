import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();

vi.mock("../api", () => ({
  default: { get: (...args) => getMock(...args) },
}));

const { useSearchableOptions } = await import("./useSearchableOptions");

const mapOption = (item) => ({
  value: String(item.id),
  label: String(item.name),
});

const page = (ids, next) => ({
  data: {
    count: 250,
    next,
    results: ids.map((id) => ({ id, name: `Товар ${id}` })),
  },
});

describe("useSearchableOptions", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("грузит первую страницу и отдаёт hasMore, пока на сервере есть ещё", async () => {
    getMock.mockResolvedValue(page([1, 2], "http://api/next"));

    const { result } = renderHook(() =>
      useSearchableOptions({ endpoint: "/main/brands/", mapOption }),
    );

    await waitFor(() => expect(result.current.options).toHaveLength(2));
    expect(result.current.hasMore).toBe(true);
    expect(getMock).toHaveBeenCalledWith("/main/brands/", {
      params: { page: 1, page_size: 100 },
    });
  });

  it("поиск уходит на бэкенд параметром search и сбрасывает список", async () => {
    getMock.mockResolvedValue(page([1], "http://api/next"));
    const { result } = renderHook(() =>
      useSearchableOptions({
        endpoint: "/main/clients/",
        params: { type: "suppliers" },
        mapOption,
        debounceMs: 0,
      }),
    );
    await waitFor(() => expect(result.current.options).toHaveLength(1));

    getMock.mockResolvedValue(page([7], null));
    act(() => result.current.setQuery("вода"));

    await waitFor(() =>
      expect(getMock).toHaveBeenLastCalledWith("/main/clients/", {
        params: { type: "suppliers", search: "вода", page: 1, page_size: 100 },
      }),
    );
    await waitFor(() => expect(result.current.options).toEqual([
      { value: "7", label: "Товар 7" },
    ]));
    expect(result.current.hasMore).toBe(false);
  });

  it("«Смотреть ещё» дописывает следующую страницу в конец без дублей", async () => {
    getMock.mockResolvedValue(page([1, 2], "http://api/p2"));
    const { result } = renderHook(() =>
      useSearchableOptions({ endpoint: "/main/brands/", mapOption }),
    );
    await waitFor(() => expect(result.current.options).toHaveLength(2));

    getMock.mockResolvedValue(page([2, 3], null));
    act(() => result.current.loadMore());

    await waitFor(() =>
      expect(result.current.options.map((o) => o.value)).toEqual([
        "1",
        "2",
        "3",
      ]),
    );
    expect(getMock).toHaveBeenLastCalledWith("/main/brands/", {
      params: { page: 2, page_size: 100 },
    });
    expect(result.current.hasMore).toBe(false);
  });

  it("не грузит справочник, пока enabled=false", async () => {
    getMock.mockResolvedValue(page([1], null));
    const { result } = renderHook(() =>
      useSearchableOptions({
        endpoint: "/main/brands/",
        mapOption,
        enabled: false,
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(getMock).not.toHaveBeenCalled();
    expect(result.current.options).toEqual([]);
  });
});
