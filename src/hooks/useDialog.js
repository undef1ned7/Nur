import { useCallback } from "react";
import { useModal } from "../context/modal";

// Все хуки возвращают СТАБИЛЬНУЮ функцию (useCallback): иначе компоненты,
// которые кладут alert/confirm в зависимости useEffect/useCallback, попадают
// в бесконечный цикл ре-рендеров и запросов. openAlert/openModal в провайдере
// уже мемоизированы (useCallback с []), поэтому ссылка действительно стабильна.

const useAlert = () => {
    const { openAlert } = useModal();

    return useCallback(
        (message, callback, isError) => {
            if (typeof callback === "boolean") {
                isError = callback;
                callback = () => null;
            }
            return openAlert({
                isError: Boolean(isError),
                message,
                onConfirm: (result) => callback?.(result),
            });
        },
        [openAlert],
    );
};

const useErrorModal = () => {
    const { openAlert } = useModal();

    return useCallback(
        (message, callback) => {
            openAlert({
                isError: true,
                message,
                onConfirm: (result) => callback?.(result),
            });
        },
        [openAlert],
    );
};

const useConfirm = () => {
    const { openModal } = useModal();

    return useCallback(
        (message, callback) => {
            openModal({
                message,
                onConfirm: (result) => callback(result),
                onCancel: (result) => callback(result),
            });
        },
        [openModal],
    );
};

export { useAlert, useConfirm, useErrorModal };
