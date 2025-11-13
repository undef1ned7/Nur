import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./slices/userSlice";
import orderReducer from "./slices/orderSlice";
import employeeReducer from "./slices/employeeSlice";
import productsReducer from "./slices/productSlice";
import eventReducer from "./slices/eventsSlice";
import notificationReducer from "./slices/notificationSlice";
import analyticsReucer from "./slices/analyticsSlice";
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
import { getProductInvoice, getProductCheckout } from "./slices/saleSlice";

const store = configureStore({
  reducer: {
    user: userReducer,
    order: orderReducer,
    event: eventReducer,
    employee: employeeReducer,
    product: productsReducer,
    notification: notificationReducer,
    analytics: analyticsReucer,
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
