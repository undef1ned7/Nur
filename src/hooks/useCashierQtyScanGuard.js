import { useEffect, useRef } from "react";

const QTY_INPUT_CLASS = "cashier-page__cart-item-quantity-input";
const SCAN_BURST_MS = 30;
const DEFER_APPLY_MS = 45;

const DECIMAL_INPUT_PATTERN = /^\d*[,.]?\d*$/;

const isPrintableKey = (key) =>
  key.length === 1 && /^[0-9A-Za-z.,]$/.test(key);

const buildNextQtyValue = (current, char, selectionStart, selectionEnd, isWeight) => {
  const start = selectionStart ?? current.length;
  const end = selectionEnd ?? start;
  const next = current.slice(0, start) + char + current.slice(end);
  if (isWeight) {
    if (!DECIMAL_INPUT_PATTERN.test(next)) return null;
  } else if (!/^\d*$/.test(next)) {
    return null;
  }
  return next;
};

/**
 * Перехватывает ввод сканера в поле количества:
 * символы скана не попадают в инпут, количество сохраняется, фокус — в поиск.
 */
export function useCashierQtyScanGuard({
  searchInputRef,
  cartRef,
  setCartQuantities,
  commitQuantityRef,
  pendingQtyLineInputRef,
  suppressQtyBlurUpdateRef,
}) {
  const qtyBeforeBurstRef = useRef("");
  const qtyBurstCommittedRef = useRef(false);
  const lastKeyTimeRef = useRef(0);
  const deferRef = useRef({
    timer: null,
    lineKey: null,
    focusedItemId: null,
    pendingValue: null,
  });

  useEffect(() => {
    const clearDeferTimer = () => {
      if (deferRef.current.timer) {
        clearTimeout(deferRef.current.timer);
        deferRef.current.timer = null;
      }
    };

    const flushDefer = () => {
      clearDeferTimer();
      const { lineKey, focusedItemId, pendingValue } = deferRef.current;
      if (!lineKey || pendingValue == null) return;
      setCartQuantities((prev) => ({
        ...prev,
        [focusedItemId]: pendingValue,
      }));
      pendingQtyLineInputRef?.current?.set(lineKey, String(pendingValue));
    };

    const redirectScanAwayFromQty = (active, lineKey, focusedItemId) => {
      clearDeferTimer();
      deferRef.current = {
        timer: null,
        lineKey: null,
        focusedItemId: null,
        pendingValue: null,
      };

      if (!lineKey) {
        active.blur();
        searchInputRef.current?.focus();
        return;
      }

      if (!qtyBurstCommittedRef.current) {
        qtyBurstCommittedRef.current = true;
        if (suppressQtyBlurUpdateRef?.current) {
          suppressQtyBlurUpdateRef.current[lineKey] = true;
        }

        const item = cartRef.current?.find((c) => String(c.id) === lineKey);
        const commitValue =
          pendingQtyLineInputRef?.current?.get(lineKey) ??
          qtyBeforeBurstRef.current ??
          active.value;

        setCartQuantities((prev) => ({
          ...prev,
          [focusedItemId]: commitValue,
        }));

        if (item && commitQuantityRef?.current) {
          void commitQuantityRef.current(item, commitValue);
        }
      }

      active.blur();
      searchInputRef.current?.focus();
      lastKeyTimeRef.current = 0;
      qtyBeforeBurstRef.current = "";
    };

    const resolveQtyInput = (target) => {
      if (!(target instanceof HTMLInputElement)) return null;
      if (!target.classList.contains(QTY_INPUT_CLASS)) return null;
      const focusedItemId = target.dataset?.cartItemId;
      const lineKey = focusedItemId ? String(focusedItemId) : null;
      const item = lineKey
        ? cartRef.current?.find((c) => String(c.id) === lineKey)
        : null;
      const isWeight =
        target.dataset?.isWeight === "1" || Boolean(item?.isWeight);
      return { active: target, lineKey, focusedItemId, isWeight };
    };

    const handleKeyDown = (e) => {
      const ctx = resolveQtyInput(document.activeElement);
      if (!ctx) {
        qtyBurstCommittedRef.current = false;
        return;
      }

      const { active, lineKey, focusedItemId, isWeight } = ctx;
      const key = e.key || "";
      const isChar = isPrintableKey(key);
      const isScanTerminator = key === "Enter" || key === "Tab";
      if (!isChar && !isScanTerminator) return;

      const now = Date.now();
      const dt = lastKeyTimeRef.current ? now - lastKeyTimeRef.current : Infinity;
      lastKeyTimeRef.current = now;

      if (isScanTerminator) {
        if (deferRef.current.lineKey === lineKey && deferRef.current.pendingValue != null) {
          e.preventDefault();
          flushDefer();
        }
        if (dt < SCAN_BURST_MS) {
          e.preventDefault();
          redirectScanAwayFromQty(active, lineKey, focusedItemId);
        }
        return;
      }

      e.preventDefault();

      if (dt < SCAN_BURST_MS) {
        redirectScanAwayFromQty(active, lineKey, focusedItemId);
        return;
      }

      qtyBurstCommittedRef.current = false;

      const continuingSameLine =
        deferRef.current.lineKey === lineKey &&
        deferRef.current.pendingValue != null;

      if (!continuingSameLine) {
        qtyBeforeBurstRef.current = active.value;
      }

      const baseValue = continuingSameLine
        ? deferRef.current.pendingValue
        : active.value;
      const selStart = continuingSameLine
        ? baseValue.length
        : (active.selectionStart ?? baseValue.length);
      const selEnd = continuingSameLine
        ? baseValue.length
        : (active.selectionEnd ?? selStart);

      const next = buildNextQtyValue(
        baseValue,
        key,
        selStart,
        selEnd,
        isWeight,
      );
      if (next == null) return;

      deferRef.current = {
        timer: deferRef.current.timer,
        lineKey,
        focusedItemId,
        pendingValue: next,
      };

      clearDeferTimer();
      deferRef.current.timer = setTimeout(flushDefer, DEFER_APPLY_MS);
    };

    const handleBeforeInput = (e) => {
      const ctx = resolveQtyInput(e.target);
      if (!ctx) return;

      const data = e.data ?? "";
      if (data.length > 1) {
        e.preventDefault();
        redirectScanAwayFromQty(
          ctx.active,
          ctx.lineKey,
          ctx.focusedItemId,
        );
      }
    };

    const handleInput = (e) => {
      const ctx = resolveQtyInput(e.target);
      if (!ctx || !qtyBeforeBurstRef.current) return;

      const expected =
        pendingQtyLineInputRef?.current?.get(ctx.lineKey) ??
        qtyBeforeBurstRef.current;
      if (e.target.value !== expected) {
        setCartQuantities((prev) => ({
          ...prev,
          [ctx.focusedItemId]: expected,
        }));
      }
    };

    const handleFocusOut = (e) => {
      const ctx = resolveQtyInput(e.target);
      if (!ctx) return;
      if (
        deferRef.current.lineKey === ctx.lineKey &&
        deferRef.current.pendingValue != null
      ) {
        flushDefer();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("beforeinput", handleBeforeInput, true);
    window.addEventListener("input", handleInput, true);
    window.addEventListener("focusout", handleFocusOut, true);
    return () => {
      clearDeferTimer();
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("beforeinput", handleBeforeInput, true);
      window.removeEventListener("input", handleInput, true);
      window.removeEventListener("focusout", handleFocusOut, true);
    };
  }, [
    searchInputRef,
    cartRef,
    setCartQuantities,
    commitQuantityRef,
    pendingQtyLineInputRef,
    suppressQtyBlurUpdateRef,
  ]);
}
