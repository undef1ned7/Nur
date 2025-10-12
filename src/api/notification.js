import api from './';

export const getNotifications = async (params = {}) => {
  try {
    const response = await api.get('/main/notifications/', { params });
    return response.data;
  } catch (error) {
    return Promise.reject(error.response?.data || error);
  }
};

export const markAllNotificationsRead = async () => {
  try {
    const response = await api.post('/main/notifications/mark-all-read/');
    return response.data;
  } catch (error) {
    return Promise.reject(error.response?.data || error);
  }
};

export const getNotificationDetail = async (id) => {
  try {
    const response = await api.get(`/main/notifications/${id}/`);
    return response.data;
  } catch (error) {
    return Promise.reject(error.response?.data || error);
  }
};