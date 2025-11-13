import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import {
  getApplicationList,
  updateApplication,
} from "../../../store/creators/userCreators";
import { useUser } from "../../../store/slices/userSlice";
import "./application.scss";

const ApplicationList = () => {
  const [state, setState] = useState({
    status: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all"); // фильтр по статусу

  const { applicationList } = useUser();
  const dispatch = useDispatch();

  const onChange = (e) => {
    const { name, value } = e.target;
    setState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const onSubmit = async (id) => {
    try {
      await dispatch(
        updateApplication({
          id,
          updatedData: state,
        })
      ).unwrap();
      dispatch(getApplicationList());
    } catch {
      alert("Ошибка обновления клиента");
    }
  };

  useEffect(() => {
    dispatch(getApplicationList());
  }, [dispatch]);

  const kindTranslate = {
    new: "Новая",
    processing: "В обработке",
    refusal: "Отказ",
    thinks: "На раздумье",
    connected: "Подключено",
  };

  // фильтрация
  const filteredApplications =
    filterStatus === "all"
      ? applicationList
      : applicationList.filter((app) => app.status === filterStatus);

  return (
    <div className="application">
      <div className="container">
        <h2>Заявки:</h2>

        {/* Фильтр по статусу */}
        <div className="filter">
          <label>
            Фильтр по статусу:{" "}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Все</option>
              {Object.entries(kindTranslate).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          {filteredApplications.map((application) => (
            <div className="application-item" key={application.id}>
              <div>
                <p>
                  <b>ФИО:</b> {application.full_name}
                </p>
                <p>
                  <b>Телефон:</b> {application.phone}
                </p>
              </div>
              <p>
                <b>Обращение:</b> {application.text}
              </p>
              <div>
                <div className="status-select">
                  <b>Статус:</b>
                  {isEditing ? (
                    <select name="status" onChange={onChange}>
                      {Object.entries(kindTranslate).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="clientDetail__data-value">
                      {kindTranslate[application.status] || application.status}
                    </p>
                  )}
                </div>
                <p>
                  <b>Дата:</b> {application.date}
                </p>
              </div>
              <button
                className="application__button"
                onClick={() => {
                  setIsEditing((prev) => !prev);
                  if (isEditing) {
                    onSubmit(application.id);
                  } else {
                    setState({
                      full_name: application?.full_name || "",
                      phone: application?.phone || "",
                      status: application?.status || "",
                    });
                  }
                }}
              >
                {isEditing ? "Сохранить" : "Редактировать"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ApplicationList;
