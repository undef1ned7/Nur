import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { Check, Folder, FolderOpen, Plus, Trash2, X, Grip } from "lucide-react";
import "../Warehouses/Warehouses.scss";
import api from "../../../../api";
import AlertModal from "../../../common/AlertModal/AlertModal";
import WarehouseHeader from "../Warehouses/components/WarehouseHeader";
import SearchSection from "../../Market/Warehouse/components/SearchSection";
import FilterModal from "../../Market/Warehouse/components/FilterModal";
import BulkActionsBar from "../../Market/Warehouse/components/BulkActionsBar";
import ProductTable from "../../Market/Warehouse/components/ProductTable";
import ProductCards from "../../Market/Warehouse/components/ProductCards";
import Pagination from "../Warehouses/components/Pagination";
import {
  bulkDeleteProductsAsync,
  fetchProductsAsync,
} from "../../../../store/creators/productCreators";
import { useSearch } from "../Warehouses/hooks/useSearch";
import { usePagination } from "../Warehouses/hooks/usePagination";
import { useProductSelection } from "../../Market/Warehouse/hooks/useProductSelection";
import {
  useWarehouseData,
  useWarehouseReferences,
} from "../../Market/Warehouse/hooks/useWarehouseData";
import { STORAGE_KEY, VIEW_MODES } from "../../Market/Warehouse/constants";
import { formatDeleteMessage } from "../../Market/Warehouse/utils";
import "./StocksGroups.scss";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import { useAlert, useConfirm } from "../../../../hooks/useDialog";

const Stocks = () => {
  const dispatch = useDispatch();
  const confirm = useConfirm();
  const alert = useAlert()
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { warehouse_id: warehouseIdFromParams } = useParams();
  const warehouseId = warehouseIdFromParams || searchParams.get("warehouse_id");

  // Получаем название склада из Redux store
  const warehouseName = useSelector((state) => {
    const warehouse = state.warehouse.list.find(
      (w) => String(w.id) === String(warehouseId)
    );
    return warehouse ? warehouse.name : "";
  });

  // "Закрепляем" название, чтобы оно не исчезало при обновлениях стора
  const [resolvedWarehouseName, setResolvedWarehouseName] = useState("");

  useEffect(() => {
    if (warehouseName) {
      setResolvedWarehouseName(warehouseName);
    }
  }, [warehouseName]);

  // Если в store нет названия (например, после обновления/перезагрузки),
  // подгружаем детали склада по id и сохраняем локально.
  useEffect(() => {
    let cancelled = false;

    const loadWarehouseName = async () => {
      if (!warehouseId) return;
      if (resolvedWarehouseName) return;

      try {
        const { data } = await api.get(`/warehouse/${warehouseId}/`);
        const name = data?.name || data?.title || "";
        if (!cancelled && name) {
          setResolvedWarehouseName(name);
        }
      } catch (_) {
        // не блокируем UI
      }
    };

    loadWarehouseName();

    return () => {
      cancelled = true;
    };
  }, [warehouseId, resolvedWarehouseName]);

  // Состояние фильтров и модальных окон
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({});
  const [selectedGroupId, setSelectedGroupId] = useState("all"); // all | uuid
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState(() => new Set(["root"]));
  const [dragOverGroupId, setDragOverGroupId] = useState(null);

  // undefined = закрыто, null = корень, string = uuid родителя
  const [inlineCreateParentId, setInlineCreateParentId] = useState(undefined);
  const [inlineCreateName, setInlineCreateName] = useState("");
  const [showGroups, setShowGroups] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.matchMedia("(max-width: 1024px)").matches;
  });
  const [moveTargetGroupId, setMoveTargetGroupId] = useState(""); // "" | "none" | uuid
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
    const isSmall = window.matchMedia("(max-width: 1199px)").matches;
    return isSmall ? VIEW_MODES.CARDS : VIEW_MODES.TABLE;
  });

  // Хуки для управления данными
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useSearch();

  // Загрузка справочников
  const { brands, categories } = useWarehouseReferences();

  // Получаем текущую страницу из URL
  const currentPageFromUrl = useMemo(
    () => parseInt(searchParams.get("page") || "1", 10),
    [searchParams]
  );

  // Параметры запроса
  const requestParams = useMemo(() => {
    const params = {
      page: currentPageFromUrl,
      ...filters,
    };
    if (warehouseId) {
      params.warehouse = warehouseId;
    }
    if (selectedGroupId && selectedGroupId !== "all") {
      params.product_group = selectedGroupId;
    }
    if (debouncedSearchTerm?.trim()) {
      params.search = debouncedSearchTerm.trim();
    }
    return params;
  }, [
    currentPageFromUrl,
    filters,
    debouncedSearchTerm,
    warehouseId,
    selectedGroupId,
  ]);

  // Загрузка товаров
  const { products, loading, count, next, previous } =
    useWarehouseData(requestParams);

  // Хук для пагинации с реальными данными
  const {
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    getRowNumber,
    handlePageChange: handlePageChangeBase,
    resetToFirstPage,
  } = usePagination(count, next, previous);

  // Сброс на первую страницу при изменении поиска
  useEffect(() => {
    if (debouncedSearchTerm) {
      resetToFirstPage();
    }
  }, [debouncedSearchTerm, resetToFirstPage]);

  const loadGroups = useCallback(async () => {
    if (!warehouseId) return;
    setGroupsLoading(true);
    setGroupsError(null);
    try {
      const { data } = await api.get(`/warehouse/${warehouseId}/groups/`);
      const list = Array.isArray(data) ? data : data?.results || [];
      setGroups(list);
    } catch (e) {
      console.error("Ошибка при загрузке групп:", e);
      setGroupsError(e);
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Хук для выбора товаров
  const {
    selectedRows,
    isAllSelected,
    selectedCount,
    handleRowSelect,
    handleSelectAll,
    clearSelection,
    setSelectedRows,
  } = useProductSelection(products);

  // Сохранение режима просмотра
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  // Обработчики событий
  const handleProductClick = useCallback(
    (product) => {
      navigate(`/crm/warehouse/products/${product.id}`);
    },
    [navigate]
  );

  const handlePageChange = useCallback(
    (newPage) => {
      handlePageChangeBase(newPage, () => setSelectedRows(new Set()));
    },
    [handlePageChangeBase, setSelectedRows]
  );

  const handleBulkDelete = useCallback(() => {
    if (selectedCount === 0) return;
    setShowDeleteConfirmModal(true);
  }, [selectedCount]);

  const confirmBulkDelete = useCallback(async () => {
    setShowDeleteConfirmModal(false);
    setBulkDeleting(true);
    try {
      await dispatch(
        bulkDeleteProductsAsync({
          ids: Array.from(selectedRows),
          soft: true,
          require_all: false,
        })
      ).unwrap();

      setSelectedRows(new Set());
      // fetchProductsAsync сам выберет нужный эндпоинт (warehouse/{id}/products/),
      // если в requestParams есть warehouse
      dispatch(fetchProductsAsync(requestParams));
    } catch (e) {
      console.error("Ошибка при удалении товаров:", e);
      const errorMessage = validateResErrors(e, 'Не удалось удалить товары')
      alert(errorMessage, true);
    } finally {
      setBulkDeleting(false);
    }
  }, [dispatch, selectedRows, requestParams]);

  const handleApplyFilters = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({});
  }, []);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  const handleCreateProduct = useCallback(() => {
    if (warehouseId) {
      navigate(`/crm/warehouse/stocks/add-product?warehouse_id=${warehouseId}`);
    } else {
      navigate("/crm/warehouse/stocks/add-product");
    }
  }, [navigate, warehouseId]);

  const goBack = useCallback(() => {
    navigate("/crm/warehouse/warehouses");
  }, [navigate]);

  const groupsByParent = useMemo(() => {
    const map = new Map();
    (Array.isArray(groups) ? groups : []).forEach((g) => {
      const parent = g?.parent ?? null;
      const key = parent === null ? "root" : String(parent);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(g);
    });
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || ""))
      );
      map.set(k, arr);
    }
    return map;
  }, [groups]);

  const groupOptions = useMemo(() => {
    // плоский список для select (с отступами) в порядке дерева
    const out = [];
    const byParent = groupsByParent;
    const walk = (parentKey, depth) => {
      const list = byParent.get(parentKey) || [];
      list.forEach((g) => {
        const gid = g?.id ?? g?.uuid;
        if (!gid) return;
        const key = String(gid);
        const prefix = depth > 0 ? `${"—".repeat(depth)} ` : "";
        out.push({ value: key, label: `${prefix}${g?.name || "—"}` });
        walk(key, depth + 1);
      });
    };
    walk("root", 0);
    return out;
  }, [groupsByParent]);

  const toggleGroupExpand = useCallback((groupIdOrRoot) => {
    const key =
      groupIdOrRoot == null
        ? "root"
        : groupIdOrRoot === "root"
          ? "root"
          : String(groupIdOrRoot);
    setExpandedGroupIds((prev) => {
      const next = new Set(prev || []);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const createGroup = useCallback(async ({ name, parent }) => {
    if (!warehouseId) return;
    setGroupsError(null);
    try {
      await api.post(`/warehouse/${warehouseId}/groups/`, {
        name: String(name || "").trim(),
        warehouse: warehouseId,
        parent: parent || null,
      });
      await loadGroups();
    } catch (e) {
      console.error("Ошибка при создании группы:", e);
      setGroupsError(e);
    }
  }, [warehouseId, loadGroups]);

  const openInlineCreate = useCallback((parentIdOrNull) => {
    setInlineCreateParentId(parentIdOrNull);
    setInlineCreateName("");
    if (parentIdOrNull) {
      const key = String(parentIdOrNull);
      setExpandedGroupIds((prev) => {
        const next = new Set(prev || []);
        next.add(key);
        return next;
      });
    }
  }, []);

  const closeInlineCreate = useCallback(() => {
    setInlineCreateParentId(undefined);
    setInlineCreateName("");
  }, []);

  const submitInlineCreate = useCallback(async () => {
    const name = String(inlineCreateName || "").trim();
    if (!name) return;
    const parent =
      inlineCreateParentId === undefined ? null : inlineCreateParentId;
    await createGroup({ name, parent });
    closeInlineCreate();
  }, [inlineCreateName, inlineCreateParentId, createGroup, closeInlineCreate]);

  const deleteGroup = useCallback(
    async (groupId) => {
      if (!warehouseId || !groupId) return;
      confirm("Удалить группу?", async (ok) => {
        if (!ok) return;
        setGroupsError(null);
        try {
          await api.delete(`/warehouse/${warehouseId}/groups/${groupId}/`);
          setGroups(groups.filter((g) => g.id !== groupId));
        } catch (e) {
          console.error("Ошибка при удалении группы:", e);
          const errorMessage = validateResErrors(e, 'Не удалось удалить группу')
          alert(errorMessage, true);
        }
      }, true);
    },
    [warehouseId, selectedGroupId, resetToFirstPage, loadGroups, groups]
  );

  const refreshProducts = useCallback(() => {
    dispatch(fetchProductsAsync(requestParams));
  }, [dispatch, requestParams]);

  const moveProductsToGroup = useCallback(
    async (productIds, targetGroupIdOrNull) => {
      if (!Array.isArray(productIds) || productIds.length === 0) return;
      try {
        await Promise.all(
          productIds.map((pid) =>
            api.patch(`/warehouse/products/${pid}/`, {
              product_group: targetGroupIdOrNull || null,
            })
          )
        );
        clearSelection();
        await loadGroups(); // обновим products_count
        refreshProducts();
      } catch (e) {
        console.error("Ошибка при переносе товара в группу:", e);
        alert("Не удалось переместить товар в группу.");
      }
    },
    [clearSelection, loadGroups, refreshProducts]
  );

  const onProductDragStart = useCallback(
    (product, e) => {
      const pid = product?.id;
      if (!pid) return;
      const ids =
        selectedRows && selectedRows.size > 0 && selectedRows.has(pid)
          ? Array.from(selectedRows)
          : [pid];
      e.dataTransfer.setData(
        "application/x-warehouse-product-ids",
        JSON.stringify(ids)
      );
      e.dataTransfer.setData("text/plain", JSON.stringify(ids));
      e.dataTransfer.effectAllowed = "move";
    },
    [selectedRows]
  );

  const onGroupDrop = useCallback(
    async (e, targetGroupIdOrNull) => {
      e.preventDefault();
      setDragOverGroupId(null);
      let ids = [];
      try {
        const raw =
          e.dataTransfer.getData("application/x-warehouse-product-ids") ||
          e.dataTransfer.getData("text/plain");
        ids = JSON.parse(raw || "[]");
      } catch {
        ids = [];
      }
      if (!Array.isArray(ids) || ids.length === 0) return;
      await moveProductsToGroup(ids, targetGroupIdOrNull);
    },
    [moveProductsToGroup]
  );

  const renderGroupTree = useCallback(
    (parentId, depth = 0) => {
      const key = parentId == null ? "root" : String(parentId);
      const list = groupsByParent.get(key) || [];
      if (!list.length) return null;

      return list.map((g) => {
        const gid = g?.id ?? g?.uuid;
        if (!gid) return null;
        const gKey = String(gid);
        const childKey = gKey;
        const children = groupsByParent.get(childKey) || [];
        const hasChildren = children.length > 0;
        const isExpanded = expandedGroupIds.has(childKey);
        const isSelected =
          selectedGroupId !== "all" && String(selectedGroupId) === gKey;
        const isDragOver = dragOverGroupId && String(dragOverGroupId) === gKey;
        const hasParent = g?.parent !== null;
        const isChildrenSelected = children.some((c) => selectedGroupId === String(c?.id));
        return (
          <div key={gKey} className={`stocksGroups__node ${isChildrenSelected ? "is-children-selected" : ""}`}>

            <div
              className={`stocksGroups__item ${isSelected ? "is-selected" : ""
                } ${isDragOver ? "is-dragOver" : ""}`}
              style={{ marginLeft: hasParent ? depth * 14 : 0 }}
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedGroupId(gKey);
                resetToFirstPage();
              }}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  setSelectedGroupId(gKey);
                  resetToFirstPage();
                }
              }}
              onDragOver={(ev) => {
                ev.preventDefault();
                setDragOverGroupId(gKey);
              }}
              onDragLeave={() => setDragOverGroupId(null)}
              onDrop={(ev) => onGroupDrop(ev, gKey)}
              title="Перетащите товар сюда, чтобы переместить"
            >
              <span
                className="stocksGroups__expander"
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (hasChildren) toggleGroupExpand(childKey);
                }}
              >
                {hasChildren ? (isExpanded ? "▾" : "▸") : ""}

              </span>
              <span className="stocksGroups__icon">
                {isSelected ? <FolderOpen size={16} /> : <Folder size={16} />}
              </span>
              <div className="stocksGroups__nameContainer">
                <span className="stocksGroups__name">{g?.name || "—"}</span>
                <span className="stocksGroups__count">{g?.products_count || "0"}</span>
              </div>

              {inlineCreateParentId !== gKey && (
                <button
                  type="button"
                  className="stocksGroups__addChild"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    openInlineCreate(gKey);
                  }}
                  title="Добавить подгруппу"
                >
                  <Plus size={14} />
                </button>
              )}

              <button
                type="button"
                className="stocksGroups__delete"
                onClick={(ev) => {
                  ev.stopPropagation();
                  deleteGroup(gKey);
                }}
                title="Удалить группу"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {inlineCreateParentId === gKey && (
              <div
                className="stocksGroups__inlineCreate"
                style={{ paddingLeft: 10 + depth * 14 + 38 }}
                onClick={(ev) => ev.stopPropagation()}
              >
                <input
                  className="stocksGroups__inlineInput"
                  value={inlineCreateName}
                  onChange={(e) => setInlineCreateName(e.target.value)}
                  placeholder="Название группы"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitInlineCreate();
                    if (e.key === "Escape") closeInlineCreate();
                  }}
                />
                <button
                  type="button"
                  className="stocksGroups__inlineBtn stocksGroups__inlineBtn--primary"
                  onClick={submitInlineCreate}
                  disabled={!String(inlineCreateName || "").trim()}
                  title="Создать"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  className="stocksGroups__inlineBtn"
                  onClick={closeInlineCreate}
                  title="Отмена"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {hasChildren && isExpanded && renderGroupTree(gKey, depth + 1)}
          </div>
        );
      });
    },
    [
      groupsByParent,
      expandedGroupIds,
      selectedGroupId,
      dragOverGroupId,
      resetToFirstPage,
      onGroupDrop,
      deleteGroup,
      toggleGroupExpand,
      inlineCreateParentId,
      inlineCreateName,
      setInlineCreateName,
      submitInlineCreate,
      closeInlineCreate,
    ]
  );

  // Мемоизация сообщения для модального окна удаления
  const deleteModalMessage = useMemo(
    () => formatDeleteMessage(selectedCount),
    [selectedCount]
  );

  return (
    <div className="warehouse-page">
      <WarehouseHeader
        onBack={goBack}
        onCreateProduct={handleCreateProduct}
        title={
          resolvedWarehouseName
            ? `Товары склада: ${resolvedWarehouseName}`
            : "Товары склада"
        }
        subtitle="Управление товарами на складе"
      />

      <SearchSection
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onOpenFilters={() => setShowFilterModal(true)}
        count={count}
        foundCount={products.length}
      />

      <BulkActionsBar
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        onBulkDelete={handleBulkDelete}
        isDeleting={bulkDeleting}
      />

      <div className="stocksToolbar">
        <button
          type="button"
          className="stocksToolbar__btn"
          onClick={() => setShowGroups((v) => !v)}
        >
          {showGroups ? "Скрыть группы" : "Показать группы"}
        </button>



        {selectedCount > 0 && (
          <div className="stocksToolbar__move">
            <label>Переместить в</label>
            <select
              value={moveTargetGroupId}
              onChange={(e) => setMoveTargetGroupId(e.target.value)}
            >
              <option value="">Выберите…</option>
              <option value="none">Без группы</option>
              {groupOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="stocksToolbar__btn stocksToolbar__btn--primary"
              disabled={!moveTargetGroupId}
              onClick={() =>
                moveProductsToGroup(
                  Array.from(selectedRows),
                  moveTargetGroupId === "none" ? null : moveTargetGroupId
                )
              }
            >
              Переместить ({selectedCount})
            </button>
          </div>
        )}
      </div>

      <div className={`stocksLayout ${showGroups ? "" : "stocksLayout--noGroups"}`}>
        {showGroups && (
          <aside className="stocksGroups">
            <div className="stocksGroups__header">
              <div className="stocksGroups__title">Группы</div>
            </div>

            {groupsError && (
              <div className="stocksGroups__error">
                Не удалось загрузить/изменить группы
              </div>
            )}

            <div
              className={`stocksGroups__item ${selectedGroupId === "all" ? "is-selected" : ""
                }`}
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedGroupId("all");
                resetToFirstPage();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSelectedGroupId("all");
                  resetToFirstPage();
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onGroupDrop(e, null)}
              title="Сюда можно перетащить товар, чтобы убрать группу"
            >
              <span className="stocksGroups__expander" />
              <span className="stocksGroups__icon">
                <Folder size={16} />
              </span>
              <span className="stocksGroups__name">Все товары</span>

              {inlineCreateParentId !== null && (
                <button
                  type="button"
                  className="stocksGroups__addChild"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    openInlineCreate(null);
                  }}
                  title="Добавить группу в корень"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>

            {inlineCreateParentId === null && (
              <div
                className="stocksGroups__inlineCreate"
                style={{ paddingLeft: 10 + 0 * 14 + 38 }}
                onClick={(ev) => ev.stopPropagation()}
              >
                <input
                  className="stocksGroups__inlineInput"
                  value={inlineCreateName}
                  onChange={(e) => setInlineCreateName(e.target.value)}
                  placeholder="Название группы"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitInlineCreate();
                    if (e.key === "Escape") closeInlineCreate();
                  }}
                />
                <button
                  type="button"
                  className="stocksGroups__inlineBtn stocksGroups__inlineBtn--primary"
                  onClick={submitInlineCreate}
                  disabled={!String(inlineCreateName || "").trim()}
                  title="Создать"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  className="stocksGroups__inlineBtn"
                  onClick={closeInlineCreate}
                  title="Отмена"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="stocksGroups__tree">
              {groupsLoading ? (
                <div className="stocksGroups__empty">Загрузка…</div>
              ) : groups.length === 0 ? (
                <div className="stocksGroups__empty">Групп нет</div>
              ) : (
                renderGroupTree(null, 0)
              )}
            </div>
          </aside>
        )}

        <div className="warehouse-table-container w-full stocksContent">
          {viewMode === VIEW_MODES.TABLE ? (
            <ProductTable
              products={products}
              loading={loading}
              selectedRows={selectedRows}
              isAllSelected={isAllSelected}
              onRowSelect={handleRowSelect}
              onSelectAll={handleSelectAll}
              onProductClick={handleProductClick}
              getRowNumber={getRowNumber}
              enableDrag={showGroups}
              onProductDragStart={onProductDragStart}
            />
          ) : (
            <ProductCards
              products={products}
              loading={loading}
              selectedRows={selectedRows}
              isAllSelected={isAllSelected}
              onRowSelect={handleRowSelect}
              onSelectAll={handleSelectAll}
              onProductClick={handleProductClick}
              getRowNumber={getRowNumber}
              enableDrag={showGroups}
              onProductDragStart={onProductDragStart}
            />
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            count={count}
            loading={loading}
            hasNextPage={hasNextPage}
            hasPrevPage={hasPrevPage}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {showFilterModal && (
        <FilterModal
          onClose={() => setShowFilterModal(false)}
          currentFilters={filters}
          onApplyFilters={handleApplyFilters}
          onResetFilters={handleResetFilters}
          brands={brands}
          categories={categories}
        />
      )}

      <AlertModal
        open={showDeleteConfirmModal}
        type="warning"
        title="Подтверждение удаления"
        message={deleteModalMessage}
        okText="Удалить"
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
};

export default Stocks;
