// Select.jsx
// Импортируем стили. Здесь используется стили из DepartmentDetails.module.scss
// В реальном проекте, для общих компонентов, лучше иметь Select.module.scss

const Select = ({
  label,
  name,
  value,
  onChange,
  options,
  multiple = false,
  ...props
}) => {
  return (
    <div className={"formGroup"}>
      <label htmlFor={name}>{label}</label> {/* Лейбл для select */}
      <select
        id={name}
        name={name}
        // Для multiple select value должно быть массивом
        value={multiple ? (Array.isArray(value) ? value : []) : value}
        onChange={onChange}
        multiple={multiple} // Определяет, является ли это мультивыбором
        {...props} // Передаем все остальные пропсы
      >
        {/* Опция "Выберите..." только для сингл-выбора */}
        {!multiple && <option value="">Выберите...</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Select;
