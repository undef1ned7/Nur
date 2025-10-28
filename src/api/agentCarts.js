import api from "./index";

// Создать/получить активную корзину и выбрать агента
export const startAgentCart = (data) => {
  return api.post("/main/agents/me/cart/start/", data);
};

// Сканировать товар по штрих-коду
export const scanProduct = (cartId, data) => {
  return api.post(`/main/agents/me/carts/${cartId}/scan/`, data);
};

// Добавить товар по product_id
export const addProductToCart = (cartId, data) => {
  return api.post(`/main/agents/me/carts/${cartId}/add-item/`, data);
};

// Добавить кастомную позицию
export const addCustomItemToCart = (cartId, data) => {
  return api.post(`/main/agents/me/carts/${cartId}/custom-item/`, data);
};

// Чекаут корзины
export const checkoutAgentCart = (cartId, data) => {
  return api.post(`/main/agents/me/carts/${cartId}/checkout/`, data);
};

// Получить информацию о корзине (используем startAgentCart)
export const getAgentCart = (data) => {
  return api.post("/main/agents/me/cart/start/", data);
};

// Удалить позицию из корзины
export const removeItemFromCart = (cartId, itemId) => {
  return api.delete(`/main/agents/me/carts/${cartId}/items/${itemId}/`);
};

// Обновить количество позиции
export const updateCartItemQuantity = (cartId, itemId, data) => {
  return api.patch(`/main/agents/me/carts/${cartId}/items/${itemId}/`, data);
};
