import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaUtensils,
  FaArrowDown,
  FaArrowUp,
  FaClipboardList,
  FaCheckCircle,
  FaTimes,
} from "react-icons/fa";
import api from "../../../../api";
import { useAlert, useConfirm } from "../../../../hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { suppressOfflineError } from "../../../../utils/cafeOfflineError";
import {
  pickExpenseIdFromResponse,
  recordCafePurchaseExpense,
} from "../../../../../tools/cafePurchaseExpense";

const listFrom = (res) => res?.data?.results || res?.data || [];

const toNum = (x) => {
  if (x === null || x === undefined) return 0;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const numStr = (n) => String(Number(n) || 0).replace(",", ".");

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return dateStr;
  }
};

const HouseholdInventoryTab = ({ query = "" }) => {
  const alert = useAlert();
  const alertRef = useRef(alert);
  alertRef.current = alert;
  const confirm = useConfirm();

  const [subTab, setSubTab] = useState("items");
  const [items, setItems] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemForm, setItemForm] = useState({
    title: "",
    unit: "шт",
    sku: "",
    minimum: "0",
    remainder: "0",
    unit_price: "",
  });

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveType, setMoveType] = useState("receive");
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveQty, setMoveQty] = useState("");
  const [movePrice, setMovePrice] = useState("");
  const [moveNote, setMoveNote] = useState("");

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({ comment: "", lines: [] });
  const [viewSession, setViewSession] = useState(null);
  const [viewSessionOpen, setViewSessionOpen] = useState(false);
  const [confirmSessionId, setConfirmSessionId] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [itemsRes, sessionsRes] = await Promise.all([
        api.get("/cafe/household-items/", { params: { page_size: 500 } }),
        api
          .get("/cafe/household-inventory/sessions/", { params: { page_size: 100 } })
          .catch(() => ({ data: [] })),
      ]);
      setItems(listFrom(itemsRes));
      setSessions(listFrom(sessionsRes));
    } catch (e) {
      if (suppressOfflineError(e)) return;
      alertRef.current(
        validateResErrors(e, "Не удалось загрузить посуду и расходники"),
        true,
      );
      setItems([]);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const q = query.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!q) return items;
    return items.filter(
      (it) =>
        (it.title || "").toLowerCase().includes(q) ||
        (it.sku || "").toLowerCase().includes(q) ||
        (it.unit || "").toLowerCase().includes(q),
    );
  }, [items, q]);

  const filteredSessions = useMemo(() => {
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        (s.comment || "").toLowerCase().includes(q) ||
        String(s.id || "")
          .toLowerCase()
          .includes(q),
    );
  }, [sessions, q]);

  const openCreateItem = () => {
    setEditingItemId(null);
    setItemForm({
      title: "",
      unit: "шт",
      sku: "",
      minimum: "0",
      remainder: "0",
      unit_price: "",
    });
    setItemModalOpen(true);
  };

  const openEditItem = (row) => {
    setEditingItemId(row.id);
    setItemForm({
      title: row.title || "",
      unit: row.unit || "шт",
      sku: row.sku || "",
      minimum: String(row.minimum ?? "0"),
      remainder: String(row.remainder ?? "0"),
    });
    setItemModalOpen(true);
  };

  const saveItem = async (e) => {
    e.preventDefault();
    const title = String(itemForm.title || "").trim();
    const unit = String(itemForm.unit || "").trim();
    if (!title || !unit) return;

    const payload = {
      title,
      unit,
      sku: String(itemForm.sku || "").trim(),
      minimum: numStr(Math.max(0, toNum(itemForm.minimum))),
    };

    try {
      if (editingItemId == null) {
        const remainder = Math.max(0, toNum(itemForm.remainder));
        const unitPrice = Math.max(0, toNum(itemForm.unit_price));

        if (remainder > 0 && unitPrice < 0.01) {
          alert(
            "Укажите цену за единицу — по ней будет записан расход «Закупки».",
            true,
          );
          return;
        }

        const { data: created } = await api.post("/cafe/household-items/", {
          ...payload,
          remainder: numStr(remainder),
          ...(unitPrice > 0 ? { unit_price: numStr(unitPrice) } : {}),
        });

        let expenseId = pickExpenseIdFromResponse(created);
        if (!expenseId && remainder > 0 && unitPrice >= 0.01) {
          try {
            expenseId = await recordCafePurchaseExpense({
              title: `Закупка: ${title}`,
              amount: remainder * unitPrice,
              note: `Посуда: создание, ${numStr(remainder)} ${unit}`,
              source: "household_create",
              sourceId: created?.id,
            });
          } catch (expErr) {
            alert(
              `Позиция создана, но расход «Закупки» не записан: ${validateResErrors(expErr)}`,
              true,
            );
          }
        }

        if (expenseId) {
          alert(
            `Позиция создана. Расход «Закупки»: ${(remainder * unitPrice).toFixed(2)} сом.`,
          );
        }
      } else {
        await api.patch(`/cafe/household-items/${editingItemId}/`, payload);
      }
      setItemModalOpen(false);
      await loadAll();
    } catch (err) {
      if (suppressOfflineError(err)) return;
      alert(validateResErrors(err, "Ошибка сохранения позиции"), true);
    }
  };

  const deleteItem = (row) => {
    confirm(`Удалить «${row.title || "позицию"}»?`, async (result) => {
      if (!result) return;
      try {
        await api.delete(`/cafe/household-items/${row.id}/`);
        await loadAll();
      } catch (err) {
        if (suppressOfflineError(err)) return;
        alert(validateResErrors(err, "Ошибка удаления"), true);
      }
    });
  };

  const openMove = (row, type) => {
    setMoveTarget(row);
    setMoveType(type);
    setMoveQty("");
    setMovePrice("");
    setMoveNote("");
    setMoveOpen(true);
  };

  const submitMove = async (e) => {
    e.preventDefault();
    if (!moveTarget?.id) return;
    const qty = toNum(moveQty);
    if (!(qty > 0)) {
      alert("Укажите количество больше нуля", true);
      return;
    }

    const url =
      moveType === "receive"
        ? `/cafe/household-items/${moveTarget.id}/receive/`
        : `/cafe/household-items/${moveTarget.id}/write-off/`;

    const body = { quantity: numStr(qty), note: moveNote.trim() };

    if (moveType === "receive") {
      const unitPrice = Math.max(0, toNum(movePrice));
      if (unitPrice < 0.01) {
        alert(
          "Укажите цену за единицу — по ней будет записан расход «Закупки».",
          true,
        );
        return;
      }
      body.unit_price = numStr(unitPrice);
    }

    try {
      const { data: moveRes } = await api.post(url, body);

      if (moveType === "receive") {
        const unitPrice = toNum(body.unit_price);
        let expenseId = pickExpenseIdFromResponse(moveRes);
        if (!expenseId && unitPrice >= 0.01) {
          try {
            expenseId = await recordCafePurchaseExpense({
              title: `Закупка: ${moveTarget.title}`,
              amount: qty * unitPrice,
              note:
                moveNote.trim() ||
                `Посуда: приход ${numStr(qty)} ${moveTarget.unit || "шт"}`,
              source: "household_receipt",
              sourceId:
                moveRes?.movement?.id || moveRes?.item?.id || moveTarget.id,
            });
          } catch (expErr) {
            alert(
              `Оприходование выполнено, но расход «Закупки» не записан: ${validateResErrors(expErr)}`,
              true,
            );
          }
        }
        if (expenseId) {
          alert(
            `Оприходовано. Расход «Закупки»: ${(qty * unitPrice).toFixed(2)} сом.`,
          );
        }
      }

      setMoveOpen(false);
      await loadAll();
    } catch (err) {
      if (suppressOfflineError(err)) return;
      alert(
        validateResErrors(
          err,
          moveType === "receive" ? "Ошибка оприходования" : "Ошибка списания",
        ),
        true,
      );
    }
  };

  const openCreateSession = () => {
    setSessionForm({
      comment: "",
      lines: items
        .filter((it) => it.is_active !== false)
        .map((it) => ({
          item: it.id,
          title: it.title,
          qty_counted: String(it.remainder ?? "0"),
        })),
    });
    setSessionModalOpen(true);
  };

  const updateSessionLine = (itemId, value) => {
    setSessionForm((prev) => ({
      ...prev,
      lines: prev.lines.map((ln) =>
        ln.item === itemId ? { ...ln, qty_counted: value } : ln,
      ),
    }));
  };

  const saveSession = async (e) => {
    e.preventDefault();
    const lines = sessionForm.lines
      .map((ln) => ({
        item: ln.item,
        qty_counted: numStr(toNum(ln.qty_counted)),
      }))
      .filter((ln) => ln.item);

    if (!lines.length) {
      alert("Добавьте хотя бы одну позицию", true);
      return;
    }

    try {
      await api.post("/cafe/household-inventory/sessions/", {
        comment: sessionForm.comment.trim(),
        items: lines,
      });
      setSessionModalOpen(false);
      await loadAll();
    } catch (err) {
      if (suppressOfflineError(err)) return;
      alert(validateResErrors(err, "Ошибка создания акта"), true);
    }
  };

  const viewSessionDetail = async (id) => {
    try {
      const { data } = await api.get(`/cafe/household-inventory/sessions/${id}/`);
      setViewSession(data);
      setViewSessionOpen(true);
    } catch (err) {
      if (suppressOfflineError(err)) return;
      alert(validateResErrors(err, "Ошибка загрузки акта"), true);
    }
  };

  const confirmSession = async () => {
    if (!confirmSessionId || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await api.post(
        `/cafe/household-inventory/sessions/${confirmSessionId}/confirm/`,
      );
      setConfirmSessionId(null);
      setViewSessionOpen(false);
      await loadAll();
    } catch (err) {
      if (suppressOfflineError(err)) return;
      alert(validateResErrors(err, "Ошибка проведения акта"), true);
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <div className="cafeInventory__household">
      <div className="cafeInventory__householdSubTabs">
        <button
          type="button"
          className={`cafeInventory__tab ${subTab === "items" ? "cafeInventory__tab--active" : ""}`}
          onClick={() => setSubTab("items")}
        >
          <FaUtensils /> Номенклатура
        </button>
        <button
          type="button"
          className={`cafeInventory__tab ${subTab === "sessions" ? "cafeInventory__tab--active" : ""}`}
          onClick={() => setSubTab("sessions")}
        >
          <FaClipboardList /> Акты инвентаризации
        </button>
        {subTab === "items" ? (
          <button
            type="button"
            className="cafeInventory__btn cafeInventory__btn--primary cafeInventory__householdAdd"
            onClick={openCreateItem}
          >
            <FaPlus /> Добавить позицию
          </button>
        ) : (
          <button
            type="button"
            className="cafeInventory__btn cafeInventory__btn--primary cafeInventory__householdAdd"
            onClick={openCreateSession}
            disabled={!items.length}
          >
            <FaPlus /> Новый акт
          </button>
        )}
      </div>

      {loading && <div className="cafeInventory__alert">Загрузка…</div>}

      {!loading && subTab === "items" && (
        <>
          {!filteredItems.length && (
            <div className="cafeInventory__alert">Нет позиций. Добавьте ложки, тарелки и т.д.</div>
          )}
          {filteredItems.map((it) => (
            <article key={it.id} className="cafeInventory__card">
              <div className="cafeInventory__cardLeft">
                <div className="cafeInventory__avatar">
                  <FaUtensils />
                </div>
                <div>
                  <h3 className="cafeInventory__name">{it.title}</h3>
                  <div className="cafeInventory__meta">
                    {it.sku ? `Арт. ${it.sku} · ` : ""}
                    Остаток: <b>{toNum(it.remainder)}</b> {it.unit}
                    {toNum(it.minimum) > 0 ? ` · мин. ${toNum(it.minimum)}` : ""}
                  </div>
                </div>
              </div>
              <div className="cafeInventory__rowActions">
                <button
                  type="button"
                  className="cafeInventory__btn cafeInventory__btn--secondary"
                  title="Оприходовать"
                  onClick={() => openMove(it, "receive")}
                >
                  <FaArrowDown /> Приход
                </button>
                <button
                  type="button"
                  className="cafeInventory__btn cafeInventory__btn--secondary"
                  title="Списать"
                  onClick={() => openMove(it, "write-off")}
                >
                  <FaArrowUp /> Списать
                </button>
                <button
                  type="button"
                  className="cafeInventory__btn cafeInventory__btn--secondary"
                  onClick={() => openEditItem(it)}
                >
                  <FaEdit /> Изменить
                </button>
                <button
                  type="button"
                  className="cafeInventory__btn cafeInventory__btn--danger"
                  onClick={() => deleteItem(it)}
                >
                  <FaTrash /> Удалить
                </button>
              </div>
            </article>
          ))}
        </>
      )}

      {!loading && subTab === "sessions" && (
        <>
          {!filteredSessions.length && (
            <div className="cafeInventory__alert">Актов инвентаризации пока нет.</div>
          )}
          {filteredSessions.map((s) => {
            const status = String(s.status || "draft").toLowerCase();
            const isDraft = status === "draft";
            return (
              <article key={s.id} className="cafeInventory__card">
                <div className="cafeInventory__cardLeft">
                  <div className="cafeInventory__avatar">
                    <FaClipboardList />
                  </div>
                  <div>
                    <h3 className="cafeInventory__name">
                      Акт {formatDate(s.created_at) || s.id}
                    </h3>
                    <div className="cafeInventory__meta">
                      {s.comment || "Без комментария"} ·{" "}
                      {isDraft ? "Черновик" : "Проведён"}
                    </div>
                  </div>
                </div>
                <div className="cafeInventory__rowActions">
                  <button
                    type="button"
                    className="cafeInventory__btn cafeInventory__btn--secondary"
                    onClick={() => viewSessionDetail(s.id)}
                  >
                    Открыть
                  </button>
                  {isDraft && (
                    <button
                      type="button"
                      className="cafeInventory__btn cafeInventory__btn--primary"
                      onClick={() => setConfirmSessionId(s.id)}
                    >
                      <FaCheckCircle /> Провести
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </>
      )}

      {itemModalOpen && (
        <div
          className="cafeInventory__modalOverlay"
          onClick={() => setItemModalOpen(false)}
        >
          <div className="cafeInventory__modal" onClick={(e) => e.stopPropagation()}>
            <div className="cafeInventory__modalHeader">
              <h3>{editingItemId ? "Редактировать" : "Новая позиция"}</h3>
              <button type="button" onClick={() => setItemModalOpen(false)}>
                <FaTimes />
              </button>
            </div>
            <form className="cafeInventory__form" onSubmit={saveItem}>
              <label>
                Название *
                <input
                  value={itemForm.title}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, title: e.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Ед. изм. *
                <input
                  value={itemForm.unit}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, unit: e.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Артикул
                <input
                  value={itemForm.sku}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, sku: e.target.value }))
                  }
                />
              </label>
              <label>
                Мин. остаток
                <input
                  value={itemForm.minimum}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, minimum: e.target.value }))
                  }
                />
              </label>
              {!editingItemId && (
                <>
                  <label>
                    Начальный остаток
                    <input
                      value={itemForm.remainder}
                      onChange={(e) =>
                        setItemForm((f) => ({
                          ...f,
                          remainder: e.target.value,
                        }))
                      }
                    />
                  </label>
                  {toNum(itemForm.remainder) > 0 && (
                    <>
                      <label>
                        Цена за ед. (сом) *
                        <input
                          value={itemForm.unit_price}
                          onChange={(e) =>
                            setItemForm((f) => ({
                              ...f,
                              unit_price: e.target.value.replace(",", "."),
                            }))
                          }
                          placeholder="Для расхода «Закупки»"
                        />
                      </label>
                      <p className="cafeInventory__hint">
                        Сумма (остаток × цена) запишется в расходы «Закупки» (
                        аналитика → Расходы / Финансы).
                      </p>
                    </>
                  )}
                </>
              )}
              <div className="cafeInventory__formActions">
                <button type="button" onClick={() => setItemModalOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className="cafeInventory__btn cafeInventory__btn--primary">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {moveOpen && moveTarget && (
        <div className="cafeInventory__modalOverlay" onClick={() => setMoveOpen(false)}>
          <div className="cafeInventory__modal" onClick={(e) => e.stopPropagation()}>
            <div className="cafeInventory__modalHeader">
              <h3>
                {moveType === "receive" ? "Оприходование" : "Списание"}: {moveTarget.title}
              </h3>
              <button type="button" onClick={() => setMoveOpen(false)}>
                <FaTimes />
              </button>
            </div>
            <form className="cafeInventory__form" onSubmit={submitMove}>
              <label>
                Количество ({moveTarget.unit}) *
                <input
                  value={moveQty}
                  onChange={(e) => setMoveQty(e.target.value.replace(",", "."))}
                  required
                />
              </label>
              {moveType === "receive" && (
                <>
                  <label>
                    Цена за ед. (сом) *
                    <input
                      value={movePrice}
                      onChange={(e) =>
                        setMovePrice(e.target.value.replace(",", "."))
                      }
                      required
                      placeholder="Для расхода «Закупки»"
                    />
                  </label>
                  <p className="cafeInventory__hint">
                    Сумма прихода (кол-во × цена) будет записана как расход
                    «Закупки» в аналитике.
                  </p>
                </>
              )}
              <label>
                Комментарий
                <input
                  value={moveNote}
                  onChange={(e) => setMoveNote(e.target.value)}
                />
              </label>
              <div className="cafeInventory__formActions">
                <button type="button" onClick={() => setMoveOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className="cafeInventory__btn cafeInventory__btn--primary">
                  {moveType === "receive" ? "Оприходовать" : "Списать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sessionModalOpen && (
        <div
          className="cafeInventory__modalOverlay"
          onClick={() => setSessionModalOpen(false)}
        >
          <div
            className="cafeInventory__modal cafeInventory__modal--wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cafeInventory__modalHeader">
              <h3>Новый акт инвентаризации</h3>
              <button type="button" onClick={() => setSessionModalOpen(false)}>
                <FaTimes />
              </button>
            </div>
            <form className="cafeInventory__form" onSubmit={saveSession}>
              <label>
                Комментарий
                <input
                  value={sessionForm.comment}
                  onChange={(e) =>
                    setSessionForm((f) => ({ ...f, comment: e.target.value }))
                  }
                />
              </label>
              <div className="cafeInventory__sessionLines">
                {sessionForm.lines.map((ln) => (
                  <div key={ln.item} className="cafeInventory__sessionLine">
                    <span>{ln.title}</span>
                    <input
                      value={ln.qty_counted}
                      onChange={(e) => updateSessionLine(ln.item, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div className="cafeInventory__formActions">
                <button type="button" onClick={() => setSessionModalOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className="cafeInventory__btn cafeInventory__btn--primary">
                  Создать черновик
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewSessionOpen && viewSession && (
        <div
          className="cafeInventory__modalOverlay"
          onClick={() => setViewSessionOpen(false)}
        >
          <div
            className="cafeInventory__modal cafeInventory__modal--wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cafeInventory__modalHeader">
              <h3>Акт инвентаризации</h3>
              <button type="button" onClick={() => setViewSessionOpen(false)}>
                <FaTimes />
              </button>
            </div>
            <p className="cafeInventory__meta">{viewSession.comment || "—"}</p>
            <div className="cafeInventory__sessionLines">
              {(viewSession.items || viewSession.lines || []).map((ln, idx) => (
                <div key={ln.id || ln.item || idx} className="cafeInventory__sessionLine">
                  <span>
                    {ln.item_title || ln.title || ln.item}
                  </span>
                  <span>
                    учёт {toNum(ln.qty_book ?? ln.expected_qty)} → факт{" "}
                    {toNum(ln.qty_counted ?? ln.actual_qty)}
                  </span>
                </div>
              ))}
            </div>
            {String(viewSession.status || "").toLowerCase() === "draft" && (
              <div className="cafeInventory__formActions">
                <button
                  type="button"
                  className="cafeInventory__btn cafeInventory__btn--primary"
                  onClick={() => setConfirmSessionId(viewSession.id)}
                >
                  Провести
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmSessionId && (
        <div
          className="cafeInventory__modalOverlay"
          onClick={() => !confirmBusy && setConfirmSessionId(null)}
        >
          <div className="cafeInventory__modal" onClick={(e) => e.stopPropagation()}>
            <p>Провести акт? Остатки будут скорректированы по факту.</p>
            <div className="cafeInventory__formActions">
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => setConfirmSessionId(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="cafeInventory__btn cafeInventory__btn--primary"
                disabled={confirmBusy}
                onClick={confirmSession}
              >
                {confirmBusy ? "Проведение…" : "Провести"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HouseholdInventoryTab;
