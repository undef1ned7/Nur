import { useUser } from "../../../../store/slices/userSlice";

const PartnerAnalyticsOwnerGate = ({ children }) => {
  const { profile } = useUser();
  const isOwnerOrAdmin =
    profile?.role === "owner" || profile?.role === "admin";

  if (!isOwnerOrAdmin) {
    return (
      <div className="warehouse-analytics">
        <div className="warehouse-analytics__error">Только владелец/админ.</div>
      </div>
    );
  }

  return children;
};

export default PartnerAnalyticsOwnerGate;
