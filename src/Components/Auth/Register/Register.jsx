import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  registerUserAsync,
  getIndustriesAsync,
  getSubscriptionPlansAsync,
} from "../../../store/creators/userCreators";
import { useNavigate } from "react-router-dom";
import "./Register.scss";

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    loading,
    error,
    currentUser,
    isAuthenticated,
    industries,
    subscriptionPlans,
  } = useSelector((state) => state.user);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    password2: "",
    first_name: "",
    last_name: "",
    avatar: "",
    company_sector_id: "",
    subscription_plan_id: "",
    company_name: "",
  });

  useEffect(() => {
    dispatch(getIndustriesAsync());
    dispatch(getSubscriptionPlansAsync());
  }, [dispatch]);

  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [id]: value,
    }));
  };

  const handleIndustryChange = (e) => {
    const industryId = e.target.value;

    // проверяем, что industries есть и массив не пустой
    if (!industries || industries.length === 0) return;

    const selected = industries.find((industry) => industry.id === industryId);

    if (!selected || !selected.sectors || selected.sectors.length === 0) return;

    const firstSectorId = selected.sectors[0].id;

    setFormData((prevData) => ({
      ...prevData,
      company_sector_id: firstSectorId,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.password2) {
      alert("Пароли не совпадают!");
      return;
    }

    dispatch(registerUserAsync({ formData, navigate }));
  };

  return (
    <div className="register">
      <div className="register__container">
        <h2 className="register__title">Регистрация в NurCRM</h2>
        <form className="register__form" onSubmit={handleSubmit}>
          {isAuthenticated && currentUser && (
            <p className="register__message register__message--success">
              Пользователь <b>{currentUser.email}</b> успешно зарегистрирован!
            </p>
          )}
          {error && (
            <p className="register__message register__message--error">
              Ошибка регистрации: {JSON.stringify(error.detail)}
            </p>
          )}

          <div className="register__field">
            <label className="register__label" htmlFor="email">
              Email
            </label>
            <input
              className="register__input"
              type="email"
              id="email"
              name="email"
              placeholder="Введите email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="register__field">
            <label className="register__label" htmlFor="first_name">
              Имя
            </label>
            <input
              className="register__input"
              type="text"
              id="first_name"
              name="first_name"
              placeholder="Введите имя"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="register__field">
            <label className="register__label" htmlFor="last_name">
              Фамилия
            </label>
            <input
              className="register__input"
              type="text"
              id="last_name"
              name="last_name"
              placeholder="Введите фамилию"
              value={formData.last_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="register__field">
            <label className="register__label" htmlFor="company_name">
              Название компании
            </label>
            <input
              className="register__input"
              type="text"
              id="company_name"
              name="company_name"
              placeholder="Название компании"
              value={formData.company_name}
              onChange={handleChange}
              required
            />
          </div>

          {/* выбор сферы (industry), но отправляем sector */}
          <div className="register__field">
            <label className="register__label" htmlFor="industry_id">
              Выберите сферу деятельности компании
            </label>
            <select
              name="industry_id"
              id="industry_id"
              onChange={handleIndustryChange}
              defaultValue=""
            >
              <option value="" disabled>
                Выберите сферу деятельности
              </option>
              {industries.length
                ? industries.map((industry) => (
                    <option key={industry.id} value={industry.id}>
                      {industry.name}
                    </option>
                  ))
                : null}
            </select>
          </div>

          <div className="register__field">
            <label className="register__label" htmlFor="subscription_plan_id">
              Выберите тарифный план
            </label>
            <select
              name="subscription_plan_id"
              value={formData.subscription_plan_id}
              id="subscription_plan_id"
              onChange={handleSelectChange}
            >
              <option value="" disabled>
                Выберите тарифный план
              </option>
              {subscriptionPlans.length
                ? subscriptionPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))
                : null}
            </select>
          </div>

          <div className="register__field">
            <label className="register__label" htmlFor="password">
              Пароль
            </label>
            <input
              className="register__input"
              type="password"
              id="password"
              name="password"
              placeholder="Введите пароль"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="8"
            />
          </div>

          <div className="register__field">
            <label className="register__label" htmlFor="password2">
              Повторите пароль
            </label>
            <input
              className="register__input"
              type="password"
              id="password2"
              name="password2"
              placeholder="Повторите пароль"
              value={formData.password2}
              onChange={handleChange}
              required
              minLength="1"
            />
          </div>

          <button className="register__button" type="submit" disabled={loading}>
            {loading ? "Регистрация..." : "Зарегистрироваться"}
          </button>
        </form>
        <a href="/login" className="register__link">
          Уже есть аккаунт? Войдите
        </a>
      </div>
    </div>
  );
};

export default Register;

// import React, { useState, useEffect } from "react";
// import { useDispatch, useSelector } from "react-redux";
// import {
//   registerUserAsync,
//   getIndustriesAsync,
//   getSubscriptionPlansAsync,
// } from "../../../store/creators/userCreators";
// import { useNavigate } from "react-router-dom";
// import "./Register.scss";
// import { id } from "date-fns/locale";

// const Register = () => {
//   const dispatch = useDispatch();
//   const navigate = useNavigate();
//   const {
//     loading,
//     error,
//     currentUser,
//     isAuthenticated,
//     industries,
//     subscriptionPlans,
//   } = useSelector((state) => state.user);

//   const [hoveredIndustryId, setHoveredIndustryId] = useState(null);
//   const [selectedSector, setSelectedSector] = useState(null);

//   const handleSectorClick = (industryId, sectorId) => {
//     setSelectedSector(sectorId);
//     handleSelectChange({
//       target: {
//         name: "company_sector_id",
//         value: sectorId,
//       },
//     });
//   };

//   useEffect(() => {
//     dispatch(getIndustriesAsync());
//     dispatch(getSubscriptionPlansAsync());
//   }, [dispatch]);

//   const [formData, setFormData] = useState({
//     email: "",
//     password: "",
//     password2: "",
//     first_name: "",
//     last_name: "",
//     // role: '',
//     avatar: "",
//     company_sector_id: "",
//     subscription_plan_id: "",
//     company_name: "",
//   });

//   // console.log("formData", formData);

//   const handleSelectChange = (e) => {
//     const { name, value } = e.target;
//     setFormData((prevData) => ({
//       ...prevData,
//       [name]: value,
//     }));
//   };
//   const firstSectorId = selectedIndustry?.sectors?.[0]?.id || "";

//   const handleChange = (e) => {
//     const { id, value } = e.target;
//     console.log("id", id, "val", value);

//     setFormData((prevData) => ({
//       ...prevData,
//       [id]: value,
//     }));

//     console.log(formData);
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();

//     if (formData.password !== formData.password2) {
//       alert("Пароли не совпадают!");
//       return;
//     }

//     dispatch(registerUserAsync({ formData, navigate }));
//   };
//   console.log(industries);

//   return (
//     <div className="register">
//       <div className="register__container">
//         <h2 className="register__title">Регистрация в NurCRM</h2>
//         <form className="register__form" onSubmit={handleSubmit}>
//           {isAuthenticated && currentUser && (
//             <p className="register__message register__message--success">
//               Пользователь **{currentUser.email}** успешно зарегистрирован!
//             </p>
//           )}
//           {error && (
//             <p className="register__message register__message--error">
//               Ошибка регистрации: {JSON.stringify(error.detail)}
//             </p>
//           )}

//           <div className="register__field">
//             <label className="register__label" htmlFor="email">
//               Email
//             </label>
//             <input
//               className="register__input"
//               type="email"
//               id="email"
//               name="email"
//               placeholder="Введите email"
//               value={formData.email}
//               onChange={handleChange}
//               required
//             />
//           </div>
//           <div className="register__field">
//             <label className="register__label" htmlFor="first_name">
//               Имя
//             </label>
//             <input
//               className="register__input"
//               type="text"
//               id="first_name"
//               name="first_name"
//               placeholder="Введите имя"
//               value={formData.first_name}
//               onChange={handleChange}
//               required
//             />
//           </div>
//           <div className="register__field">
//             <label className="register__label" htmlFor="last_name">
//               Фамилия
//             </label>
//             <input
//               className="register__input"
//               type="text"
//               id="last_name"
//               name="last_name"
//               placeholder="Введите фамилию"
//               value={formData.last_name}
//               onChange={handleChange}
//               required
//             />
//           </div>
//           <div className="register__field">
//             <label className="register__label" htmlFor="last_name">
//               Название компаний
//             </label>
//             <input
//               className="register__input"
//               type="text"
//               id="company_name"
//               name="company_name"
//               placeholder="Название компании"
//               value={formData.company_name}
//               onChange={handleChange}
//               required
//             />
//           </div>

//           <div className="register__field">
//             <label className="register__label" htmlFor="company_sector_id">
//               Выберите сферу деятельности компании
//             </label>
//             <select
//               name="company_sector_id"
//               value={formData.company_sector_id}
//               id="company_sector_id"
//               onChange={(e) => {
//                 const industryId = e.target.value;
//                 const selectedIndustry = industries.find(
//                   (industry) => industry.id === industryId
//                 );

//                 const firstSectorId = selectedIndustry?.sectors?.[0]?.id || "";

//                 setFormData((prevData) => ({
//                   ...prevData,
//                   company_sector_id: firstSectorId,
//                 }));
//               }}
//             >
//               <option value="" disabled>
//                 Выберите сферу деятельности
//               </option>
//               {industries.length
//                 ? industries.map((industry) => (
//                     <option key={industry.id} value={industry.id}>
//                       {industry.name}
//                     </option>
//                   ))
//                 : null}
//             </select>
//           </div>

//           <div className="register__field">
//             <label className="register__label" htmlFor="last_name">
//               Выберите тарифный план
//             </label>
//             <select
//               name="subscription_plan_id"
//               value={formData.subscription_plan_id}
//               id="subscription_plan_id"
//               onChange={handleSelectChange}
//             >
//               <option value="" disabled>
//                 Выберите тарифный план
//               </option>
//               {subscriptionPlans.length
//                 ? subscriptionPlans.map((plan) => (
//                     <option
//                       key={plan.id}
//                       id={"subscription_plan_id"}
//                       value={plan.id}
//                     >
//                       {plan.name}
//                     </option>
//                   ))
//                 : null}
//             </select>
//           </div>

//           {/* <div className="register__field">
//             <label className="register__label" htmlFor="company_industry">Отрасль компании</label>
//             <input
//               className="register__input"
//               type="text"
//               id="company_industry"
//               name="company_industry"
//               placeholder="Введите отрасль компании"
//               value={formData.company_industry}
//               onChange={handleChange}
//               required
//             />
//           </div> */}
//           <div className="register__field">
//             <label className="register__label" htmlFor="password">
//               Пароль
//             </label>
//             <input
//               className="register__input"
//               type="password"
//               id="password"
//               name="password"
//               placeholder="Введите пароль"
//               value={formData.password}
//               onChange={handleChange}
//               required
//               minLength="8"
//             />
//           </div>
//           <div className="register__field">
//             <label className="register__label" htmlFor="password2">
//               Повторите пароль
//             </label>
//             <input
//               className="register__input"
//               type="password"
//               id="password2"
//               name="password2"
//               placeholder="Повторите пароль"
//               value={formData.password2}
//               onChange={handleChange}
//               required
//               minLength="1"
//             />
//           </div>
//           {/* <div className="register__field">
//             <label className="register__label" htmlFor="role">Роль</label>
//             <select
//               className="register__input"
//               id="role"
//               name="role"
//               value={formData.role}
//               onChange={handleChange}
//               required
//             >
//               <option value="" disabled>Выберите роль</option>
//               <option value="admin">Админ</option>
//               <option value="manager">Менеджер</option>
//               <option value="user">Пользователь</option>
//             </select>
//           </div> */}

//           {/* <div className="register__field">
//             <label className="register__label" htmlFor="avatar">Аватар (URL)</label>
//             <input
//               className="register__input"
//               type="url"
//               id="avatar"
//               name="avatar"
//               placeholder="Введите URL аватара"
//               value={formData.avatar}
//               onChange={handleChange}
//               maxLength="200"
//             />
//           </div> */}

//           <button className="register__button" type="submit" disabled={loading}>
//             {loading ? "Регистрация..." : "Зарегистрироваться"}
//           </button>
//         </form>
//         <a href="/login" className="register__link">
//           Уже есть аккаунт? Войдите
//         </a>
//       </div>
//     </div>
//   );
// };

// export default Register;
