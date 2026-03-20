import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import SellStart from "../ProductionAgents/SellStart/SellStart";
import { startSale } from "../../../../store/creators/saleThunk";
import { useUser } from "../../../../store/slices/userSlice";

const ProductionSellStartPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { profile } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile?.role !== "owner") {
      navigate("/crm/production/sell", { replace: true });
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    dispatch(startSale())
      .unwrap()
      .catch((err) => {
        if (!cancelled) {
          const msg =
            err?.data?.detail ||
            err?.message ||
            "Не удалось начать продажу";
          setError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, navigate, profile?.role]);

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
