// Группировка мастеров по покрытию выбранных услуг (вся логика на фронте).
// Бэкенд отдаёт только связи услуга→сотрудники (employeeIds); здесь строим множества,
// пересечения и группы для шага «Мастер» страницы бронирования.

/** Нормализует id к строке (id услуг/мастеров могут приходить числом или строкой). */
const sid = (v) => String(v);

/** Достаёт employeeIds услуги из разных возможных форматов ответа бэкенда. */
export const serviceEmployeeIds = (service) => {
  if (Array.isArray(service?.employeeIds)) return service.employeeIds.map(sid);
  if (Array.isArray(service?.employee_ids)) return service.employee_ids.map(sid);
  if (Array.isArray(service?.employees))
    return service.employees.map((e) => sid(e?.id ?? e));
  return [];
};

/** Есть ли вообще данные о связях услуга→мастера среди выбранных услуг. */
export const hasEmployeeLinks = (selectedServices = []) =>
  selectedServices.some((s) => serviceEmployeeIds(s).length > 0);

const masterId = (m) => sid(m?.id ?? m?.master_id ?? m?.user_id ?? m?.pk);
const masterName = (m) =>
  m?.full_name ||
  `${m?.first_name || ""} ${m?.last_name || ""}`.trim() ||
  m?.name ||
  "Мастер";

/**
 * Строит группы мастеров по комбинации покрываемых услуг.
 *
 * @param selectedServices - выбранные услуги (c employeeIds)
 * @param employeesById - map { [employeeId]: { id, name, ... } } из ответа services
 * @param mastersList - запасной список мастеров (если employeesById пуст)
 * @returns {{
 *   mode: "single" | "grouped" | "fallback",
 *   groups: Array<{ key, serviceIds, serviceNames, masters }>,
 *   uncoveredServices: Array<{ id, name }>
 * }}
 */
export const buildMasterGroups = (
  selectedServices = [],
  employeesById = {},
  mastersList = [],
) => {
  const services = selectedServices.map((s) => ({
    id: sid(s.id),
    name: s.name || "Услуга",
    employeeIds: serviceEmployeeIds(s),
  }));

  // Нет данных о связях — fallback на «все мастера»
  if (!hasEmployeeLinks(selectedServices)) {
    const masters = (mastersList || []).map((m) => ({
      id: masterId(m),
      name: masterName(m),
      raw: m,
    }));
    return {
      mode: "fallback",
      groups: [
        {
          key: "all",
          serviceIds: services.map((s) => s.id),
          serviceNames: services.map((s) => s.name),
          masters,
        },
      ],
      uncoveredServices: [],
    };
  }

  // Резолвер сотрудника по id: из employeesById, иначе из mastersList
  const masterFromList = new Map(
    (mastersList || []).map((m) => [masterId(m), m]),
  );
  const resolveEmployee = (id) => {
    const key = sid(id);
    const fromMap = employeesById?.[key] ?? employeesById?.[id];
    if (fromMap) {
      return {
        id: key,
        name: fromMap.name || masterName(fromMap),
        raw: masterFromList.get(key) || fromMap,
      };
    }
    const fromList = masterFromList.get(key);
    if (fromList) return { id: key, name: masterName(fromList), raw: fromList };
    return { id: key, name: "Мастер", raw: { id: key } };
  };

  // Множество всех сотрудников, фигурирующих в выбранных услугах
  const allEmpIds = new Set();
  services.forEach((s) => s.employeeIds.forEach((e) => allEmpIds.add(e)));

  // Для каждого сотрудника — какие из ВЫБРАННЫХ услуг он покрывает
  const empCoverage = new Map(); // empId -> Set(serviceId)
  allEmpIds.forEach((empId) => {
    const covered = new Set();
    services.forEach((s) => {
      if (s.employeeIds.includes(empId)) covered.add(s.id);
    });
    if (covered.size > 0) empCoverage.set(empId, covered);
  });

  // Услуги, которые никто не умеет
  const coveredServiceIds = new Set();
  empCoverage.forEach((set) => set.forEach((id) => coveredServiceIds.add(id)));
  const uncoveredServices = services
    .filter((s) => !coveredServiceIds.has(s.id))
    .map((s) => ({ id: s.id, name: s.name }));

  // Группируем сотрудников по одинаковой комбинации услуг
  const serviceName = new Map(services.map((s) => [s.id, s.name]));
  const groupsMap = new Map(); // comboKey -> { serviceIds, masters }
  empCoverage.forEach((coveredSet, empId) => {
    const serviceIds = services
      .map((s) => s.id)
      .filter((id) => coveredSet.has(id)); // сохраняем порядок выбора
    const key = serviceIds.join("+");
    if (!groupsMap.has(key)) {
      groupsMap.set(key, { serviceIds, masters: [] });
    }
    groupsMap.get(key).masters.push(resolveEmployee(empId));
  });

  let groups = Array.from(groupsMap.entries()).map(([key, g]) => ({
    key,
    serviceIds: g.serviceIds,
    serviceNames: g.serviceIds.map((id) => serviceName.get(id)),
    masters: g.masters.sort((a, b) => a.name.localeCompare(b.name, "ru")),
  }));

  // Сортировка: сначала «покрывают больше услуг», затем по именам комбинации
  groups.sort((a, b) => {
    if (b.serviceIds.length !== a.serviceIds.length)
      return b.serviceIds.length - a.serviceIds.length;
    return a.serviceNames.join(",").localeCompare(b.serviceNames.join(","), "ru");
  });

  const mode = services.length <= 1 ? "single" : "grouped";
  return { mode, groups, uncoveredServices };
};

/**
 * Полностью ли назначения покрывают все выбранные услуги (без повторов).
 * assignments: [{ serviceIds: string[], master }]
 */
export const assignmentsCoverAll = (selectedServices = [], assignments = []) => {
  const need = new Set(selectedServices.map((s) => sid(s.id)));
  const have = new Set();
  assignments.forEach((a) =>
    (a.serviceIds || []).forEach((id) => have.add(sid(id))),
  );
  for (const id of need) if (!have.has(id)) return false;
  return true;
};

/** Множество ещё не назначенных услуг. */
export const remainingServices = (selectedServices = [], assignments = []) => {
  const assigned = new Set();
  assignments.forEach((a) =>
    (a.serviceIds || []).forEach((id) => assigned.add(sid(id))),
  );
  return selectedServices.filter((s) => !assigned.has(sid(s.id)));
};

export { masterId, masterName };
