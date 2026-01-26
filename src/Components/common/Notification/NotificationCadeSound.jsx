import React, { useEffect, useRef, useState, useCallback } from 'react';

export default function NotificationCadeSound({ deps }) {
    const audioRef = useRef(null);
    const isFirstEffect = useRef(true);
    const [audioUnlocked, setAudioUnlocked] = useState(false);
    const [showUnlockButton, setShowUnlockButton] = useState(false);
    const [playError, setPlayError] = useState(null);

    // Функция для разблокировки аудио
    const unlockAudio = useCallback(async () => {
        if (!audioRef.current || audioUnlocked) return;

        try {
            // Пробуем воспроизвести с тихим звуком для разблокировки
            audioRef.current.volume = 0.01;
            await audioRef.current.play();

            // Пауза и сброс после успешной разблокировки
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.volume = 1;

            setAudioUnlocked(true);
            setShowUnlockButton(false);
            setPlayError(null);

            console.log('✅ Аудио успешно разблокировано');
        } catch (error) {
            console.error('❌ Не удалось разблокировать аудио:', error);
            setPlayError(error.message);
        }
    }, [audioUnlocked]);

    // Обработчик глобального взаимодействия (авто-разблокировка)
    useEffect(() => {
        const handleInteraction = () => {
            if (!audioUnlocked) {
                unlockAudio();
            }
        };

        const events = ['click', 'touchstart', 'keydown'];
        events.forEach(event => {
            document.addEventListener(event, handleInteraction, { once: true });
        });

        return () => {
            events.forEach(event => {
                document.removeEventListener(event, handleInteraction);
            });
        };
    }, [audioUnlocked, unlockAudio]);

    // Основной эффект воспроизведения
    useEffect(() => {
        if (!audioRef.current) return;

        // Пропускаем первый вызов
        if (isFirstEffect.current) {
            isFirstEffect.current = false;
            return;
        }

        const playNotification = async () => {
            if (audioUnlocked) {
                try {
                    audioRef.current.currentTime = 0;
                    await audioRef.current.play();
                    setPlayError(null);
                } catch (error) {
                    console.error('❌ Ошибка воспроизведения:', error);
                    setPlayError(error.message);

                    // Если ошибка автовоспроизведения, показываем кнопку
                    if (error.name === 'NotAllowedError') {
                        setAudioUnlocked(false);
                        setShowUnlockButton(true);
                    }
                }
            } else {
                // Показываем кнопку разблокировки если аудио заблокировано
                setShowUnlockButton(true);
                console.log('🔇 Аудио заблокировано');
            }
        };

        playNotification();
    }, [deps, audioUnlocked]);

    return (
        <>
            {showUnlockButton && !audioUnlocked && (
                <div className="fixed bottom-4 right-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 max-w-xs animate-slide-up">
                        <div className="flex items-start gap-3 mb-3">
                            <div className="bg-emerald-500 text-white w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                                🔔
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800 text-sm">
                                    Звуковые уведомления
                                </h3>
                                <p className="text-gray-600 text-xs mt-1">
                                    Кликните, чтобы разрешить звуковые уведомления
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={unlockAudio}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2"
                            >
                                <span>🔊</span>
                                Включить звук
                            </button>

                            <button
                                onClick={() => setShowUnlockButton(false)}
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-lg text-sm font-medium transition-colors duration-200"
                            >
                                Позже
                            </button>
                        </div>

                        {playError && (
                            <p className="text-red-500 text-xs mt-2">
                                {playError.includes('NotAllowedError')
                                    ? 'Требуется взаимодействие с сайтом'
                                    : 'Ошибка воспроизведения'}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {process.env.NODE_ENV === 'development' && (
                <div className={`fixed top-4 right-4 z-40 px-3 py-2 rounded-lg text-xs font-medium ${audioUnlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {audioUnlocked ? '🔊 Звук включен' : '🔇 Звук выключен'}
                </div>
            )}

            <audio
                ref={audioRef}
                src="/sounds/notification.mp3"
                preload="auto"
                className="hidden"
            />

            <style jsx>{`
                @keyframes slide-up {
                    from {
                        transform: translateY(100px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>
        </>
    );
}