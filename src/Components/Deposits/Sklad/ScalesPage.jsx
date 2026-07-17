import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import api from "../../../api";
import { sendProductsToScales } from "../../../store/creators/userCreators";
import AlertModal from "../../common/AlertModal/AlertModal";
import "./ScalesPage.scss";
import { validateResErrors } from "../../../../tools/validateResErrors";

const isWeightProduct = (p) =>
  Boolean(p?.is_weight) || p?.scale_type === "weight";

/**
 * Собирает весовые товары: бэкенд фильтрует по is_weight=true
 * (см. docs/market/scales-weight-products.md), клиентский фильтр —
 * подстраховка на случай, если параметр проигнорирован.
 */
const fetchAllWeightProducts = async () => {
  const collected = [];
  let page = 1;
  const MAX_PAGES = 100;

  while (page <= MAX_PAGES) {
    const { data } = await api.get("main/products/list/", {
      params: { page, is_weight: true },
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
 * Читает detail из blob-ответа с ошибкой (при responseType: "blob"
 * тело 400-й тоже приходит как Blob).
 */
const readBlobErrorDetail = async (err) => {
  const blob = err?.response?.data;
  if (blob instanceof Blob) {
    try {
      const { detail } = JSON.parse(await blob.text());
      if (detail) return detail;
    } catch {
      /* не JSON — падаем на общий текст */
    }
  }
  return null;
};

const TABS = [
  { id: "shtrih-m", label: "Штрих-М" },
  { id: "rongta", label: "Rongta" },
];

/** Таб «Штрих-М»: отправка весовых товаров на весы через бэкенд. */
const ShtrihMTab = ({
  weightProducts,
  loading,
  onSuccess,
  onError,
}) => {
  const dispatch = useDispatch();
  const [isSending, setIsSending] = useState(false);

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

      onSuccess(
        count > 0
          ? `Весовые товары (${count} ${productText}) успешно отправлены на весы`
          : "Нет весовых товаров для отправки на весы",
      );
    } catch (err) {
      onError(validateResErrors(err, "Ошибка при отправке товаров на весы"));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="scales-page__grid">
      <div className="scales-page__card">
        <h2 className="scales-page__card-title">Отправка на весы</h2>
        <p className="scales-page__card-text">
          Нажмите кнопку ниже, чтобы выгрузить весовые товары со склада на
          торговые весы. После отправки данные по товарам будут обновлены на
          весах.
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
          {isSending ? "Отправка..." : "Отправить весовые товары на весы"}
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
  );
};

/**
 * Таб «Rongta»: экспорт весовых товаров в .xls под PLU-менеджер
 * весов Rongta RLS1100 (см. docs — GET /main/products/scale-export/).
 */
const RongtaTab = ({ weightProducts, loading, onSuccess, onError }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [translit, setTranslit] = useState(true);

  const count = weightProducts.length;

  const handleExport = async () => {
    try {
      setIsExporting(true);

      const res = await api.get("main/products/scale-export/", {
        params: { translit: translit ? 1 : 0 },
        responseType: "blob",
      });

      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scale_weight_products.xls";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const exportedCount = res.headers?.["x-scale-products-count"];
      onSuccess(
        exportedCount
          ? `Файл для весов скачан, товаров в выгрузке: ${exportedCount}`
          : "Файл для весов успешно скачан",
      );
    } catch (err) {
      const detail = await readBlobErrorDetail(err);
      onError(
        detail || validateResErrors(err, "Не удалось выгрузить файл для весов"),
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="scales-page__grid">
      <div className="scales-page__card">
        <h2 className="scales-page__card-title">Экспорт для весов Rongta</h2>
        <p className="scales-page__card-text">
          Скачайте файл .xls с весовыми товарами и импортируйте его в весы
          Rongta RLS1100 через PLU-менеджер (ПО весов). Товарам без PLU номер
          будет присвоен автоматически при экспорте.
        </p>

        <div className="scales-page__stats">
          <div className="scales-page__stat-item">
            <div className="scales-page__stat-label">
              Весовых товаров для выгрузки
            </div>
            <div className="scales-page__stat-value">{count}</div>
          </div>
        </div>

        <label className="scales-page__checkbox">
          <input
            type="checkbox"
            checked={translit}
            onChange={(e) => setTranslit(e.target.checked)}
          />
          Транслитерировать названия в латиницу (весы часто печатают только
          ASCII)
        </label>

        <button
          type="button"
          className="scales-page__send-btn"
          onClick={handleExport}
          disabled={loading || isExporting || count === 0}
        >
          {isExporting ? "Выгрузка..." : "Экспорт для весов (.xls)"}
        </button>

        {loading && (
          <div className="scales-page__hint">Загрузка товаров...</div>
        )}
        {!loading && count === 0 && (
          <div className="scales-page__hint">
            Весовых товаров на складе нет
          </div>
        )}

        <div className="scales-page__warning">
          <strong>Важно про штрихкоды.</strong> Весы по умолчанию печатают
          штрихкоды с префиксом <b>21</b> (отдел 21, тип штрихкода 5), а касса
          по умолчанию считает весовым префикс <b>20</b>. Чтобы штрихкоды
          читались как вес, у компании должен быть включён режим чтения
          штрихкода весов «вес», либо префикс на весах перенастроен на 20.
        </div>
      </div>

      <div className="scales-page__info-card">
        <h3 className="scales-page__info-title">Как это работает</h3>
        <ul className="scales-page__info-list">
          <li>1. Нажмите «Экспорт для весов» — скачается файл .xls.</li>
          <li>
            2. Откройте ПО весов (PLU-менеджер) и импортируйте этот файл.
          </li>
          <li>3. Загрузите PLU в весы.</li>
          <li>
            4. Весы печатают этикетки со штрихкодом, касса их читает при
            продаже.
          </li>
        </ul>
      </div>
    </div>
  );
};

/**
 * Отдельная страница для работы с весами.
 * На весы отправляются только весовые товары (is_weight / scale_type = weight).
 * Два таба: «Штрих-М» — отправка на весы через бэкенд,
 * «Rongta» — экспорт .xls под PLU-менеджер Rongta RLS1100.
 */
const ScalesPage = () => {
  const [activeTab, setActiveTab] = useState("shtrih-m");
  const [weightProducts, setWeightProducts] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const handleSuccess = (message) => {
    setAlertMessage(message);
    setShowSuccessAlert(true);
  };

  const handleError = (message) => {
    setAlertMessage(message);
    setShowErrorAlert(true);
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
        <div className="scales-page__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`scales-page__tab ${
                activeTab === tab.id ? "scales-page__tab--active" : ""
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "shtrih-m" ? (
          <ShtrihMTab
            weightProducts={weightProducts}
            loading={loading}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        ) : (
          <RongtaTab
            weightProducts={weightProducts}
            loading={loading}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        )}
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
