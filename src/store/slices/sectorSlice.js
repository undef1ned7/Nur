import { createSlice } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import { mapSectorNameToSlug } from "../../utils/sectorMapping";

const persistSelectedSector = (value) => {
  if (value) localStorage.setItem("selectedSector", value);
  else localStorage.removeItem("selectedSector");
};

const initialState = {
  selected: localStorage.getItem("selectedSector") || null,
};

const sectorSlice = createSlice({
  name: "sector",
  initialState,
  reducers: {
    setSector(state, action) {
      state.selected = action.payload || null;
      persistSelectedSector(state.selected);
    },
    resetSector(state) {
      state.selected = null;
      persistSelectedSector(null);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase("user/fetchCompany/fulfilled", (state, action) => {
        const slug = mapSectorNameToSlug(action.payload?.sector?.name);
        if (slug) {
          state.selected = slug;
          persistSelectedSector(slug);
        }
      })
      .addCase("user/logoutUser", (state) => {
        state.selected = null;
        persistSelectedSector(null);
      });
  },
});

export const { setSector, resetSector } = sectorSlice.actions;
export const useSector = () => useSelector((state) => state.sector);
export const selectSectorSelected = (state) => state.sector.selected;
export default sectorSlice.reducer;
