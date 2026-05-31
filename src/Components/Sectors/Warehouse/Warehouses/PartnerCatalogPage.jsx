import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Package,
  RefreshCw,
  Search,
} from "lucide-react";
import WarehouseHeader from "./components/WarehouseHeader";
import StockPartnershipTransferModal from "./components/StockPartnershipTransferModal";
import {
  extractPartnershipError,
  filterProducts,
  getProductQty,
  mapOwnProductRow,
  normalizeList,
  warehouseLabel,
} from "./partnership/partnershipHelpers";
import {
  getStockPartnerCatalog,
  listWarehouseProducts,
} from "../../../../api/warehouse";
import { fetchWarehousesAsync } from "../../../../store/creators/warehouseCreators";
import "./PartnerCatalogPage.scss";
import "./Warehouses.scss";

const DIRECTION = {
  RECEIVE: "receive",
  SEND: "send",
};

const PartnerCatalogPage = () => {
  const { partnerId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  const direction =
    searchParams.get("direction") === DIRECTION.SEND
      ? DIRECTION.SEND
      : DIRECTION.RECEIVE;

  const ownWarehouses = useSelector((state) => state.warehouse.list || []);
  const ownProductsCacheRef = useRef({});

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [catalogData, setCatalogData] = useState(null);
  const [productSearch, setProductSearch] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [ownProductsByWarehouse, setOwnProductsByWarehouse] = useState({});
  const [ownProductsLoading, setOwnProductsLoading] = useState({});

  const [transferState, setTransferState] = useState({
    open: false,
    mode: DIRECTION.RECEIVE,
    product: null,
    warehouseFromId: null,
  });

  const partnerName =
    catalogData?.partner_company?.name || "Партнёр";

  const isReceive = direction === DIRECTION.RECEIVE;

  const partnerWarehouses = catalogData?.warehouses || [];

  const activeWarehouses = useMemo(() => {
    if (isReceive) return partnerWarehouses;
    return ownWarehouses;
  }, [isReceive, partnerWarehouses, ownWarehouses]);

  const loadCatalog = useCallback(async () => {
    if (!partnerId) return;
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const data = await getStockPartnerCatalog(partnerId);
      setCatalogData(data);
    } catch (e) {
      console.error(e);
      setCatalogError(extractPartnershipError(e));
      setCatalogData(null);
    } finally {
      setCatalogLoading(false);
    }
  }, [partnerId]);

  const loadOwnWarehouseProducts = useCallback(async (warehouseId, force = false) => {
    if (!warehouseId) return;
    if (!force && ownProductsCacheRef.current[warehouseId]) return;
    setOwnProductsLoading((prev) => ({ ...prev, [warehouseId]: true }));
    try {
      const data = await listWarehouseProducts(warehouseId, { page_size: 500 });
      const list = normalizeList(data).map(mapOwnProductRow);
      ownProductsCacheRef.current[warehouseId] = true;
      setOwnProductsByWarehouse((prev) => ({ ...prev, [warehouseId]: list }));
    } catch (e) {
      console.error(e);
      setOwnProductsByWarehouse((prev) => ({ ...prev, [warehouseId]: [] }));
    } finally {
      setOwnProductsLoading((prev) => ({ ...prev, [warehouseId]: false }));
    }
  }, []);

  useEffect(() => {
    dispatch(fetchWarehousesAsync({ page_size: 1000 }));
    loadCatalog();
  }, [dispatch, loadCatalog]);

  useEffect(() => {
    setProductSearch("");
    setSelectedWarehouseId("");
    ownProductsCacheRef.current = {};
    setOwnProductsByWarehouse({});
    setOwnProductsLoading({});
  }, [direction, partnerId]);

  useEffect(() => {
    if (!selectedWarehouseId && activeWarehouses.length > 0) {
      setSelectedWarehouseId(String(activeWarehouses[0].id));
    }
  }, [activeWarehouses, selectedWarehouseId]);

  useEffect(() => {
    if (!isReceive && selectedWarehouseId) {
      loadOwnWarehouseProducts(selectedWarehouseId);
    }
  }, [isReceive, selectedWarehouseId, loadOwnWarehouseProducts]);

  const setDirection = (next) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === DIRECTION.SEND) {
          params.set("direction", DIRECTION.SEND);
        } else {
          params.delete("direction");
        }
        return params;
      },
      { replace: true },
    );
  };

  const productsForSelectedWarehouse = useMemo(() => {
    if (!selectedWarehouseId) return [];
    if (isReceive) {
      const wh = partnerWarehouses.find(
        (w) => String(w.id) === String(selectedWarehouseId),
      );
      return wh?.products || [];
    }
    return ownProductsByWarehouse[selectedWarehouseId] || [];
  }, [
    isReceive,
    selectedWarehouseId,
    partnerWarehouses,
    ownProductsByWarehouse,
  ]);

  const visibleProducts = useMemo(
    () => filterProducts(productsForSelectedWarehouse, productSearch),
    [productsForSelectedWarehouse, productSearch],
  );

  const productsLoading =
    !isReceive && !!selectedWarehouseId && ownProductsLoading[selectedWarehouseId];

  const openTransfer = (mode, product, warehouseFromId) => {
    setTransferState({ open: true, mode, product, warehouseFromId });
  };

  const closeTransfer = () => {
    setTransferState({
      open: false,
      mode: DIRECTION.RECEIVE,
      product: null,
      warehouseFromId: null,
    });
  };

  const handleTransferred = async (mode, warehouseFromId) => {
    await loadCatalog();
    if (mode === DIRECTION.SEND && warehouseFromId) {
      delete ownProductsCacheRef.current[warehouseFromId];
      await loadOwnWarehouseProducts(warehouseFromId, true);
    }
  };

  const handleBack = () => {
    navigate("/crm/warehouse/warehouses?tab=partnerships");
  };

  const renderProductsTable = () => {
    if (catalogLoading || productsLoading) {
      return (
        <div className="partner-catalog-empty">Загрузка товаров…</div>
      );
    }

    if (activeWarehouses.length === 0) {
      return (
        <div className="partner-catalog-empty">
          {isReceive
            ? "У партнёра нет складов для обмена"
            : "У вас нет складов — создайте склад на вкладке «Склады»"}
        </div>
      );
    }

    if (!isReceive && partnerWarehouses.length === 0) {
      return (
        <div className="partner-catalog-empty">
          У партнёра нет складов для приёма товара
        </div>
      );
    }

    if (visibleProducts.length === 0) {
      return (
        <div className="partner-catalog-empty">
          {productSearch.trim()
            ? "Ничего не найдено по запросу"
            : "На выбранном складе нет товаров"}
        </div>
      );
    }

    return (
      <div className="warehouse-table-container w-full partner-catalog-products">
        <div className="warehouse-table-scroll warehouse-table-scroll--catalog">
          <table className="warehouse-table warehouse-partnership-products">
            <thead>
              <tr>
                <th>Товар</th>
                <th>Артикул</th>
                <th>Остаток</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((p) => {
                const qty = getProductQty(p);
                const canTransfer = qty > 0;
                return (
                  <tr key={p.id}>
                    <td className="warehouse-table__name">{p.name}</td>
                    <td>{p.article || "—"}</td>
                    <td>
                      {qty} {p.unit || ""}
                    </td>
                    <td>
                      {isReceive ? (
            <button
              type="button"
              className="warehouse-table__action-btn warehouse-table__action-btn--receive"
              disabled={!canTransfer}
              onClick={() =>
                openTransfer(
                  DIRECTION.RECEIVE,
                  p,
                  selectedWarehouseId,
                )
              }
            >
              Забрать к себе
            </button>
                      ) : (
                        <button
                          type="button"
                          className="warehouse-table__action-btn warehouse-table__action-btn--send"
                          disabled={!canTransfer}
                          onClick={() =>
                            openTransfer(
                              DIRECTION.SEND,
                              p,
                              selectedWarehouseId,
                            )
                          }
                        >
                          Отправить партнёру
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="warehouse-page partner-catalog-page">
      <WarehouseHeader
        onBack={handleBack}
        title={`Обмен с «${partnerName}»`}
        subtitle="Межкомпанейное перемещение товаров между вашими складами"
      />

      {catalogError && (
        <div className="warehouse-partnership-error">{catalogError}</div>
      )}

      <div className="partner-catalog-direction">
        <button
          type="button"
          className={`partner-catalog-direction-card ${isReceive ? "active" : ""}`}
          onClick={() => setDirection(DIRECTION.RECEIVE)}
        >
          <span className="partner-catalog-direction-card__icon">
            <ArrowDownLeft size={22} />
          </span>
          <span className="partner-catalog-direction-card__title">
            Забрать у партнёра
          </span>
          <span className="partner-catalog-direction-card__desc">
            Выберите товар со склада партнёра — он поступит на ваш склад
          </span>
          <span className="partner-catalog-direction-card__flow">
            <span className="partner-catalog-direction-card__flow-badge">
              {partnerName}
            </span>
            <ArrowRight size={16} />
            <span className="partner-catalog-direction-card__flow-badge">
              Ваша компания
            </span>
          </span>
        </button>

        <button
          type="button"
          className={`partner-catalog-direction-card partner-catalog-direction-card--send ${!isReceive ? "active" : ""}`}
          onClick={() => setDirection(DIRECTION.SEND)}
        >
          <span className="partner-catalog-direction-card__icon">
            <ArrowUpRight size={22} />
          </span>
          <span className="partner-catalog-direction-card__title">
            Отдать партнёру
          </span>
          <span className="partner-catalog-direction-card__desc">
            Выберите товар со своего склада — он поступит на склад партнёра
          </span>
          <span className="partner-catalog-direction-card__flow">
            <span className="partner-catalog-direction-card__flow-badge">
              Ваша компания
            </span>
            <ArrowRight size={16} />
            <span className="partner-catalog-direction-card__flow-badge">
              {partnerName}
            </span>
          </span>
        </button>
      </div>

      <div className="partner-catalog-steps">
        {isReceive ? (
          <>
            <span>
              <strong>1.</strong> Выберите склад партнёра
            </span>
            <span>
              <strong>2.</strong> Найдите нужный товар
            </span>
            <span>
              <strong>3.</strong> Нажмите «Забрать к себе» и укажите свой склад
            </span>
          </>
        ) : (
          <>
            <span>
              <strong>1.</strong> Выберите свой склад
            </span>
            <span>
              <strong>2.</strong> Найдите товар для отправки
            </span>
            <span>
              <strong>3.</strong> Нажмите «Отправить партнёру» и выберите склад
              получателя
            </span>
          </>
        )}
      </div>

      <div className="partner-catalog-toolbar">
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search
            size={18}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#9ca3af",
            }}
          />
          <input
            className="partner-catalog-toolbar__search"
            style={{ paddingLeft: 40, width: "100%" }}
            placeholder="Поиск по названию или артикулу…"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="partner-catalog-toolbar__refresh"
          onClick={() => {
            loadCatalog();
            if (!isReceive && selectedWarehouseId) {
              delete ownProductsCacheRef.current[selectedWarehouseId];
              loadOwnWarehouseProducts(selectedWarehouseId, true);
            }
          }}
          disabled={catalogLoading}
          aria-label="Обновить"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {activeWarehouses.length > 0 && (
        <div className="partner-catalog-warehouses">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#6b7280",
              marginRight: 4,
            }}
          >
            <Building2 size={16} />
            {isReceive ? "Склады партнёра:" : "Ваши склады:"}
          </span>
          {activeWarehouses.map((wh) => (
            <button
              key={wh.id}
              type="button"
              className={`partner-catalog-warehouse-chip ${!isReceive ? "partner-catalog-warehouse-chip--send" : ""} ${String(selectedWarehouseId) === String(wh.id) ? "active" : ""}`}
              onClick={() => setSelectedWarehouseId(String(wh.id))}
            >
              {warehouseLabel(wh)}
            </button>
          ))}
        </div>
      )}

      {!catalogLoading && activeWarehouses.length > 0 && (
        <p
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            color: "#6b7280",
            marginBottom: 12,
          }}
        >
          <Package size={16} />
          {visibleProducts.length}{" "}
          {visibleProducts.length === 1 ? "товар" : "товаров"}
          {productSearch.trim() ? " по запросу" : " на выбранном складе"}
        </p>
      )}

      {renderProductsTable()}

      <StockPartnershipTransferModal
        mode={transferState.mode}
        open={transferState.open}
        onClose={closeTransfer}
        product={transferState.product}
        warehouseFromId={transferState.warehouseFromId}
        partnerCompanyName={partnerName}
        targetWarehouses={
          transferState.mode === DIRECTION.SEND
            ? partnerWarehouses
            : ownWarehouses
        }
        onTransferred={handleTransferred}
      />
    </div>
  );
};

export default PartnerCatalogPage;
