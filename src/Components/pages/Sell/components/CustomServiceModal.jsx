import UniversalModal from "../../../Sectors/Production/ProductionAgents/UniversalModal/UniversalModal";

const CustomServiceModal = ({
  show,
  onClose,
  customService,
  setCustomService,
  onAdd,
}) => {
  if (!show) return null;

  return (
    <UniversalModal
      onClose={() => {
        onClose();
        setCustomService({ name: "", price: "", quantity: "1" });
      }}
      title={"Дополнительная услуга"}
    >
      <div className="start__custom-service">
        <div>
          <label>Название</label>
          <input
            className="sell__header-input"
            value={customService.name}
            onChange={(e) =>
              setCustomService((prev) => ({
                ...prev,
                name: e.target.value,
              }))
            }
            type="text"
            placeholder="Введите название услуги"
          />
        </div>
        <div>
          <label>Сумма</label>
          <input
            className="sell__header-input"
            value={customService.price}
            onChange={(e) =>
              setCustomService((prev) => ({
                ...prev,
                price: e.target.value,
              }))
            }
            type="text"
            placeholder="Введите цену услуги"
          />
        </div>
        <div>
          <label>Количество</label>
          <input
            className="sell__header-input"
            value={customService.quantity}
            onChange={(e) =>
              setCustomService((prev) => ({
                ...prev,
                quantity: e.target.value,
              }))
            }
            type="number"
            onWheel={(e) => e.target.blur()}
            min="0"
            placeholder="Введите количество товара"
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
            onClick={() => {
              onClose();
              setCustomService({ name: "", price: "", quantity: "1" });
            }}
          >
            Отменить
          </button>
          <button
            className="start__total-pay"
            style={{ width: "auto" }}
            type="button"
            onClick={onAdd}
          >
            Добавить
          </button>
        </div>
      </div>
    </UniversalModal>
  );
};

export default CustomServiceModal;
