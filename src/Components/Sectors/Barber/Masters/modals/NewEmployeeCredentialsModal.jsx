import { FaCheck, FaCopy, FaTimes } from "react-icons/fa";

const NewEmployeeCredentialsModal = ({
  openLogin,
  setOpenLogin,
  employData,
  copied,
  copyToClipboard,
}) => {
  if (!openLogin) return null;

  return (
    <div className="barbermasters__overlay" onClick={() => setOpenLogin(false)}>
      <div className="barbermasters__modal" onClick={(e) => e.stopPropagation()}>
        <div className="barbermasters__modalHeader">
          <h3 className="barbermasters__modalTitle">Логин сотрудника</h3>
          <button
            className="barbermasters__iconBtn"
            onClick={() => setOpenLogin(false)}
            aria-label="Закрыть"
          >
            <FaTimes />
          </button>
        </div>
        <div className="barbermasters__content">
          <p className="barbermasters__label flex justify-between">
            <b>Логин: {employData?.email}</b>
            <button
              className="barbermasters__iconBtn barbermasters__copyBtn"
              onClick={() => copyToClipboard(employData?.email || "", "email")}
              aria-label="Скопировать логин"
              title={copied === "email" ? "Скопировано!" : "Скопировать"}
            >
              {copied === "email" ? <FaCheck /> : <FaCopy />}
            </button>
          </p>

          <p className="barbermasters__label flex justify-between">
            <b>Пароль: {employData?.generated_password}</b>
            <button
              className="barbermasters__iconBtn barbermasters__copyBtn"
              onClick={() =>
                copyToClipboard(employData?.generated_password || "", "password")
              }
              aria-label="Скопировать пароль"
              title={copied === "password" ? "Скопировано!" : "Скопировать"}
            >
              {copied === "password" ? <FaCheck /> : <FaCopy />}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default NewEmployeeCredentialsModal;
