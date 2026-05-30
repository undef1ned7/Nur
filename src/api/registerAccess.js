import api from "./index";

/**
 * Проверка пароля доступа к регистрации (бэкенд).
 * Ожидаемый endpoint: POST /users/auth/register-access/verify/
 */
export const verifyRegisterAccess = async (password) => {
  try {
    const response = await api.post("/users/auth/register-access/verify/", {
      password,
    });
    return response.data;
  } catch (error) {
    return Promise.reject(error.response?.data || error.message);
  }
};

/**
 * Смена пароля доступа к регистрации (бэкенд).
 * Ожидаемый endpoint: POST /users/auth/register-access/change/
 */
export const changeRegisterAccessPassword = async (
  currentPassword,
  newPassword
) => {
  try {
    const response = await api.post("/users/auth/register-access/change/", {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  } catch (error) {
    return Promise.reject(error.response?.data || error.message);
  }
};
