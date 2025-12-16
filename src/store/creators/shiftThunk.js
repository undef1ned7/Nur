import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api";

// Делает ошибки сериализуемыми
const plainAxiosError = (error) => ({
  message: error?.message,
  code: error?.code,
  status: error?.response?.status,
  data: error?.response?.data,
  url: error?.config?.url,
  method: error?.config?.method,
});

// ===== Смены (Cash Shifts) =====

/**
 * Получить список смен
 * GET /construction/shifts/
 */
export const fetchShiftsAsync = createAsyncThunk(
  "shifts/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/construction/shifts/", { params });
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

/**
 * Получить детали смены
 * GET /construction/shifts/<id>/
 */
export const fetchShiftByIdAsync = createAsyncThunk(
  "shifts/fetchById",
  async (shiftId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/construction/shifts/${shiftId}/`);
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

/**
 * Открыть смену
 * POST /construction/shifts/open/
 * Body: { cashbox, cashier, opening_cash }
 */
export const openShiftAsync = createAsyncThunk(
  "shifts/open",
  async (shiftData, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/construction/shifts/open/", {
        cashbox: shiftData.cashbox,
        cashier: shiftData.cashier,
        opening_cash: String(shiftData.opening_cash || "0"),
      });
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

/**
 * Закрыть смену
 * POST /construction/shifts/<id>/close/
 * Body: { closing_cash }
 */
export const closeShiftAsync = createAsyncThunk(
  "shifts/close",
  async ({ shiftId, closingCash }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(
        `/construction/shifts/${shiftId}/close/`,
        {
          closing_cash: String(closingCash || "0"),
        }
      );
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);

/**
 * Получить продажи смены
 * GET /construction/cash/shifts/<id>/sales/
 * Query params:
 *   - status: paid, unpaid и т.д.
 *   - payment_method: cash, transfer и т.д.
 *   - date_from: YYYY-MM-DD
 *   - date_to: YYYY-MM-DD
 *   - ordering: -total (убывание по сумме), total (возрастание)
 *   - q: поиск по номеру чека
 */
export const fetchShiftSalesAsync = createAsyncThunk(
  "shifts/fetchSales",
  async ({ shiftId, params = {} }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(
        `/construction/cash/shifts/${shiftId}/sales/`,
        { params }
      );
      return data;
    } catch (error) {
      return rejectWithValue(plainAxiosError(error));
    }
  }
);
