import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ArrowLeft, Wallet, AlertCircle } from "lucide-react";
import {
  closeShiftAsync,
  fetchShiftsAsync,
  fetchShiftByIdAsync,
} from "../../../../store/creators/shiftThunk";
import { useShifts } from "../../../../store/slices/shiftSlice";
import AlertModal from "../../../common/AlertModal/AlertModal";
import "./CloseShiftPage.scss";

const CloseShiftPage = ({ onBack, shift: initialShift }) => {
  const dispatch = useDispatch();
  const { shifts, currentShift } = useShifts();

  // Получаем актуальные данные смены из Redux
  const shift = React.useMemo(() => {
    if (currentShift?.id === initialShift?.id) {
      return currentShift;
    }
    const updatedShift = shifts.find((s) => s.id === initialShift?.id);
    return updatedShift || initialShift;
  }, [currentShift, shifts, initialShift]);

  const [closingCash, setClosingCash] = useState("");
  const [loading, setLoading] = useState(false);
  const [alertModal, setAlertModal] = useState({
    open: false,
    type: "error",
    title: "",
    message: "",
  });

  const showAlert = (type, title, message) => {
    setAlertModal({
      open: true,
      type,
      title,
      message,
    });
  };

  const closeAlert = () => {
    setAlertModal((prev) => ({ ...prev, open: false }));
  };

  // Обновляем данные смены при монтировании и при изменении shifts
  useEffect(() => {
    if (shift?.id) {
      dispatch(fetchShiftByIdAsync(shift.id));
    }
  }, [dispatch, shift?.id]);

  // Обновляем данные смены после успешного закрытия
  useEffect(() => {
    if (shift?.id && shift?.status === "closed") {
      dispatch(fetchShiftByIdAsync(shift.id));
    }
  }, [dispatch, shift?.id, shift?.status]);

  if (!shift) {
    return (
      <div className="close-shift-page">
        <div className="close-shift-page__error">Смена не найдена</div>
      </div>
    );
  }

  const openingCash = parseFloat(shift.opening_cash || 0);
  const expectedCash = parseFloat(shift.expected_cash || 0);
  const closingCashNum = parseFloat(closingCash || 0);
  const cashDiff = closingCashNum - expectedCash;

  const handleCloseShift = async () => {
    // Валидация
    if (isNaN(closingCashNum) || closingCashNum < 0) {
      showAlert("error", "Ошибка", "Пожалуйста, введите корректную сумму");
      return;
    }

    try {
      setLoading(true);
      await dispatch(
        closeShiftAsync({
          shiftId: shift.id,
          closingCash: closingCashNum,
        })
      ).unwrap();

      // Обновляем список смен
      await dispatch(fetchShiftsAsync());
      // Небольшая задержка, чтобы сервер успел обработать запрос
      await new Promise((resolve) => setTimeout(resolve, 300));
      // Обновляем данные конкретной смены для получения актуальной expected_cash
      await dispatch(fetchShiftByIdAsync(shift.id));

      showAlert("success", "Успех", "Смена успешно закрыта");
      // Закрываем экран через небольшую задержку, чтобы пользователь увидел обновленные данные
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (error) {
      console.error("Ошибка при закрытии смены:", error);
      showAlert(
        "error",
        "Ошибка",
        error?.data?.detail ||
          error?.data?.closing_cash?.[0] ||
          error?.message ||
          "Не удалось закрыть смену"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="close-shift-page">
      <div className="close-shift-page__header">
        <button
          className="close-shift-page__back-btn"
          onClick={onBack}
          disabled={loading}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="close-shift-page__title">Закрытие смены</h1>
      </div>

      <div className="close-shift-page__content">
        <div className="close-shift-page__card">
          <div className="close-shift-page__icon">
            <Wallet size={48} style={{ color: "#ef4444" }} />
          </div>
          <h2 className="close-shift-page__card-title">Завершение смены</h2>

          <div className="close-shift-page__info-section">
            <div className="close-shift-page__info-item">
              <span className="close-shift-page__info-label">
                Начальная сумма:
              </span>
              <span className="close-shift-page__info-value">
                {openingCash.toFixed(2)} сом
              </span>
            </div>

            <div className="close-shift-page__info-item">
              <span className="close-shift-page__info-label">
                Ожидаемая сумма:
              </span>
              <span className="close-shift-page__info-value">
                {expectedCash.toFixed(2)} сом
              </span>
            </div>
          </div>

          <div className="close-shift-page__input-wrapper">
            <label className="close-shift-page__label">
              Фактическая сумма на кассе (сом) *
            </label>
            <input
              type="number"
              className="close-shift-page__input"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              autoFocus
              disabled={loading}
            />
          </div>

          {closingCash && !isNaN(closingCashNum) && (
            <div className="close-shift-page__diff-section">
              <div className="close-shift-page__diff-label">Расхождение:</div>
              <div
                className={`close-shift-page__diff-value ${
                  cashDiff === 0
                    ? "close-shift-page__diff-value--zero"
                    : cashDiff > 0
                    ? "close-shift-page__diff-value--positive"
                    : "close-shift-page__diff-value--negative"
                }`}
              >
                {cashDiff === 0 ? (
                  <>
                    <AlertCircle size={20} />
                    <span>✓ {Math.abs(cashDiff).toFixed(2)} сом</span>
                  </>
                ) : cashDiff > 0 ? (
                  <>
                    <AlertCircle size={20} />
                    <span>+{cashDiff.toFixed(2)} сом</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={20} />
                    <span>{cashDiff.toFixed(2)} сом</span>
                  </>
                )}
              </div>
            </div>
          )}

          <button
            className="close-shift-page__submit-btn"
            onClick={handleCloseShift}
            disabled={loading || !closingCash}
          >
            {loading ? "Закрытие..." : "Закрыть смену"}
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
};

export default CloseShiftPage;

