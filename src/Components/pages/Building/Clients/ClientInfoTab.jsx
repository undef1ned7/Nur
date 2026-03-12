import React, { useState } from "react";
import api from "../../../../api";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { asDateTime } from "../shared/constants";

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];

const getFileUrl = (file) =>
  String(file?.file_url || file?.file || file?.url || "");

const getFileExtension = (url) => {
  try {
    const clean = url.split("?")[0];
    const parts = clean.split(".");
    if (parts.length < 2) return "";
    return parts[parts.length - 1].toLowerCase();
  } catch {
    return "";
  }
};

const getFileTypeLabel = (ext) => {
  if (!ext) return "FILE";
  if (IMAGE_EXTENSIONS.includes(ext)) return "IMG";
  if (["pdf"].includes(ext)) return "PDF";
  if (["doc", "docx"].includes(ext)) return "DOC";
  if (["xls", "xlsx"].includes(ext)) return "XLS";
  return ext.toUpperCase();
};

export default function ClientInfoTab({ client }) {
  if (!client) return null;

  const alert = useAlert();

  const [files, setFiles] = useState(
    Array.isArray(client.files) ? client.files : [],
  );
  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [newFileTitle, setNewFileTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const clientId = client.id ?? client.uuid;

  // Обновляем локальный список файлов, когда из детального API приходят новые данные
  useEffect(() => {
    setFiles(Array.isArray(client.files) ? client.files : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id, client.files]);

  const handleFileUpload = async (file) => {
    if (!file || !clientId) return;
    setFileError(null);
    try {
      setFileUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", newFileTitle.trim() || file.name);
      const { data } = await api.post(
        `/building/clients/${clientId}/files/`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      setFiles((prev) => {
        // Если бэкенд вернул весь объект клиента с полем files
        if (data && Array.isArray(data.files)) {
          return data.files;
        }
        // Если вернулся только один файл
        const created = data || null;
        return created ? [created, ...(Array.isArray(prev) ? prev : [])] : prev;
      });
      setFileModalOpen(false);
      setNewFileTitle("");
      setSelectedFile(null);
      alert("Файл клиента прикреплён");
    } catch (err) {
      setFileError(
        validateResErrors(err, "Не удалось прикрепить файл клиента"),
      );
    } finally {
      setFileUploading(false);
    }
  };

  return (
    <div className="sell-form client-detail__form">
      <section className="sell-form__section">
        <h4 className="sell-form__sectionTitle">Контакты</h4>
        <div className="client-detail__row">
          <span className="sell-form__label">Имя / название</span>
          <span>{client.name || "—"}</span>
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Телефон</span>
          <span>{client.phone || "—"}</span>
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Email</span>
          <span>{client.email || "—"}</span>
        </div>
      </section>
      <section className="sell-form__section">
        <h4 className="sell-form__sectionTitle">Реквизиты</h4>
        <div className="client-detail__row">
          <span className="sell-form__label">ИНН</span>
          <span>{client.inn || "—"}</span>
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Адрес</span>
          <span>{client.address || "—"}</span>
        </div>
      </section>
      <section className="sell-form__section">
        <h4 className="sell-form__sectionTitle">Прочее</h4>
        <div className="client-detail__row">
          <span className="sell-form__label">Заметки</span>
          <span>{client.notes || "—"}</span>
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Статус</span>
          <span>
            {client.is_active ? (
              <span className="clients-table__status clients-table__status--active">
                Активен
              </span>
            ) : (
              <span className="clients-table__status clients-table__status--inactive">
                Отключён
              </span>
            )}
          </span>
        </div>
      </section>

      <section className="sell-form__section">
        <h4 className="sell-form__sectionTitle">Прикреплённые файлы</h4>
        <div className="client-detail__row">
          <span className="sell-form__label">Добавить файл</span>
          <button
            type="button"
            className="add-product-page__submit-btn"
            onClick={() => {
              setFileError(null);
              setNewFileTitle("");
              setFileModalOpen(true);
            }}
          >
            Прикрепить файл
          </button>
        </div>
        {fileError && (
          <div className="building-page__error" style={{ marginTop: 4 }}>
            {String(fileError)}
          </div>
        )}
        {(!files || files.length === 0) && (
          <div className="client-detail__row">
            <span className="sell-form__label" />
            <span>Файлы ещё не прикреплены.</span>
          </div>
        )}
        {Array.isArray(files) && files.length > 0 && (
          <div className="client-detail__row">
            <span className="sell-form__label" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  overflowX: "auto",
                  paddingBottom: 4,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "stretch",
                    minHeight: 120,
                  }}
                >
                  {files.map((f) => {
                    const key = f.id ?? f.uuid ?? f.file;
                    const url = getFileUrl(f);
                    const ext = getFileExtension(url);
                    const isImage = IMAGE_EXTENSIONS.includes(ext);
                    const iconLabel = getFileTypeLabel(ext);
                    const title =
                      f.title ||
                      (url
                        ? url
                            .split("#")[0]
                            .split("?")[0]
                            .split("/")
                            .pop() || "Файл"
                        : "Файл");
                    return (
                      <div
                        key={key}
                        style={{
                          flex: "0 0 200px",
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                          background: "#ffffff",
                          padding: 10,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            borderRadius: 8,
                            border: "1px dashed #e2e8f0",
                            background: "#f8fafc",
                            height: 90,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          {url && isImage ? (
                            <img
                              src={url}
                              alt={title}
                              style={{
                                maxWidth: "100%",
                                maxHeight: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                fontSize: 11,
                                color: "#64748b",
                              }}
                            >
                              {iconLabel}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            fontSize: 12,
                          }}
                        >
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: "#2563eb",
                                textDecoration: "underline",
                                wordBreak: "break-all",
                              }}
                            >
                              {title}
                            </a>
                          ) : (
                            <span>{title}</span>
                          )}
                          <span
                            style={{
                              fontSize: 11,
                              color: "#6b7280",
                              display: "block",
                            }}
                          >
                            {asDateTime(f.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <Modal
        open={fileModalOpen}
        onClose={() => {
          if (fileUploading) return;
          setFileModalOpen(false);
          setNewFileTitle("");
          setFileError(null);
          setSelectedFile(null);
        }}
        title="Прикрепить файл клиента"
      >
        <div className="sell-form">
          <section className="sell-form__section">
            <div className="sell-form__row">
              <label className="sell-form__label">Название файла</label>
              <input
                className="add-product-page__input"
                value={newFileTitle}
                onChange={(e) => setNewFileTitle(e.target.value)}
                placeholder="Например: Паспорт клиента"
              />
            </div>
            <div className="sell-form__row">
              <label className="sell-form__label">Файл</label>
              <input
                className="add-product-page__input"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file || null);
                }}
                disabled={fileUploading}
              />
            </div>
          </section>
          <div className="sell-form__actions" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="add-product-page__cancel-btn"
              onClick={() => {
                if (fileUploading) return;
                setFileModalOpen(false);
                setNewFileTitle("");
                setFileError(null);
                setSelectedFile(null);
              }}
              disabled={fileUploading}
            >
              Отмена
            </button>
            <button
              type="button"
              className="add-product-page__submit-btn"
              disabled={fileUploading || !selectedFile}
              onClick={() => {
                if (!selectedFile || fileUploading) return;
                void handleFileUpload(selectedFile);
              }}
            >
              {fileUploading ? "Загрузка..." : "Прикрепить"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

