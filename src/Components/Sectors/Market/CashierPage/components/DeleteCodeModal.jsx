import React, { useEffect, useRef, useState } from "react";
import { Lock, X } from "lucide-react";
import "./DeleteCodeModal.scss";

/**
 * Запрос кода подтверждения при удалении позиции/корзины.
 * Код задаёт владелец или админ в «Настройки → Касса».
 */
const DeleteCodeModal = ({
  title = "Удаление из корзины",
  description = "Введите код подтверждения, чтобы удалить позицию из корзины.",
  onConfirm,
  onCancel,
}) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleConfirm = async () => {
    const value = code.trim();
    if (!value) {
      setError("Введите код");
      return;
    }
    if (checking) return;

    setChecking(true);
    setError("");
    try {
      const ok = await onConfirm?.(value);
      if (!ok) {
        setError("Неверный код");
        setCode("");
        inputRef.current?.focus();
      }
    } catch (e) {
      setError("Не удалось проверить код. Попробуйте ещё раз.");
    } finally {
      setChecking(false);
    }
  };

  const handleKeyDown = (event) => {
    // Модалка ловит клавиши сама: касса вешает глобальные хоткеи на window.
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      handleConfirm();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel?.();
    }
  };

  return (
    <div className="delete-code-modal-overlay" onClick={onCancel}>
      <div
        className="delete-code-modal"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="delete-code-modal__header">
          <div className="delete-code-modal__titleWrap">
            <span className="delete-code-modal__icon">
              <Lock size={18} />
            </span>
            <h2 className="delete-code-modal__title">{title}</h2>
          </div>
          <button
            type="button"
            className="delete-code-modal__close"
            onClick={onCancel}
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
        </div>

        <div className="delete-code-modal__body">
          <p className="delete-code-modal__hint">{description}</p>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            className="delete-code-modal__input"
            placeholder="Код"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setError("");
            }}
          />
          {error ? <p className="delete-code-modal__error">{error}</p> : null}
        </div>

        <div className="delete-code-modal__actions">
          <button
            type="button"
            className="delete-code-modal__cancel-btn"
            onClick={onCancel}
          >
            Отмена [ESC]
          </button>
          <button
            type="button"
            className="delete-code-modal__confirm-btn"
            onClick={handleConfirm}
            disabled={checking}
          >
            {checking ? "Проверка..." : "Подтвердить"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteCodeModal;
