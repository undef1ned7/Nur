// src/components/Documents/Documents.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import styles from "../../cafe/Documents/Documents.module.scss";
import api from "../../../../api";

/* ========== helpers ========== */
function normalizeResp(data) {
  return Array.isArray(data)
    ? { results: data, next: null, previous: null, count: data.length }
    : {
        results: data?.results || [],
        next: data?.next || null,
        previous: data?.previous || null,
        count: typeof data?.count === "number" ? data.count : null,
      };
}

function extFromUrl(u = "") {
  try {
    const p = new URL(u, window.location.origin);
    const last = p.pathname.split("/").filter(Boolean).pop() || "";
    return (last.split(".").pop() || "").toLowerCase();
  } catch {
    const last = (u || "").split("/").filter(Boolean).pop() || "";
    return (last.split(".").pop() || "").toLowerCase();
  }
}

function guessMime(url = "") {
  const ext = extFromUrl(url);
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext))
    return `image/${ext === "jpg" ? "jpeg" : ext}`;
  if (ext === "pdf") return "application/pdf";
  if (["doc", "docx"].includes(ext)) return "application/msword";
  if (["xls", "xlsx"].includes(ext)) return "application/vnd.ms-excel";
  if (["ppt", "pptx"].includes(ext)) return "application/vnd.ms-powerpoint";
  if (["txt", "md"].includes(ext)) return "text/plain";
  return "";
}

function fileEmoji(type, url) {
  const t = type || guessMime(url) || "";
  if (t.startsWith("image/")) return "🖼️";
  if (t === "application/pdf") return "📕";
  if (t.includes("sheet") || t.includes("excel") || /\.xlsx?$/i.test(url))
    return "📊";
  if (t.includes("word") || /\.docx?$/i.test(url)) return "📃";
  if (t.includes("presentation") || /\.pptx?$/i.test(url)) return "🖥️";
  if (/\.zip|\.rar|\.7z/i.test(url)) return "🗜️";
  return "📄";
}

function fmtISO(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = `${d.getDate()}`.padStart(2, "0");
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mi = `${d.getMinutes()}`.padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

/* ========== component ========== */
function BuildingDocuments() {
  const [tab, setTab] = useState("folders"); // "folders" | "docs"

  /* ----- FOLDERS ----- */
  const [foldRows, setFoldRows] = useState([]);
  const [foldLoading, setFoldLoading] = useState(false);
  const [foldErr, setFoldErr] = useState("");
  const [foldNext, setFoldNext] = useState(null);
  const [foldPrev, setFoldPrev] = useState(null);

  const [folderQ, setFolderQ] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [folderDetail, setFolderDetail] = useState(null);
  const [folderDetailLoading, setFolderDetailLoading] = useState(false);

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFolderName, setCreateFolderName] = useState("");
  const [createFolderBusy, setCreateFolderBusy] = useState(false);

  const [editFolderOpen, setEditFolderOpen] = useState(false);
  const [editFolderId, setEditFolderId] = useState("");
  const [editFolderName, setEditFolderName] = useState("");
  const [editFolderBusy, setEditFolderBusy] = useState(false);

  const [allFoldersForSelect, setAllFoldersForSelect] = useState([]);
  const nameRef = useRef(null);

  const loadFolders = useCallback(async (url = "/education/folders/") => {
    setFoldLoading(true);
    setFoldErr("");
    try {
      const { data } = await api.get(url);
      const n = normalizeResp(data);
      setFoldRows(n.results);
      setFoldNext(n.next);
      setFoldPrev(n.previous);
      if (n.results?.[0]) {
        setSelectedFolderId((prev) => prev || n.results[0].id);
      } else {
        setSelectedFolderId("");
        setFolderDetail(null);
      }
    } catch (e) {
      setFoldErr(e?.response?.data?.detail || "Не удалось загрузить папки");
    } finally {
      setFoldLoading(false);
    }
  }, []);

  const loadFolderDetail = useCallback(async (id) => {
    if (!id) {
      setFolderDetail(null);
      return;
    }
    setFolderDetailLoading(true);
    try {
      const { data } = await api.get(`/education/folders/${id}/`);
      setFolderDetail(data);
      setFoldRows((prev) => prev.map((x) => (x.id === id ? data : x)));
    } finally {
      setFolderDetailLoading(false);
    }
  }, []);

  const fetchAllFoldersForSelect = useCallback(async () => {
    const acc = [];
    let next = "/education/folders/";
    try {
      while (next) {
        const { data } = await api.get(next);
        const n = normalizeResp(data);
        acc.push(...n.results);
        next = n.next;
      }
      acc.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru"));
      setAllFoldersForSelect(acc);
    } catch {
      setAllFoldersForSelect([]);
    }
  }, []);

  const onCreateFolder = useCallback(
    async (e) => {
      e.preventDefault();
      const name = (createFolderName || "").trim();
      if (!name) return alert("Название папки обязательно");
      if (name.length > 255) return alert("Макс. длина названия — 255");

      setCreateFolderBusy(true);
      setFoldErr("");
      try {
        const { data } = await api.post("/education/folders/", { name });
        await loadFolders();
        if (data?.id) setSelectedFolderId(data.id);
        setCreateFolderOpen(false);
        setCreateFolderName("");
      } catch (e2) {
        setFoldErr(e2?.response?.data?.detail || "Не удалось создать папку");
      } finally {
        setCreateFolderBusy(false);
      }
    },
    [createFolderName, loadFolders]
  );

  const openEditFolder = useCallback((f) => {
    setEditFolderId(f.id);
    setEditFolderName(f.name || "");
    setEditFolderOpen(true);
    setTimeout(() => nameRef.current?.focus(), 0);
  }, []);

  const onEditFolder = useCallback(
    async (e) => {
      e.preventDefault();
      const name = (editFolderName || "").trim();
      if (!name) return alert("Название папки обязательно");

      setEditFolderBusy(true);
      setFoldErr("");
      try {
        await api.patch(`/education/folders/${editFolderId}/`, { name });
        await loadFolders();
        setEditFolderOpen(false);
        if (selectedFolderId === editFolderId) loadFolderDetail(editFolderId);
      } catch (e2) {
        setFoldErr(e2?.response?.data?.detail || "Не удалось изменить папку");
      } finally {
        setEditFolderBusy(false);
      }
    },
    [
      editFolderId,
      editFolderName,
      loadFolders,
      loadFolderDetail,
      selectedFolderId,
    ]
  );

  const onDeleteFolder = useCallback(
    async (f) => {
      if (!window.confirm(`Удалить папку «${f.name || "Без названия"}»?`))
        return;
      setFoldErr("");
      try {
        await api.delete(`/education/folders/${f.id}/`);
        await loadFolders();
        if (selectedFolderId === f.id) {
          setSelectedFolderId("");
          setFolderDetail(null);
        }
      } catch (e2) {
        setFoldErr(
          e2?.response?.data?.detail ||
            "Не удалось удалить папку. Убедитесь, что в папке нет документов."
        );
      }
    },
    [loadFolders, selectedFolderId]
  );

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    if (selectedFolderId) loadFolderDetail(selectedFolderId);
  }, [selectedFolderId, loadFolderDetail]);

  const foldFiltered = useMemo(() => {
    const s = folderQ.trim().toLowerCase();
    if (!s) return foldRows;
    return foldRows.filter((r) => `${r.name || ""}`.toLowerCase().includes(s));
  }, [foldRows, folderQ]);

  /* ----- DOCUMENTS ----- */
  const [docRows, setDocRows] = useState([]);
  const [docLoading, setDocLoading] = useState(false);
  const [docErr, setDocErr] = useState("");
  const [docNext, setDocNext] = useState(null);
  const [docPrev, setDocPrev] = useState(null);

  const [docQ, setDocQ] = useState("");
  const [docFolderFilter, setDocFolderFilter] = useState(""); // '' = все, иначе UUID
  const [selectedDocId, setSelectedDocId] = useState("");
  const [docViewerUrl, setDocViewerUrl] = useState("");

  const [createDocOpen, setCreateDocOpen] = useState(false);
  const [createDocName, setCreateDocName] = useState("");
  const [createDocFolder, setCreateDocFolder] = useState("");
  const [createDocFile, setCreateDocFile] = useState(null);
  const [createDocBusy, setCreateDocBusy] = useState(false);

  const [editDocOpen, setEditDocOpen] = useState(false);
  const [editDocId, setEditDocId] = useState("");
  const [editDocName, setEditDocName] = useState("");
  const [editDocFolder, setEditDocFolder] = useState("");
  const [editDocFile, setEditDocFile] = useState(null);
  const [editDocBusy, setEditDocBusy] = useState(false);

  const loadDocs = useCallback(async (url = "/education/documents/") => {
    setDocLoading(true);
    setDocErr("");
    try {
      const { data } = await api.get(url);
      const n = normalizeResp(data);
      setDocRows(n.results);
      setDocNext(n.next);
      setDocPrev(n.previous);
      if (n.results?.[0]) {
        setSelectedDocId((prev) => prev || n.results[0].id);
        setDocViewerUrl(n.results[0].file || "");
      } else {
        setSelectedDocId("");
        setDocViewerUrl("");
      }
    } catch (e) {
      setDocErr(e?.response?.data?.detail || "Не удалось загрузить документы");
    } finally {
      setDocLoading(false);
    }
  }, []);

  const loadDocDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      const { data } = await api.get(`/education/documents/${id}/`);
      setDocRows((prev) => prev.map((x) => (x.id === id ? data : x)));
      setDocViewerUrl(data.file || "");
    } catch {
      /* ignore */
    }
  }, []);

  const onCreateDoc = useCallback(
    async (e) => {
      e.preventDefault();
      if (!createDocFolder.trim()) return alert("Выберите папку");
      if (!createDocFile) return alert("Выберите файл");

      setCreateDocBusy(true);
      setDocErr("");
      try {
        const fd = new FormData();
        fd.append("folder", createDocFolder.trim());
        if (createDocName.trim()) fd.append("name", createDocName.trim());
        fd.append("file", createDocFile);

        const { data } = await api.post("/education/documents/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        await loadDocs();
        if (data?.id) {
          setSelectedDocId(data.id);
          setDocViewerUrl(data.file || "");
        }
        setCreateDocOpen(false);
        setCreateDocName("");
        setCreateDocFolder(docFolderFilter || selectedFolderId || "");
        setCreateDocFile(null);
      } catch (e2) {
        setDocErr(e2?.response?.data?.detail || "Не удалось создать документ");
      } finally {
        setCreateDocBusy(false);
      }
    },
    [
      createDocFolder,
      createDocFile,
      createDocName,
      docFolderFilter,
      selectedFolderId,
      loadDocs,
    ]
  );

  const onEditDocSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!editDocFolder.trim()) return alert("Выберите папку");

      setEditDocBusy(true);
      setDocErr("");
      try {
        if (editDocFile) {
          const fd = new FormData();
          fd.append("folder", editDocFolder.trim());
          fd.append("name", (editDocName || "").trim());
          fd.append("file", editDocFile);
          await api.patch(`/education/documents/${editDocId}/`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } else {
          await api.patch(`/education/documents/${editDocId}/`, {
            name: (editDocName || "").trim(),
            folder: editDocFolder.trim(),
          });
        }
        await loadDocs();
        setEditDocOpen(false);
        if (selectedDocId === editDocId) loadDocDetail(editDocId);
      } catch (e2) {
        setDocErr(e2?.response?.data?.detail || "Не удалось изменить документ");
      } finally {
        setEditDocBusy(false);
      }
    },
    [
      editDocId,
      editDocFile,
      editDocFolder,
      editDocName,
      loadDocs,
      loadDocDetail,
      selectedDocId,
    ]
  );

  const onDeleteDoc = useCallback(
    async (d) => {
      if (!window.confirm(`Удалить документ «${d.name || "Без названия"}»?`))
        return;
      setDocErr("");
      try {
        await api.delete(`/education/documents/${d.id}/`);
        await loadDocs();
        if (selectedDocId === d.id) {
          setSelectedDocId("");
          setDocViewerUrl("");
        }
      } catch (e2) {
        setDocErr(e2?.response?.data?.detail || "Не удалось удалить документ");
      }
    },
    [loadDocs, selectedDocId]
  );

  const openEditDoc = useCallback(
    (d) => {
      setEditDocId(d.id);
      setEditDocName(d.name || "");
      setEditDocFolder(d.folder || "");
      setEditDocFile(null);
      setEditDocOpen(true);
      if (!allFoldersForSelect.length) fetchAllFoldersForSelect();
    },
    [allFoldersForSelect.length, fetchAllFoldersForSelect]
  );

  useEffect(() => {
    if (tab === "docs") {
      loadDocs();
      fetchAllFoldersForSelect();
      if (selectedFolderId) setDocFolderFilter(selectedFolderId);
    }
  }, [tab, loadDocs, fetchAllFoldersForSelect, selectedFolderId]);

  useEffect(() => {
    if (tab === "docs" && selectedFolderId)
      setDocFolderFilter(selectedFolderId);
  }, [tab, selectedFolderId]);

  const docFiltered = useMemo(() => {
    const s = docQ.trim().toLowerCase();
    return docRows.filter((r) => {
      const okFolder = docFolderFilter ? r.folder === docFolderFilter : true;
      if (!okFolder) return false;
      if (!s) return true;
      const fname = (r.file || "").split("/").pop() || "";
      const hay = `${r.name || ""} ${
        r.folder_name || ""
      } ${fname}`.toLowerCase();
      return hay.includes(s);
    });
  }, [docRows, docQ, docFolderFilter]);

  const currentDoc = useMemo(
    () => docFiltered.find((r) => r.id === selectedDocId) || null,
    [docFiltered, selectedDocId]
  );

  async function onSelectDoc(row) {
    setSelectedDocId(row.id);
    setDocViewerUrl(row.file || "");
    await loadDocDetail(row.id);
  }

  /* ----- RENDER ----- */
  return (
    <div className={styles["docs"]}>
      {/* Header */}
      <div className={styles["docs__header"]}>
        <div>
          <h3 className={styles["docs__title"]}>Документы и папки</h3>
          <div className={styles["docs__subtitle"]}>
            Управляйте папками и файлами
          </div>
        </div>

        <div className={styles["docs__actions"]}>
          <div className={styles["docs__tabs"]}>
            <button
              className={`${styles["tab"]} ${
                tab === "folders" ? styles["tab--active"] : ""
              }`}
              onClick={() => setTab("folders")}
            >
              Папки
            </button>
            <button
              className={`${styles["tab"]} ${
                tab === "docs" ? styles["tab--active"] : ""
              }`}
              onClick={() => setTab("docs")}
            >
              Документы
            </button>
          </div>
        </div>
      </div>

      {/* ===== FOLDERS TAB ===== */}
      {tab === "folders" && (
        <>
          <div className={styles["docs__serverBar"]}>
            <div className={styles["docs__search"]}>
              <span className={styles["docs__searchIcon"]}>🔎</span>
              <input
                className={styles["docs__searchInput"]}
                placeholder="Поиск по папкам…"
                value={folderQ}
                onChange={(e) => setFolderQ(e.target.value)}
              />
            </div>
            {foldErr ? (
              <span className={styles["docs__error"]}>{foldErr}</span>
            ) : null}
            <div className={styles["docs__barActions"]}>
              <button
                className={styles["btn"]}
                disabled={foldLoading}
                onClick={() => loadFolders()}
              >
                Обновить
              </button>
              <button
                className={`${styles["btn"]} ${styles["btn--primary"]}`}
                onClick={() => {
                  setCreateFolderOpen(true);
                  setTimeout(() => nameRef.current?.focus(), 0);
                }}
              >
                + Папка
              </button>
            </div>
          </div>

          <div className={styles["docs__grid"]}>
            {/* List */}
            <section className={styles["docs__list"]}>
              {foldFiltered.length === 0 ? (
                <div className={styles["docs__empty"]}>
                  {foldLoading ? "Загрузка…" : "Ничего не найдено"}
                </div>
              ) : (
                <>
                  <ul className={styles["docs__cards"]}>
                    {foldFiltered.map((f) => (
                      <li
                        key={f.id}
                        className={`${styles["docs__card"]} ${
                          f.id === selectedFolderId
                            ? styles["docs__card--active"]
                            : ""
                        }`}
                        onDoubleClick={() => setSelectedFolderId(f.id)}
                      >
                        <div className={styles["docs__cardMain"]}>
                          <div className={styles["docs__name"]}>
                            📁 {f.name || "Без названия"}
                          </div>
                        </div>
                        <div className={styles["docs__cardActions"]}>
                          <button
                            className={`${styles["btn"]} ${styles["btn--secondary"]}`}
                            onClick={() => setSelectedFolderId(f.id)}
                          >
                            Открыть
                          </button>
                          <button
                            className={styles["btn"]}
                            onClick={() => openEditFolder(f)}
                          >
                            Изменить
                          </button>
                          <button
                            className={`${styles["btn"]} ${styles["btn--danger"]}`}
                            onClick={() => onDeleteFolder(f)}
                          >
                            Удалить
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className={styles["docs__pager"]}>
                    <button
                      className={styles["btn"]}
                      disabled={!foldPrev || foldLoading}
                      onClick={() => loadFolders(foldPrev)}
                    >
                      ← Назад
                    </button>
                    <button
                      className={styles["btn"]}
                      disabled={!foldNext || foldLoading}
                      onClick={() => loadFolders(foldNext)}
                    >
                      Вперёд →
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* Viewer */}
            <section className={styles["docs__viewer"]}>
              {!selectedFolderId ? (
                <div className={styles["docs__placeholder"]}>
                  Выберите папку
                </div>
              ) : folderDetailLoading ? (
                <div className={styles["docs__placeholder"]}>Загрузка…</div>
              ) : !folderDetail ? (
                <div className={styles["docs__placeholder"]}>
                  Данные недоступны
                </div>
              ) : (
                <div className={styles["docs__previewWrap"]}>
                  <div className={styles["docs__previewHeader"]}>
                    <div className={styles["docs__previewTitle"]}>
                      📁 {folderDetail.name || "Без названия"}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Create Folder Modal */}
          {createFolderOpen && (
            <div className={styles["docs__modalOverlay"]}>
              <div className={styles["docs__modal"]}>
                <div className={styles["docs__modalHeader"]}>
                  <div className={styles["docs__modalTitle"]}>Новая папка</div>
                  <button
                    className={styles["docs__iconBtn"]}
                    onClick={() => setCreateFolderOpen(false)}
                    aria-label="Закрыть"
                  >
                    ×
                  </button>
                </div>

                <form
                  className={styles["docs__form"]}
                  onSubmit={onCreateFolder}
                >
                  <div className={styles["docs__formGrid"]}>
                    <div className={styles["docs__field"]}>
                      <label className={styles["docs__label"]}>
                        Название <span className={styles["docs__req"]}>*</span>
                      </label>
                      <input
                        ref={nameRef}
                        className={styles["docs__input"]}
                        value={createFolderName}
                        onChange={(e) => setCreateFolderName(e.target.value)}
                        placeholder="Например: Договоры"
                        maxLength={255}
                        required
                      />
                    </div>
                  </div>

                  <div className={styles["docs__formActions"]}>
                    <button
                      type="button"
                      className={styles["btn"]}
                      onClick={() => setCreateFolderOpen(false)}
                      disabled={createFolderBusy}
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className={`${styles["btn"]} ${styles["btn--primary"]}`}
                      disabled={createFolderBusy || !createFolderName.trim()}
                    >
                      Создать
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Folder Modal */}
          {editFolderOpen && (
            <div className={styles["docs__modalOverlay"]}>
              <div className={styles["docs__modal"]}>
                <div className={styles["docs__modalHeader"]}>
                  <div className={styles["docs__modalTitle"]}>
                    Изменить папку
                  </div>
                  <button
                    className={styles["docs__iconBtn"]}
                    onClick={() => setEditFolderOpen(false)}
                    aria-label="Закрыть"
                  >
                    ×
                  </button>
                </div>

                <form className={styles["docs__form"]} onSubmit={onEditFolder}>
                  <div className={styles["docs__formGrid"]}>
                    <div className={styles["docs__field"]}>
                      <label className={styles["docs__label"]}>
                        Название <span className={styles["docs__req"]}>*</span>
                      </label>
                      <input
                        ref={nameRef}
                        className={styles["docs__input"]}
                        value={editFolderName}
                        onChange={(e) => setEditFolderName(e.target.value)}
                        placeholder="Например: Договоры"
                        maxLength={255}
                        required
                      />
                    </div>
                  </div>

                  <div className={styles["docs__formActions"]}>
                    <button
                      type="button"
                      className={styles["btn"]}
                      onClick={() => setEditFolderOpen(false)}
                      disabled={editFolderBusy}
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className={`${styles["btn"]} ${styles["btn--primary"]}`}
                      disabled={editFolderBusy || !editFolderName.trim()}
                    >
                      Сохранить
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== DOCUMENTS TAB ===== */}
      {tab === "docs" && (
        <>
          <div className={styles["docs__serverBar"]}>
            <div className={styles["docs__search"]}>
              <span className={styles["docs__searchIcon"]}>🔎</span>
              <input
                className={styles["docs__searchInput"]}
                placeholder="Поиск по документам…"
                value={docQ}
                onChange={(e) => setDocQ(e.target.value)}
              />
            </div>

            <div className={styles["docs__filter"]}>
              <label className={styles["docs__filterLabel"]}>Папка</label>
              <select
                className={styles["docs__select"]}
                value={docFolderFilter}
                onChange={(e) => setDocFolderFilter(e.target.value)}
              >
                <option value="">Все</option>
                {allFoldersForSelect.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name || "Без названия"}
                  </option>
                ))}
              </select>
            </div>

            {docErr ? (
              <span className={styles["docs__error"]}>{docErr}</span>
            ) : null}

            <div className={styles["docs__barActions"]}>
              <button
                className={styles["btn"]}
                disabled={docLoading}
                onClick={() => loadDocs()}
              >
                Обновить
              </button>
              <button
                className={`${styles["btn"]} ${styles["btn--primary"]}`}
                onClick={() => {
                  setCreateDocOpen(true);
                  setCreateDocFolder(docFolderFilter || selectedFolderId || "");
                  setCreateDocFile(null);
                  if (!allFoldersForSelect.length) fetchAllFoldersForSelect();
                }}
              >
                + Документ
              </button>
            </div>
          </div>

          <div className={styles["docs__grid"]}>
            {/* List */}
            <section className={styles["docs__list"]}>
              {docFiltered.length === 0 ? (
                <div className={styles["docs__empty"]}>
                  {docLoading ? "Загрузка…" : "Ничего не найдено"}
                </div>
              ) : (
                <>
                  <ul className={styles["docs__cards"]}>
                    {docFiltered.map((d) => {
                      const fileName = (d.file || "").split("/").pop() || "";
                      const mime = guessMime(d.file);
                      return (
                        <li
                          key={d.id}
                          className={`${styles["docs__card"]} ${
                            d.id === selectedDocId
                              ? styles["docs__card--active"]
                              : ""
                          }`}
                          onDoubleClick={() => onSelectDoc(d)}
                        >
                          <div className={styles["docs__cardMain"]}>
                            <div className={styles["docs__name"]}>
                              <span className={styles["docs__emoji"]}>
                                {fileEmoji(mime, d.file)}
                              </span>
                              {d.name || "Без названия"}
                            </div>

                            <div className={styles["docs__meta"]}>
                              <span
                                className={styles["docs__filename"]}
                                title={fileName}
                              >
                                {fileName || "—"}
                              </span>
                              <span>•</span>
                              <span>{d.folder_name || "—"}</span>
                            </div>

                            <div className={styles["docs__meta"]}>
                              <span>Создан: {fmtISO(d.created_at)}</span>
                              <span>•</span>
                              <span>Изменён: {fmtISO(d.updated_at)}</span>
                            </div>
                          </div>

                          <div className={styles["docs__cardActions"]}>
                            <button
                              className={`${styles["btn"]} ${styles["btn--secondary"]}`}
                              onClick={() => onSelectDoc(d)}
                            >
                              Открыть
                            </button>
                            <button
                              className={styles["btn"]}
                              onClick={() => openEditDoc(d)}
                            >
                              Изменить
                            </button>
                            <button
                              className={`${styles["btn"]} ${styles["btn--danger"]}`}
                              onClick={() => onDeleteDoc(d)}
                            >
                              Удалить
                            </button>
                            {d.file ? (
                              <a
                                className={`${styles["btn"]} ${styles["btn--secondary"]}`}
                                href={d.file}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Скачать
                              </a>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className={styles["docs__pager"]}>
                    <button
                      className={styles["btn"]}
                      disabled={!docPrev || docLoading}
                      onClick={() => loadDocs(docPrev)}
                    >
                      ← Назад
                    </button>
                    <button
                      className={styles["btn"]}
                      disabled={!docNext || docLoading}
                      onClick={() => loadDocs(docNext)}
                    >
                      Вперёд →
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* Viewer */}
            <section className={styles["docs__viewer"]}>
              {!currentDoc ? (
                <div className={styles["docs__placeholder"]}>
                  Выберите документ
                </div>
              ) : docViewerUrl ? (
                <Preview
                  url={docViewerUrl}
                  name={currentDoc.name}
                  folderName={currentDoc.folder_name}
                />
              ) : (
                <div className={styles["docs__placeholder"]}>
                  Файл не прикреплён
                </div>
              )}
            </section>
          </div>

          {/* Create Document Modal */}
          {createDocOpen && (
            <div className={styles["docs__modalOverlay"]}>
              <div className={styles["docs__modal"]}>
                <div className={styles["docs__modalHeader"]}>
                  <div className={styles["docs__modalTitle"]}>
                    Новый документ
                  </div>
                  <button
                    className={styles["docs__iconBtn"]}
                    onClick={() => setCreateDocOpen(false)}
                    aria-label="Закрыть"
                  >
                    ×
                  </button>
                </div>

                <form className={styles["docs__form"]} onSubmit={onCreateDoc}>
                  <div className={styles["docs__formGrid"]}>
                    <div className={styles["docs__field"]}>
                      <label className={styles["docs__label"]}>Название</label>
                      <input
                        className={styles["docs__input"]}
                        value={createDocName}
                        onChange={(e) => setCreateDocName(e.target.value)}
                        placeholder="Например: Договор №12"
                        maxLength={255}
                      />
                    </div>

                    <div className={styles["docs__field"]}>
                      <label className={styles["docs__label"]}>
                        Папка <span className={styles["docs__req"]}>*</span>
                      </label>
                      <select
                        className={styles["docs__select"]}
                        value={createDocFolder}
                        onChange={(e) => setCreateDocFolder(e.target.value)}
                        required
                      >
                        <option value="">Выберите папку</option>
                        {allFoldersForSelect.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name || "Без названия"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles["docs__field"]}>
                      <label className={styles["docs__label"]}>
                        Файл <span className={styles["docs__req"]}>*</span>
                      </label>
                      <input
                        className={styles["docs__input"]}
                        type="file"
                        onChange={(e) =>
                          setCreateDocFile(e.target.files?.[0] || null)
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className={styles["docs__formActions"]}>
                    <button
                      type="button"
                      className={styles["btn"]}
                      onClick={() => setCreateDocOpen(false)}
                      disabled={createDocBusy}
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className={`${styles["btn"]} ${styles["btn--primary"]}`}
                      disabled={
                        createDocBusy ||
                        !createDocFolder.trim() ||
                        !createDocFile
                      }
                    >
                      Создать
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Document Modal */}
          {editDocOpen && (
            <div className={styles["docs__modalOverlay"]}>
              <div className={styles["docs__modal"]}>
                <div className={styles["docs__modalHeader"]}>
                  <div className={styles["docs__modalTitle"]}>
                    Изменить документ
                  </div>
                  <button
                    className={styles["docs__iconBtn"]}
                    onClick={() => setEditDocOpen(false)}
                    aria-label="Закрыть"
                  >
                    ×
                  </button>
                </div>

                <form
                  className={styles["docs__form"]}
                  onSubmit={onEditDocSubmit}
                >
                  <div className={styles["docs__formGrid"]}>
                    <div className={styles["docs__field"]}>
                      <label className={styles["docs__label"]}>Название</label>
                      <input
                        className={styles["docs__input"]}
                        value={editDocName}
                        onChange={(e) => setEditDocName(e.target.value)}
                        placeholder="Например: Договор №12"
                        maxLength={255}
                      />
                    </div>

                    <div className={styles["docs__field"]}>
                      <label className={styles["docs__label"]}>
                        Папка <span className={styles["docs__req"]}>*</span>
                      </label>
                      <select
                        className={styles["docs__select"]}
                        value={editDocFolder}
                        onChange={(e) => setEditDocFolder(e.target.value)}
                        required
                      >
                        <option value="">Выберите папку</option>
                        {allFoldersForSelect.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name || "Без названия"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles["docs__field"]}>
                      <label className={styles["docs__label"]}>
                        Заменить файл (необязательно)
                      </label>
                      <input
                        className={styles["docs__input"]}
                        type="file"
                        onChange={(e) =>
                          setEditDocFile(e.target.files?.[0] || null)
                        }
                      />
                    </div>
                  </div>

                  <div className={styles["docs__formActions"]}>
                    <button
                      type="button"
                      className={styles["btn"]}
                      onClick={() => setEditDocOpen(false)}
                      disabled={editDocBusy}
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className={`${styles["btn"]} ${styles["btn--primary"]}`}
                      disabled={editDocBusy || !editDocFolder.trim()}
                    >
                      Сохранить
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ===== file preview ===== */
function Preview({ url, name, folderName }) {
  const mime = guessMime(url);
  const isImg = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";

  return (
    <div className={styles["docs__previewWrap"]}>
      <div className={styles["docs__previewHeader"]}>
        <div className={styles["docs__previewTitle"]}>
          {name || "Без названия"}
        </div>
        <div className={styles["docs__previewSub"]}>
          {folderName || "—"} • {mime || "—"}
        </div>
      </div>

      {isImg ? (
        <img src={url} alt="" className={styles["docs__previewMedia"]} />
      ) : isPdf ? (
        <iframe
          src={url}
          title="preview"
          className={styles["docs__previewFrame"]}
        />
      ) : url ? (
        <div className={styles["docs__placeholder"]}>
          Предпросмотр недоступен.{" "}
          <a href={url} target="_blank" rel="noreferrer">
            Открыть в новой вкладке
          </a>
        </div>
      ) : (
        <div className={styles["docs__placeholder"]}>
          Нет файла для предпросмотра
        </div>
      )}
    </div>
  );
}

export default BuildingDocuments;
