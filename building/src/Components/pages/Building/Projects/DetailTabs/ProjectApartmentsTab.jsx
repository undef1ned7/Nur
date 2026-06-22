import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import Modal from "@/Components/common/Modal/Modal";
import buildingAPI from "@/api/building";
import { useBuildingApartments } from "@/store/slices/building/apartmentsSlice";
import {
  fetchBuildingApartments,
  createBuildingApartment,
  updateBuildingApartment,
  deleteBuildingApartment,
  fetchBuildingResidentialFloors,
} from "@/store/creators/building/apartmentsCreators";
import { getPageCount, DEFAULT_PAGE_SIZE } from "../../shared/api";
import BuildingPagination from "../../shared/Pagination";
import { validateResErrors } from "../../../../../../tools/validateResErrors";

const APARTMENT_INITIAL = {
  floor: "",
  block: "",
  number: "",
  rooms: "",
  area: "",
  price: "",
  status: "available",
  notes: "",
};

const APARTMENT_STATUS_LABELS = {
  available: "Доступна",
  reserved: "Забронирована",
  sold: "Продана",
};

export default function ProjectApartmentsTab({ residentialId }) {
  const dispatch = useDispatch();
  const alert = useAlert();
  const confirm = useConfirm();

  const {
    list,
    count,
    loading,
    error,
    creating,
    floors,
    actionError,
  } = useBuildingApartments();

  const [page, setPage] = useState(1);
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(APARTMENT_INITIAL);
  const [formError, setFormError] = useState(null);
  const [blockFilter, setBlockFilter] = useState("");
  const [blockStats, setBlockStats] = useState([]);
  const [blockStatsLoading, setBlockStatsLoading] = useState(false);

  const totalPages = useMemo(
    () => getPageCount(count, DEFAULT_PAGE_SIZE),
    [count],
  );

  const { floorRows, maxApartments } = useMemo(() => {
    const listArr = Array.isArray(list) ? list : [];
    const byFloor = {};
    listArr.forEach((apt) => {
      const f = String(apt?.floor ?? "").trim() || "—";
      if (!byFloor[f]) byFloor[f] = [];
      byFloor[f].push(apt);
    });
    const sortedFloors = Object.keys(byFloor).sort((a, b) => {
      const na = a === "—" ? Infinity : Number(a);
      const nb = b === "—" ? Infinity : Number(b);
      return (Number.isNaN(na) ? Infinity : na) - (Number.isNaN(nb) ? Infinity : nb);
    });
    const rows = sortedFloors.map((f) => ({
      floor: f,
      apartments: [...byFloor[f]].sort(
        (a, b) => Number(a?.number ?? 0) - Number(b?.number ?? 0),
      ),
    }));
    const max = Math.max(1, ...rows.map((r) => r.apartments.length));
    return { floorRows: rows, maxApartments: max };
  }, [list]);

  useEffect(() => {
    if (!residentialId) return;
    dispatch(fetchBuildingResidentialFloors(residentialId));
  }, [dispatch, residentialId]);

  useEffect(() => {
    if (!residentialId) return;
    dispatch(
      fetchBuildingApartments({
        residential_complex: residentialId,
        block: blockFilter || undefined,
        page,
        page_size: DEFAULT_PAGE_SIZE,
      }),
    );
  }, [dispatch, residentialId, page, blockFilter]);

  useEffect(() => {
    if (!residentialId) return;
    let cancelled = false;
    setBlockStatsLoading(true);
    buildingAPI
      .getBuildingBlocksStats(residentialId)
      .then((data) => {
        if (!cancelled) {
          setBlockStats(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {
        if (!cancelled) setBlockStats([]);
      })
      .finally(() => {
        if (!cancelled) setBlockStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [residentialId]);

  const availableBlocks = useMemo(() => {
    const values = new Set();
    (Array.isArray(blockStats) ? blockStats : []).forEach((item) => {
      if (item?.block) values.add(String(item.block));
    });
    (Array.isArray(list) ? list : []).forEach((item) => {
      if (item?.block) values.add(String(item.block));
    });
    return Array.from(values);
  }, [blockStats, list]);

  const handleFormChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...APARTMENT_INITIAL,
      floor: floors?.[0]?.floor ?? "",
    });
    setFormError(null);
    setOpenModal(true);
  };

  const openEdit = (apartment) => {
    setEditing(apartment);
    setForm({
      floor: apartment?.floor ?? "",
      block: apartment?.block ?? "",
      number: apartment?.number ?? "",
      rooms: apartment?.rooms ?? "",
      area: apartment?.area ?? "",
      price: apartment?.price ?? "",
      status: apartment?.status ?? "available",
      notes: apartment?.notes ?? "",
    });
    setFormError(null);
    setOpenModal(true);
  };

  const closeModal = () => {
    setOpenModal(false);
    setEditing(null);
    setForm(APARTMENT_INITIAL);
    setFormError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!residentialId) return;
    if (!String(form.number || "").trim()) {
      setFormError("Номер квартиры обязателен");
      return;
    }
    const payload = {
      residential_complex: residentialId,
      floor: form.floor || null,
      block: String(form.block || "").trim() || null,
      number: String(form.number || "").trim(),
      rooms: form.rooms || null,
      area: form.area || null,
      price: form.price || null,
      status: form.status || "available",
      notes: form.notes || "",
    };
    try {
      let res;
      if (editing) {
        const aptId = editing?.id ?? editing?.uuid;
        if (!aptId) return;
        res = await dispatch(
          updateBuildingApartment({ id: aptId, payload }),
        );
      } else {
        res = await dispatch(createBuildingApartment(payload));
      }
      if (res.meta.requestStatus === "fulfilled") {
        alert(editing ? "Квартира обновлена" : "Квартира добавлена");
        closeModal();
        setPage(1);
        dispatch(
          fetchBuildingApartments({
            residential_complex: residentialId,
            block: blockFilter || undefined,
            page: 1,
            page_size: DEFAULT_PAGE_SIZE,
          }),
        );
        dispatch(fetchBuildingResidentialFloors(residentialId));
      } else {
        setFormError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось сохранить квартиру",
          ),
        );
      }
    } catch (err) {
      setFormError(
        validateResErrors(err, "Не удалось сохранить квартиру"),
      );
    }
  };

  const handleDelete = (apartment) => {
    const aptId = apartment?.id ?? apartment?.uuid;
    if (!aptId) return;
    confirm(
      `Удалить квартиру «${apartment?.number || "квартира"}»?`,
      async (ok) => {
        if (!ok) return;
        try {
          const res = await dispatch(deleteBuildingApartment(aptId));
          if (res.meta.requestStatus === "fulfilled") {
            alert("Квартира удалена");
            dispatch(
              fetchBuildingApartments({
                residential_complex: residentialId,
                block: blockFilter || undefined,
                page,
                page_size: DEFAULT_PAGE_SIZE,
              }),
            );
            dispatch(fetchBuildingResidentialFloors(residentialId));
          } else {
            alert(
              validateResErrors(
                res.payload || res.error,
                "Не удалось удалить квартиру",
              ),
              true,
            );
          }
        } catch (err) {
          alert(validateResErrors(err, "Не удалось удалить квартиру"), true);
        }
      },
    );
  };

  if (!residentialId) {
    return (
      <div className="building-page__card">
        <div className="building-page__muted">ЖК не выбран.</div>
      </div>
    );
  }

  return (
    <div className="building-page__card building-page__card--sell-table">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <h3 className="building-page__cardTitle">Квартиры</h3>
        <button
          type="button"
          className="building-btn building-btn--primary"
          onClick={openCreate}
        >
          Добавить квартиру
        </button>
      </div>
      <div className="building-sell-legend" style={{ marginBottom: 16 }}>
        <span className="building-sell-legend__item building-sell-legend__item--available">
          Доступна
        </span>
        <span className="building-sell-legend__item building-sell-legend__item--reserved">
          Забронирована
        </span>
        <span className="building-sell-legend__item building-sell-legend__item--sold">
          Продана
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <label style={{ minWidth: 240 }}>
          <div className="building-page__label">Фильтр по блоку</div>
          <select
            className="building-page__select"
            value={blockFilter}
            onChange={(e) => {
              setBlockFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Все блоки</option>
            {availableBlocks.map((block) => (
              <option key={block} value={block}>
                {block}
              </option>
            ))}
          </select>
        </label>
        {blockStatsLoading ? (
          <div className="building-page__muted">Загрузка статистики по блокам...</div>
        ) : blockStats.length > 0 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
            {blockStats.map((item) => (
              <button
                key={item?.block || "no-block"}
                type="button"
                className="building-page__card"
                style={{
                  minWidth: 180,
                  textAlign: "left",
                  border:
                    blockFilter === item?.block
                      ? "1px solid #0284c7"
                      : "1px solid rgba(11, 35, 68, 0.08)",
                }}
                onClick={() => {
                  setBlockFilter((prev) =>
                    prev === item?.block ? "" : item?.block || "",
                  );
                  setPage(1);
                }}
              >
                <div style={{ fontWeight: 700 }}>{item?.block || "Без блока"}</div>
                <div className="building-page__muted">
                  Всего: {item?.total ?? 0} | Доступно: {item?.available ?? 0}
                </div>
                <div className="building-page__muted">
                  Бронь: {item?.reserved ?? 0} | Продано: {item?.sold ?? 0}
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {!loading && list.length > 0 && (
        <div className="building-sell-plan-wrap">
          <div className="building-sell-plan building-table">
            <table>
              <thead>
                <tr>
                  <th className="building-sell-plan__floorCol">Этаж</th>
                  <th
                    className="building-sell-plan__aptCol"
                    colSpan={maxApartments}
                  >
                    Квартиры
                  </th>
                </tr>
              </thead>
              <tbody>
                {floorRows.map((row) => (
                  <tr key={row.floor}>
                    <td className="building-sell-plan__floorCol">
                      {row.floor}
                    </td>
                    {Array.from({ length: maxApartments }, (_, i) => {
                      const apt = row.apartments[i] ?? null;
                      if (!apt) {
                        return (
                          <td
                            key={`empty-${row.floor}-${i}`}
                            className="building-sell-plan__aptCol building-sell-plan__cell--empty"
                          />
                        );
                      }
                      const statusMod =
                        apt?.status === "sold"
                          ? "building-sell-plan__cell--sold"
                          : apt?.status === "reserved"
                            ? "building-sell-plan__cell--reserved"
                            : "building-sell-plan__cell--available";
                      return (
                        <td
                          key={apt?.id ?? apt?.uuid ?? i}
                          className={`building-sell-plan__aptCol building-sell-plan__cell ${statusMod} building-sell-plan__cell--clickable`}
                          role="button"
                          tabIndex={0}
                          onClick={() => openEdit(apt)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openEdit(apt);
                            }
                          }}
                          title="Изменить квартиру"
                        >
                          <div className="building-sell-plan__cellInner">
                            <span className="building-sell-plan__aptNum">
                              {apt?.number ?? "—"}
                            </span>
                            {apt?.block && (
                              <span
                                style={{
                                  display: "block",
                                  marginTop: 4,
                                  fontSize: 11,
                                  opacity: 0.8,
                                }}
                              >
                                {apt.block}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {error && (
        <div className="building-page__error">
          {String(
            validateResErrors(error, "Не удалось загрузить список квартир"),
          )}
        </div>
      )}
      {loading && (
        <div className="building-page__muted">Загрузка квартир...</div>
      )}
      {!loading && list.length === 0 && (
        <div className="building-page__muted">
          Квартиры ещё не добавлены.
        </div>
      )}
      <BuildingPagination
        page={page}
        totalPages={totalPages}
        disabled={loading}
        onChange={setPage}
      />
      {actionError && (
        <div className="building-page__error" style={{ marginTop: 8 }}>
          {String(
            validateResErrors(
              actionError,
              "Ошибка при сохранении/удалении квартиры",
            ),
          )}
        </div>
      )}

      <Modal
        open={openModal}
        onClose={closeModal}
        title={editing ? "Изменить квартиру" : "Добавить квартиру"}
      >
        <form className="building-page" onSubmit={handleSubmit}>
          <label>
            <div className="building-page__label">Этаж</div>
            <input
              className="building-page__input"
              value={form.floor}
              onChange={handleFormChange("floor")}
              type="number"
            />
          </label>
          <label>
            <div className="building-page__label">Блок</div>
            <input
              className="building-page__input"
              value={form.block}
              onChange={handleFormChange("block")}
              placeholder="Блок А / Подъезд 1 / Секция 2"
            />
          </label>
          <label>
            <div className="building-page__label">Номер квартиры</div>
            <input
              className="building-page__input"
              value={form.number}
              onChange={handleFormChange("number")}
              required
            />
          </label>
          <label>
            <div className="building-page__label">Комнат</div>
            <input
              className="building-page__input"
              value={form.rooms}
              onChange={handleFormChange("rooms")}
              type="number"
              min={0}
            />
          </label>
          <label>
            <div className="building-page__label">Площадь, м²</div>
            <input
              className="building-page__input"
              value={form.area}
              onChange={handleFormChange("area")}
              type="number"
              min={0}
              step="0.01"
            />
          </label>
          <label>
            <div className="building-page__label">Цена</div>
            <input
              className="building-page__input"
              value={form.price}
              onChange={handleFormChange("price")}
              type="number"
              min={0}
              step="0.01"
            />
          </label>
          <label>
            <div className="building-page__label">Статус</div>
            <select
              className="building-page__select"
              value={form.status}
              onChange={handleFormChange("status")}
            >
              {Object.entries(APARTMENT_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="building-page__label">Примечание</div>
            <textarea
              className="building-page__textarea"
              rows={3}
              value={form.notes}
              onChange={handleFormChange("notes")}
            />
          </label>
          {formError && (
            <div className="building-page__error">{String(formError)}</div>
          )}
          <div className="building-page__actions">
            <button
              type="button"
              className="building-btn"
              onClick={closeModal}
              disabled={creating}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="building-btn building-btn--primary"
              disabled={creating}
            >
              {creating ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
