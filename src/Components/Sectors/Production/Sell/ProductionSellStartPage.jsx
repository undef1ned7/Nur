import { useEffect, useState } from "react";
import { useDispatch, useStore } from "react-redux";
import { useNavigate } from "react-router-dom";
import SellStart from "../ProductionAgents/SellStart/SellStart";
import { startSale } from "../../../../store/creators/saleThunk";
import { useUser } from "../../../../store/slices/userSlice";
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

const ProductionSellStartPage = () => {
  const dispatch = useDispatch();
  const store = useStore();
  const navigate = useNavigate();
  const { profile } = useUser();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const waitForProfileRole = async () => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (cancelled) return "";
        const role = String(
          store.getState().user?.profile?.role || profile?.role || "",
        ).toLowerCase();
        if (role) return role;
        await sleep(100);
      }
      return String(profile?.role || "").toLowerCase();
    };

    const bootstrap = async () => {
      setReady(false);
      setError("");

      const role = await waitForProfileRole();
      if (cancelled) return;

      if (!role) {
        setError("Не удалось загрузить профиль пользователя");
        setReady(true);
        return;
      }

      if (role !== "owner") {
        navigate("/crm/production/sell", { replace: true });
        return;
      }

      try {
        await Promise.race([
          dispatch(startSale()).unwrap(),
          sleep(15000).then(() => {
            throw new Error("Превышено время ожидания запуска продажи");
          }),
        ]);
      } catch (err) {
        if (!cancelled) {
          setError(extractThunkError(err));
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [dispatch, navigate, profile?.id, profile?.role, store]);

  if (!ready) {
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
