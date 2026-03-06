# Агент печати (Flet)

Десктопное приложение на [Flet](https://flet.dev) — замена printer-bridge с окном и логом.

## Что делает

- Слушает HTTP на `0.0.0.0:5179/print` (порт можно менять).
- Принимает POST с JSON: `{ "ip": "192.168.1.200", "port": 9100, "data": "<base64 ESC/POS>" }`.
- Отправляет байты на принтер по сырому TCP (без HTTP).
- В интерфейсе: порт, кнопки «Запустить» / «Остановить», лог последних печатей.

**Несколько принтеров:** один агент обслуживает все Wi‑Fi принтеры в сети. В каждом запросе указывается свой `ip:port` — касса, кухня 1, кухня 2 и т.д. В настройках приложения (Настройки → Печать) настраиваются: один принтер кассы и отдельный принтер (или общий) для каждой кухни.

## Установка и запуск

```bash
cd tools/printer-agent
pip install -r requirements.txt
python main.py
```

Или через Flet CLI:

```bash
flet run main.py
```

## Настройка в приложении

В настройках печати (nurcrm) в поле «Printer-bridge URL» укажите адрес ПК, где запущен агент, например:

- `http://192.168.1.10:5179/print`

(подставьте IP этого компьютера в локальной сети).

## Сборка exe (Windows)

На **Windows** можно собрать один исполняемый файл, чтобы не ставить Python на целевой ПК.

1. Установите Flet (если ещё не установлен):
   ```bash
   pip install flet
   ```

2. Запустите сборку:
   - **Windows:** дважды запустите `build.bat` или в терминале:
     ```cmd
     cd tools\printer-agent
     flet pack main.py -n printer-agent -y
     ```
   - **macOS/Linux:** `./build.sh` или `flet pack main.py -n printer-agent -y`

3. Готовый файл будет в папке **`dist/`**:
   - Windows: `dist/printer-agent.exe`
   - macOS: `dist/printer-agent.app`

Собранный exe можно скопировать на любой ПК в офисе и запускать без установки Python. Иконку приложения можно задать так: `flet pack main.py -n printer-agent -i icon.ico -y`.

## Требования

- Python 3.8+
- Flet 0.24+
