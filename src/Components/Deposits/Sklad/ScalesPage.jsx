import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchProductsAsync } from "../../../store/creators/productCreators";
import { clearProducts } from "../../../store/slices/productSlice";
import { sendProductsToScales } from "../../../store/creators/userCreators";
import AlertModal from "../../common/AlertModal/AlertModal";
import "./ScalesPage.scss";

/**
 * Отдельная страница для работы с весами.
 * Позволяет отправить все товары или выбранные (в будущем) на весы.
 */
const ScalesPage = () => {
  const dispatch = useDispatch();
  const {
    list: products,
    loading,
    count,
  } = useSelector((state) => state.product);
  const [isSending, setIsSending] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  useEffect(() => {
    dispatch(fetchProductsAsync({}));

    return () => {
      dispatch(clearProducts());
    };
  }, [dispatch]);

  const handleSendAllToScales = async () => {
    try {
      setIsSending(true);

      const payload = {
        plu_start: 1,
      };

      await dispatch(sendProductsToScales(payload)).unwrap();

      const productCount = count || 0;
      const productText =
        productCount === 1 ? "товар" : productCount < 5 ? "товара" : "товаров";

      setAlertMessage(
        productCount > 0
          ? `Все товары (${productCount} ${productText}) успешно отправлены на весы`
          : "Нет товаров для отправки на весы"
      );
      setShowSuccessAlert(true);
    } catch (err) {
      const errorMessage =
        err?.detail ||
        err?.message ||
        (typeof err === "string" ? err : "Не удалось отправить товары на весы");
      setAlertMessage(errorMessage);
      setShowErrorAlert(true);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="scales-page">
      <div className="scales-page__header">
        <h1 className="scales-page__title">Весы</h1>
        <p className="scales-page__subtitle">
          Отправка товаров с вашего склада на торговые весы
        </p>
      </div>

      <div className="scales-page__content">
        <div className="scales-page__grid">
          <div className="scales-page__card">
            <h2 className="scales-page__card-title">Отправка на весы</h2>
            <p className="scales-page__card-text">
              Нажмите кнопку ниже, чтобы выгрузить товары со склада на торговые
              весы. После отправки данные по товарам будут обновлены на весах.
            </p>

            <div className="scales-page__stats">
              <div className="scales-page__stat-item">
                <div className="scales-page__stat-label">
                  Товаров для выгрузки
                </div>
                <div className="scales-page__stat-value">{count || 0}</div>
              </div>
            </div>

            <button
              type="button"
              className="scales-page__send-btn"
              onClick={handleSendAllToScales}
              disabled={loading || isSending || (count || 0) === 0}
            >
              {isSending ? "Отправка..." : "Отправить все товары на весы"}
            </button>

            {loading && (
              <div className="scales-page__hint">Загрузка товаров...</div>
            )}
          </div>

          <div className="scales-page__info-card">
            <h3 className="scales-page__info-title">Как это работает</h3>
            <ul className="scales-page__info-list">
              <li>1. Подключите весы к сети и настройте соединение.</li>
              <li>2. Убедитесь, что товары на складе заполнены корректно.</li>
              <li>
                3. Нажмите кнопку выгрузки — система отправит номенклатуру на
                весы.
              </li>
              <li>
                4. После выгрузки вы можете работать по штрих‑кодам на весах.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <AlertModal
        open={showSuccessAlert}
        type="success"
        title="Успешно!"
        message={alertMessage}
        okText="ОК"
        onClose={() => {
          setShowSuccessAlert(false);
          setAlertMessage("");
        }}
      />

      <AlertModal
        open={showErrorAlert}
        type="error"
        title="Ошибка!"
        message={alertMessage}
        okText="ОК"
        onClose={() => {
          setShowErrorAlert(false);
          setAlertMessage("");
        }}
      />
    </div>
  );
};

export default ScalesPage;
