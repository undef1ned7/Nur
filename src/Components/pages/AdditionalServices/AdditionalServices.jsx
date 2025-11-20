import React, { useState, useMemo } from "react";
import { useSelector } from "react-redux";
import SocialModal from "./SocialModal";
import "./AdditionalServices.scss";
import { FaInstagram, FaTelegram, FaWhatsapp } from "react-icons/fa";
import { MdDocumentScanner } from "react-icons/md";
import { useMenuPermissions } from "../../Sidebar/hooks/useMenuPermissions";
import { getAdditionalServicesForPage } from "../../Sidebar/config/additionalServicesConfig";

const AdditionalServices = () => {
  const [selectedSocial, setSelectedSocial] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { company, tariff, sector } = useSelector((state) => state.user);
  const { hasPermission, isAllowed } = useMenuPermissions();

  const handleSocialClick = (social) => {
    setSelectedSocial(social);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSocial(null);
  };

  // Базовые социальные сети (всегда показываются)
  const baseSocialNetworks = useMemo(
    () => [
      {
        id: "whatsapp",
        name: "WhatsApp",
        icon: <FaWhatsapp />,
        description:
          "Подключите чаты для удобного общения, быстрых автоматических ответов и полной интеграции с вашей CRM-системой.",
      },
      {
        id: "telegram",
        name: "Telegram",
        icon: <FaTelegram />,
        description:
          "Подключите чаты для удобного общения, быстрых автоматических ответов и полной интеграции с вашей CRM-системой.",
      },
      {
        id: "instagram",
        name: "Instagram",
        icon: <FaInstagram />,
        description:
          "Подключите чаты для удобного общения, быстрых автоматических ответов и полной интеграции с вашей CRM-системой.",
      },
      {
        id: "documents",
        name: "Документы",
        icon: <MdDocumentScanner />,
        description:
          "Подключите чаты для удобного общения, быстрых автоматических ответов и полной интеграции с вашей CRM-системой.",
      },
    ],
    []
  );

  // Получаем динамические услуги из конфигурации
  const dynamicServices = useMemo(
    () =>
      getAdditionalServicesForPage({
        hasPermission,
        isAllowed,
        company,
        tariff: tariff || company?.subscription_plan?.name || "Старт",
        sector: sector || company?.sector?.name,
      }),
    [hasPermission, isAllowed, company, tariff, sector]
  );

  // Объединяем базовые и динамические услуги
  const socialNetworks = useMemo(() => {
    const result = [...baseSocialNetworks];

    // Добавляем динамические услуги, преобразуя их в нужный формат
    dynamicServices.forEach((service) => {
      const IconComponent = service.icon;
      result.push({
        id: service.id,
        name: service.name,
        icon: <IconComponent />,
        description: service.description,
      });
    });

    return result;
  }, [baseSocialNetworks, dynamicServices]);

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
        <div className="additional-services__content">
          {socialNetworks.map((social) => (
            <div
              key={social.id}
              className="additional-services__social-card"
              onClick={() => handleSocialClick(social.id)}
            >
              <div className="additional-services__social-icon">
                {social.icon}
              </div>
              <h3 className="additional-services__social-title">
                {social.name}
              </h3>
              <p className="additional-services__social-description">
                {social.description}
              </p>
              <div className="additional-services__social-arrow">→</div>
            </div>
          ))}
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
