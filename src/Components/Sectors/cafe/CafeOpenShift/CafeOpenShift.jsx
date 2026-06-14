import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { ArrowLeft, Wallet } from "lucide-react";
import {
  openShiftAsync,
  fetchShiftsAsync,
} from "../../../../store/creators/shiftThunk";
import { getCashBoxes } from "../../../../store/slices/cashSlice";
import { useCash } from "../../../../store/slices/cashSlice";
import { useUser } from "../../../../store/slices/userSlice";
import AlertModal from "../../../common/AlertModal/AlertModal";
import { saveSnapshot } from "@/services/cafeOfflineService";
import api from "@/api";
import { useFiscalSettings } from "@/hooks/useFiscalSettings";
import {
  verifyPin,
  authConnector,
  getShiftState,
  openShiftConnector,
  clearFiscalToken,
} from "@/services/fiscalDriverService";
import "../../Market/CashierPage/OpenShiftPage.scss";

/** Шаги фискального открытия смены (для отображения прогресса) */
const FISCAL_STEPS = [
  "Верификация SAM-карты",
  "Авторизация в коннекторе",
  "Проверка состояния смены",
  "Открытие фискальной смены",
  "Сохранение в системе",
];

export default function CafeOpenShift({ onBack }) {
  const dispatch = useDispatch();
  const { list: cashBoxes, loading: cashBoxesLoading } = useCash();
  const { currentUser, userId } = useUser();
  const { settings: fiscalSettings, loading: fiscalLoading } = useFiscalSettings();

  const [openingCash, setOpeningCash] = useState("");
  const [loading, setLoading] = useState(false);
  const [fiscalStep, setFiscalStep] = useState(null); // null | строка шага
  const [alertModal, setAlertModal] = useState({
    open: false,
    type: "error",
    title: "",
    message: "",
  });

  const showAlert = (type, title, message) => {
    setAlertModal({ open: true, type, title, message });
  };

  const closeAlert = () => {
    setAlertModal((prev) => ({ ...prev, open: false }));
  };

  const fiscalEnabled = fiscalSettings?.enabled === true;

  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

  /** Шаги фискального открытия смены */
  const runFiscalOpenShift = async () => {
    // 1. Верификация SAM
    setFiscalStep(FISCAL_STEPS[0]);
    await verifyPin(fiscalSettings);

    // 2. Авторизация — получить accessToken
    setFiscalStep(FISCAL_STEPS[1]);
    const authData = await authConnector(fiscalSettings);

    // Сохраняем реквизиты, которые вернул коннектор, обратно в Nur
    try {
      await api.patch("/cafe/fiscal/settings/", {
        tin: authData.tin,
        full_name: authData.fullName,
        cashier_name: authData.cashierName,
        fiscal_memory_number: authData.fiscalMemoryNumber,
        tax_system_codes: authData.taxSystemCodes ?? [],
        calc_item_attr_codes: authData.calcItemAttrCodes ?? [],
      });
    } catch {
      // не критично
    }

    // 3. Проверить состояние — смена уже открыта?
    setFiscalStep(FISCAL_STEPS[2]);
    const state = await getShiftState(fiscalSettings);
    if (state?.shiftOpened) {
      // Смена уже открыта на коннекторе — зафиксируем в Nur и продолжим
      try {
        await api.post("/cafe/fiscal/shift/open/", {
          registration_number: fiscalSettings.registration_number,
          open_shift_datetime: state.openShiftDateTime,
          fm_expiration_date: state.fmExpirationDate,
          raw: state,
        });
      } catch (e) {
        // 409 — смена уже есть в Nur, это нормально
        if (e?.response?.status !== 409) throw e;
      }
      return; // пропускаем open-shift
    }

    // 4. Открыть смену на коннекторе
    setFiscalStep(FISCAL_STEPS[3]);
    const openData = await openShiftConnector(fiscalSettings);

    // 5. Зафиксировать смену в Nur backend
    setFiscalStep(FISCAL_STEPS[4]);
    try {
      await api.post("/cafe/fiscal/shift/open/", {
        registration_number: fiscalSettings.registration_number,
        open_shift_datetime: openData?.openShiftDateTime ?? new Date().toISOString(),
        fm_expiration_date: openData?.fmExpirationDate ?? null,
        raw: openData,
      });
    } catch (e) {
      if (e?.response?.status !== 409) throw e;
    }
  };

  const handleOpenShift = async () => {
    const cashAmount = parseFloat(openingCash);
    if (isNaN(cashAmount) || cashAmount < 0) {
      showAlert("error", "Ошибка", "Пожалуйста, введите корректную сумму");
      return;
    }

    let availableCashBoxes = cashBoxes;
    try {
      availableCashBoxes = await dispatch(getCashBoxes()).unwrap();
    } catch {
      /* fallback на уже загруженный список */
    }
    const list = Array.isArray(availableCashBoxes) ? availableCashBoxes : [];
    if (list.length === 0) {
      showAlert(
        "error",
        "Ошибка",
        "Нет доступных касс. Пожалуйста, создайте кассу перед началом смены.",
      );
      return;
    }

    const firstCashBox = list[0];
    const cashboxId = firstCashBox?.id;
    if (!cashboxId) {
      showAlert("error", "Ошибка", "Не удалось определить кассу");
      return;
    }

    const cashierId = currentUser?.id || userId;
    if (!cashierId) {
      showAlert("error", "Ошибка", "Не удалось определить кассира");
      return;
    }

    try {
      setLoading(true);

      // ── Фискальное открытие смены (только если enabled) ──
      if (fiscalEnabled) {
        try {
          await runFiscalOpenShift();
        } catch (fiscalErr) {
          // Показать ошибку, но не блокировать открытие Nur-смены
          showAlert(
            "error",
            "Ошибка фискальной кассы",
            fiscalErr?.message || "Не удалось открыть фискальную смену",
          );
          setFiscalStep(null);
          setLoading(false);
          return;
        }
        setFiscalStep(null);
      }

      // ── Обычное открытие смены в Nur ──
      await dispatch(
        openShiftAsync({
          cashbox: cashboxId,
          cashier: cashierId,
          opening_cash: String(cashAmount),
        }),
      ).unwrap();

      try {
        const { data } = await api.get("/cafe/offline-snapshot/");
        await saveSnapshot(data);
        console.log("Snapshot обновлён при открытии смены");
      } catch (err) {
        console.warn("Не удалось сохранить snapshot:", err);
      }

      showAlert("success", "Успех", "Смена успешно открыта");
      dispatch(fetchShiftsAsync());
      dispatch(getCashBoxes());
      setTimeout(() => {
        onBack?.();
      }, 1500);
    } catch (error) {
      clearFiscalToken();
      console.error("Ошибка при открытии смены:", error);
      showAlert(
        "error",
        "Ошибка",
        error?.data?.detail || error?.message || "Не удалось открыть смену",
      );
    } finally {
      setLoading(false);
      setFiscalStep(null);
    }
  };

  return (
    <div className="open-shift-page">
      <div className="open-shift-page__header">
        <button
          className="open-shift-page__back-btn"
          onClick={onBack}
          disabled={loading}
          type="button"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="open-shift-page__title">Открытие смены</h1>
      </div>

      <div className="open-shift-page__content">
        <div className="open-shift-page__card">
          <div className="open-shift-page__icon">
            <Wallet size={48} style={{ color: "#22c55e" }} />
          </div>
          <h2 className="open-shift-page__card-title">Начальная сумма</h2>
          <p className="open-shift-page__card-description">
            Введите сумму наличных денег в кассе на начало смены
          </p>

          {fiscalEnabled && (
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
              Фискальная касса включена — будет выполнена верификация SAM-карты
            </p>
          )}

          <div className="open-shift-page__input-wrapper">
            <label className="open-shift-page__label">
              Сумма наличных (сом) *
            </label>
            <input
              type="number"
              className="open-shift-page__input"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              autoFocus
              disabled={loading}
            />
          </div>

          {fiscalStep && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                fontSize: 13,
                color: "#166534",
              }}
            >
              ⏳ {fiscalStep}…
            </div>
          )}

          <button
            className="open-shift-page__submit-btn"
            onClick={handleOpenShift}
            disabled={loading || cashBoxesLoading || !openingCash || fiscalLoading}
            type="button"
          >
            {loading
              ? fiscalStep
                ? "Фискализация…"
                : "Открытие…"
              : "Открыть смену"}
          </button>
        </div>
      </div>

      <AlertModal
        open={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        okText="ОК"
        onClose={closeAlert}
        onConfirm={closeAlert}
      />
    </div>
  );
}
