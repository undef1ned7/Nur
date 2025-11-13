import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  fetchOrdersApi,
  fetchOrderByIdApi,
  createOrderApi,
  deleteOrderApi,
  updateOrderApi,
  fetchSalesHistoryApi,
} from "../../api/orders"; // Импортируем API-функции

export const fetchOrdersAsync = createAsyncThunk(
  "orders/fetchOrders",
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await fetchOrdersApi(params);
      // console.log(response,'response');

      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const fetchOrderByIdAsync = createAsyncThunk(
  "orders/fetchOrderById",
  async (orderId, { rejectWithValue }) => {
    try {
      const order = await fetchOrderByIdApi(orderId);
      return order;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const createOrderAsync = createAsyncThunk(
  "orders/createOrder",
  async (orderData, { rejectWithValue }) => {
    try {
      const newOrder = await createOrderApi(orderData);
      return newOrder;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const deleteOrderAsync = createAsyncThunk(
  "orders/deleteOrder",
  async (orderId, { rejectWithValue }) => {
    try {
      await deleteOrderApi(orderId);
      return orderId;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const updateOrderAsync = createAsyncThunk(
  "orders/updateOrder",
  async ({ orderId, updatedData }, { rejectWithValue }) => {
    try {
      const updatedOrder = await updateOrderApi(orderId, updatedData);
      return updatedOrder;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// История продаж для сотрудника
export const historySellProduct = createAsyncThunk(
  "orders/historySellProduct",
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await fetchSalesHistoryApi(params);
      return response;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);
