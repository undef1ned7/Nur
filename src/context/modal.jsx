import { createContext, useState, useContext, useCallback } from 'react';
import GlobalAlertModal from '../Components/common/AlertModal/GlobalAlertModal';
import ConfirmModal from '../Components/common/ConfirmModal/ConfirmModal';

const ModalContext = createContext();

export const ModalProvider = ({ children }) => {
    const [modalState, setModalState] = useState({
        isOpen: false,
        message: '',
        onConfirm: null,
        onCancel: null,
    });
    const [alertModal, setAlertModal] = useState({
        isError: false,
        isOpen: false,
        message: '',
        onConfirm: null,
    });

    const openModal = useCallback(({ message, onConfirm, onCancel }) => {
        setModalState({
            isOpen: true,
            message,
            onConfirm: () => {
                onConfirm(true);
                setModalState((prev) => ({ ...prev, isOpen: false }));
            },
            onCancel: () => {
                onCancel(false);
                setModalState((prev) => ({ ...prev, isOpen: false }));
            },
        });
    }, []);

    // Открыть Alert Modal
    const openAlert = useCallback(({ isError = false, message, onConfirm }) => {
        setAlertModal({
            isError,
            isOpen: true,
            message,
            onConfirm: () => {
                onConfirm(true);
                setAlertModal((prev) => ({ ...prev, isOpen: false }));
            },
        });
    }, []);


    return (
        <ModalContext.Provider value={{ openModal, openAlert }}>
            <ConfirmModal {...modalState} />
            <GlobalAlertModal {...alertModal} />
            {children}
        </ModalContext.Provider>
    );
};

export const useModal = () => {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
};
