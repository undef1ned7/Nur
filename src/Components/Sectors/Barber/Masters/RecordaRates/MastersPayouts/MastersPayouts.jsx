// // MastersPayouts.jsx
// import React, { useEffect, useState } from "react";
// import "./MastersPayouts.scss";
// import RecordaRates from "../RecordaRates";
// import {
//   pad2,
//   loadBarbershopData,
//   loadRatesForPeriod,
//   persistRatesForPeriod,
// } from "./MastersPayoutsUtils";

// /* ===== основной контейнер ===== */
// const MastersPayouts = () => {
//   const now = new Date();

//   const [appointments, setAppointments] = useState([]);
//   const [employees, setEmployees] = useState([]);
//   const [services, setServices] = useState([]);

//   const [month, setMonth] = useState(now.getMonth() + 1);
//   const [year, setYear] = useState(now.getFullYear());

//   const periodLabel = `${year}-${pad2(month)}`;

//   // ставки
//   const [ratesLoading, setRatesLoading] = useState(false);
//   const [ratesError, setRatesError] = useState("");
//   // { [barberId]: { id_record?, id_fixed?, id_percent?, perRecord, fixed, percent, completed, revenue, payout } }
//   const [rates, setRates] = useState({});

//   /* ===== изменение значения ставки в форме ===== */
//   const setRateValue = (barberId, field, value) => {
//     const raw = String(value).trim();
//     if (raw === "") {
//       setRates((prev) => ({
//         ...prev,
//         [barberId]: { ...(prev[barberId] || {}), [field]: "" },
//       }));
//       return;
//     }
//     const n = Number(raw);
//     if (!Number.isFinite(n) || n < 0) return;
//     setRates((prev) => ({
//       ...prev,
//       [barberId]: { ...(prev[barberId] || {}), [field]: n },
//     }));
//   };

//   /* ===== первая загрузка данных (записи/мастера/услуги + ставки) ===== */
//   useEffect(() => {
//     (async () => {
//       setRatesLoading(true);
//       setRatesError("");
//       try {
//         const { appointments: apps, employees: emps, services: svcs } =
//           await loadBarbershopData();

//         setAppointments(apps);
//         setEmployees(emps);
//         setServices(svcs);

//         const map = await loadRatesForPeriod(periodLabel);
//         setRates(map);
//       } catch (e) {
//         console.error(e);
//         setRatesError("Не удалось загрузить ставки мастеров.");
//         setRates({});
//       } finally {
//         setRatesLoading(false);
//       }
//     })();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   /* ===== смена периода (год/месяц) — перезагрузка ставок ===== */
//   useEffect(() => {
//     (async () => {
//       setRatesLoading(true);
//       setRatesError("");
//       try {
//         const map = await loadRatesForPeriod(periodLabel);
//         setRates(map);
//       } catch (e) {
//         console.error(e);
//         setRatesError("Не удалось загрузить ставки мастеров.");
//         setRates({});
//       } finally {
//         setRatesLoading(false);
//       }
//     })();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [year, month]);

//   /* ===== сохранение ставок + запись расхода в кассу ===== */
//   const handleSaveRates = async () => {
//     setRatesLoading(true);
//     setRatesError("");
//     try {
//       const newRates = await persistRatesForPeriod(periodLabel, rates);
//       setRates(newRates);
//     } catch (e) {
//       console.error(e);
//       setRatesError("Не удалось сохранить ставки мастеров.");
//     } finally {
//       setRatesLoading(false);
//     }
//   };

//   return (
//     <div className="masterspayouts">
//       <div className="masterspayouts__inner">
//         <RecordaRates
//           year={year}
//           month={month}
//           onChangeYear={setYear}
//           onChangeMonth={setMonth}
//           employees={employees}
//           appointments={appointments}
//           services={services}
//           rates={rates}
//           ratesLoading={ratesLoading}
//           ratesError={ratesError}
//           onChangeRate={setRateValue}
//           onSaveRates={handleSaveRates}
//         />
//       </div>
//     </div>
//   );
// };

// export default MastersPayouts;




// MastersPayouts.jsx
import React, { useEffect, useState } from "react";
import "./MastersPayouts.scss";

// ✅ ВАЖНО: правильный путь — из папки MastersPayouts на уровень выше
import RecordaRates from "../RecordaRates";

import {
  pad2,
  loadBarbershopData,
  loadRatesForPeriod,
  persistRatesForPeriod,
} from "./MastersPayoutsUtils";

/* ===== основной контейнер ===== */
const MastersPayouts = () => {
  const now = new Date();

  const [appointments, setAppointments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState([]);

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const periodLabel = `${year}-${pad2(month)}`;

  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState("");
  const [rates, setRates] = useState({});

  /* ===== изменение значения ставки ===== */
  const setRateValue = (barberId, field, value) => {
    const raw = String(value).trim();
    if (raw === "") {
      setRates((prev) => ({
        ...prev,
        [barberId]: { ...(prev[barberId] || {}), [field]: "" },
      }));
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    setRates((prev) => ({
      ...prev,
      [barberId]: { ...(prev[barberId] || {}), [field]: n },
    }));
  };

  /* ===== первая загрузка ===== */
  useEffect(() => {
    (async () => {
      setRatesLoading(true);
      setRatesError("");
      try {
        const { appointments: apps, employees: emps, services: svcs } =
          await loadBarbershopData();

        setAppointments(apps);
        setEmployees(emps);
        setServices(svcs);

        const map = await loadRatesForPeriod(periodLabel);
        setRates(map);
      } catch (e) {
        console.error(e);
        setRatesError("Не удалось загрузить ставки мастеров.");
        setRates({});
      } finally {
        setRatesLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===== смена периода ===== */
  useEffect(() => {
    (async () => {
      setRatesLoading(true);
      setRatesError("");
      try {
        const map = await loadRatesForPeriod(periodLabel);
        setRates(map);
      } catch (e) {
        console.error(e);
        setRatesError("Не удалось загрузить ставки мастеров.");
        setRates({});
      } finally {
        setRatesLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

// нужно
const handleSaveRates = async ({ totalFund }) => {
  setRatesLoading(true);
  setRatesError("");
  try {
    const newRates = await persistRatesForPeriod(
      periodLabel,
      rates,
      totalFund   // <-- сюда прилетает 800 из таблицы
    );
    setRates(newRates);
  } catch (e) {
    console.error(e);
    setRatesError("Не удалось сохранить ставки мастеров.");
  } finally {
    setRatesLoading(false);
  }
};


  return (
    <div className="masterspayouts">
      <div className="masterspayouts__inner">
        <RecordaRates
          year={year}
          month={month}
          onChangeYear={setYear}
          onChangeMonth={setMonth}
          employees={employees}
          appointments={appointments}
          services={services}
          rates={rates}
          ratesLoading={ratesLoading}
          ratesError={ratesError}
          onChangeRate={setRateValue}
          onSaveRates={handleSaveRates}
        />
      </div>
    </div>
  );
};

export default MastersPayouts;
