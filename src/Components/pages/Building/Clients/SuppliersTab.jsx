import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { asDateTime } from "../shared/constants";
import {
  fetchBuildingSuppliers,
  deleteBuildingSupplier,
} from "@/store/creators/building/suppliersCreators";
import { useBuildingSuppliers } from "@/store/slices/building/suppliersSlice";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { LayoutGrid, Table2 } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { useConfirm } from "@/hooks/useDialog";
import BuildingActionsMenu from "../shared/ActionsMenu";

const VIEW_MODES = {
  TABLE: "table",
  CARDS: "cards",
};

export default function SuppliersTab() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { selectedProjectId } = useBuildingProjects();
  const {
    list: items,
    loading,
    error,
    deletingId,
  } = useBuildingSuppliers();

  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [viewMode, setViewMode] = useState(VIEW_MODES.TABLE);

  const debouncedSearch = useDebouncedValue(search, 400);

  const renderStatus = (status) => {
    if (status === "active") return "Активен";
    if (status === "inactive") return "Отключён";
    return status || "—";
  };

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(
      fetchBuildingSuppliers({
        residential_complex: selectedProjectId,
        search: debouncedSearch.trim() || undefined,
        status: onlyActive ? "active" : undefined,
      }),
    );
  }, [dispatch, selectedProjectId, debouncedSearch, onlyActive]);

  const handleDelete = (supplier) => {
    const id = supplier?.id ?? supplier?.uuid;
    if (!id) return;
    confirm(
      `Удалить поставщика «${supplier?.company_name || "поставщик"}»?`,
      async (ok) => {
        if (!ok) return;
        await dispatch(deleteBuildingSupplier(id));
        dispatch(
          fetchBuildingSuppliers({
            residential_complex: selectedProjectId,
            search: debouncedSearch.trim() || undefined,
            status: onlyActive ? "active" : undefined,
          }),
        );
      },
    );
  };

  if (!selectedProjectId) {
    return (
      <div className="sell-empty-hint">
        <span className="sell-empty-hint__icon">🏢</span>
        <p className="sell-empty-hint__text">
          Выберите ЖК в шапке — откроется список поставщиков по этому объекту.
        </p>
      </div>
    );
  }

  return (
    <div className="sell-card client-detail__section">
      <div className="sell-toolbar clients-toolbar">
        <div className="clients-toolbar__search-wrap">
          <input
            className="clients-toolbar__search"
            value={search}
            placeholder="Поиск по названию, контакту, телефону, email"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="clients-toolbar__meta">
          <div className="clients-toolbar__view">
            <button
              type="button"
              className={`clients-toolbar__viewBtn${
                viewMode === VIEW_MODES.TABLE
                  ? " clients-toolbar__viewBtn--active"
                  : ""
              }`}
              onClick={() => setViewMode(VIEW_MODES.TABLE)}
            >
              <Table2 size={16} style={{ marginRight: 6 }} />
              Таблица
            </button>
            <button
              type="button"
              className={`clients-toolbar__viewBtn${
                viewMode === VIEW_MODES.CARDS
                  ? " clients-toolbar__viewBtn--active"
                  : ""
              }`}
              onClick={() => setViewMode(VIEW_MODES.CARDS)}
            >
              <LayoutGrid size={16} style={{ marginRight: 6 }} />
              Карточки
            </button>
          </div>
          <label className="clients-toolbar__check">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
            />
            Только активные
          </label>
        </div>
      </div>

      {loading && (
        <div className="sell-loading">
          <div className="sell-loading__spinner" />
          <p className="sell-loading__text">Загрузка поставщиков...</p>
        </div>
      )}
      {error && (
        <div className="building-page__error">
          {String(
            validateResErrors(
              error,
              "Не удалось загрузить поставщиков",
            ),
          )}
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="client-detail__empty">
          Поставщики пока не добавлены.
        </div>
      )}
      {!loading && !error && items.length > 0 && (
        <>
          {viewMode === VIEW_MODES.TABLE ? (
            <div className="client-detail__tableWrap">
              <table className="client-detail__table">
                <thead>
                  <tr>
                    <th>Компания</th>
                    <th>Контактное лицо</th>
                    <th>Телефон</th>
                    <th>Email</th>
                    <th>Город</th>
                    <th>Статус</th>
                    <th>Создан</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => {
                    const id = s.id ?? s.uuid;
                    const busy = id != null && deletingId === id;
                    return (
                      <tr
                        key={id}
                        className="client-detail__tableRow"
                        onClick={() =>
                          navigate(`/crm/building/clients/suppliers/${id}`)
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <td>{s.company_name || "—"}</td>
                        <td>
                          {s.contact_person || s.position
                            ? `${s.contact_person || ""}${
                                s.position ? `, ${s.position}` : ""
                              }`
                            : "—"}
                        </td>
                        <td>{s.phone || "—"}</td>
                        <td>{s.email || "—"}</td>
                        <td>{s.city || "—"}</td>
                        <td>{renderStatus(s.status)}</td>
                        <td
                          className="clients-table__actionsCol"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <BuildingActionsMenu
                            actions={[
                              {
                                label: "Открыть",
                                onClick: () =>
                                  navigate(
                                    `/crm/building/clients/suppliers/${id}`,
                                  ),
                                disabled: busy,
                              },
                              {
                                label: "Удалить",
                                onClick: () => handleDelete(s),
                                disabled: busy,
                                danger: true,
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="clients-grid">
              {items.map((s) => {
                const id = s.id ?? s.uuid;
                const busy = id != null && deletingId === id;
                const contact =
                  s.contact_person || s.position
                    ? `${s.contact_person || ""}${
                        s.position ? `, ${s.position}` : ""
                      }`
                    : "—";
                return (
                  <div
                    key={id}
                    className="clients-grid__card"
                    onClick={() =>
                      navigate(`/crm/building/clients/suppliers/${id}`)
                    }
                  >
                    <div className="clients-grid__cardHead">
                      <div className="clients-grid__cardName">
                        {s.company_name || "Без названия"}
                      </div>
                      <div
                        className="clients-grid__cardMeta"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="clients-table__status">
                          {renderStatus(s.status)}
                        </span>
                      </div>
                    </div>
                    <div className="clients-grid__cardBody">
                      <div className="clients-grid__cardRow">
                        <span className="clients-grid__cardLabel">
                          Контакт
                        </span>
                        {contact}
                      </div>
                      <div className="clients-grid__cardRow">
                        <span className="clients-grid__cardLabel">
                          Телефон
                        </span>
                        {s.phone || "—"}
                      </div>
                      <div className="clients-grid__cardRow">
                        <span className="clients-grid__cardLabel">Email</span>
                        {s.email || "—"}
                      </div>
                      {s.city && (
                        <div className="clients-grid__cardRow">
                          <span className="clients-grid__cardLabel">
                            Город
                          </span>
                          {s.city}
                        </div>
                      )}
                      <div className="clients-grid__cardRow">
                        <span className="clients-grid__cardLabel">
                          Создан
                        </span>
                        {asDateTime(s.created_at)}
                      </div>
                    </div>
                    <div
                      className="clients-grid__cardActions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="clients-grid__cardBtn"
                        disabled={busy}
                        onClick={() =>
                          navigate(`/crm/building/clients/suppliers/${id}`)
                        }
                      >
                        Открыть
                      </button>
                      <button
                        type="button"
                        className="clients-grid__cardBtn clients-grid__cardBtn--danger"
                        disabled={busy}
                        onClick={() => handleDelete(s)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

