import { Navigate } from "react-router-dom";
import { useUser } from "../../../../store/slices/userSlice";
import { isStartPlan } from "../../../../utils/subscriptionPlan";
import Cook from "./Cook";

/** Кухня/KDS недоступны в тарифе «Старт». */
export default function CafeCookRoute() {
  const { tariff, company } = useUser();
  if (isStartPlan(tariff || company?.subscription_plan?.name)) {
    return <Navigate to="/crm/cafe/orders" replace />;
  }
  return <Cook />;
}
