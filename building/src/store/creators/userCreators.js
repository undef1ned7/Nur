// src/store/creators/userCreators.js
import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  registerUser,
  loginUser,
  getIndustries,
  getSubscriptionPlans,
  migrateUserPermissions,
} from "../../api/auth";
import api from "../../api";
import { setSector } from "../slices/sectorSlice";
import { mapSectorNameToSlug } from "../../utils/sectorMapping";
import { handleThunkError } from "./utils/handleThunkError";

export const registerUserAsync = createAsyncThunk(
  "user/register",
  async (props, { rejectWithValue }) => {
    try {
      const response = await registerUser(props.formData);
      if (response.status) {
        props.navigate("/login");
      }
      return response;
    } catch (error) {
      return handleThunkError(error, rejectWithValue);
    }
  }
);

export const loginUserAsync = createAsyncThunk(
  "user/login",
  async (formData, { rejectWithValue, dispatch }) => {
    try {
      const response = await loginUser(formData);
      localStorage.setItem("userData", JSON.stringify(response));
      if (response.access) {
        localStorage.setItem("accessToken", response.access);
      }
      if (response.refresh) {
        localStorage.setItem("refreshToken", response.refresh);
      }

      if (response.access) {
        // Миграция permissions — не блокируем логин при её падении
        try {
          await migrateUserPermissions();
        } catch (migrationError) {
          console.error("Migration failed:", migrationError);
        }

        // Синхронизируем sector slug в Redux + localStorage для persistence
        try {
          const { data: company } = await api.get("/users/company/", {
            headers: {
              Authorization: `Bearer ${response.access}`,
            },
          });
          const slug = mapSectorNameToSlug(company?.sector?.name);
          if (slug) {
            dispatch(setSector(slug));
          }
        } catch (companyError) {
          console.error("Failed to sync sector on login:", companyError);
        }
      }

      return response;
    } catch (error) {
      return handleThunkError(error, rejectWithValue);
    }
  }
);

export const getIndustriesAsync = createAsyncThunk(
  "user/getIndustries",
  async (_, { rejectWithValue }) => {
    try {
      const response = await getIndustries();
      return response;
    } catch (error) {
      return handleThunkError(error, rejectWithValue);
    }
  }
);

export const getSubscriptionPlansAsync = createAsyncThunk(
  "user/getSubscriptionPlans",
  async (_, { rejectWithValue }) => {
    try {
      const response = await getSubscriptionPlans();
      return response;
    } catch (error) {
      return handleThunkError(error, rejectWithValue);
    }
  }
);

export const getCompany = createAsyncThunk(
  "user/fetchCompany",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/users/company/", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });
      return data;
    } catch (error) {
      return handleThunkError(error, rejectWithValue);
    }
  }
);

export const submitApplicationAsync = createAsyncThunk(
  "user/submitApplication",
  async (applicationData, { rejectWithValue }) => {
    try {
      const response = await api.post("/main/applications/", applicationData);
      return response.data;
    } catch (error) {
      return handleThunkError(error, rejectWithValue);
    }
  }
);

export const getApplicationList = createAsyncThunk(
  "user/getApplicationList",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/main/applications/");
      return data;
    } catch (error) {
      return handleThunkError(error, rejectWithValue);
    }
  }
);

export const updateApplication = createAsyncThunk(
  "user/updateApplication",
  async ({ id, updatedData }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(
        `/main/applications/${id}/`,
        updatedData
      );
      return data;
    } catch (err) {
      return handleThunkError(err, rejectWithValue);
    }
  }
);

export const updateUserData = createAsyncThunk(
  "user/updateUserData",
  async (userData, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(
        `/users/settings/change-password/`,
        userData
      );
      return data;
    } catch (err) {
      return handleThunkError(err, rejectWithValue);
    }
  }
);

export const updateUserCompanyName = createAsyncThunk(
  "user/updateCompanyName",
  async (userData, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/users/settings/company/`, userData);
      return data;
    } catch (err) {
      return handleThunkError(err, rejectWithValue);
    }
  }
);

export const getScalesToken = createAsyncThunk(
  "user/getScalesToken",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/users/scales/token/");
      return data;
    } catch (err) {
      return handleThunkError(err, rejectWithValue);
    }
  }
);

export const sendProductsToScales = createAsyncThunk(
  "user/sendProductsToScales",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/users/scales/send-products/", payload);
      return data;
    } catch (err) {
      return handleThunkError(err, rejectWithValue);
    }
  }
);
