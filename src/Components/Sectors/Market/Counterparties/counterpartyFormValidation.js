import { validateBankAccounts } from "./counterpartyBankAccounts";

const PHONE_RE = /^\+?\d[\d\s\-()]{5,}$/;

/**
 * Проверка формы контрагента (создание и редактирование).
 * Возвращает первую ошибку с именем поля — чтобы показать её у поля
 * и прокрутить к нему (QA B25: ошибка вверху модалки была вне экрана).
 * @returns {{ field: string, message: string } | null}
 */
export const validateCounterpartyForm = (formData, bankAccounts) => {
  const name = String(formData?.name ?? "").trim();
  if (!name) {
    return { field: "name", message: "Название контрагента обязательно" };
  }
  if (name.length > 255) {
    return {
      field: "name",
      message: "Название не должно превышать 255 символов",
    };
  }
  if (!formData?.type) {
    return { field: "type", message: "Тип контрагента обязателен" };
  }
  const phone = String(formData?.phone ?? "").trim();
  if (phone && !PHONE_RE.test(phone)) {
    return {
      field: "phone",
      message: "Неверный формат телефона. Пример: +996 555 123 456",
    };
  }
  const bankErr = validateBankAccounts(bankAccounts);
  if (bankErr) return { field: "bank_accounts", message: bankErr };
  return null;
};

const FORM_FIELD_LABELS = {
  name: "Название",
  phone: "Телефон",
  type: "Тип",
  inn: "ИНН",
  okpo: "ОКПО",
  address: "Адрес",
  agent: "Агент",
  bank_accounts: "Банковские счета",
};

/** Поля, у которых форма показывает ошибку прямо под инпутом */
export const INLINE_ERROR_FIELDS = ["name", "phone"];

const toText = (v) => {
  if (Array.isArray(v)) return v.map(toText).filter(Boolean).join(", ");
  if (v && typeof v === "object") return toText(Object.values(v));
  return v ? String(v) : "";
};

/**
 * Ошибка API → { message, fieldErrors }.
 * DRF отдаёт { phone: ["..."] } — ошибки полей из INLINE_ERROR_FIELDS показываем
 * у поля, остальные — текстом в общем блоке.
 */
export const parseCounterpartyApiError = (err, fallback) => {
  if (!err) return { message: "", fieldErrors: {} };
  if (typeof err === "string") return { message: err, fieldErrors: {} };
  // Сетевая/клиентская ошибка (axios без ответа бэкенда): у Error есть поля name ("AxiosError")
  // и message, но это не ошибки полей формы — иначе «AxiosError» оказывается под полем названия.
  if (err instanceof Error || err?.isAxiosError === true) {
    return { message: err.message || fallback, fieldErrors: {} };
  }
  const fieldErrors = {};
  const otherFieldMessages = [];
  Object.keys(FORM_FIELD_LABELS).forEach((f) => {
    const text = toText(err?.[f]);
    if (!text) return;
    if (INLINE_ERROR_FIELDS.includes(f)) fieldErrors[f] = text;
    else otherFieldMessages.push(`${FORM_FIELD_LABELS[f]}: ${text}`);
  });
  const message =
    toText(err?.detail) ||
    toText(err?.message) ||
    toText(err?.non_field_errors) ||
    otherFieldMessages.join("; ") ||
    (Object.keys(fieldErrors).length ? "" : fallback);
  return { message, fieldErrors };
};

/** Прокрутить к полю с ошибкой (или к блоку ошибки) и поставить на него фокус. */
export const scrollToFormError = (formEl, field) => {
  if (!formEl) return;
  const run = () => {
    const target =
      (field && formEl.querySelector(`[name="${field}"]`)) ||
      formEl.querySelector("[data-form-error]");
    if (!target) return;
    target.scrollIntoView?.({ block: "center", behavior: "smooth" });
    if (typeof target.focus === "function" && target.name) {
      target.focus({ preventScroll: true });
    }
  };
  if (typeof window !== "undefined" && window.requestAnimationFrame) {
    window.requestAnimationFrame(run);
  } else {
    run();
  }
};
