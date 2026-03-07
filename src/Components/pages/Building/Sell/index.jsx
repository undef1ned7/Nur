import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useAlert } from "@/hooks/useDialog";
import { useBuildingProjects } from "@/store/slices/building/projectsSlice";
import { useBuildingApartments } from "@/store/slices/building/apartmentsSlice";
import {
  fetchBuildingApartments,
  fetchBuildingResidentialFloors,
} from "@/store/creators/building/apartmentsCreators";
import {
  createBuildingTreaty,
  fetchBuildingTreaties,
  createBuildingTreatyFile,
} from "@/store/creators/building/treatiesCreators";
import { useBuildingClients } from "@/store/slices/building/clientsSlice";
import {
  fetchBuildingClients,
  createBuildingClient,
} from "@/store/creators/building/clientsCreators";
import { validateResErrors } from "../../../../../tools/validateResErrors";
/** На странице продаж сразу грузим все этажи одной таблицей */
const SELL_PAGE_SIZE = 500;
/** Максимум платежей рассрочки — чтобы не зависало при вводе большого числа */
const MAX_INSTALLMENT_MONTHS = 120;
import { asCurrency } from "../shared/constants";
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

/** ID клиента, которому оформлена квартира (продана/бронь) */
function getClientIdFromApartment(apt) {
  if (!apt) return null;
  const c = apt.client_id ?? apt.client;
  if (c != null && typeof c === "object") return c?.id ?? c?.uuid ?? null;
  if (typeof c === "number" || typeof c === "string") return String(c);
  const treaty = apt.last_treaty ?? apt.current_treaty;
  if (treaty) {
    const tc = treaty.client_id ?? treaty.client;
    if (tc != null && typeof tc === "object") return tc?.id ?? tc?.uuid ?? null;
    if (typeof tc === "number" || typeof tc === "string") return String(tc);
  }
  return null;
}

export default function BuildingSell() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();

  const { items: projects, selectedProjectId } = useBuildingProjects();
  const { list, count, loading, error, floors, floorsLoading, floorsError } =
    useBuildingApartments();
  const {
    list: clientsList,
    creating: clientCreating,
    createError: clientCreateError,
  } = useBuildingClients();

  const [floor, setFloor] = useState("");
  const [status, setStatus] = useState("");

  const [clientSearch, setClientSearch] = useState("");
  const [clientSelectOpen, setClientSelectOpen] = useState(false);
  const clientSelectRef = useRef(null);
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [clientFormName, setClientFormName] = useState("");
  const [clientFormPhone, setClientFormPhone] = useState("");
  const [clientFormEmail, setClientFormEmail] = useState("");
  const [clientFormError, setClientFormError] = useState(null);

  const [choiceApartment, setChoiceApartment] = useState(null);
  const [navigatingClientId, setNavigatingClientId] = useState(null);
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
  const [treatyFiles, setTreatyFiles] = useState([]);
  const [treatyError, setTreatyError] = useState(null);
  const [creatingTreaty, setCreatingTreaty] = useState(false);

  useEffect(() => {
    dispatch(fetchBuildingClients());
  }, [dispatch]);

  useEffect(() => {
    if (!clientSelectOpen) return;
    const handleClickOutside = (e) => {
      if (
        clientSelectRef.current &&
        !clientSelectRef.current.contains(e.target)
      ) {
        setClientSelectOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [clientSelectOpen]);

  useEffect(() => {
    if (treatyPaymentType !== "installment") {
      setInstallments([]);
      return;
    }
    const amountTotal = Number(treatyAmount || 0);
    const down = Number(treatyDownPayment || 0);
    const n = Math.min(
      Math.max(1, Number(installmentMonths) || 0),
      MAX_INSTALLMENT_MONTHS,
    );
    if (!firstInstallmentDate || !amountTotal || down >= amountTotal) {
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
  }, [
    treatyPaymentType,
    treatyAmount,
    treatyDownPayment,
    firstInstallmentDate,
    installmentMonths,
  ]);

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(fetchBuildingResidentialFloors(selectedProjectId));
  }, [dispatch, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const params = {
      residential_complex: selectedProjectId,
      page: 1,
      page_size: SELL_PAGE_SIZE,
      floor: floor || undefined,
      status: status || undefined,
    };
    dispatch(fetchBuildingApartments(params));
  }, [dispatch, selectedProjectId, floor, status]);

  /** Таблица-шахматка: этажи → квартиры по порядку */
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

  const selectedProject = useMemo(
    () =>
      (projects || []).find(
        (p) => String(p.id ?? p.uuid) === String(selectedProjectId),
      ) || null,
    [projects, selectedProjectId],
  );

  const clientsOptions = useMemo(
    () =>
      (clientsList || []).map((c) => ({ id: c.id ?? c.uuid, name: c.name })),
    [clientsList],
  );

  const filteredClientOptions = useMemo(() => {
    const list = (clientsList || []).map((c) => ({
      id: c.id ?? c.uuid,
      name: c.name,
    }));
    const query = clientSearch.trim().toLowerCase();
    if (!query) return list;
    return (clientsList || [])
      .filter((c) => {
        const hay = `${c.name || ""} ${c.phone || ""} ${c.email || ""} ${c.inn || ""}`
          .toLowerCase();
        return hay.includes(query);
      })
      .map((c) => ({ id: c.id ?? c.uuid, name: c.name }));
  }, [clientsList, clientSearch]);

  const handleQuickCreateClient = async () => {
    if (!selectedProjectId) {
      alert("Сначала выберите жилой комплекс в шапке раздела", true);
      return;
    }
    if (!String(clientFormName || "").trim()) {
      setClientFormError("Имя клиента обязательно");
      return;
    }
    setClientFormError(null);
    try {
      const payload = {
        name: clientFormName.trim(),
        phone: clientFormPhone.trim() || undefined,
        email: clientFormEmail.trim() || undefined,
      };
      const res = await dispatch(createBuildingClient(payload));
      if (res.meta.requestStatus === "fulfilled") {
        const created = res.payload;
        const newId = created?.id ?? created?.uuid;
        if (newId) {
          setTreatyClient(String(newId));
        }
        alert("Клиент создан");
        setClientFormOpen(false);
        setClientFormName("");
        setClientFormPhone("");
        setClientFormEmail("");
        setClientSearch("");
        dispatch(
          fetchBuildingClients({
            residential_complex: selectedProjectId,
          }),
        );
      } else {
        setClientFormError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось создать клиента",
          ),
        );
      }
    } catch (err) {
      setClientFormError(
        validateResErrors(err, "Не удалось создать клиента"),
      );
    }
  };

  /** Переход к карточке клиента по проданной/забронированной квартире (из договора, если в квартире нет client) */
  const handleGoToClientByApartment = async (apt) => {
    const aptId = apt?.id ?? apt?.uuid;
    if (!aptId) return;
    let clientId = getClientIdFromApartment(apt);
    if (clientId) {
      navigate(`/crm/building/clients/${clientId}`);
      return;
    }
    setNavigatingClientId(aptId);
    try {
      const res = await dispatch(
        fetchBuildingTreaties({
          apartment: aptId,
          page_size: 1,
        }),
      );
      if (res.meta?.requestStatus === "fulfilled" && res.payload) {
        const results = Array.isArray(res.payload.results)
          ? res.payload.results
          : Array.isArray(res.payload)
            ? res.payload
            : [];
        const treaty = results[0];
        const cId = treaty?.client ?? treaty?.client_id ?? null;
        if (cId != null) {
          navigate(
            `/crm/building/clients/${typeof cId === "object" ? cId?.id ?? cId?.uuid : cId}`,
          );
        } else {
          alert("По этой квартире не найден договор с клиентом.");
        }
      } else {
        alert("Не удалось загрузить договор по квартире.");
      }
    } catch (e) {
      alert(
        validateResErrors(e, "Не удалось загрузить договор по квартире.") ||
          "Не удалось загрузить договор по квартире.",
      );
    } finally {
      setNavigatingClientId(null);
    }
  };

  const handleOpenTreatyModal = (apt, opType) => {
    const aptId = apt?.id ?? apt?.uuid;
    if (!aptId) return;
    setChoiceApartment(null);
    setTreatyApartment(apt);
    setTreatyOperationType(opType);
    setTreatyPaymentType("full");
    setTreatyClient("");
    setTreatyAmount(apt?.price ? String(apt.price) : "");
    setTreatyDownPayment("");
    setFirstInstallmentDate("");
    setInstallmentMonths(12);
    setInstallments([]);
    setTreatyFiles([]);
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
        const created = res.payload;
        const newId = created?.id ?? created?.uuid;
        let filesError = null;
        if (newId && treatyFiles.length > 0) {
          // Прикрепим выбранные файлы договора
          // eslint-disable-next-line no-restricted-syntax
          for (const file of treatyFiles) {
            if (!file) continue;
            // eslint-disable-next-line no-await-in-loop
            const fileRes = await dispatch(
              createBuildingTreatyFile({
                treatyId: newId,
                file,
                title: file.name || undefined,
              }),
            );
            if (fileRes.meta.requestStatus !== "fulfilled" && !filesError) {
              filesError = validateResErrors(
                fileRes.payload || fileRes.error,
                "Не удалось прикрепить файлы договора",
              );
            }
          }
        }
        if (filesError) {
          alert(
            `${
              treatyOperationType === "sale"
                ? "Договор продажи создан, но"
                : "Договор бронирования создан, но"
            } ${filesError}`,
          );
        } else {
          alert(
            treatyOperationType === "sale"
              ? "Договор продажи создан"
              : "Договор бронирования создан",
          );
        }
        setTreatyModalOpen(false);
        setTreatyApartment(null);
        // Обновим список квартир, чтобы статус обновился
        const params = {
          residential_complex: selectedProjectId,
          page: 1,
          page_size: SELL_PAGE_SIZE,
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
      setTreatyError(validateResErrors(err, "Не удалось создать договор"));
    } finally {
      setCreatingTreaty(false);
    }
  };

  return (
    <div className="building-page building-page--sell">
      <header className="sell-header">
        <div className="sell-header__content">
          <h1 className="sell-header__title">Продажи</h1>
          <p className="sell-header__subtitle">
            {selectedProjectId ? (
              <>
                ЖК <strong>{selectedProject?.name || "—"}</strong> · Выберите
                квартиру на плане и оформите продажу или бронь
              </>
            ) : (
              "Выберите жилой комплекс в шапке страницы"
            )}
          </p>
        </div>
       
      </header>

      {!selectedProjectId && (
        <div className="sell-empty-hint">
          <span className="sell-empty-hint__icon">🏢</span>
          <p className="sell-empty-hint__text">
            Сначала выберите ЖК в шапке раздела — откроется план этажей и
            квартир.
          </p>
        </div>
      )}

      {selectedProjectId && (
        <div className="sell-card">
          <div className="sell-toolbar">
            <div className="sell-toolbar__filters">
              <label className="sell-toolbar__label">
                <span className="sell-toolbar__labelText">Этаж</span>
                <select
                  className="sell-toolbar__select"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  disabled={floorsLoading}
                >
                  <option value="">Все этажи</option>
                  {!floorsLoading &&
                    floors.map((f) => (
                      <option key={f.floor} value={String(f.floor)}>
                        Этаж {f.floor} · всего {f.total}, свободно {f.available}
                      </option>
                    ))}
                </select>
              </label>
              <label className="sell-toolbar__label">
                <span className="sell-toolbar__labelText">Статус</span>
                <select
                  className="sell-toolbar__select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Все статусы</option>
                  {Object.entries(APARTMENT_STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!loading && list.length > 0 && (
              <div className="sell-legend" role="presentation">
                <span className="sell-legend__item sell-legend__item--available">
                  Свободна
                </span>
                <span className="sell-legend__item sell-legend__item--reserved">
                  Бронь
                </span>
                <span className="sell-legend__item sell-legend__item--sold">
                  Продана
                </span>
                <span className="sell-legend__hint">
                  Клик по ячейке — проданная/бронь открывает карточку клиента
                </span>
              </div>
            )}
          </div>
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
            <div className="sell-loading">
              <div className="sell-loading__spinner" />
              <p className="sell-loading__text">Загрузка плана квартир...</p>
            </div>
          )}
          {!loading && list.length === 0 && (
            <div className="sell-empty">
              <p className="sell-empty__text">
                {floor
                  ? "На выбранном этаже квартир не найдено."
                  : "Нет данных по квартирам. Выберите этаж или загрузите план."}
              </p>
            </div>
          )}
          {!loading && list.length > 0 && (
            <div className="sell-plan-wrap">
              <div className="sell-plan building-sell-plan building-table">
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
                              key={i}
                              className="building-sell-plan__aptCol building-sell-plan__cell--empty"
                            />
                          );
                        }
                        const isAvailable = apt?.status === "available";
                        const aptId = apt?.id ?? apt?.uuid;
                        const isNavigating =
                          !isAvailable &&
                          String(navigatingClientId) === String(aptId);
                        const statusMod =
                          apt?.status === "sold"
                            ? "building-sell-plan__cell--sold"
                            : apt?.status === "reserved"
                              ? "building-sell-plan__cell--reserved"
                              : "building-sell-plan__cell--available";
                        const cellClickable = true;
                        const handleCellClick = isAvailable
                          ? () => setChoiceApartment(apt)
                          : () => handleGoToClientByApartment(apt);
                        return (
                          <td
                            key={apt?.id ?? apt?.uuid ?? i}
                            className={`building-sell-plan__aptCol building-sell-plan__cell ${statusMod}${cellClickable ? " building-sell-plan__cell--clickable" : ""}${isNavigating ? " building-sell-plan__cell--loading" : ""}`}
                            role={cellClickable ? "button" : undefined}
                            tabIndex={cellClickable ? 0 : undefined}
                            onClick={
                              isNavigating ? undefined : handleCellClick
                            }
                            onKeyDown={
                              cellClickable && !isNavigating
                                ? (e) => {
                                    if (
                                      e.key === "Enter" ||
                                      e.key === " "
                                    ) {
                                      e.preventDefault();
                                      if (isAvailable) {
                                        setChoiceApartment(apt);
                                      } else {
                                        handleGoToClientByApartment(apt);
                                      }
                                    }
                                  }
                                : undefined
                            }
                            title={
                              isAvailable
                                ? "Нажмите, затем выберите Продажа или Бронь"
                                : "Перейти к карточке клиента"
                            }
                          >
                            <div className="building-sell-plan__cellInner">
                              <span className="building-sell-plan__aptNum">
                                {apt?.number ?? "—"}
                              </span>
                              {isNavigating && (
                                <span
                                  className="building-sell-plan__cellLoading"
                                  aria-hidden
                                >
                                  …
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
        </div>
      )}

      {choiceApartment && (
        <Modal
          open={!!choiceApartment}
          onClose={() => setChoiceApartment(null)}
          title={`Квартира № ${choiceApartment?.number ?? "—"}`}
        >
          <div className="sell-choice">
            <p className="sell-choice__info">
              Этаж {choiceApartment?.floor ?? "—"}, площадь{" "}
              {choiceApartment?.area ?? "—"} м²
            </p>
            <p className="sell-choice__prompt">Что оформить?</p>
            <div className="sell-choice__actions">
              <button
                type="button"
                className="sell-choice__btn sell-choice__btn--sale"
                onClick={() => handleOpenTreatyModal(choiceApartment, "sale")}
              >
                <span className="sell-choice__btnTitle">Продажа</span>
                <span className="sell-choice__btnDesc">Договор купли-продажи</span>
              </button>
              <button
                type="button"
                className="sell-choice__btn sell-choice__btn--booking"
                onClick={() => handleOpenTreatyModal(choiceApartment, "booking")}
              >
                <span className="sell-choice__btnTitle">Бронь</span>
                <span className="sell-choice__btnDesc">Забронировать квартиру</span>
              </button>
              <button
                type="button"
                className="sell-choice__btn sell-choice__btn--cancel"
                onClick={() => setChoiceApartment(null)}
              >
                Отмена
              </button>
            </div>
          </div>
        </Modal>
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
          <form className="sell-form" onSubmit={handleCreateTreaty}>
            <div className="sell-form__apt">
              Квартира {treatyApartment.number || "—"}, этаж{" "}
              {treatyApartment.floor ?? "—"}, площадь{" "}
              {treatyApartment.area ?? "—"} м²
            </div>
            <section className="sell-form__section">
              <h4 className="sell-form__sectionTitle">Клиент</h4>
            <label>
              <div className="sell-form__label">Клиент *</div>
              <div className="building-treaty-clientRow">
                <div
                  className="building-treaty-clientSelect"
                  ref={clientSelectRef}
                >
                  <button
                    type="button"
                    className="building-treaty-clientSelectTrigger"
                    onClick={() =>
                      setClientSelectOpen((v) => !v)
                    }
                    aria-expanded={clientSelectOpen}
                    aria-haspopup="listbox"
                  >
                    <span className="building-treaty-clientSelectValue">
                      {treatyClient
                        ? (clientsOptions.find(
                            (c) => String(c.id) === String(treatyClient),
                          )?.name ?? "—")
                        : "Выберите клиента"}
                    </span>
                    <span className="building-treaty-clientSelectArrow">
                      ▼
                    </span>
                  </button>
                  {clientSelectOpen && (
                    <div
                      className="building-treaty-clientSelectDropdown"
                      role="listbox"
                    >
                      <input
                        type="text"
                        className="building-page__input building-treaty-clientSelectSearch"
                        placeholder="Поиск по имени, телефону, email..."
                        value={clientSearch}
                        onChange={(e) =>
                          setClientSearch(e.target.value)
                        }
                        onKeyDown={(e) => e.stopPropagation()}
                        autoFocus
                      />
                      <div className="building-treaty-clientSelectList">
                        {filteredClientOptions.length === 0 ? (
                          <div className="building-treaty-clientSelectEmpty">
                            Ничего не найдено
                          </div>
                        ) : (
                          filteredClientOptions.map((c) => (
                            <div
                              key={c.id}
                              role="option"
                              aria-selected={String(treatyClient) === String(c.id)}
                              className={`building-treaty-clientSelectOption${String(treatyClient) === String(c.id) ? " building-treaty-clientSelectOption--selected" : ""}`}
                              onClick={() => {
                                setTreatyClient(String(c.id));
                                setClientSelectOpen(false);
                                setClientSearch("");
                              }}
                            >
                              {c.name || "—"}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <input
                  type="hidden"
                  name="client"
                  value={treatyClient}
                  required
                />
                <button
                  type="button"
                  className="building-btn building-btn--primary"
                  onClick={() => {
                    setClientFormOpen((v) => !v);
                    setClientFormError(null);
                  }}
                >
                  + Клиент
                </button>
              </div>
              {clientFormOpen && (
                <div className="building-treaty-clientForm">
                  <div className="building-treaty-clientFormGrid">
                    <input
                      className="building-page__input"
                      value={clientFormName}
                      onChange={(e) => setClientFormName(e.target.value)}
                      placeholder="Имя / название *"
                    />
                    <input
                      className="building-page__input"
                      value={clientFormPhone}
                      onChange={(e) => setClientFormPhone(e.target.value)}
                      placeholder="Телефон"
                    />
                    <input
                      className="building-page__input"
                      type="email"
                      value={clientFormEmail}
                      onChange={(e) => setClientFormEmail(e.target.value)}
                      placeholder="Email"
                    />
                  </div>
                  {(clientFormError || clientCreateError) && (
                    <div
                      className="building-page__error"
                      style={{ marginTop: 8 }}
                    >
                      {String(
                        clientFormError ||
                          validateResErrors(
                            clientCreateError,
                            "Ошибка при сохранении клиента",
                          ),
                      )}
                    </div>
                  )}
                  <div className="building-treaty-clientFormActions">
                    <button
                      type="button"
                      className="building-btn building-btn--primary"
                      onClick={handleQuickCreateClient}
                      disabled={clientCreating}
                    >
                      {clientCreating ? "Сохранение..." : "Сохранить клиента"}
                    </button>
                    <button
                      type="button"
                      className="building-btn"
                      onClick={() => {
                        setClientFormOpen(false);
                        setClientFormError(null);
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </label>
            </section>
            <section className="sell-form__section">
              <h4 className="sell-form__sectionTitle">Условия</h4>
            <label>
              <div className="sell-form__label">Тип операции</div>
              <div className="building-page__muted">
                {OPERATION_TYPE_LABELS[treatyOperationType] ||
                  treatyOperationType ||
                  "—"}
              </div>
            </label>
            <label>
              <div className="sell-form__label">Тип оплаты</div>
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
              <div className="sell-form__label">Сумма договора *</div>
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
            </section>
            <section className="sell-form__section">
              <h4 className="sell-form__sectionTitle">Файлы</h4>
            <label>
              <div className="sell-form__label">Прикрепить файлы</div>
              <div className="building-treaty-files">
                <input
                  id="treaty-files-input"
                  className="building-page__input"
                  type="file"
                  multiple
                  onChange={(e) => {
                    const added = Array.from(e.target.files || []);
                    setTreatyFiles((prev) => [...prev, ...added]);
                    e.target.value = "";
                  }}
                />
                {treatyFiles.length > 0 && (
                  <ul className="building-treaty-filesList">
                    {treatyFiles.map((file, idx) => (
                      <li key={`${file.name}-${idx}`} className="building-treaty-filesItem">
                        <span className="building-treaty-filesItemName" title={file.name}>
                          {file.name}
                        </span>
                        <button
                          type="button"
                          className="building-treaty-filesItemRemove"
                          onClick={() =>
                            setTreatyFiles((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                          title="Удалить"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="sell-form__hint">
                Можно добавлять несколько файлов. Сканы договора, подписанные акты и др.
              </p>
            </label>
            </section>
            {treatyPaymentType === "installment" && (
              <>
                <label>
                  <div className="sell-form__label">
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
                    <div className="sell-form__label">
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
                    <div className="sell-form__label">
                      Количество платежей (до {MAX_INSTALLMENT_MONTHS})
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={MAX_INSTALLMENT_MONTHS}
                      step="1"
                      className="building-page__input"
                      value={installmentMonths}
                      onChange={(e) => {
                        const v = Math.min(
                          Math.max(1, Number(e.target.value) || 1),
                          MAX_INSTALLMENT_MONTHS,
                        );
                        setInstallmentMonths(v);
                      }}
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
            <div className="sell-form__actions">
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
