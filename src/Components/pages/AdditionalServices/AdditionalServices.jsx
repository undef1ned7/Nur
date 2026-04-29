import React, { useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import SocialModal from "./SocialModal";
import "./AdditionalServices.scss";
import { useMenuPermissions } from "../../Sidebar/hooks/useMenuPermissions";
import { getAdditionalServicesForPage } from "../../Sidebar/config/additionalServicesConfig";

const AdditionalServices = () => {
  const navigate = useNavigate();
  const [selectedSocial, setSelectedSocial] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { company, tariff, sector, profile } = useSelector(
    (state) => state.user,
  );
  const { hasPermission, isAllowed } = useMenuPermissions();
  const handleSocialClick = (social) => {
    // Все доп.услуги (включая печать штрих-кодов) запрашиваются через модалку
    setSelectedSocial(social);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSocial(null);
  };

  const socialNetworks = useMemo(
    () =>
      getAdditionalServicesForPage({
        hasPermission,
        isAllowed,
        company,
        tariff: tariff || company?.subscription_plan?.name || "Старт",
        sector: sector || company?.sector?.name,
        profile,
      }),
    [hasPermission, isAllowed, company, tariff, sector, profile],
  );
  const integrations = useMemo(
    () => socialNetworks.filter((item) => item.type === "navigational"),
    [socialNetworks],
  );
  const extensions = useMemo(
    () => socialNetworks.filter((item) => item.type === "extension"),
    [socialNetworks],
  );

  const renderServiceCard = (social) => {
    const IconComponent = social.icon;
    const canNavigate =
      social.type === "navigational" &&
      social.isConnected &&
      Boolean(social.to);
    return (
      <div key={social.id} className="additional-services__social-card">
        <div className="additional-services__social-icon">
          {IconComponent ? <IconComponent /> : null}
        </div>
        <h3 className="additional-services__social-title">{social.title}</h3>
        <p className="additional-services__social-description">
          {social.description}
        </p>
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {canNavigate ? (
            <button
              type="button"
              className="additional-services__button additional-services__button--primary"
              onClick={() => navigate(social.to)}
            >
              Перейти
            </button>
          ) : null}
          <button
            type="button"
            className="additional-services__button additional-services__button--secondary"
            onClick={() => handleSocialClick(social.id)}
          >
            Подключить
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="additional-services">
      <div className="additional-services__header">
        <h1>Дополнительные услуги</h1>
        <p>
          Расширьте возможности вашей CRM-системы с помощью наших дополнительных
          услуг. Выберите интересующую вас социальную сеть для подключения.
        </p>
      </div>

      <div className="additional-services__wrapper">
        <h2 style={{ marginBottom: "12px" }}>Интеграции</h2>
        <div className="additional-services__content">
          {integrations.map(renderServiceCard)}
        </div>

        <h2 style={{ margin: "24px 0 12px" }}>Расширения</h2>
        <div className="additional-services__content">
          {extensions.map(renderServiceCard)}
        </div>

        <p className="additional-services__message">
          Мы свяжемся с вами в ближайшее время для обсуждения деталей
          подключения.
        </p>
      </div>

      <SocialModal
        isOpen={isModalOpen}
        onClose={closeModal}
        selectedSocial={selectedSocial} // сюда прилетит 'warehouse' при клике по "Склад"
      />
    </div>
  );
};

export default AdditionalServices;
