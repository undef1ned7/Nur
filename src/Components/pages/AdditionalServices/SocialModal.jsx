import React, { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { submitAdditionalServicesRequest } from "../../../api/additionalServices";
import { ADDITIONAL_SERVICES_CONFIG } from "../../Sidebar/config/additionalServicesConfig";
import { SERVICE_IDS } from "../../../config/additionalServiceIds";
import "./SocialModal.scss";

const SocialModal = ({ isOpen, onClose, selectedSocial }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const { company } = useSelector((state) => state.user);

  const isConsulting = useMemo(() => {
    const name = (company?.name || "").toLowerCase();
    const sector = company?.sector?.name || company?.industry?.name || "";
    return name === "consulting" || sector === "Консалтинг";
  }, [company]);

  // Карта сервисов строится из единого конфига услуг
  const serviceMap = useMemo(
    () =>
      ADDITIONAL_SERVICES_CONFIG.reduce((acc, service) => {
        const IconComponent = service?.displayMeta?.icon;
        acc[service.id] = {
          title: service?.displayMeta?.title || service.label || "Сервис",
          description: service?.displayMeta?.description || "Описание услуги",
          icon: IconComponent ? <IconComponent /> : "🔗",
          requiresConsulting: service.id === SERVICE_IDS.WAREHOUSE,
        };
        return acc;
      }, {}),
    []
  );

  const socialInfo = (selectedSocial && serviceMap[selectedSocial]) || {
    title: "Сервис",
    description: "Описание услуги",
    icon: "🔗",
  };

  const submitDisabled =
    isSubmitting ||
    !company ||
    (socialInfo?.requiresConsulting && !isConsulting);

  const submitDisabledReason = !company
    ? "Компания не найдена"
    : socialInfo?.requiresConsulting && !isConsulting
    ? "Склад доступен только для сферы «Консалтинг»"
    : null;

  const handleSubmit = async () => {
    if (!company) {
      setSubmitStatus({
        type: "error",
        message: "Ошибка: компания не найдена",
      });
      return;
    }

    if (socialInfo?.requiresConsulting && !isConsulting) {
      setSubmitStatus({
        type: "error",
        message: "Склад доступен только для сферы «Консалтинг».",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const serviceTitle = socialInfo.title || selectedSocial;

      const requestData = {
        company: company.name, // при необходимости замените на company.id
        service: selectedSocial, // сохраняем id сервиса как поле
        text: `Новая заявка на подключение услуги: ${serviceTitle}`,
        status: "new",
      };

      await submitAdditionalServicesRequest(requestData);

      setSubmitStatus({
        type: "success",
        message: "Заявка успешно отправлена!",
      });

      setTimeout(() => {
        onClose();
        setSubmitStatus(null);
      }, 1500);
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message: error?.message || "Ошибка при отправке заявки",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
          <h2>Заявка на подключение: {socialInfo.title}</h2>
        </div>

        <div className="social-modal-body">
          <p className="social-modal-description">{socialInfo.description}</p>

          {submitDisabledReason && (
            <div className="social-modal-hint">{submitDisabledReason}</div>
          )}

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
            disabled={submitDisabled}
            title={submitDisabledReason || ""}
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
