import { createAsyncThunk } from "@reduxjs/toolkit";
import buildingAPI from "../../../api/building";
import { fetchBuildingTreatyById } from "./treatiesCreators";

/**
 * Загрузить платежи по конкретному взносу рассрочки.
 * GET /api/building/treaty-installments/{installment_id}/payments/
 */
export const fetchBuildingInstallmentPayments = createAsyncThunk(
  "buildingTreatyInstallments/fetchPayments",
  async (installmentId, { rejectWithValue }) => {
    try {
      const data = await buildingAPI.getInstallmentPayments(installmentId);
      return { installmentId, data };
    } catch (err) {
      return rejectWithValue(err);
    }
  },
);

/**
 * Создать оплату по взносу рассрочки (частичную или полную).
 * POST /api/building/treaty-installments/{installment_id}/payments/
 *
 * На успешном выполнении:
 * - перезагружает список платежей по взносу;
 * - перезагружает детали договора, чтобы обновить paid_amount/status.
 */
export const createBuildingInstallmentPayment = createAsyncThunk(
  "buildingTreatyInstallments/createPayment",
  async (
    { installmentId, treatyId, payload },
    { rejectWithValue, dispatch },
  ) => {
    try {
      const data = await buildingAPI.createInstallmentPayment(
        installmentId,
        payload,
      );

      // Обновляем историю платежей по взносу
      if (installmentId) {
        await dispatch(fetchBuildingInstallmentPayments(installmentId));
      }

      // Обновляем договор, чтобы подтянуть обновлённые installments
      if (treatyId) {
        await dispatch(fetchBuildingTreatyById(treatyId));
      }

      return { installmentId, data };
    } catch (err) {
      return rejectWithValue(err);
    }
  },
);

