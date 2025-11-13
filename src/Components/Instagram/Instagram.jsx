import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "../../store/slices/userSlice";
import "./instagram.scss";
// утилы
const fmt = (iso) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || "";
  }
};
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Instagram() {
  const { userId, accessToken } = useUser();
  // вводные (подставь свои значения)
  const [accountId, setAccountId] = useState(userId);

  const [jwt, setJwt] = useState(accessToken);
  const [amount, setAmount] = useState(50);

  // данные
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [err, setErr] = useState(null);

  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState({}); // pk -> username
  const [unread, setUnread] = useState({}); // thread_id -> count

  // WS
  const [wsState, setWsState] = useState("closed"); // closed|connecting|open
  const wsRef = useRef(null);
  const pingRef = useRef(null);
  const connectGen = useRef(0);
  const closingRef = useRef(false);
  const watchingThreadRef = useRef(null); // какой тред сейчас «watch» на сервере

  // уведомления
  const [notifyEnabled, setNotifyEnabled] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted"
  );

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") {
      alert("Браузер не поддерживает Web Notifications");
      return;
    }
    if (Notification.permission === "default") {
      const p = await Notification.requestPermission();
      setNotifyEnabled(p === "granted");
    } else {
      setNotifyEnabled(Notification.permission === "granted");
    }
  };

  const showNotification = (title, body) => {
    try {
      if (!notifyEnabled || typeof Notification === "undefined") return;
      const n = new Notification(title || "Новое сообщение", {
        body: body || "",
        tag: Date.now().toString(),
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
      setTimeout(() => n.close(), 6000);
    } catch {}
  };

  const beep = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      setTimeout(() => {
        o.stop();
        ctx.close();
      }, 300);
    } catch {}
  };

  // заголовки для REST
  const headers = useMemo(() => {
    const h = { "Content-Type": "application/json" };
    if (jwt) h["Authorization"] = `Bearer ${jwt}`;
    return h;
  }, [jwt]);

  // REST: загрузка списка тредов
  const loadThreads = useCallback(async () => {
    if (!accountId) return;
    setLoadingThreads(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/instagram/accounts/${accountId}/threads/live/?amount=${amount}`,
        {
          headers,
          credentials: "include",
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setThreads(data.threads || []);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoadingThreads(false);
    }
  }, [accountId, amount, headers]);

  // корректно закрыть предыдущий сокет
  const cleanupWS = useCallback(async () => {
    const cur = wsRef.current;
    wsRef.current = null;
    if (pingRef.current) {
      clearInterval(pingRef.current);
      pingRef.current = null;
    }
    if (!cur) return;
    try {
      closingRef.current = true;
      cur.onopen = null;
      cur.onclose = null;
      cur.onmessage = null;
      cur.onerror = null;
      if (cur.readyState === 0 || cur.readyState === 1) {
        const waitClose = new Promise((resolve) => {
          const to = setTimeout(resolve, 300);
          cur.addEventListener(
            "close",
            () => {
              clearTimeout(to);
              resolve();
            },
            { once: true }
          );
        });
        cur.close(1000, "switch");
        await waitClose;
      }
    } catch {
    } finally {
      closingRef.current = false;
    }
  }, []);

  // открыть ОДИН WS на аккаунт
  const openWSAccount = useCallback(async () => {
    if (!accountId) return;
    const myGen = ++connectGen.current;
    setWsState("connecting");
    await cleanupWS();
    await delay(50);
    if (myGen !== connectGen.current) return;

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const origin = `${proto}://${window.location.host}`;
    const base = `${origin}/ws/instagram/${accountId}/`;
    const url = jwt ? `${base}?token=${encodeURIComponent(jwt)}` : base;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (myGen !== connectGen.current) {
        try {
          ws.close(1000, "superseded");
        } catch {}
        return;
      }
      setWsState("open");
      pingRef.current = setInterval(() => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping" }));
      }, 25000);
      // если уже выбран тред — сразу watch
      if (selected) {
        ws.send(JSON.stringify({ type: "watch", thread_id: selected }));
        watchingThreadRef.current = selected;
      }
    };

    ws.onclose = () => {
      if (pingRef.current) {
        clearInterval(pingRef.current);
        pingRef.current = null;
      }
      if (myGen === connectGen.current && !closingRef.current)
        setWsState("closed");
    };

    ws.onerror = () => {
      if (myGen === connectGen.current) setWsState("closed");
    };

    ws.onmessage = (ev) => {
      if (myGen !== connectGen.current) return;
      try {
        const data = JSON.parse(ev.data);

        if (data.type === "participants") {
          const map = Object.fromEntries(
            (data.users || []).map((u) => [String(u.pk), u.username])
          );
          setParticipants(map);
          return;
        }

        if (data.type === "watching") {
          // сервер подтвердил переключение
          watchingThreadRef.current = data.thread_id;
          return;
        }

        if (data.type === "incoming" || data.type === "outgoing") {
          const m = data.message;
          setMessages((prev) => [...prev, m]);

          // уведомления — только на входящие
          if (data.type === "incoming") {
            const uname =
              m.username || participants[m.sender_pk] || m.sender_pk || "Новый";
            const watching = watchingThreadRef.current;
            // если окно не в фокусе или смотрим другой тред — уведомляем + инкремент
            if (!document.hasFocus() || !selected || selected !== watching) {
              showNotification(
                `${uname} (Instagram)`,
                m.text || "Новое сообщение"
              );
              beep();
              setUnread((u) => ({
                ...u,
                [watching || selected || ""]:
                  (u[watching || selected || ""] || 0) + 1,
              }));
            }
          }
          return;
        }

        if (data.type === "error") {
          setErr(data.detail || "WS error");
          return;
        }
      } catch {}
    };
  }, [accountId, jwt, cleanupWS, selected, participants]);

  // выбор треда — watch без переподключения, обнулить непрочитанные
  const selectThread = (t) => {
    const id = t.thread_id;
    setSelected(id);
    setMessages([]);
    setParticipants({});
    setUnread((u) => ({ ...u, [id]: 0 }));
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "watch", thread_id: id }));
      watchingThreadRef.current = id;
    } else {
      openWSAccount();
    }
  };

  const send = () => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    const input = document.getElementById("msgInput");
    const val = (input?.value || "").trim();
    if (!val) return;
    wsRef.current.send(JSON.stringify({ type: "send", text: val }));
    if (input) input.value = "";
  };

  // автозагрузка
  useEffect(() => {
    if (accountId) {
      openWSAccount();
      loadThreads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setJwt(accessToken);
    setAccountId(userId);
  }, []);

  return (
    <div className="instagram">
      {/* Список тредов */}
      <div className="panel">
        <div className="toolbar">
          <h2>Диалоги</h2>
          <div className="row1">
            {/* <input
              className="input"
              placeholder="Account UUID"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              style={{ width: 220 }}
            />
            <input
              className="input"
              placeholder="JWT (опц.)"
              value={jwt}
              onChange={(e) => setJwt(e.target.value)}
              style={{ width: 220 }}
            /> */}
            <input
              className="input"
              type="number"
              min={1}
              max={200}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 50)}
              style={{ width: 90 }}
            />
            <button
              className="btn secondary"
              onClick={loadThreads}
              disabled={!accountId || loadingThreads}
            >
              {loadingThreads ? "Обновление..." : "Загрузить"}
            </button>
            <button
              className="btn"
              onClick={openWSAccount}
              disabled={!accountId || wsState === "open"}
            >
              Открыть WS
            </button>
            <button
              className="btn"
              onClick={enableNotifications}
              disabled={notifyEnabled}
            >
              Включить уведомления
            </button>
          </div>
        </div>
        <div className="list1">
          {threads.map((t) => {
            const isSel = selected === t.thread_id;
            const count = unread[t.thread_id] || 0;
            return (
              <button
                key={t.thread_id}
                className={`thread ${isSel ? "active" : ""}`}
                onClick={() => selectThread(t)}
                title={t.thread_id}
              >
                <div className="t-title">
                  {t.title ||
                    t.users
                      ?.map((u) => u.username)
                      .filter(Boolean)
                      .join(", ") ||
                    t.thread_id}
                </div>
                <div className="t-meta">
                  <span className="t-time">{fmt(t.last_activity)}</span>
                  {count > 0 && <span className="badge">{count}</span>}
                </div>
              </button>
            );
          })}
          {threads.length === 0 && !loadingThreads && (
            <div style={{ color: "#64748b", fontSize: 14 }}>Нет диалогов</div>
          )}
        </div>
        {err && (
          <div style={{ padding: "8px 12px" }} className="status">
            Ошибка: {err}
          </div>
        )}
      </div>

      {/* Окно чата */}
      <div className="panel">
        <div className="toolbar">
          <div className="row">
            <h2 style={{ marginRight: 8 }}>Чат</h2>
            {selected && (
              <span className="status">thread: {selected.slice(0, 10)}…</span>
            )}
          </div>
          <div className="status">
            WS: {wsState} {notifyEnabled ? "· 🔔" : ""}
          </div>
        </div>

        <div className="messages" id="messages">
          {!selected && (
            <div className="status" style={{ padding: 8 }}>
              Выберите диалог слева
            </div>
          )}
          {selected &&
            messages.map((m) => (
              <div
                key={m.mid}
                className={`bubble ${m.direction === "out" ? "me" : ""}`}
              >
                <div className="meta">
                  {m.username || participants[m.sender_pk] || m.sender_pk} ·{" "}
                  {fmt(m.created_at)}
                </div>
                <div>{m.text}</div>
              </div>
            ))}
        </div>

        <div className="composer">
          <input
            id="msgInput"
            className="input"
            placeholder={
              selected ? "Напишите сообщение..." : "Сначала выберите диалог"
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            style={{ flex: 1 }}
            disabled={!selected || wsState !== "open"}
          />
          <button
            className="btn"
            onClick={send}
            disabled={!selected || wsState !== "open"}
          >
            Отправить
          </button>
        </div>
      </div>

      {/* немножко стилей прямо тут */}
    </div>
  );
}
