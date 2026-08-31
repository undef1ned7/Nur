# Кафе: печать (чековый аппарат и кухни)

**Дата:** 27.08.2026  
**Сектор:** `cafe`  
**Аудитория:** агенты / разработчики, которым нужно понять весь поток печати без чтения кода с нуля.

| # | Файл | Содержание |
|---|---|---|
| 1 | [receipt-printing.md](./receipt-printing.md) | Полная карта: архитектура, настройки, ESC/POS, авто/ручная печать, lock/dedupe, стол, фискал vs термопринтер |

Кратко в корневом [PROJECT_DOCUMENTATION.md](../../PROJECT_DOCUMENTATION.md) (§19) и [README.md](../../README.md) (раздел printer-bridge).

Устаревший разбор инцидента со столом: [`cafe-receipt-print-analysis.md`](../../cafe-receipt-print-analysis.md) в корне — **не** источник истины; актуальный резолвер стола — `src/Components/Sectors/cafe/utils/resolveTableLabel.js`.
