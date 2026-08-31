import { useEffect } from "react";
import { FaUserSecret, FaSignOutAlt } from "react-icons/fa";
import {
  isImpersonating,
  readImpersonationMeta,
} from "../../pages/PlatformAdmin/platformAdminAccess";
import { stopImpersonation } from "../../pages/PlatformAdmin/impersonation";
import "./ImpersonationBanner.scss";

/**
 * Баннер поверх CRM, когда платформенный админ вошёл от имени пользователя.
 */
const ImpersonationBanner = () => {
  const active = isImpersonating();
  const meta = readImpersonationMeta();

  useEffect(() => {
    if (!active) return undefined;
    document.body.classList.add("has-impersonation-banner");
    return () => document.body.classList.remove("has-impersonation-banner");
  }, [active]);

  if (!active) return null;

  const label =
    meta?.name ||
    meta?.email ||
    (meta?.userId ? `пользователь #${meta.userId}` : "пользователя");

  return (
    <div className="impersonation-banner" role="status">
      <FaUserSecret aria-hidden />
      <span>
        Вы вошли от имени <strong>{label}</strong>. Действия выполняются от его
        аккаунта.
      </span>
      <button
        type="button"
        className="impersonation-banner__btn"
        onClick={() => stopImpersonation()}
      >
        <FaSignOutAlt aria-hidden /> Выйти из режима
      </button>
    </div>
  );
};

export default ImpersonationBanner;
