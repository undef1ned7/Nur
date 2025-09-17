import React, { useState } from "react";
import { useSelector } from "react-redux";
import { submitAdditionalServicesRequest } from "../../../api/additionalServices";
import "./SocialModal.scss";
import { FaInstagram, FaTelegram, FaWhatsapp } from "react-icons/fa";

const SocialModal = ({ isOpen, onClose, selectedSocial }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const { company } = useSelector((state) => state.user);

  const handleSubmit = async () => {
    if (!company) {
      setSubmitStatus({
        type: "error",
        message: "Ошибка: компания не найдена",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const requestData = {
        company: company.name,
        text: `Новая заявка на подключение услуги ${selectedSocial}`,
        status: "new",
      };

      await submitAdditionalServicesRequest(requestData);
      setSubmitStatus({
        type: "success",
        message: "Заявка успешно отправлена!",
      });

      // Закрываем модалку через 2 секунды после успешной отправки
      setTimeout(() => {
        onClose();
        setSubmitStatus(null);
      }, 2000);
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message: error.message || "Ошибка при отправке заявки",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const getSocialInfo = (social) => {
    switch (social) {
      case "whatsapp":
        return {
          title: "WhatsApp",
          description:
            "Подключите чаты для удобного общения, быстрых автоматических ответов и полной интеграции с вашей CRM-системой.",
          icon: <FaWhatsapp />,
        };
      case "telegram":
        return {
          title: "Telegram",
          description:
            "Подключите чаты для удобного общения, быстрых автоматических ответов и полной интеграции с вашей CRM-системой.",
          icon: <FaTelegram />,
        };
      case "instagram":
        return {
          title: "Instagram",
          description:
            "Подключите чаты для удобного общения, быстрых автоматических ответов и полной интеграции с вашей CRM-системой.",
          icon: <FaInstagram />,
        };
      default:
        return {
          title: "Социальная сеть",
          description: "Описание услуги",
          icon: "🔗",
        };
    }
  };

  const socialInfo = getSocialInfo(selectedSocial);

  return (
    <div className="social-modal-overlay" onClick={onClose}>
      <div
        className="social-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="social-modal-close" onClick={onClose}>
          &times;
        </button>

        <div className="social-modal-header">
          <div className="social-modal-icon">{socialInfo.icon}</div>
          <h2>Заявка на подключение {socialInfo.title}</h2>
        </div>

        <div className="social-modal-body">
          <p className="social-modal-description">{socialInfo.description}</p>

          {submitStatus && (
            <div
              className={`social-modal-status social-modal-status--${submitStatus.type}`}
            >
              {submitStatus.message}
            </div>
          )}
        </div>

        <div className="social-modal-actions">
          <button
            className="social-modal-button social-modal-button--cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Отмена
          </button>
          <button
            className="social-modal-button social-modal-button--submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="social-modal-spinner"></span>
                Отправка...
              </>
            ) : (
              "Отправить заявку"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SocialModal;
