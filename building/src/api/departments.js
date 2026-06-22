// src/api/departmentAnalytics.js
import api from './index';

export const getDepartmentAnalytics = async () => {
  try {
    const response = await api.get('/construction/analytics/departments/');
    return response.data;
  } catch (error) {
    console.error('Error fetching department analytics:', error.response?.data || error.message);
    return Promise.reject(error.response?.data || error.message);
  }
};

export const getCompanyDepartmentAnalytics = async () => {
  try {
    const response = await api.get('/construction/analytics/departments/id');
    return response.data;
  } catch (error) {
    console.error('Error fetching company department analytics:', error.response?.data || error.message);
    return Promise.reject(error.response?.data || error.message);
  }
};

const departmentAnalyticsApi = {
  getDepartmentAnalytics,
  getCompanyDepartmentAnalytics,
};

export default departmentAnalyticsApi;
