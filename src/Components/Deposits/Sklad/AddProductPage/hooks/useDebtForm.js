import { useState, useCallback, useMemo, useEffect } from "react";

/**
 * Хук для управления формой долга
 */
export const useDebtForm = (newItemData, list, company) => {
  const [debt, setDebt] = useState("");
  const [amount, setAmount] = useState("");
  const [debtMonths, setDebtMonths] = useState("");
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [debtState, setDebtState] = useState({
    phone: "",
    dueDate: "",
  });

  // Получаем выбранного поставщика для долга
  const pickSupplier = useMemo(() => {
    if (!newItemData.client) return null;
    return list.find((x) => String(x.id) === String(newItemData.client));
  }, [list, newItemData.client]);

  // Автоматическое заполнение телефона при выборе поставщика в тарифе "Старт"
  useEffect(() => {
    if (company?.subscription_plan?.name === "Старт" && pickSupplier?.phone) {
      setDebtState((prev) => ({ ...prev, phone: pickSupplier.phone }));
    }
  }, [newItemData.client, pickSupplier, company?.subscription_plan?.name]);

  const onChangeDebt = useCallback((e) => {
    const { name, value } = e.target;
    setDebtState((prev) => ({ ...prev, [name]: value }));
  }, []);

  const clearDebtData = useCallback(() => {
    setDebt("");
    setAmount("");
    setDebtMonths("");
    setShowDebtForm(false);
    setDebtState({
      phone: "",
      dueDate: "",
    });
  }, []);

  return {
    debt,
    setDebt,
    amount,
    setAmount,
    debtMonths,
    setDebtMonths,
    showDebtForm,
    setShowDebtForm,
    debtState,
    setDebtState,
    onChangeDebt,
    pickSupplier,
    clearDebtData,
  };
};

