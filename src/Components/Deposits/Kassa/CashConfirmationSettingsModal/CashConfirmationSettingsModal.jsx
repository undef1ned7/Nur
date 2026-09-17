import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import {
  getCashConfirmationSettings,
  updateCashConfirmationSettings,
  useCash,
} from "../../../../store/slices/cashSlice";
import { useAlert } from "../../../../hooks/useDialog";

/**
 * Настройка подтверждения кассовых операций (общий легаси-модуль кассы —
 * Barber/Building/Pilorama/School/logistics и не-owner роли в других
 * секторах). Выключено по умолчанию: любая новая операция сразу
 * status="approved", независимо от роли автора.
 * Контракт: docs/kassa/cash-confirmation-toggle.md.
 */
const CashConfirmationSettingsModal = ({ onClose }) => {
  const alert = useAlert();
  const dispatch = useDispatch();
  const { confirmation } = useCash();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!confirmation.loaded) dispatch(getCashConfirmationSettings());
  }, []);

  const toggle = async (checked) => {
    setSaving(true);
    try {
      await dispatch(updateCashConfirmationSettings(checked)).unwrap();
      alert(
        checked
          ? "Подтверждение включено — операции не-владельца будут ждать одобрения."
          : "Подтверждение выключено — операции проводятся сразу.",
      );
    } catch (e) {
      alert(e?.detail || "Не удалось сохранить настройку", true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vitrina__overlay">
      <div className="vitrina__modal vitrina__modal--add">
        <div className="vitrina__modal-header">
          <h3>Настройки кассы</h3>
          <X className="vitrina__close-icon" size={20} onClick={onClose} />
        </div>
        <div className="vitrina__modal-section">
          <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 13 }}>
            Определяет, должна ли операция, добавленная не владельцем,
            ждать подтверждения владельца, прежде чем попасть в остаток
            кассы.
          </p>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={Boolean(confirmation.enabled)}
              disabled={saving || !confirmation.loaded}
              onChange={(e) => toggle(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              <b>Требовать подтверждение операций не-владельца</b>
              <br />
              <em style={{ fontStyle: "normal", color: "#64748b", fontSize: 12 }}>
                Выключено по умолчанию — операции сразу проводятся в кассу,
                кто бы их ни добавил.
              </em>
            </span>
          </label>
        </div>
        <div className="vitrina__modal-footer">
          <button className="vitrina__button vitrina__button--cancel" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default CashConfirmationSettingsModal;
