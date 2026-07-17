import { useCallback, useEffect, useRef, useState } from "react";
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
  { id: "settings", label: "Настройки" },
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
 * Таб «Rongta»: экспорт весовых товаров под PLU-менеджер весов
 * Rongta RLS1100 (см. docs — GET /main/products/scale-export/).
 * Формат по умолчанию — .TXP (рабочий формат импорта Rongta RLS),
 * .xls — запасной.
 */
const EXPORT_FORMATS = [
  {
    id: "txp",
    label: ".TXP — формат импорта Rongta RLS (рекомендуется)",
    filename: "scale_weight_products.TXP",
  },
  {
    id: "xls",
    label: ".xls — Excel-таблица (запасной)",
    filename: "scale_weight_products.xls",
  },
];

const RongtaTab = ({ weightProducts, loading, onSuccess, onError }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [translit, setTranslit] = useState(true);
  const [format, setFormat] = useState("txp");

  const count = weightProducts.length;

  const handleExport = async () => {
    try {
      setIsExporting(true);

      const res = await api.get("main/products/scale-export/", {
        params: { format, translit: translit ? 1 : 0 },
        responseType: "blob",
      });

      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        EXPORT_FORMATS.find((f) => f.id === format)?.filename ||
        EXPORT_FORMATS[0].filename;
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
          Скачайте файл с весовыми товарами и импортируйте его в весы Rongta
          RLS1100 через PLU-менеджер (ПО весов). Товарам без PLU номер будет
          присвоен автоматически при экспорте.
        </p>

        <div className="scales-page__stats">
          <div className="scales-page__stat-item">
            <div className="scales-page__stat-label">
              Весовых товаров для выгрузки
            </div>
            <div className="scales-page__stat-value">{count}</div>
          </div>
        </div>

        <div className="scales-page__field">
          <div className="scales-page__field-label">Формат файла</div>
          <select
            className="scales-page__select"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            {EXPORT_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <label className="scales-page__checkbox">
          <input
            type="checkbox"
            checked={translit}
            onChange={(e) => setTranslit(e.target.checked)}
          />
          Транслитерировать названия в латиницу (весы Rongta не печатают
          кириллицу — вместо неё выходит «?????»)
        </label>

        <button
          type="button"
          className="scales-page__send-btn"
          onClick={handleExport}
          disabled={loading || isExporting || count === 0}
        >
          {isExporting
            ? "Выгрузка..."
            : `Экспорт для весов (.${format === "xls" ? "xls" : "TXP"})`}
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
          штрихкода весов «По весу» (вкладка «Настройки» на этой странице),
          либо префикс на весах перенастроен на 20.
        </div>
      </div>

      <div className="scales-page__info-card">
        <h3 className="scales-page__info-title">Как это работает</h3>
        <ul className="scales-page__info-list">
          <li>1. Нажмите «Экспорт для весов» — скачается файл (.TXP).</li>
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

const BARCODE_LAYOUTS = [
  { value: "plu", label: "По PLU — префикс(2) + PLU(5) + значение(5)" },
  { value: "code", label: "По коду — префикс(2) + Код(6) + вес(4)" },
];

const BARCODE_MODES = [
  { value: "auto", label: "Авто (по префиксу: 20 — вес, 25 — сумма)" },
  { value: "weight", label: "По весу (граммы)" },
  { value: "amount", label: "По сумме (сомы)" },
];

/**
 * Таб «Настройки»: как касса разбирает штрихкод весов —
 * scale_barcode_mode и scale_barcode_layout на уровне компании
 * (GET/PATCH /users/settings/company/).
 */
const ScaleBarcodeSettingsTab = ({ onSuccess, onError }) => {
  const [layout, setLayout] = useState("plu");
  const [mode, setMode] = useState("auto");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data } = await api.get("users/settings/company/");
        if (cancelled) return;
        if (data?.scale_barcode_layout) setLayout(data.scale_barcode_layout);
        if (data?.scale_barcode_mode) setMode(data.scale_barcode_mode);
      } catch (err) {
        if (!cancelled) {
          onError(
            validateResErrors(err, "Не удалось загрузить настройки компании"),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [onError]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.patch("users/settings/company/", {
        scale_barcode_layout: layout,
        scale_barcode_mode: mode,
      });
      onSuccess(
        "Настройки чтения штрихкода сохранены. Изменения действуют сразу на следующем скане.",
      );
    } catch (err) {
      onError(validateResErrors(err, "Не удалось сохранить настройки"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scales-page__grid">
      <div className="scales-page__card">
        <h2 className="scales-page__card-title">Чтение штрихкода весов</h2>
        <p className="scales-page__card-text">
          Настройки задают, как касса разбирает штрихкод с этикетки весов.
          Действуют на всю компанию — применяются ко всем кассам. Менять может
          владелец или администратор.
        </p>

        <div className="scales-page__field">
          <div className="scales-page__field-label">
            Раскладка штрихкода
          </div>
          <select
            className="scales-page__select"
            value={layout}
            onChange={(e) => setLayout(e.target.value)}
            disabled={loading}
          >
            {BARCODE_LAYOUTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="scales-page__field">
          <div className="scales-page__field-label">Режим значения</div>
          <select
            className="scales-page__select"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            disabled={loading}
          >
            {BARCODE_MODES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="scales-page__send-btn"
          onClick={handleSave}
          disabled={loading || saving}
        >
          {saving ? "Сохранение..." : "Сохранить настройки"}
        </button>

        {loading && (
          <div className="scales-page__hint">Загрузка настроек...</div>
        )}

        <div className="scales-page__warning">
          <strong>Для весов Rongta RLS из нашего экспорта</strong> (отдел 21,
          тип штрихкода 5) обычно подходит: раскладка «По коду», режим «По
          весу».
        </div>
      </div>

      <div className="scales-page__info-card">
        <h3 className="scales-page__info-title">
          Как понять раскладку ваших весов
        </h3>
        <ul className="scales-page__info-list">
          <li>
            1. Свесьте товар с известным PLU и посмотрите штрихкод на этикетке.
          </li>
          <li>
            2. Пример: вызвали PLU 1, весы напечатали{" "}
            <code>2100100001452</code>.
          </li>
          <li>
            3. Как «По PLU»: 21 | 00100 | 00145 | 2 → PLU = 100 — не тот
            товар.
          </li>
          <li>
            4. Как «По коду»: 21 | 001000 | 0145 | 2 → Код 1000 → PLU = 1,
            вес 0.145 кг — совпало.
          </li>
          <li>
            5. Если PLU «не тот», а в штрихкоде виден Код (1000, 1010, …) —
            ставьте раскладку «По коду».
          </li>
        </ul>
        <h3 className="scales-page__info-title" style={{ marginTop: 16 }}>
          Если товар не находится
        </h3>
        <ul className="scales-page__info-list">
          <li>
            PLU из штрихкода не совпадает с PLU товара в системе — сверьте,
            что выгрузка PLU в весы и товары в системе согласованы.
          </li>
        </ul>
      </div>
    </div>
  );
};

/**
 * Отдельная страница для работы с весами.
 * На весы отправляются только весовые товары (is_weight / scale_type = weight).
 * Табы: «Штрих-М» — отправка на весы через бэкенд,
 * «Rongta» — экспорт файла под PLU-менеджер Rongta RLS1100,
 * «Настройки» — чтение штрихкода весов кассой (на уровне компании).
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

  const handleSuccess = useCallback((message) => {
    setAlertMessage(message);
    setShowSuccessAlert(true);
  }, []);

  const handleError = useCallback((message) => {
    setAlertMessage(message);
    setShowErrorAlert(true);
  }, []);

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

        {activeTab === "shtrih-m" && (
          <ShtrihMTab
            weightProducts={weightProducts}
            loading={loading}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        )}
        {activeTab === "rongta" && (
          <RongtaTab
            weightProducts={weightProducts}
            loading={loading}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        )}
        {activeTab === "settings" && (
          <ScaleBarcodeSettingsTab
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
