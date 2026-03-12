import React, { useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useAlert } from "@/hooks/useDialog";
import { updateBuildingSupplier } from "@/store/creators/building/suppliersCreators";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import api from "../../../../api";
import { asDateTime } from "../shared/constants";
import Modal from "@/Components/common/Modal/Modal";

const SUPPLIER_TYPE_LABELS = {
  materials_supplier: "Поставщик материалов",
  equipment_supplier: "Поставщик оборудования",
  other: "Другой",
};

const STATUS_LABELS = {
  active: "Активен",
  inactive: "Неактивен",
};

const buildFormFromSupplier = (supplier) => ({
  company_name: supplier.company_name || "",
  supplier_type: supplier.supplier_type || "",
  tax_id: supplier.tax_id || "",
  registration_number: supplier.registration_number || "",
  year_founded: supplier.year_founded || "",
  contact_person: supplier.contact_person || "",
  position: supplier.position || "",
  phone: supplier.phone || "",
  email: supplier.email || "",
  website: supplier.website || "",
  city: supplier.city || "",
  address: supplier.address || "",
  postal_code: supplier.postal_code || "",
  status: supplier.status || "active",
  bank_details: {
    bank_name: supplier.bank_details?.bank_name || "",
    account_number: supplier.bank_details?.account_number || "",
    bic: supplier.bank_details?.bic || "",
    swift: supplier.bank_details?.swift || "",
  },
  // supplied_materials и delivery перенесены в отдельный таб
  warehouse: {
    has_warehouse: supplier.warehouse?.has_warehouse ?? false,
    warehouse_address: supplier.warehouse?.warehouse_address || "",
    storage_capacity_tons: supplier.warehouse?.storage_capacity_tons ?? "",
  },
});

export default function SupplierInfoTab({ supplier }) {
  if (!supplier) return null;

  const dispatch = useDispatch();
  const alert = useAlert();

  const [form, setForm] = useState(() => buildFormFromSupplier(supplier));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [files, setFiles] = useState(
    Array.isArray(supplier.files) ? supplier.files : [],
  );
  const [fileUploading, setFileUploading] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [newFileTitle, setNewFileTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const supplierId = supplier.id ?? supplier.uuid;

  const handleChange = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleBankFieldChange = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({
      ...prev,
      bank_details: { ...(prev.bank_details || {}), [field]: value },
    }));
  };

  const handleDeliveryFieldChange = (field) => (e) => {
    const value =
      field === "delivery_available" ? e.target.checked : e.target.value;
    setForm((prev) => ({
      ...prev,
      delivery: { ...(prev.delivery || {}), [field]: value },
    }));
  };

  const handleDeliveryRegionChange = (index) => (e) => {
    const value = e.target.value;
    setForm((prev) => {
      const list = Array.isArray(prev.delivery?.delivery_regions)
        ? [...prev.delivery.delivery_regions]
        : [];
      list[index] = value;
      return {
        ...prev,
        delivery: { ...(prev.delivery || {}), delivery_regions: list },
      };
    });
  };

  const handleAddDeliveryRegion = () => {
    setForm((prev) => {
      const list = Array.isArray(prev.delivery?.delivery_regions)
        ? [...prev.delivery.delivery_regions]
        : [];
      list.push("");
      return {
        ...prev,
        delivery: { ...(prev.delivery || {}), delivery_regions: list },
      };
    });
  };

  const handleRemoveDeliveryRegion = (index) => () => {
    setForm((prev) => {
      const list = Array.isArray(prev.delivery?.delivery_regions)
        ? [...prev.delivery.delivery_regions]
        : [];
      list.splice(index, 1);
      return {
        ...prev,
        delivery: { ...(prev.delivery || {}), delivery_regions: list },
      };
    });
  };

  const handleWarehouseFieldChange = (field) => (e) => {
    const value =
      field === "has_warehouse" ? e.target.checked : e.target.value;
    setForm((prev) => ({
      ...prev,
      warehouse: { ...(prev.warehouse || {}), [field]: value },
    }));
  };

  const resetForm = () => {
    setForm(buildFormFromSupplier(supplier));
    setError(null);
  };

  const handleFileUpload = async (file) => {
    if (!file || !supplierId) return;
    setFileError(null);
    try {
      setFileUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", newFileTitle.trim() || file.name);
      const { data } = await api.post(
        `/building/suppliers/${supplierId}/files/`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      setFiles((prev) => {
        if (data && Array.isArray(data.files)) {
          return data.files;
        }
        const created = data || null;
        return created ? [created, ...(Array.isArray(prev) ? prev : [])] : prev;
      });
      setFileModalOpen(false);
      setNewFileTitle("");
      setSelectedFile(null);
    } catch (err) {
      setFileError(
        validateResErrors(err, "Не удалось прикрепить файл поставщика"),
      );
    } finally {
      setFileUploading(false);
    }
  };

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

  const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];

  const getFileTypeLabel = (ext) => {
    if (!ext) return "FILE";
    if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext))
      return "IMG";
    if (["pdf"].includes(ext)) return "PDF";
    if (["doc", "docx"].includes(ext)) return "DOC";
    if (["xls", "xlsx"].includes(ext)) return "XLS";
    return ext.toUpperCase();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!supplier?.id && !supplier?.uuid) return;
    const id = supplier.id ?? supplier.uuid;

    const payload = {
      ...form,
      year_founded:
        form.year_founded && !Number.isNaN(Number(form.year_founded))
          ? Number(form.year_founded)
          : null,
      // supplied_materials и delivery обновляются на вкладке материалов
      warehouse: {
        ...(form.warehouse || {}),
        storage_capacity_tons:
          form.warehouse?.storage_capacity_tons &&
          !Number.isNaN(Number(form.warehouse.storage_capacity_tons))
            ? Number(form.warehouse.storage_capacity_tons)
            : null,
      },
    };

    try {
      setSaving(true);
      setError(null);
      const res = await dispatch(
        updateBuildingSupplier({ id, data: payload }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Поставщик обновлён");
        setIsEditing(false);
      } else {
        setError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось сохранить поставщика",
          ),
        );
      }
    } catch (err) {
      setError(
        validateResErrors(err, "Не удалось сохранить поставщика"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sell-form client-detail__form" onSubmit={handleSave}>
      <section className="sell-form__section">
        <div className="sell-form__actions" style={{ marginBottom: 8 }}>
          {!isEditing ? (
            <button
              type="button"
              className="add-product-page__submit-btn"
              onClick={() => {
                resetForm();
                setIsEditing(true);
              }}
            >
              Редактировать
            </button>
          ) : (
            <>
              <button
                type="button"
                className="add-product-page__cancel-btn"
                onClick={() => {
                  resetForm();
                  setIsEditing(false);
                }}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="add-product-page__submit-btn"
                disabled={saving}
              >
                {saving ? "Сохранение..." : "Сохранить изменения"}
              </button>
            </>
          )}
        </div>
      </section>

      <section className="sell-form__section">
        <h4 className="sell-form__sectionTitle">Организация</h4>
        <div className="client-detail__row">
          <span className="sell-form__label">Название организации</span>
          <input
            className="add-product-page__input"
            value={form.company_name}
            onChange={handleChange("company_name")}
            required
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Тип поставщика</span>
          <select
            className="add-product-page__input"
            value={form.supplier_type}
            onChange={handleChange("supplier_type")}
            disabled={!isEditing}
          >
            <option value="">Не выбрано</option>
            {Object.entries(SUPPLIER_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">ИНН</span>
          <input
            className="add-product-page__input"
            value={form.tax_id}
            onChange={handleChange("tax_id")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Рег. номер</span>
          <input
            className="add-product-page__input"
            value={form.registration_number}
            onChange={handleChange("registration_number")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Год основания</span>
          <input
            className="add-product-page__input"
            type="number"
            min={0}
            value={form.year_founded}
            onChange={handleChange("year_founded")}
            disabled={!isEditing}
          />
        </div>
      </section>

      <section className="sell-form__section">
        <h4 className="sell-form__sectionTitle">Контакты</h4>
        <div className="client-detail__row">
          <span className="sell-form__label">Контактное лицо</span>
          <input
            className="add-product-page__input"
            value={form.contact_person}
            onChange={handleChange("contact_person")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Должность</span>
          <input
            className="add-product-page__input"
            value={form.position}
            onChange={handleChange("position")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Телефон</span>
          <input
            className="add-product-page__input"
            value={form.phone}
            onChange={handleChange("phone")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Email</span>
          <input
            className="add-product-page__input"
            type="email"
            value={form.email}
            onChange={handleChange("email")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Сайт</span>
          <input
            className="add-product-page__input"
            value={form.website}
            onChange={handleChange("website")}
            disabled={!isEditing}
          />
        </div>
      </section>

      <section className="sell-form__section">
        <h4 className="sell-form__sectionTitle">Адрес и статус</h4>
        <div className="client-detail__row">
          <span className="sell-form__label">Город</span>
          <input
            className="add-product-page__input"
            value={form.city}
            onChange={handleChange("city")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Адрес</span>
          <input
            className="add-product-page__input"
            value={form.address}
            onChange={handleChange("address")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Индекс</span>
          <input
            className="add-product-page__input"
            value={form.postal_code}
            onChange={handleChange("postal_code")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Статус</span>
          <select
            className="add-product-page__input"
            value={form.status}
            onChange={handleChange("status")}
            disabled={!isEditing}
          >
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="sell-form__section">
        <h4 className="sell-form__sectionTitle">Показатели</h4>
        <div className="client-detail__row">
          <span className="sell-form__label">Рейтинг</span>
          <span>{supplier.rating || "—"}</span>
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Выполнено заказов</span>
          <span>
            {typeof supplier.completed_orders === "number"
              ? supplier.completed_orders
              : "—"}
          </span>
        </div>
      </section>

      <section className="sell-form__section">
        <details open={isEditing}>
          <summary
            className="sell-form__sectionTitle"
            style={{ fontSize: 16, fontWeight: 600 }}
          >
            Банковские реквизиты
          </summary>
        <div className="client-detail__row">
          <span className="sell-form__label">Название банка</span>
          <input
            className="add-product-page__input"
            value={form.bank_details.bank_name}
            onChange={handleBankFieldChange("bank_name")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Номер счёта</span>
          <input
            className="add-product-page__input"
            value={form.bank_details.account_number}
            onChange={handleBankFieldChange("account_number")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">BIC</span>
          <input
            className="add-product-page__input"
            value={form.bank_details.bic}
            onChange={handleBankFieldChange("bic")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">SWIFT</span>
          <input
            className="add-product-page__input"
            value={form.bank_details.swift}
            onChange={handleBankFieldChange("swift")}
            disabled={!isEditing}
          />
        </div>
        </details>
      </section>

      {/* Поставляемые материалы и доставка вынесены на отдельный таб */}

      <section className="sell-form__section">
        <details open={isEditing}>
          <summary
            className="sell-form__sectionTitle"
            style={{ fontSize: 16, fontWeight: 600 }}
          >
            Склад
          </summary>
        <div className="client-detail__row">
          <span className="sell-form__label">Есть склад</span>
          <label className="clients-toolbar__check">
            <input
              type="checkbox"
              checked={!!form.warehouse.has_warehouse}
              onChange={handleWarehouseFieldChange("has_warehouse")}
              disabled={!isEditing}
            />
            <span />
          </label>
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Адрес склада</span>
          <input
            className="add-product-page__input"
            value={form.warehouse.warehouse_address}
            onChange={handleWarehouseFieldChange("warehouse_address")}
            disabled={!isEditing}
          />
        </div>
        <div className="client-detail__row">
          <span className="sell-form__label">Вместимость склада (тонн)</span>
          <input
            className="add-product-page__input"
            type="number"
            min={0}
            value={form.warehouse.storage_capacity_tons}
            onChange={handleWarehouseFieldChange("storage_capacity_tons")}
            disabled={!isEditing}
          />
        </div>
        </details>
      </section>

      <section className="sell-form__section">
        <details open={isEditing}>
          <summary
            className="sell-form__sectionTitle"
            style={{ fontSize: 16, fontWeight: 600 }}
          >
            Прикреплённые файлы
          </summary>
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
        </details>
      </section>

      {error && (
        <div className="building-page__error" style={{ marginTop: 8 }}>
          {String(error)}
        </div>
      )}

      <Modal
        open={fileModalOpen}
        onClose={() => {
          if (fileUploading) return;
          setFileModalOpen(false);
          setNewFileTitle("");
          setFileError(null);
        }}
        title="Прикрепить файл поставщика"
      >
        <div className="sell-form">
          <section className="sell-form__section">
            <div className="sell-form__row">
              <label className="sell-form__label">Название файла</label>
              <input
                className="add-product-page__input"
                value={newFileTitle}
                onChange={(e) => setNewFileTitle(e.target.value)}
                placeholder="Например, Договор поставки"
                disabled={fileUploading}
              />
            </div>
            <div className="sell-form__row">
              <label className="sell-form__label">Файл</label>
              <input
                type="file"
                className="add-product-page__input"
                disabled={fileUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file || null);
                }}
              />
            </div>
            {fileError && (
              <div className="building-page__error" style={{ marginTop: 4 }}>
                {String(fileError)}
              </div>
            )}
          </section>
          <div className="sell-form__actions" style={{ marginTop: 12 }}>
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
    </form>
  );
}

