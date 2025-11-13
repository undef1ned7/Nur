import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api";
const initialState = {
  loading: false,
  list: [],
  error: null,
};

export const getJobs = createAsyncThunk(
  "jobs/get",
  async (search, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/main/contractor-works/", {
        params: search,
      });
      return data.results;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

export const createJob = createAsyncThunk(
  "jobs/create",
  async (data, { rejectWithValue }) => {
    try {
      const { data: response } = await api.post(
        "/main/contractor-works/",
        data
      );
      return response.results;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

export const updateJob = createAsyncThunk(
  "jobs/update",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const { data: response } = await api.patch(
        `/main/contractor-works/${id}/`,
        data
      );
      return response.results;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

const jobsSlice = createSlice({
  name: "jobs",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getJobs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getJobs.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.list = payload;
      })
      .addCase(getJobs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createJob.fulfilled, (state, { payload }) => {
        state.loading = false;
        // state.list = payload;
      })
      .addCase(createJob.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateJob.fulfilled, (state, { payload }) => {
        state.loading = false;
        // state.list = payload;
      })
      .addCase(updateJob.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const useJobs = () => useSelector((state) => state.jobs);
export default jobsSlice.reducer;
