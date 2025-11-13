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
import axios from "axios";

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
      return rejectWithValue(
        error?.response?.data || { detail: error.message || "Register error" }
      );
    }
  }
);

export const loginUserAsync = createAsyncThunk(
  "user/login",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await loginUser(formData);
      localStorage.setItem('userData', JSON.stringify(response))
      if (response.access) {
        localStorage.setItem("accessToken", response.access);

        // Миграция permissions — не блокируем логин при её падении
        try {
          await migrateUserPermissions();
        } catch (migrationError) {
          console.error("Migration failed:", migrationError);
        }
      }

      return response;
    } catch (error) {
      // В реджект кладём только полезный payload с бэка
      return rejectWithValue(
        error?.response?.data || { detail: error.message || "Login error" }
      );
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
      return rejectWithValue(
        error?.response?.data || { detail: error.message || "Industries error" }
      );
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
      return rejectWithValue(
        error?.response?.data || { detail: error.message || "Plans error" }
      );
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
      return rejectWithValue(error.response?.data || error.message);
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
      return rejectWithValue(error.response?.data || error.message);
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
      return rejectWithValue(error.response?.data || error.message);
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
      return rejectWithValue(err.response?.data || err.message);
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
      return rejectWithValue(err.response?.data || err.message);
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
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

