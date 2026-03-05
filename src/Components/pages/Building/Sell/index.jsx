import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useAlert } from "@/hooks/useDialog";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { useBuildingApartments } from "@/store/slices/building/apartmentsSlice";
import {
  fetchBuildingApartments,
  fetchBuildingResidentialFloors,
} from "@/store/creators/building/apartmentsCreators";
import { createBuildingTreaty } from "@/store/creators/building/treatiesCreators";
import { useBuildingClients } from "@/store/slices/building/clientsSlice";
import { fetchBuildingClients } from "@/store/creators/building/clientsCreators";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { getPageCount, DEFAULT_PAGE_SIZE } from "../shared/api";
import { asCurrency } from "../shared/constants";
import BuildingPagination from "../shared/Pagination";
import Modal from "@/Components/common/Modal/Modal";

const PAYMENT_TYPE_LABELS = {
  full: "Полная оплата",
  installment: "Рассрочка",
};

const OPERATION_TYPE_LABELS = {
  sale: "Продажа",
  booking: "Бронь",
};

const APARTMENT_STATUS_LABELS = {
  available: "Доступна",
  reserved: "Забронирована",
  sold: "Продана",
};

export default function BuildingSell() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();

  const { items: projects, selectedProjectId } = useBuildingProjects();
  const {
    list,
    count,
    loading,
    error,
    floors,
    floorsLoading,
    floorsError,
  } = useBuildingApartments();
  const { list: clientsList } = useBuildingClients();

  const [page, setPage] = useState(1);
  const [floor, setFloor] = useState("");
  const [status, setStatus] = useState("");

  const [treatyModalOpen, setTreatyModalOpen] = useState(false);
  const [treatyApartment, setTreatyApartment] = useState(null);
  const [treatyOperationType, setTreatyOperationType] = useState("sale");
  const [treatyPaymentType, setTreatyPaymentType] = useState("full");
  const [treatyClient, setTreatyClient] = useState("");
  const [treatyAmount, setTreatyAmount] = useState("");
  const [treatyDownPayment, setTreatyDownPayment] = useState("");
  const [firstInstallmentDate, setFirstInstallmentDate] = useState("");
  const [installmentMonths, setInstallmentMonths] = useState(12);
  const [installments, setInstallments] = useState([]);
  const [treatyError, setTreatyError] = useState(null);
  const [creatingTreaty, setCreatingTreaty] = useState(false);

  useEffect(() => {
    dispatch(fetchBuildingClients());
  }, [dispatch]);

  useEffect(() => {
    if (treatyPaymentType !== "installment") {
      setInstallments([]);
      return;
    }
    const amountTotal = Number(treatyAmount || 0);
    const down = Number(treatyDownPayment || 0);
    const n = Number(installmentMonths) || 0;
    if (!firstInstallmentDate || !amountTotal || !n || down >= amountTotal) {
      setInstallments([]);
      return;
    }
    const remain = amountTotal - down;
    const totalCents = Math.round(remain * 100);
    if (totalCents <= 0) {
      setInstallments([]);
      return;
    }
    const baseCents = Math.floor(totalCents / n);
    const rows = [];
    let usedCents = 0;
    const start = new Date(firstInstallmentDate);
    if (Number.isNaN(start.getTime())) {
      setInstallments([]);
      return;
    }
    for (let i = 0; i < n; i += 1) {
      const isLast = i === n - 1;
      const cents = isLast ? totalCents - usedCents : baseCents;
      usedCents += cents;
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const iso = `${yyyy}-${mm}-${dd}`;
      rows.push({
        order: i + 1,
        due_date: iso,
        amount: (cents / 100).toFixed(2),
      });
    }
    setInstallments(rows);
  }, [treatyPaymentType, treatyAmount, treatyDownPayment, firstInstallmentDate, installmentMonths]);

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(fetchBuildingResidentialFloors(selectedProjectId));
  }, [dispatch, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const params = {
      residential_complex: selectedProjectId,
      page,
      page_size: DEFAULT_PAGE_SIZE,
      floor: floor || undefined,
      status: status || undefined,
    };
    dispatch(fetchBuildingApartments(params));
  }, [dispatch, selectedProjectId, page, floor, status]);

  const totalPages = useMemo(
    () => getPageCount(count, DEFAULT_PAGE_SIZE),
    [count],
  );

  const selectedProject = useMemo(
    () =>
      (projects || []).find(
        (p) => String(p.id ?? p.uuid) === String(selectedProjectId),
      ) || null,
    [projects, selectedProjectId],
  );

  const clientsOptions = useMemo(
    () => (clientsList || []).map((c) => ({ id: c.id ?? c.uuid, name: c.name })),
    [clientsList],
  );

  const handleOpenTreatyModal = (apt, opType) => {
    const aptId = apt?.id ?? apt?.uuid;
    if (!aptId) return;
    setTreatyApartment(apt);
    setTreatyOperationType(opType);
    setTreatyPaymentType("full");
    setTreatyClient("");
    setTreatyAmount(apt?.price ? String(apt.price) : "");
    setTreatyDownPayment("");
    setFirstInstallmentDate("");
    setInstallmentMonths(12);
    setInstallments([]);
    setTreatyError(null);
    setTreatyModalOpen(true);
  };

  const handleCreateTreaty = async (e) => {
    e.preventDefault();
    if (!selectedProjectId || !treatyApartment) return;
    const aptId = treatyApartment.id ?? treatyApartment.uuid;
    if (!aptId) return;
    if (!treatyClient) {
      setTreatyError("Выберите клиента");
      return;
    }
    if (!treatyAmount) {
      setTreatyError("Укажите сумму договора");
      return;
    }
    const amountTotal = Number(treatyAmount || 0);
    const down = Number(treatyDownPayment || 0);
    if (treatyPaymentType === "installment") {
      if (!firstInstallmentDate) {
        setTreatyError("Укажите дату первого платежа рассрочки");
        return;
      }
      if (!amountTotal || down >= amountTotal) {
        setTreatyError(
          "Сумма первоначального взноса должна быть меньше суммы договора",
        );
        return;
      }
      const insSum = installments.reduce(
        (acc, row) => acc + Number(row.amount || 0),
        0,
      );
      if (
        Number.isFinite(amountTotal) &&
        (down + insSum).toFixed(2) !== amountTotal.toFixed(2)
      ) {
        setTreatyError(
          "Сумма первоначального взноса и рассрочки должна быть равна сумме договора",
        );
        return;
      }
    }
    setTreatyError(null);
    setCreatingTreaty(true);
    const payload = {
      residential_complex: selectedProjectId,
      client: treatyClient,
      apartment: aptId,
      operation_type: treatyOperationType,
      payment_type: treatyPaymentType,
      amount: String(treatyAmount),
      down_payment:
        treatyPaymentType === "installment" && treatyDownPayment
          ? String(treatyDownPayment)
          : undefined,
      installments:
        treatyPaymentType === "installment"
          ? installments.map((row) => ({
              order: row.order,
              due_date: row.due_date,
              amount: String(row.amount),
            }))
          : undefined,
    };
    try {
      const res = await dispatch(createBuildingTreaty(payload));
      if (res.meta.requestStatus === "fulfilled") {
        alert(
          treatyOperationType === "sale"
            ? "Договор продажи создан"
            : "Договор бронирования создан",
        );
        setTreatyModalOpen(false);
        setTreatyApartment(null);
        // Обновим список квартир, чтобы статус обновился
        const params = {
          residential_complex: selectedProjectId,
          page,
          page_size: DEFAULT_PAGE_SIZE,
          floor: floor || undefined,
          status: status || undefined,
        };
        dispatch(fetchBuildingApartments(params));
      } else {
        setTreatyError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось создать договор",
          ),
        );
      }
    } catch (err) {
      setTreatyError(
        validateResErrors(err, "Не удалось создать договор"),
      );
    } finally {
      setCreatingTreaty(false);
    }
  };

  return (
    <div className="building-page building-page--sell">
      <div className="building-page__header">
        <div>
          <h1 className="building-page__title">Продажи</h1>
          <p className="building-page__subtitle">
            Выберите ЖК, этаж и квартиру для продажи или брони.
          </p>
        </div>
        <button
          type="button"
          className="building-btn"
          onClick={() => navigate("/crm/building/treaty")}
        >
        Список договоров
        </button>
      </div>

      {!selectedProjectId && (
        <div className="building-page__muted" style={{ marginBottom: 16 }}>
          Сначала выберите ЖК в шапке (сверху), чтобы работать с продажами.
        </div>
      )}

      {selectedProjectId && (
        <>
          <div className="building-page__card">
            <div className="building-page__label">Выбранный ЖК</div>
            <div>
              <b>{selectedProject?.name || "—"}</b>
            </div>
          </div>

          <div className="building-page__layout building-page__layout--2col">
            <div className="building-page__card">
              <h3 className="building-page__cardTitle">Этажи</h3>
              {floorsLoading && (
                <div className="building-page__muted">
                  Загрузка этажей...
                </div>
              )}
              {floorsError && (
                <div className="building-page__error">
                  {String(
                    validateResErrors(
                      floorsError,
                      "Не удалось загрузить этажи",
                    ),
                  )}
                </div>
              )}
              {!floorsLoading && !floorsError && floors.length === 0 && (
                <div className="building-page__muted">
                  Информация по этажам пока недоступна.
                </div>
              )}
              {!floorsLoading && !floorsError && floors.length > 0 && (
                <div className="building-project-floors">
                  {floors.map((f) => (
                    <div
                      key={f.floor}
                      className={`building-project-floors__item${
                        String(floor) === String(f.floor)
                          ? " building-project-floors__item--active"
                          : ""
                      }`}
                      onClick={() => {
                        setPage(1);
                        setFloor(String(f.floor));
                      }}
                    >
                      <div className="building-project-floors__floor">
                        Этаж {f.floor}
                      </div>
                      <div className="building-project-floors__stats">
                        <span>Всего: {f.total}</span>
                        <span>Свободно: {f.available}</span>
                        <span>Бронь: {f.reserved}</span>
                        <span>Продано: {f.sold}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="building-page__card">
              <div className="building-page__filters">
                <select
                  className="building-page__select"
                  value={status}
                  onChange={(e) => {
                    setPage(1);
                    setStatus(e.target.value);
                  }}
                >
                  <option value="">Все статусы</option>
                  {Object.entries(APARTMENT_STATUS_LABELS).map(
                    ([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>
              {error && (
                <div className="building-page__error">
                  {String(
                    validateResErrors(
                      error,
                      "Не удалось загрузить список квартир",
                    ),
                  )}
                </div>
              )}

              {loading && (
                <div className="building-page__muted">
                  Загрузка квартир...
                </div>
              )}
              {!loading && list.length === 0 && (
                <div className="building-page__muted">
                  Для выбранного этажа квартир нет.
                </div>
              )}
              {!loading && list.length > 0 && (
                <div className="building-table building-table--shadow">
                  <table>
                    <thead>
                      <tr>
                        <th>Этаж</th>
                        <th>Номер</th>
                        <th>Комнат</th>
                        <th>Площадь, м²</th>
                        <th>Цена</th>
                        <th>Статус</th>
                        <th>Примечание</th>
                        <th style={{ width: 140 }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((apt) => {
                        const aptId = apt?.id ?? apt?.uuid;
                        const isAvailable = apt?.status === "available";
                        return (
                          <tr key={aptId}>
                            <td>{apt?.floor ?? "—"}</td>
                            <td>{apt?.number ?? "—"}</td>
                            <td>{apt?.rooms ?? "—"}</td>
                            <td>{apt?.area ?? "—"}</td>
                            <td>{asCurrency(apt?.price)}</td>
                            <td>
                              {APARTMENT_STATUS_LABELS[apt?.status] ||
                                apt?.status ||
                                "—"}
                            </td>
                            <td>{apt?.notes || ""}</td>
                            <td>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 4,
                                }}
                              >
                                {isAvailable ? (
                                  <>
                                    <button
                                      type="button"
                                      className="building-btn building-btn--primary"
                                      onClick={() =>
                                        handleOpenTreatyModal(apt, "sale")
                                      }
                                    >
                                      Продать
                                    </button>
                                    <button
                                      type="button"
                                      className="building-btn"
                                      onClick={() =>
                                        handleOpenTreatyModal(apt, "booking")
                                      }
                                    >
                                      Забронировать
                                    </button>
                                  </>
                                ) : (
                                  <span className="building-page__muted">
                                    Договор уже создан
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <BuildingPagination
                page={page}
                totalPages={totalPages}
                disabled={loading}
                onChangePage={setPage}
              />
            </div>
          </div>
        </>
      )}

      {treatyModalOpen && treatyApartment && (
        <Modal
          open={treatyModalOpen}
          onClose={() => setTreatyModalOpen(false)}
          title={
            treatyOperationType === "sale"
              ? "Создать договор продажи"
              : "Создать договор бронирования"
          }
        >
          <form className="building-page" onSubmit={handleCreateTreaty}>
            <div className="building-page__muted" style={{ marginBottom: 8 }}>
              Квартира {treatyApartment.number || "—"}, этаж{" "}
              {treatyApartment.floor ?? "—"},{" "}
              площадь {treatyApartment.area ?? "—"} м²
            </div>
            <label>
              <div className="building-page__label">Клиент *</div>
              <select
                className="building-page__select"
                value={treatyClient}
                onChange={(e) => setTreatyClient(e.target.value)}
                required
              >
                <option value="">Выберите клиента</option>
                {clientsOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || "—"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="building-page__label">Тип операции</div>
              <div className="building-page__muted">
                {OPERATION_TYPE_LABELS[treatyOperationType] ||
                  treatyOperationType ||
                  "—"}
              </div>
            </label>
            <label>
              <div className="building-page__label">Тип оплаты</div>
              <select
                className="building-page__select"
                value={treatyPaymentType}
                onChange={(e) => setTreatyPaymentType(e.target.value)}
              >
                {Object.entries(PAYMENT_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <div className="building-page__label">Сумма договора *</div>
              <input
                className="building-page__input"
                type="number"
                min="0"
                step="0.01"
                value={treatyAmount}
                onChange={(e) => setTreatyAmount(e.target.value)}
                required
              />
            </label>
            {treatyPaymentType === "installment" && (
              <>
                <label>
                  <div className="building-page__label">
                    Первоначальный взнос
                  </div>
                  <input
                    className="building-page__input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={treatyDownPayment}
                    onChange={(e) => setTreatyDownPayment(e.target.value)}
                    placeholder="Например: 30000.00"
                  />
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginTop: 8,
                    marginBottom: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <label style={{ flex: "0 0 220px" }}>
                    <div className="building-page__label">
                      Дата первого платежа *
                    </div>
                    <input
                      type="date"
                      className="building-page__input"
                      value={firstInstallmentDate}
                      onChange={(e) => setFirstInstallmentDate(e.target.value)}
                    />
                  </label>
                  <label style={{ flex: "0 0 220px" }}>
                    <div className="building-page__label">
                      Количество платежей
                    </div>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="building-page__input"
                      value={installmentMonths}
                      onChange={(e) =>
                        setInstallmentMonths(Number(e.target.value) || 1)
                      }
                    />
                  </label>
                </div>
                {installments.length > 0 && (
                  <div
                    className="building-table building-table--shadow"
                    style={{ maxHeight: 200, overflowY: "auto", marginTop: 4 }}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Дата платежа</th>
                          <th>Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {installments.map((row) => (
                          <tr key={row.order}>
                            <td>{row.order}</td>
                            <td>{row.due_date}</td>
                            <td>{row.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            {treatyError && (
              <div
                className="building-page__error"
                style={{ marginTop: 8, marginBottom: 4 }}
              >
                {String(treatyError)}
              </div>
            )}
            <div className="building-page__actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="building-btn"
                onClick={() => setTreatyModalOpen(false)}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="building-btn building-btn--primary"
                style={{ marginLeft: 8 }}
                disabled={creatingTreaty}
              >
                {creatingTreaty ? "Создание..." : "Создать договор"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}