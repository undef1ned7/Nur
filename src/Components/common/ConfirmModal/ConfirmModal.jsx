import { Button } from "@mui/material";
import ReactPortal from "../Portal/ReactPortal";

const ConfirmModal = ({ message, isOpen, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
        <ReactPortal wrapperId='modal'>
            <div className='fixed top-0 left-0 flex w-full h-full justify-center items-center z-100'>
                <div className='modal-content max-w-100 p-5'>
                    <div className='max-h-75 overflow-y-auto'>
                        <div className="mx-auto flex mt-2.5 p-2.25 w-13.75 h-13.75 rounded-full bg-[#e4e6e7]">
                            <svg className="feather feather-help-circle w-full h-full text-red-400" fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>
                        </div>
                        <h3 className='text-[20px] font-bold text-[#575b61] text-center my-2'>Подтвердите ваше действие</h3>
                        <p className='text-center text-[14px] text-[#8f9296] mb-3.75 whitespace-pre-wrap'>
                            {message}
                        </p>
                    </div>
                    <div className='flex justify-center gap-2'>
                        <Button onClick={() => onCancel?.()}>Отменить</Button>
                        <Button color="warning" onClick={() => onConfirm?.()}>Подтвердить</Button>
                    </div>
                </div>
            </div>
        </ReactPortal>
    )
}

export default ConfirmModal;
