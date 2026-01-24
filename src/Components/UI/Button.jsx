import React from 'react';

const Button = ({ 
  children, 
  className = '', 
  variant = 'primary',
  ...props 
}) => {
  
  // Базовые классы
  const baseClass = 'px-4 py-2 rounded-md font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  // Варианты
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-300',
  };
  
  const variantClass = variants[variant] || variants.primary;
  
  return (
    <button 
      className={`${baseClass} ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// Хелпер для создания кнопки с иконкой
Button.WithIcon = ({ icon, children, iconPosition = 'left', ...props }) => {
  return (
    <Button {...props}>
      {iconPosition === 'left' && <span className="mr-2">{icon}</span>}
      {children}
      {iconPosition === 'right' && <span className="ml-2">{icon}</span>}
    </Button>
  );
};

// Хелпер для создания кнопки загрузки
Button.Loading = ({ loadingText = 'Загрузка...', ...props }) => {
  return (
    <Button disabled {...props}>
      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      {loadingText}
    </Button>
  );
};

export default Button;