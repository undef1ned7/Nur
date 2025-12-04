import {
  money,
  getDebtStatus,
  fmtDateTime,
  toYMD,
} from "../helpers";

export const DebtsTable = ({
  loading,
  items,
  confirmId,
  onAskDelete,
  onCancelDelete,
  onDelete,
  onOpenPay,
  onOpenEdit,
}) => {
  return (
    <div style={{ overflow: "auto" }}>
      <table className="catalog__table">
        <thead>
          <tr>
            <th>Имя</th>
            <th>Телефон</th>
            <th>Долг</th>
            <th>Срок возврата</th>
            <th>Статус</th>
            <th>Создан</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} style={{ padding: 16, color: "#6b7280" }}>
                Загрузка…
              </td>
            </tr>
          ) : items.length ? (
            items.map((x) => {
              const debtStatus = getDebtStatus(x.due_date);
              return (
                <tr
                  key={x.id}
                  style={{
                    backgroundColor:
                      debtStatus.status === "overdue"
                        ? "#fef2f2"
                        : debtStatus.status === "due-today"
                        ? "#fff7ed"
                        : debtStatus.status === "due-tomorrow"
                        ? "#fffbeb"
                        : "transparent",
                  }}
                >
                  <td data-label="Имя">{x.name}</td>
                  <td data-label="Телефон">{x.phone}</td>
                  <td data-label="Долг">
                    {money(
                      x.balance != null
                        ? x.balance
                        : x.amount
                    )}
                  </td>
                  <td data-label="Срок возврата">
                    {x.due_date ? toYMD(new Date(x.due_date)) : "—"}
                  </td>
                  <td data-label="Статус">
                    <span
                      style={{
                        color: debtStatus.color,
                        fontWeight: "bold",
                        fontSize: "12px",
                      }}
                    >
                      {debtStatus.text}
                    </span>
                  </td>
                  <td data-label="Создан">{fmtDateTime(x.created_at)}</td>
                  <td data-label="Действия">
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        className="catalog__btn catalog__btn--secondary"
                        onClick={() => onOpenPay(x.id)}
                        title="Оплатить (уменьшить сумму)"
                      >
                        Оплатить
                      </button>
                      <button
                        className="catalog__btn catalog__btn--secondary"
                        onClick={() => onOpenEdit(x)}
                        title="Изменить"
                      >
                        Изменить
                      </button>

                      {confirmId === x.id ? (
                        <>
                          <button
                            className="catalog__btn catalog__btn--danger"
                            onClick={() => onDelete(x.id)}
                          >
                            Да, удалить
                          </button>
                          <button
                            className="catalog__btn"
                            onClick={onCancelDelete}
                          >
                            Нет
                          </button>
                        </>
                      ) : (
                        <button
                          className="catalog__btn"
                          onClick={() => onAskDelete(x.id)}
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7} style={{ padding: 16, color: "#6b7280" }}>
                Ничего не найдено
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
