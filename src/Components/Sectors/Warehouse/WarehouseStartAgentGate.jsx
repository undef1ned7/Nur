import { Navigate } from "react-router-dom";
import { useUser } from "../../../store/slices/userSlice";
import { isStartPlan } from "../../../utils/subscriptionPlan";

/**
 * Тариф «Старт»: раздел заявок агентов и связанные экраны агента недоступны.
 */
export default function WarehouseStartAgentGate({ children }) {
  const { tariff, company } = useUser();
  const planName = tariff || company?.subscription_plan?.name;
  if (isStartPlan(planName)) {
    return <Navigate to="/crm/warehouse/warehouses" replace />;
  }
  return children;
}
