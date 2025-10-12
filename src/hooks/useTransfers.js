// src/hooks/useTransfers.js
import { useSelector } from "react-redux";

export const useTransfers = () => {
  const transfers = useSelector((state) => state.transfer);
  return transfers;
};

export const useAcceptances = () => {
  const acceptances = useSelector((state) => state.acceptance);
  return acceptances;
};
