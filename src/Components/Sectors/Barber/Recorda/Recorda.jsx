// Recorda.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../../api";
import { getAppointmentsSummarySafe } from "../../../../api/barberAppointments";
import { useUser } from "../../../../store/slices/userSlice";
import { getCompany } from "../../../../store/creators/userCreators";
import { useDispatch } from "react-redux";
import "./Recorda.scss";

import {
  fetchMastersAvailability,
  readWorkScheduleSettings,
  resolveRecordaWorkBounds,
  expandBoundsToFitRecords,
  buildTimeSlotLabels,
  buildAdaptiveCalendarGridSlots,
  clockMinFromDate,
} from "./components/recordaWorkHours";

import {
  RecordaHeader,
  RecordaCalendar,
  RecordaDayList,
  RecordaDaySummary,
  RecordaModal,
  RecordaDeletedView,
  RecordaWorkSchedulePanel,
} from "./components";
import {
  DELETED_STATUS,
  isScheduleBlocking,
  matchesStatusFilter,
  RECORDA_VIEW,
  RECORDA_LAYOUT,
  readRecordaLayoutPreference,
  writeRecordaLayoutPreference,
  clientNameOfRecord,
  clientPhoneOfRecord,
  formatGroupedServiceNames,
  computeDayExpectedSummary,
  formatDaySummaryDate,
  fmtMoney,
  pluralRecordsLabel,
  appointmentExpectedPrice,
  normalizeAppointmentsSummary,
} from "./components/RecordaUtils";

/* ===== utils ===== */
const pad = (n) => String(n).padStart(2, "0");

const toDate = (iso) => {
  const s = String(iso || "");
  if (s.length >= 10 && s[4] === "-" && s[7] === "-") return s.slice(0, 10);

  const d = new Date(iso);
  if (Number.isNaN(d)) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const toTime = (iso) => {
  const s = String(iso || "");
  const m = s.match(/T(\d{2}):(\d{2})/);
  if (m) return `${m[1]}:${m[2]}`;

  const d = new Date(iso);
  if (Number.isNaN(d)) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const asArray = (d) =>
  Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];

const fetchAllAppointments = async () => {
  const all = [];
  let page = 1;
  const pageSize = 500;

  while (page <= 50) {
    const { data } = await api.get("/barbershop/appointments/", {
      params: { page_size: pageSize, page },
    });
    const batch = asArray(data);
    all.push(...batch);
    if (!data?.next || batch.length < pageSize) break;
    page += 1;
  }

  return all;
};

const ts = (iso) => new Date(iso).getTime();

/* ===== размеры тайм-линии ===== */
const SLOT_MIN = 30;
const SLOT_PX = 32;
const PX_PER_MIN = SLOT_PX / SLOT_MIN;
const COL_HEADER_H = 60;
const SAFE_PAD = 150;

/* статусы, которые можно автоматически завершать */
const AUTO_COMPLETE_SOURCE = new Set(["booked", "confirmed"]);
const AUTO_COMPLETE_TARGET = "completed";

const Recorda = () => {
  const dispatch = useDispatch();
  const { profile, company } = useUser();
  const isOwnerOrAdmin =
    profile?.role === "owner" || profile?.role === "admin";

  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [mastersAvailability, setMastersAvailability] = useState(null);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const todayStr = () => {
    const n = new Date();
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  };

  const [fltDate, setFltDate] = useState(todayStr());
  const [fltBarber, setFltBarber] = useState("");
  const [fltStatus, setFltStatus] = useState("");
  const [pageView, setPageView] = useState(RECORDA_VIEW.SCHEDULE);
  const [dayLayout, setDayLayout] = useState(readRecordaLayoutPreference);
  const [workScheduleOpen, setWorkScheduleOpen] = useState(false);
  const [scheduleRevision, setScheduleRevision] = useState(0);
  const [apiSummary, setApiSummary] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [modalMode, setModalMode] = useState("booking");
  const [slotDraft, setSlotDraft] = useState(null);

  /* Проверка, сегодня ли выбранная дата */
  const isToday = fltDate === todayStr();

  /* Навигация по датам */
  const handlePrevDay = () => {
    const d = new Date(fltDate);
    d.setDate(d.getDate() - 1);
    setFltDate(toDate(d.toISOString()));
  };

  const handleNextDay = () => {
    const d = new Date(fltDate);
    d.setDate(d.getDate() + 1);
    setFltDate(toDate(d.toISOString()));
  };

  const handleToday = () => {
    setFltDate(todayStr());
  };

  /* загрузка всех данных */
  const fetchAll = async () => {
    try {
      setLoading(true);
      setPageError("");
      const [cl, em, sv, ap, cat] = await Promise.all([
        api.get("/barbershop/clients/", {
          params: { page_size: 1000, ordering: "full_name" },
        }),
        api.get("/users/employees/", {
          params: { page_size: 1000, ordering: "last_name,first_name" },
        }),
        api.get("/barbershop/services/", {
          params: { page_size: 1000, is_active: true, ordering: "service_name" },
        }),
        fetchAllAppointments(),
        api.get("/barbershop/service-categories/", {
          params: { page_size: 1000, ordering: "name" },
        }),
      ]);

      const cls = asArray(cl.data).map((c) => ({
        id: c.id,
        name: c.full_name || c.name || "",
        phone: c.phone || c.phone_number || "",
        status: c.status || "active",
      }));

      const emps = asArray(em.data).map((e) => {
        const first = e.first_name ?? "";
        const last = e.last_name ?? "";
        const name =
          ([last, first].filter(Boolean).join(" ").trim()) || e.email || "—";
        return { id: e.id, name };
      });

      const svcs = asArray(sv.data).map((s) => ({
        id: s.id,
        name: s.service_name || s.name || "",
        price: s.price == null ? null : Number(s.price),
        time: s.time || "",
        minutes: parseDurationMin(s.time || ""),
        active: s.is_active !== false,
        category_id: s.category || "",
        category_name: s.category_name || "",
        barbers: Array.isArray(s.barbers)
          ? s.barbers.map(String)
          : Array.isArray(s.barbers_detail)
          ? s.barbers_detail.map((b) => String(b.id))
          : [],
      }));

      const cats = asArray(cat.data).map((c) => ({
        id: c.id,
        name: c.name ?? "",
        active: c.is_active !== false,
      }));

      setClients(cls);
      setBarbers(emps);
      setServices(svcs);
      setServiceCategories(cats);
      setAppointments(Array.isArray(ap) ? ap : asArray(ap));
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        "Не удалось загрузить данные.";
      setPageError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener("barber:booking-confirmed", handler);
    return () => window.removeEventListener("barber:booking-confirmed", handler);
  }, []);

  const fetchSummary = useCallback(async () => {
    const isDeletedViewNow = pageView === RECORDA_VIEW.DELETED;

    if (isDeletedViewNow && !isOwnerOrAdmin) {
      setApiSummary(null);
      return;
    }

    try {
      const params = isDeletedViewNow
        ? { scope: "deleted" }
        : { date: fltDate };

      if (fltBarber) params.barber = fltBarber;
      if (!isDeletedViewNow && fltStatus) params.status = fltStatus;

      const data = await getAppointmentsSummarySafe(params);
      const normalized = normalizeAppointmentsSummary(data, {
        dateLabel: formatDaySummaryDate(fltDate, fltDate === todayStr()),
      });
      setApiSummary(normalized);
    } catch {
      setApiSummary(null);
    }
  }, [
    pageView,
    fltDate,
    fltBarber,
    fltStatus,
    isOwnerOrAdmin,
  ]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, appointments]);

  useEffect(() => {
    const handler = () => setScheduleRevision((v) => v + 1);
    window.addEventListener("barber:work-schedule-changed", handler);
    return () =>
      window.removeEventListener("barber:work-schedule-changed", handler);
  }, []);

  const settingsWorkBounds = useMemo(
    () => readWorkScheduleSettings(company),
    [company, scheduleRevision],
  );

  useEffect(() => {
    let cancelled = false;
    const slug = company?.slug;
    if (!slug || !fltDate) {
      setMastersAvailability(null);
      return undefined;
    }

    fetchMastersAvailability(slug, fltDate, fltBarber || null).then((data) => {
      if (!cancelled) setMastersAvailability(data);
    });

    return () => {
      cancelled = true;
    };
  }, [company?.slug, fltDate, fltBarber]);

  const isDeletedView = pageView === RECORDA_VIEW.DELETED;

  /* записи за выбранный день */
  // NOTE: Client-side filtering is a temporary solution
  // TODO: Backend should support ?date=YYYY-MM-DD&status= params for appointments
  const dayRecords = useMemo(() => {
    let records = appointments.filter((r) => toDate(r.start_at) === fltDate);

    records = records.filter((r) => r.status !== DELETED_STATUS);

    if (fltStatus) {
      records = records.filter((r) => matchesStatusFilter(r.status, fltStatus));
    }

    return records;
  }, [appointments, fltDate, fltStatus]);

  const deletedRecords = useMemo(() => {
    let records = appointments.filter((r) => r.status === DELETED_STATUS);

    if (fltBarber) {
      records = records.filter((r) => String(r.barber) === String(fltBarber));
    }

    return records.sort((a, b) => ts(b.start_at) - ts(a.start_at));
  }, [appointments, fltBarber]);

  const deletedCount = useMemo(
    () => appointments.filter((r) => r.status === DELETED_STATUS).length,
    [appointments]
  );

  const headerRecordsCount = isDeletedView ? deletedRecords.length : dayRecords.length;

  const calendarDayRecords = useMemo(() => {
    if (!fltBarber) return dayRecords;
    return dayRecords.filter((r) => String(r.barber) === String(fltBarber));
  }, [dayRecords, fltBarber]);

  const bookingWorkBounds = useMemo(
    () =>
      resolveRecordaWorkBounds({
        availability: mastersAvailability,
        barberId: fltBarber || null,
        settingsBounds: settingsWorkBounds,
      }),
    [mastersAvailability, fltBarber, settingsWorkBounds],
  );

  const workBounds = useMemo(
    () => expandBoundsToFitRecords(bookingWorkBounds, calendarDayRecords),
    [bookingWorkBounds, calendarDayRecords],
  );

  const daySummary = useMemo(() => {
    const fallback = computeDayExpectedSummary({
      records: calendarDayRecords,
      services,
      dateLabel: formatDaySummaryDate(fltDate, isToday),
    });

    if (apiSummary?.fromApi && apiSummary.scope === "day") {
      return {
        dateLabel: fallback.dateLabel,
        count: apiSummary.count,
        expectedTotal: apiSummary.expectedTotal,
      };
    }

    return fallback;
  }, [apiSummary, calendarDayRecords, services, fltDate, isToday]);

  const deletedSummary = useMemo(() => {
    const fallback = {
      count: deletedRecords.length,
      expectedTotal: deletedRecords.reduce(
        (sum, r) => sum + appointmentExpectedPrice(r, services),
        0,
      ),
    };

    if (apiSummary?.fromApi && apiSummary.scope === "deleted") {
      return {
        count: apiSummary.count,
        expectedTotal: apiSummary.expectedTotal,
      };
    }

    return fallback;
  }, [apiSummary, deletedRecords, services]);

  /* сетка: 30 мин, с 10-мин делением только в блоках с «короткими» записями */
  const { calendarGridSlots, gutterBlocks, calendarBodyHeight } = useMemo(() => {
    const { slots, gutterBlocks: blocks, totalHeightPx } =
      buildAdaptiveCalendarGridSlots(
        workBounds.startMin,
        workBounds.endMin,
        dayRecords,
        workBounds,
        { slotMin: SLOT_MIN, slotPx: SLOT_PX },
      );
    return {
      calendarGridSlots: slots,
      gutterBlocks: blocks,
      calendarBodyHeight: totalHeightPx,
    };
  }, [workBounds, dayRecords]);

  const calendarHeight = useMemo(
    () => calendarBodyHeight + COL_HEADER_H + SAFE_PAD,
    [calendarBodyHeight],
  );

  const totalGridSlots = calendarGridSlots.length;

  /* подсветка занятых интервалов в колонке времени */
  const busySlots = useMemo(() => {
    const set = new Set();
    const bounds = workBounds;
    calendarGridSlots.forEach((slot, i) => {
      const slotStart = slot.startMin;
      const slotEnd = slotStart + slot.gridMin;
      const busy = dayRecords.some((r) => {
        if (!isScheduleBlocking(r.status)) return false;
        const s = new Date(r.start_at);
        const e = new Date(r.end_at);
        const rs = clockMinFromDate(s, bounds);
        const re = clockMinFromDate(e, bounds);
        return rs < slotEnd && slotStart < re;
      });
      if (busy) set.add(i);
    });
    return set;
  }, [dayRecords, workBounds, calendarGridSlots]);

  const busyGutterBlocks = useMemo(() => {
    const set = new Set();
    const bounds = workBounds;
    gutterBlocks.forEach((block, i) => {
      const blockEnd = block.startMin + block.blockMin;
      const busy = dayRecords.some((r) => {
        if (!isScheduleBlocking(r.status)) return false;
        const s = new Date(r.start_at);
        const e = new Date(r.end_at);
        const rs = clockMinFromDate(s, bounds);
        const re = clockMinFromDate(e, bounds);
        return rs < blockEnd && block.startMin < re;
      });
      if (busy) set.add(i);
    });
    return set;
  }, [dayRecords, workBounds, gutterBlocks]);

  /* группировка записей по мастерам */
  const recordsByBarber = useMemo(() => {
    const map = new Map();
    barbers.forEach((b) => map.set(String(b.id), []));
    dayRecords.forEach((r) => {
      const key = String(r.barber);
      const list = map.get(key) || [];
      list.push(r);
      map.set(key, list);
    });
    map.forEach((list) =>
      list.sort((a, b) => ts(a.start_at) - ts(b.start_at))
    );
    return map;
  }, [dayRecords, barbers]);

  const serviceNamesFromRecord = (r) => {
    if (Array.isArray(r.services_names) && r.services_names.length) {
      return formatGroupedServiceNames(r.services_names);
    }
    if (Array.isArray(r.services_public) && r.services_public.length) {
      const names = r.services_public
        .map((s) => s?.name || s?.title || "")
        .filter(Boolean);
      if (names.length) return formatGroupedServiceNames(names);
    }
    if (Array.isArray(r.services) && r.services.length) {
      const names = r.services
        .map((item) => {
          if (typeof item === "object" && item !== null) {
            return item?.name ?? item?.title ?? item?.service?.name ?? "";
          }
          return services.find((s) => String(s.id) === String(item))?.name || "";
        })
        .filter(Boolean);
      if (names.length) return formatGroupedServiceNames(names);
    }
    return r.service_name || "—";
  };

  const clientName = (r) => clientNameOfRecord(r, clients) || "—";

  const clientPhone = (r) => clientPhoneOfRecord(r, clients);

  const handleOpenNew = () => {
    setSlotDraft(null);
    setCurrentRecord(null);
    setModalMode("booking");
    setModalOpen(true);
  };

  const handleOpenWalkIn = () => {
    setSlotDraft(null);
    setCurrentRecord(null);
    setModalMode("walkin");
    setModalOpen(true);
  };

  const handleOpenExisting = (rec) => {
    setSlotDraft(null);
    setCurrentRecord(rec);
    setModalMode("booking");
    setModalOpen(true);
  };

  const handleOpenSlot = ({ barberId, startTime }) => {
    setSlotDraft({
      barberId: String(barberId),
      startTime: String(startTime),
    });
    setCurrentRecord(null);
    setModalMode("booking");
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSlotDraft(null);
  };

  const handleOpenDeletedView = () => {
    setPageView(RECORDA_VIEW.DELETED);
    setFltStatus("");
  };

  const handleBackToSchedule = () => {
    setPageView(RECORDA_VIEW.SCHEDULE);
  };

  const handleDayLayoutChange = (layout) => {
    setDayLayout(layout);
    writeRecordaLayoutPreference(layout);
  };

  useEffect(() => {
    if (!isOwnerOrAdmin && isDeletedView) {
      setPageView(RECORDA_VIEW.SCHEDULE);
    }
  }, [isOwnerOrAdmin, isDeletedView]);

  /* ===== авто-завершение записей после конца времени ===== */
  useEffect(() => {
    const checkAndAutoComplete = async () => {
      if (!appointments.length) return;
      const now = Date.now();

      const toUpdate = appointments.filter((a) => {
        if (!a.end_at) return false;
        if (!AUTO_COMPLETE_SOURCE.has(a.status)) return false;
        const endTs = new Date(a.end_at).getTime();
        return Number.isFinite(endTs) && endTs <= now;
      });

      if (!toUpdate.length) return;

      try {
        await Promise.all(
          toUpdate.map((a) =>
            api.patch(`/barbershop/appointments/${a.id}/`, {
              status: AUTO_COMPLETE_TARGET,
            })
          )
        );
        await fetchAll();
      } catch (e) {
        console.error("Авто-завершение записей:", e);
      }
    };

    checkAndAutoComplete();
    const timer = setInterval(checkAndAutoComplete, 60_000);
    return () => clearInterval(timer);
  }, [appointments]);

  return (
    <div className="barberrecorda">
      {!isDeletedView ? (
        <RecordaDaySummary
          dateLabel={daySummary.dateLabel}
          count={daySummary.count}
          expectedTotal={daySummary.expectedTotal}
          records={calendarDayRecords}
          services={services}
          clients={clients}
          dayLayout={dayLayout}
          onDayLayoutChange={handleDayLayoutChange}
        />
      ) : null}

      <RecordaHeader
        viewMode={pageView}
        fltDate={fltDate}
        fltBarber={fltBarber}
        fltStatus={fltStatus}
        barbers={barbers}
        recordsCount={headerRecordsCount}
        deletedCount={deletedCount}
        onDateChange={setFltDate}
        onBarberChange={setFltBarber}
        onStatusChange={setFltStatus}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        onToday={handleToday}
        isToday={isToday}
        onAddClick={handleOpenNew}
        onWalkInClick={handleOpenWalkIn}
        onOpenDeletedView={handleOpenDeletedView}
        onBackToSchedule={handleBackToSchedule}
        canViewDeleted={isOwnerOrAdmin}
        workBounds={workBounds}
        onOpenWorkSchedule={() => setWorkScheduleOpen(true)}
      />

      <RecordaWorkSchedulePanel
        open={workScheduleOpen && !isDeletedView}
        onClose={() => setWorkScheduleOpen(false)}
        company={company}
        workBounds={workBounds}
        canEdit={isOwnerOrAdmin}
        onSaved={async (result) => {
          setScheduleRevision((v) => v + 1);
          if (result?.savedToApi) {
            await dispatch(getCompany());
          }
        }}
      />

      {pageError && (
        <div className="barberrecorda__alert barberrecorda__alert--danger">
          {pageError}
        </div>
      )}

      {isDeletedView ? (
        <div className="barberrecorda__daySummary barberrecorda__daySummary--deleted">
          <span className="barberrecorda__daySummaryLead">Удалённые</span>
          <span className="barberrecorda__daySummaryItem">
            <strong>{deletedSummary.count}</strong>{" "}
            {pluralRecordsLabel(deletedSummary.count)}
          </span>
          {deletedSummary.count > 0 ? (
            <span className="barberrecorda__daySummaryItem barberrecorda__daySummaryItem--money">
              на сумму <strong>{fmtMoney(deletedSummary.expectedTotal)}</strong>
            </span>
          ) : null}
        </div>
      ) : null}

      {isDeletedView ? (
        <RecordaDeletedView
          records={deletedRecords}
          loading={loading}
          barbers={barbers}
          onRecordClick={handleOpenExisting}
          serviceNamesFromRecord={serviceNamesFromRecord}
          clientName={clientName}
          clientPhone={clientPhone}
          toTime={toTime}
        />
      ) : dayLayout === RECORDA_LAYOUT.LIST ? (
        <RecordaDayList
          records={calendarDayRecords}
          loading={loading}
          barbers={barbers}
          showBarberColumn={!fltBarber}
          dayTotal={daySummary.expectedTotal}
          dayCount={daySummary.count}
          onRecordClick={handleOpenExisting}
          serviceNamesFromRecord={serviceNamesFromRecord}
          clientName={clientName}
          clientPhone={clientPhone}
          toTime={toTime}
          getRecordPrice={(record) => appointmentExpectedPrice(record, services)}
        />
      ) : (
        <RecordaCalendar
          barbers={barbers}
          fltBarber={fltBarber}
          recordsByBarber={recordsByBarber}
          calendarGridSlots={calendarGridSlots}
          gutterBlocks={gutterBlocks}
          busyGutterBlocks={busyGutterBlocks}
          calendarHeight={calendarHeight}
          busySlots={busySlots}
          loading={loading}
          toTime={toTime}
          serviceNamesFromRecord={serviceNamesFromRecord}
          clientName={clientName}
          clientPhone={clientPhone}
          COL_HEADER_H={COL_HEADER_H}
          PX_PER_MIN={PX_PER_MIN}
          workBounds={workBounds}
          onRecordClick={handleOpenExisting}
          onSlotClick={handleOpenSlot}
          isToday={isToday}
          getRecordPrice={(record) => appointmentExpectedPrice(record, services)}
        />
      )}

      {modalOpen && (
        <RecordaModal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          currentRecord={currentRecord}
          initialMode={modalMode}
          slotDraft={slotDraft}
          clients={clients}
          barbers={barbers}
          services={services}
          serviceCategoryList={serviceCategories}
          appointments={appointments}
          defaultDate={fltDate || todayStr()}
        workBounds={bookingWorkBounds}
        onReload={fetchAll}
        onClientsChange={setClients}
      />
      )}
    </div>
  );
};

export default Recorda;

/* строка времени услуги -> минуты */
function parseDurationMin(raw) {
  if (raw == null) return 0;
  const s = String(raw).trim().toLowerCase();
  const hm = s.match(/^(\d{1,2})\s*:\s*(\d{1,2})$/);
  if (hm) {
    const h = +hm[1] || 0;
    const m = +hm[2] || 0;
    return Math.max(0, h * 60 + m);
  }
  const m2 = s.match(
    /(?:(\d+)\s*(?:час|ч|h)[а-я]*)?\s*(?:(\d+)\s*(?:мин|m|min)?)?/
  );
  if (m2 && (m2[1] || m2[2])) {
    return (+m2[1] || 0) * 60 + (+m2[2] || 0);
  }
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}
