import { useCallback, useMemo, useState } from "react";
import { getSale, startSale } from "../store/creators/saleThunk";
import { useSale } from "../store/slices/saleSlice";
import {
  buildPosStartPayload,
  normalizePosStartResponse,
} from "../../tools/posSaleCarts";

export const MARKET_CASHIER_SALE_ID_PARAM = "sale_id";

/**
 * Мультикорзины маркет-кассы: список с бэка (POST /start/), переключение через getSale + refresh start.
 */
export function useMarketCashierMultiCart({
  shiftId,
  dispatch,
  preferredWholesaleMode,
}) {
  const {
    start: currentSale,
    posCarts = [],
    activeSaleId: storeActiveSaleId,
  } = useSale();
  const [switching, setSwitching] = useState(false);

  const carts = useMemo(() => posCarts, [posCarts]);

  const activeSaleId =
    storeActiveSaleId || currentSale?.id || carts[0]?.saleId || null;

  const mainSaleId = useMemo(() => {
    const main = carts.find((c) => c.isMain);
    return main?.saleId ?? carts[0]?.saleId ?? null;
  }, [carts]);

  const baseStartArgs = useCallback(
    (extra = {}) =>
      buildPosStartPayload({
        shift: shiftId,
        is_wholesale: Boolean(preferredWholesaleMode),
        ...extra,
      }),
    [shiftId, preferredWholesaleMode],
  );

  const refreshCartsFromStart = useCallback(
    async (extra = {}) => {
      if (!shiftId) return null;
      return dispatch(startSale(baseStartArgs(extra))).unwrap();
    },
    [shiftId, dispatch, baseStartArgs],
  );

  const getActiveSaleId = useCallback(
    () => activeSaleId,
    [activeSaleId],
  );

  const resolveTargetSaleId = useCallback(
    (urlSaleId) => {
      const fromUrl = urlSaleId ? String(urlSaleId).trim() : "";
      if (fromUrl) return fromUrl;
      if (activeSaleId) return String(activeSaleId);
      if (mainSaleId) return String(mainSaleId);
      return null;
    },
    [activeSaleId, mainSaleId],
  );

  const switchToCart = useCallback(
    async (saleId) => {
      if (!saleId || !shiftId) return;
      const id = String(saleId);
      if (String(activeSaleId) === id && String(currentSale?.id) === id) {
        return;
      }
      setSwitching(true);
      try {
        await dispatch(getSale({ id })).unwrap();
        await refreshCartsFromStart({ sale_id: id });
      } finally {
        setSwitching(false);
      }
    },
    [shiftId, activeSaleId, currentSale?.id, dispatch, refreshCartsFromStart],
  );

  const parkAndNewCart = useCallback(async () => {
    if (!shiftId) return null;
    setSwitching(true);
    try {
      const data = await refreshCartsFromStart({ is_new: true });
      const { activeSaleId: newId } = normalizePosStartResponse(data);
      return newId;
    } finally {
      setSwitching(false);
    }
  }, [shiftId, refreshCartsFromStart]);

  const refreshActiveSale = useCallback(async () => {
    if (!shiftId) return null;
    const id = activeSaleId;
    if (id) {
      await dispatch(getSale({ id })).unwrap();
    }
    return refreshCartsFromStart(
      id ? { sale_id: id } : {},
    );
  }, [shiftId, activeSaleId, dispatch, refreshCartsFromStart]);

  const removeCartFromSession = useCallback(() => {
    // Список корзин обновляется через start после checkout на бэке
  }, []);

  const registerMainSale = useCallback(() => {}, []);

  const clearSession = useCallback(() => {}, []);

  return {
    carts,
    activeSaleId,
    mainSaleId,
    switching,
    registerMainSale,
    switchToCart,
    parkAndNewCart,
    removeCartFromSession,
    getActiveSaleId,
    resolveTargetSaleId,
    refreshActiveSale,
    refreshCartsFromStart,
    clearSession,
  };
};
