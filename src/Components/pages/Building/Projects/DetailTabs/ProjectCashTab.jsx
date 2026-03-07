import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAlert } from "@/hooks/useDialog";
import Modal from "@/Components/common/Modal/Modal";
import {
  getBuildingCashboxes,
  getBuildingCashFlows,
  createBuildingCashbox,
  bulkStatusBuildingCashFlows,
} from "@/api/building";
import { updateBuildingProject } from "@/store/creators/building/projectsCreators";
import { validateResErrors } from "../../../../../../tools/validateResErrors";
import { asDateTime } from "../../shared/constants";

const FLOW_TYPE_LABELS = { income: "Приход", expense: "Расход" };
const FLOW_STATUS_LABELS = {
  pending: "На согласовании",
  approved: "Одобрено",
  rejected: "Отклонено",
};

export default function ProjectCashTab({ project, residentialId }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const alert = useAlert();

  const [cashboxes, setCashboxes] = useState([]);
  const [cashboxesLoading, setCashboxesLoading] = useState(false);
  const [cashboxesError, setCashboxesError] = useState(null);
  const [salaryCashboxId, setSalaryCashboxId] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedCashboxId, setSelectedCashboxId] = useState("");
  const [flows, setFlows] = useState([]);
  const [flowsLoading, setFlowsLoading] = useState(false);
  const [selectedFlowIds, setSelectedFlowIds] = useState(new Set());
  const [cashboxModalOpen, setCashboxModalOpen] = useState(false);
  const [cashboxName, setCashboxName] = useState("");
  const [cashboxSubmitting, setCashboxSubmitting] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCashboxesLoading(true);
    getBuildingCashboxes()
      .then((list) => {
        if (!cancelled) {
          setCashboxes(Array.isArray(list) ? list : []);
          const first = Array.isArray(list) ? list[0] : null;
          const firstId = first?.id ?? first?.uuid ?? "";
          if (firstId && !selectedCashboxId) setSelectedCashboxId(firstId);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCashboxesError(
            err?.response?.data || err?.message || "Не удалось загрузить кассы",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCashboxesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (project) setSalaryCashboxId(project.salary_cashbox ?? "");
  }, [project]);

  useEffect(() => {
    if (project?.salary_cashbox && cashboxes.length > 0 && !selectedCashboxId) {
      setSelectedCashboxId(project.salary_cashbox);
    }
  }, [project?.salary_cashbox, cashboxes, selectedCashboxId]);

  useEffect(() => {
    if (!selectedCashboxId) {
      setFlows([]);
      return;
    }
    let cancelled = false;
    setFlowsLoading(true);
    getBuildingCashFlows({ cashbox: selectedCashboxId })
      .then((data) => {
        if (!cancelled) {
          const list = data?.results ?? [];
          setFlows(Array.isArray(list) ? list : []);
        }
      })
      .catch((err) => {
        if (!cancelled) alert(validateResErrors(err, "Не удалось загрузить движения"), true);
      })
      .finally(() => {
        if (!cancelled) setFlowsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedCashboxId]);

  const loadCashboxes = () => {
    getBuildingCashboxes()
      .then((list) => setCashboxes(Array.isArray(list) ? list : []))
      .catch(() => { });
  };

  const loadFlows = () => {
    if (!selectedCashboxId) return;
    getBuildingCashFlows({ cashbox: selectedCashboxId })
      .then((data) => {
        const list = data?.results ?? [];
        setFlows(Array.isArray(list) ? list : []);
      })
      .catch(() => { });
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!residentialId) {
      alert("Не удалось определить ЖК", true);
      return;
    }
    setSavingSettings(true);
    try {
      const res = await dispatch(
        updateBuildingProject({
          id: residentialId,
          data: { salary_cashbox: salaryCashboxId || null },
        }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Настройки ЖК сохранены");
        const from = searchParams.get("from");
        const payrollId = searchParams.get("payrollId");
        if (from === "salary-payroll" && payrollId) {
          navigate(`/crm/building/salary/payroll/${payrollId}`);
        }
      } else {
        alert(
          validateResErrors(
            res.payload || res.error,
            "Не удалось сохранить настройки ЖК",
          ),
          true,
        );
      }
    } catch (err) {
      alert(
        validateResErrors(err, "Не удалось сохранить настройки ЖК"),
        true,
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateCashbox = async (e) => {
    e.preventDefault();
    if (!cashboxName.trim()) {
      alert("Введите название кассы", true);
      return;
    }
    setCashboxSubmitting(true);
    try {
      await createBuildingCashbox({ name: cashboxName.trim(), branch: null });
      alert("Касса создана");
      setCashboxModalOpen(false);
      setCashboxName("");
      loadCashboxes();
    } catch (err) {
      alert(validateResErrors(err, "Не удалось создать кассу"), true);
    } finally {
      setCashboxSubmitting(false);
    }
  };

  const handleBulkStatus = (status) => {
    const ids = Array.from(selectedFlowIds);
    if (ids.length === 0) {
      alert("Выберите движения", true);
      return;
    }
    setBulkSubmitting(true);
    bulkStatusBuildingCashFlows({
      items: ids.map((id) => ({ id, status })),
    })
      .then(() => {
        alert(status === "approved" ? "Движения одобрены" : "Движения отклонены");
        setSelectedFlowIds(new Set());
        loadFlows();
      })
      .catch((err) => {
        alert(validateResErrors(err, "Не удалось обновить статусы"), true);
      })
      .finally(() => setBulkSubmitting(false));
  };

  const toggleFlowSelection = (id) => {
    setSelectedFlowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFlows = () => {
    const pending = flows.filter((f) => f.status === "pending");
    if (selectedFlowIds.size >= pending.length) {
      setSelectedFlowIds(new Set());
    } else {
      setSelectedFlowIds(
        new Set(pending.map((f) => f.id ?? f.uuid).filter(Boolean)),
      );
    }
  };

  const pendingFlows = flows.filter((f) => f.status === "pending");

  return (
    <div className="building-page__card">
      <div className="building-page__card-header">
        <div>
          <h3 className="building-page__cardTitle">Касса Building</h3>
          <p className="building-page__muted" style={{ marginBottom: 16 }}>
            Настройки ЖК и просмотр движений по кассе.
          </p>
        </div>
        <button
          type="button"
          className="building-btn building-btn--primary"
          onClick={() => {
            setCashboxName("");
            setCashboxModalOpen(true);
          }}
        >
          Создать кассу
        </button>
      </div>

      {residentialId && (
        <>

          <h4 className="building-page__cardTitle" style={{ marginTop: 0, marginBottom: 12 }}>
            Настройки ЖК
          </h4>

          {cashboxesLoading && (
            <div className="building-page__muted">Загрузка касс...</div>
          )}
          {cashboxesError && (
            <div className="building-page__error">
              {String(
                validateResErrors(
                  cashboxesError,
                  "Не удалось загрузить список касс",
                ),
              )}
            </div>
          )}
          {!cashboxesLoading && !cashboxesError && (
            <form className="building-page" onSubmit={handleSaveSettings} style={{ marginBottom: 24 }}>
              <label>
                <div className="building-page__label">Касса для ЗП по ЖК</div>
                <select
                  className="building-page__select"
                  value={salaryCashboxId || ""}
                  onChange={(e) => setSalaryCashboxId(e.target.value)}
                >
                  <option value="">Не выбрана</option>
                  {cashboxes.map((box) => {
                    const bid = box.id ?? box.uuid;
                    if (!bid) return null;
                    const label =
                      box.name ||
                      box.title ||
                      box.display ||
                      box.label ||
                      `Касса ${bid}`;
                    return (
                      <option key={bid} value={bid}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <div className="building-page__muted" style={{ marginTop: 4 }}>
                  Из этой кассы будут выплачиваться ЗП сотрудникам, работающим на этом ЖК.
                </div>
              </label>
              <div className="building-page__actions" style={{ marginTop: 8 }}>
                <button
                  type="submit"
                  className="building-btn building-btn--primary"
                  disabled={savingSettings}
                >
                  {savingSettings ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
      {cashboxesLoading && (
        <div className="building-page__muted">Загрузка касс...</div>
      )}
      {!cashboxesLoading && (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >


          </div>

          {selectedCashboxId && (
            <>
              <div className="flex items-center gap-2 justify-between">
                <h4 className="building-page__cardTitle" style={{ margin: "0 0 12px 0" }}>
                  Движения по кассе

                </h4>
                <label className="flex items-center gap-2">
                  <span className="building-page__label">Касса</span>
                  <select
                    className="building-page__select"
                    value={selectedCashboxId}
                    onChange={(e) => setSelectedCashboxId(e.target.value)}
                    style={{ minWidth: 200 }}
                  >
                    <option value="">Выберите кассу</option>
                    {cashboxes.map((box) => {
                      const bid = box.id ?? box.uuid;
                      if (!bid) return null;
                      const label =
                        box.name || box.title || box.display || `Касса ${bid}`;
                      return (
                        <option key={bid} value={bid}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </label>

              </div>

              {flowsLoading && (
                <div className="building-page__muted">
                  Загрузка движений...
                </div>
              )}
              {!flowsLoading && flows.length === 0 && (
                <div className="building-page__muted">
                  Движений пока нет.
                </div>
              )}
              {!flowsLoading && flows.length > 0 && (
                <div className="building-table building-table--shadow">
                  <table>
                    <thead>
                      <tr>
                        {pendingFlows.length > 0 && (
                          <th style={{ width: 40 }}>
                            <input
                              type="checkbox"
                              checked={
                                pendingFlows.length > 0 &&
                                selectedFlowIds.size >= pendingFlows.length
                              }
                              onChange={toggleAllFlows}
                              title="Выбрать все на согласовании"
                            />
                          </th>
                        )}
                        <th>Дата</th>
                        <th>Наименование</th>
                        <th>Тип</th>
                        <th>Сумма</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flows.map((f) => {
                        const fid = f.id ?? f.uuid;
                        const isPending = f.status === "pending";
                        return (
                          <tr key={fid}>
                            {pendingFlows.length > 0 && (
                              <td>
                                {isPending ? (
                                  <input
                                    type="checkbox"
                                    checked={selectedFlowIds.has(fid)}
                                    onChange={() => toggleFlowSelection(fid)}
                                  />
                                ) : null}
                              </td>
                            )}
                            <td>
                              {asDateTime(f.created_at ?? f.date ?? f.created) ?? "—"}
                            </td>
                            <td>{f.name ?? "—"}</td>
                            <td>
                              {FLOW_TYPE_LABELS[f.type] ?? f.type}
                            </td>
                            <td>{f.amount ?? "—"}</td>
                            <td>
                              {FLOW_STATUS_LABELS[f.status] ?? f.status}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      <Modal
        open={cashboxModalOpen}
        onClose={() => setCashboxModalOpen(false)}
        title="Создать кассу"
      >
        <form onSubmit={handleCreateCashbox}>
          <label>
            <div className="building-page__label">Название</div>
            <input
              className="building-page__input"
              value={cashboxName}
              onChange={(e) => setCashboxName(e.target.value)}
              placeholder="Основная касса Building"
            />
          </label>
          <div className="building-page__actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="building-btn"
              onClick={() => setCashboxModalOpen(false)}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="building-btn building-btn--primary"
              disabled={cashboxSubmitting}
            >
              {cashboxSubmitting ? "Создание..." : "Создать"}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
