export const handleThunkError = (error, rejectWithValue) => {
  const message =
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    "Неизвестная ошибка";
  return rejectWithValue(message);
};
