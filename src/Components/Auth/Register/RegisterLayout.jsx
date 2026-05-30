const RegisterLayout = ({ title, subtitle, children, footer }) => (
  <div className="register">
    <div className="register__card" role="dialog" aria-labelledby="registerTitle">
      <h2 id="registerTitle" className="register__title">
        {title}
      </h2>
      {subtitle && <p className="register__subtitle">{subtitle}</p>}
      {children}
      {footer}
    </div>
  </div>
);

export default RegisterLayout;
