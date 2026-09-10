import { describe, expect, it } from "vitest";
import {
  cashflowsPaginationButtons,
  computeCashflowsHasNext,
  shouldShowCashflowsPagination,
} from "./cashflowsPagination.js";

const PAGE = 100;

describe("computeCashflowsHasNext", () => {
  it("false for single page (5 из 5)", () => {
    expect(
      computeCashflowsHasNext({
        dataNext: null,
        count: 5,
        pageNum: 1,
        pageSize: PAGE,
        resultsLength: 5,
      }),
    ).toBe(false);
  });

  it("true for first page when count > page_size", () => {
    expect(
      computeCashflowsHasNext({
        dataNext: "http://api/page2",
        count: 150,
        pageNum: 1,
        pageSize: PAGE,
        resultsLength: PAGE,
      }),
    ).toBe(true);
  });

  it("true by count math without data.next", () => {
    expect(
      computeCashflowsHasNext({
        dataNext: null,
        count: 150,
        pageNum: 1,
        pageSize: PAGE,
        resultsLength: PAGE,
      }),
    ).toBe(true);
  });

  it("false on last page", () => {
    expect(
      computeCashflowsHasNext({
        dataNext: null,
        count: 150,
        pageNum: 2,
        pageSize: PAGE,
        resultsLength: 50,
      }),
    ).toBe(false);
  });

  it("true when count unknown but full page returned", () => {
    expect(
      computeCashflowsHasNext({
        dataNext: null,
        count: null,
        pageNum: 1,
        pageSize: PAGE,
        resultsLength: PAGE,
      }),
    ).toBe(true);
  });
});

describe("cashflowsPaginationButtons", () => {
  it("hides both on first and only page", () => {
    expect(cashflowsPaginationButtons({ pageNum: 1, hasNext: false })).toEqual({
      showPrev: false,
      showNext: false,
    });
  });

  it("shows only forward on first page with more data", () => {
    expect(cashflowsPaginationButtons({ pageNum: 1, hasNext: true })).toEqual({
      showPrev: false,
      showNext: true,
    });
  });

  it("shows only back on last page", () => {
    expect(cashflowsPaginationButtons({ pageNum: 3, hasNext: false })).toEqual({
      showPrev: true,
      showNext: false,
    });
  });

  it("shows both on middle page", () => {
    expect(cashflowsPaginationButtons({ pageNum: 2, hasNext: true })).toEqual({
      showPrev: true,
      showNext: true,
    });
  });
});

describe("shouldShowCashflowsPagination", () => {
  it("hidden while loading", () => {
    expect(
      shouldShowCashflowsPagination({
        loading: true,
        itemsLength: 5,
        pageNum: 1,
        hasNext: false,
      }),
    ).toBe(false);
  });

  it("shown for single page with items", () => {
    expect(
      shouldShowCashflowsPagination({
        loading: false,
        itemsLength: 5,
        pageNum: 1,
        hasNext: false,
      }),
    ).toBe(true);
  });

  it("shown on page > 1 even if current slice empty", () => {
    expect(
      shouldShowCashflowsPagination({
        loading: false,
        itemsLength: 0,
        pageNum: 2,
        hasNext: false,
      }),
    ).toBe(true);
  });
});
