import React, { useEffect, useRef } from "react";
import ReactPortal from "../Portal/ReactPortal";
import { Button } from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import "./SystemDialog.scss";

const GlobalAlertModal = ({ isError, message, isOpen, onConfirm }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleOverlayClick = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onConfirm?.();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        onConfirm?.();
      }
    };

    document.addEventListener("mousedown", handleOverlayClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleOverlayClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onConfirm]);

  if (!isOpen) return null;

  return (
    <ReactPortal wrapperId="global-alert-modal">
      <div className="system-dialog-overlay">
        <div ref={modalRef} className="system-dialog" role="dialog" aria-modal="true">
          <div className="system-dialog__body">
            <div className="system-dialog__icon-wrap">
              {isError ? (
                <ReportProblemIcon color="error" />
              ) : (
                <NotificationsIcon color="info" />
              )}
            </div>
            <h3 className="system-dialog__title">
              {isError ? "Ошибка" : "Оповещение"}
            </h3>
            <p className="system-dialog__message">{message}</p>
          </div>
          <div className="system-dialog__actions">
            <Button
              color={isError ? "error" : "warning"}
              variant="contained"
              onClick={() => onConfirm?.()}
            >
              Ок
            </Button>
          </div>
        </div>
      </div>
    </ReactPortal>
  );
};

export default GlobalAlertModal;
