import React from "react";
import "./Department.scss";

const Select = ({
  label,
  name,
  value,
  onChange,
  options,
  multiple = false,
  ...props
}) => {
  // console.log(options);

  return (
    <div className={"formGroup"}>
      <label htmlFor={name}>{label}</label>
      <select
        id={name}
        name={name}
        value={multiple ? (Array.isArray(value) ? value : []) : value}
        onChange={onChange}
        multiple={multiple}
        {...props}
      >
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
