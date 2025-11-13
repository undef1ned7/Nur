// src/store/slices/userSlice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  registerUserAsync,
  loginUserAsync,
  getIndustriesAsync,
  getSubscriptionPlansAsync,
  getCompany,
  getApplicationList,
  submitApplicationAsync,
  updateUserData,
  updateUserCompanyName,
} from "../creators/userCreators";
import { useSelector } from "react-redux";
import api from "../../api";

const initialState = {
  currentUser: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  accessToken: localStorage.getItem("accessToken") || null,
  industries: [],
  subscriptionPlans: [],
  userId: localStorage.getItem("userId") || "",
  tariff: "",
  sector: "",
  companyLoading: true,
  submitApplication: null,
  applicationList: [],
  company: null,
  errorChange: null,
  profile: null,
};

export const getProfile = createAsyncThunk(
  "get/profile",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/users/profile/");
      return data;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    logoutUser: (state) => {
      state.currentUser = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      state.accessToken = null;
      localStorage.removeItem("accessToken");
      localStorage.removeItem("userId");
    },
  },
  extraReducers: (builder) => {
    builder
      // REGISTER
      .addCase(registerUserAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUserAsync.fulfilled, (state) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(registerUserAsync.rejected, (state, action) => {
        state.loading = false;
        state.currentUser = null;
        state.isAuthenticated = false;
        state.error = action.payload;
      })

      // LOGIN
      .addCase(loginUserAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUserAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload.user || action.payload;
        state.isAuthenticated = true;
        state.userId = action.payload.user_id;
        localStorage.setItem("userId", action.payload.user_id);
        if (action.payload.auth_token) {
          state.accessToken = action.payload.auth_token;
        }
        state.error = null;
      })
      .addCase(loginUserAsync.rejected, (state, action) => {
        state.loading = false;
        state.currentUser = null;
        state.isAuthenticated = false;
        state.accessToken = null;
        localStorage.removeItem("accessToken");
        state.error = action.payload; // тут уже лежит нормализованный payload (detail/non_field_errors/и т.п.)
      })

      // INDUSTRIES
      .addCase(getIndustriesAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getIndustriesAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.industries = action.payload;
        state.error = null;
      })

      // PLANS
      .addCase(getSubscriptionPlansAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getSubscriptionPlansAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.subscriptionPlans = action.payload;
        state.error = null;
      })

      // COMPANY
      .addCase(getCompany.pending, (state) => {
        state.companyLoading = true;
      })
      .addCase(getCompany.fulfilled, (state, { payload }) => {
        state.companyLoading = false;
        state.company = payload;
        state.sector = payload?.sector?.name;
        state.tariff = payload?.subscription_plan?.name;
      })
      .addCase(getCompany.rejected, (state, { payload }) => {
        state.companyLoading = false;
        state.company = null;
        state.error = payload;
      })

      // APPLICATIONS
      .addCase(submitApplicationAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(submitApplicationAsync.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.submitApplication = payload;
      })
      .addCase(submitApplicationAsync.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })
      .addCase(getProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getProfile.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.profile = payload;
      })
      .addCase(getProfile.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })
      .addCase(getApplicationList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getApplicationList.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.applicationList = payload.results;
      })
      .addCase(getApplicationList.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      })

      // UPDATE USER DATA (пароль и т.п.)
      .addCase(updateUserData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUserData.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(updateUserData.rejected, (state, { payload }) => {
        state.loading = false;
        if (payload) {
          state.errorChange = payload;
        } else {
          state.errorChange = {
            detail: "Не найдено активной учетной записи с указанными данными",
          };
        }
      })

      // UPDATE COMPANY NAME
      .addCase(updateUserCompanyName.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUserCompanyName.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(updateUserCompanyName.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload;
      });
  },
});

export const { logoutUser } = userSlice.actions;
export const useUser = () => useSelector((state) => state.user);
export default userSlice.reducer;
