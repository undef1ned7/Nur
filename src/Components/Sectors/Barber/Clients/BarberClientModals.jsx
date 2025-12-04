// BarberClientModals.jsx
import React, { useState, useMemo } from "react";
import { FaTimes, FaTrash } from "react-icons/fa";

export const BarberClientModals = ({
  modalOpen,
  confirmOpen,
  historyOpen,
  currentClient,
  historyClient,
  historyList,
  clientAlerts,
  formErrors,
  saving,
  deleting,
  statusOptions,
  onCloseModal,
  onSubmit,
  onOpenConfirm,
  onCloseConfirm,
  onConfirmDelete,
  onCloseHistory,
  fmtMoney,
  servicesById,
}) => {
  // услуги по записи (новый формат: несколько услуг)
  const buildServicesForAppt = (a) => {
    if (!a) return [];

    const items = [];

    // 1) services_names + services_ids
    if (Array.isArray(a.services_names) && a.services_names.length) {
      a.services_names.forEach((name, idx) => {
        const rawId = Array.isArray(a.services) ? a.services[idx] : null;
        const svcFromMap =
          (servicesById?.get && servicesById.get(rawId)) ||
          (servicesById?.get && servicesById.get(String(rawId))) ||
          null;

        items.push({
          id: rawId ?? `name-${idx}`,
          name: name || svcFromMap?.service_name || svcFromMap?.name || "—",
          price:
            svcFromMap?.price ??
            (Array.isArray(a.services_prices)
              ? a.services_prices[idx]
              : null),
        });
      });
    } else if (Array.isArray(a.services) && a.services.length) {
      // 2) просто массив id услуг
      a.services.forEach((rawId, idx) => {
        const svcFromMap =
          (servicesById?.get && servicesById.get(rawId)) ||
          (servicesById?.get && servicesById.get(String(rawId))) ||
          null;

        items.push({
          id: rawId ?? `svc-${idx}`,
          name:
            svcFromMap?.service_name ||
            svcFromMap?.name ||
            a.service_name ||
            `#${rawId}`,
          price:
            svcFromMap?.price ??
            (Array.isArray(a.services_prices)
              ? a.services_prices[idx]
              : null),
        });
      });
    } else if (a.service_name || a.service || a.service_obj) {
      // 3) старый формат: одна услуга
      const rawId = a.service || a.service_obj?.id || "single";
      const svcFromMap =
        (servicesById?.get && servicesById.get(rawId)) ||
        (servicesById?.get && servicesById.get(String(rawId))) ||
        null;

      items.push({
        id: rawId,
        name:
          a.service_name ||
          a.service_obj?.service_name ||
          a.service_obj?.name ||
          svcFromMap?.service_name ||
          svcFromMap?.name ||
          "—",
        price:
          a.service_price ??
          a.price ??
          a.service_obj?.price ??
          svcFromMap?.price ??
          null,
      });
    }

    if (!items.length) {
      return [
        {
          id: "empty",
          name: "—",
          price: null,
        },
      ];
    }
    return items;
  };

  const formatDiscount = (value) => {
    if (value === null || value === undefined || value === "") {
      return "—";
    }
    const num = Number(value);
    if (!Number.isFinite(num)) return "—";
    return `${num}%`;
  };

  /* ===== поиск по истории ===== */
  const [historyQuery, setHistoryQuery] = useState("");

  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return historyList;

    return historyList.filter((a) => {
      const barber =
        (a.barber_name ||
          (a.barber ? `ID ${a.barber}` : "") ||
          "")?.toLowerCase() || "";

      const servicesText = buildServicesForAppt(a)
        .map((svc) => svc.name || "")
        .join(" ")
        .toLowerCase();

      const dateStr = a.start_at ? new Date(a.start_at).toISOString() : "";

      return (
        barber.includes(q) ||
        servicesText.includes(q) ||
        dateStr.includes(q)
      );
    });
  }, [historyList, historyQuery]);

  return (
    <>
      {/* форма клиента */}
      {modalOpen && !confirmOpen && (
        <div
          className="barberclient__modalOverlay"
          onClick={onCloseModal}
        >
          <div
            className="barberclient__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="barberclient__modalHeader">
              <h3 className="barberclient__modalTitle">
                {currentClient ? "Редактировать клиента" : "Новый клиент"}
              </h3>
              <button
                className="barberclient__iconBtn"
                onClick={onCloseModal}
                aria-label="Закрыть"
                type="button"
              >
                <FaTimes />
              </button>
            </div>

            {Array.isArray(clientAlerts) && clientAlerts.length > 0 && (
              <div className="barberclient__alert">
                {clientAlerts.length === 1 ? (
                  clientAlerts[0]
                ) : (
                  <ul className="barberclient__alert-list">
                    {clientAlerts.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <form
              className="barberclient__form"
              onSubmit={onSubmit}
              noValidate
            >
              <div className="barberclient__formGrid">
                <div
                  className={`barberclient__field ${
                    formErrors.fullName ? "barberclient__field--invalid" : ""
                  }`}
                >
                  <label
                    htmlFor="fullName"
                    className="barberclient__label"
                  >
                    ФИО <span className="barberclient__req">*</span>
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    className={`barberclient__input ${
                      formErrors.fullName
                        ? "barberclient__input--invalid"
                        : ""
                    }`}
                    defaultValue={currentClient?.fullName || ""}
                    placeholder="Фамилия Имя Отчество"
                    autoFocus
                  />
                </div>

                <div
                  className={`barberclient__field ${
                    formErrors.phone ? "barberclient__field--invalid" : ""
                  }`}
                >
                  <label
                    htmlFor="phone"
                    className="barberclient__label"
                  >
                    Телефон <span className="barberclient__req">*</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    className={`barberclient__input ${
                      formErrors.phone
                        ? "barberclient__input--invalid"
                        : ""
                    }`}
                    defaultValue={currentClient?.phone || ""}
                    placeholder="+996 ..."
                    inputMode="tel"
                  />
                </div>

                <div
                  className={`barberclient__field ${
                    formErrors.birthDate
                      ? "barberclient__field--invalid"
                      : ""
                  }`}
                >
                  <label
                    htmlFor="birthDate"
                    className="barberclient__label"
                  >
                    Дата рождения
                  </label>
                  <input
                    id="birthDate"
                    name="birthDate"
                    className={`barberclient__input ${
                      formErrors.birthDate
                        ? "barberclient__input--invalid"
                        : ""
                    }`}
                    defaultValue={currentClient?.birthDate || ""}
                    type="date"
                  />
                </div>

                <div
                  className={`barberclient__field ${
                    formErrors.status ? "barberclient__field--invalid" : ""
                  }`}
                >
                  <label
                    htmlFor="status"
                    className="barberclient__label"
                  >
                    Статус
                  </label>
                  <select
                    id="status"
                    name="status"
                    className={`barberclient__input ${
                      formErrors.status
                        ? "barberclient__input--invalid"
                        : ""
                    }`}
                    defaultValue={currentClient?.status || "Активен"}
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="barberclient__field barberclient__field--full">
                  <label
                    htmlFor="notes"
                    className="barberclient__label"
                  >
                    Заметки
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    className="barberclient__textarea"
                    defaultValue={currentClient?.notes || ""}
                    placeholder="Комментарий, пожелания…"
                  />
                </div>
              </div>

              <div className="barberclient__formActions">
                {currentClient?.id ? (
                  <button
                    type="button"
                    className="barberclient__btn barberclient__btn--danger"
                    onClick={onOpenConfirm}
                    disabled={saving || deleting}
                    title="Удалить клиента"
                  >
                    <FaTrash />
                    <span className="barberclient__btn-label">
                      {deleting ? "Удаление…" : "Удалить"}
                    </span>
                  </button>
                ) : (
                  <span className="barberclient__actionsSpacer" />
                )}

                <div className="barberclient__actionsRight">
                  <button
                    type="button"
                    className="barberclient__btn barberclient__btn--secondary"
                    onClick={onCloseModal}
                    disabled={saving || deleting}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={saving || deleting}
                    className="barberclient__btn barberclient__btn--primary"
                  >
                    {saving ? "Сохранение…" : "Сохранить"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* подтверждение удаления */}
      {confirmOpen && (
        <div
          className="barberclient__confirmOverlay"
          onClick={onCloseConfirm}
        >
          <div
            className="barberclient__confirm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="barberclient__confirm-title">
              Удалить клиента?
            </div>
            <div className="barberclient__confirm-text">
              Действие необратимо. Клиент «
              {currentClient?.fullName || "—"}» будет удалён.
            </div>
            <div className="barberclient__confirm-actions">
              <button
                className="barberclient__btn barberclient__btn--danger"
                onClick={onConfirmDelete}
                disabled={deleting}
                type="button"
              >
                {deleting ? "Удаление…" : "Удалить"}
              </button>
              <button
                className="barberclient__btn barberclient__btn--secondary"
                onClick={onCloseConfirm}
                disabled={deleting}
                type="button"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* история клиента */}
      {historyOpen && (
        <div
          className="barberclient__modalOverlay"
          onClick={onCloseHistory}
        >
          <div
            className="barberclient__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="barberclient__modalHeader">
              <h3 className="barberclient__modalTitle">
                История — {historyClient?.fullName}
              </h3>
              <button
                className="barberclient__iconBtn"
                onClick={onCloseHistory}
                aria-label="Закрыть"
                type="button"
              >
                <FaTimes />
              </button>
            </div>

            <div className="barberclient__form" style={{ marginTop: 0 }}>
              {historyList.length === 0 ? (
                <div className="barberclient__meta">Записей нет</div>
              ) : (
                <>
                  {/* поиск, как на скрине */}
                  <div className="barberclient__historySearch">
                    <input
                      className="barberclient__historySearch-input"
                      type="text"
                      placeholder="Поиск..."
                      value={historyQuery}
                      onChange={(e) => setHistoryQuery(e.target.value)}
                    />
                  </div>

                  <div className="barberclient__history">
                    <table className="barberclient__historyTable">
                      <thead className="barberclient__historyHead">
                        <tr className="barberclient__historyRow">
                          <th className="barberclient__historyCell barberclient__historyCell--head">
                            Дата
                          </th>
                          <th className="barberclient__historyCell barberclient__historyCell--head">
                            Сотрудник
                          </th>
                          <th className="barberclient__historyCell barberclient__historyCell--head">
                            Услуги
                          </th>
                          <th className="barberclient__historyCell barberclient__historyCell--head barberclient__historyCell--right">
                            Цена
                          </th>
                          <th className="barberclient__historyCell barberclient__historyCell--head barberclient__historyCell--center">
                            Скидка
                          </th>
                          <th className="barberclient__historyCell barberclient__historyCell--head barberclient__historyCell--right">
                            Итого
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.length === 0 ? (
                          <tr>
                            <td
                              className="barberclient__historyCell barberclient__historyCell--muted"
                              colSpan={6}
                            >
                              Ничего не найдено
                            </td>
                          </tr>
                        ) : (
                          filteredHistory.map((a) => {
                            const date = a.start_at
                              ? new Date(a.start_at)
                              : null;
                            const dateStr = date
                              ? `${date.getFullYear()}-${String(
                                  date.getMonth() + 1
                                ).padStart(2, "0")}-${String(
                                  date.getDate()
                                ).padStart(2, "0")}`
                              : "—";
                            const timeStr = date
                              ? `${String(date.getHours()).padStart(
                                  2,
                                  "0"
                                )}:${String(date.getMinutes()).padStart(
                                  2,
                                  "0"
                                )}`
                              : "—";

                            const barber =
                              a.barber_name ||
                              (a.barber ? `ID ${a.barber}` : "—");

                            const servicesList = buildServicesForAppt(a);

                            // сумма цен по услугам — цена до скидки
                            const subtotal = servicesList.reduce(
                              (sum, svc) =>
                                sum +
                                (Number.isFinite(Number(svc.price))
                                  ? Number(svc.price)
                                  : 0),
                              0
                            );

                            const discountNum = Number(a.discount);
                            const hasDiscount = Number.isFinite(discountNum);
                            const discountStr = formatDiscount(a.discount);

                            // итог, который сохранялся в записи
                            let totalVal =
                              a.price ??
                              a.service_price ??
                              null;

                            // если итога нет, посчитаем из subtotal и скидки
                            if (
                              (totalVal === null || totalVal === undefined) &&
                              subtotal > 0
                            ) {
                              if (hasDiscount) {
                                totalVal = Math.round(
                                  subtotal * (1 - discountNum / 100)
                                );
                              } else {
                                totalVal = subtotal;
                              }
                            }

                            // цена до скидки
                            const basePriceVal =
                              subtotal > 0 ? subtotal : totalVal;

                            return (
                              <tr
                                key={a.id}
                                className="barberclient__historyRow"
                              >
                                <td className="barberclient__historyCell barberclient__historyCell--muted">
                                  {dateStr} {timeStr}
                                </td>
                                <td className="barberclient__historyCell">
                                  {barber}
                                </td>
                                <td className="barberclient__historyCell">
                                  <div className="barberclient__historyServices">
                                    {servicesList.map((svc) => (
                                      <div
                                        key={svc.id}
                                        className="barberclient__historyService"
                                      >
                                        <span className="barberclient__historyServiceName">
                                          {svc.name}
                                        </span>
                                        {svc.price !== null &&
                                          svc.price !== undefined && (
                                            <span className="barberclient__historyServicePrice">
                                              {fmtMoney(svc.price)}
                                            </span>
                                          )}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td className="barberclient__historyCell barberclient__historyCell--right">
                                  {fmtMoney(basePriceVal)}
                                </td>
                                <td className="barberclient__historyCell barberclient__historyCell--center barberclient__historyCell--muted">
                                  {discountStr}
                                </td>
                                <td className="barberclient__historyCell barberclient__historyCell--right">
                                  {fmtMoney(totalVal)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="barberclient__formActions">
                <button
                  type="button"
                  className="barberclient__btn barberclient__btn--secondary"
                  onClick={onCloseHistory}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BarberClientModals;
