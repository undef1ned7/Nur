// Recorda.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../../../api";
import "./Recorda.scss";
import { FaSearch, FaPlus, FaTimes, FaChevronDown, FaCalendarAlt } from "react-icons/fa";

/* ===== utils ===== */
const pad = (n) => String(n).padStart(2, "0");
const norm = (s) => String(s || "").trim();
const normalizePhone = (p) => norm(p).replace(/[^\d]/g, "");
const isValidPhone = (p) => normalizePhone(p).length >= 10;
const normalizeName = (s) => norm(s).replace(/\s+/g, " ").toLowerCase();
const toDate = (iso) => { if (!iso) return ""; const d = new Date(iso); if (Number.isNaN(d)) return ""; return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const toTime = (iso) => { if (!iso) return ""; const d = new Date(iso); if (Number.isNaN(d)) return ""; return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const asArray = (d) => (Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : []);
const fmtMoney = (v) => (v === null || v === undefined || v === "" ? "—" : `${Number(v).toLocaleString("ru-RU")} сом`);

const TZ = "+06:00";
const makeISO = (date, time) => `${date}T${time}:00${TZ}`;
const ts = (iso) => new Date(iso).getTime();
const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

const SLOT_MIN = 30;
const SLOT_PX  = 56;
const PX_PER_MIN = SLOT_PX / SLOT_MIN;
const COL_HEADER_H = 56;
const MIN_EVENT_H = 104;
const SAFE_PAD = 72;

const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;

const addMins = (hhmm, mins) => {
  const [h, m] = String(hhmm||"").split(":").map(Number);
  const total = (h*60+m) + mins;
  const H = Math.floor(total/60), M = ((total%60)+60)%60;
  return `${pad(H)}:${pad(M)}`;
};
const minsOf = (hhmm) => { const [h,m] = String(hhmm||"").split(":").map(Number); return h*60+m; };
const inRange = (hhmm) => { const mm = minsOf(hhmm); return mm >= OPEN_HOUR*60 && mm <= CLOSE_HOUR*60; };
const clampToRange = (hhmm) => {
  const mm = minsOf(hhmm);
  if (mm < OPEN_HOUR*60) return `${pad(OPEN_HOUR)}:00`;
  if (mm > CLOSE_HOUR*60) return `${pad(CLOSE_HOUR)}:00`;
  return hhmm;
};

/* строка времени услуги -> минуты */
const parseDurationMin = (raw) => {
  if (raw == null) return 0;
  const s = String(raw).trim().toLowerCase();
  const hm = s.match(/^(\d{1,2})\s*:\s*(\d{1,2})$/);
  if (hm) { const h = +hm[1]||0, m = +hm[2]||0; return Math.max(0, h*60+m); }
  const m2 = s.match(/(?:(\d+)\s*(?:час|ч|h)[а-я]*)?\s*(?:(\d+)\s*(?:мин|m|min)?)?/);
  if (m2 && (m2[1] || m2[2])) { return (+m2[1]||0)*60 + (+m2[2]||0); }
  const n = Number(s.replace(/[^\d.]/g,""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};

const estimateContentMin = (svc, client, phone) => {
  const wrapLen = 30;
  const lines = 1 + Math.ceil(String(svc||"").length / wrapLen) + Math.ceil(String(client||"").length / wrapLen) + (phone ? 1 : 0);
  return 30 + lines * 20 + 14;
};

const BLOCKING = new Set(["booked", "confirmed", "completed", "no_show"]);
const STATUS_LABELS = { booked:"Забронировано", confirmed:"Подтверждено", completed:"Завершено", canceled:"Отменено", no_show:"Не пришёл" };

/* ===== ComboBox (показывает и disabled-элементы) ===== */
const ComboBox = ({ items, value, onChange, placeholder="Выберите", triggerClass="", listMaxHeight=260 }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    const base = items; // не фильтруем disabled — хотим их видеть затенёнными
    if (!text) return base;
    return base.filter((i)=>(i.search||i.label).toLowerCase().includes(text));
  }, [items, q]);

  useEffect(()=>{
    const onDoc = (e)=>{ if (!wrapRef.current) return; if (!wrapRef.current.contains(e.target)) setOpen(false); };
    const onEsc = (e)=>{ if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return ()=>{ document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, []);
  useEffect(()=>{ if (open) setTimeout(()=>inputRef.current?.focus?.(), 0); }, [open]);

  const selected = items.find((i)=>String(i.id)===String(value));
  return (
    <div className={`barberrecorda__combo ${open ? "is-open":""}`} ref={wrapRef}>
      <button
        type="button"
        className={`barberrecorda__comboTrigger ${triggerClass}`}
        onClick={()=>setOpen(o=>!o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selected?.label || placeholder}
      >
        <span className={`barberrecorda__comboText ${selected?"":"is-placeholder"}`}>{selected?.label || placeholder}</span>
        <FaChevronDown className="barberrecorda__comboCaret" />
      </button>

      {open && (
        <div className="barberrecorda__comboPopup" role="listbox" style={{maxHeight:listMaxHeight}}>
          <div className="barberrecorda__comboSearch">
            <FaSearch className="barberrecorda__comboSearchIcon" />
            <input
              ref={inputRef}
              className="barberrecorda__comboSearchInput"
              placeholder={`Поиск ${placeholder.toLowerCase()}…`}
              value={q}
              onChange={(e)=>setQ(e.target.value)}
            />
          </div>

          <div className="barberrecorda__comboList">
            {filtered.length===0
              ? <div className="barberrecorda__comboEmpty">Ничего не найдено</div>
              : filtered.map(it=>(
                  <button
                    key={it.id}
                    type="button"
                    className={`barberrecorda__comboOption ${it.disabled?"is-disabled":""}`}
                    onClick={()=>{ if (!it.disabled){ onChange?.(it.id,it); setOpen(false); } }}
                    disabled={it.disabled}
                    title={it.hint || it.label}
                  >
                    {it.label}
                  </button>
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
};

/* ===== TimeField ===== */
const TimeField = ({ value, onChange, invalid }) => {
  const [h, m] = (value || `${pad(OPEN_HOUR)}:00`).split(":").map(v => parseInt(v || 0, 10));
  const hours = Array.from({length: CLOSE_HOUR - OPEN_HOUR + 1}, (_,i)=>OPEN_HOUR + i);
  const minutes = Array.from({length: 60}, (_,i)=>i);

  const setHM = (H, M) => {
    let hh = Math.min(Math.max(H, OPEN_HOUR), CLOSE_HOUR);
    let mm = Math.min(Math.max(M, 0), 59);
    if (hh === CLOSE_HOUR) mm = 0;
    onChange(`${pad(hh)}:${pad(mm)}`);
  };

  return (
    <div className={`br-time ${invalid ? "is-invalid-input":""}`}>
      <select className="br-time__h" value={pad(h || OPEN_HOUR)} onChange={(e)=>setHM(parseInt(e.target.value,10), m || 0)}>
        {hours.map(H => <option key={H} value={pad(H)}>{pad(H)}</option>)}
      </select>
      <span className="br-time__sep">:</span>
      <select className="br-time__m" value={pad(h === CLOSE_HOUR ? 0 : (isNaN(m)?0:m))} onChange={(e)=>setHM(h || OPEN_HOUR, parseInt(e.target.value,10))}>
        {minutes.map(M => <option key={M} value={pad(M)}>{pad(M)}</option>)}
      </select>
    </div>
  );
};

/* ===== Services picker ===== */
const ServicesPicker = ({ items, selectedIds, onChange, summary }) => {
  const already = new Set(selectedIds.map(String));
  const available = items.filter(i => !already.has(String(i.id)));
  const onPick = (id) => { const sid = String(id); if (!already.has(sid)) onChange([...selectedIds, sid]); };
  const remove = (sid) => onChange(selectedIds.filter(id => String(id)!==String(sid)));

  return (
    <div className="barberrecorda__svcField">
      <div className="barberrecorda__svcRow">
        <ComboBox
          items={available.map(it=>({
            ...it,
            label: [
              it.label,
              (it.minutes ? ` · ⏱ ${it.minutes} мин` : ""),
              (Number.isFinite(it.price) ? ` · ${fmtMoney(it.price)}` : "")
            ].filter(Boolean).join("")
          }))}
          value=""
          onChange={(id)=>onPick(id)}
          placeholder="Добавьте услугу"
        />
      </div>

      {selectedIds.length>0 && (
        <>
          <div className="barberrecorda__svcSummary">
            <span>Итого: <b>{selectedIds.length}</b> {selectedIds.length===1?"услуга":"услуг"}</span>
            <span>·</span>
            <span>Время: <b>{summary.totalMinutes}</b> мин</span>
            <span>·</span>
            <span>Сумма: <b>{fmtMoney(summary.totalPrice)}</b></span>
          </div>

          <div className="barberrecorda__svcList">
            {selectedIds.map(id=>{
              const it = items.find(x => String(x.id)===String(id));
              const name = it?.label || "Услуга";
              const mm = it?.minutes || 0;
              const price = it?.price;
              return (
                <span key={id} className="barberrecorda__svcChip" title={name}>
                  <span className="barberrecorda__svcName">{name}</span>
                  <span className="barberrecorda__svcMeta">
                    {mm ? `⏱ ${mm} мин` : "—"}
                    {Number.isFinite(price) ? ` · ${fmtMoney(price)}` : ""}
                  </span>
                  <button type="button" className="barberrecorda__svcDel" aria-label="Убрать услугу" onClick={()=>remove(id)}>
                    <FaTimes/>
                  </button>
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

const Recorda = () => {
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const todayStr = () => { const n=new Date(); return `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`; };
  const [fltDate, setFltDate] = useState(todayStr());
  const [fltBarber, setFltBarber] = useState("");

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formAlerts, setFormAlerts] = useState([]);
  const [fieldErrs, setFieldErrs] = useState({});

  // form state
  const [selClient, setSelClient] = useState("");
  const [startDate, setStartDate] = useState("");
  const [selServices, setSelServices] = useState([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [autoEnd, setAutoEnd] = useState(true);
  const [selBarber, setSelBarber] = useState("");
  const [status, setStatus] = useState("booked");
  const [comment, setComment] = useState("");

  // mini client
  const [miniOpen, setMiniOpen] = useState(false);
  const [miniName, setMiniName] = useState("");
  const [miniPhone, setMiniPhone] = useState("");
  const [miniSaving, setMiniSaving] = useState(false);
  const [miniAlerts, setMiniAlerts] = useState([]);
  const [miniErrs, setMiniErrs] = useState({});

  /* fetch */
  const fetchAll = async () => {
    try{
      setLoading(true); setPageError("");
      const [cl, em, sv, ap] = await Promise.all([
        api.get("/barbershop/clients/"),
        api.get("/users/employees/"),
        api.get("/barbershop/services/"),
        api.get("/barbershop/appointments/"),
      ]);

      const cls = asArray(cl.data)
        .filter((c)=>["active","vip",""].includes(String(c.status||"").toLowerCase()))
        .map((c)=>({ id:c.id, name:c.full_name||c.name||"", phone:c.phone||c.phone_number||"", status:c.status||"active" }))
        .sort((a,b)=>a.name.localeCompare(b.name,"ru"));

      const emps = asArray(em.data)
        .map((e)=>{ const first=e.first_name??""; const last=e.last_name??""; const name=([last,first].filter(Boolean).join(" ").trim())||e.email||"—"; return { id:e.id, name }; })
        .sort((a,b)=>a.name.localeCompare(b.name,"ru"));

      const svcs = asArray(sv.data)
        .filter((s)=>s.is_active!==false)
        .map((s)=>({ id:s.id, name:s.service_name||s.name||"", price:s.price==null?null:Number(s.price), time:s.time||"", minutes:parseDurationMin(s.time||""), active:s.is_active!==false }))
        .sort((a,b)=>a.name.localeCompare(b.name,"ru"));

      setClients(cls); setBarbers(emps); setServices(svcs);
      setAppointments(asArray(ap.data));
    }catch(e){
      setPageError(e?.response?.data?.detail || "Не удалось загрузить данные.");
    }finally{ setLoading(false); }
  };
  useEffect(()=>{ fetchAll(); }, []);

  /* day view */
  const dayRecords = useMemo(()=>appointments.filter(r=>toDate(r.start_at)===fltDate),[appointments, fltDate]);

  /* grid times */
  const timesAll = useMemo(()=>{
    const arr=[]; for (let m=OPEN_HOUR*60; m<=CLOSE_HOUR*60; m+=SLOT_MIN){ arr.push(`${pad(Math.floor(m/60))}:${pad(m%60)}`);} return arr;
  },[]);
  const calendarHeight = useMemo(()=> (timesAll.length-1)*SLOT_PX + COL_HEADER_H + SAFE_PAD, [timesAll]);

  const timeBounds = useMemo(()=>({ startH:OPEN_HOUR, endH:CLOSE_HOUR }),[]);
  const totalSlots = (timeBounds.endH - timeBounds.startH) * (60 / SLOT_MIN);

  const busySlots = useMemo(()=>{
    const set = new Set();
    for (let i=0;i<totalSlots;i++){
      const slotStart = timeBounds.startH*60 + i*SLOT_MIN;
      const slotEnd = slotStart + SLOT_MIN;
      const busy = dayRecords.some(r=>{
        const s=new Date(r.start_at), e=new Date(r.end_at);
        const rs=s.getHours()*60 + s.getMinutes();
        const re=e.getHours()*60 + e.getMinutes();
        return rs < slotEnd && slotStart < re;
      });
      if (busy) set.add(i);
    }
    return set;
  }, [dayRecords, timeBounds, totalSlots]);

  const recordsByBarber = useMemo(()=>{
    const map = new Map();
    barbers.forEach(b=>map.set(String(b.id), []));
    dayRecords.forEach(r=>{
      const key=String(r.barber);
      const list=map.get(key) || [];
      list.push(r); map.set(key, list);
    });
    map.forEach((list)=>list.sort((a,b)=>ts(a.start_at)-ts(b.start_at)));
    return map;
  }, [dayRecords, barbers]);

  const serviceNamesFromRecord = (r) => {
    if (Array.isArray(r.services_names) && r.services_names.length) return r.services_names.join(", ");
    if (Array.isArray(r.services) && r.services.length) {
      const names = r.services.map(id => services.find(s => String(s.id)===String(id))?.name || id);
      return names.join(", ");
    }
    return r.service_name || "—";
  };
  const clientName  = (r) => r.client_name || clients.find(c => String(c.id)===String(r.client))?.name || "—";
  const clientPhone = (r) => r.client_phone || clients.find(c => String(c.id)===String(r.client))?.phone || "";

  const layoutForBarber = (list)=>{
    const items = list.map(r=>{
      const start=new Date(r.start_at), end=new Date(r.end_at);
      const startM=start.getHours()*60 + start.getMinutes();
      const endM=end.getHours()*60 + end.getMinutes();
      const topMin=Math.max(0, startM - timeBounds.startH*60);
      const durMin=Math.max(15, endM - startM);

      const svc = serviceNamesFromRecord(r);
      const cl  = clientName(r);
      const ph  = clientPhone(r);

      const heightByTime = durMin*PX_PER_MIN;
      const heightByText = estimateContentMin(svc, cl, ph);

      return { r, tStart:startM, tEnd:endM, top: topMin*PX_PER_MIN + COL_HEADER_H, height: Math.max(MIN_EVENT_H, heightByTime, heightByText) };
    });

    const lanes=[];
    items.forEach(it=>{
      let lane=0;
      for(; lane<lanes.length; lane++){ if (it.tStart >= lanes[lane]) break; }
      if (lane===lanes.length) lanes.push(it.tEnd); else lanes[lane]=it.tEnd;
      it.lane=lane; it.lanes=lanes.length;
    });

    const GAP=10;
    items.forEach(it=>{
      const widthPct = (100 - (it.lanes-1)*GAP) / it.lanes;
      const { bg, border, shadow } = colorByStatus(it.r.status);
      it.style = {
        top: `${it.top}px`,
        height: `${it.height-6}px`,
        left: `calc(${it.lane*(widthPct+GAP)}% )`,
        width: `${widthPct}%`,
        background: bg,
        borderColor: border,
        boxShadow: shadow,
      };
    });
    return items;
  };

  const colorByStatus = (status) => {
    switch (status) {
      case "booked":    return { bg: "#DBEAFF", border: "#3B82F6", shadow: "0 6px 18px rgba(59,130,246,.18)" };
    case "confirmed": return { bg: "#EDE9FF", border: "#7C3AED", shadow: "0 6px 18px rgba(124,58,237,.18)" };
      case "completed": return { bg: "#DCFCE7", border: "#16A34A", shadow: "0 6px 18px rgba(22,163,74,.18)" };
      case "canceled":  return { bg: "#FEE2E2", border: "#EF4444", shadow: "0 6px 18px rgba(239,68,68,.18)" };
      case "no_show":   return { bg: "#FEF3C7", border: "#F59E0B", shadow: "0 6px 18px rgba(245,158,11,.18)" };
      default:          return { bg: "#F3F4F6", border: "#D1D5DB", shadow: "0 6px 18px rgba(2,6,23,.08)" };
    }
  };

  /* combobox sources */
  const activeClientItems = useMemo(()=>clients.map(c=>({id:String(c.id), label:c.name||"Без имени", search:`${c.name} ${c.phone}`})),[clients]);

  const serviceItems  = useMemo(()=>services.filter(s=>s.active).map(s=>({
    id:String(s.id),
    label:s.name,
    search:`${s.name} ${s.time||""} ${s.price||""}`,
    price: Number.isFinite(s.price) ? Number(s.price) : null,
    minutes: s.minutes || 0
  })),[services]);

  const servicesSummary = useMemo(()=>{
    let totalMinutes = 0;
    let totalPrice = 0;
    selServices.forEach(id=>{
      const it = serviceItems.find(s=>String(s.id)===String(id));
      if (it) {
        totalMinutes += it.minutes || 0;
        if (Number.isFinite(it.price)) totalPrice += it.price;
      }
    });
    return { totalMinutes, totalPrice };
  }, [selServices, serviceItems]);

  /* авто-конец */
  useEffect(()=>{
    if (!autoEnd) return;
    const base = startTime || `${pad(OPEN_HOUR)}:00`;
    const total = servicesSummary.totalMinutes || 30;
    let mm = minsOf(base) + total;
    const max = CLOSE_HOUR*60;
    if (mm > max) mm = max;
    const H = Math.floor(mm/60), M = mm%60;
    setEndTime(`${pad(H)}:${pad(H===CLOSE_HOUR?0:M)}`);
  }, [startTime, servicesSummary.totalMinutes, autoEnd]);

  /* занятость сотрудников на выбранном интервале */
  const selectedStartISO = useMemo(()=> (startDate && startTime) ? makeISO(startDate, startTime) : null, [startDate, startTime]);
  const selectedEndISO   = useMemo(()=> (startDate && endTime)   ? makeISO(startDate, endTime)   : null, [startDate, endTime]);

  const busyBarbersOnInterval = useMemo(()=>{
    const set = new Set();
    if (!selectedStartISO || !selectedEndISO) return set;
    const t1 = ts(selectedStartISO), t2 = ts(selectedEndISO);
    appointments.forEach(a=>{
      if (toDate(a.start_at)!==startDate) return;
      if (!BLOCKING.has(a.status)) return;
      if (current?.id && String(current.id)===String(a.id)) return;
      if (overlaps(t1,t2,ts(a.start_at),ts(a.end_at))) set.add(String(a.barber));
    });
    return set;
  }, [appointments, selectedStartISO, selectedEndISO, startDate, current]);

  const barberItems = useMemo(()=>{
    const busy = busyBarbersOnInterval;
    const arr = barbers.map(b=>{
      const isBusy = busy.has(String(b.id));
      return {
        id:String(b.id),
        label: `${b.name} ${isBusy ? "· занят" : "· свободен"}`,
        search: `${b.name} ${isBusy?"занят":"свободен"}`,
        disabled: isBusy,
        hint: isBusy ? "Пересечение с другой записью в выбранный интервал" : "Свободен"
      };
    });
    arr.sort((a,b)=> (a.disabled - b.disabled) || a.label.localeCompare(b.label,"ru"));
    return arr;
  }, [barbers, busyBarbersOnInterval]);

  /* strict time setters */
  const setStartStrict = (v) => {
    const vv = clampToRange(v);
    setStartTime(vv);
    if (!autoEnd && minsOf(endTime) <= minsOf(vv)) {
      const mm = Math.min(minsOf(vv)+1, CLOSE_HOUR*60);
      const H = Math.floor(mm/60), M = mm%60;
      setEndTime(`${pad(H)}:${pad(H===CLOSE_HOUR?0:M)}`);
    }
  };
  const setEndStrict = (v) => {
    let vv = clampToRange(v);
    if (minsOf(vv) <= minsOf(startTime)) {
      const mm = Math.min(minsOf(startTime)+1, CLOSE_HOUR*60);
      const H = Math.floor(mm/60), M = mm%60;
      vv = `${pad(H)}:${pad(H===CLOSE_HOUR?0:M)}`;
    }
    setEndTime(vv);
    setAutoEnd(false);
  };

  /* open/close modal */
  const openModal = (rec=null, opts={})=>{
    setCurrent(rec); setFormAlerts([]); setFieldErrs({});
    if (rec){
      setSelClient(String(rec.client||""));
      const recSvcs = Array.isArray(rec.services) ? rec.services.map(String) : (rec.service ? [String(rec.service)] : []);
      setSelServices(recSvcs);
      setStartDate(toDate(rec.start_at));
      setStartTime(clampToRange(toTime(rec.start_at)));
      setEndTime(clampToRange(toTime(rec.end_at)));
      setAutoEnd(false);
      setSelBarber(String(rec.barber||""));
      setStatus(rec.status||"booked");
      setComment(rec.comment||"");
    } else {
      setSelClient("");
      setStartDate(fltDate || todayStr());
      setSelServices([]);
      const now=new Date();
      const tNow = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const st = inRange(tNow) ? clampToRange(tNow) : `${pad(OPEN_HOUR)}:00`;
      setStartTime(st);
      setAutoEnd(true);
      setSelBarber("");
      setStatus("booked"); setComment("");
    }
    setModalOpen(true);
  };
  const closeModal = ()=>{ if (!saving) setModalOpen(false); };

  /* validate */
  const validate = ()=>{
    const alerts=[]; const errs={};
    if (!selClient){ errs.client=true; alerts.push("Выберите клиента."); }
    if (!startDate){ errs.startDate=true; alerts.push("Укажите дату."); }
    if (!selServices.length){ errs.services=true; alerts.push("Добавьте хотя бы одну услугу."); }
    if (!startTime){ errs.startTime=true; alerts.push("Укажите начало."); }
    if (!endTime){ errs.endTime=true; alerts.push("Укажите конец."); }
    if (!selBarber){ errs.barber=true; alerts.push("Выберите сотрудника."); }

    const sM = minsOf(startTime), eM = minsOf(endTime);
    if (!errs.startTime && !errs.endTime) {
      if (!(inRange(startTime) && inRange(endTime))) {
        errs.startTime = errs.endTime = true; alerts.push("Время должно быть в пределах 09:00–21:00.");
      } else if (eM <= sM) {
        errs.endTime = true; alerts.push("Конец должен быть позже начала.");
      }
    }
    if (alerts.length) return {alerts, errs};

    const startISO = makeISO(startDate, startTime);
    const endISO   = makeISO(startDate, endTime);
    const t1=ts(startISO), t2=ts(endISO);

    const dup = appointments.find(a =>
      String(a.client)===String(selClient) &&
      String(a.barber)===String(selBarber) &&
      Math.abs(ts(a.start_at)-t1) < 60000 &&
      BLOCKING.has(a.status) &&
      (!current?.id || String(current.id)!==String(a.id))
    );
    if (dup){ errs.startTime=true; alerts.push("Такая запись уже существует."); return {alerts, errs}; }

    const conflictsMaster = appointments.filter(a=>{
      if (String(a.barber)!==String(selBarber)) return false;
      if (!BLOCKING.has(a.status)) return false;
      if (current?.id && String(current.id)===String(a.id)) return false;
      return overlaps(t1, t2, ts(a.start_at), ts(a.end_at));
    });
    if (conflictsMaster.length){ errs.barber=true; alerts.push("Сотрудник занят в этот интервал."); }

    const conflictsClient = appointments.filter(a=>{
      if (String(a.client)!==String(selClient)) return false;
      if (!BLOCKING.has(a.status)) return false;
      if (current?.id && String(current.id)===String(a.id)) return false;
      return overlaps(t1, t2, ts(a.start_at), ts(a.end_at));
    });
    if (conflictsClient.length){ errs.startTime=true; alerts.push("У клиента уже есть запись в этот интервал."); }

    return {alerts, errs, startISO, endISO};
  };

  const submit = async (e)=>{
    e.preventDefault();
    setSaving(true); setFormAlerts([]); setFieldErrs({});
    const {alerts, errs, startISO, endISO} = validate();
    if (alerts.length){ setSaving(false); setFormAlerts(["Исправьте ошибки в форме.", ...alerts]); setFieldErrs(errs); return; }

    try{
      const payload = {
        client:selClient,
        barber:selBarber,
        services: selServices,
        start_at:startISO, end_at:endISO,
        status, comment:comment?.trim()||null,
        company:localStorage.getItem("company")
      };
      if (current?.id) await api.patch(`/barbershop/appointments/${current.id}/`, payload);
      else await api.post("/barbershop/appointments/", payload);
      await fetchAll(); closeModal();
    }catch(e2){
      const d=e2?.response?.data; const msgs=[];
      if (typeof d === "string") msgs.push(d);
      else if (d && typeof d === "object"){ Object.values(d).forEach((v)=>msgs.push(String(Array.isArray(v)?v[0]:v))); }
      if (!msgs.length) msgs.push("Не удалось сохранить запись.");
      setFormAlerts(msgs);
    }finally{ setSaving(false); }
  };

  /* mini client */
  const openMini = ()=>{ setMiniName(""); setMiniPhone(""); setMiniAlerts([]); setMiniErrs({}); setMiniOpen(true); };
  const closeMini = ()=>{ if (!miniSaving) setMiniOpen(false); };
  const saveMini = async (e)=>{
    e?.preventDefault?.();
    setMiniSaving(true); setMiniAlerts([]); setMiniErrs({});
    const name=norm(miniName), phone=norm(miniPhone);
    const alerts=[]; const errs={};
    if (!name){ errs.name=true; alerts.push("Укажите ФИО."); }
    if (!isValidPhone(phone)){ errs.phone=true; alerts.push("Телефон должен содержать минимум 10 цифр."); }
    const digits = normalizePhone(phone);
    const dupLocal = clients.find(c=>normalizePhone(c.phone)===digits || normalizeName(c.name)===normalizeName(name));
    if (!errs.name && !errs.phone && dupLocal){ errs.name=true; errs.phone=true; alerts.push("Клиент с такими данными уже существует."); }
    if (alerts.length){ setMiniErrs(errs); setMiniAlerts(alerts); setMiniSaving(false); return; }

    try{
      const payload={ full_name:name, phone, status:"active", notes:null, company:localStorage.getItem("company") };
      const {data}=await api.post("/barbershop/clients/", payload);
      const newId=data?.id;
      const cl = await api.get("/barbershop/clients/");
      const cls = asArray(cl.data).map((c)=>({ id:c.id, name:c.full_name||c.name||"", phone:c.phone||c.phone_number||"", status:c.status||"active" })).sort((a,b)=>a.name.localeCompare(b.name,"ru"));
      setClients(cls);
      if (newId) setSelClient(String(newId));
      setMiniOpen(false);
    }catch(e2){
      const d=e2?.response?.data; const msgs=[];
      if (typeof d === "string") msgs.push(d);
      else if (d && typeof d === "object"){ Object.values(d).forEach((v)=>msgs.push(String(Array.isArray(v)?v[0]:v))); }
      if (!msgs.length) msgs.push("Не удалось создать клиента.");
      setMiniAlerts(msgs);
    }finally{ setMiniSaving(false); }
  };

  return (
    <div className="barberrecorda">
      {/* верхняя панель (день и фильтр по сотруднику в сетке) */}
      <div className="barberrecorda__topBar">
        <div className="barberrecorda__dateFilter">
          <FaCalendarAlt className="barberrecorda__dateIcon" />
          <input className="barberrecorda__dateInput" type="date" value={fltDate} onChange={(e)=>setFltDate(e.target.value)} aria-label="Дата расписания" />
        </div>

        <ComboBox
          items={[{id:"", label:"Все сотрудники", search:"все сотрудники"}, ...barbers.map(b=>({id:String(b.id), label:b.name, search:b.name}))]}
          value={fltBarber}
          onChange={(id)=>setFltBarber(String(id))}
          placeholder="Все сотрудники"
          triggerClass="barberrecorda__comboTop"
        />

        <button className="barberrecorda__btn barberrecorda__btn--primary" onClick={()=>openModal(null)} aria-label="Добавить запись">
          <FaPlus /> Добавить
        </button>
      </div>

      {pageError && <div className="barberrecorda__alert barberrecorda__alert--danger">{pageError}</div>}

      {/* календарная сетка */}
      <div className="barberrecorda__calendar">
        <div className="barberrecorda__timeGutter" style={{height: calendarHeight}}>
          <div className="barberrecorda__timeHeader" style={{height: COL_HEADER_H}} />
          {timesAll.slice(0,-1).map((t,i)=>(
            <div key={i} className={`barberrecorda__timeCell ${busySlots.has(i) ? "is-busy" : ""}`} style={{height: SLOT_PX}}>
              <span>{t}</span>
            </div>
          ))}
        </div>

        <div className="barberrecorda__colsWrap">
          <div className="barberrecorda__cols" style={{height: calendarHeight}}>
            {barbers
              .filter(b => !fltBarber || String(b.id) === String(fltBarber))
              .map((b)=>{
                const list = (recordsByBarber.get(String(b.id)) || []);
                const layout = layoutForBarber(list);
                return (
                  <section key={b.id} className="barberrecorda__calCol">
                    <header className="barberrecorda__calHeader" style={{height: COL_HEADER_H}}>
                      <div className="barberrecorda__colTitle">
                        <span className="barberrecorda__avatar" aria-hidden>{(b.name||"•").trim()[0]?.toUpperCase()||"•"}</span>
                        <span className="barberrecorda__name">{b.name}</span>
                      </div>
                    </header>

                    <div className="barberrecorda__gridLines" style={{top: COL_HEADER_H}}>
                      {timesAll.slice(0,-1).map((_,i)=>(<div key={i} className="barberrecorda__gridLine" style={{height: SLOT_PX}} />))}
                    </div>

                    <div className="barberrecorda__eventsArea" style={{height: calendarHeight}}>
                      {layout.length===0 && !loading && (<div className="barberrecorda__emptyInCol">Свободно</div>)}
                      {layout.map((it)=>{
                        const r=it.r;
                        const svc = serviceNamesFromRecord(r);
                        const cl  = clientName(r);
                        const phone = clientPhone(r);
                        return (
                          <article key={r.id} className="barberrecorda__event" style={it.style} onClick={()=>openModal(r)} title={`${svc} • ${cl}`}>
                            <div className="barberrecorda__eventHeader">
                              <div className="barberrecorda__eventTime"><span>{toTime(r.start_at)}</span><span>–</span><span>{toTime(r.end_at)}</span></div>
                              <span className={`barberrecorda__badge barberrecorda__badge--${r.status}`}>{STATUS_LABELS[r.status] || r.status}</span>
                            </div>
                            <div className="barberrecorda__eventSvc">{svc}</div>
                            <div className="barberrecorda__eventClient">{cl}</div>
                            {phone && <div className="barberrecorda__eventPhone">{phone}</div>}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
          </div>
        </div>
      </div>

      {/* МОДАЛКА */}
      {modalOpen && (
        <div className="barberrecorda__overlay" onClick={closeModal}>
          <div className="barberrecorda__modal" role="dialog" aria-modal="true" onClick={(e)=>e.stopPropagation()}>
            <div className="barberrecorda__modalHeader">
              <h3 className="barberrecorda__modalTitle">{current ? "Редактировать запись" : "Новая запись"}</h3>
              <button className="barberrecorda__iconBtn" aria-label="Закрыть" onClick={closeModal}><FaTimes/></button>
            </div>

            {formAlerts.length>0 && (
              <div className="barberrecorda__alert barberrecorda__alert--inModal barberrecorda__alert--danger">
                {formAlerts.length===1 ? formAlerts[0] : <ul className="barberrecorda__alertList">{formAlerts.map((m,i)=>(<li key={i}>{m}</li>))}</ul>}
              </div>
            )}

            <form className="barberrecorda__form" onSubmit={submit} noValidate>
              <div className="barberrecorda__grid barberrecorda__grid--twoCols">
                {/* 1) Клиент */}
                <label className={`barberrecorda__field ${fieldErrs.client ? "is-invalid" : ""}`}>
                  <span className="barberrecorda__label">Клиент <b className="barberrecorda__req">*</b></span>
                  <div className="barberrecorda__fieldRow">
                    <ComboBox items={activeClientItems} value={selClient} onChange={(id)=>setSelClient(String(id))} placeholder="Выберите клиента" />
                    <button type="button" className="barberrecorda__btn barberrecorda__btn--primary barberrecorda__btn--square" aria-label="Создать клиента" title="Создать клиента" onClick={openMini}><FaPlus/></button>
                  </div>
                </label>

                {/* 2) Дата */}
                <label className={`barberrecorda__field ${fieldErrs.startDate ? "is-invalid" : ""}`}>
                  <span className="barberrecorda__label">Дата <b className="barberrecorda__req">*</b></span>
                  <div className="barberrecorda__inputIconWrap">
                    <input type="date" className="barberrecorda__input" value={startDate} onChange={(e)=>setStartDate(e.target.value)} required />
                  </div>
                </label>

                {/* 3) Услуги */}
                <label className={`barberrecorda__field barberrecorda__field--services ${fieldErrs.services ? "is-invalid" : ""}`}>
                  <span className="barberrecorda__label">Услуги <b className="barberrecorda__req">*</b></span>
                  <ServicesPicker items={serviceItems} selectedIds={selServices} onChange={setSelServices} summary={servicesSummary} />
                </label>

                {/* 4) Начало / 5) Конец */}
                <label className={`barberrecorda__field ${fieldErrs.startTime ? "is-invalid" : ""}`}>
                  <span className="barberrecorda__label">Начало <b className="barberrecorda__req">*</b></span>
                  <TimeField value={startTime} onChange={setStartStrict} invalid={!!fieldErrs.startTime}/>
                </label>

                <label className={`barberrecorda__field ${fieldErrs.endTime ? "is-invalid" : ""}`}>
                  <span className="barberrecorda__label">
                    Конец <b className="barberrecorda__req">*</b>
                    <span className="barberrecorda__autoEnd">
                      <input id="autoEnd" type="checkbox" checked={autoEnd} onChange={(e)=>setAutoEnd(e.target.checked)} />
                      <label htmlFor="autoEnd">Авто</label>
                    </span>
                  </span>
                  <TimeField value={endTime} onChange={setEndStrict} invalid={!!fieldErrs.endTime}/>
                </label>

                {/* 6) Сотрудник (availability) */}
                <label className={`barberrecorda__field ${fieldErrs.barber ? "is-invalid" : ""}`}>
                  <span className="barberrecorda__label">Сотрудник <b className="barberrecorda__req">*</b></span>
                  <ComboBox items={barberItems} value={selBarber} onChange={(id)=>setSelBarber(String(id))} placeholder="Выберите сотрудника" />
                  <div className="barberrecorda__availHint">
                    {selectedStartISO && selectedEndISO
                      ? <>Свободны: <b>{barberItems.filter(i=>!i.disabled).length}</b> из <b>{barberItems.length}</b></>
                      : "Выберите дату, услуги и время, чтобы увидеть доступность"}
                  </div>
                </label>

                {/* 7) Статус */}
                <label className="barberrecorda__field">
                  <span className="barberrecorda__label">Статус <b className="barberrecorda__req">*</b></span>
                  <select className="barberrecorda__input" value={status} onChange={(e)=>setStatus(e.target.value)} required>
                    <option value="booked">{STATUS_LABELS.booked}</option>
                    <option value="confirmed">{STATUS_LABELS.confirmed}</option>
                    <option value="completed">{STATUS_LABELS.completed}</option>
                    <option value="canceled">{STATUS_LABELS.canceled}</option>
                    <option value="no_show">{STATUS_LABELS.no_show}</option>
                  </select>
                </label>

                {/* 8) Комментарий */}
                <label className="barberrecorda__field barberrecorda__field--full">
                  <span className="barberrecorda__label">Комментарий</span>
                  <textarea className="barberrecorda__textarea" value={comment} onChange={(e)=>setComment(e.target.value)} placeholder="Заметка для сотрудника/клиента" />
                </label>
              </div>

              <div className="barberrecorda__footer">
                <span className="barberrecorda__spacer" />
                <button type="button" className="barberrecorda__btn barberrecorda__btn--secondary" onClick={closeModal} disabled={saving}>Отмена</button>
                <button
                  type="submit"
                  className="barberrecorda__btn barberrecorda__btn--primary"
                  disabled={saving || (selectedStartISO && selectedEndISO && busyBarbersOnInterval.has(String(selBarber)))}
                  title={busyBarbersOnInterval.has(String(selBarber)) ? "Сотрудник занят в этот интервал" : ""}
                >
                  {saving ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* мини-клиент */}
      {miniOpen && (
        <div className="barberrecorda__overlay barberrecorda__overlay--inner" onClick={closeMini}>
          <div className="barberrecorda__mini" onClick={(e)=>e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="barberrecorda__miniHeader">
              <h4 className="barberrecorda__miniTitle">Новый клиент</h4>
              <button className="barberrecorda__iconBtn" onClick={closeMini} aria-label="Закрыть"><FaTimes/></button>
            </div>

            {miniAlerts.length>0 && (
              <div className="barberrecorda__alert barberrecorda__alert--inModal barberrecorda__alert--danger">
                {miniAlerts.length===1 ? miniAlerts[0] : <ul className="barberrecorda__alertList">{miniAlerts.map((m,i)=>(<li key={i}>{m}</li>))}</ul>}
              </div>
            )}

            <form className="barberrecorda__miniForm" onSubmit={saveMini} noValidate>
              <label className={`barberrecorda__field ${miniErrs.name?"is-invalid":""}`}>
                <span className="barberrecorda__label">ФИО</span>
                <input className="barberrecorda__input" value={miniName} onChange={(e)=>setMiniName(e.target.value)} placeholder="Фамилия Имя Отчество" autoFocus required />
              </label>
              <label className={`barberrecorda__field ${miniErrs.phone?"is-invalid":""}`}>
                <span className="barberrecorda__label">Телефон</span>
                <input className="barberrecorda__input" value={miniPhone} onChange={(e)=>setMiniPhone(e.target.value)} placeholder="+996 ..." inputMode="tel" required />
              </label>

              <div className="barberrecorda__footer">
                <span className="barberrecorda__spacer" />
                <button type="button" className="barberrecorda__btn barberrecorda__btn--secondary" onClick={closeMini} disabled={miniSaving}>Отмена</button>
                <button type="submit" className="barberrecorda__btn barberrecorda__btn--primary" disabled={miniSaving}>{miniSaving ? "Создание…" : "Создать"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recorda;
