"""
Агент печати на Flet — десктопное приложение, заменяющее printer-bridge.
Принимает задания по HTTP (POST /print), отправляет сырые байты на принтер по TCP.
Запуск: python main.py  или  flet run main.py
"""

import base64
import json
import socket
import threading
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

import flet as ft

# Настройки по умолчанию
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 5179
PRINT_ENDPOINT = "/print"


def _show_snack(page: ft.Page, message: str) -> None:
    """Показать уведомление (совместимо со старыми версиями Flet)."""
    snack = ft.SnackBar(content=ft.Text(message), open=True)
    if hasattr(page, "show_snack_bar"):
        page.show_snack_bar(snack)
    else:
        page.snack_bar = snack
        page.update()


def is_valid_ip(ip: str) -> bool:
    if not ip:
        return False
    parts = ip.split(".")
    if len(parts) != 4:
        return False
    for p in parts:
        try:
            n = int(p)
            if n < 0 or n > 255:
                return False
        except ValueError:
            return False
    return True


def send_raw_to_printer(ip: str, port: int, data_base64: str, timeout_ms: int = 2000) -> None:
    if not is_valid_ip(ip):
        raise ValueError("Некорректный IP")
    port = int(port or 9100)
    if not (1 <= port <= 65535):
        raise ValueError("Некорректный порт")
    data = base64.b64decode(data_base64 or "")
    if not data:
        raise ValueError("Пустые данные")

    timeout_sec = max(0.1, timeout_ms / 1000.0)
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(timeout_sec)
        s.connect((ip, port))
        s.sendall(data)


class PrintHandler(BaseHTTPRequestHandler):
    """Обработчик HTTP: POST /print с JSON { ip, port, data }."""

    def log_message(self, format, *args):
        pass  # отключаем вывод в консоль, логи идёт в UI

    def _cors_headers(self, origin: str = "*"):
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")

    def _send_json(self, status: int, body: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors_headers(self.headers.get("Origin", "*"))
        self.end_headers()
        self.wfile.write(json.dumps(body, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers(self.headers.get("Origin", "*"))
        self.end_headers()

    def do_GET(self):
        if urlparse(self.path).path == "/health":
            self._send_json(200, {"ok": True})
            return
        self._send_json(404, {"ok": False, "error": "Not found"})

    def do_POST(self):
        if urlparse(self.path).path != PRINT_ENDPOINT:
            self._send_json(404, {"ok": False, "error": "Not found"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 2 * 1024 * 1024:
                self._send_json(400, {"ok": False, "error": "Body too large"})
                return
            raw = self.rfile.read(content_length).decode("utf-8")
            body = json.loads(raw) if raw else {}
        except Exception as e:
            self._send_json(400, {"ok": False, "error": str(e)})
            return

        try:
            send_raw_to_printer(
                ip=body.get("ip"),
                port=body.get("port", 9100),
                data_base64=body.get("data"),
                timeout_ms=int(body.get("timeoutMs", 2000)),
            )
            self._send_json(200, {"ok": True})
            # Сообщим UI о успехе (через атрибут сервера)
            if hasattr(self.server, "on_print_ok"):
                self.server.on_print_ok(body.get("ip"), body.get("port"))
        except Exception as e:
            self._send_json(400, {"ok": False, "error": str(e)})
            if hasattr(self.server, "on_print_error"):
                self.server.on_print_error(str(e))


def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "localhost"


def main(page: ft.Page):
    page.title = "Агент печати"
    page.window.width = 480
    page.window.height = 520
    page.window.resizable = True
    page.window.min_width = 400
    page.window.min_height = 420
    page.padding = 24
    page.theme_mode = ft.ThemeMode.LIGHT
    page.bgcolor = ft.Colors.GREY_50

    status_text = ft.Ref[ft.Text]()
    url_row = ft.Ref[ft.Row]()  # строка с URL и кнопкой «Копировать»
    log_ref = ft.Ref[ft.Column]()

    def update_log(line: str, is_error: bool = False):
        ts = datetime.now().strftime("%H:%M:%S")
        color = ft.Colors.RED if is_error else ft.Colors.BLUE
        if log_ref.current:
            log_ref.current.controls.append(
                ft.Row(
                    [
                        ft.Text(ts, size=11, color=ft.Colors.GREY_600, width=64),
                        ft.Text(line, size=12, color=color, expand=True),
                    ],
                    spacing=8,
                    vertical_alignment=ft.CrossAxisAlignment.START,
                )
            )
            while len(log_ref.current.controls) > 80:
                log_ref.current.controls.pop(0)
            try:
                page.update()
            except Exception:
                pass

    def on_print_ok(ip, port):
        update_log(f"Печать отправлена → {ip}:{port}")

    def on_print_error(msg: str):
        update_log(f"Ошибка: {msg}", is_error=True)

    server_thread = None
    server_holder = []
    current_port = [None]  # [int] чтобы обновить URL при старте

    def copy_url(_):
        port = current_port[0]
        if port is None:
            return
        url = f"http://{get_local_ip()}:{port}{PRINT_ENDPOINT}"
        page.set_clipboard(url)
        _show_snack(page, "URL скопирован в буфер обмена")

    def start_server(_):
        nonlocal server_thread
        try:
            port = int(port_field.value or DEFAULT_PORT)
        except ValueError:
            _show_snack(page, "Порт должен быть числом")
            return

        if server_thread and server_thread.is_alive():
            _show_snack(page, "Сервер уже запущен")
            return

        def run():
            server = HTTPServer((DEFAULT_HOST, port), PrintHandler)
            server.on_print_ok = on_print_ok
            server.on_print_error = on_print_error
            server_holder.append(server)
            current_port[0] = port
            update_log(f"Сервер запущен на порту {port}")
            server.serve_forever()

        server_thread = threading.Thread(target=run, daemon=True)
        server_thread.start()

        current_port[0] = port
        url = f"http://{get_local_ip()}:{port}{PRINT_ENDPOINT}"
        status_text.current.value = "Запущен"
        status_text.current.color = ft.Colors.BLUE
        status_icon.current.name = ft.Icons.CHECK_CIRCLE
        status_icon.current.color = ft.Colors.BLUE
        start_btn.disabled = True
        port_field.disabled = True
        url_container.visible = True
        url_display.current.value = url
        page.update()

    def stop_server(_):
        if server_holder:
            try:
                server_holder[0].shutdown()
            except Exception:
                pass
            server_holder.clear()
        current_port[0] = None
        status_text.current.value = "Остановлен"
        status_text.current.color = ft.Colors.GREY_600
        status_icon.current.name = ft.Icons.RADIO_BUTTON_UNCHECKED
        status_icon.current.color = ft.Colors.GREY_600
        start_btn.disabled = False
        port_field.disabled = False
        url_container.visible = False
        page.update()

    port_field = ft.TextField(
        label="Порт",
        value=str(DEFAULT_PORT),
        width=100,
        keyboard_type=ft.KeyboardType.NUMBER,
        dense=True,
    )
    start_btn = ft.ElevatedButton(
        "Запустить",
        on_click=start_server,
        icon=ft.Icons.PLAY_ARROW,
    )
    stop_btn = ft.OutlinedButton(
        "Остановить",
        on_click=stop_server,
        icon=ft.Icons.STOP,
    )
    status_icon = ft.Ref[ft.Icon]()
    url_display = ft.Ref[ft.Text]()
    url_container = ft.Container(
        ft.Column(
            [
                ft.Text("URL для настроек приложения", size=12, weight=ft.FontWeight.W_500),
                ft.Row(
                    [
                        ft.Text(ref=url_display, value="", size=13, selectable=True, expand=True),
                        ft.IconButton(
                            icon=ft.Icons.COPY,
                            tooltip="Копировать URL",
                            on_click=copy_url,
                        ),
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
            ],
            spacing=6,
        ),
        visible=False,
        padding=12,
        bgcolor=ft.Colors.GREY_200,
        border_radius=8,
    )

    page.add(
        # Заголовок
        ft.Row(
            [
                ft.Container(
                    ft.Icon(ft.Icons.PRINT, size=32, color=ft.Colors.BLUE),
                    padding=10,
                    bgcolor=ft.Colors.BLUE_50,
                    border_radius=12,
                ),
                ft.Column(
                    [
                        ft.Text("Агент печати", size=22, weight=ft.FontWeight.BOLD),
                        ft.Text(
                            "Принимает задания от браузера и отправляет на Wi‑Fi принтеры по TCP",
                            size=12,
                            color=ft.Colors.GREY_600,
                        ),
                    ],
                    spacing=2,
                ),
            ],
            spacing=16,
        ),
        ft.Divider(height=24),
        # Блок «Сервер»
        ft.Container(
            ft.Column(
                [
                    ft.Text("Сервер", size=14, weight=ft.FontWeight.W_600),
                    ft.Row(
                        [port_field, start_btn, stop_btn],
                        spacing=12,
                        alignment=ft.MainAxisAlignment.START,
                    ),
                    ft.Row(
                        [
                            ft.Icon(ref=status_icon, name=ft.Icons.RADIO_BUTTON_UNCHECKED, size=18, color=ft.Colors.GREY_600),
                            ft.Text(ref=status_text, value="Остановлен", size=13, color=ft.Colors.GREY_600),
                        ],
                        spacing=8,
                        alignment=ft.MainAxisAlignment.START,
                    ),
                    url_container,
                ],
                spacing=12,
            ),
            padding=16,
            bgcolor=ft.Colors.GREY_100,
            border_radius=12,
        ),
        ft.Divider(height=20),
        # Лог
        ft.Column(
            [
                ft.Row(
                    [
                        ft.Icon(ft.Icons.LIST_ALT, size=18, color=ft.Colors.GREY_600),
                        ft.Text("Лог", size=14, weight=ft.FontWeight.W_600),
                    ],
                    spacing=6,
                ),
                ft.Container(
                    ft.Column(ref=log_ref, scroll=ft.ScrollMode.AUTO, expand=True),
                    border=ft.border.all(1, ft.Colors.GREY_300),
                    border_radius=8,
                    padding=12,
                    height=200,
                    bgcolor=ft.Colors.WHITE,
                ),
            ],
            spacing=8,
            expand=True,
        ),
    )


if __name__ == "__main__":
    ft.app(target=main)
