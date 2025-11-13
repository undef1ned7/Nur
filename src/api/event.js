import api from './index'; 
export const fetchEventsApi = async (params = {}) => {
  try {
    const response = await api.get('/main/events/', { params });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || error.message || 'Ошибка загрузки событий.');
  }
};


export const createEventApi = async (eventData) => {
  try {
    const response = await api.post('/main/events/', eventData);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || error.message || 'Ошибка создания события.');
  }
};

export const updateEventApi = async (eventId, updatedData) => {
  try {
    const response = await api.put(`/main/events/${eventId}/`, updatedData); 
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || error.message || 'Ошибка обновления события.');
  }
};


export const deleteEventApi = async (eventId) => {
  try {
    await api.delete(`/main/events/${eventId}/`);
  } catch (error) {
    throw new Error(error.response?.data?.detail || error.message || 'Ошибка удаления события.');
  }
};