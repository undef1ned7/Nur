import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import {
  fetchBuildingWarehouseStockItems,
  fetchBuildingWarehouseStockMoves,
} from "../../creators/building/stockCreators";

const listFrom = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload)) return payload;
  return [];
};

const initialState = {
  items: [],
  itemsLoading: false,
  itemsLoaded: false,
  itemsError: null,

  moves: [],
  movesLoading: false,
  movesLoaded: false,
  movesError: null,
};

const buildingStockSlice = createSlice({
  name: "buildingStock",
  initialState,
  reducers: {
    clearBuildingStock: (state) => {
      state.items = [];
      state.itemsLoading = false;
      state.itemsLoaded = false;
      state.itemsError = null;
      state.moves = [];
      state.movesLoading = false;
      state.movesLoaded = false;
      state.movesError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBuildingWarehouseStockItems.pending, (state) => {
        state.itemsLoading = true;
        state.itemsLoaded = false;
        state.itemsError = null;
      })
      .addCase(fetchBuildingWarehouseStockItems.fulfilled, (state, action) => {
        state.itemsLoading = false;
        state.itemsLoaded = true;
        state.items = listFrom(action.payload);
      })
      .addCase(fetchBuildingWarehouseStockItems.rejected, (state, action) => {
        state.itemsLoading = false;
        state.itemsLoaded = true;
        state.itemsError = action.payload ?? action.error?.message;
      })
      .addCase(fetchBuildingWarehouseStockMoves.pending, (state) => {
        state.movesLoading = true;
        state.movesLoaded = false;
        state.movesError = null;
      })
      .addCase(fetchBuildingWarehouseStockMoves.fulfilled, (state, action) => {
        state.movesLoading = false;
        state.movesLoaded = true;
        state.moves = listFrom(action.payload);
      })
      .addCase(fetchBuildingWarehouseStockMoves.rejected, (state, action) => {
        state.movesLoading = false;
        state.movesLoaded = true;
        state.movesError = action.payload ?? action.error?.message;
      });
  },
});

export const { clearBuildingStock } = buildingStockSlice.actions;

export default buildingStockSlice.reducer;

export const useBuildingStock = () => useSelector((state) => state.buildingStock);

