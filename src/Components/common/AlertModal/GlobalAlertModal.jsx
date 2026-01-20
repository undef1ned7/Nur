import React, { useEffect, useRef } from 'react'
import ReactPortal from '../Portal/ReactPortal';
import { Button } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
const GlobalAlertModal = ({ isError, message, isOpen, onConfirm }) => {

    const modalRef = useRef(null)
    useEffect(() => {
        if (!isOpen) return
        const closeModal = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) {
                (onConfirm || closeModal)()
            }
        }
        if (modalRef.current) {
            document.addEventListener('click', closeModal)
        }
        return () => document.removeEventListener('click', closeModal)
    }, [])
    if (!isOpen) return null;

    return (
        <ReactPortal wrapperId='modal'>
            <div className='fixed top-0 left-0 flex w-full h-full justify-center items-center z-100'>
                <div ref={modalRef} className='modal-content max-w-100px p-5'>
                    <div className='max-h-75 overflow-y-auto'>
                        <div className="mx-auto flex mt-2.5 p-2.25 w-13.75 h-13.75  justify-center items-center rounded-full bg-[#e4e6e7]">
                            {
                                isError ? <ReportProblemIcon color="error" /> : <NotificationsIcon color='info' className='w-full h-full' />
                            }
                        </div>
                        <h3 className='text-[20px] font-bold text-[#575b61] text-center my-2'>{isError ? 'Ошибка' : 'Оповощение'}</h3>
                        <p className='text-center text-[14px] text-[#8f9296] mb-3.75'>
                            {message}
                        </p>
                    </div>
                    <div className='flex justify-center gap-2'>
                        <Button color={isError ? 'error' : 'warning'} onClick={() => (onConfirm || closeModal)()} >Ок</Button>
                    </div>
                </div>
            </div>
        </ReactPortal>
    )
}

export default GlobalAlertModal;
