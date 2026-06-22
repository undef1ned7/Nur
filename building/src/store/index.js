import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./slices/userSlice";
import departmentReducer from "./slices/departmentSlice";
import sectorReducer from "./slices/sectorSlice";
import buildingProjectsReducer from "./slices/building/projectsSlice";
import buildingProcurementsReducer from "./slices/building/procurementsSlice";
import buildingProcurementItemsReducer from "./slices/building/procurementItemsSlice";
import buildingCashRegisterReducer from "./slices/building/cashRegisterSlice";
import buildingTransfersReducer from "./slices/building/transfersSlice";
import buildingStockReducer from "./slices/building/stockSlice";
import buildingWorkflowEventsReducer from "./slices/building/workflowEventsSlice";
import buildingWarehousesReducer from "./slices/building/warehousesSlice";
import buildingWorkEntriesReducer from "./slices/building/workEntriesSlice";
import buildingApartmentsReducer from "./slices/building/apartmentsSlice";
import buildingDrawingsReducer from "./slices/building/drawingsSlice";
import buildingClientsReducer from "./slices/building/clientsSlice";
import buildingSuppliersReducer from "./slices/building/suppliersSlice";
import buildingContractorsReducer from "./slices/building/contractorsSlice";
import buildingTreatiesReducer from "./slices/building/treatiesSlice";
import buildingTasksReducer from "./slices/building/tasksSlice";
import buildingSalaryReducer from "./slices/building/salarySlice";
import buildingTreatyInstallmentsReducer from "./slices/building/treatyInstallmentsSlice";

const store = configureStore({
  reducer: {
    user: userReducer,
    departments: departmentReducer,
    sector: sectorReducer,
    buildingProjects: buildingProjectsReducer,
    buildingProcurements: buildingProcurementsReducer,
    buildingProcurementItems: buildingProcurementItemsReducer,
    buildingCashRegister: buildingCashRegisterReducer,
    buildingTransfers: buildingTransfersReducer,
    buildingStock: buildingStockReducer,
    buildingWorkflowEvents: buildingWorkflowEventsReducer,
    buildingWarehouses: buildingWarehousesReducer,
    buildingWorkEntries: buildingWorkEntriesReducer,
    buildingApartments: buildingApartmentsReducer,
    buildingDrawings: buildingDrawingsReducer,
    buildingClients: buildingClientsReducer,
    buildingSuppliers: buildingSuppliersReducer,
    buildingContractors: buildingContractorsReducer,
    buildingTreaties: buildingTreatiesReducer,
    buildingTasks: buildingTasksReducer,
    buildingSalary: buildingSalaryReducer,
    buildingTreatyInstallments: buildingTreatyInstallmentsReducer,
  },
});

export default store;
