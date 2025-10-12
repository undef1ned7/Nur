// Input.jsx
import React from 'react';
// Импортируем стили. Здесь используется стили из DepartmentDetails.module.scss
// В реальном проекте, для общих компонентов, лучше иметь Input.module.scss
import styles from './DepartmentDetails.module.scss'; // Или './Input.module.scss'

const Input = ({ label, name, value, onChange, ...props }) => {
    return (
        <div className={styles.formGroup}>
            <label htmlFor={name}>{label}</label> {/* Лейбл для поля ввода */}
            <input
                type="text"
                id={name}
                name={name}
                value={value}
                onChange={onChange}
                {...props} // Передаем все остальные пропсы (required, maxLength, minLength и т.д.)
            />
        </div>
    );
};

export default Input;