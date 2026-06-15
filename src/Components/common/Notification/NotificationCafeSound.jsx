import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';

export default function NotificationCafeSound({
    notificationKey,
    notification,
    notificationOptions,
    clearNotification
}) {
    const defaultAudioRef = useRef(null);
    const waiterAudioRef = useRef(null);
    const isFirstEffect = useRef(true);
    const [audioUnlocked, setAudioUnlocked] = useState(false);
    const [showUnlockButton, setShowUnlockButton] = useState(false);
    const [playError, setPlayError] = useState(null);
    const lastPlayedKeyRef = useRef(null);
    const lastToastKeyRef = useRef(null);
    const [currentNotification, setCurrentNotification] = useState([]);

    const variant = String(notificationOptions?.variant || "default");
    const stickyDefault = Boolean(notificationOptions?.sticky);

    const activeAudioRef = useMemo(() => {
        return variant === "waiter" ? waiterAudioRef : defaultAudioRef;
    }, [variant]);

    const removeNotificationById = useCallback((id) => {
        const sid = String(id || "");
        if (!sid) return;
        setCurrentNotification((prev) => prev.filter((n) => String(n?.id) !== sid));
        try {
            if (typeof clearNotification === "function") clearNotification(sid);
        } catch { }
    }, [clearNotification]);

    const tryUnlockEl = async (el) => {
        if (!el) return;
        el.volume = 0.01;
        await el.play();
        el.pause();
        el.currentTime = 0;
        el.volume = 1;
    };

    const unlockAudio = useCallback(async () => {
        if (audioUnlocked) return;

        try {
            // Пробуем воспроизвести с тихим звуком для разблокировки (сразу оба звука)
            await tryUnlockEl(defaultAudioRef.current);
            await tryUnlockEl(waiterAudioRef.current);

            setAudioUnlocked(true);
            setShowUnlockButton(false);
            setPlayError(null);
        } catch (error) {
            setPlayError(String(error?.message || error));
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
        if (!activeAudioRef?.current) return;

        // Пропускаем первый вызов
        if (isFirstEffect.current) {
            isFirstEffect.current = false;
            return;
        }

        // Дедуп: одно и то же событие не проигрываем повторно
        if (notificationKey && lastPlayedKeyRef.current === notificationKey) return;
        if (notificationKey) lastPlayedKeyRef.current = notificationKey;

        const playNotification = async () => {
            if (audioUnlocked) {
                try {
                    activeAudioRef.current.currentTime = 0;
                    await activeAudioRef.current.play();
                    setPlayError(null);
                } catch (error) {
                    setPlayError(String(error?.message || error));
                    if (error.name === 'NotAllowedError') {
                        setAudioUnlocked(false);
                        setShowUnlockButton(true);
                    }
                }
            } else {
                setShowUnlockButton(true);
            }
        };

        playNotification();

    }, [notificationKey, audioUnlocked, activeAudioRef]);

    useEffect(() => {
        if (!notification) return;

        // Дедуп: если ключ тот же — не добавляем второй тост
        if (notificationKey && lastToastKeyRef.current === notificationKey) return;
        if (notificationKey) lastToastKeyRef.current = notificationKey;

        const newNotification = {
            id: Date.now().toString(),
            text: notification,
            sticky: stickyDefault,
        }

        setCurrentNotification(prev => {
            return [newNotification, ...prev]
        })

        if (!newNotification.sticky) {
            setTimeout(() => {
                removeNotificationById(newNotification.id);
            }, 4000);
        }
    }, [notification, notificationKey, stickyDefault, removeNotificationById])
    return (
        <>
            {showUnlockButton && !audioUnlocked && (
                <div className="fixed bottom-4 right-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 max-w-xs animate-slide-up">
                        <div className="flex items-start gap-3 mb-3">
                            <div className="bg-emerald-500 text-white w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0">
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
            {
                !!currentNotification.length &&
                (
                    <div className='fixed top-4 gap-2 right-4 z-40 flex flex-col'>
                        {
                            currentNotification.map(({ id, text, sticky }) => (
                                <div
                                    onClick={() => removeNotificationById(id)}
                                    key={id}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-800 shadow-sm border border-emerald-200 flex items-start gap-2`}
                                >
                                    <div className="whitespace-pre-line flex-1">
                                        {text}
                                    </div>
                                </div>
                            ))
                        }

                    </div>
                )
            }
            <audio ref={defaultAudioRef} src="/sounds/notification.mp3" preload="auto" className="hidden" />
            <audio ref={waiterAudioRef} src="/sounds/waiter_notification.mp3" preload="auto" className="hidden" />

            <style>{`
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