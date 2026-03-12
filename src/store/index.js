import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./slices/userSlice";
import orderReducer from "./slices/orderSlice";
import employeeReducer from "./slices/employeeSlice";
import productsReducer from "./slices/productSlice";
import eventReducer from "./slices/eventsSlice";
import notificationReducer from "./slices/notificationSlice";
import analyticsReucer from "./slices/analyticsSlice";
import logisticsReducer from "./slices/logisticsSlice";
import departmentReducer from "./slices/departmentSlice"; // Импортируем редюсер для департаментов
import clientReducer from "./slices/ClientSlice"; // Импортируем редюсер для клиентов
import saleReducer from "./slices/saleSlice";
import instagramReducer from "./slices/InstagramSlice";
import cashReducer from "./slices/cashSlice";
import jobsReducer from "./slices/jobsSlice";
import uiReducer from "./slices/uiSlice";
import consultingReducer from "./slices/consultingSlice";
import transferReducer from "./slices/transferSlice";
import acceptanceReducer from "./slices/acceptanceSlice";
import returnReducer from "./slices/returnSlice";
import agentReducer from "./slices/agentSlice";
import agentCartReducer from "./slices/agentCartSlice";
import catalogReducer from "./slices/catalogSlice";
import cartReducer from "./slices/cartSlice";
import cafeOrdersReducer from "./slices/cafeOrdersSlice";
import branchReducer from "./slices/branchSlice";
import shiftReducer from "./slices/shiftSlice";
import warehouseReducer from "./slices/warehouseSlice";
import counterpartyReducer from "./slices/counterpartySlice";
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
// import { getProductInvoice, getProductCheckout } from "./slices/saleSlice";

const store = configureStore({
  reducer: {
    user: userReducer,
    order: orderReducer,
    event: eventReducer,
    employee: employeeReducer,
    product: productsReducer,
    notification: notificationReducer,
    analytics: analyticsReucer,
    logistics: logisticsReducer,
    departments: departmentReducer,
    client: clientReducer,
    sale: saleReducer,
    instagram: instagramReducer,
    cash: cashReducer,
    jobs: jobsReducer,
    ui: uiReducer,
    consulting: consultingReducer,
    transfer: transferReducer,
    acceptance: acceptanceReducer,
    return: returnReducer,
    agent: agentReducer,
    agentCart: agentCartReducer,
    catalog: catalogReducer,
    cart: cartReducer,
    cafeOrders: cafeOrdersReducer,
    branches: branchReducer,
    shifts: shiftReducer,
    warehouse: warehouseReducer,
    counterparty: counterpartyReducer,
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
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // игнорим только нужные action.type, чтобы не отключать проверку глобально
        ignoredActions: [
          "products/getProductInvoice/fulfilled",
          "products/getProductCheckout/fulfilled",
        ],
      },
    }),
});

export * from "./slices/uiSlice";
export * from "./slices/jobsSlice";
export default store;
