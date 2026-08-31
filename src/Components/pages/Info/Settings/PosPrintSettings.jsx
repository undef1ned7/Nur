import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  computeEscposCharsPerLine,
  isEscposGraphicPrintEnabled,
  persistEscposSettings,
  printRussianRawUsb,
  readEscposCharsPerLine,
} from "../../Sell/services/printService";
import "./Settings.scss";

const readNumber = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
};
const readString = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

export default function PosPrintSettings() {
  const navigate = useNavigate();

  const [dotsPerLine, setDotsPerLine] = useState(576);
  const [charsPerLine, setCharsPerLine] = useState(48);
  const [font, setFont] = useState("B"); // A | B
  const [lineHeight, setLineHeight] = useState(22);
  const [codepage, setCodepage] = useState(17);
  const [graphicPrint, setGraphicPrint] = useState(true);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState(null); // {type, text}
  const [loaded, setLoaded] = useState(false);
  const skipAutoSaveRef = useRef(false);

  const persistCurrent = useCallback(
    (values, { silent = false } = {}) => {
      const ok = persistEscposSettings(values);
      if (!ok) {
        setMsg({
          type: "error",
          text: "Не удалось сохранить настройки (localStorage недоступен)",
        });
        return false;
      }
      if (!silent) {
        setMsg({ type: "success", text: "Сохранено" });
      }
      return true;
    },
    [],
  );

  useEffect(() => {
    const f = String(readString("escpos_font", "B")).toUpperCase() === "A" ? "A" : "B";
    const dpl = readNumber("escpos_dpl", 576);
    const cpl = readEscposCharsPerLine(
      dpl,
      f,
      computeEscposCharsPerLine(dpl, f),
    );
    const lh = readNumber("escpos_line", f === "B" ? 22 : 24);
    const cp = readNumber("escpos_cp", 17);

    skipAutoSaveRef.current = true;
    setFont(f);
    setDotsPerLine(dpl);
    setCharsPerLine(cpl);
    setLineHeight(lh);
    setCodepage(cp);
    setGraphicPrint(isEscposGraphicPrintEnabled());
    setLoaded(true);
    queueMicrotask(() => {
      skipAutoSaveRef.current = false;
    });
  }, []);

  const syncCharsPerLine = useCallback((dpl, f) => {
    setCharsPerLine(computeEscposCharsPerLine(dpl, f));
  }, []);

  const handleDotsPerLineChange = useCallback(
    (value) => {
      const dpl = Number(value);
      setDotsPerLine(dpl);
      syncCharsPerLine(dpl, font);
    },
    [font, syncCharsPerLine],
  );

  const handleFontChange = useCallback(
    (nextFont) => {
      setFont(nextFont);
      syncCharsPerLine(dotsPerLine, nextFont);
    },
    [dotsPerLine, syncCharsPerLine],
  );

  const presets = useMemo(
    () => [
      { id: "80", label: "80 мм бумага (576 точек, 48 символов)", dpl: 576 },
      {
        id: "58",
        label: "58 мм бумага / 48 мм печать (384 точки, 32 символа)",
        dpl: 384,
      },
      { id: "44", label: "44 мм (обычно 320 точек)", dpl: 320 },
      { id: "38", label: "38 мм (обычно 288 точек)", dpl: 288 },
      { id: "custom", label: "Вручную", dpl: null },
    ],
    []
  );
  const selectedPreset = useMemo(() => {
    if (dotsPerLine === 576) return "80";
    if (dotsPerLine === 384) return "58";
    if (dotsPerLine === 320) return "44";
    if (dotsPerLine === 288) return "38";
    return "custom";
  }, [dotsPerLine]);

  const applyPreset = useCallback(
    (presetId) => {
      const preset = presets.find((p) => p.id === presetId);
      if (!preset) return;
      if (preset.dpl) {
        const f = font === "A" ? "A" : "B";
        const nextDpl = preset.dpl;
        const nextCpl = computeEscposCharsPerLine(preset.dpl, f);
        skipAutoSaveRef.current = true;
        setDotsPerLine(nextDpl);
        setCharsPerLine(nextCpl);
        persistCurrent(
          {
            dotsPerLine: nextDpl,
            charsPerLine: nextCpl,
            lineHeight,
            font: f,
            codepage,
            graphicPrint,
          },
          { silent: false },
        );
        queueMicrotask(() => {
          skipAutoSaveRef.current = false;
        });
      }
    },
    [font, presets, lineHeight, codepage, graphicPrint, persistCurrent],
  );

  useEffect(() => {
    if (!loaded || skipAutoSaveRef.current) return undefined;
    const timer = setTimeout(() => {
      persistCurrent(
        {
          dotsPerLine,
          charsPerLine,
          lineHeight,
          font,
          codepage,
          graphicPrint,
        },
        { silent: true },
      );
    }, 600);
    return () => clearTimeout(timer);
  }, [
    loaded,
    dotsPerLine,
    charsPerLine,
    lineHeight,
    font,
    codepage,
    graphicPrint,
    persistCurrent,
  ]);

  const save = useCallback(async () => {
    setMsg(null);
    setSaving(true);
    try {
      persistCurrent({
        dotsPerLine,
        charsPerLine,
        lineHeight,
        font,
        codepage,
        graphicPrint,
      });
    } finally {
      setSaving(false);
    }
  }, [
    dotsPerLine,
    charsPerLine,
    lineHeight,
    font,
    codepage,
    graphicPrint,
    persistCurrent,
  ]);

  const testUsb = useCallback(async () => {
    setMsg(null);
    setTesting(true);
    try {
      await printRussianRawUsb("ТЕСТ: Привет, мир! Ёё № 123", { interactive: true });
      setMsg({ type: "success", text: "Тест отправлен на USB‑печать" });
    } catch (e) {
      setMsg({ type: "error", text: e?.message || "Не удалось отправить тест" });
    } finally {
      setTesting(false);
    }
  }, []);

  const msgClassName = useMemo(() => {
    if (!msg) return "";
    if (msg.type === "success") return "settings__notice settings__notice--success";
    if (msg.type === "error") return "settings__notice settings__notice--error";
    return "settings__notice settings__notice--info";
  }, [msg]);

  return (
    <div className="settings">
      <div className="settings__header">
        <div className="settings__header-content">
          <h1>Печать чеков</h1>
          <p>Настройки ESC/POS принтера для POS-кассы</p>
        </div>
        <div className="settings__header-icon">
          <span className="settings__emoji" aria-hidden>
            🖨️
          </span>
        </div>
      </div>

      <div className="settings__content">
        <div className="settings__section settings__tab-content--print">
          <div className="settings__sectionHeadRow">
            <h2 className="settings__section-title">
              <span className="settings__emoji">🖨️</span> POS принтер • ESC/POS
            </h2>
            <div className="settings__sectionHeadBtns">
              <button
                type="button"
                className="settings__btn settings__btn--secondary"
                onClick={() => navigate(-1)}
              >
                Назад
              </button>
            </div>
          </div>

          <p className="settings__mutedText">
            Настройки сохраняются в <code>localStorage</code> (<code>escpos_*</code>)
            автоматически при изменении и применяются к graphic-чекам (canvas → растр)
            и текстовым ESC/POS (fallback / тест USB).
          </p>

          {msg && <div className={msgClassName}>{msg.text}</div>}

          <div className="settings__form-group">
            <div className="settings__label">Режим печати чека</div>
            <div className="settings__segmented">
              <button
                type="button"
                className={`settings__segBtn ${graphicPrint ? "settings__segBtn--active" : ""}`}
                onClick={() => setGraphicPrint(true)}
              >
                Graphic (canvas)
              </button>
              <button
                type="button"
                className={`settings__segBtn ${!graphicPrint ? "settings__segBtn--active" : ""}`}
                onClick={() => setGraphicPrint(false)}
              >
                Текстовый ESC/POS
              </button>
            </div>
            <div className="settings__fieldHint">
              <b>Graphic</b> — по умолчанию; кириллица через canvas и растр (GS v
              0), без codepage. <b>Текстовый</b> — байты ESC/POS + codepage
              (как <code>/crm/sell</code>).
            </div>
          </div>

          <div className="settings__form-group">
            <div className="settings__label">Ширина бумаги</div>
            <select
              className="settings__select"
              value={selectedPreset}
              onChange={(e) => applyPreset(e.target.value)}
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="settings__form-group">
            <div className="settings__label">
              DOTS_PER_LINE (ширина растра в точках, ~8 точек/мм зоны печати)
            </div>
            <input
              className="settings__input settings__input--plain"
              type="number"
              min={200}
              step={1}
              value={dotsPerLine}
              onChange={(e) => handleDotsPerLineChange(e.target.value)}
            />
          </div>

          <div className="settings__form-group">
            <div className="settings__label">
              CHARS_PER_LINE (логическая ширина строки: layout graphic-чека и
              текстовый ESC/POS)
            </div>
            <input
              className="settings__input settings__input--plain"
              type="number"
              min={16}
              step={1}
              value={charsPerLine}
              onChange={(e) => setCharsPerLine(Number(e.target.value))}
            />
          </div>

          <div className="settings__form-group">
            <div className="settings__label">Шрифт ESC/POS (Font A / B)</div>
            <div className="settings__segmented">
              <button
                type="button"
                className={`settings__segBtn ${font === "B" ? "settings__segBtn--active" : ""}`}
                onClick={() => handleFontChange("B")}
              >
                Font B (узкий)
              </button>
              <button
                type="button"
                className={`settings__segBtn ${font === "A" ? "settings__segBtn--active" : ""}`}
                onClick={() => handleFontChange("A")}
              >
                Font A (широкий)
              </button>
            </div>
            <div className="settings__fieldHint">
              Влияет на текстовую печать (ESC M) и подсказку CHARS_PER_LINE.
              Graphic-чек рисуется моноширинным canvas-шрифтом, но ширина строки
              берётся из CHARS_PER_LINE.
            </div>
          </div>

          <div className="settings__form-group">
            <div className="settings__label">
              Межстрочный интервал (escpos_line, точки; ESC 3)
            </div>
            <input
              className="settings__input settings__input--plain"
              type="number"
              min={10}
              step={1}
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
            />
            <div className="settings__fieldHint">
              Используется в graphic-чеке (высота строк canvas) и в текстовом
              ESC/POS (ESC 3).
            </div>
          </div>

          <div className="settings__form-group">
            <div className="settings__label">CodePage (ESC/POS: ESC t n)</div>
            <select
              className="settings__select"
              value={codepage}
              onChange={(e) => setCodepage(Number(e.target.value))}
            >
              <option value={17}>PC866 (17) — часто по умолчанию</option>
              <option value={66}>PC866 (66) — вариант у некоторых Xprinter</option>
              <option value={59}>PC866 Russian (59)</option>
              <option value={18}>PC852/alt (18)</option>
              <option value={73}>CP1251 (73)</option>
              <option value={22}>CP1251 (22)</option>
              <option value={255}>PC936 (GBK) — часто 255</option>
            </select>
            <div className="settings__fieldHint">
              Можно указать номер вручную (0–255), если в вашем принтере PC936 имеет
              другой номер.
            </div>
            <input
              className="settings__input settings__input--plain"
              type="number"
              min={0}
              max={255}
              step={1}
              value={codepage}
              onChange={(e) => setCodepage(Number(e.target.value))}
              style={{ marginTop: 8 }}
            />
            <div className="settings__fieldHint">
              Если печатает “кракозябрами” — попробуйте переключить <b>17 ↔ 66</b>{" "}
              или <b>PC866 ↔ CP1251</b>. Только для текстового режима (
              <code>graphic: false</code>); graphic-чек кириллицу рисует через canvas.
            </div>
          </div>

          <div className="settings__actions">
            <button
              type="button"
              className="settings__btn settings__btn--primary"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
            <button
              type="button"
              className="settings__btn settings__btn--secondary"
              onClick={testUsb}
              disabled={testing}
            >
              {testing ? "Отправка..." : "Тест USB‑печати"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

