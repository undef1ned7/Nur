import React, { useState } from 'react';
import axios from 'axios';
import styles from './Login.module.scss';
import { FaLock } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const API = 'https://app.nurcrm.kg/api/users/auth/login/';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const { data } = await axios.post(API, { email, password });
      const token = data.access;
      if (!token) throw new Error('Токен не получен');
      localStorage.setItem('token', token);
      localStorage.setItem('userName', `${data.first_name} ${data.last_name}`);
      localStorage.setItem('company', data.company);
      navigate('/dashboard/recorda', { replace: true });
    } catch (e2) {
      console.error('Login error:', e2?.response?.data || e2.message);
      setErr(e2.response?.data?.detail || 'Неверные данные или сервер недоступен');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles['login']}>
      <form className={styles['login__card']} onSubmit={onSubmit}>
        <div className={styles['login__icon']}><FaLock /></div>
        <h1 className={styles['login__title']}>Вход в NurCRM</h1>

        {err && <div className={styles['login__error']}>{err}</div>}

        <label className={styles['login__label']}>Email</label>
        <input
          className={styles['login__input']}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />

        <label className={styles['login__label']}>Пароль</label>
        <div className={styles['login__pwdWrap']}>
          <input
            className={styles['login__input']}
            type={showPwd ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="button" className={styles['login__toggle']} onClick={() => setShowPwd(s => !s)}>
            {showPwd ? 'Скрыть' : 'Показать'}
          </button>
        </div>

        <button className={styles['login__btn']} type="submit" disabled={loading}>
          {loading ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </div>
  );
};

export default Login;