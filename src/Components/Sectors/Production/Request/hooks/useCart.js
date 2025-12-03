import { useState } from "react";
import {
  listAgentCarts,
  createAgentCart,
  getAgentCartById,
} from "../../../../../api/agentCarts";

export const useCart = () => {
  const [cartId, setCartId] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [error, setError] = useState(null);

  // Создание новой пустой корзины
  const createNewCart = async () => {
    try {
      setError(null);
      const newCartResponse = await createAgentCart({});
      const newCart = newCartResponse.data;
      setCartId(newCart.id);
      setCartItems(newCart.items || []);
      return newCart;
    } catch (err) {
      console.error("Error creating new cart:", err);
      setError(err);
      // В случае ошибки пытаемся загрузить существующую draft корзину
      await loadOrCreateCart();
      throw err;
    }
  };

  // Загрузка или создание корзины
  const loadOrCreateCart = async () => {
    try {
      setCartLoading(true);
      setError(null);
      // Ищем существующую draft корзину
      const response = await listAgentCarts({ status: "draft" });
      const carts = response.data?.results || response.data || [];

      if (carts.length > 0) {
        // Используем первую draft корзину
        const draftCart = carts[0];
        setCartId(draftCart.id);
        setCartItems(draftCart.items || []);
        return draftCart;
      } else {
        // Создаем новую draft корзину
        return await createNewCart();
      }
    } catch (err) {
      console.error("Error loading/creating cart:", err);
      setError(err);
      throw err;
    } finally {
      setCartLoading(false);
    }
  };

  // Загружаем актуальные данные корзины
  const refreshCart = async () => {
    if (!cartId) return;
    try {
      setError(null);
      const response = await getAgentCartById(cartId);
      const cart = response.data;
      setCartItems(cart.items || []);
      return cart;
    } catch (err) {
      console.error("Error refreshing cart:", err);
      setError(err);
      throw err;
    }
  };

  return {
    cartId,
    cartItems,
    cartLoading,
    error,
    createNewCart,
    loadOrCreateCart,
    refreshCart,
    setCartItems,
  };
};
