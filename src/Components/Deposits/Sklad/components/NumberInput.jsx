import { useState } from "react";

const round = (n) => Math.round(n);

/**
 * Числовое поле, которое не мешает вводу.
 *
 * Обычный `<input type="number">` с мгновенным clamp нельзя очистить и нельзя
 * набрать значение, начинающееся с недопустимой цифры (стёр всё — сразу
 * подставился минимум, набрал «0» — превратился в «1»). Здесь пока поле в
 * фокусе показываем ровно то, что набрал пользователь, а наружу отдаём уже
 * нормализованное число. При потере фокуса поле подтягивается к
 * нормализованному значению (пустое — к `fallback`).
 */
const NumberInput = ({
  value,
  onCommit,
  min = 1,
  max = 100,
  step = 1,
  fallback,
  onFocus,
  onBlur,
  onKeyDown,
  ...rest
}) => {
  const [draft, setDraft] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const clamp = (n) => Math.max(min, Math.min(max, n));
  const fallbackValue = fallback === undefined ? min : fallback;

  const parse = (raw) => {
    const text = String(raw ?? "").trim().replace(",", ".");
    if (text === "") return null;
    const n = Number(text);
    return Number.isFinite(n) ? clamp(round(n)) : null;
  };

  const commitDraft = () => {
    const parsed = parse(draft);
    const next = parsed === null ? clamp(round(Number(fallbackValue))) : parsed;
    setIsEditing(false);
    setDraft("");
    onCommit(next);
    return next;
  };

  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      step={step}
      value={isEditing ? draft : String(value ?? "")}
      onFocus={(e) => {
        setDraft(String(value ?? ""));
        setIsEditing(true);
        onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        setIsEditing(true);
        // Промежуточные состояния («», «0», «1» при min=20) оставляем в поле,
        // но наружу отдаём только валидное число — превью не ломается.
        const parsed = parse(raw);
        if (parsed !== null) onCommit(parsed);
      }}
      onBlur={(e) => {
        commitDraft();
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commitDraft();
          e.currentTarget.blur();
        }
        onKeyDown?.(e);
      }}
    />
  );
};

export default NumberInput;
