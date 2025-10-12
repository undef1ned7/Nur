import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api";

export const getConsultingServices = createAsyncThunk(
  "consulting/getServices",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/consalting/services/");
      return data.results;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

export const getConsultingRows = createAsyncThunk(
  "consulting/getRows",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/consalting/sales/");
      return data.results;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);
export const getConsultingRequests = createAsyncThunk(
  "consulting/getRequests",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/consalting/requests/");
      return data.results;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);
export const getConsultingRequestDetail = createAsyncThunk(
  "consulting/getRequestDetail",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/consalting/requests/${id}/`);
      return data;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

export const createConsultingSale = createAsyncThunk(
  "consulting/createSale",
  async (data, { rejectWithValue }) => {
    try {
      const { data: response } = await api.post("/consalting/sales/", data);
      return response;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

export const createConsultingRequest = createAsyncThunk(
  "consulting/createRequest",
  async (data, { rejectWithValue }) => {
    try {
      const { data: response } = await api.post("/consalting/requests/", data);
      return response;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

export const deleteConsultingSale = createAsyncThunk(
  "consulting/deleteSale",
  async (id, { rejectWithValue }) => {
    try {
      const { data: response } = await api.delete(`/consalting/sales/${id}/`);
      return response;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);
export const deleteConsultingRequest = createAsyncThunk(
  "consulting/deleteRequest",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/consalting/requests/${id}/`);
      return id;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);
export const deleteConsultingService = createAsyncThunk(
  "consulting/deleteService",
  async (id, { rejectWithValue }) => {
    try {
      const { data: response } = await api.delete(
        `/consalting/services/${id}/`
      );
      return response;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

export const createConsultingService = createAsyncThunk(
  "consulting/createService",
  async (data, { rejectWithValue }) => {
    try {
      const { data: response } = await api.post("/consalting/services/", data);
      return response;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

export const editConsultingService = createAsyncThunk(
  "consulting/editService",
  async ({ data, id }, { rejectWithValue }) => {
    try {
      const { data: response } = await api.patch(
        `/consalting/services/${id}/`,
        data
      );
      return response;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);
export const editConsultingRequest = createAsyncThunk(
  "consulting/editRequest",
  async ({ data, id }, { rejectWithValue }) => {
    try {
      const { data: response } = await api.patch(
        `/consalting/requests/${id}/`,
        data
      );
      return response;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

// export const
