// src/components/Categories/Categories.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import styles from "./Categories.module.scss";
import api from "../../../../api"; // axios instance

function toResults(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function MarketCategories() {
  const { categories, setCategories, brands, setBrands } = useOutletContext();

  const [tab, setTab] = useState("categories"); // "categories" | "brands"
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [search, setSearch] = useState("");

  // modal
  const [editingId, setEditingId] = useState(null); // null | "new" | id
  const [name, setName] = useState("");

  const isCats = tab === "categories";
  const data = isCats ? categories : brands;
  const setData = isCats ? setCategories : setBrands;
  const endpoint = isCats ? "/main/categories/" : "/main/brands/";

  const fetchAll = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const [catRes, brandRes] = await Promise.all([
        api.get("/main/categories/"),
        api.get("/main/brands/"),
      ]);
      setCategories(toResults(catRes.data));
      setBrands(toResults(brandRes.data));
    } catch (e) {
      setErr("Не удалось загрузить категории/бренды");
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [setBrands, setCategories]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((x) => (x.name || "").toLowerCase().includes(q));
  }, [data, search]);

  const openNew = () => {
    setEditingId("new");
    setName("");
  };

  const openEdit = (id) => {
    const row = data.find((x) => x.id === id);
    setEditingId(id);
    setName(row?.name || "");
  };

  const closeModal = () => {
    setEditingId(null);
    setName("");
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setErr("");
    try {
      if (editingId === "new") {
        const { data: created } = await api.post(endpoint, { name: trimmed });
        setData((prev = []) => [...prev, created]);
      } else {
        const { data: updated } = await api.patch(`${endpoint}${editingId}/`, {
          name: trimmed,
        });
        setData((prev = []) =>
          prev.map((x) => (x.id === editingId ? updated : x))
        );
      }
      closeModal();
    } catch (e) {
      setErr("Сохранение не удалось");
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  const remove = async () => {
    if (editingId === "new") return closeModal();
    if (!window.confirm("Удалить этот элемент?")) return;

    setErr("");
    try {
      await api.delete(`${endpoint}${editingId}/`);
      setData((prev = []) => prev.filter((x) => x.id !== editingId));
      closeModal();
    } catch (e) {
      setErr("Удаление не удалось");
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  return (
    <section className={styles["cats"]}>
      {/* header */}
      <header className={styles["cats__header"]}>
        <div className={styles["cats__tabs"]}>
          <button
            className={`${styles["cats__tab"]} ${
              !isCats ? styles["cats__tab--active"] : ""
            }`}
            onClick={() => setTab("brands")}
          >
            Бренды
          </button>
          <button
            className={`${styles["cats__tab"]} ${
              isCats ? styles["cats__tab--active"] : ""
            }`}
            onClick={() => setTab("categories")}
          >
            Категории
          </button>
        </div>

        <div className={styles["cats__controls"]}>
          <button className={styles["cats__add"]} onClick={openNew}>
            + Добавить
          </button>
          <input
            className={styles["cats__search"]}
            placeholder="Поиск"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      {err && <div className={styles["cats__error"]}>{err}</div>}

      {/* table */}
      <div className={styles["cats__tableWrap"]}>
        <table className={styles["cats__table"]}>
          <thead>
            <tr>
              <th>№</th>
              <th>Название</th>
              <th className={styles["cats__thActions"]} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className={styles["cats__empty"]} colSpan={3}>
                  Загрузка…
                </td>
              </tr>
            ) : filtered.length ? (
              filtered.map((item, i) => (
                <tr key={item.id}>
                  <td>{i + 1}</td>
                  <td>{item.name}</td>
                  <td className={styles["cats__actionsCell"]}>
                    <button
                      className={styles["cats__dots"]}
                      onClick={() => openEdit(item.id)}
                      aria-label="Редактировать"
                    >
                      ⋮
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className={styles["cats__empty"]} colSpan={3}>
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* modal */}
      {editingId !== null && (
        <div className={styles["cats__modalOverlay"]} onClick={closeModal}>
          <div
            className={styles["cats__modal"]}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className={styles["cats__modalTitle"]}>
              {editingId === "new"
                ? `Добавить ${isCats ? "категорию" : "бренд"}`
                : `Редактировать ${isCats ? "категорию" : "бренд"}`}
            </h3>

            <input
              className={styles["cats__input"]}
              placeholder="Название"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />

            <div className={styles["cats__modalActions"]}>
              {editingId === "new" ? (
                <button
                  className={styles["cats__primary"]}
                  onClick={save}
                  disabled={!name.trim()}
                >
                  Добавить
                </button>
              ) : (
                <>
                  <button
                    className={styles["cats__primary"]}
                    onClick={save}
                    disabled={!name.trim()}
                  >
                    Сохранить
                  </button>
                  <button className={styles["cats__danger"]} onClick={remove}>
                    Удалить
                  </button>
                </>
              )}
              <button
                className={styles["cats__secondary"]}
                onClick={closeModal}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default MarketCategories;
