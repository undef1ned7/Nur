import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_MARKET_CASHIER_SETTINGS,
  fetchMarketCashierSettings,
  normalizeMarketCashierSettings,
  verifyMarketCashierDeleteCode,
} from "../api/marketCashierSettings";
import { useUser } from "../store/slices/userSlice";

/**
 * Настройки кассы «Магазина»: код на удаление позиции из корзины и
 * максимальный процент скидки для сотрудников.
 *
 * Пока эндпоинт настроек недоступен (бэк ещё не выкатил — 404/403), хук
 * деградирует мягко: код удаления берётся из legacy-поля
 * `company.cashier_password`, а ограничение скидки считается отсутствующим.
 */
export function useMarketCashierSettings({ enabled = true } = {}) {
  const { company } = useUser();
  const legacyCode = String(company?.cashier_password ?? "").trim();

  const [settings, setSettings] = useState(DEFAULT_MARKET_CASHIER_SETTINGS);
  const [loading, setLoading] = useState(Boolean(enabled));
  // true — настройки пришли с бэка, false — работаем на legacy/дефолтах
  const [remoteAvailable, setRemoteAvailable] = useState(false);
  const remoteAvailableRef = useRef(false);
  const localCodeRef = useRef("");

  const loadRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!enabled) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await fetchMarketCashierSettings();
        if (cancelled) return;
        const next = normalizeMarketCashierSettings(data);
        setSettings(next);
        setRemoteAvailable(true);
        remoteAvailableRef.current = true;
        localCodeRef.current = next.deleteCode;
      } catch (e) {
        if (cancelled) return;
        // Эндпоинта ещё нет или нет прав — не ломаем кассу.
        setSettings(DEFAULT_MARKET_CASHIER_SETTINGS);
        setRemoteAvailable(false);
        remoteAvailableRef.current = false;
        localCodeRef.current = "";
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadRef.current = run;
    run();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const refresh = useCallback(() => loadRef.current?.(), []);

  const effective = useMemo(() => {
    if (remoteAvailable) return settings;
    return {
      ...DEFAULT_MARKET_CASHIER_SETTINGS,
      deleteCodeRequired: Boolean(legacyCode),
      deleteCode: legacyCode,
    };
  }, [remoteAvailable, settings, legacyCode]);

  useEffect(() => {
    if (!remoteAvailable) localCodeRef.current = legacyCode;
  }, [remoteAvailable, legacyCode]);

  /** Проверка кода: сначала на сервере, при недоступности — локально. */
  const verifyDeleteCode = useCallback(async (rawCode) => {
    const code = String(rawCode ?? "").trim();
    if (!code) return false;

    if (remoteAvailableRef.current) {
      try {
        return await verifyMarketCashierDeleteCode(code);
      } catch (error) {
        // Эндпоинт проверки недоступен — падаем на локальное сравнение,
        // если код известен фронту (владелец/админ), иначе отказ.
        if (!localCodeRef.current) throw error;
      }
    }

    return Boolean(localCodeRef.current) && code === localCodeRef.current;
  }, []);

  return {
    /** Нужен ли код при удалении позиции из корзины. */
    deleteCodeRequired: effective.deleteCodeRequired,
    /** Максимальная скидка в % (null — без ограничения). */
    maxDiscountPercent: effective.maxDiscountPercent,
    loading,
    remoteAvailable,
    verifyDeleteCode,
    refresh,
  };
}

export default useMarketCashierSettings;
