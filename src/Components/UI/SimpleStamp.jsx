import { useMemo } from "react";

export const SimpleStamp = ({ type = 'paid', size = 'sm', className = '', date = null }) => {
    const sizes = {
        sm: 'scale-25',
        md: 'scale-50',
        lg: 'scale-75',
        xl: 'scale-100'
    };
    const config = {
        closed: {
            text: 'ОПЛАЧЕНО',
            mainText: 'ОПЛАЧЕНО',
            color: 'text-green-700',
            border: 'border-green-600',
            bg: 'bg-green-100/90',
            icon: '✓'
        },
        cancelled: {
            text: 'ОТМЕНЕНО',
            mainText: 'ОТМЕНЕНО',
            color: 'text-red-700',
            border: 'border-red-600',
            bg: 'bg-red-100/90',
            icon: '✗'
        },
        draft: {
            text: 'ЧЕРНОВИК',
            mainText: 'ЧЕРНОВИК',
            color: 'text-gray-700',
            border: 'border-gray-600',
            bg: 'bg-gray-100',
            icon: '📄'
        },
        approved: {
            text: 'УТВЕРЖДЕНО',
            mainText: 'УТВЕРЖДЕНО',
            color: 'text-blue-700',
            border: 'border-blue-600',
            bg: 'bg-blue-100',
            icon: '✓'
        },
        urgent: {
            text: 'СРОЧНО',
            mainText: 'СРОЧНО!',
            color: 'text-orange-700',
            border: 'border-orange-600',
            bg: 'bg-orange-100',
            icon: '⚠️'
        }
    };
    if (!config[type]) return (null);
    const formatedDate = useMemo(() => {
        if (!date) return ''
        return new Date(date).toLocaleDateString('ru-RU')
    }, [])
    const { text, mainText, color, border, bg, icon } = config[type];

    return (
        <div className={`${sizes[size]} inline-flex flex-col items-center absolute justify-center p-4 
      border-3 ${border} ${bg} rounded-lg 
      transform rotate-3 shadow-lg
      print:shadow-none print:border-2 ${className}`}>

            {/* Верхняя линия */}
            <div className="w-full border-t-2 border-dashed border-gray-400 mb-2"></div>

            {/* Основное содержание */}
            <div className="text-center">
                <div className={`text-4xl font-black mb-1 ${color}`}>
                    {icon}
                </div>
                <div className={`text-lg font-bold uppercase tracking-wider ${color}`}>
                    {mainText}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                    {formatedDate}
                </div>
            </div>

            {/* Нижняя линия */}
            <div className="w-full border-t-2 border-dashed border-gray-400 mt-2"></div>

            {/* Текст по периметру (упрощенный) */}
            <div className={`absolute -top-1 left-2 text-xs font-bold ${color}`}>
                {text.charAt(0)}
            </div>
            <div className={`absolute -top-1 right-2 text-xs font-bold ${color}`}>
                {text.charAt(text.length - 1)}
            </div>
        </div>
    );
};
