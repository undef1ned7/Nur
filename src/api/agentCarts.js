import api from "./index";

// New API aligned with OpenAPI 3.1 (base: /main)
// -----------------------------------------------------------------------------
// Agent carts
export const listAgentCarts = (params) =>
  api.get("/main/agent-carts/", { params });
export const createAgentCart = (payload) =>
  api.post("/main/agent-carts/", payload);
export const getAgentCartById = (id) => api.get(`/main/agent-carts/${id}/`);
export const updateAgentCart = (id, payload) =>
  api.patch(`/main/agent-carts/${id}/`, payload);
export const deleteAgentCart = (id) => api.delete(`/main/agent-carts/${id}/`);
export const submitAgentCartById = (id) =>
  api.post(`/main/agent-carts/${id}/submit/`, {});
export const approveAgentCartById = (id) =>
  api.post(`/main/agent-carts/${id}/approve/`, {});
export const rejectAgentCartById = (id, payload = {}) =>
  api.post(`/main/agent-carts/${id}/reject/`, payload);

// Agent cart items
export const listAgentCartItems = (params) =>
  api.get("/main/agent-cart-items/", { params });
export const createAgentCartItem = (payload) =>
  api.post("/main/agent-cart-items/", payload);
export const getAgentCartItemById = (id) =>
  api.get(`/main/agent-cart-items/${id}/`);
export const updateAgentCartItemById = (id, payload) =>
  api.patch(`/main/agent-cart-items/${id}/`, payload);
export const deleteAgentCartItemById = (id) =>
  api.delete(`/main/agent-cart-items/${id}/`);

// Agent inventory
export const getMyAgentProducts = () => api.get("/main/agents/me/products/");
export const patchMyAgentProducts = (payload) =>
  api.patch("/main/agents/me/products/", payload);
export const getOwnerAgentsProducts = () =>
  api.get("/main/owners/agents/products/");

// Backward-compatible legacy functions (existing usage)
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
