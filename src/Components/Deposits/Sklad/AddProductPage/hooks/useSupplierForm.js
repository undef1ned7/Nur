import { useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../../../store/creators/clientCreators";

/**
 * Хук для управления формой создания поставщика
 */
export const useSupplierForm = (setNewItemData, showAlert) => {
  const dispatch = useDispatch();
  const [showInputs, setShowInputs] = useState(false);
  const [state, setState] = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    type: "suppliers",
    llc: "",
    inn: "",
    okpo: "",
    score: "",
    bik: "",
    address: "",
  });

  const onChange = useCallback((e) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  }, []);

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      try {
        const client = await dispatch(createClientAsync(state)).unwrap();
        dispatch(fetchClientsAsync());
        setShowInputs(false);
        // Автоматически выбираем созданного поставщика
        if (client?.id) {
          setNewItemData((prev) => ({
            ...prev,
            client: String(client.id),
          }));
        }
        setState({
          full_name: "",
          phone: "",
          email: "",
          date: new Date().toISOString().split("T")[0],
          type: "suppliers",
          llc: "",
          inn: "",
          okpo: "",
          score: "",
          bik: "",
          address: "",
        });
        showAlert("Поставщик успешно создан!", "success", "Успех");
      } catch (e) {
        console.error("Ошибка при создании поставщика:", e);
        showAlert(
          `Ошибка при создании поставщика: ${e?.message || JSON.stringify(e)}`,
          "error",
          "Ошибка"
        );
      }
    },
    [dispatch, state, setNewItemData, showAlert]
  );

  return {
    showInputs,
    setShowInputs,
    state,
    setState,
    onChange,
    onSubmit,
  };
};

