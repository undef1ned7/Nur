import { useCallback } from "react";
import { useDispatch } from "react-redux";
import api from "../../../../../api";
import * as utils from "../utils";
import { NAVIGATION_DELAY } from "../constants";
import {
  createProductAsync,
  updateProductAsync,
} from "../../../../../store/creators/productCreators";
import { createDeal } from "../../../../../store/creators/saleThunk";
import { addCashFlows } from "../../../../../store/slices/cashSlice";

/**
 * Хук для обработки отправки формы товара
 * Разбивает большую функцию handleSubmit на логические части
 */
export const useProductSubmit = ({
  newItemData,
  marketData,
  itemType,
  weightProductsCount,
  isEditMode,
  productId,
  images,
  debt,
  debtMonths,
  amount,
  debtState,
  company,
  pickSupplier,
  cashData,
  selectCashBox,
  navigate,
  showAlert,
  setFieldErrors,
  setDebt,
  setAmount,
  setDebtMonths,
  setShowDebtForm,
  setDebtState,
}) => {
  const dispatch = useDispatch();

  /**
   * Валидация данных формы
   */
  const validateForm = useCallback(() => {
    setFieldErrors({});

    // Валидация товара
    const productErrors = utils.validateProductData({
      newItemData,
      marketData,
      itemType,
    });

    if (Object.keys(productErrors).length > 0) {
      setFieldErrors(productErrors);
      showAlert("Пожалуйста, заполните обязательные поля.", "error", "Ошибка");
      return false;
    }

    // Валидация для долговых операций
    if (debt && !newItemData.client) {
      showAlert("Выберите поставщика для долговой операции", "error", "Ошибка");
      return false;
    }

    const debtErrors = utils.validateDebtData(
      {
        debt,
        debtMonths,
        amount,
        purchasePrice: newItemData.purchase_price,
        quantity: newItemData.quantity,
        debtState,
      },
      company
    );

    if (Object.keys(debtErrors).length > 0) {
      const firstError = Object.values(debtErrors)[0];
      showAlert(firstError, "error", "Ошибка");
      return false;
    }

    return true;
  }, [
    newItemData,
    marketData,
    itemType,
    debt,
    debtMonths,
    amount,
    debtState,
    company,
    setFieldErrors,
    showAlert,
  ]);

  /**
   * Создание или обновление товара
   */
  const saveProduct = useCallback(
    async (payload) => {
      if (isEditMode && productId) {
        return await dispatch(
          updateProductAsync({
            productId,
            updatedData: payload,
          })
        ).unwrap();
      } else {
        return await dispatch(createProductAsync(payload)).unwrap();
      }
    },
    [dispatch, isEditMode, productId]
  );

  /**
   * Загрузка изображений товара
   */
  const uploadImages = useCallback(
    async (targetProductId, productName) => {
      if (!targetProductId || images.length === 0) return;

      const newImages = images.filter((im) => im.file);
      if (newImages.length === 0) return;

      try {
        const uploads = newImages.map(async (im) => {
          const fd = new FormData();
          fd.append("image", im.file);
          if (im.alt) fd.append("alt", im.alt || productName);
          fd.append("is_primary", String(Boolean(im.is_primary)));
          return api.post(`/main/products/${targetProductId}/images/`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        });
        await Promise.allSettled(uploads);
      } catch (error) {
        console.warn("Загрузка изображений не удалась:", error);
        // Не блокируем основной флоу
      }
    },
    [images]
  );

  /**
   * Создание долга
   */
  const createDebtRecord = useCallback(
    async (totalAmount) => {
      if (debt === "Долги" && newItemData.client) {
        if (company?.subscription_plan?.name === "Старт") {
          await utils.createDebt({
            name: pickSupplier?.full_name,
            phone: debtState.phone,
            due_date: debtState.dueDate,
            amount: totalAmount,
          });
        }

        await dispatch(
          createDeal({
            clientId: newItemData.client,
            title: `Долг ${pickSupplier?.full_name}`,
            statusRu: debt,
            amount: totalAmount,
            debtMonths: Number(debtMonths),
          })
        ).unwrap();
      }

      if (debt === "Предоплата" && newItemData.client) {
        await dispatch(
          createDeal({
            clientId: newItemData.client,
            title: `Предоплата ${pickSupplier?.full_name}`,
            statusRu: debt,
            amount: totalAmount,
            prepayment: Number(amount),
            debtMonths: Number(debtMonths),
          })
        ).unwrap();
      }
    },
    [
      dispatch,
      debt,
      newItemData.client,
      company,
      pickSupplier,
      debtState,
      debtMonths,
      amount,
    ]
  );

  /**
   * Создание денежного потока
   */
  const createCashFlow = useCallback(
    async (product, productName) => {
      if (isEditMode || debt === "Долги") return;

      const sellingPrice =
        newItemData.price || newItemData.price || "0";
      const amountForCash = debt === "Предоплата" ? amount : sellingPrice;
      const cashboxId = cashData.cashbox || selectCashBox;

      if (cashboxId && Number(amountForCash) > 0) {
        try {
          await dispatch(
            addCashFlows({
              cashbox: cashboxId,
              type: "expense",
              name: productName || product?.name || "Новый товар",
              amount: amountForCash,
              source_cashbox_flow_id: product.id,
              source_business_operation_id: "Склад",
              status:
                company?.subscription_plan?.name === "Старт"
                  ? "approved"
                  : "pending",
            })
          ).unwrap();
        } catch (cashError) {
          console.warn("Ошибка при создании денежного потока:", cashError);
        }
      }
    },
    [
      dispatch,
      isEditMode,
      debt,
      newItemData.price,
      amount,
      cashData.cashbox,
      selectCashBox,
      company,
    ]
  );

  /**
   * Создание сделки (если не долг)
   */
  const createDealRecord = useCallback(
    async (totalAmount) => {
      if (newItemData.client && !debt) {
        await dispatch(
          createDeal({
            clientId: newItemData.client,
            title: newItemData.name,
            statusRu: "Продажа",
            amount: totalAmount,
          })
        ).unwrap();
      }
    },
    [dispatch, newItemData.client, newItemData.name, debt]
  );

  /**
   * Очистка данных долга после успешного сохранения
   */
  const clearDebtData = useCallback(() => {
    setDebt("");
    setAmount("");
    setDebtMonths("");
    setShowDebtForm(false);
    setDebtState({
      phone: "",
      dueDate: "",
    });
  }, [setDebt, setAmount, setDebtMonths, setShowDebtForm, setDebtState]);

  /**
   * Основная функция отправки формы
   */
  const handleSubmit = useCallback(async () => {
    // Валидация
    if (!validateForm()) {
      return;
    }

    try {
      // Формируем payload используя утилиту
      const payload = utils.buildProductPayload({
        newItemData,
        marketData,
        itemType,
        weightProductsCount,
      });

      // Создаем или обновляем товар
      const product = await saveProduct(payload);

      // Вычисляем totalAmount для долгов и сделок
      const purchasePrice =
        itemType === "product" ? newItemData.purchase_price || "0" : "0";
      const qty =
        itemType === "product" ? Number(newItemData.quantity || "0") : 0;
      const totalAmount = Number(purchasePrice) * qty;

      // Загружаем изображения
      const targetProductId = isEditMode
        ? productId
        : product?.id || product?.data?.id;

      if (!targetProductId) {
        throw new Error("Не удалось получить ID товара");
      }

      await uploadImages(targetProductId, newItemData.name);

      // Создаем долг, если выбран
      await createDebtRecord(totalAmount);

      // Создаем денежный поток
      await createCashFlow(product, newItemData.name);

      // Создаем сделку (если не долг)
      await createDealRecord(totalAmount);

      // Очищаем данные долга
      clearDebtData();

      // Показываем успешное сообщение
      showAlert(
        isEditMode ? "Товар успешно обновлен!" : "Товар успешно добавлен!",
        "success",
        "Успех"
      );

      // Перенаправляем на страницу склада
      setTimeout(() => {
        navigate("/crm/sklad");
      }, NAVIGATION_DELAY);
    } catch (err) {
      console.error("Failed to create/update product:", err);
      const errorMessage =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Неизвестная ошибка";
      showAlert(
        `Ошибка при ${isEditMode ? "обновлении" : "добавлении"} товара: ${errorMessage}`,
        "error",
        "Ошибка"
      );
    }
  }, [
    validateForm,
    newItemData,
    marketData,
    itemType,
    weightProductsCount,
    saveProduct,
    isEditMode,
    productId,
    uploadImages,
    createDebtRecord,
    createCashFlow,
    createDealRecord,
    clearDebtData,
    showAlert,
    navigate,
  ]);

  return { handleSubmit };
};

