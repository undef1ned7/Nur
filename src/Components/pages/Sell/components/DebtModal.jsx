import UniversalModal from "../../../Sectors/Production/ProductionAgents/UniversalModal/UniversalModal";

const DebtModal = ({
  show,
  onClose,
  currentTotal,
  clientId,
  setClientId,
  setSelectClient,
  filterClient,
  company,
  state,
  onChange2,
  debt,
  setDebt,
  amount,
  setAmount,
  debtMonths,
  setDebtMonths,
  onSave,
}) => {
  if (!show) return null;

  return (
    <UniversalModal onClose={onClose} title={"Долг"}>
      <div className="start__debt">
        <p className="start__debt-amount">
          Cумма долга: <b>{currentTotal}</b>
        </p>
        {clientId === "" && (
          <>
            <p style={{ margin: "5px 0" }} className="sell__header-necessarily">
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
        {company?.subscription_plan?.name === "Старт" && (
          <>
            <label>Телефон</label>
            <input
              type="text"
              className="sell__header-input"
              onChange={onChange2}
              name="phone"
              value={state.phone}
            />
            <label>Дата оплаты</label>
            <input
              type="date"
              className="sell__header-input"
              onChange={onChange2}
              name="dueDate"
            />
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
            <label htmlFor="">Срок долга</label>
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
            <label htmlFor="">Срок долга</label>
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
          <button className="sell__reset" type="button" onClick={onClose}>
            Отмена
          </button>
          <button
            className="start__total-pay"
            style={{ width: "auto" }}
            type="button"
            onClick={onSave}
          >
            Сохранить
          </button>
        </div>
      </div>
    </UniversalModal>
  );
};

export default DebtModal;
