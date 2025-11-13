import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api/";
export const fetchClientsAsync = createAsyncThunk(
  "client/fetchAll",
  async (clientParams, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/main/clients/", {
        params: clientParams,
      });
      return data; // { count, next, previous, results }
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const createClientAsync = createAsyncThunk(
  "client/create",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await api.post("/main/clients/", payload);
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const updateClientAsync = createAsyncThunk(
  "client/update",
  async ({ clientId, updatedData }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(
        `/main/clients/${clientId}/`,
        updatedData
      );
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const deleteClientAsync = createAsyncThunk(
  "client/delete",
  async (clientId, { rejectWithValue }) => {
    try {
      await api.delete(`/main/clients/${clientId}/`);
      return clientId;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const getItemClient = createAsyncThunk(
  "client/getItem",
  async (clientId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/main/clients/${clientId}/`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const createDeals = createAsyncThunk(
  "client/createDeals",
  async ({ clientId, ...data }, { rejectWithValue }) => {
    try {
      const { data: response } = await api.post(
        `/main/clients/${clientId}/deals/`,
        data
      );
      return response;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const getClientDeals = createAsyncThunk(
  "client/getClientDeals",
  async (clientId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/main/clients/${clientId}/deals/`);
      return data.results;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const getClientDealDetail = createAsyncThunk(
  "client/dealDetail",
  async ({ clientId, dealId }, { rejectWithValue }) => {
    try {
      const { data } = await api.get(
        `/main/clients/${clientId}/deals/${dealId}/`
      );
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const updateDealDetail = createAsyncThunk(
  "client/updateDeal",
  async ({ id, data, clientId }, { rejectWithValue }) => {
    try {
      const { data: response } = await api.patch(
        `/main/clients/${clientId}/deals/${id}/`,
        data
      );
      return response;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const payDebtDeal = createAsyncThunk(
  "client/payDebtDeal",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const { data: response } = await api.post(
        `/main/clientdeals/${id}/pay/`,
        data
      );
      return response;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const onPayDebtDeal = createAsyncThunk(
  "client/onPayDebtDeal",
  async (id, { rejectWithValue }) => {
    try {
      const { data: response } = await api.post(`/main/deals/${id}/unpay/`);
      return response;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const cancellationOfPayment = createAsyncThunk(
  "client/cancellationOfPayment",
  async (id, { rejectWithValue }) => {
    try {
      const { data: response } = await api.post(`/main/debts/${id}/`);
      return response;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const deleteDebt = createAsyncThunk(
  "client/deleteDebt",
  async (id, { rejectWithValue }) => {
    try {
      const { data: response } = await api.delete(`/main/clientdeals/${id}/`);
      return response;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);
