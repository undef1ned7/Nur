import { Navigate } from "react-router-dom";
import { useUser } from "../../../store/slices/userSlice";
import { isStartPlan } from "../../../utils/subscriptionPlan";

/**
 * Тариф «Старт»: передача, каталог для агентов и запросы недоступны.
 */
export default function ProductionStartAgentGate({ children }) {
  const { tariff, company } = useUser();
  const planName = tariff || company?.subscription_plan?.name;
  if (isStartPlan(planName)) {
    return <Navigate to="/crm/production/warehouse" replace />;
  }
  return children;
}
