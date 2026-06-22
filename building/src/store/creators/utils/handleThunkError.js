import { validateResErrors } from "../../../../tools/validateResErrors";

export const handleThunkError = (error, rejectWithValue) => {
  const message = validateResErrors(
    error,
    error?.message || "Неизвестная ошибка",
  );
  return rejectWithValue(message);
};
