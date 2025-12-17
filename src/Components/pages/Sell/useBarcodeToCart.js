import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import useScanDetection from "use-scan-detection";
import { sendBarCode, startSale } from "../../../store/creators/saleThunk";

/**
 * useBarcodeToCart
 * Подключает сканер штрих‑кодов к продаже: при сканировании добавляет товар в корзину и обновляет состояние продажи.
 *
 * @param {string|number} saleId - Идентификатор текущей продажи (start.id)
 * @param {object} [opts]
 * @param {(msg: string) => void} [opts.onError] - Колбэк для ошибок
 * @param {(barcode: string) => void} [opts.onScanned] - Колбэк на успешное сканирование (до запроса)
 * @param {(result: any) => void} [opts.onAdded] - Колбэк после успешного добавления товара
 * @param {number} [opts.minLength] - Минимальная длина штрих‑кода
 * @param {number} [opts.discount_total] - Скидка для обновления продажи (по умолчанию 0)
 * @param {string|null} [opts.shift] - ID смены для обновления продажи (по умолчанию null)
 */
export function useBarcodeToCart(saleId, opts = {}) {
  const dispatch = useDispatch();
  const [lastBarcode, setLastBarcode] = useState("");
  const [error, setError] = useState("");
  const busyRef = useRef(false);

  const { onError, onScanned, onAdded, minLength = 3, discount_total = 0, shift = null } = opts;

  useScanDetection({
    minLength,
    onComplete: (scanned) => {
      if (!scanned || scanned.length < minLength) return;
      setLastBarcode(scanned);
      if (typeof onScanned === "function") onScanned(scanned);
    },
  });

  useEffect(() => {
    if (!lastBarcode || !saleId) return;
    if (busyRef.current) return;
    busyRef.current = true;

    (async () => {
      try {
        setError("");
        const current = lastBarcode;
        const res = await dispatch(
          sendBarCode({ barcode: current, id: saleId })
        ).unwrap();
        if (res?.error) {
          const msg =
            typeof res.error === "string"
              ? res.error
              : "Ошибка добавления товара по штрих‑коду";
          setError(msg);
          if (typeof onError === "function") onError(msg);
          return;
        }

        // Обновляем продажу с правильными параметрами
        await dispatch(startSale({ discount_total, shift })).unwrap();
        if (typeof onAdded === "function") onAdded(res);
      } catch (e) {
        const msg = e?.message || "Не удалось добавить товар по штрих‑коду";
        setError(msg);
        if (typeof onError === "function") onError(msg);
      } finally {
        // очищаем последнее значение, чтобы избежать повторной обработки
        setLastBarcode("");
        busyRef.current = false;
      }
    })();
  }, [lastBarcode, saleId, dispatch, onError, onAdded, discount_total, shift]);

  return { lastBarcode, error };
}

export default useBarcodeToCart;
