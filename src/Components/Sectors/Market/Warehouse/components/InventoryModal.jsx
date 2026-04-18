import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Minus, PackageCheck, Save, X } from "lucide-react";
import api from "../../../../../api";
import { validateResErrors } from "../../../../../../tools/validateResErrors";
import { formatStock } from "../utils";

const normalizeQuantityValue = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
  return normalized;
};

const InventoryModal = ({ products, onClose, onSaved }) => {
  const [note, setNote] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [submittingMode, setSubmittingMode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const initialQuantities = Object.fromEntries(
      (products || []).map((product) => [
        product.id,
        normalizeQuantityValue(product.quantity ?? 0),
      ]),
    );
    setQuantities(initialQuantities);
    setError("");
    setNote("");
    setAllowNegative(false);
  }, [products]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !submittingMode) {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submittingMode]);

  const inventoryRows = useMemo(() => {
    return (products || []).map((product) => {
      const rawFact = quantities[product.id] ?? "";
      const factNumber = Number(normalizeQuantityValue(rawFact));
      const quantityBefore = Number(product.quantity ?? 0) || 0;
      const difference = Number.isFinite(factNumber)
        ? factNumber - quantityBefore
        : null;

      return {
        id: product.id,
        name: product.name || "Без названия",
        code: product.code || product.article || "—",
        unit: product.unit || "шт",
        quantityBefore,
        quantityFactRaw: rawFact,
        quantityFact: factNumber,
        difference,
      };
    });
  }, [products, quantities]);

  const validateItems = useCallback(
    (mode) => {
      if (!Array.isArray(products) || products.length === 0) {
        return { ok: false, message: "Выберите хотя бы один товар для инвентаризации." };
      }

      const seenIds = new Set();
      const items = [];

      for (const row of inventoryRows) {
        if (seenIds.has(row.id)) {
          return { ok: false, message: "Один и тот же товар добавлен в акт несколько раз." };
        }
        seenIds.add(row.id);

        const normalizedFact = normalizeQuantityValue(row.quantityFactRaw);
        if (normalizedFact === "") {
          return {
            ok: false,
            message: `Укажите фактический остаток для товара "${row.name}".`,
          };
        }

        if (!Number.isFinite(row.quantityFact)) {
          return {
            ok: false,
            message: `Некорректное количество у товара "${row.name}".`,
          };
        }

        // Отрицательный факт запрещён только при проведении, если не включено allow_negative (как в API).
        if (
          mode === "apply" &&
          !allowNegative &&
          row.quantityFact < 0
        ) {
          return {
            ok: false,
            message: `Для товара «${row.name}» указан отрицательный фактический остаток. Включите «Разрешить отрицательные фактические остатки при проведении» или измените количество.`,
          };
        }

        items.push({
          product_id: row.id,
          quantity_fact: normalizedFact,
        });
      }

      return { ok: true, items };
    },
    [allowNegative, inventoryRows, products],
  );

  const submitInventory = useCallback(
    async (mode) => {
      if (submittingMode) return;

      const validation = validateItems(mode);
      if (!validation.ok) {
        setError(validation.message);
        return;
      }

      setError("");
      setSubmittingMode(mode);

      try {
        const sessionPayload = {
          note: note.trim(),
          items: validation.items,
        };

        const { data: session } = await api.post(
          "/main/inventory/sessions/",
          sessionPayload,
        );

        if (mode === "apply") {
          await api.post(`/main/inventory/sessions/${session.id}/apply/`, {
            allow_negative: allowNegative,
          });
        }

        onSaved?.({
          session,
          applied: mode === "apply",
        });
      } catch (err) {
        setError(
          validateResErrors(
            err,
            mode === "apply"
              ? "Не удалось провести инвентаризацию."
              : "Не удалось сохранить черновик инвентаризации.",
          ),
        );
      } finally {
        setSubmittingMode("");
      }
    },
    [allowNegative, note, onSaved, submittingMode, validateItems],
  );

  const totalDifference = useMemo(() => {
    return inventoryRows.reduce((sum, row) => {
      return sum + (Number.isFinite(row.difference) ? row.difference : 0);
    }, 0);
  }, [inventoryRows]);

  return (
    <div className="warehouse-inventory-overlay" onClick={() => !submittingMode && onClose?.()}>
      <div
        className="warehouse-inventory-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="warehouse-inventory-modal__header">
          <div className="warehouse-inventory-modal__title-wrap">
            <div className="warehouse-inventory-modal__icon">
              <ClipboardList size={18} />
            </div>
            <div>
              <h3 className="warehouse-inventory-modal__title">Инвентаризация товаров</h3>
              <p className="warehouse-inventory-modal__subtitle">
                Выбрано товаров: <b>{products.length}</b>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="warehouse-inventory-modal__close"
            onClick={onClose}
            disabled={Boolean(submittingMode)}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <div className="warehouse-inventory-modal__body">
          <div className="warehouse-inventory-modal__summary">
            <div className="warehouse-inventory-modal__summary-card">
              <span>Товаров в акте</span>
              <strong>{products.length}</strong>
            </div>
            <div className="warehouse-inventory-modal__summary-card">
              <span>Суммарное отклонение</span>
              <strong>{formatStock(totalDifference)}</strong>
            </div>
          </div>

          <label className="warehouse-inventory-modal__field">
            <span className="warehouse-inventory-modal__label">Примечание</span>
            <textarea
              className="warehouse-inventory-modal__textarea"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Комментарий к акту инвентаризации"
              rows={3}
            />
          </label>

          <label className="warehouse-inventory-modal__checkbox">
            <input
              type="checkbox"
              checked={allowNegative}
              onChange={(event) => setAllowNegative(event.target.checked)}
            />
            <span>Разрешить отрицательные фактические остатки при проведении</span>
          </label>

          <div className="warehouse-inventory-modal__table">
            <div className="warehouse-inventory-modal__table-head">
              <span>Товар</span>
              <span>Текущий остаток</span>
              <span>Факт</span>
              <span>Отклонение</span>
            </div>

            <div className="warehouse-inventory-modal__rows">
              {inventoryRows.map((row) => {
                const diffClass =
                  row.difference > 0
                    ? "is-positive"
                    : row.difference < 0
                      ? "is-negative"
                      : "";

                return (
                  <div key={row.id} className="warehouse-inventory-modal__row">
                    <div className="warehouse-inventory-modal__product">
                      <div className="warehouse-inventory-modal__product-name">
                        {row.name}
                      </div>
                      <div className="warehouse-inventory-modal__product-meta">
                        Код: {row.code} • Ед.: {row.unit}
                      </div>
                    </div>

                    <div className="warehouse-inventory-modal__value">
                      {formatStock(row.quantityBefore)}
                    </div>

                    <input
                      type="number"
                      step="0.001"
                      className="warehouse-inventory-modal__input"
                      value={row.quantityFactRaw}
                      onChange={(event) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [row.id]: event.target.value,
                        }))
                      }
                      placeholder="0"
                    />

                    <div
                      className={`warehouse-inventory-modal__difference ${diffClass}`}
                    >
                      {row.difference === null ? (
                        "—"
                      ) : row.difference > 0 ? (
                        <>
                          <PackageCheck size={14} />
                          +{formatStock(row.difference)}
                        </>
                      ) : row.difference < 0 ? (
                        <>
                          <Minus size={14} />
                          {formatStock(row.difference)}
                        </>
                      ) : (
                        "0"
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error ? <div className="warehouse-inventory-modal__error">{error}</div> : null}
        </div>

        <div className="warehouse-inventory-modal__footer">
          <button
            type="button"
            className="warehouse-inventory-modal__secondary-btn"
            onClick={onClose}
            disabled={Boolean(submittingMode)}
          >
            Отмена
          </button>
          <button
            type="button"
            className="warehouse-inventory-modal__secondary-btn"
            onClick={() => submitInventory("draft")}
            disabled={Boolean(submittingMode)}
          >
            <Save size={16} />
            {submittingMode === "draft" ? "Сохраняем..." : "Сохранить черновик"}
          </button>
          <button
            type="button"
            className="warehouse-inventory-modal__primary-btn"
            onClick={() => submitInventory("apply")}
            disabled={Boolean(submittingMode)}
          >
            <PackageCheck size={16} />
            {submittingMode === "apply" ? "Проводим..." : "Провести инвентаризацию"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(InventoryModal);
