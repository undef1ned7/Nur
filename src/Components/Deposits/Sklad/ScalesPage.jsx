import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import api from "../../../api";
import { sendProductsToScales } from "../../../store/creators/userCreators";
import AlertModal from "../../common/AlertModal/AlertModal";
import "./ScalesPage.scss";
import { validateResErrors } from "../../../../tools/validateResErrors";

const isWeightProduct = (p) =>
  Boolean(p?.is_weight) || p?.scale_type === "weight";

/** Собирает весовые товары со всех страниц каталога */
const fetchAllWeightProducts = async () => {
  const collected = [];
  let page = 1;
  const MAX_PAGES = 100;

  while (page <= MAX_PAGES) {
    const { data } = await api.get("main/products/list/", {
      params: { page },
    });
    const results = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
        ? data
        : [];
    collected.push(...results.filter(isWeightProduct));
    if (!data?.next) break;
    page += 1;
  }

  return collected;
};

/**
 * Отдельная страница для работы с весами.
 * На весы отправляются только весовые товары (is_weight / scale_type = weight).
 */
const ScalesPage = () => {
  const dispatch = useDispatch();
  const [weightProducts, setWeightProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const load = async () => {
      try {
        const products = await fetchAllWeightProducts();
        if (!cancelledRef.current) setWeightProducts(products);
      } catch (err) {
        if (!cancelledRef.current) {
          setAlertMessage(
            validateResErrors(err, "Ошибка при загрузке весовых товаров"),
          );
          setShowErrorAlert(true);
        }
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    };

    load();

    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const count = weightProducts.length;

  const handleSendAllToScales = async () => {
    try {
      setIsSending(true);

      const payload = {
        plu_start: 1,
        product_ids: weightProducts.map((p) => p.id),
      };

      await dispatch(sendProductsToScales(payload)).unwrap();

      const productText =
        count === 1 ? "товар" : count < 5 ? "товара" : "товаров";

      setAlertMessage(
        count > 0
          ? `Весовые товары (${count} ${productText}) успешно отправлены на весы`
          : "Нет весовых товаров для отправки на весы",
      );
      setShowSuccessAlert(true);
    } catch (err) {
      const errorMessage = validateResErrors(
        err,
        "Ошибка при отправке товаров на весы",
      );
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
          Отправка весовых товаров с вашего склада на торговые весы
        </p>
      </div>

      <div className="scales-page__content">
        <div className="scales-page__grid">
          <div className="scales-page__card">
            <h2 className="scales-page__card-title">Отправка на весы</h2>
            <p className="scales-page__card-text">
              Нажмите кнопку ниже, чтобы выгрузить весовые товары со склада на
              торговые весы. После отправки данные по товарам будут обновлены
              на весах.
            </p>

            <div className="scales-page__stats">
              <div className="scales-page__stat-item">
                <div className="scales-page__stat-label">
                  Весовых товаров для выгрузки
                </div>
                <div className="scales-page__stat-value">{count}</div>
              </div>
            </div>

            <button
              type="button"
              className="scales-page__send-btn"
              onClick={handleSendAllToScales}
              disabled={loading || isSending || count === 0}
            >
              {isSending
                ? "Отправка..."
                : "Отправить весовые товары на весы"}
            </button>

            {loading && (
              <div className="scales-page__hint">Загрузка товаров...</div>
            )}
            {!loading && count === 0 && (
              <div className="scales-page__hint">
                Весовых товаров на складе нет
              </div>
            )}
          </div>

          <div className="scales-page__info-card">
            <h3 className="scales-page__info-title">Как это работает</h3>
            <ul className="scales-page__info-list">
              <li>1. Подключите весы к сети и настройте соединение.</li>
              <li>2. Убедитесь, что товары на складе заполнены корректно.</li>
              <li>
                3. Нажмите кнопку выгрузки — система отправит весовые товары на
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
