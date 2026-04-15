import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import SellStart from "../ProductionAgents/SellStart/SellStart";
import { startSale } from "../../../../store/creators/saleThunk";
import {
  fetchShiftsAsync,
  openShiftAsync,
} from "../../../../store/creators/shiftThunk";
import { getCashBoxes } from "../../../../store/slices/cashSlice";
import { useUser } from "../../../../store/slices/userSlice";

const ProductionSellStartPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { profile, currentUser, userId } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (profile?.role !== "owner") {
      navigate("/crm/production/sell", { replace: true });
      return;
    }
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    let cancelled = false;
    setLoading(true);
    setError("");

    const ensureShiftIsOpen = async () => {
      const freshShiftsPayload = await dispatch(fetchShiftsAsync()).unwrap();
      const freshShifts = Array.isArray(freshShiftsPayload?.results)
        ? freshShiftsPayload.results
        : Array.isArray(freshShiftsPayload)
          ? freshShiftsPayload
          : [];

      const openShift = freshShifts.find((s) => s.status === "open");

      if (openShift?.id) return openShift;

      let availableCashBoxes = await dispatch(getCashBoxes()).unwrap();
      if (!availableCashBoxes || availableCashBoxes.length === 0) {
        throw new Error(
          "Нет доступных касс. Пожалуйста, создайте кассу перед началом смены.",
        );
      }

      const cashboxId = availableCashBoxes[0]?.id;
      if (!cashboxId) {
        throw new Error("Не удалось определить кассу");
      }

      const cashierId = currentUser?.id || userId || profile?.id;
      if (!cashierId) {
        throw new Error("Не удалось определить кассира");
      }

      const openedShift = await dispatch(
        openShiftAsync({
          cashbox: cashboxId,
          cashier: cashierId,
          opening_cash: "0",
        }),
      ).unwrap();

      await dispatch(fetchShiftsAsync()).unwrap().catch(() => null);
      return openedShift;
    };

    (async () => {
      try {
        const openShift = await ensureShiftIsOpen();
        await dispatch(startSale({ shift: openShift?.id })).unwrap();
      } catch (err) {
        if (!cancelled) {
          const msg =
            err?.data?.detail ||
            err?.message ||
            "Не удалось начать продажу";
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, dispatch, navigate, profile?.id, profile?.role, userId]);

  if (loading) {
    return <div style={{ padding: 24 }}>Загрузка продажи...</div>;
  }

  if (error) {
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
