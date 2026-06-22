// Input.jsx

const Input = ({ label, name, value, onChange, ...props }) => {
  return (
    <div className={"formGroup"}>
      <label htmlFor={name}>{label}</label>
      <input
        type="text"
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        {...props}
      />
    </div>
  );
};

export default Input;
