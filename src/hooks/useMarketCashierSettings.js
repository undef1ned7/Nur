import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_MARKET_CASHIER_SETTINGS,
  ensureMarketDebtScheduleV2,
  fetchMarketCashierSettings,
  normalizeMarketCashierSettings,
  verifyMarketCashierDeleteCode,
} from "../api/marketCashierSettings";
import {
  hasMigratedDebtScheduleToV2,
  parseDebtScheduleVersion,
} from "../tools/debtScheduleVersion";
import { useUser } from "../store/slices/userSlice";

const isMarketCompanySector = (sectorName) => {
  const name = String(sectorName || "")
    .toLowerCase()
    .trim();
  return (
    name === "магазин" ||
    name === "цветочный магазин" ||
    name.includes("магазин")
  );
};

const canWriteMarketCashierSettings = (profile) => {
  const role = String(profile?.role || "").toLowerCase();
  return role === "owner" || role === "admin";
};

/**
 * Первый вход в CRM маркета: если с бэка v1 / нет поля — PATCH на v2.
 * Уже v2 не трогаем. После разовой миграции ручной выбор v1 сохраняется.
 */
export function useEnsureMarketDebtScheduleV2() {
  const { company, profile } = useUser();
  const isMarket = isMarketCompanySector(company?.sector?.name);
  const canWrite = canWriteMarketCashierSettings(profile);

  useEffect(() => {
    if (!isMarket || !company?.id || !profile) return;
    if (hasMigratedDebtScheduleToV2(company.id)) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await fetchMarketCashierSettings();
        if (cancelled) return;
        await ensureMarketDebtScheduleV2(data, company.id, { canWrite });
      } catch {
        /* эндпоинта нет / нет прав — касса деградирует сама */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isMarket, company?.id, profile, canWrite]);
}

/**
 * Настройки кассы «Магазина»: код на удаление позиции из корзины и
 * максимальный процент скидки для сотрудников.
 *
 * Пока эндпоинт настроек недоступен (бэк ещё не выкатил — 404/403), хук
 * деградирует мягко: код удаления берётся из legacy-поля
 * `company.cashier_password`, а ограничение скидки считается отсутствующим.
 */
export function useMarketCashierSettings({ enabled = true } = {}) {
  const { company, profile } = useUser();
  const legacyCode = String(company?.cashier_password ?? "").trim();
  const canWrite = canWriteMarketCashierSettings(profile);

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
        const ensured = await ensureMarketDebtScheduleV2(data, company?.id, {
          canWrite,
        });
        if (cancelled) return;
        const next = normalizeMarketCashierSettings(ensured);
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
  }, [enabled, company?.id, canWrite]);

  const refresh = useCallback(() => loadRef.current?.(), []);

  const effective = useMemo(() => {
    if (remoteAvailable) return settings;
    return {
      ...DEFAULT_MARKET_CASHIER_SETTINGS,
      deleteCodeRequired: Boolean(legacyCode),
      deleteCode: legacyCode,
      debtScheduleVersion: parseDebtScheduleVersion(
        company?.debt_schedule_version,
      ),
    };
  }, [remoteAvailable, settings, legacyCode, company?.debt_schedule_version]);

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
    /** v1 — классическая отсрочка, v2 — график дни/месяцы. Нет поля → v2. */
    debtScheduleVersion: effective.debtScheduleVersion,
    loading,
    remoteAvailable,
    verifyDeleteCode,
    refresh,
  };
}

export default useMarketCashierSettings;
