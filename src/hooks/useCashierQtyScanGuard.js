import { useEffect, useRef } from "react";

const QTY_INPUT_CLASS = "cashier-page__cart-item-quantity-input";
const PRICE_INPUT_CLASS = "cashier-page__cart-item-price-input";
// Сканер «вводит» символы быстрее, чем человек: интервал между нажатиями
// у ручного ввода почти всегда > 30мс, у сканера — единицы миллисекунд.
const SCAN_BURST_MS = 30;

const isPrintableKey = (key) =>
  key.length === 1 && /^[0-9A-Za-z.,]$/.test(key);

// Программно меняет значение controlled-инпута так, чтобы сработал React onChange.
const setNativeInputValue = (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

/**
 * Защищает поля корзины (количество, цена, скидка) от потока символов сканера.
 *
 * Принцип: ручной ввод обрабатывается БРАУЗЕРОМ нативно (выделение, каретка,
 * Backspace/Delete, перезапись выделенного — всё работает как обычно). Гард
 * вмешивается только когда видит «очередь» символов быстрее SCAN_BURST_MS —
 * это сканер. В этот момент он возвращает значение, которое кассир ввёл ДО
 * скана, фиксирует его (для количества — через commit, для цены/скидки — через
 * нативный blur инпута) и уводит фокус в поиск, чтобы сам штрих-код ушёл туда.
 */
export function useCashierQtyScanGuard({
  searchInputRef,
  cartRef,
  setCartQuantities,
  commitQuantityRef,
  pendingQtyLineInputRef,
  suppressQtyBlurUpdateRef,
}) {
  const lastKeyTimeRef = useRef(0);
  const valueBeforeBurstRef = useRef("");
  const burstActiveRef = useRef(false);

  useEffect(() => {
    const resolveGuardedInput = (target) => {
      if (!(target instanceof HTMLInputElement)) return null;
      const isQty = target.classList.contains(QTY_INPUT_CLASS);
      const isPrice = target.classList.contains(PRICE_INPUT_CLASS);
      if (!isQty && !isPrice) return null;
      const lineKey = target.dataset?.cartItemId
        ? String(target.dataset.cartItemId)
        : null;
      return { active: target, kind: isQty ? "qty" : "price", lineKey };
    };

    const redirectToSearch = (active) => {
      active.blur();
      searchInputRef.current?.focus();
    };

    const commitBeforeScan = (ctx) => {
      // Скан уже обрабатывается — просто продолжаем уводить фокус.
      if (burstActiveRef.current) {
        redirectToSearch(ctx.active);
        return;
      }
      burstActiveRef.current = true;

      const snapshot = valueBeforeBurstRef.current;

      if (ctx.kind === "price") {
        // Возвращаем значение кассира (без «утёкших» цифр штрих-кода).
        // Нативный onBlur инпута применит цену/скидку.
        setNativeInputValue(ctx.active, snapshot);
        redirectToSearch(ctx.active);
        return;
      }

      // Количество.
      if (!ctx.lineKey) {
        redirectToSearch(ctx.active);
        return;
      }
      if (suppressQtyBlurUpdateRef?.current) {
        suppressQtyBlurUpdateRef.current[ctx.lineKey] = true;
      }
      const item = cartRef.current?.find((c) => String(c.id) === ctx.lineKey);
      setCartQuantities((prev) => ({ ...prev, [ctx.lineKey]: snapshot }));
      pendingQtyLineInputRef?.current?.set(ctx.lineKey, snapshot);
      if (item && commitQuantityRef?.current) {
        void commitQuantityRef.current(item, snapshot);
      }
      redirectToSearch(ctx.active);
    };

    const handleKeyDown = (e) => {
      const ctx = resolveGuardedInput(document.activeElement);
      if (!ctx) return;

      const key = e.key || "";
      const isChar = isPrintableKey(key);
      const isScanTerminator = key === "Enter" || key === "Tab";

      // Удаление/навигация (Backspace, Delete, стрелки, Home/End и т.п.) —
      // отдаём браузеру без вмешательства: ручное редактирование не ломаем.
      if (!isChar && !isScanTerminator) {
        burstActiveRef.current = false;
        return;
      }

      const now = Date.now();
      const dt = lastKeyTimeRef.current
        ? now - lastKeyTimeRef.current
        : Infinity;
      lastKeyTimeRef.current = now;

      if (isScanTerminator) {
        // Завершающий Enter/Tab сканера в быстром потоке — гасим и уводим фокус.
        if (dt < SCAN_BURST_MS) {
          e.preventDefault();
          commitBeforeScan(ctx);
        }
        return;
      }

      if (dt < SCAN_BURST_MS) {
        // Быстрый поток символов — это сканер. В поле не пускаем.
        e.preventDefault();
        commitBeforeScan(ctx);
        return;
      }

      // Человеческий ввод печатного символа: запоминаем значение ДО вставки
      // и отдаём браузеру — нативные выделение/каретка/перезапись работают.
      valueBeforeBurstRef.current = ctx.active.value;
      burstActiveRef.current = false;
    };

    const handleBeforeInput = (e) => {
      const ctx = resolveGuardedInput(e.target);
      if (!ctx) return;
      const data = e.data ?? "";
      // Вставка целого штрих-кода одним событием (HID-сканер) — тоже сканер.
      if (data.length > 1) {
        e.preventDefault();
        commitBeforeScan(ctx);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("beforeinput", handleBeforeInput, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("beforeinput", handleBeforeInput, true);
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
