import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useStore } from "react-redux";
import { useNavigate } from "react-router-dom";
import SellStart from "../ProductionAgents/SellStart/SellStart";
import OpenShiftPage from "../../Market/CashierPage/OpenShiftPage";
import { startSale } from "../../../../store/creators/saleThunk";
import { fetchShiftsAsync } from "../../../../store/creators/shiftThunk";
import { getCashBoxes } from "../../../../store/slices/cashSlice";
import api from "../../../../api";
import {
  fetchOwnOpenShift,
  resolveCashierId,
} from "../../../../tools/cashierOpenShift";
import sleep from "../../../../../tools/sleep";

const extractThunkError = (err, fallback = "Не удалось начать продажу") => {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  const data = err?.data ?? err;
  if (typeof data === "string") return data;
  if (data?.detail) return String(data.detail);
  if (Array.isArray(data?.detail)) return data.detail.join(", ");
  if (data?.message) return String(data.message);
  if (err?.message) return String(err.message);
  return fallback;
};

const isShiftNotOpenError = (err) => {
  const text = extractThunkError(err, "").toLowerCase();
  return (
    text.includes("смен") &&
    (text.includes("не открыт") ||
      text.includes("закрыт") ||
      text.includes("not open"))
  );
};

// Экраны страницы: загрузка → открытие смены (если нет открытой) → продажа
const PHASE_LOADING = "loading";
const PHASE_OPEN_SHIFT = "openShift";
const PHASE_SALE = "sale";
const PHASE_ERROR = "error";

const ProductionSellStartPage = () => {
  const dispatch = useDispatch();
  const store = useStore();
  const navigate = useNavigate();
  const [phase, setPhase] = useState(PHASE_LOADING);
  const [error, setError] = useState("");
  const cancelledRef = useRef(false);

  const waitForProfileRole = useCallback(async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (cancelledRef.current) return "";
      const role = String(
        store.getState().user?.profile?.role || "",
      ).toLowerCase();
      if (role) return role;
      await sleep(100);
    }
    return String(store.getState().user?.profile?.role || "").toLowerCase();
  }, [store]);

  const findOwnOpenShift = useCallback(async () => {
    const userState = store.getState().user || {};
    const cashierId = resolveCashierId({
      currentUser: userState.currentUser,
      userId: userState.userId,
      profile: userState.profile,
    });
    if (!cashierId) return null;
    return fetchOwnOpenShift(api, cashierId);
  }, [store]);

  const launchSale = useCallback(
    async (shiftId) => {
      try {
        await Promise.race([
          dispatch(startSale(shiftId ? { shift: shiftId } : {})).unwrap(),
          sleep(15000).then(() => {
            throw new Error("Превышено время ожидания запуска продажи");
          }),
        ]);
        if (!cancelledRef.current) setPhase(PHASE_SALE);
      } catch (err) {
        if (cancelledRef.current) return;
        if (isShiftNotOpenError(err)) {
          setPhase(PHASE_OPEN_SHIFT);
        } else {
          setError(extractThunkError(err));
          setPhase(PHASE_ERROR);
        }
      }
    },
    [dispatch],
  );

  useEffect(() => {
    cancelledRef.current = false;

    const bootstrap = async () => {
      const role = await waitForProfileRole();
      if (cancelledRef.current) return;

      if (!role) {
        setError("Не удалось загрузить профиль пользователя");
        setPhase(PHASE_ERROR);
        return;
      }

      if (role !== "owner") {
        navigate("/crm/production/sell", { replace: true });
        return;
      }

      // Кассы нужны экрану открытия смены
      dispatch(getCashBoxes());

      const openShift = await findOwnOpenShift().catch(() => null);
      if (cancelledRef.current) return;

      if (!openShift) {
        setPhase(PHASE_OPEN_SHIFT);
        return;
      }

      await launchSale(openShift.id);
    };

    bootstrap();

    return () => {
      cancelledRef.current = true;
    };
  }, [dispatch, findOwnOpenShift, launchSale, navigate, waitForProfileRole]);

  // Возврат с экрана открытия смены: если смену открыли — запускаем продажу,
  // если нажали «назад» без открытия — уходим на список продаж
  const handleOpenShiftBack = useCallback(async () => {
    setPhase(PHASE_LOADING);
    dispatch(fetchShiftsAsync());
    const openShift = await findOwnOpenShift().catch(() => null);
    if (cancelledRef.current) return;

    if (openShift) {
      await launchSale(openShift.id);
    } else {
      navigate("/crm/production/sell");
    }
  }, [dispatch, findOwnOpenShift, launchSale, navigate]);

  if (phase === PHASE_LOADING) {
    return <div style={{ padding: 24 }}>Загрузка продажи...</div>;
  }

  if (phase === PHASE_OPEN_SHIFT) {
    return <OpenShiftPage onBack={handleOpenShiftBack} />;
  }

  if (phase === PHASE_ERROR) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#b91c1c", marginBottom: 12 }}>{error}</p>
        <button type="button" onClick={() => navigate("/crm/production/sell")}>
          Назад
        </button>
      </div>
    );
  }

  return (
    <SellStart
      show
      setShow={(value) => {
        if (!value) navigate("/crm/production/sell");
      }}
      useMainProductsList
    />
  );
};

export default ProductionSellStartPage;
