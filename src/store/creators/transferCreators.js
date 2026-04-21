// src/store/creators/transferCreators.js
import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  fetchTransfersApi,
  createTransferApi,
  createBulkTransferApi,
  getTransferApi,
  updateTransferApi,
  deleteTransferApi,
  updateProductQuantityApi,
  fetchAcceptancesApi,
  createAcceptanceApi,
  getAcceptanceApi,
  updateAcceptanceApi,
  deleteAcceptanceApi,
  acceptInlineApi,
  fetchReturnsApi,
  createReturnApi,
  getReturnApi,
  approveReturnApi,
  approveReturnsBulkApi,
  rejectReturnApi,
  createAgentMeReturnApi,
} from "../../api/transfers";
import api from "../../api";

/* =================================================================== */
/*                          MANUFACTURE SUBREALS (TRANSFERS)          */
/* =================================================================== */

export const fetchTransfersAsync = createAsyncThunk(
  "transfers/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchTransfersApi(params);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const createTransferAsync = createAsyncThunk(
  "transfers/create",
  async (data, { rejectWithValue }) => {
    try {
      return await createTransferApi(data);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const createBulkTransferAsync = createAsyncThunk(
  "transfers/createBulk",
  async (data, { rejectWithValue }) => {
    try {
      return await createBulkTransferApi(data);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const getTransferAsync = createAsyncThunk(
  "transfers/getOne",
  async (transferId, { rejectWithValue }) => {
    try {
      return await getTransferApi(transferId);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const updateTransferAsync = createAsyncThunk(
  "transfers/update",
  async ({ transferId, updatedData }, { rejectWithValue }) => {
    try {
      return await updateTransferApi(transferId, updatedData);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const updateMeProducts = createAsyncThunk(
  "meProducts/update",
  async (updatedData, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(
        "/main/agents/me/products/",
        updatedData
      );
      return data;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const deleteTransferAsync = createAsyncThunk(
  "transfers/delete",
  async (transferId, { rejectWithValue }) => {
    try {
      await deleteTransferApi(transferId);
      return transferId;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const updateProductQuantityAsync = createAsyncThunk(
  "transfers/updateProductQuantity",
  async ({ productId, quantityData }, { rejectWithValue }) => {
    try {
      return await updateProductQuantityApi(productId, quantityData);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

/* =================================================================== */
/*                              ACCEPTANCES                           */
/* =================================================================== */

export const fetchAcceptancesAsync = createAsyncThunk(
  "acceptances/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchAcceptancesApi(params);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const createAcceptanceAsync = createAsyncThunk(
  "acceptances/create",
  async (data, { rejectWithValue }) => {
    try {
      return await createAcceptanceApi(data);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const getAcceptanceAsync = createAsyncThunk(
  "acceptances/getOne",
  async (acceptanceId, { rejectWithValue }) => {
    try {
      return await getAcceptanceApi(acceptanceId);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const updateAcceptanceAsync = createAsyncThunk(
  "acceptances/update",
  async ({ acceptanceId, updatedData }, { rejectWithValue }) => {
    try {
      return await updateAcceptanceApi(acceptanceId, updatedData);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const deleteAcceptanceAsync = createAsyncThunk(
  "acceptances/delete",
  async (acceptanceId, { rejectWithValue }) => {
    try {
      await deleteAcceptanceApi(acceptanceId);
      return acceptanceId;
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

/* =================================================================== */
/*                          INLINE ACCEPT                             */
/* =================================================================== */

export const acceptInlineAsync = createAsyncThunk(
  "acceptances/acceptInline",
  async (acceptData, { rejectWithValue }) => {
    try {
      return await acceptInlineApi(acceptData);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

/* =================================================================== */
/*                              RETURNS                               */
/* =================================================================== */

export const fetchReturnsAsync = createAsyncThunk(
  "returns/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      return await fetchReturnsApi(params);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const createReturnAsync = createAsyncThunk(
  "returns/create",
  async (data, { rejectWithValue, getState }) => {
    try {
      const role = getState()?.user?.profile?.role;
      if (role === "agent") {
        return await createAgentMeReturnApi(data);
      }
      return await createReturnApi(data);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const getReturnAsync = createAsyncThunk(
  "returns/getOne",
  async (returnId, { rejectWithValue }) => {
    try {
      return await getReturnApi(returnId);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const approveReturnAsync = createAsyncThunk(
  "returns/approve",
  async (returnId, { rejectWithValue }) => {
    try {
      return await approveReturnApi(returnId);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);

export const approveReturnsBulkAsync = createAsyncThunk(
  "returns/approveBulk",
  async (payload, { rejectWithValue }) => {
    try {
      return await approveReturnsBulkApi(payload);
    } catch (error) {
      return rejectWithValue(
        error?.response?.data ?? error?.message ?? error,
      );
    }
  }
);

export const rejectReturnAsync = createAsyncThunk(
  "returns/reject",
  async (returnId, { rejectWithValue }) => {
    try {
      return await rejectReturnApi(returnId);
    } catch (error) {
      return rejectWithValue(error?.response?.data || error?.message);
    }
  }
);
