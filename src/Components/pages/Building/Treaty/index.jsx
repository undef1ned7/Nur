import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Check,
  FileText,
  Folder,
  FolderOpen,
  LayoutGrid,
  Plus,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import DataContainer from "@/Components/common/DataContainer/DataContainer";
import Modal from "@/Components/common/Modal/Modal";
import { useAlert, useConfirm } from "@/hooks/useDialog";
import {
  fetchBuildingTreaties,
  createBuildingTreaty,
  updateBuildingTreaty,
  deleteBuildingTreaty,
  createBuildingTreatyInErp,
  createBuildingTreatyFile,
} from "../../../../store/creators/building/treatiesCreators";
import { fetchBuildingClients } from "../../../../store/creators/building/clientsCreators";
import { useBuildingTreaties } from "../../../../store/slices/building/treatiesSlice";
import { useBuildingClients } from "../../../../store/slices/building/clientsSlice";
import { useBuildingProjects } from "../../../../store/slices/building/projectsSlice";
import { useBuildingApartments } from "../../../../store/slices/building/apartmentsSlice";
import { fetchBuildingApartments } from "../../../../store/creators/building/apartmentsCreators";
import { validateResErrors } from "../../../../../tools/validateResErrors";
import BuildingActionsMenu from "../shared/ActionsMenu";
import {
  TREATY_TYPE_LABELS,
  TREATY_TYPE_OPTIONS,
} from "../shared/buildingSpecOptions";
import api from "../../../../api";
import "@/Components/Sectors/Warehouse/Stocks/StocksGroups.scss";
import "./treaty.scss";

const VIEW_MODES = { TABLE: "table", CARDS: "cards" };
const STORAGE_KEY = "building_treaty_view_mode";

const STATUS_LABELS = {
  draft: "Черновик",
  active: "Активен",
  signed: "Подписан",
  cancelled: "Отменён",
};

const OPERATION_TYPE_LABELS = {
  sale: "Продажа",
  booking: "Бронь",
};

const PAYMENT_TYPE_LABELS = {
  full: "Полная оплата",
  installment: "Рассрочка",
};

const GROUP_CHILDREN_KEYS = ["children", "items", "results", "nodes"];

const ERP_LABELS = {
  not_configured: "ERP не настроена",
  pending: "Ожидает",
  success: "Создано в ERP",
  error: "Ошибка ERP",
};

const FORM_INITIAL = {
  residential_complex: "",
  client: "",
  number: "",
  title: "",
  description: "",
  amount: "",
  operation_type: "sale",
  payment_type: "full",
  apartment: "",
  down_payment: "",
  payment_terms: "",
  status: "draft",
  auto_create_in_erp: false,
};

const normalizeGroupTree = (value) => {
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value)) return value;
  return [];
};

const getGroupChildren = (group) => {
  const childrenKey = GROUP_CHILDREN_KEYS.find((key) =>
    Array.isArray(group?.[key]),
  );
  return childrenKey ? group[childrenKey] : [];
};

const flattenGroupTree = (groups, depth = 0) =>
  groups.flatMap((group) => [
    { ...group, depth },
    ...flattenGroupTree(getGroupChildren(group), depth + 1),
  ]);

const getGroupTreatyCount = (group, fallbackList = [], fallbackMap = new Map()) => {
  const directCount =
    group?.treaties_count ??
    group?.treaty_count ??
    group?.contracts_count ??
    group?.documents_count;
  if (directCount != null) return directCount;
  const groupId = group?.id ?? group?.uuid;
  if (!groupId) return 0;
  if (fallbackMap.has(String(groupId))) {
    return fallbackMap.get(String(groupId)) || 0;
  }
  return (Array.isArray(fallbackList) ? fallbackList : []).filter(
    (item) => String(item?.group ?? "") === String(groupId),
  ).length;
};

export default function BuildingTreaty() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const alert = useAlert();
  const confirm = useConfirm();
  const { selectedProjectId, items: projects } = useBuildingProjects();
  const { list: clientsList } = useBuildingClients();
  const { list: apartmentsList } = useBuildingApartments();
  const {
    list,
    count,
    loading,
    error,
    creating,
    updatingId,
    createError,
    updatingError,
    erpCreatingId,
    erpError,
    deletingId,
  } = useBuildingTreaties();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [erpFilter, setErpFilter] = useState("");
  const [operationFilter, setOperationFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [treatyTypeFilter, setTreatyTypeFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [includeDescendants, setIncludeDescendants] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(FORM_INITIAL);
  const [formError, setFormError] = useState(null);
  const [selectedTreatyIds, setSelectedTreatyIds] = useState([]);

  const [groupsTree, setGroupsTree] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState(null);
  const [countsList, setCountsList] = useState([]);
  const [countsTotal, setCountsTotal] = useState(0);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm, setGroupForm] = useState({
    title: "",
    parent: "",
    is_active: true,
  });
  const [groupFormError, setGroupFormError] = useState(null);
  const [groupSaving, setGroupSaving] = useState(false);

  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveTargetGroup, setMoveTargetGroup] = useState("");
  const [moveError, setMoveError] = useState(null);
  const [moving, setMoving] = useState(false);
  const [dragOverGroupId, setDragOverGroupId] = useState(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState(
    () => new Set(["root"]),
  );
  const [inlineCreateParentId, setInlineCreateParentId] = useState(undefined);
  const [inlineCreateName, setInlineCreateName] = useState("");
  const [showGroups, setShowGroups] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.matchMedia("(max-width: 1024px)").matches;
  });

  const [fileModalTreaty, setFileModalTreaty] = useState(null);
  const [fileForm, setFileForm] = useState({ file: null, title: "" });
  const [fileUploadError, setFileUploadError] = useState(null);
  const [fileUploading, setFileUploading] = useState(false);

  const [createAttachment, setCreateAttachment] = useState({
    file: null,
    title: "",
  });

  const [installments, setInstallments] = useState([]);

  const [openTypeModal, setOpenTypeModal] = useState(false);

  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return VIEW_MODES.TABLE;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === VIEW_MODES.TABLE || saved === VIEW_MODES.CARDS) return saved;
    return VIEW_MODES.TABLE;
  });

  const selectedProjectName = useMemo(() => {
    if (!selectedProjectId) return "—";
    const listProjects = Array.isArray(projects) ? projects : [];
    const found = listProjects.find(
      (p) => String(p?.id ?? p?.uuid) === String(selectedProjectId),
    );
    return found?.name || "—";
  }, [selectedProjectId, projects]);

  const complexesOptions = useMemo(
    () => (Array.isArray(projects) ? projects : []),
    [projects],
  );
  const clientsOptions = useMemo(
    () => (Array.isArray(clientsList) ? clientsList : []),
    [clientsList],
  );

  const apartmentsOptions = useMemo(
    () =>
      (Array.isArray(apartmentsList) ? apartmentsList : []).filter(
        (a) =>
          !selectedProjectId ||
          String(a?.residential_complex) === String(selectedProjectId),
      ),
    [apartmentsList, selectedProjectId],
  );

  const flatGroupOptions = useMemo(
    () => flattenGroupTree(normalizeGroupTree(groupsTree)),
    [groupsTree],
  );

  const groupsByParent = useMemo(() => {
    const map = new Map();
    flatGroupOptions.forEach((group) => {
      const parent = group?.parent ?? group?.parent_id ?? null;
      const key = parent == null ? "root" : String(parent);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(group);
    });
    for (const [key, arr] of map.entries()) {
      arr.sort((a, b) =>
        String(a?.title || "").localeCompare(String(b?.title || "")),
      );
      map.set(key, arr);
    }
    return map;
  }, [flatGroupOptions]);

  const groupCountsMap = useMemo(() => {
    const map = new Map();
    (Array.isArray(countsList) ? countsList : []).forEach((item) => {
      const groupId = item?.group;
      if (!groupId) return;
      const key = String(groupId);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [countsList]);

  const ungroupedTreatiesCount = useMemo(
    () =>
      (Array.isArray(countsList) ? countsList : []).filter((item) => !item?.group)
        .length,
    [countsList],
  );

  const fetchParams = useMemo(
    () => ({
      residential_complex: selectedProjectId || undefined,
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      erp_sync_status: erpFilter || undefined,
      operation_type: operationFilter || undefined,
      payment_type: paymentFilter || undefined,
      treaty_type: treatyTypeFilter || undefined,
      group: groupFilter && groupFilter !== "__root__" ? groupFilter : undefined,
      include_descendants:
        groupFilter && groupFilter !== "__root__" && includeDescendants
          ? true
          : undefined,
    }),
    [
      selectedProjectId,
      search,
      statusFilter,
      erpFilter,
      operationFilter,
      paymentFilter,
      treatyTypeFilter,
      groupFilter,
      includeDescendants,
    ],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(fetchBuildingTreaties(fetchParams));
  }, [
    dispatch,
    selectedProjectId,
    fetchParams.search,
    fetchParams.status,
    fetchParams.erp_sync_status,
    fetchParams.operation_type,
    fetchParams.payment_type,
    fetchParams.treaty_type,
    fetchParams.group,
    fetchParams.include_descendants,
  ]);

  useEffect(() => {
    if (!selectedProjectId) {
      setGroupsTree([]);
      return;
    }
    let cancelled = false;
    setGroupsLoading(true);
    setGroupsError(null);
    api
      .get("/building/treaty-groups/", {
        params: {
          residential_complex: selectedProjectId,
          tree: true,
        },
      })
      .then((response) => {
        if (cancelled) return;
        setGroupsTree(normalizeGroupTree(response?.data));
      })
      .catch((err) => {
        if (cancelled) return;
        setGroupsError(err);
        setGroupsTree([]);
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setCountsList([]);
      setCountsTotal(0);
      return;
    }
    let cancelled = false;
    api
      .get("/building/treaties/", {
        params: {
          residential_complex: selectedProjectId,
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          erp_sync_status: erpFilter || undefined,
          operation_type: operationFilter || undefined,
          payment_type: paymentFilter || undefined,
          treaty_type: treatyTypeFilter || undefined,
          page: 1,
          page_size: 10000,
        },
      })
      .then((response) => {
        if (cancelled) return;
        const data = response?.data;
        const items = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
            ? data
            : [];
        setCountsList(items);
        setCountsTotal(Number(data?.count ?? items.length ?? 0));
      })
      .catch(() => {
        if (cancelled) return;
        setCountsList([]);
        setCountsTotal(0);
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedProjectId,
    search,
    statusFilter,
    erpFilter,
    operationFilter,
    paymentFilter,
    treatyTypeFilter,
  ]);

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(fetchBuildingClients({ residential_complex: selectedProjectId }));
  }, [dispatch, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    dispatch(
      fetchBuildingApartments({
        residential_complex: selectedProjectId,
        status: "available",
        page: 1,
        page_size: 500,
      }),
    );
  }, [dispatch, selectedProjectId]);

  const effectiveList = useMemo(() => {
    const arr = Array.isArray(list) ? list : [];
    if (
      !search.trim() &&
      !statusFilter &&
      !erpFilter &&
      !operationFilter &&
      !paymentFilter
    )
      return arr;
    return arr.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (erpFilter && t.erp_sync_status !== erpFilter) return false;
      if (operationFilter && t.operation_type !== operationFilter) return false;
      if (paymentFilter && t.payment_type !== paymentFilter) return false;
      if (treatyTypeFilter && t.treaty_type !== treatyTypeFilter) return false;
      if (groupFilter === "__root__" && t.group) return false;
      if (
        groupFilter &&
        groupFilter !== "__root__" &&
        String(t.group ?? "") !== String(groupFilter)
      ) {
        return false;
      }
      if (!search.trim()) return true;
      const hay = `${t.number || ""} ${t.title || ""} ${t.description || ""} ${
        t.client_name || ""
      } ${t.residential_complex_name || ""}`
        .toLowerCase()
        .trim();
      return hay.includes(search.toLowerCase().trim());
    });
  }, [
    list,
    search,
    statusFilter,
    erpFilter,
    operationFilter,
    paymentFilter,
    treatyTypeFilter,
    groupFilter,
  ]);

  useEffect(() => {
    setSelectedTreatyIds((prev) =>
      prev.filter((selectedId) =>
        effectiveList.some(
          (t) => String(t?.id ?? t?.uuid) === String(selectedId),
        ),
      ),
    );
  }, [effectiveList]);

  const openCreate = () => {
    if (!selectedProjectId) {
      alert("Сначала выберите жилой комплекс в шапке раздела", true);
      return;
    }
    setOpenTypeModal(true);
  };

  const chooseNewTreatyType = (treatyType) => {
    setOpenTypeModal(false);
    const operationType =
      treatyType === "sale"
        ? "sale"
        : treatyType === "booking"
          ? "booking"
          : "other";
    const q = new URLSearchParams({
      treaty_type: treatyType,
      operation_type: operationType,
    }).toString();
    navigate(`/crm/building/treaty/new?${q}`);
  };

  const refreshTreatiesAndGroups = () => {
    if (!selectedProjectId) return;
    dispatch(fetchBuildingTreaties(fetchParams));
    api
      .get("/building/treaty-groups/", {
        params: {
          residential_complex: selectedProjectId,
          tree: true,
        },
      })
      .then((response) => setGroupsTree(normalizeGroupTree(response?.data)))
      .catch((err) => setGroupsError(err));
  };

  const openCreateGroup = (parentGroup = null) => {
    setEditingGroup(null);
    setGroupForm({
      title: "",
      parent: parentGroup?.id ?? parentGroup?.uuid ?? "",
      is_active: true,
    });
    setGroupFormError(null);
    setGroupModalOpen(true);
  };

  const toggleGroupExpand = (groupIdOrRoot) => {
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
  };

  const openInlineCreate = (parentIdOrNull) => {
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
  };

  const closeInlineCreate = () => {
    setInlineCreateParentId(undefined);
    setInlineCreateName("");
  };

  const submitInlineCreate = async () => {
    const title = String(inlineCreateName || "").trim();
    if (!selectedProjectId) {
      alert("Сначала выберите жилой комплекс", true);
      return;
    }
    if (!title) return;
    try {
      await api.post("/building/treaty-groups/", {
        residential_complex: selectedProjectId,
        title,
        parent:
          inlineCreateParentId === undefined ? null : inlineCreateParentId || null,
        is_active: true,
      });
      closeInlineCreate();
      refreshTreatiesAndGroups();
    } catch (err) {
      alert(validateResErrors(err, "Не удалось создать папку"), true);
    }
  };

  const openEditGroup = (group) => {
    setEditingGroup(group);
    setGroupForm({
      title: group?.title || "",
      parent: group?.parent ?? group?.parent_id ?? "",
      is_active: group?.is_active ?? true,
    });
    setGroupFormError(null);
    setGroupModalOpen(true);
  };

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setGroupFormError("Сначала выберите жилой комплекс");
      return;
    }
    const title = String(groupForm.title || "").trim();
    if (!title) {
      setGroupFormError("Введите название папки");
      return;
    }
    setGroupSaving(true);
    setGroupFormError(null);
    try {
      const payload = {
        residential_complex: selectedProjectId,
        title,
        parent: groupForm.parent || null,
        is_active: Boolean(groupForm.is_active),
      };
      if (editingGroup?.id ?? editingGroup?.uuid) {
        await api.patch(
          `/building/treaty-groups/${editingGroup?.id ?? editingGroup?.uuid}/`,
          payload,
        );
      } else {
        await api.post("/building/treaty-groups/", payload);
      }
      setGroupModalOpen(false);
      setEditingGroup(null);
      alert(editingGroup ? "Папка обновлена" : "Папка создана");
      refreshTreatiesAndGroups();
    } catch (err) {
      setGroupFormError(validateResErrors(err, "Не удалось сохранить папку"));
    } finally {
      setGroupSaving(false);
    }
  };

  const handleDeleteGroup = (group) => {
    const groupId = group?.id ?? group?.uuid;
    if (!groupId) return;
    confirm(`Удалить папку «${group?.title || "папка"}»?`, async (ok) => {
      if (!ok) return;
      try {
        await api.delete(`/building/treaty-groups/${groupId}/`);
        alert("Папка удалена");
        if (String(groupFilter) === String(groupId)) {
          setGroupFilter("");
        }
        refreshTreatiesAndGroups();
      } catch (err) {
        alert(validateResErrors(err, "Не удалось удалить папку"), true);
      }
    });
  };

  const toggleTreatySelection = (treatyId) => {
    setSelectedTreatyIds((prev) =>
      prev.some((id) => String(id) === String(treatyId))
        ? prev.filter((id) => String(id) !== String(treatyId))
        : [...prev, treatyId],
    );
  };

  const openMoveTreatiesModal = (ids = []) => {
    const normalizedIds = (ids || []).filter(Boolean);
    if (normalizedIds.length > 0) {
      setSelectedTreatyIds(normalizedIds);
    }
    const idsForMove = normalizedIds.length > 0 ? normalizedIds : selectedTreatyIds;
    if (idsForMove.length === 0) {
      alert("Выберите хотя бы один договор", true);
      return;
    }
    setMoveTargetGroup("");
    setMoveError(null);
    setMoveModalOpen(true);
  };

  const handleMoveTreaties = async (e) => {
    e.preventDefault();
    const ids = selectedTreatyIds.filter(Boolean);
    if (ids.length === 0) {
      setMoveError("Выберите хотя бы один договор");
      return;
    }
    setMoving(true);
    setMoveError(null);
    try {
      await api.post("/building/treaties/move/", {
        treaty_ids: ids,
        target_group: moveTargetGroup || null,
      });
      alert("Договоры перенесены");
      setMoveModalOpen(false);
      setSelectedTreatyIds([]);
      refreshTreatiesAndGroups();
    } catch (err) {
      setMoveError(validateResErrors(err, "Не удалось перенести договоры"));
    } finally {
      setMoving(false);
    }
  };

  const moveTreatiesToGroup = async (treatyIds, targetGroupIdOrNull) => {
    const ids = Array.isArray(treatyIds) ? treatyIds.filter(Boolean) : [];
    if (ids.length === 0) return;
    try {
      await api.post("/building/treaties/move/", {
        treaty_ids: ids,
        target_group: targetGroupIdOrNull || null,
      });
      setSelectedTreatyIds([]);
      refreshTreatiesAndGroups();
    } catch (err) {
      alert(validateResErrors(err, "Не удалось перенести договоры"), true);
    }
  };

  const moveGroupToParent = async (groupId, targetParentIdOrNull) => {
    if (!groupId) return;
    try {
      await api.patch(`/building/treaty-groups/${groupId}/`, {
        parent: targetParentIdOrNull || null,
      });
      refreshTreatiesAndGroups();
    } catch (err) {
      alert(validateResErrors(err, "Не удалось переместить папку"), true);
    }
  };

  const onTreatyDragStart = (treaty, e) => {
    const treatyId = treaty?.id ?? treaty?.uuid;
    if (!treatyId) return;
    const ids =
      selectedTreatyIds.length > 0 &&
      selectedTreatyIds.some((id) => String(id) === String(treatyId))
        ? selectedTreatyIds
        : [treatyId];
    e.dataTransfer.setData(
      "application/x-building-treaty-ids",
      JSON.stringify(ids),
    );
    e.dataTransfer.setData("text/plain", JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "move";
  };

  const onGroupDragStart = (group, e) => {
    const groupId = group?.id ?? group?.uuid;
    if (!groupId) return;
    e.dataTransfer.setData(
      "application/x-building-treaty-group-id",
      String(groupId),
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const isGroupDescendantOf = (candidateGroupId, parentGroupId) => {
    if (!candidateGroupId || !parentGroupId) return false;
    const parentMap = new Map(
      flatGroupOptions.map((group) => [
        String(group?.id ?? group?.uuid),
        group?.parent ?? group?.parent_id ?? null,
      ]),
    );
    let currentParent = parentMap.get(String(candidateGroupId));
    while (currentParent) {
      if (String(currentParent) === String(parentGroupId)) return true;
      currentParent = parentMap.get(String(currentParent));
    }
    return false;
  };

  const onGroupDrop = async (e, targetGroupIdOrNull) => {
    e.preventDefault();
    setDragOverGroupId(null);
    const draggedGroupId = e.dataTransfer.getData(
      "application/x-building-treaty-group-id",
    );
    if (draggedGroupId) {
      if (
        String(draggedGroupId) === String(targetGroupIdOrNull) ||
        isGroupDescendantOf(targetGroupIdOrNull, draggedGroupId)
      ) {
        return;
      }
      await moveGroupToParent(draggedGroupId, targetGroupIdOrNull);
      return;
    }
    let ids = [];
    try {
      const raw =
        e.dataTransfer.getData("application/x-building-treaty-ids") ||
        e.dataTransfer.getData("text/plain");
      ids = JSON.parse(raw || "[]");
    } catch {
      ids = [];
    }
    if (!Array.isArray(ids) || ids.length === 0) return;
    await moveTreatiesToGroup(ids, targetGroupIdOrNull);
  };

  const openEdit = (treaty) => {
    const id = treaty?.id ?? treaty?.uuid;
    if (!id) return;
    navigate(`/crm/building/treaty/${id}`);
  };

  const closeModal = () => {
    setOpenModal(false);
    setEditing(null);
    setForm(FORM_INITIAL);
    setCreateAttachment({ file: null, title: "" });
    setInstallments([]);
    setFormError(null);
  };

  const handleFormChange = (key) => (e) => {
    const value =
      key === "auto_create_in_erp" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleInstallmentChange = (index, key) => (e) => {
    const value = e.target.value;
    setInstallments((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              [key]: value,
            }
          : row,
      ),
    );
  };

  const addInstallmentRow = () => {
    setInstallments((prev) => [
      ...prev,
      {
        order: prev.length + 1,
        due_date: "",
        amount: "",
      },
    ]);
  };

  const removeInstallmentRow = (index) => {
    setInstallments((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((row, i) => ({ ...row, order: i + 1 })),
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert("Сначала выберите жилой комплекс в шапке раздела", true);
      return;
    }
    if (
      !form.residential_complex ||
      !form.client ||
      !String(form.title || "").trim()
    ) {
      setFormError("Заполните ЖК, клиента и наименование договора");
      return;
    }

    if (
      (form.operation_type === "sale" || form.operation_type === "booking") &&
      !form.apartment
    ) {
      setFormError("Выберите квартиру для продажи/брони");
      return;
    }

    let installmentsPayload = undefined;
    if (form.payment_type === "installment") {
      const cleaned = installments
        .map((row, idx) => ({
          order: row.order ?? idx + 1,
          due_date: row.due_date || "",
          amount: row.amount || "",
        }))
        .filter((row) => row.due_date && row.amount);

      if (cleaned.length === 0) {
        setFormError("Добавьте хотя бы один платёж рассрочки");
        return;
      }

      const amountTotal = Number(form.amount || 0);
      const down = Number(form.down_payment || 0);
      const insSum = cleaned.reduce(
        (acc, row) => acc + Number(row.amount || 0),
        0,
      );

      if (
        Number.isFinite(amountTotal) &&
        (down + insSum).toFixed(2) !== amountTotal.toFixed(2)
      ) {
        setFormError(
          "Сумма первоначального взноса и рассрочки должна быть равна сумме договора",
        );
        return;
      }

      installmentsPayload = cleaned.map((row) => ({
        order: row.order,
        due_date: row.due_date,
        amount: String(row.amount),
      }));
    }

    const payload = {
      ...form,
      amount: form.amount ? String(form.amount) : undefined,
      down_payment: form.down_payment ? String(form.down_payment) : undefined,
      installments:
        form.payment_type === "installment" ? installmentsPayload : undefined,
    };

    try {
      let res;
      if (editing) {
        const id = editing?.id ?? editing?.uuid;
        if (!id) return;
        res = await dispatch(updateBuildingTreaty({ id, data: payload }));
      } else {
        res = await dispatch(createBuildingTreaty(payload));
      }
      if (res.meta.requestStatus === "fulfilled") {
        const newTreaty = res.payload;
        const newId = newTreaty?.id ?? newTreaty?.uuid;
        if (!editing && createAttachment.file && newId) {
          const fileRes = await dispatch(
            createBuildingTreatyFile({
              treatyId: newId,
              file: createAttachment.file,
              title: createAttachment.title || undefined,
            }),
          );
          if (fileRes.meta.requestStatus === "fulfilled") {
            alert("Договор создан, файл прикреплён");
          } else {
            alert("Договор создан. Не удалось прикрепить файл.", true);
          }
        } else {
          alert(editing ? "Договор обновлён" : "Договор создан");
        }
        closeModal();
        dispatch(fetchBuildingTreaties(fetchParams));
      } else {
        setFormError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось сохранить договор",
          ),
        );
      }
    } catch (err) {
      setFormError(validateResErrors(err, "Не удалось сохранить договор"));
    }
  };

  const handleErpCreate = (treaty) => {
    const id = treaty?.id ?? treaty?.uuid;
    if (!id) return;
    confirm("Отправить договор на создание в ERP?", async (ok) => {
      if (!ok) return;
      try {
        const res = await dispatch(createBuildingTreatyInErp(id));
        if (res.meta.requestStatus === "fulfilled") {
          alert("Договор отправлен в ERP");
          dispatch(fetchBuildingTreaties(fetchParams));
        } else {
          alert(
            validateResErrors(
              res.payload || res.error,
              "Не удалось отправить договор в ERP",
            ),
            true,
          );
        }
      } catch (e) {
        alert(validateResErrors(e, "Не удалось отправить договор в ERP"), true);
      }
    });
  };

  const openFileModal = (treaty) => {
    setFileModalTreaty(treaty);
    setFileForm({ file: null, title: "" });
    setFileUploadError(null);
  };

  const closeFileModal = () => {
    setFileModalTreaty(null);
    setFileForm({ file: null, title: "" });
    setFileUploadError(null);
  };

  const handleFileSubmit = async (e) => {
    e.preventDefault();
    if (!fileModalTreaty) return;
    const id = fileModalTreaty?.id ?? fileModalTreaty?.uuid;
    if (!id || !fileForm.file) {
      setFileUploadError("Выберите файл");
      return;
    }
    setFileUploadError(null);
    setFileUploading(true);
    try {
      const res = await dispatch(
        createBuildingTreatyFile({
          treatyId: id,
          file: fileForm.file,
          title: fileForm.title || undefined,
        }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        alert("Файл прикреплён");
        closeFileModal();
      } else {
        setFileUploadError(
          validateResErrors(
            res.payload || res.error,
            "Не удалось загрузить файл",
          ),
        );
      }
    } catch (err) {
      setFileUploadError(validateResErrors(err, "Не удалось загрузить файл"));
    } finally {
      setFileUploading(false);
    }
  };

  const handleDelete = (treaty) => {
    const id = treaty?.id ?? treaty?.uuid;
    if (!id) return;
    confirm(
      `Удалить договор «${treaty?.title || treaty?.number || "договор"}»?`,
      async (ok) => {
        if (!ok) return;
        try {
          const res = await dispatch(deleteBuildingTreaty(id));
          if (res.meta.requestStatus === "fulfilled") {
            alert("Договор удалён");
            dispatch(fetchBuildingTreaties(fetchParams));
          } else {
            alert(
              validateResErrors(
                res.payload || res.error,
                "Не удалось удалить договор",
              ),
              true,
            );
          }
        } catch (err) {
          alert(validateResErrors(err, "Не удалось удалить договор"), true);
        }
      },
    );
  };

  const renderGroupTree = (parentId = null, depth = 0) => {
    const key = parentId == null ? "root" : String(parentId);
    const groups = groupsByParent.get(key) || [];
    if (!groups.length) return null;

    return groups.map((group) => {
      const groupId = group?.id ?? group?.uuid;
      if (!groupId) return null;
      const groupKey = String(groupId);
      const children = groupsByParent.get(groupKey) || [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedGroupIds.has(groupKey);
      const isActive =
        groupFilter !== "__root__" && String(groupFilter) === String(groupId);
      const isDragOver = String(dragOverGroupId || "") === String(groupId);
      const count = getGroupTreatyCount(group, countsList, groupCountsMap);
      const isChildrenSelected = children.some(
        (child) => String(groupFilter) === String(child?.id ?? child?.uuid),
      );

      return (
        <div
          key={groupKey}
          className={`stocksGroups__node ${isChildrenSelected ? "is-children-selected" : ""}`}
        >
          <div
            className={`stocksGroups__item ${isActive ? "is-selected" : ""} ${
              isDragOver ? "is-dragOver" : ""
            }`}
            style={{ marginLeft: depth * 14 }}
            role="button"
            tabIndex={0}
            onClick={() => setGroupFilter(String(groupId))}
            onDoubleClick={() => openEditGroup(group)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                setGroupFilter(String(groupId));
              }
            }}
            onDragOver={(ev) => {
              ev.preventDefault();
              setDragOverGroupId(groupId);
            }}
            onDragLeave={() => setDragOverGroupId(null)}
            onDrop={(ev) => onGroupDrop(ev, groupId)}
            title="Перетащите договор или папку сюда, чтобы переместить"
          >
            <span
              className="stocksGroups__expander"
              onClick={(ev) => {
                ev.stopPropagation();
                if (hasChildren) toggleGroupExpand(groupKey);
              }}
            >
              {hasChildren ? (isExpanded ? "▾" : "▸") : ""}
            </span>
            <span className="stocksGroups__icon">
              {isActive ? <FolderOpen size={16} /> : <Folder size={16} />}
            </span>
            <div
              className="stocksGroups__nameContainer"
              draggable
              onDragStart={(ev) => onGroupDragStart(group, ev)}
            >
              <span className="stocksGroups__name">{group?.title || "Папка"}</span>
              <span className="stocksGroups__count">{count}</span>
            </div>

            {inlineCreateParentId !== groupKey && (
              <button
                type="button"
                className="stocksGroups__addChild"
                onClick={(ev) => {
                  ev.stopPropagation();
                  openInlineCreate(groupKey);
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
                handleDeleteGroup(group);
              }}
              title="Удалить папку"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {inlineCreateParentId === groupKey && (
            <div
              className="stocksGroups__inlineCreate"
              style={{ paddingLeft: 10 + depth * 14 + 38 }}
              onClick={(ev) => ev.stopPropagation()}
            >
              <input
                className="stocksGroups__inlineInput"
                value={inlineCreateName}
                onChange={(e) => setInlineCreateName(e.target.value)}
                placeholder="Название папки"
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

          {hasChildren && isExpanded && renderGroupTree(groupKey, depth + 1)}
        </div>
      );
    });
  };

  const totalTreaties = Number(countsTotal || count || 0);
  const filteredCount = Array.isArray(effectiveList) ? effectiveList.length : 0;

  return (
    <div className="warehouse-page building-page building-page--treaties">
      <div className="warehouse-header">
        <div className="warehouse-header__left">
          <div className="warehouse-header__icon-box">
            <FileText size={24} />
          </div>
          <div className="warehouse-header__title-section">
            <h1 className="warehouse-header__title">Договоры строительства</h1>
            <p className="warehouse-header__subtitle">
              {selectedProjectId ? (
                <>
                  ЖК: <b>{selectedProjectName}</b>. Реестр договоров с фильтрами
                  и ERP-синхронизацией.
                </>
              ) : (
                "Выберите жилой комплекс в шапке раздела."
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="warehouse-header__create-btn"
          disabled={!selectedProjectId}
          onClick={openCreate}
        >
          Новый договор
        </button>
      </div>

      <Modal
        open={openTypeModal}
        onClose={() => setOpenTypeModal(false)}
        title="Тип договора"
        wrapperId="treaty-type-modal"
      >
        <div className="add-product-page add-product-page--modal-form" style={{ padding: "8px 0" }}>
          <p className="treaty-detail__muted" style={{ marginBottom: 16 }}>
            Выберите бизнес-тип договора для перехода на страницу создания.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TREATY_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="add-product-page__submit-btn"
                style={{ justifyContent: "center" }}
                onClick={() => chooseNewTreatyType(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      <div className="warehouse-search-section">
        <div className="warehouse-search">
          <input
            className="warehouse-search__input"
            value={search}
            placeholder="Поиск по номеру, названию, описанию, клиенту, ЖК"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="warehouse-search__info flex flex-wrap items-center gap-2">
          <span>
            {selectedProjectId
              ? `Найдено ${filteredCount} из ${totalTreaties} договоров`
              : "Выберите жилой комплекс в шапке раздела."}
          </span>
          <select
            className="warehouse-filter-modal__select-small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Статус: все</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="warehouse-filter-modal__select-small"
            value={erpFilter}
            onChange={(e) => setErpFilter(e.target.value)}
          >
            <option value="">ERP: все</option>
            {Object.entries(ERP_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="warehouse-filter-modal__select-small"
            value={operationFilter}
            onChange={(e) => setOperationFilter(e.target.value)}
          >
            <option value="">Тип операции: все</option>
            {Object.entries(OPERATION_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="warehouse-filter-modal__select-small"
            value={treatyTypeFilter}
            onChange={(e) => setTreatyTypeFilter(e.target.value)}
          >
            <option value="">Категория: все</option>
            {TREATY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="warehouse-filter-modal__select-small"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="">Оплата: все</option>
            {Object.entries(PAYMENT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={includeDescendants}
              onChange={(e) => setIncludeDescendants(e.target.checked)}
              disabled={!groupFilter}
            />
            <span>С подпапками</span>
          </label>
          <button
            type="button"
            className="building-btn"
            onClick={() => openMoveTreatiesModal()}
            disabled={selectedTreatyIds.length === 0}
          >
            Перенести выбранные
          </button>
          <div className="ml-auto flex items-center gap-2 warehouse-view-buttons">
            <button
              type="button"
              onClick={() => setViewMode(VIEW_MODES.TABLE)}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                viewMode === VIEW_MODES.TABLE
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Table2 size={16} />
              Таблица
            </button>
            <button
              type="button"
              onClick={() => setViewMode(VIEW_MODES.CARDS)}
              className={`warehouse-view-btn inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                viewMode === VIEW_MODES.CARDS
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <LayoutGrid size={16} />
              Карточки
            </button>
          </div>
        </div>
      </div>

      {(error || erpError) && (
        <div className="mt-2 text-sm text-red-500">
          {error && String(validateResErrors(error, "Не удалось загрузить договоры"))}
          {erpError && ` ERP: ${String(validateResErrors(erpError, "Ошибка ERP"))}`}
        </div>
      )}

      <div className="stocksToolbar">
        <button
          type="button"
          className="stocksToolbar__btn"
          onClick={() => setShowGroups((value) => !value)}
        >
          {showGroups ? "Скрыть папки" : "Показать папки"}
        </button>
      </div>

      <DataContainer>
        <div
          className={`stocksLayout ${showGroups ? "" : "stocksLayout--noGroups"}`}
        >
          {showGroups && (
            <aside className="stocksGroups">
            <div className="stocksGroups__header">
              <div>
                <div className="stocksGroups__title">Папки договоров</div>
                <div className="building-page__muted">
                  Категория: {TREATY_TYPE_LABELS[treatyTypeFilter] || "Все"}
                </div>
              </div>
              <button
                type="button"
                className="stocksGroups__add"
                onClick={() => openInlineCreate(null)}
                title="Новая папка"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="building-page__muted" style={{ marginBottom: 10 }}>
              Перетаскивайте договоры в папки, а папки друг в друга.
            </div>

            {groupsError && (
              <div className="stocksGroups__error">
                {String(validateResErrors(groupsError, "Не удалось загрузить папки"))}
              </div>
            )}

            <div
              className={`stocksGroups__item ${!groupFilter ? "is-selected" : ""} ${
                dragOverGroupId === "__root-all__" ? "is-dragOver" : ""
              }`}
              role="button"
              tabIndex={0}
              onClick={() => setGroupFilter("")}
              onKeyDown={(e) => {
                if (e.key === "Enter") setGroupFilter("");
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverGroupId("__root-all__");
              }}
              onDragLeave={() => setDragOverGroupId(null)}
              onDrop={(e) => onGroupDrop(e, null)}
              title="Перетащите сюда договор или папку, чтобы убрать вложенность/папку"
            >
              <span className="stocksGroups__expander" />
              <span className="stocksGroups__icon">
                {!groupFilter ? <FolderOpen size={16} /> : <Folder size={16} />}
              </span>
              <div className="stocksGroups__nameContainer">
                <span className="stocksGroups__name">Все папки</span>
                <span className="stocksGroups__count">{totalTreaties}</span>
              </div>
              {inlineCreateParentId !== null && (
                <button
                  type="button"
                  className="stocksGroups__addChild"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    openInlineCreate(null);
                  }}
                  title="Добавить папку в корень"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>

            {inlineCreateParentId === null && (
              <div
                className="stocksGroups__inlineCreate"
                style={{ paddingLeft: 48 }}
                onClick={(ev) => ev.stopPropagation()}
              >
                <input
                  className="stocksGroups__inlineInput"
                  value={inlineCreateName}
                  onChange={(e) => setInlineCreateName(e.target.value)}
                  placeholder="Название папки"
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

            <div
              className={`stocksGroups__item ${groupFilter === "__root__" ? "is-selected" : ""} ${
                dragOverGroupId === "__root__" ? "is-dragOver" : ""
              }`}
              role="button"
              tabIndex={0}
              onClick={() => setGroupFilter("__root__")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setGroupFilter("__root__");
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverGroupId("__root__");
              }}
              onDragLeave={() => setDragOverGroupId(null)}
              onDrop={(e) => onGroupDrop(e, null)}
              title="Перетащите сюда договор, чтобы убрать папку"
            >
              <span className="stocksGroups__expander" />
              <span className="stocksGroups__icon">
                {groupFilter === "__root__" ? (
                  <FolderOpen size={16} />
                ) : (
                  <Folder size={16} />
                )}
              </span>
              <div className="stocksGroups__nameContainer">
                <span className="stocksGroups__name">Без папки</span>
                <span className="stocksGroups__count">{ungroupedTreatiesCount}</span>
              </div>
            </div>

            <div className="stocksGroups__tree">
              {groupsLoading ? (
                <div className="stocksGroups__empty">Загрузка...</div>
              ) : normalizeGroupTree(groupsTree).length === 0 ? (
                <div className="stocksGroups__empty">Папок пока нет</div>
              ) : (
                renderGroupTree(null, 0)
              )}
            </div>
            </aside>
          )}

          <div className="stocksContent">
            {selectedTreatyIds.length > 0 && (
              <div
                style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 12,
                  background: "#eff6ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  Выбрано договоров: <b>{selectedTreatyIds.length}</b>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="building-btn"
                    onClick={() => setSelectedTreatyIds([])}
                  >
                    Сбросить
                  </button>
                  <button
                    type="button"
                    className="building-btn building-btn--primary"
                    onClick={() => openMoveTreatiesModal()}
                  >
                    Перенести в папку
                  </button>
                </div>
              </div>
            )}
          {viewMode === VIEW_MODES.TABLE ? (
            <div
              className="building-treaty-table-scroll"
              style={{ overflowX: "auto", overflowY: "visible", width: "100%" }}
            >
              <table className="warehouse-table w-full building-treaty-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>
                    <input
                      type="checkbox"
                      checked={
                        effectiveList.length > 0 &&
                        effectiveList.every((t) =>
                          selectedTreatyIds.some(
                            (selectedId) =>
                              String(selectedId) === String(t?.id ?? t?.uuid),
                          ),
                        )
                      }
                      onChange={(e) =>
                        setSelectedTreatyIds(
                          e.target.checked
                            ? effectiveList.map((t) => t?.id ?? t?.uuid).filter(Boolean)
                            : [],
                        )
                      }
                    />
                  </th>
                  <th>Номер</th>
                  <th>Название</th>
                  <th>Категория</th>
                  <th>Папка</th>
                  <th>ЖК</th>
                  <th>Клиент</th>
                  <th>Квартира</th>
                  <th>Тип операции</th>
                  <th>Тип оплаты</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                  <th>ERP</th>
                  <th style={{ width: 80 }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {!selectedProjectId ? (
                  <tr>
                    <td colSpan={14} className="warehouse-table__empty">
                      Выберите жилой комплекс в шапке раздела.
                    </td>
                  </tr>
                ) : loading && effectiveList.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="warehouse-table__loading">
                      Загрузка...
                    </td>
                  </tr>
                ) : !loading && effectiveList.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="warehouse-table__empty">
                      Договоров пока нет.
                    </td>
                  </tr>
                ) : (
                  effectiveList.map((t) => {
                    const id = t?.id ?? t?.uuid;
                    const erpBusy = id != null && erpCreatingId === id;
                    const busyUpdate = id != null && updatingId === id;
                    const busyDelete = id != null && deletingId === id;
                    const busy = erpBusy || busyUpdate || busyDelete;
                    const erpStatus = t?.erp_sync_status || "none";
                    return (
                      <tr
                        key={id}
                        draggable
                        onDragStart={(e) => onTreatyDragStart(t, e)}
                        onClick={() =>
                          id && navigate(`/crm/building/treaty/${id}`)
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedTreatyIds.some(
                              (selectedId) => String(selectedId) === String(id),
                            )}
                            onChange={() => toggleTreatySelection(id)}
                          />
                        </td>
                        <td>{t?.number || "—"}</td>
                        <td>{t?.title || "—"}</td>
                        <td>
                          {TREATY_TYPE_LABELS[t?.treaty_type] ||
                            t?.treaty_type ||
                            "—"}
                        </td>
                        <td>{t?.group_title || t?.group_name || "—"}</td>
                        <td>
                          {t?.residential_complex_name ||
                            t?.residential_complex ||
                            "—"}
                        </td>
                        <td>{t?.client_name || t?.client || "—"}</td>
                        <td>
                          {t?.apartment_number ||
                            (t?.apartment_floor != null
                              ? `Этаж ${t.apartment_floor}`
                              : t?.apartment) ||
                            "—"}
                        </td>
                        <td>
                          {OPERATION_TYPE_LABELS[t?.operation_type] ||
                            t?.operation_type ||
                            "—"}
                        </td>
                        <td>
                          {PAYMENT_TYPE_LABELS[t?.payment_type] ||
                            t?.payment_type ||
                            "—"}
                        </td>
                        <td>{t?.amount ?? "—"}</td>
                        <td>
                          <span className="building-page__status">
                            {STATUS_LABELS[t?.status] || t?.status || "—"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`building-page__status ${
                              erpStatus === "success"
                                ? "is-success"
                                : erpStatus === "error"
                                  ? "is-danger"
                                  : erpStatus === "pending"
                                    ? "is-warning"
                                    : ""
                            }`}
                          >
                            {ERP_LABELS[t?.erp_sync_status] || "—"}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <BuildingActionsMenu
                            actions={[
                              {
                                label: "Перенести",
                                onClick: () => openMoveTreatiesModal([id]),
                                disabled: busy,
                              },
                              {
                                label: "Изменить",
                                onClick: () => openEdit(t),
                                disabled: busy,
                              },
                              {
                                label: "Прикрепить файл",
                                onClick: () => openFileModal(t),
                                disabled: busy,
                              },
                              {
                                label: "В ERP",
                                onClick: () => handleErpCreate(t),
                                disabled: busy || erpBusy,
                              },
                              {
                                label: "Удалить",
                                onClick: () => handleDelete(t),
                                disabled: busy || t?.status !== "draft",
                                danger: true,
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              </table>
            </div>
          ) : (
            <div className="warehouse-cards grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 p-4">
              {!selectedProjectId ? (
                <div className="warehouse-table__empty">
                  Выберите жилой комплекс в шапке раздела.
                </div>
              ) : loading && effectiveList.length === 0 ? (
                <div className="warehouse-table__loading">Загрузка...</div>
              ) : !loading && effectiveList.length === 0 ? (
                <div className="warehouse-table__empty">
                  Договоров пока нет.
                </div>
              ) : (
                effectiveList.map((t) => {
                  const id = t?.id ?? t?.uuid;
                  const erpBusy = id != null && erpCreatingId === id;
                  const busy =
                    erpBusy ||
                    (id != null && updatingId === id) ||
                    (id != null && deletingId === id);
                  const erpStatus = t?.erp_sync_status || "none";
                  return (
                    <div
                      key={id}
                      className="warehouse-table__row warehouse-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md"
                      draggable
                      onDragStart={(e) => onTreatyDragStart(t, e)}
                      onClick={() =>
                        id && navigate(`/crm/building/treaty/${id}`)
                      }
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {t?.number || "—"} · {t?.title || "—"}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {t?.client_name || "—"} · {t?.residential_complex_name || "—"}
                          </div>
                        </div>
                        <span className="building-page__status">
                          {STATUS_LABELS[t?.status] || t?.status || "—"}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div className="rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Сумма</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            {t?.amount ?? "—"}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">ERP</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            {ERP_LABELS[t?.erp_sync_status] || "—"}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Категория</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            {TREATY_TYPE_LABELS[t?.treaty_type] ||
                              t?.treaty_type ||
                              "—"}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2">
                          <div className="text-slate-500">Папка</div>
                          <div className="mt-0.5 font-semibold text-slate-900">
                            {t?.group_title || t?.group_name || "—"}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <button
                          type="button"
                          className="px-3 py-2 flex-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            openMoveTreatiesModal([id]);
                          }}
                        >
                          Перенести
                        </button>
                        <button
                          type="button"
                          className="px-3 py-2 flex-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(t);
                          }}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          className="px-3 py-2 flex-1 rounded-lg bg-red-500 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={busy || t?.status !== "draft"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(t);
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {(createError || updatingError) && (
            <div className="building-page__error" style={{ marginTop: 12 }}>
              {String(
                validateResErrors(
                  createError || updatingError,
                  "Ошибка при сохранении договора",
                ),
              )}
            </div>
          )}
        </div>
        </div>
      </DataContainer>

      <Modal
        open={groupModalOpen}
        onClose={() => {
          if (groupSaving) return;
          setGroupModalOpen(false);
        }}
        title={editingGroup ? "Изменить папку" : "Новая папка"}
      >
        <form className="building-page" onSubmit={handleGroupSubmit}>
          <label>
            <div className="building-page__label">Название папки *</div>
            <input
              className="building-page__input"
              value={groupForm.title}
              onChange={(e) =>
                setGroupForm((prev) => ({ ...prev, title: e.target.value }))
              }
              required
            />
          </label>
          <label>
            <div className="building-page__label">Родительская папка</div>
            <select
              className="building-page__select"
              value={groupForm.parent}
              onChange={(e) =>
                setGroupForm((prev) => ({ ...prev, parent: e.target.value }))
              }
            >
              <option value="">Корневая папка</option>
              {flatGroupOptions
                .filter(
                  (group) =>
                    String(group?.id ?? group?.uuid) !==
                    String(editingGroup?.id ?? editingGroup?.uuid ?? ""),
                )
                .map((group) => {
                  const groupId = group?.id ?? group?.uuid;
                  return (
                    <option key={groupId} value={groupId}>
                      {"".padStart((group.depth || 0) * 2, " ")}
                      {group?.title || "Папка"}
                    </option>
                  );
                })}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={Boolean(groupForm.is_active)}
              onChange={(e) =>
                setGroupForm((prev) => ({
                  ...prev,
                  is_active: e.target.checked,
                }))
              }
            />
            <span className="building-page__label">Активная папка</span>
          </label>
          {groupFormError && (
            <div className="building-page__error">{String(groupFormError)}</div>
          )}
          <div className="building-page__actions">
            <button
              type="button"
              className="building-btn"
              onClick={() => setGroupModalOpen(false)}
              disabled={groupSaving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="building-btn building-btn--primary"
              disabled={groupSaving}
            >
              {groupSaving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={moveModalOpen}
        onClose={() => {
          if (moving) return;
          setMoveModalOpen(false);
        }}
        title="Перенести договоры"
      >
        <form className="building-page" onSubmit={handleMoveTreaties}>
          <div className="building-page__muted">
            Будет перенесено договоров: <b>{selectedTreatyIds.length}</b>
          </div>
          <label>
            <div className="building-page__label">Целевая папка</div>
            <select
              className="building-page__select"
              value={moveTargetGroup}
              onChange={(e) => setMoveTargetGroup(e.target.value)}
            >
              <option value="">Без папки</option>
              {flatGroupOptions.map((group) => {
                const groupId = group?.id ?? group?.uuid;
                return (
                  <option key={groupId} value={groupId}>
                    {"".padStart((group.depth || 0) * 2, " ")}
                    {group?.title || "Папка"}
                  </option>
                );
              })}
            </select>
          </label>
          {moveError && (
            <div className="building-page__error">{String(moveError)}</div>
          )}
          <div className="building-page__actions">
            <button
              type="button"
              className="building-btn"
              onClick={() => setMoveModalOpen(false)}
              disabled={moving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="building-btn building-btn--primary"
              disabled={moving}
            >
              {moving ? "Перенос..." : "Перенести"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={openModal}
        onClose={closeModal}
        title={editing ? "Изменить договор" : "Новый договор"}
      >
        <form className="building-page" onSubmit={handleSubmit}>
          <label>
            <div className="building-page__label">ЖК *</div>
            <select
              className="building-page__select"
              value={form.residential_complex}
              onChange={handleFormChange("residential_complex")}
              required
            >
              <option value="">Выберите ЖК</option>
              {complexesOptions.map((c) => (
                <option key={c.id ?? c.uuid} value={c.id ?? c.uuid}>
                  {c.name || "—"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="building-page__label">Клиент *</div>
            <select
              className="building-page__select"
              value={form.client}
              onChange={handleFormChange("client")}
              required
            >
              <option value="">Выберите клиента</option>
              {clientsOptions.map((c) => (
                <option key={c.id ?? c.uuid} value={c.id ?? c.uuid}>
                  {c.name || "—"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="building-page__label">Номер договора</div>
            <input
              className="building-page__input"
              value={form.number}
              onChange={handleFormChange("number")}
              placeholder="ДГ-001"
            />
          </label>
          <label>
            <div className="building-page__label">Наименование *</div>
            <input
              className="building-page__input"
              value={form.title}
              onChange={handleFormChange("title")}
              placeholder="Договор подряда"
              required
            />
          </label>
          <label>
            <div className="building-page__label">Описание</div>
            <textarea
              className="building-page__textarea"
              rows={3}
              value={form.description}
              onChange={handleFormChange("description")}
              placeholder="Условия договора..."
            />
          </label>
          <label>
            <div className="building-page__label">Квартира</div>
            <select
              className="building-page__select"
              value={form.apartment}
              onChange={handleFormChange("apartment")}
            >
              <option value="">Без выбора квартиры</option>
              {apartmentsOptions.map((a) => (
                <option key={a.id ?? a.uuid} value={a.id ?? a.uuid}>
                  {a.number || "Квартира"}
                  {a.floor != null ? `, этаж ${a.floor}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="building-page__label">Тип операции</div>
            <select
              className="building-page__select"
              value={form.operation_type}
              onChange={handleFormChange("operation_type")}
            >
              {Object.entries(OPERATION_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="building-page__label">Тип оплаты</div>
            <select
              className="building-page__select"
              value={form.payment_type}
              onChange={handleFormChange("payment_type")}
            >
              {Object.entries(PAYMENT_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="building-page__label">Сумма</div>
            <input
              type="number"
              min="0"
              step="0.01"
              className="building-page__input"
              value={form.amount}
              onChange={handleFormChange("amount")}
              placeholder="150000.00"
            />
          </label>
          <label>
            <div className="building-page__label">Первоначальный взнос</div>
            <input
              type="number"
              min="0"
              step="0.01"
              className="building-page__input"
              value={form.down_payment}
              onChange={handleFormChange("down_payment")}
              placeholder="30000.00"
            />
          </label>
          <label>
            <div className="building-page__label">Условия оплаты</div>
            <textarea
              className="building-page__textarea"
              rows={2}
              value={form.payment_terms}
              onChange={handleFormChange("payment_terms")}
              placeholder="Рассрочка на 12 месяцев..."
            />
          </label>
          {form.payment_type === "installment" && (
            <div>
              <div className="building-page__label" style={{ marginTop: 8 }}>
                График рассрочки
              </div>
              <div className="building-table building-table--shadow">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Дата платежа</th>
                      <th>Сумма</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.order ?? idx + 1}</td>
                        <td>
                          <input
                            type="date"
                            className="building-page__input"
                            value={row.due_date}
                            onChange={handleInstallmentChange(idx, "due_date")}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="building-page__input"
                            value={row.amount}
                            onChange={handleInstallmentChange(idx, "amount")}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="building-btn building-btn--danger"
                            onClick={() => removeInstallmentRow(idx)}
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={4}>
                        <button
                          type="button"
                          className="building-btn"
                          onClick={addInstallmentRow}
                        >
                          Добавить платёж
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <label>
            <div className="building-page__label">Статус</div>
            <select
              className="building-page__select"
              value={form.status}
              onChange={handleFormChange("status")}
            >
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.auto_create_in_erp}
              onChange={handleFormChange("auto_create_in_erp")}
            />
            <span className="building-page__label">
              Создавать договор в ERP автоматически
            </span>
          </label>
          {!editing && (
            <>
              <div className="building-page__label" style={{ marginTop: 8 }}>
                Прикрепить файл (необязательно)
              </div>
              <label>
                <div className="building-page__label">Файл</div>
                <input
                  type="file"
                  className="building-page__input"
                  onChange={(e) =>
                    setCreateAttachment((prev) => ({
                      ...prev,
                      file: e.target.files?.[0] ?? null,
                    }))
                  }
                />
              </label>
              <label>
                <div className="building-page__label">Название файла</div>
                <input
                  type="text"
                  className="building-page__input"
                  value={createAttachment.title}
                  onChange={(e) =>
                    setCreateAttachment((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  placeholder="Например: Скан договора"
                />
              </label>
            </>
          )}
          {formError && (
            <div className="building-page__error">{String(formError)}</div>
          )}
          <div className="building-page__actions">
            <button
              type="button"
              className="building-btn"
              onClick={closeModal}
              disabled={creating}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="building-btn building-btn--primary"
              disabled={creating}
            >
              {creating ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(fileModalTreaty)}
        onClose={closeFileModal}
        title="Прикрепить файл к договору"
      >
        <form className="building-page" onSubmit={handleFileSubmit}>
          <label>
            <div className="building-page__label">Файл *</div>
            <input
              type="file"
              className="building-page__input"
              onChange={(e) =>
                setFileForm((prev) => ({
                  ...prev,
                  file: e.target.files?.[0] ?? null,
                }))
              }
              required
            />
          </label>
          <label>
            <div className="building-page__label">Название (необязательно)</div>
            <input
              type="text"
              className="building-page__input"
              value={fileForm.title}
              onChange={(e) =>
                setFileForm((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Например: Скан договора"
            />
          </label>
          {fileUploadError && (
            <div className="building-page__error">
              {String(fileUploadError)}
            </div>
          )}
          <div className="building-page__actions">
            <button
              type="button"
              className="building-btn"
              onClick={closeFileModal}
              disabled={fileUploading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="building-btn building-btn--primary"
              disabled={fileUploading || !fileForm.file}
            >
              {fileUploading ? "Загрузка..." : "Прикрепить"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
