import { createSlice } from "@reduxjs/toolkit";
const initialState = {
  selected: localStorage.getItem("selectedSector") || null,
};
const sectorSlice = createSlice({
  name: "sector",
  initialState,
  reducers: {
    setSector(state, action) {
      state.selected = action.payload || null;
      if (state.selected)
        localStorage.setItem("selectedSector", state.selected);
      else localStorage.removeItem("selectedSector");
    },
    resetSector(state) {
      state.selected = null;
      localStorage.removeItem("selectedSector");
    },
  },
});
export const { setSector, resetSector } = sectorSlice.actions;
export default sectorSlice.reducer;
