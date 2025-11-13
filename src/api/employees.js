import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "./index";
export const fetchEmployeesApi = async (params = {}) => {
  try {
    const response = await api.get("/users/employees/", { params });
    // console.log(response);

    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Fetch Employees Error Data:", error.response.data);
      console.error("Fetch Employees Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

export const fetchEmployeeByIdApi = async (employeeId) => {
  try {
    const response = await api.get(`/users/users/${employeeId}/`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(
        `Fetch Employee (ID: ${employeeId}) Error Data:`,
        error.response.data
      );
      console.error(
        `Fetch Employee (ID: ${employeeId}) Error Status:`,
        error.response.status
      );
      return Promise.reject(error.response.data);
    }
  }
};

export const createEmployeeApi = async (employeeData) => {
  try {
    const response = await api.post("/users/employees/create/", employeeData);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Create Employee Error Data:", error.response.data);
      console.error("Create Employee Error Status:", error.response.status);
      return Promise.reject(error.response.data);
    }
  }
};

export const updateEmployeeApi = async (employeeId, employeeData) => {
  try {
    const response = await api.put(
      `/users/employees/${employeeId}/`,
      employeeData
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(
        `Update Employee (ID: ${employeeId}) Error Data:`,
        error.response.data
      );
      console.error(
        `Update Employee (ID: ${employeeId}) Error Status:`,
        error.response.status
      );
      return Promise.reject(error.response.data);
    }
  }
};

export const deleteEmployeeApi = async (employeeId) => {
  try {
    await api.delete(`/users/employees/${employeeId}/`);
  } catch (error) {
    if (error.response) {
      console.error(
        `Delete Employee (ID: ${employeeId}) Error Data:`,
        error.response.data
      );
      console.error(
        `Delete Employee (ID: ${employeeId}) Error Status:`,
        error.response.status
      );
      return Promise.reject(error.response.data);
    }
  }
};
