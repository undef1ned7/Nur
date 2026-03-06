import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api";

// Моки данных для локального использования (KitchenTask формат)
const MOCK_TASKS = [
  {
    id: "9d77a6ae-6b2d-4a3e-8a11-1e6d75a2e7ad",
    company: "a7cf7d6b-1d0e-44f5-9a6b-781b0a1b3b4e",
    branch: "e5a5e9b1-6c3f-4d18-b2e2-b3de0d302ac4",
    status: "pending",
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    started_at: null,
    finished_at: null,
    order: "b3c6c6d4-0d43-4eb6-9f9c-9d0b8a9f2d91",
    order_item: "8b6d0ab8-1c6d-4ad9-9f65-0db10e8cb3f2",
    menu_item: "d6b0d2e1-3f1c-4ab2-8d1a-2f0a2de3b4c5",
    table_number: 12,
    guest: "Иван",
    waiter: 57,
    waiter_label: "Мария Петрова",
    cook: null,
    unit_index: 1,
    menu_item_title: "Паста Карбонара",
    price: "390.00",
  },
  {
    id: "8c66b5bd-5a1c-3d2f-7a00-0d5c64a1d6be",
    company: "a7cf7d6b-1d0e-44f5-9a6b-781b0a1b3b4e",
    branch: "e5a5e9b1-6c3f-4d18-b2e2-b3de0d302ac4",
    status: "in_progress",
    created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    started_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    finished_at: null,
    order: "b3c6c6d4-0d43-4eb6-9f9c-9d0b8a9f2d91",
    order_item: "7a5c5b7a-0c32-3da5-8e54-0ca09f8e1d0a",
    menu_item: "c5a0c1d0-2e0b-3a91-7c03-1e0a1c2d3e4f",
    table_number: 12,
    guest: "Иван",
    waiter: 57,
    waiter_label: "Мария Петрова",
    cook: 73,
    unit_index: 2,
    menu_item_title: "Лагман",
    price: "350.00",
  },
  {
    id: "7b55a4ac-490b-2c1e-6900-0c4b53a0c5ad",
    company: "a7cf7d6b-1d0e-44f5-9a6b-781b0a1b3b4e",
    branch: "e5a5e9b1-6c3f-4d18-b2e2-b3de0d302ac4",
    status: "ready",
    created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    started_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    finished_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    order: "a2b5b5c3-0c32-3da5-8e54-0ca09f8e1d0a",
    order_item: "6a4b4a69-0b21-2c94-7d43-0b908e7d0c9a",
    menu_item: "b4a0b0c9-1d0a-2908-6b02-0d908b6c2d3e",
    table_number: 5,
    guest: "Петр",
    waiter: 58,
    waiter_label: "Анна Смирнова",
    cook: 73,
    unit_index: 1,
    menu_item_title: "Чай черный",
    price: "40.00",
  },
  {
    id: "6a44a3ab-380a-1b0d-5800-0b3a42a9b4ac",
    company: "a7cf7d6b-1d0e-44f5-9a6b-781b0a1b3b4e",
    branch: "e5a5e9b1-6c3f-4d18-b2e2-b3de0d302ac4",
    status: "pending",
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    started_at: null,
    finished_at: null,
    order: "a2b5b5c3-0c32-3da5-8e54-0ca09f8e1d0a",
    order_item: "5a3a3a58-0a10-1b83-6c32-0a807d6c0b9a",
    menu_item: "a3a0a0b8-0c09-1807-5a01-0c807a5b1c2d",
    table_number: 3,
    guest: "Мария",
    waiter: 59,
    waiter_label: "Ольга Иванова",
    cook: null,
    unit_index: 1,
    menu_item_title: "Хлеб",
    price: "30.00",
  },
];

// Флаг для использования моков (false = использовать реальный API)
const USE_MOCKS = false;

// Получение списка задач кухни
export const fetchKitchenTasksAsync = createAsyncThunk(
  "cafeOrders/fetchTasks",
  async (params = {}, { rejectWithValue }) => {
    try {
      if (USE_MOCKS) {
        // Имитация задержки сети
        await new Promise((resolve) => setTimeout(resolve, 500));

        let tasks = [...MOCK_TASKS];

        // Фильтрация по статусу
        if (params.status) {
          tasks = tasks.filter((t) => t.status === params.status);
        } else if (
          !params.status &&
          params.mine !== "1" &&
          params.mine !== true
        ) {
          // По умолчанию показываем pending и in_progress
          tasks = tasks.filter(
            (t) => t.status === "pending" || t.status === "in_progress"
          );
        }

        // Фильтр mine (только задачи текущего повара)
        if (params.mine === "1" || params.mine === true) {
          // В моках предполагаем, что текущий повар имеет id 73
          tasks = tasks.filter((t) => t.cook === 73 || t.status === "pending");
        }

        // Сортировка
        if (params.ordering) {
          const [field, direction] = params.ordering.startsWith("-")
            ? [params.ordering.slice(1), "desc"]
            : [params.ordering, "asc"];

          tasks.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];

            if (field.includes("_at")) {
              aVal = aVal ? new Date(aVal).getTime() : 0;
              bVal = bVal ? new Date(bVal).getTime() : 0;
            }

            if (direction === "desc") {
              return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
            }
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
          });
        } else {
          // Сортировка по умолчанию: -created_at
          tasks.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          );
        }

        return {
          count: tasks.length,
          results: tasks,
        };
      }
      const response = await api.get("/cafe/kitchen/tasks", { params });

      // Обрабатываем ответ - может быть {results: [], count: 0} или просто массив
      const data = response.data;
      if (Array.isArray(data)) {
        return { count: data.length, results: data };
      }
      return data;
    } catch (error) {
      return rejectWithValue(
        error?.response?.data || error?.message || "Ошибка загрузки задач"
      );
    }
  }
);

// Взять задачу в работу
export const claimKitchenTaskAsync = createAsyncThunk(
  "cafeOrders/claimTask",
  async (taskIdsArg, { rejectWithValue, getState }) => {
    try {
      const tasks_ids = Array.isArray(taskIdsArg)
        ? taskIdsArg
        : Array.isArray(taskIdsArg?.tasks_ids)
          ? taskIdsArg.tasks_ids
          : taskIdsArg
            ? [taskIdsArg]
            : [];

      if (!tasks_ids.length) {
        throw new Error("tasks_ids пустой");
      }

      if (USE_MOCKS) {
        // Имитация задержки сети
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Находим задачи в состоянии и обновляем их
        const state = getState();
        const updatedTasks = [];
        for (const id of tasks_ids) {
          const task = state.cafeOrders.tasks.find((t) => t.id === id);
          if (!task) {
            throw new Error("Задача не найдена");
          }

          if (task.status !== "pending") {
            throw new Error("Задача уже не pending");
          }

          if (task.cook !== null) {
            throw new Error("Задача уже назначена повару");
          }

          updatedTasks.push({
            ...task,
            status: "in_progress",
            cook: 73, // В моках предполагаем текущего повара
            started_at: new Date().toISOString(),
          });
        }

        return updatedTasks;
      }

      // Реальный API вызов
      const response = await api.post(`/cafe/kitchen/tasks/claim/`, { task_ids: tasks_ids });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error?.response?.data || error?.message || "Ошибка взятия задачи"
      );
    }
  }
);

// Отметить задачу как готово
export const readyKitchenTaskAsync = createAsyncThunk(
  "cafeOrders/readyTask",
  async (taskIdsArg, { rejectWithValue, getState }) => {
    try {
      const tasks_ids = Array.isArray(taskIdsArg)
        ? taskIdsArg
        : Array.isArray(taskIdsArg?.tasks_ids)
          ? taskIdsArg.tasks_ids
          : taskIdsArg
            ? [taskIdsArg]
            : [];

      if (!tasks_ids.length) {
        throw new Error("tasks_ids пустой");
      }

      if (USE_MOCKS) {
        // Имитация задержки сети
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Находим задачи в состоянии и обновляем их
        const state = getState();
        const updatedTasks = [];
        for (const id of tasks_ids) {
          const task = state.cafeOrders.tasks.find((t) => t.id === id);
          if (!task) {
            throw new Error("Задача не найдена");
          }

          if (task.status !== "in_progress") {
            throw new Error("Задача не в работе");
          }

          // В моках предполагаем, что текущий повар имеет id 73
          if (task.cook !== 73) {
            throw new Error("Задача не принадлежит вам");
          }

          updatedTasks.push({
            ...task,
            status: "ready",
            finished_at: new Date().toISOString(),
          });
        }

        return updatedTasks;
      }

      // Реальный API вызов
      const response = await api.post(`/cafe/kitchen/tasks/ready/`, { task_ids: tasks_ids });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error?.response?.data || error?.message || "Ошибка отметки готово"
      );
    }
  }
);
