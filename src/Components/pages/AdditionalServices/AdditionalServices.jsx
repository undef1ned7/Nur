import React, { useState } from "react";
import { useSelector } from "react-redux";
import SocialModal from "./SocialModal";
import "./AdditionalServices.scss";
import { FaInstagram, FaTelegram, FaWhatsapp } from "react-icons/fa";
import { MdDocumentScanner } from "react-icons/md";

const AdditionalServices = () => {
  const [selectedSocial, setSelectedSocial] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { company } = useSelector((state) => state.user);

  const handleSocialClick = (social) => {
    setSelectedSocial(social);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSocial(null);
  };

  const socialNetworks = [
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
      id: "Documents",
      name: "Документы",
      icon: <MdDocumentScanner />,
      description:
        "Подключите чаты для удобного общения, быстрых автоматических ответов и полной интеграции с вашей CRM-системой.",
    },
  ];

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
        selectedSocial={selectedSocial}
      />
    </div>
  );
};

export default AdditionalServices;
