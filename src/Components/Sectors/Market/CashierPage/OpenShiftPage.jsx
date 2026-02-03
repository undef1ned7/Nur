import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { ArrowLeft, Wallet } from "lucide-react";
import { openShiftAsync } from "../../../../store/creators/shiftThunk";
import { fetchShiftsAsync } from "../../../../store/creators/shiftThunk";
import { getCashBoxes } from "../../../../store/slices/cashSlice";
import { useCash } from "../../../../store/slices/cashSlice";
import { useUser } from "../../../../store/slices/userSlice";
import AlertModal from "../../../common/AlertModal/AlertModal";
import "./OpenShiftPage.scss";

const OpenShiftPage = ({ onBack }) => {
  const dispatch = useDispatch();
  const { list: cashBoxes } = useCash();
  const { currentUser, userId } = useUser();

  const [openingCash, setOpeningCash] = useState("");
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

  const handleOpenShift = async () => {
    // Валидация
    const cashAmount = parseFloat(openingCash);
    if (isNaN(cashAmount) || cashAmount < 0) {
      showAlert("error", "Ошибка", "Пожалуйста, введите корректную сумму");
      return;
    }

    // Проверяем наличие кассы
    if (!cashBoxes || cashBoxes.length === 0) {
      showAlert(
        "error",
        "Ошибка",
        "Нет доступных касс. Пожалуйста, создайте кассу перед началом смены."
      );
      return;
    }

    // Берем первую доступную кассу
    const firstCashBox = cashBoxes[0];
    const cashboxId = firstCashBox?.id;

    if (!cashboxId) {
      showAlert("error", "Ошибка", "Не удалось определить кассу");
      return;
    }

    // Получаем ID кассира из пользователя
    const cashierId = currentUser?.id || userId;

    if (!cashierId) {
      showAlert("error", "Ошибка", "Не удалось определить кассира");
      return;
    }

    try {
      setLoading(true);
      // Отправляем запрос на открытие смены
      await dispatch(
        openShiftAsync({
          cashbox: cashboxId,
          cashier: cashierId,
          opening_cash: String(cashAmount),
        })
      ).unwrap();

      showAlert("success", "Успех", "Смена успешно открыта");
      // Обновляем список смен
      dispatch(fetchShiftsAsync());
      dispatch(getCashBoxes());
      // Закрываем экран через небольшую задержку
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (error) {
      console.error("Ошибка при открытии смены:", error);
      showAlert(
        "error",
        "Ошибка",
        error?.data?.detail || error?.message || "Не удалось открыть смену"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="open-shift-page">
      <div className="open-shift-page__header">
        <button
          className="open-shift-page__back-btn"
          onClick={onBack}
          disabled={loading}
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

          <div className="open-shift-page__input-wrapper">
            <label className="open-shift-page__label">
              Сумма наличных (сом) *
            </label>
            <input
              type="number"
              className="open-shift-page__input"
              value={openingCash}
              onChange={(e) =>  setOpeningCash( e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              autoFocus
              disabled={loading}
            />
          </div>

          <button
            className="open-shift-page__submit-btn"
            onClick={handleOpenShift}
            disabled={loading || !openingCash}
          >
            {loading ? "Открытие..." : "Открыть смену"}
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

export default OpenShiftPage;
