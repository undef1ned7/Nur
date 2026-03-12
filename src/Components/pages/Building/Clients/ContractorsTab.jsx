import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { asDateTime } from "../shared/constants";
import { useNavigate } from "react-router-dom";
import {
  fetchBuildingContractors,
  deleteBuildingContractor,
} from "@/store/creators/building/contractorsCreators";
import { useBuildingContractors } from "@/store/slices/building/contractorsSlice";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { LayoutGrid, Table2 } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { useConfirm } from "@/hooks/useDialog";
import BuildingActionsMenu from "../shared/ActionsMenu";

const VIEW_MODES = {
  TABLE: "table",
  CARDS: "cards",
};

export default function ContractorsTab() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { selectedProjectId } = useBuildingProjects();
  const {
    list: items,
    loading,
    error,
    deletingId,
  } = useBuildingContractors();

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
      fetchBuildingContractors({
        residential_complex: selectedProjectId,
        search: debouncedSearch.trim() || undefined,
        status: onlyActive ? "active" : undefined,
      }),
    );
  }, [dispatch, selectedProjectId, debouncedSearch, onlyActive]);

  const handleDelete = (contractor) => {
    const id = contractor?.id ?? contractor?.uuid;
    if (!id) return;
    confirm(
      `Удалить подрядчика «${contractor?.company_name || "подрядчик"}»?`,
      async (ok) => {
        if (!ok) return;
        await dispatch(deleteBuildingContractor(id));
        dispatch(
          fetchBuildingContractors({
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
        <span className="sell-empty-hint__icon">👷</span>
        <p className="sell-empty-hint__text">
          Выберите ЖК в шапке — откроется список подрядчиков по этому объекту.
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
            placeholder="Поиск по названию, типу, контакту"
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
          <p className="sell-loading__text">Загрузка подрядчиков...</p>
        </div>
      )}
      {error && (
        <div className="building-page__error">
          {String(
            validateResErrors(
              error,
              "Не удалось загрузить подрядчиков",
            ),
          )}
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="client-detail__empty">
          Подрядчики пока не добавлены.
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
                    <th>Тип</th>
                    <th>Контактное лицо</th>
                    <th>Телефон</th>
                    <th>Город</th>
                    <th>Сотрудников</th>
                    <th>Статус</th>
                    <th>Создан</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => {
                    const id = c.id ?? c.uuid;
                    const busy = id != null && deletingId === id;
                    return (
                      <tr
                        key={id}
                        className="client-detail__tableRow cursor-pointer"
                        onClick={() =>
                          navigate(`/crm/building/clients/contractors/${id}`)
                        }
                      >
                        <td>{c.company_name || "—"}</td>
                        <td>{c.contractor_type || "—"}</td>
                        <td>{c.contact_person || "—"}</td>
                        <td>{c.phone || "—"}</td>
                        <td>{c.city || "—"}</td>
                        <td>{c.employees != null ? c.employees : "—"}</td>
                        <td>{renderStatus(c.status)}</td>
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
                                    `/crm/building/clients/contractors/${id}`,
                                  ),
                                disabled: busy,
                              },
                              {
                                label: "Удалить",
                                onClick: () => handleDelete(c),
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
              {items.map((c) => {
                const id = c.id ?? c.uuid;
                const busy = id != null && deletingId === id;
                return (
                  <div
                    key={id}
                    className="clients-grid__card"
                    onClick={() =>
                      navigate(`/crm/building/clients/contractors/${id}`)
                    }
                  >
                    <div className="clients-grid__cardHead">
                      <div className="clients-grid__cardName">
                        {c.company_name || "Без названия"}
                      </div>
                      <div
                        className="clients-grid__cardMeta"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.status && (
                          <span className="clients-table__status">
                            {renderStatus(c.status)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="clients-grid__cardBody">
                      <div className="clients-grid__cardRow">
                        <span className="clients-grid__cardLabel">Тип</span>
                        {c.contractor_type || "Тип не указан"}
                      </div>
                      <div className="clients-grid__cardRow">
                        <span className="clients-grid__cardLabel">
                          Контакт
                        </span>
                        {c.contact_person || "—"}
                      </div>
                      <div className="clients-grid__cardRow">
                        <span className="clients-grid__cardLabel">
                          Телефон
                        </span>
                        {c.phone || "—"}
                      </div>
                      {c.city && (
                        <div className="clients-grid__cardRow">
                          <span className="clients-grid__cardLabel">
                            Город
                          </span>
                          {c.city}
                        </div>
                      )}
                      <div className="clients-grid__cardRow">
                        <span className="clients-grid__cardLabel">
                          Сотрудников
                        </span>
                        {c.employees != null ? c.employees : "—"}
                      </div>
                      <div className="clients-grid__cardRow">
                        <span className="clients-grid__cardLabel">
                          Создан
                        </span>
                        {asDateTime(c.created_at)}
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
                          navigate(`/crm/building/clients/contractors/${id}`)
                        }
                      >
                        Открыть
                      </button>
                      <button
                        type="button"
                        className="clients-grid__cardBtn clients-grid__cardBtn--danger"
                        disabled={busy}
                        onClick={() => handleDelete(c)}
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

