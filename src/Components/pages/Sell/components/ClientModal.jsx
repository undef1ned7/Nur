import { useDispatch } from "react-redux";
import {
  createClientAsync,
  fetchClientsAsync,
} from "../../../../store/creators/clientCreators";
import UniversalModal from "../../../Sectors/Production/ProductionAgents/UniversalModal/UniversalModal";
import { validateClientForm } from "../services/validation";

const cx = (...args) => args.filter(Boolean).join(" ");

const ClientModal = ({
  show,
  onClose,
  form,
  setForm,
  touched,
  setTouched,
  errors,
  setErrors,
  submitTried,
  setSubmitTried,
  setAlert,
}) => {
  const dispatch = useDispatch();

  const handleChange = (e) => {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    setForm(next);
    if (touched[name] || submitTried) {
      const ve = validateClientForm(next);
      setErrors(ve);
    }
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    const nextTouched = { ...touched, [name]: true };
    setTouched(nextTouched);
    setErrors(validateClientForm(form));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitTried(true);
    const ve = validateClientForm(form);
    setErrors(ve);
    if (Object.keys(ve).length) return;

    try {
      await dispatch(createClientAsync(form)).unwrap();
      setAlert({
        open: true,
        type: "success",
        message: "Клиент успешно создан!",
      });
      dispatch(fetchClientsAsync());
      onClose();
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

  if (!show) return null;

  return (
    <UniversalModal onClose={onClose} title={"Добавить клиента"}>
      <form className="start__clientForm" onSubmit={handleSubmit}>
        <div>
          <label>ФИО</label>
          <input
            className={cx(
              "sell__header-input",
              (touched.full_name || submitTried) && errors.full_name && "error"
            )}
            onChange={handleChange}
            onBlur={handleBlur}
            value={form.full_name}
            type="text"
            placeholder="ФИО"
            name="full_name"
          />
          {(touched.full_name || submitTried) && errors.full_name && (
            <p className="sell__header-necessarily">{errors.full_name}</p>
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
          {(touched.phone || submitTried) && errors.phone && (
            <p className="sell__header-necessarily">{errors.phone}</p>
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
          <button className="sell__reset" type="button" onClick={onClose}>
            Отмена
          </button>
          <button className="start__total-pay" style={{ width: "auto" }}>
            Создать
          </button>
        </div>
      </form>
    </UniversalModal>
  );
};

export default ClientModal;
