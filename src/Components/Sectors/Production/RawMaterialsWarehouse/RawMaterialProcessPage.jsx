import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Info,
  Scissors,
  Package,
  Sparkles,
} from "lucide-react";
import api from "../../../../api";
import {
  getProcessedItemsMake,
  processItemMake,
} from "../../../../store/creators/productCreators";
import {
  calcProcessedPricePreview,
  calcProcessedPriceReplenish,
  calcProcessingLoss,
  canProcessItem,
  isRawItem,
  needsProcessingItem,
  toDecimal2,
} from "../itemMakeHelpers";
import {
  useAlert,
  useErrorModal,
} from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import "./RawMaterialProcessPage.scss";

const WAREHOUSE_RAW_URL = "/crm/production/warehouse?tab=raw";

const clampQty = (value, max) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
};

const RawMaterialProcessPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const alert = useAlert();
  const errorModal = useErrorModal();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [item, setItem] = useState(null);
  const [processedItems, setProcessedItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const stockQty = Number(item?.quantity || 0);
  const sourcePrice = Number(item?.price || 0);
  const unit = item?.unit || "ед.";

  const defaultName = `${item?.name || ""} (обработанное)`.trim();

  const [inputQty, setInputQty] = useState("");
  const [outputQty, setOutputQty] = useState("");
  const [processingCost, setProcessingCost] = useState("0.00");
  const [targetMode, setTargetMode] = useState("new");
  const [targetId, setTargetId] = useState("");
  const [resultName, setResultName] = useState("");

  const replenishTargets = useMemo(
    () =>
      (processedItems || []).filter(
        (it) => String(it?.source || "") === String(item?.id || ""),
      ),
    [processedItems, item?.id],
  );

  const selectedTarget = useMemo(
    () =>
      replenishTargets.find((t) => String(t.id) === String(targetId)) || null,
    [replenishTargets, targetId],
  );

  const { loss, pct } = useMemo(
    () => calcProcessingLoss(inputQty, outputQty),
    [inputQty, outputQty],
  );

  const yieldPct = useMemo(() => {
    const input = Number(inputQty) || 0;
    const output = Number(outputQty) || 0;
    if (input <= 0) return 0;
    return (output / input) * 100;
  }, [inputQty, outputQty]);

  const previewPrice = useMemo(() => {
    const args = {
      inputQty,
      outputQty,
      sourcePrice,
      processingCost,
    };
    if (targetMode === "replenish" && selectedTarget) {
      return calcProcessedPriceReplenish({
        oldQty: selectedTarget.quantity,
        oldPrice: selectedTarget.price,
        ...args,
      });
    }
    return calcProcessedPricePreview(args);
  }, [
    inputQty,
    outputQty,
    sourcePrice,
    processingCost,
    targetMode,
    selectedTarget,
  ]);

  const inputCost = useMemo(
    () => (Number(inputQty) || 0) * sourcePrice + (Number(processingCost) || 0),
    [inputQty, sourcePrice, processingCost],
  );

  const validation = useMemo(() => {
    const input = Number(inputQty);
    const output = Number(outputQty);
    if (!input || input <= 0) return { ok: false, message: "Укажите, сколько сырья взять" };
    if (!output || output <= 0) return { ok: false, message: "Укажите, сколько получится на выходе" };
    if (output > input) return { ok: false, message: "Выход не может быть больше входа" };
    if (input > stockQty) {
      return { ok: false, message: `На складе только ${stockQty} ${unit}` };
    }
    if (targetMode === "replenish" && replenishTargets.length && !targetId) {
      return { ok: false, message: "Выберите позицию для пополнения" };
    }
    return { ok: true, message: "" };
  }, [
    inputQty,
    outputQty,
    stockQty,
    unit,
    targetMode,
    replenishTargets.length,
    targetId,
  ]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError("");
    try {
      const [{ data: rawItem }, processedRes] = await Promise.all([
        api.get(`/main/items-make/${id}/`),
        dispatch(getProcessedItemsMake()).unwrap(),
      ]);
      setItem(rawItem);
      setProcessedItems(Array.isArray(processedRes) ? processedRes : []);

      const qty = String(rawItem?.quantity ?? "");
      const suggestedOutput =
        rawItem?.quantity != null
          ? String(Math.round(Number(rawItem.quantity) * 0.9 * 1000) / 1000)
          : "";

      setInputQty(qty);
      setOutputQty(suggestedOutput || qty);
      setResultName(`${rawItem?.name || ""} (обработанное)`.trim());
      setTargetMode("new");
      setTargetId("");
    } catch (err) {
      setLoadError(validateResErrors(err, "Не удалось загрузить сырьё"));
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [dispatch, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const applyInputFraction = (fraction) => {
    const next = Math.round(stockQty * fraction * 1000) / 1000;
    setInputQty(String(next));
    if (!outputQty || Number(outputQty) > next) {
      setOutputQty(String(Math.round(next * 0.9 * 1000) / 1000));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validation.ok) {
      errorModal(validation.message);
      return;
    }

    setSaving(true);
    try {
      const result = await dispatch(
        processItemMake({
          id: item.id,
          input_quantity: inputQty,
          output_quantity: outputQty,
          name: resultName || defaultName,
          processing_cost: processingCost,
          target_item_make_id:
            targetMode === "replenish" && targetId ? targetId : null,
        }),
      ).unwrap();

      const processedName =
        result?.processed?.name || resultName || defaultName;
      alert(`Готово! «${processedName}» добавлено на склад.`, () => {
        navigate(WAREHOUSE_RAW_URL);
      });
    } catch (err) {
      errorModal(validateResErrors(err, "Ошибка при обработке сырья"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="raw-process-page">
        <div className="raw-process-page__loading">Загрузка…</div>
      </div>
    );
  }

  if (loadError || !item) {
    return (
      <div className="raw-process-page">
        <button
          type="button"
          className="raw-process-page__back"
          onClick={() => navigate(WAREHOUSE_RAW_URL)}
        >
          <ArrowLeft size={16} />
          <span className="raw-process-page__back-text">Назад к складу сырья</span>
          <span className="raw-process-page__back-text raw-process-page__back-text--short">
            Назад
          </span>
        </button>
        <div className="raw-process-page__error">
          {loadError || "Сырьё не найдено"}
        </div>
      </div>
    );
  }

  if (!isRawItem(item)) {
    return (
      <div className="raw-process-page">
        <button
          type="button"
          className="raw-process-page__back"
          onClick={() => navigate(WAREHOUSE_RAW_URL)}
        >
          <ArrowLeft size={16} />
          <span className="raw-process-page__back-text">Назад к складу сырья</span>
          <span className="raw-process-page__back-text raw-process-page__back-text--short">
            Назад
          </span>
        </button>
        <div className="raw-process-page__error">
          Обрабатывать можно только необработанное сырьё.
        </div>
      </div>
    );
  }

  if (!needsProcessingItem(item)) {
    return (
      <div className="raw-process-page">
        <button
          type="button"
          className="raw-process-page__back"
          onClick={() => navigate(WAREHOUSE_RAW_URL)}
        >
          <ArrowLeft size={16} />
          <span className="raw-process-page__back-text">Назад к складу сырья</span>
          <span className="raw-process-page__back-text raw-process-page__back-text--short">
            Назад
          </span>
        </button>
        <div className="raw-process-page__error">
          «{item.name}» не требует обработки — его можно сразу добавить в рецепт
          готовой продукции.
        </div>
      </div>
    );
  }

  if (!canProcessItem(item)) {
    return (
      <div className="raw-process-page">
        <button
          type="button"
          className="raw-process-page__back"
          onClick={() => navigate(WAREHOUSE_RAW_URL)}
        >
          <ArrowLeft size={16} />
          <span className="raw-process-page__back-text">Назад к складу сырья</span>
          <span className="raw-process-page__back-text raw-process-page__back-text--short">
            Назад
          </span>
        </button>
        <div className="raw-process-page__error">
          Нет остатка для обработки «{item.name}».
        </div>
      </div>
    );
  }

  return (
    <div className="raw-process-page">
      <header className="raw-process-page__header">
        <button
          type="button"
          className="raw-process-page__back"
          onClick={() => navigate(WAREHOUSE_RAW_URL)}
        >
          <ArrowLeft size={16} />
          <span className="raw-process-page__back-text">Назад к складу сырья</span>
          <span className="raw-process-page__back-text raw-process-page__back-text--short">
            Назад
          </span>
        </button>

        <div className="raw-process-page__title-row">
          <div className="raw-process-page__icon">
            <Scissors size={28} />
          </div>
          <div>
            <h1 className="raw-process-page__title">Обработка сырья</h1>
            <p className="raw-process-page__subtitle">
              Очистка, нарезка, подготовка — с учётом потерь
            </p>
          </div>
        </div>
      </header>

      <div className="raw-process-flow">
        <div className="raw-process-flow__step raw-process-flow__step--raw">
          <span className="raw-process-flow__label">Берём сырьё</span>
          <strong>{item.name}</strong>
          <span>
            {inputQty || "—"} {unit}
          </span>
        </div>
        <div className="raw-process-flow__arrow" aria-hidden>
          <Scissors size={18} className="raw-process-flow__icon--process" />
          <ArrowRight size={20} className="raw-process-flow__icon--next" />
        </div>
        <div className="raw-process-flow__step raw-process-flow__step--loss">
          <span className="raw-process-flow__label">Потери</span>
          <strong>{loss > 0 ? `${loss.toFixed(3)} ${unit}` : "—"}</strong>
          <span>{pct > 0 ? `${pct.toFixed(1)}%` : "нет"}</span>
        </div>
        <div className="raw-process-flow__arrow" aria-hidden>
          <ArrowRight size={20} className="raw-process-flow__icon--next" />
        </div>
        <div className="raw-process-flow__step raw-process-flow__step--done">
          <span className="raw-process-flow__label">Получаем</span>
          <strong>{resultName || defaultName}</strong>
          <span>
            {outputQty || "—"} {unit}
          </span>
        </div>
      </div>

      <form className="raw-process-page__grid" onSubmit={handleSubmit}>
        <div className="raw-process-page__main">
        <section className="raw-process-card">
          <div className="raw-process-card__head">
            <Package size={18} />
            <h2>Что обрабатываем</h2>
          </div>
          <dl className="raw-process-dl">
            <div>
              <dt>На складе</dt>
              <dd>
                {stockQty} {unit}
              </dd>
            </div>
            <div>
              <dt>Цена закупки</dt>
              <dd>
                {toDecimal2(sourcePrice)} сом / {unit}
              </dd>
            </div>
            {item.supplier_name && (
              <div>
                <dt>Поставщик</dt>
                <dd>{item.supplier_name}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="raw-process-card raw-process-card--accent">
          <div className="raw-process-card__head">
            <span className="raw-process-step">1</span>
            <h2>Сколько берём со склада</h2>
          </div>
          <p className="raw-process-hint">
            Это количество будет <strong>списано</strong> с сырой позиции.
          </p>

          <div className="raw-process-quick">
            {[0.25, 0.5, 1].map((f) => (
              <button
                key={f}
                type="button"
                className={`raw-process-quick__btn ${
                  Number(inputQty) === Math.round(stockQty * f * 1000) / 1000
                    ? "is-active"
                    : ""
                }`}
                onClick={() => applyInputFraction(f)}
              >
                {f === 1 ? "Весь остаток" : `${f * 100}%`}
              </button>
            ))}
          </div>

          <label className="raw-process-field">
            <span>Количество к списанию</span>
            <div className="raw-process-field__row">
              <input
                type="number"
                min="0"
                max={stockQty}
                step="0.001"
                value={inputQty}
                onChange={(e) =>
                  setInputQty(String(clampQty(e.target.value, stockQty)))
                }
                required
              />
              <span className="raw-process-field__unit">{unit}</span>
            </div>
          </label>

          <div className="raw-process-meter">
            <div
              className="raw-process-meter__fill"
              style={{
                width: `${stockQty > 0 ? Math.min(100, (Number(inputQty) / stockQty) * 100) : 0}%`,
              }}
            />
          </div>
          <small className="raw-process-meter__caption">
            {Number(inputQty) || 0} из {stockQty} {unit} на складе
          </small>
        </section>

        <section className="raw-process-card raw-process-card--accent">
          <div className="raw-process-card__head">
            <span className="raw-process-step">2</span>
            <h2>Сколько получится после обработки</h2>
          </div>
          <p className="raw-process-hint">
            Обычно меньше, чем взяли — разница это <strong>потери</strong>{" "}
            (очистка, обрезка, усушка).
          </p>

          <label className="raw-process-field">
            <span>Количество на выходе</span>
            <div className="raw-process-field__row">
              <input
                type="number"
                min="0"
                max={inputQty || stockQty}
                step="0.001"
                value={outputQty}
                onChange={(e) =>
                  setOutputQty(
                    String(clampQty(e.target.value, Number(inputQty) || stockQty)),
                  )
                }
                required
              />
              <span className="raw-process-field__unit">{unit}</span>
            </div>
          </label>

          <div
            className={`raw-process-loss ${
              loss > 0 ? "raw-process-loss--visible" : ""
            }`}
          >
            <Info size={16} />
            <div>
              <strong>
                Потери: {loss.toFixed(3)} {unit} ({pct.toFixed(1)}%)
              </strong>
              <p>Выход: {yieldPct.toFixed(1)}% от взятого количества</p>
            </div>
          </div>
        </section>

        <section className="raw-process-card">
          <div className="raw-process-card__head">
            <span className="raw-process-step">3</span>
            <h2>Куда положить результат</h2>
          </div>

          <div className="raw-process-target">
            <label className="raw-process-target__option">
              <input
                type="radio"
                name="targetMode"
                checked={targetMode === "new"}
                onChange={() => {
                  setTargetMode("new");
                  setTargetId("");
                }}
              />
              <div>
                <strong>Новая позиция на складе</strong>
                <p>Создать отдельную карточку обработанного сырья</p>
              </div>
            </label>

            {replenishTargets.length > 0 && (
              <label className="raw-process-target__option">
                <input
                  type="radio"
                  name="targetMode"
                  checked={targetMode === "replenish"}
                  onChange={() => setTargetMode("replenish")}
                />
                <div>
                  <strong>Добавить к существующей</strong>
                  <p>Уже есть обработанная партия от этого сырья</p>
                </div>
              </label>
            )}
          </div>

          {targetMode === "replenish" && replenishTargets.length > 0 && (
            <label className="raw-process-field">
              <span>Выберите позицию</span>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                required
              >
                <option value="">— Выберите —</option>
                {replenishTargets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · остаток {t.quantity} {t.unit} · {t.price} сом
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="raw-process-field">
            <span>Название обработанного сырья</span>
            <input
              type="text"
              value={resultName}
              onChange={(e) => setResultName(e.target.value)}
              placeholder={defaultName}
            />
          </label>

          <label className="raw-process-field">
            <span>Доп. расход на партию (необязательно)</span>
            <div className="raw-process-field__row">
              <input
                type="number"
                min="0"
                step="0.01"
                value={processingCost}
                onChange={(e) => setProcessingCost(e.target.value)}
              />
              <span className="raw-process-field__unit">сом</span>
            </div>
            <small className="raw-process-hint">
              Например, оплата работы или упаковки — войдёт в себестоимость
            </small>
          </label>
        </section>
        </div>

        <aside className="raw-process-summary">
          <div className="raw-process-summary__head">
            <Sparkles size={18} />
            <h2>Итог операции</h2>
          </div>

          <ul className="raw-process-summary__list">
            <li>
              <span>Списать с сырого склада</span>
              <strong>
                −{inputQty || 0} {unit}
              </strong>
            </li>
            <li>
              <span>Зачислить обработанное</span>
              <strong>
                +{outputQty || 0} {unit}
              </strong>
            </li>
            <li>
              <span>Стоимость партии</span>
              <strong>{toDecimal2(inputCost)} сом</strong>
            </li>
            <li className="raw-process-summary__highlight">
              <span>Новая цена за {unit}</span>
              <strong>{toDecimal2(previewPrice)} сом</strong>
            </li>
          </ul>

          <p className="raw-process-summary__formula">
            ({inputQty || 0} × {toDecimal2(sourcePrice)} + {processingCost}) ÷{" "}
            {outputQty || 0} = {toDecimal2(previewPrice)} сом/{unit}
          </p>

          {!validation.ok && (
            <div className="raw-process-summary__warn">{validation.message}</div>
          )}

          <div className="raw-process-summary__actions">
            <button
              type="button"
              className="raw-process-btn raw-process-btn--ghost"
              onClick={() => navigate(WAREHOUSE_RAW_URL)}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="raw-process-btn raw-process-btn--primary"
              disabled={saving || !validation.ok}
            >
              {saving ? (
                "Обработка…"
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  Подтвердить обработку
                </>
              )}
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
};

export default RawMaterialProcessPage;
