import { useContext, useEffect, useState } from "react";
import { UserCog, X, Trash2 } from "lucide-react";
import { msgFromError, toIsoDate10 } from "../clientDetails.helpers";
import api from "../../../../../api";
import { ThemeModeContext } from "../../../../../theme/ThemeModeProvider";
import AlertModal from "../../../../common/AlertModal/AlertModal";
import "../ClientModals.redesign.scss";

export default function ClientEditModal({
  open,
  client,
  onClose,
  onUpdated,
  onDeleted,
}) {
  const { mode } = useContext(ThemeModeContext);
  const [editFio, setEditFio] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editLlc, setEditLlc] = useState("");
  const [editInn, setEditInn] = useState("");
  const [editOkpo, setEditOkpo] = useState("");
  const [editScore, setEditScore] = useState("");
  const [editBik, setEditBik] = useState("");
  const [editAddress, setEditAddress] = useState("");
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
    setEditStatus(client?.status || "");
    setEditLlc(client?.llc || "");
    setEditInn(client?.inn || "");
    setEditOkpo(client?.okpo || "");
    setEditScore(client?.score || "");
    setEditBik(client?.bik || "");
    setEditAddress(client?.address || "");
    setSaveClientErr("");
  }, [open, client]);

  if (!open || !client) return null;

  const requiredOk =
    String(editFio).trim().length > 0 && String(editPhone).trim().length > 0;

  const updateClientApi = async (
    clientId,
    {
      full_name,
      phone,
      email,
      date,
      status,
      llc,
      inn,
      okpo,
      score,
      bik,
      address,
    },
  ) => {
    const payload = {
      full_name: String(full_name || "").trim(),
      phone: String(phone || "").trim(),
      email: String(email || "").trim(),
      date: date ? toIsoDate10(date) : "",
      status: String(status || "").trim(),
      llc: String(llc || "").trim(),
      inn: String(inn || "").trim(),
      okpo: String(okpo || "").trim(),
      score: String(score || "").trim(),
      bik: String(bik || "").trim(),
      address: String(address || "").trim(),
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
        status: editStatus,
        llc: editLlc,
        inn: editInn,
        okpo: editOkpo,
        score: editScore,
        bik: editBik,
        address: editAddress,
      });

      onUpdated?.({
        ...client,
        ...updated,
        fio: updated.full_name || editFio,
        full_name: updated.full_name || editFio,
        phone: updated.phone || editPhone,
        email: updated.email ?? editEmail,
        date: toIsoDate10(updated.date || editDate),
        status: updated.status ?? editStatus,
        llc: updated.llc ?? editLlc,
        inn: updated.inn ?? editInn,
        okpo: updated.okpo ?? editOkpo,
        score: updated.score ?? editScore,
        bik: updated.bik ?? editBik,
        address: updated.address ?? editAddress,
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
    <div className="cmx__overlay" data-theme={mode} onClick={onClose}>
      <div
        className="cmx__dialog cmx__dialog--lg"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cmx__header">
          <div className="cmx__heading">
            <span className="cmx__heading-icon">
              <UserCog />
            </span>
            <div className="cmx__heading-text">
              <h3 className="cmx__title">Редактировать клиента</h3>
              <p className="cmx__subtitle">
                Контактные данные и платёжные реквизиты
              </p>
            </div>
          </div>
          <button className="cmx__close" onClick={onClose} aria-label="Закрыть">
            <X />
          </button>
        </div>

        <div className="cmx__body">
          {saveClientErr && <div className="cmx__alert">{saveClientErr}</div>}

          <div>
            <div className="cmx__section-title">Контакты</div>
            <div className="cmx__grid">
              <label className="cmx__field">
                <span className="cmx__label">
                  ФИО <b className="cmx__req">*</b>
                </span>
                <input
                  type="text"
                  className="cmx__input"
                  value={editFio}
                  onChange={(e) => setEditFio(e.target.value)}
                  placeholder="Иванов Иван"
                  autoFocus
                  required
                />
              </label>

              <label className="cmx__field">
                <span className="cmx__label">
                  Телефон <b className="cmx__req">*</b>
                </span>
                <input
                  type="text"
                  className="cmx__input"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+996 700 00-00-00"
                  required
                />
              </label>

              <label className="cmx__field">
                <span className="cmx__label">Email</span>
                <input
                  type="email"
                  className="cmx__input"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="user@mail.com"
                />
              </label>

              <label className="cmx__field">
                <span className="cmx__label">Дата</span>
                <input
                  type="date"
                  className="cmx__input"
                  value={editDate || ""}
                  onChange={(e) => setEditDate(e.target.value)}
                />
                <span className="cmx__hint">
                  Например: <b>21.08.2025</b> (сохранится как 2025-08-21)
                </span>
              </label>

              <label className="cmx__field">
                <span className="cmx__label">Статус</span>
                <input
                  type="text"
                  className="cmx__input"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  placeholder="new"
                />
              </label>
            </div>
          </div>

          <div>
            <div className="cmx__section-title">Реквизиты</div>
            <div className="cmx__grid">
              <label className="cmx__field">
                <span className="cmx__label">ОсОО</span>
                <input
                  type="text"
                  className="cmx__input"
                  value={editLlc}
                  onChange={(e) => setEditLlc(e.target.value)}
                  placeholder="ОсОО"
                />
              </label>

              <label className="cmx__field">
                <span className="cmx__label">ИНН</span>
                <input
                  type="text"
                  className="cmx__input"
                  value={editInn}
                  onChange={(e) => setEditInn(e.target.value)}
                  placeholder="ИНН"
                />
              </label>

              <label className="cmx__field">
                <span className="cmx__label">ОКПО</span>
                <input
                  type="text"
                  className="cmx__input"
                  value={editOkpo}
                  onChange={(e) => setEditOkpo(e.target.value)}
                  placeholder="ОКПО"
                />
              </label>

              <label className="cmx__field">
                <span className="cmx__label">Счет</span>
                <input
                  type="text"
                  className="cmx__input"
                  value={editScore}
                  onChange={(e) => setEditScore(e.target.value)}
                  placeholder="Расчетный счет"
                />
              </label>

              <label className="cmx__field">
                <span className="cmx__label">БИК</span>
                <input
                  type="text"
                  className="cmx__input"
                  value={editBik}
                  onChange={(e) => setEditBik(e.target.value)}
                  placeholder="БИК"
                />
              </label>

              <label className="cmx__field cmx__field--full">
                <span className="cmx__label">Адрес</span>
                <input
                  type="text"
                  className="cmx__input"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Адрес"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="cmx__footer">
          <div className="cmx__footer-left">
            <button
              className="cmx__btn cmx__btn--danger"
              onClick={handleDelete}
              disabled={savingClient}
            >
              <Trash2 /> Удалить
            </button>
          </div>
          <div className="cmx__footer-right">
            <button
              className="cmx__btn cmx__btn--ghost"
              onClick={onClose}
              disabled={savingClient}
            >
              Отмена
            </button>
            <button
              className="cmx__btn cmx__btn--primary"
              onClick={handleSave}
              disabled={!requiredOk || savingClient}
              title={!requiredOk ? "Заполните обязательные поля" : ""}
            >
              {savingClient ? "Сохранение…" : "Сохранить"}
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
