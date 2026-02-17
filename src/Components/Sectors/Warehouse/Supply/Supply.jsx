import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaTruck,
  FaPlus,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import warehouseAPI from "../../../../api/warehouse";
import "./Supply.scss";

const PER_PAGE = 15;

const fmtDate = (v) => {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("ru-RU");
  } catch {
    return String(v);
  }
};

const statusLabel = (s) =>
  s === "POSTED" ? "Проведён" : s === "DRAFT" ? "Черновик" : s ?? "—";

const WarehouseSupply = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const [suppliers, setSuppliers] = useState([]);
  const [purchaseDocs, setPurchaseDocs] = useState([]);
  const [returnDocs, setReturnDocs] = useState([]);
  const [loadingSup, setLoadingSup] = useState(true);
  const [loadingPo, setLoadingPo] = useState(true);
  const [loadingRt, setLoadingRt] = useState(true);

  const [pageSup, setPageSup] = useState(1);
  const [pagePO, setPagePO] = useState(1);
  const [pageRT, setPageRT] = useState(1);

  const [openSup, setOpenSup] = useState(false);
  const [supName, setSupName] = useState("");
  const [supError, setSupError] = useState("");
  const [savingSup, setSavingSup] = useState(false);

  const loadCounterparties = useCallback(async () => {
    setLoadingSup(true);
    try {
      const [dataSup, dataBoth] = await Promise.all([
        warehouseAPI.listCounterparties({ type: "SUPPLIER", page_size: 500 }),
        warehouseAPI.listCounterparties({ type: "BOTH", page_size: 500 }),
      ]);
      const listSup = dataSup?.results ?? (Array.isArray(dataSup) ? dataSup : []);
      const listBoth = dataBoth?.results ?? (Array.isArray(dataBoth) ? dataBoth : []);
      const ids = new Set((listSup || []).map((c) => c.id));
      const added = (listBoth || []).filter((c) => !ids.has(c.id));
      setSuppliers([...(listSup || []), ...added]);
    } catch {
      setSuppliers([]);
    } finally {
      setLoadingSup(false);
    }
  }, []);

  const loadPurchase = useCallback(async () => {
    setLoadingPo(true);
    try {
      const data = await warehouseAPI.listPurchaseDocuments({ page_size: 200 });
      const list = data?.results ?? (Array.isArray(data) ? data : []);
      setPurchaseDocs(list);
    } catch {
      setPurchaseDocs([]);
    } finally {
      setLoadingPo(false);
    }
  }, []);

  const loadReturns = useCallback(async () => {
    setLoadingRt(true);
    try {
      const data = await warehouseAPI.listPurchaseReturnDocuments({
        page_size: 200,
      });
      const list = data?.results ?? (Array.isArray(data) ? data : []);
      setReturnDocs(list);
    } catch {
      setReturnDocs([]);
    } finally {
      setLoadingRt(false);
    }
  }, []);

  useEffect(() => {
    loadCounterparties();
  }, [loadCounterparties]);
  useEffect(() => {
    loadPurchase();
  }, [loadPurchase]);
  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  const safeIncludes = (str = "", needle = "") =>
    (str + "").toLowerCase().includes((needle + "").toLowerCase());

  const filteredSuppliers = useMemo(
    () =>
      (suppliers || []).filter(
        (s) =>
          safeIncludes(s?.name, q) ||
          safeIncludes(s?.type, q)
      ),
    [suppliers, q]
  );
  const filteredOrders = useMemo(
    () =>
      (purchaseDocs || []).filter(
        (o) =>
          safeIncludes(o?.counterparty_display_name, q) ||
          safeIncludes(o?.number, q) ||
          safeIncludes(o?.comment, q) ||
          safeIncludes(statusLabel(o?.status), q)
      ),
    [purchaseDocs, q]
  );
  const filteredReturns = useMemo(
    () =>
      (returnDocs || []).filter(
        (r) =>
          safeIncludes(r?.counterparty_display_name, q) ||
          safeIncludes(r?.number, q) ||
          safeIncludes(r?.comment, q)
      ),
    [returnDocs, q]
  );

  const totalPagesSup = Math.max(1, Math.ceil(filteredSuppliers.length / PER_PAGE));
  const totalPagesPO = Math.max(1, Math.ceil(filteredOrders.length / PER_PAGE));
  const totalPagesRT = Math.max(1, Math.ceil(filteredReturns.length / PER_PAGE));
  const pageDataSup = filteredSuppliers.slice(
    (pageSup - 1) * PER_PAGE,
    pageSup * PER_PAGE
  );
  const pageDataPO = filteredOrders.slice(
    (pagePO - 1) * PER_PAGE,
    pagePO * PER_PAGE
  );
  const pageDataRT = filteredReturns.slice(
    (pageRT - 1) * PER_PAGE,
    pageRT * PER_PAGE
  );

  const openSupModal = () => {
    setSupName("");
    setSupError("");
    setOpenSup(true);
  };

  const saveSupplier = async () => {
    const name = supName?.trim();
    if (!name) {
      setSupError("Укажите название.");
      return;
    }
    setSavingSup(true);
    setSupError("");
    try {
      await warehouseAPI.createCounterparty({
        name,
        type: "SUPPLIER",
      });
      setOpenSup(false);
      loadCounterparties();
    } catch (err) {
      const msg =
        err?.detail ||
        err?.message ||
        (typeof err === "string" ? err : "Ошибка при создании поставщика");
      setSupError(msg);
    } finally {
      setSavingSup(false);
    }
  };

  const goToCreatePurchase = () =>
    navigate("/crm/warehouse/documents/create?doc_type=PURCHASE");
  const goToCreateReturn = () =>
    navigate("/crm/warehouse/documents/create?doc_type=PURCHASE_RETURN");

  return (
    <div className="sklad-supply" role="region" aria-label="Поставки">
      <div className="sklad-supply__header">
        <div className="sklad-supply__titleWrap">
          <h2 className="sklad-supply__title">
            <FaTruck aria-hidden /> Поставки
          </h2>
          <div className="sklad-supply__subtitle">
            Поставщики, документы покупки и возвраты поставщику
          </div>
        </div>

        <div className="sklad-supply__actions">
          <div className="sklad-supply__search">
            <input
              className="sklad-supply__searchInput"
              type="text"
              placeholder="Поиск…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPageSup(1);
                setPagePO(1);
                setPageRT(1);
              }}
              aria-label="Поиск"
            />
          </div>

          {(
            <button
              className="sklad-supply__btn sklad-supply__btn--primary"
              type="button"
              onClick={openSupModal}
            >
              <FaPlus aria-hidden />
              <span className="sklad-supply__btnText">Новый поставщик</span>
            </button>
          )}
        </div>
      </div>

      <div className="sklad-supply__tabs" role="tablist" aria-label="Разделы">
        <button
          role="tab"
          aria-selected={true}
          className="sklad-supply__tab is-active"
          type="button"
        >
          Поставщики
        </button>
      </div>

      <div className="sklad-supply__table sklad-supply__table--sup">
        <table className="sklad-supply-table">
          <thead>
            <tr>
              <th className="sklad-supply__th">Название</th>
              <th className="sklad-supply__th">Тип</th>
              <th className="sklad-supply__th">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loadingSup ? (
              <tr>
                <td colSpan={3} className="sklad-supply__empty">Загрузка…</td>
              </tr>
            ) : !pageDataSup.length ? (
              <tr>
                <td colSpan={3} className="sklad-supply__empty">Нет поставщиков.</td>
              </tr>
            ) : (
              pageDataSup.map((s) => (
                <tr key={s.id} className="sklad-supply__trow">
                  <td className="sklad-supply__td" data-label="Название">{s.name ?? "—"}</td>
                  <td className="sklad-supply__td" data-label="Тип">{s.type ?? "—"}</td>
                  <td className="sklad-supply__td sklad-supply__td--actions">
                    <button
                      className="sklad-supply__btn sklad-supply__btn--secondary"
                      type="button"
                      onClick={() => navigate(`/crm/warehouse/counterparties/${s.id}`)}
                    >
                      Открыть
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loadingSup && filteredSuppliers.length > PER_PAGE && (
          <div className="sklad-supply__pager">
            <button
              className="sklad-supply__pageBtn"
              type="button"
              onClick={() => setPageSup((p) => Math.max(1, p - 1))}
              disabled={pageSup === 1}
            >
              <FaChevronLeft />
            </button>
            <span className="sklad-supply__pageInfo">
              {pageSup} / {totalPagesSup}
            </span>
            <button
              className="sklad-supply__pageBtn"
              type="button"
              onClick={() => setPageSup((p) => Math.min(totalPagesSup, p + 1))}
              disabled={pageSup === totalPagesSup}
            >
              <FaChevronRight />
            </button>
          </div>
        )}
      </div>

      <div className="sklad-supply__section">
        <h3 className="sklad-supply__sectionTitle">Покупка (документы)</h3>
        <button
          className="sklad-supply__btn sklad-supply__btn--primary"
          type="button"
          onClick={goToCreatePurchase}
        >
          <FaPlus aria-hidden />
          Новый документ покупки
        </button>
      </div>

      <div className="sklad-supply__table sklad-supply__table--po">
        <table className="sklad-supply-table">
          <thead>
            <tr>
              <th className="sklad-supply__th">Номер</th>
              <th className="sklad-supply__th">Дата</th>
              <th className="sklad-supply__th">Поставщик</th>
              <th className="sklad-supply__th">Сумма</th>
              <th className="sklad-supply__th">Статус</th>
            </tr>
          </thead>
          <tbody>
            {loadingPo ? (
              <tr>
                <td colSpan={5} className="sklad-supply__empty">Загрузка…</td>
              </tr>
            ) : !pageDataPO.length ? (
              <tr>
                <td colSpan={5} className="sklad-supply__empty">Нет документов покупки.</td>
              </tr>
            ) : (
              pageDataPO.map((o) => (
                <tr key={o.id} className="sklad-supply__trow">
                  <td className="sklad-supply__td" data-label="Номер">{o.number ?? "—"}</td>
                  <td className="sklad-supply__td sklad-supply__nowrap" data-label="Дата">{fmtDate(o.date)}</td>
                  <td className="sklad-supply__td" data-label="Поставщик">{o.counterparty_display_name ?? "—"}</td>
                  <td className="sklad-supply__td" data-label="Сумма">
                    {o.total != null ? Number(o.total).toLocaleString("ru-RU") : "—"}
                  </td>
                  <td className="sklad-supply__td" data-label="Статус">{statusLabel(o.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loadingPo && filteredOrders.length > PER_PAGE && (
          <div className="sklad-supply__pager">
            <button
              className="sklad-supply__pageBtn"
              type="button"
              onClick={() => setPagePO((p) => Math.max(1, p - 1))}
              disabled={pagePO === 1}
            >
              <FaChevronLeft />
            </button>
            <span className="sklad-supply__pageInfo">
              {pagePO} / {totalPagesPO}
            </span>
            <button
              className="sklad-supply__pageBtn"
              type="button"
              onClick={() => setPagePO((p) => Math.min(totalPagesPO, p + 1))}
              disabled={pagePO === totalPagesPO}
            >
              <FaChevronRight />
            </button>
          </div>
        )}
      </div>

      <div className="sklad-supply__section">
        <h3 className="sklad-supply__sectionTitle">Возвраты поставщику</h3>
        <button
          className="sklad-supply__btn sklad-supply__btn--primary"
          type="button"
          onClick={goToCreateReturn}
        >
          <FaPlus aria-hidden />
          Новый возврат поставщику
        </button>
      </div>

      <div className="sklad-supply__table sklad-supply__table--rt">
        <table className="sklad-supply-table">
          <thead>
            <tr>
              <th className="sklad-supply__th">Номер</th>
              <th className="sklad-supply__th">Дата</th>
              <th className="sklad-supply__th">Поставщик</th>
              <th className="sklad-supply__th">Комментарий</th>
              <th className="sklad-supply__th">Статус</th>
            </tr>
          </thead>
          <tbody>
            {loadingRt ? (
              <tr>
                <td colSpan={5} className="sklad-supply__empty">Загрузка…</td>
              </tr>
            ) : !pageDataRT.length ? (
              <tr>
                <td colSpan={5} className="sklad-supply__empty">Нет возвратов.</td>
              </tr>
            ) : (
              pageDataRT.map((r) => (
                <tr key={r.id} className="sklad-supply__trow">
                  <td className="sklad-supply__td" data-label="Номер">{r.number ?? "—"}</td>
                  <td className="sklad-supply__td sklad-supply__nowrap" data-label="Дата">{fmtDate(r.date)}</td>
                  <td className="sklad-supply__td" data-label="Поставщик">{r.counterparty_display_name ?? "—"}</td>
                  <td className="sklad-supply__td" data-label="Комментарий">{r.comment ?? "—"}</td>
                  <td className="sklad-supply__td" data-label="Статус">{statusLabel(r.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loadingRt && filteredReturns.length > PER_PAGE && (
          <div className="sklad-supply__pager">
            <button
              className="sklad-supply__pageBtn"
              type="button"
              onClick={() => setPageRT((p) => Math.max(1, p - 1))}
              disabled={pageRT === 1}
            >
              <FaChevronLeft />
            </button>
            <span className="sklad-supply__pageInfo">
              {pageRT} / {totalPagesRT}
            </span>
            <button
              className="sklad-supply__pageBtn"
              type="button"
              onClick={() => setPageRT((p) => Math.min(totalPagesRT, p + 1))}
              disabled={pageRT === totalPagesRT}
            >
              <FaChevronRight />
            </button>
          </div>
        )}
      </div>

      {openSup && (
        <>
          <button
            className="sklad-supply__overlay"
            onClick={() => setOpenSup(false)}
            aria-label="Закрыть"
          />
          <div
            className="sklad-supply__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sup-title"
          >
            <div className="sklad-supply__modalHeader">
              <h3 id="sup-title" className="sklad-supply__modalTitle">
                Новый поставщик
              </h3>
              <button
                className="sklad-supply__iconBtn"
                type="button"
                onClick={() => setOpenSup(false)}
                aria-label="Закрыть"
              >
                <FaTimes />
              </button>
            </div>

            {supError && (
              <div className="sklad-supply__alert sklad-supply__alert--inModal">
                {supError}
              </div>
            )}

            <div className="sklad-supply__form">
              <div className="sklad-supply__grid">
                <div className="sklad-supply__field sklad-supply__field--full">
                  <label className="sklad-supply__label" htmlFor="sup-name">
                    Название <span className="sklad-supply__req">*</span>
                  </label>
                  <input
                    id="sup-name"
                    className="sklad-supply__input"
                    type="text"
                    value={supName}
                    onChange={(e) => setSupName(e.target.value)}
                    placeholder="Например: ООО «Альфа»"
                  />
                </div>
              </div>

              <div className="sklad-supply__footer">
                <div className="sklad-supply__spacer" />
                <button
                  className="sklad-supply__btn"
                  type="button"
                  onClick={() => setOpenSup(false)}
                >
                  Отмена
                </button>
                <button
                  className="sklad-supply__btn sklad-supply__btn--primary"
                  type="button"
                  onClick={saveSupplier}
                  disabled={savingSup}
                >
                  {savingSup ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WarehouseSupply;
