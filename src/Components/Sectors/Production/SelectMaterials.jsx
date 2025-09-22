// SelectMaterials.jsx
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Checkbox, TextField } from "@mui/material";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
// import searchIcon from "..." // подставь путь к иконке поиска
// import plusIcon from "..."   // подставь путь к иконке плюса

/**
 * props:
 *  - options: [{id, name}] список сырья
 *  - value:   [{ materialId, quantity }] текущее значение
 *  - onChange(next) => void
 */
export default function SelectMaterials({
  options = [],
  value = [],
  onChange,
}) {
  const [isListVisible, setIsListVisible] = useState(false);
  const [search, setSearch] = useState("");

  // быстрый доступ: materialId -> quantity
  const valueMap = useMemo(() => {
    const m = new Map();
    value.forEach((v) => m.set(String(v.materialId), String(v.quantity)));
    return m;
  }, [value]);

  useEffect(() => {
    // защита от NaN: очищаем пустые/невалидные qty
    const cleaned = value.map((v) => ({
      materialId: v.materialId,
      quantity: v.quantity === "" ? "" : String(v.quantity).replace(",", "."),
    }));
    if (JSON.stringify(cleaned) !== JSON.stringify(value)) {
      onChange?.(cleaned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((m) =>
      (m.name || m.title || "").toLowerCase().includes(q)
    );
  }, [options, search]);

  const fadeIn = {
    hidden: { opacity: 0, height: 0 },
    visible: {
      opacity: 1,
      height: "260px",
      position: "absolute",
      zIndex: 3,
      width: "100%",
    },
    exit: { opacity: 0, height: 0 },
  };

  const toggleMaterial = (id) => {
    const key = String(id);
    const exists = valueMap.has(key);
    if (exists) {
      // снять выбор
      const next = value.filter((v) => String(v.materialId) !== key);
      onChange?.(next);
    } else {
      // добавить с количеством по умолчанию 1
      const next = [...value, { materialId: id, quantity: "1" }];
      onChange?.(next);
    }
  };

  const setQty = (id, qty) => {
    const key = String(id);
    const next = value.map((v) =>
      String(v.materialId) === key
        ? { ...v, quantity: qty === "" ? "" : String(qty).replace(",", ".") }
        : v
    );
    onChange?.(next);
  };

  const remove = (id) => {
    const key = String(id);
    const next = value.filter((v) => String(v.materialId) !== key);
    onChange?.(next);
  };

  return (
    <div className="select-materials">
      {/* Поиск */}
      <div className="select-materials__head-search">
        <input
          placeholder="Поиск сырья"
          name="search"
          onChange={(e) => setSearch(e.target.value)}
          type="text"
          value={search}
        />
        {/* <img src={searchIcon} alt="" /> */}
      </div>

      {/* Кнопка раскрытия списка */}
      <div
        className="select-materials__add"
        onClick={() => setIsListVisible((prev) => !prev)}
        style={{ cursor: "pointer" }}
      >
        {/* <img src={plusIcon} alt="" /> */}
        <p>{isListVisible ? "Скрыть список" : "Добавить сырьё"}</p>
      </div>

      {/* Выпадающий список с чекбоксами И сразу количеством */}
      <AnimatePresence>
        {isListVisible && (
          <motion.div
            className="select-materials__check active"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={fadeIn}
            transition={{ duration: 0.4 }}
          >
            {filtered.map((m) => {
              const checked = valueMap.has(String(m.id));
              const qty = valueMap.get(String(m.id)) ?? "";
              return (
                <div
                  className="select-materials__item"
                  key={m.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr 140px",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Checkbox
                    icon={<CheckBoxOutlineBlankIcon sx={{ fontSize: 28 }} />}
                    checkedIcon={<CheckBoxIcon sx={{ fontSize: 28 }} />}
                    checked={checked}
                    onChange={() => toggleMaterial(m.id)}
                    sx={{
                      color: "#000",
                      "&.Mui-checked": { color: "#f9cf00" },
                    }}
                  />
                  <p
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.name ?? m.title ?? `#${m.id}`}
                  </p>

                  {/* Поле количества активно только если выбран чекбокс */}
                  <TextField
                    placeholder="Кол-во на 1 ед."
                    size="small"
                    type="number"
                    inputProps={{ step: "0.0001", min: "0" }}
                    disabled={!checked}
                    value={qty}
                    onChange={(e) => setQty(m.id, e.target.value)}
                  />
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Выбранные материалы */}
      <div className="select-materials__selected">
        {value.map((v) => {
          const mat = options.find(
            (o) => String(o.id) === String(v.materialId)
          );
          return (
            <div
              className="select-materials__selected-item"
              key={v.materialId}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 140px 80px",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div className="select-materials__selected-name">
                <Checkbox
                  checked
                  onChange={() => toggleMaterial(v.materialId)}
                  sx={{ color: "#000", "&.Mui-checked": { color: "#f9cf00" } }}
                />
                <p>{mat?.name ?? mat?.title ?? `ID ${v.materialId}`}</p>
              </div>
              <TextField
                placeholder="Кол-во на 1 ед."
                size="small"
                type="number"
                inputProps={{ step: "0.0001", min: "0" }}
                value={v.quantity}
                onChange={(e) => setQty(v.materialId, e.target.value)}
              />
              <button
                type="button"
                className="select-materials__remove"
                onClick={() => remove(v.materialId)}
                aria-label="Удалить"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
