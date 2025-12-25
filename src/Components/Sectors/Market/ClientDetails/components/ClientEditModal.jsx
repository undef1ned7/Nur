import { useEffect, useState } from "react";
import { msgFromError, toIsoDate10 } from "../clientDetails.helpers";
import api from "../../../../../api";
import AlertModal from "../../../../common/AlertModal/AlertModal";

export default function ClientEditModal({
  open,
  client,
  onClose,
  onUpdated,
  onDeleted,
}) {
  const [editFio, setEditFio] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDate, setEditDate] = useState("");
  const [saveClientErr, setSaveClientErr] = useState("");
  const [savingClient, setSavingClient] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    message: "",
    onConfirm: null,
  });

  useEffect(() => {
    if (!open || !client) return;
    setEditFio(client?.fio || client?.full_name || "");
    setEditPhone(client?.phone || "");
    setEditEmail(client?.email || "");
    setEditDate(toIsoDate10(client?.date) || "");
    setSaveClientErr("");
  }, [open, client]);

  if (!open || !client) return null;

  const requiredOk =
    String(editFio).trim().length > 0 && String(editPhone).trim().length > 0;

  const updateClientApi = async (clientId, { full_name, phone, email, date }) => {
    const payload = {
      full_name: String(full_name || "").trim(),
      phone: String(phone || "").trim(),
      ...(email ? { email: String(email).trim() } : {}),
      ...(date ? { date: toIsoDate10(date) } : {}),
    };
    const res = await api.put(`/main/clients/${clientId}/`, payload);
    return res?.data || payload;
  };

  const deleteClientApi = async (clientId) => {
    await api.delete(`/main/clients/${clientId}/`);
  };

  const handleSave = async () => {
    if (!client?.id) return;
    if (!requiredOk) {
      setSaveClientErr("Заполните обязательные поля");
      return;
    }
    try {
      setSavingClient(true);
      setSaveClientErr("");
      const updated = await updateClientApi(client.id, {
        full_name: editFio,
        phone: editPhone,
        email: editEmail,
        date: editDate,
      });

      onUpdated?.({
        ...client,
        ...updated,
        fio: updated.full_name || editFio,
        full_name: updated.full_name || editFio,
        phone: updated.phone || editPhone,
        email: updated.email ?? editEmail,
        date: toIsoDate10(updated.date || editDate),
      });

      onClose?.();
    } catch (e) {
      console.error(e);
      setSaveClientErr(msgFromError(e, "Не удалось сохранить клиента"));
    } finally {
      setSavingClient(false);
    }
  };

  const handleDelete = () => {
    if (!client?.id) return;
    setConfirmDialog({
      open: true,
      message: "Удалить клиента? Действие необратимо.",
      onConfirm: async () => {
        try {
          await deleteClientApi(client.id);
          setConfirmDialog({ open: false, message: "", onConfirm: null });
          onDeleted?.(client.id);
        } catch (e) {
          console.error(e);
          setSaveClientErr(msgFromError(e, "Не удалось удалить клиента"));
          setConfirmDialog({ open: false, message: "", onConfirm: null });
        }
      },
    });
  };

  return (
    <div className="client-edit-modal__overlay modal-overlay" onClick={onClose}>
      <div
        className="client-edit-modal modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="client-edit-modal__header">
          <h3 className="client-edit-modal__title">Редактировать клиента</h3>
          <button
            className="client-edit-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="client-edit-modal__content">
          {saveClientErr && (
            <div className="client-edit-modal__alert alert alert--error">
              {saveClientErr}
            </div>
          )}

          <div className="client-edit-modal__fields">
            <label className="client-edit-modal__field field">
              <span className="client-edit-modal__label">
                ФИО <b className="req">*</b>
              </span>
              <input
                type="text"
                className="client-edit-modal__input"
                value={editFio}
                onChange={(e) => setEditFio(e.target.value)}
                placeholder="Иванов Иван"
                autoFocus
                required
              />
            </label>

            <label className="client-edit-modal__field field">
              <span className="client-edit-modal__label">
                Телефон <b className="req">*</b>
              </span>
              <input
                type="text"
                className="client-edit-modal__input"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+996 700 00-00-00"
                required
              />
            </label>

            <label className="client-edit-modal__field field">
              <span className="client-edit-modal__label">Email</span>
              <input
                type="email"
                className="client-edit-modal__input"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="user@mail.com"
              />
            </label>

            <label className="client-edit-modal__field field">
              <span className="client-edit-modal__label">Дата</span>
              <input
                type="date"
                className="client-edit-modal__input"
                value={editDate || ""}
                onChange={(e) => setEditDate(e.target.value)}
              />
              <div className="client-edit-modal__hint hint">
                Например: <b>21.08.2025</b> (сохранится как 2025-08-21)
              </div>
            </label>
          </div>
        </div>

        <div className="client-edit-modal__actions modal-actions">
          <button
            className="client-edit-modal__btn client-edit-modal__btn--danger btn btn--red"
            onClick={handleDelete}
            disabled={savingClient}
          >
            Удалить
          </button>
          <div className="client-edit-modal__actions-right">
            <button
              className="client-edit-modal__btn client-edit-modal__btn--primary btn btn--yellow"
              onClick={handleSave}
              disabled={!requiredOk || savingClient}
              title={!requiredOk ? "Заполните обязательные поля" : ""}
            >
              {savingClient ? "Сохранение…" : "Сохранить"}
            </button>
            <button
              className="client-edit-modal__btn client-edit-modal__btn--secondary btn btn--ghost"
              onClick={onClose}
              disabled={savingClient}
            >
              Отмена
            </button>
          </div>
        </div>

        <AlertModal
          open={confirmDialog.open}
          type="info"
          message={confirmDialog.message}
          okText="Подтвердить"
          onClose={() =>
            setConfirmDialog({ open: false, message: "", onConfirm: null })
          }
          onConfirm={() => {
            if (confirmDialog.onConfirm) confirmDialog.onConfirm();
          }}
        />
      </div>
    </div>
  );
}
