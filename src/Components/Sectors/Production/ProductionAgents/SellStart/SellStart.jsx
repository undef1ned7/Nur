import { Minus, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import {
  useDebounce,
  useDebouncedAction,
} from "../../../../../hooks/useDebounce";
import {
  doSearchInAgent,
  manualFillingInAgent,
  productCheckoutInAgent,
  startSaleInAgent,
  updateManualFillingInAgent,
} from "../../../../../store/creators/agentCreators";
import {
  startAgentCart,
  scanProductInCart,
  addProductToAgentCart,
  addCustomItemToAgentCart,
  checkoutAgentCart,
  getAgentCart,
  removeItemFromAgentCart,
  updateAgentCartItemQuantity,
} from "../../../../../store/creators/agentCartCreators";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../../../store/creators/clientCreators";
import {
  createDeal,
  getProductCheckout,
} from "../../../../../store/creators/saleThunk";
import { useAgent } from "../../../../../store/slices/agentSlice";
import { useAgentCart } from "../../../../../store/slices/agentCartSlice";
import {
  addCashFlows,
  getCashBoxes,
  useCash,
} from "../../../../../store/slices/cashSlice";
import { useClient } from "../../../../../store/slices/ClientSlice";
import { useUser } from "../../../../../store/slices/userSlice";
import UniversalModal from "../UniversalModal/UniversalModal";
import { DEAL_STATUS_RU } from "../../../../pages/Sell/Sell";
import AlertModal from "../../../../common/AlertModal/AlertModal";
import axios from "axios";
import api from "../../../../../api";

const cx = (...args) => args.filter(Boolean).join(" ");

const toNum = (v) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const SellStart = ({ show, setShow }) => {
  const { company } = useUser();
  const { list: cashBoxes } = useCash();
  const { start, products } = useAgent();
  const agentCart = useAgentCart();
  const { 0: agentListProducts, 1: setAgentListProducts } = useState([]);
  const { list: clients = [] } = useClient();

  // Определяем, какую корзину использовать
  const isPilorama = company.sector.name === "Пилорама";
  const [clientId, setClientId] = useState("");
  const [debtMonths, setDebtMonths] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    type: "client",
    llc: "",
    inn: "",
    okpo: "",
    score: "",
    bik: "",
    address: "",
  });
  const [submitTried, setSubmitTried] = useState(false);
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [debt, setDebt] = useState("");
  const [amount, setAmount] = useState("");
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [alert, setAlert] = useState({
    open: false,
    type: "success",
    message: "",
  });
  const [cashData, setCashData] = useState({
    cashbox: "",
    type: "income",
    name: "",
    amount: "",
    status: company?.subscription_plan?.name === "Старт" ? true : false,
  });
  const dispatch = useDispatch();
  const run = (thunk) => dispatch(thunk).unwrap();
  const [selectClient, setSelectClient] = useState("");
  const [selectCashBox, setSelectCashBox] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [tempSelectedAgent, setTempSelectedAgent] = useState("");
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [agents, setAgents] = useState([]);
  const [customItem, setCustomItem] = useState({
    name: "",
    price: "",
    quantity: "1",
  });

  const [selectedId, setSelectedId] = useState(null);
  const selectedItem = useMemo(() => {
    if (isPilorama) {
      return (agentCart.items || []).find((i) => i.id === selectedId) || null;
    } else {
      return (start?.items || []).find((i) => i.id === selectedId) || null;
    }
  }, [isPilorama, agentCart.items, start?.items, selectedId]);
  const filterClient = useMemo(
    () =>
      (Array.isArray(clients) ? clients : []).filter(
        (c) => c.type === "client"
      ),
    [clients]
  );
  const pickClient = useMemo(
    () => filterClient.find((x) => String(x.id) === String(clientId)),
    [filterClient, clientId]
  );

  const [qty, setQty] = useState("");

  useEffect(() => {
    if (selectedItem) {
      setQty(String(selectedItem.quantity ?? ""));
    } else {
      setQty("");
    }
  }, [selectedItem]);

  const debouncedDiscount = useDebounce((v) => {
    if (isPilorama && selectedItem) {
      dispatch(
        updateAgentCartItemQuantity({
          cartId: agentCart.currentCart?.id,
          itemId: selectedItem.id,
          discount_total: v,
        })
      );
    } else {
      dispatch(
        manualFillingInAgent({
          id: start.id,
          productId: selectedItem.id,
          discount_total: v,
          quantity: 2,
        })
      );
    }
  }, 600);

  const onProductDiscountChange = (e) => debouncedDiscount(e.target.value);

  const debouncedSearch = useDebounce((v) => {
    dispatch(doSearchInAgent({ search: v }));
  }, 600);

  const onChange = (e) => debouncedSearch(e.target.value);
  const onDiscountChange = (e) => debouncedDiscount1(e.target.value);
  const debouncedDiscount1 = useDebounce((v) => {
    dispatch(startSaleInAgent(v));
    dispatch(
      getAgentCart({
        order_discount_total: v,
      })
    );
  }, 600);

  const onRefresh = () => {
    if (isPilorama) {
      // Для пилорамы обновляем корзину агента
      if (selectedAgent) {
        dispatch(
          getAgentCart({
            agent: selectedAgent,
            order_discount_total: "0.00",
          })
        );
      }
    } else {
      dispatch(startSaleInAgent());
    }
  };

  const initializeAgentCart = async () => {
    if (!tempSelectedAgent) {
      setAlert({
        open: true,
        type: "error",
        message: "Выберите агента для начала работы",
      });
      return;
    }

    try {
      await dispatch(
        startAgentCart({
          agent: tempSelectedAgent,
          order_discount_total: "0.00",
        })
      ).unwrap();
      setSelectedAgent(tempSelectedAgent); // Устанавливаем выбранного агента только после успешного создания корзины
      setShowAgentModal(false);
    } catch (error) {
      setAlert({
        open: true,
        type: "error",
        message: "Ошибка при создании корзины агента",
      });
    }
  };

  const handleBarcodeScan = async () => {
    if (!barcodeInput.trim()) {
      setAlert({
        open: true,
        type: "error",
        message: "Введите штрих-код товара",
      });
      return;
    }

    if (!isPilorama || !agentCart.currentCart?.id) {
      setAlert({
        open: true,
        type: "error",
        message: "Корзина агента не инициализирована",
      });
      return;
    }

    try {
      await dispatch(
        scanProductInCart({
          cartId: agentCart.currentCart.id,
          barcode: barcodeInput.trim(),
          quantity: 1,
          agent: selectedAgent,
        })
      ).unwrap();
      setBarcodeInput("");
      onRefresh();
    } catch (error) {
      setAlert({
        open: true,
        type: "error",
        message: error?.data?.detail || "Ошибка при сканировании товара",
      });
    }
  };

  const handleAddCustomItem = async () => {
    if (!customItem.name.trim() || !customItem.price.trim()) {
      setAlert({
        open: true,
        type: "error",
        message: "Заполните все обязательные поля",
      });
      return;
    }

    if (!isPilorama || !agentCart.currentCart?.id) {
      setAlert({
        open: true,
        type: "error",
        message: "Корзина агента не инициализирована",
      });
      return;
    }

    try {
      await dispatch(
        addCustomItemToAgentCart({
          cartId: agentCart.currentCart.id,
          name: customItem.name.trim(),
          price: customItem.price.trim(),
          quantity: Number(customItem.quantity) || 1,
        })
      ).unwrap();

      setCustomItem({ name: "", price: "", quantity: "1" });
      setShowCustomItemModal(false);
      onRefresh();

      setAlert({
        open: true,
        type: "success",
        message: "Кастомная позиция добавлена в корзину",
      });
    } catch (error) {
      setAlert({
        open: true,
        type: "error",
        message:
          error?.data?.detail || "Ошибка при добавлении кастомной позиции",
      });
    }
  };

  useEffect(() => {
    dispatch(fetchClientsAsync());
    dispatch(getCashBoxes());
    if (isPilorama) {
      // Для пилорамы показываем модал выбора агента
      setShowAgentModal(true);
    } else {
      dispatch(doSearchInAgent());
    }
  }, [dispatch, isPilorama]);

  useEffect(() => {
    api
      .get("/main/owners/agents/products/")
      .then(({ data }) => setAgentListProducts(data))
      .catch((e) => console.log(e));
  }, [show]);

  // Получаем список агентов для пилорамы
  useEffect(() => {
    if (isPilorama) {
      api
        .get("/main/owners/agents/products/")
        .then(({ data }) => {
          setAgents(data);
        })
        .catch((e) => console.log(e));
    }
  }, [isPilorama]);

  const handleRowClick = (item) => {
    setSelectedId(item.id);
  };

  const incQty = () => {
    if (!selectedItem) return;
    const newQty = (toNum(qty) || 0) + 1;
    setQty(String(newQty));

    if (isPilorama) {
      // Для пилорамы обновляем количество существующего товара
      dispatch(
        updateAgentCartItemQuantity({
          cartId: agentCart.currentCart?.id,
          itemId: selectedItem.id,
          quantity: newQty,
        })
      );
    } else {
      dispatch(
        manualFillingInAgent({ id: start.id, productId: selectedItem.product })
      );
    }
    onRefresh();
  };

  const decQty = () => {
    if (!selectedItem) return;
    const next = Math.max(0, (toNum(qty) || 0) - 1);
    setQty(String(next));

    if (isPilorama) {
      // Для пилорамы используем новую логику
      if (next === 0) {
        // Если количество стало 0, удаляем позицию
        dispatch(
          removeItemFromAgentCart({
            cartId: agentCart.currentCart?.id,
            itemId: selectedItem.id,
          })
        );
      } else {
        // Обновляем количество
        dispatch(
          updateAgentCartItemQuantity({
            cartId: agentCart.currentCart?.id,
            itemId: selectedItem.id,
            quantity: next,
          })
        );
      }
    } else {
      dispatch(
        updateManualFillingInAgent({
          id: start.id,
          productId: selectedItem.id,
          quantity: next,
        })
      );
    }
    onRefresh();
  };

  const validate = (f) => {
    const e = {};
    if (!f.full_name.trim()) e.full_name = "Это поле не может быть пустым.";
    const ph = f.phone.trim();
    if (!ph) e.phone = "Это поле не может быть пустым.";
    else if (!/^\+?\d[\d\s\-()]{5,}$/.test(ph))
      e.phone = "Неверный формат телефона.";
    return e;
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    setForm(next);
    if (touched[name] || submitTried) {
      const ve = validate(next);
      setErrors(ve);
    }
  };
  const handleBlur = (e) => {
    const { name } = e.target;
    const nextTouched = { ...touched, [name]: true };
    setTouched(nextTouched);
    setErrors(validate(form));
  };

  const filterData = isPilorama ? agentListProducts?.products : products;
  const currentCart = isPilorama ? agentCart.currentCart : start;
  const currentItems = isPilorama ? agentCart.items : start?.items || [];
  const currentSubtotal = isPilorama ? agentCart.subtotal : start?.subtotal;
  const currentDiscount = isPilorama
    ? agentCart.order_discount_total
    : start?.order_discount_total;
  const currentTotal = isPilorama ? agentCart.total : start?.total;

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitTried(true);
    const ve = validate(form);
    setErrors(ve);
    if (Object.keys(ve).length) return;
    try {
      await dispatch(createClientAsync(form)).unwrap();
      setAlert({
        open: true,
        type: "success",
        message: "Клиент успешно удален!",
      });
      dispatch(fetchClientsAsync());
      setShowNewClientModal(false);
      setForm({
        full_name: "",
        phone: "",
        email: "",
        date: new Date().toISOString().split("T")[0],
        type: "client",
        llc: "",
        inn: "",
        okpo: "",
        score: "",
        bik: "",
        address: "",
      });
      setTouched({});
      setSubmitTried(false);
      setErrors({});
    } catch (e) {
      console.log(e);
    }
  };

  const performCheckout = async (withReceipt) => {
    try {
      // Валидация обязательных полей
      if (!cashData.cashbox) {
        setAlert({
          open: true,
          type: "error",
          message: "Выберите кассу для проведения операции",
        });
        return;
      }

      const itemsToCheck = isPilorama ? currentItems : start?.items;
      if (itemsToCheck?.length === 0) {
        setAlert({
          open: true,
          type: "error",
          message: "Добавьте товар для проведения операции",
        });
        return;
      }

      // Валидация для долговых операций
      if (debt && !clientId) {
        setAlert({
          open: true,
          type: "error",
          message: "Выберите клиента для долговой операции",
        });
        return;
      }

      // Валидация суммы предоплаты
      if (debt === "Предоплата") {
        if (!amount || Number(amount) <= 0) {
          setAlert({
            open: true,
            type: "error",
            message: "Введите корректную сумму предоплаты",
          });
          return;
        }
        const totalToCheck = isPilorama ? currentTotal : start?.total;
        if (Number(amount) > Number(totalToCheck)) {
          setAlert({
            open: true,
            type: "error",
            message: "Сумма предоплаты не может превышать общую сумму",
          });
          return;
        }
        if (!debtMonths || Number(debtMonths) <= 0) {
          setAlert({
            open: true,
            type: "error",
            message: "Введите корректный срок долга (в месяцах)",
          });
          return;
        }
      }

      // Валидация для обычных долгов
      if (debt === "Долги") {
        if (!debtMonths || Number(debtMonths) <= 0) {
          setAlert({
            open: true,
            type: "error",
            message: "Введите корректный срок долга (в месяцах)",
          });
          return;
        }
      }

      if (clientId) {
        const totalForDeal = isPilorama ? currentTotal : start?.total;
        await dispatch(
          createDeal({
            clientId: clientId,
            title: `${debt || "Продажа"} ${pickClient?.full_name}`,
            statusRu: debt,
            amount: totalForDeal,
            prepayment: debt === "Предоплата" ? Number(amount) : undefined,
            debtMonths:
              debt === "Долги" || debt === "Предоплата"
                ? Number(debtMonths)
                : undefined,
          })
        ).unwrap();
      }

      let result;
      if (isPilorama) {
        // Для пилорамы используем новую логику чекаута
        result = await run(
          checkoutAgentCart({
            cartId: agentCart.currentCart?.id,
            print_receipt: withReceipt,
            client_id: clientId,
            agent: selectedAgent,
          })
        );
      } else {
        result = await run(
          productCheckoutInAgent({
            id: start?.id,
            bool: withReceipt,
            clientId: clientId,
          })
        );
      }

      const amountForCash =
        debt === "Предоплата"
          ? amount
          : isPilorama
          ? currentTotal
          : start.total;

      if (debt !== "Долги") {
        await run(
          addCashFlows({
            ...cashData,
            name: cashData.name === "" ? "Продажа" : cashData.name,
            amount: amountForCash,
          })
        );
      }

      setShow(false);
      if (withReceipt && result?.sale_id) {
        const pdfBlob = await run(getProductCheckout(result.sale_id));
        const dl = (blob, name) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = name;
          a.click();
          URL.revokeObjectURL(url);
        };
        dl(pdfBlob, "receipt.pdf");
      }
      setAlert({
        open: true,
        type: "success",
        message: "Операция успешно выполнена!",
      });
    } catch (e) {
      // console.log(e.data.detail);

      setAlert({
        open: true,
        type: "error",
        message: `Что то пошло не так.\n\n
        ${e.data.detail
          .replace("у агента:", "товара")
          .replace("Нужно 2, доступно 0.", "")}`,
      });
    }
  };

  return (
    <section className="sell start">
      <div className="sell__header">
        <div className="sell__header-left">
          <div className="sell__header-input">
            <input
              onChange={onChange}
              type="text"
              placeholder="Введите название товара"
            />
            <span>
              <Search size={15} color="#91929E" />
            </span>
          </div>

          {/* {isPilorama && (
            <div className="sell__header-input">
              <input
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                type="text"
                placeholder="Введите штрих-код"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleBarcodeScan();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleBarcodeScan}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "5px",
                }}
                title="Сканировать товар"
              >
                <Search size={15} color="#91929E" />
              </button>
            </div>
          )} */}

          <select
            onChange={(e) => {
              setClientId(e.target.value);
              setSelectClient(e.target.value);
            }}
            value={clientId}
            className="sell__header-input"
          >
            <option value="">Выберите клиента</option>
            {filterClient.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name}
              </option>
            ))}
          </select>

          <button
            className="sell__header-plus"
            onClick={() => setShowNewClientModal(true)}
          >
            <span>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M19 11H13V5C13 4.73478 12.8946 4.48043 12.7071 4.29289C12.5196 4.10536 12.2652 4 12 4C11.7348 4 11.4804 4.10536 11.2929 4.29289C11.1054 4.48043 11 4.73478 11 5V11H5C4.73478 11 4.48043 11.1054 4.29289 11.2929C4.10536 11.4804 4 11.7348 4 12C4 12.2652 4.10536 12.5196 4.29289 12.7071C4.4804 12.8946 4.73478 13 5 13H11V19C11 19.2652 11.1054 19.5196 11.2929 19.7071C11.4804 19.8946 11.7348 20 12 20C12.2652 20 12.5196 19.8946 12.7071 19.7071C12.8946 19.5196 13 19.2652 13 19V13H19C19.2652 13 19.5196 12.8946 19.7071 12.7071C19.8946 12.5196 20 12.2652 20 12C20 11.7348 19.8946 11.4804 19.7071 11.2929C19.5196 11.1054 19.2652 11 19 11Z"
                  fill="#CCCCCC"
                />
              </svg>
            </span>
          </button>
          <select
            value={selectCashBox}
            onChange={(e) => {
              const v = e.target.value;
              setSelectCashBox(v);
              setCashData((prev) => ({ ...prev, cashbox: v }));
            }}
            className="sell__header-input"
          >
            <option value="">Выберите кассу</option>
            {cashBoxes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.department_name}
              </option>
            ))}
          </select>
        </div>

        <div className="sell__header-left">
          {isPilorama && selectedAgent && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "14px", color: "#666" }}>
                Выбранный агент:
              </span>
              <span style={{ fontWeight: "bold" }}>
                {
                  agents.find(
                    (agentData) => agentData.agent.id === selectedAgent
                  )?.agent.first_name
                }{" "}
                {
                  agents.find(
                    (agentData) => agentData.agent.id === selectedAgent
                  )?.agent.last_name
                }
              </span>
              <button
                type="button"
                onClick={() => setShowAgentModal(true)}
                style={{
                  background: "#007bff",
                  color: "white",
                  border: "none",
                  padding: "5px 10px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Сменить агента
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="start__body">
        <div className="col-8">
          <div className="start__body-column">
            <div className="sell__body-header">
              {/* {console.log(selectedItem)} */}
              <h2 className="start__body-title">
                {selectedItem?.product_name}
              </h2>

              <div className="start__actions">
                <div className="start__actions-left">
                  <input
                    type="text"
                    className="start__actions-input"
                    value={
                      selectedItem?.unit_price * selectedItem?.quantity || ""
                    }
                    readOnly
                  />

                  <div className="start__actions-row">
                    <button
                      className="start__actions-btn"
                      onClick={incQty}
                      disabled={!selectedItem}
                      title="Увеличить количество"
                    >
                      <Plus />
                    </button>

                    <input
                      style={{ width: 100 }}
                      type="number"
                      min={0}
                      className="start__actions-input"
                      value={qty}
                      placeholder="Кол-во"
                      onChange={(e) => {
                        const newQty = e.target.value;
                        setQty(newQty);

                        if (isPilorama && selectedItem && newQty !== "") {
                          const qtyNum = Number(newQty);
                          if (qtyNum === 0) {
                            dispatch(
                              removeItemFromAgentCart({
                                cartId: agentCart.currentCart?.id,
                                itemId: selectedItem.id,
                              })
                            );
                          } else {
                            dispatch(
                              updateAgentCartItemQuantity({
                                cartId: agentCart.currentCart?.id,
                                itemId: selectedItem.id,
                                quantity: qtyNum,
                              })
                            );
                          }
                          onRefresh();
                        }
                      }}
                      disabled={!selectedItem}
                    />

                    <button
                      className="start__actions-btn"
                      onClick={decQty}
                      disabled={!selectedItem}
                      title="Уменьшить количество"
                    >
                      <Minus />
                    </button>
                  </div>

                  <input
                    type="text"
                    className="start__actions-input"
                    placeholder="Скидка на позицию"
                    onChange={onProductDiscountChange}
                    disabled={!selectedItem}
                  />
                </div>

                <input
                  type="text"
                  className="start__actions-input"
                  placeholder="Общ скидка"
                  onChange={onDiscountChange}
                />
              </div>
            </div>
            <div className="start__body-wrapper">
              <div className="start__body-wrapper">
                <table className="start__body-table">
                  <tbody>
                    {currentItems.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={cx(selectedId === item.id && "active")}
                        onClick={() => handleRowClick(item)}
                        style={{ cursor: "pointer" }}
                        title="Выбрать позицию"
                      >
                        <td>{idx + 1}.</td>
                        <td>{item.product_name}</td>
                        <td>{item.unit_price}</td>
                        <td>{item.quantity} шт</td>
                        <td>
                          {Number(item.unit_price) * Number(item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="start__products">
            {/* {filterData} */}
            {/* {filterData?.map((product) => (
              <button
                key={product.product}
                className={cx(
                  "start__products-add",
                  selectedItem?.product === product.product && "active"
                )}
                onClick={async () => {
                  await dispatch(
                    manualFillingInAgent({
                      id: start.id,
                      productId: product.product,
                    })
                  ).unwrap();
                  dispatch(startSaleInAgent());
                }}
                title="Добавить 1 шт"
              >
                {product.product_name}
              </button>
            ))} */}
            {company.sector.name === "Пилорама"
              ? agents
                  .find((agentData) => agentData.agent.id === selectedAgent)
                  ?.products?.map((product) => (
                    <button
                      key={product.product}
                      className={cx(
                        "start__products-add",
                        selectedItem?.product === product.product && "active"
                      )}
                      onClick={async () => {
                        await dispatch(
                          addProductToAgentCart({
                            cartId: agentCart.currentCart?.id,
                            product_id: product.product,
                            quantity: 1,
                            agent: selectedAgent,
                          })
                        ).unwrap();
                        onRefresh();
                      }}
                      title="Добавить 1 шт"
                    >
                      {product.product_name} (остаток: {product.qty_on_hand})
                    </button>
                  ))
              : products?.map((product) => (
                  <button
                    key={product.product}
                    className={cx(
                      "start__products-add",
                      selectedItem?.product === product.product && "active"
                    )}
                    onClick={async () => {
                      if (isPilorama) {
                        await dispatch(
                          addProductToAgentCart({
                            cartId: agentCart.currentCart?.id,
                            product_id: product.product,
                            quantity: 1,
                            agent: selectedAgent,
                          })
                        ).unwrap();
                        onRefresh();
                      } else {
                        await dispatch(
                          manualFillingInAgent({
                            id: start.id,
                            productId: product.product,
                          })
                        ).unwrap();
                        dispatch(startSaleInAgent());
                      }
                    }}
                    title="Добавить 1 шт"
                  >
                    {product.product_name}
                  </button>
                ))}
          </div>
        </div>

        <div className="col-4">
          <div className="start__total">
            <div className="start__total-top">
              <div className="start__total-row">
                <b>Без скидок</b>
                <p>{currentSubtotal}</p>
              </div>
              <div className="start__total-row">
                <b>Скидка</b>
                <p>{currentDiscount}</p>
              </div>
              <div className="start__total-row">
                <b>ИТОГО</b>
                <h4>{currentTotal}</h4>
              </div>
            </div>

            <div className="start__total-bottom">
              <button
                className="start__total-debt"
                onClick={() => setShowDebtModal(true)}
              >
                Долг
              </button>

              {isPilorama && (
                <button
                  className="start__total-debt"
                  onClick={() => setShowCustomItemModal(true)}
                  style={{ marginLeft: "10px" }}
                >
                  Кастомная позиция
                </button>
              )}

              <div className="start__total-row1">
                <button
                  className="start__total-pay"
                  onClick={() => performCheckout(true)}
                  disabled={
                    isPilorama ? !agentCart.currentCart?.id : !start?.id
                  }
                >
                  Печать чека
                </button>
                <button
                  className="start__total-pay"
                  onClick={() => performCheckout(false)}
                  disabled={
                    isPilorama ? !agentCart.currentCart?.id : !start?.id
                  }
                >
                  Без чека
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showNewClientModal && (
        <UniversalModal
          onClose={() => setShowNewClientModal(false)}
          title={"Добавить клиента"}
        >
          <form className="start__clientForm" onSubmit={onSubmit}>
            <div>
              <label>ФИО</label>
              <input
                className={cx(
                  "sell__header-input",
                  (touched.full_name || submitTried) &&
                    errors.full_name &&
                    "error"
                )}
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.full_name}
                type="text"
                placeholder="ФИО"
                name="full_name"
              />
              {(touched.full_name || submitTried) && errors.full_name ? (
                <p className="sell__header-necessarily">{errors.full_name}</p>
              ) : (
                <p className="sell__header-necessarily">*</p>
              )}
            </div>
            <div>
              <label>ОсОО</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.llc}
                type="text"
                name="llc"
                placeholder="ОсОО"
              />
            </div>
            <div>
              <label>ИНН</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.inn}
                type="text"
                name="inn"
                placeholder="ИНН"
              />
            </div>
            <div>
              <label>ОКПО</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.okpo}
                type="text"
                name="okpo"
                placeholder="ОКПО"
              />
            </div>
            <div>
              <label>З/СЧЕТ</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.score}
                type="text"
                name="score"
                placeholder="Р/СЧЁТ"
              />
            </div>
            <div>
              <label>БИК</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.bik}
                type="text"
                name="bik"
                placeholder="БИК"
              />
            </div>
            <div>
              <label>Адрес</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.address}
                type="text"
                name="address"
                placeholder="Адрес"
              />
            </div>
            <div>
              <label>Телефон</label>
              <input
                className={cx(
                  "sell__header-input",
                  (touched.phone || submitTried) && errors.phone && "error"
                )}
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.phone}
                type="text"
                name="phone"
                placeholder="Телефон"
              />
              {(touched.phone || submitTried) && errors.phone ? (
                <p className="sell__header-necessarily">{errors.phone}</p>
              ) : (
                <p className="sell__header-necessarily">*</p>
              )}
            </div>
            <div>
              <label>Email</label>
              <input
                className="sell__header-input"
                onChange={handleChange}
                onBlur={handleBlur}
                value={form.email}
                type="email"
                name="email"
                placeholder="Почта"
              />
            </div>
            <div
              style={{
                display: "flex",
                columnGap: "10px",
                justifyContent: "end",
              }}
            >
              <button
                className="sell__reset"
                type="button"
                onClick={() => setShowNewClientModal(false)}
              >
                Отмена
              </button>
              <button className="start__total-pay" style={{ width: "auto" }}>
                Создать
              </button>
            </div>
          </form>
        </UniversalModal>
      )}
      {showDebtModal && (
        <UniversalModal onClose={() => setShowDebtModal(false)} title={"Долг"}>
          <div className="start__debt">
            <p className="start__debt-amount">
              Cумма долга: <b>{currentTotal}</b>
            </p>
            {clientId === "" && (
              <>
                <p
                  style={{ margin: "5px 0" }}
                  className="sell__header-necessarily"
                >
                  Выберите клиента!
                </p>
                <select
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setSelectClient(e.target.value);
                  }}
                  value={clientId}
                  className="sell__header-input"
                >
                  <option value="">Выберите клиента</option>
                  {filterClient.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label>Тип оплаты</label>
            <select
              value={debt}
              onChange={(e) => setDebt(e.target.value)}
              className="sell__header-input"
              name=""
            >
              <option value="">Тип оплаты</option>
              <option value="Предоплата">Предоплата</option>
              <option value="Долги">Долг</option>
            </select>
            {debt === "Предоплата" && (
              <>
                <label htmlFor="">Сумма предоплаты</label>
                <input
                  type="text"
                  className="sell__header-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <label htmlFor="">Срок долга (мес.) </label>
                <input
                  type="text"
                  className="sell__header-input"
                  value={debtMonths}
                  onChange={(e) => setDebtMonths(e.target.value)}
                />
              </>
            )}
            {debt === "Долги" && (
              <>
                <label htmlFor="">Срок долга (мес.) </label>
                <input
                  type="text"
                  className="sell__header-input"
                  value={debtMonths}
                  onChange={(e) => setDebtMonths(e.target.value)}
                />
              </>
            )}
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                columnGap: "10px",
                justifyContent: "end",
              }}
            >
              <button
                className="sell__reset"
                type="button"
                onClick={() => setShowDebtModal(false)}
              >
                Отмена
              </button>
              <button
                className="start__total-pay"
                style={{ width: "auto" }}
                type="button"
                onClick={() => setShowDebtModal(false)}
              >
                Сохранить
              </button>
            </div>
          </div>
        </UniversalModal>
      )}

      {showAgentModal && (
        <UniversalModal
          onClose={() => {
            setShowAgentModal(false);
            tempSelectedAgent === "" && setShow(false);
            setTempSelectedAgent("");
          }}
          title={"Выберите агента"}
        >
          <div className="start__agent">
            <p className="start__agent-text">
              Для работы с пилорамой необходимо выбрать агента
            </p>
            <select
              value={tempSelectedAgent}
              onChange={(e) => setTempSelectedAgent(e.target.value)}
              className="sell__header-input"
            >
              <option value="">Выберите агента</option>
              {agents.map((agentData) => (
                <option key={agentData.agent.id} value={agentData.agent.id}>
                  {agentData.agent.first_name} {agentData.agent.last_name} (
                  {agentData.agent.track_number})
                </option>
              ))}
            </select>
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                columnGap: "10px",
                justifyContent: "end",
              }}
            >
              <button
                className="sell__reset"
                type="button"
                onClick={() => {
                  setShowAgentModal(false);
                  tempSelectedAgent === "" && setShow(false);
                  setTempSelectedAgent("");
                }}
              >
                Отмена
              </button>
              <button
                className="start__total-pay"
                style={{ width: "auto" }}
                type="button"
                onClick={initializeAgentCart}
                disabled={!tempSelectedAgent}
              >
                Начать работу
              </button>
            </div>
          </div>
        </UniversalModal>
      )}

      {showCustomItemModal && (
        <UniversalModal
          onClose={() => setShowCustomItemModal(false)}
          title={"Добавить кастомную позицию"}
        >
          <div className="start__custom-item">
            <div>
              <label>Название позиции</label>
              <input
                className="sell__header-input"
                value={customItem.name}
                onChange={(e) =>
                  setCustomItem((prev) => ({ ...prev, name: e.target.value }))
                }
                type="text"
                placeholder="Например: Услуга распила"
              />
            </div>
            <div>
              <label>Цена</label>
              <input
                className="sell__header-input"
                value={customItem.price}
                onChange={(e) =>
                  setCustomItem((prev) => ({ ...prev, price: e.target.value }))
                }
                type="number"
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div>
              <label>Количество</label>
              <input
                className="sell__header-input"
                value={customItem.quantity}
                onChange={(e) =>
                  setCustomItem((prev) => ({
                    ...prev,
                    quantity: e.target.value,
                  }))
                }
                type="number"
                placeholder="1"
                min="1"
              />
            </div>
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                columnGap: "10px",
                justifyContent: "end",
              }}
            >
              <button
                className="sell__reset"
                type="button"
                onClick={() => setShowCustomItemModal(false)}
              >
                Отмена
              </button>
              <button
                className="start__total-pay"
                style={{ width: "auto" }}
                type="button"
                onClick={handleAddCustomItem}
              >
                Добавить
              </button>
            </div>
          </div>
        </UniversalModal>
      )}

      <AlertModal
        open={alert.open}
        type={alert.type}
        message={alert.message}
        okText="Ok"
        onClose={() => setAlert((a) => ({ ...a, open: false }))}
      />
    </section>
  );
};

export default SellStart;
