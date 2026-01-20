import React, { useEffect, useRef } from 'react'
import ReactPortal from '../Portal/ReactPortal';
import { Button } from '@mui/material';


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
                        <div className="mx-auto flex mt-2.5 p-2.25 w-13.75 h-13.75 rounded-full bg-[#e4e6e7]">
                            {
                                isError ? <img src="/svg/error.svg" alt="X" /> : <svg className="feather feather-x-circle w-full h-full text-orange-400" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" /><line x1="15" x2="9" y1="9" y2="15" /><line x1="9" x2="15" y1="9" y2="15" /></svg>
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
