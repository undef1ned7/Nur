const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("ru-RU");
};

/** Компактный переключатель: input type=checkbox с ролью switch и подписью справа. */
const Switch = ({ checked, disabled, onChange, label }) => (
  <label className="warehouse-partnership-switch">
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="warehouse-partnership-switch__track" aria-hidden="true" />
    <span className="warehouse-partnership-switch__label">{label}</span>
  </label>
);

/**
 * Активные партнёры. Управление (разрыв, «забирать без подтверждения»)
 * показываем, только если бэк отдаёт partnership_id — на старом бэке этих
 * эндпоинтов нет. Настройку «ваши продажи видны партнёру» — если бэк
 * отдаёт share_sales_history.
 */
const PartnersTable = ({
  rows,
  loading,
  busyId,
  onOpenCatalog,
  onOpenAnalytics,
  onOpenSales,
  onTerminate,
  onUpdateSettings,
}) => {
  const hasManagement = rows.some((p) => p.partnership_id != null);
  const hasSalesSharing = rows.some((p) => typeof p.share_sales_history === "boolean");
  const colSpan = 3 + (hasManagement ? 2 : 0) + (hasSalesSharing ? 1 : 0);

  return (
    <div className="warehouse-table-container w-full warehouse-partnership-partners-table">
      <div className="warehouse-table-scroll">
        <table className="warehouse-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Компания</th>
              {hasManagement && <th>Партнёр с</th>}
              {hasManagement && <th>Забирать у вас</th>}
              {hasSalesSharing && <th>Ваши продажи</th>}
              <th className="warehouse-partnership-actions-col">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="warehouse-table__loading">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="warehouse-table__empty">
                  Нет активных партнёров — пригласите компанию кнопкой «Пригласить»
                </td>
              </tr>
            ) : (
              rows.map((p, idx) => {
                const managed = p.partnership_id != null;
                const busy = busyId === p.id;
                const salesHidden = p.partner_shares_sales_history === false;
                return (
                  <tr key={p.id}>
                    <td>{idx + 1}</td>
                    <td className="warehouse-table__name">{p.name || "—"}</td>
                    {hasManagement && <td className="warehouse-partnership-nowrap">{managed ? fmtDate(p.since) : "—"}</td>}
                    {hasManagement && (
                      <td>
                        {managed ? (
                          <Switch
                            checked={Boolean(p.allow_direct_pull)}
                            disabled={busy}
                            onChange={(checked) =>
                              onUpdateSettings(p, { allow_direct_pull: checked })
                            }
                            label={p.allow_direct_pull ? "Без подтверждения" : "С подтверждением"}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                    {hasSalesSharing && (
                      <td>
                        {typeof p.share_sales_history === "boolean" ? (
                          <Switch
                            checked={p.share_sales_history}
                            disabled={busy}
                            onChange={(checked) =>
                              onUpdateSettings(p, { share_sales_history: checked })
                            }
                            label={p.share_sales_history ? "Видны партнёру" : "Скрыты"}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                    <td className="warehouse-partnership-actions-col">
                      <div className="warehouse-partnership-row-actions warehouse-partnership-row-actions--nowrap">
                        <button
                          type="button"
                          className="warehouse-partnership-action warehouse-partnership-action--primary"
                          onClick={() => onOpenCatalog(p)}
                        >
                          Обмен товарами
                        </button>
                        <button
                          type="button"
                          className="warehouse-partnership-action warehouse-partnership-action--secondary"
                          onClick={() => onOpenAnalytics(p)}
                        >
                          Аналитика
                        </button>
                        <button
                          type="button"
                          className="warehouse-partnership-action warehouse-partnership-action--secondary"
                          onClick={() => onOpenSales(p)}
                          disabled={salesHidden}
                          title={salesHidden ? "Партнёр скрыл свою историю продаж" : "История продаж партнёра"}
                        >
                          Продажи
                        </button>
                        {managed && (
                          <button
                            type="button"
                            className="warehouse-partnership-action warehouse-partnership-action--danger"
                            onClick={() => onTerminate(p)}
                            disabled={busy}
                          >
                            Разорвать
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PartnersTable;
