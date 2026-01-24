import { useModal } from "../context/modal";


const useAlert = () => {
    const { openAlert } = useModal();
    const confirm = (message, callback, isError,) => {
        if (typeof callback === 'boolean') {
            isError = callback;
            callback = () => null;
        }
        openAlert({
            isError: Boolean(isError),
            message,
            onConfirm: (result) => callback?.(result),
        });
    };
    return confirm;
};

const useErrorModal = () => {
    const { openAlert } = useModal();
    const confirm = (message, callback) => {
        openAlert({
            isError: true,
            message,
            onConfirm: (result) => callback?.(result),
        });
    };
    return confirm;
};

const useConfirm = () => {
    const { openModal } = useModal();

    const confirm = (message, callback) => {
        openModal({
            message,
            onConfirm: (result) => callback(result),
            onCancel: (result) => callback(result),
        });
    };
    return confirm;
};




export { useAlert, useConfirm, useErrorModal }