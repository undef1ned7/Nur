import { Outlet, Link, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaShieldAlt } from "react-icons/fa";
import "./PlatformAdmin.scss";

const PlatformAdminLayout = () => {
  const navigate = useNavigate();

  return (
    <div className="platform-admin">
      <header className="platform-admin__header">
        <div className="platform-admin__header-left">
          <FaShieldAlt className="platform-admin__logo-icon" aria-hidden />
          <div>
            <h1 className="platform-admin__title">Админка NUR</h1>
            <p className="platform-admin__subtitle">
              Управление компаниями и аккаунтами
            </p>
          </div>
        </div>
        <div className="platform-admin__header-actions">
          <Link to="/platform-admin" className="platform-admin__nav-link">
            Компании
          </Link>
          <button
            type="button"
            className="platform-admin__btn platform-admin__btn--ghost"
            onClick={() => navigate("/crm")}
          >
            <FaArrowLeft /> В CRM
          </button>
        </div>
      </header>
      <main className="platform-admin__main">
        <Outlet />
      </main>
    </div>
  );
};

export default PlatformAdminLayout;
