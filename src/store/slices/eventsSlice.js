
import { createSlice } from '@reduxjs/toolkit';
import {
  fetchEventsAsync,
  createEventAsync,
  updateEventAsync,
  deleteEventAsync,
} from '../creators/eventsCreators'; 

const initialState = {
  list: [], 
  count: 0, 
  next: null, 
  previous: null, 
  loading: false, 
  error: null, 
  creating: false, 
  createError: null, 
  updating: false, 
  updateError: null, 
  deleting: false, 
  deleteError: null, 
};

const eventSlice = createSlice({
  name: 'event', 
  initialState,
  reducers: {
    clearEvents: (state) => {
      state.list = [];
      state.count = 0;
      state.next = null;
      state.previous = null;
      state.loading = false;
      state.error = null;
      state.creating = false;
      state.createError = null;
      state.updating = false;
      state.updateError = null;
      state.deleting = false;
      state.deleteError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEventsAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEventsAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.results;
        state.count = action.payload.count;
        state.next = action.payload.next;
        state.previous = action.payload.previous;
      })
      .addCase(fetchEventsAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createEventAsync.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createEventAsync.fulfilled, (state, action) => {
        state.creating = false;
        state.list.unshift(action.payload); 
        state.count += 1; 
      })
      .addCase(createEventAsync.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload;
      })
      .addCase(updateEventAsync.pending, (state) => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(updateEventAsync.fulfilled, (state, action) => {
        state.updating = false;
        const index = state.list.findIndex(event => event.id === action.payload.id);
        if (index !== -1) {
          state.list[index] = action.payload;
        }
      })
      .addCase(updateEventAsync.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload;
      })
      .addCase(deleteEventAsync.pending, (state) => {
        state.deleting = true;
        state.deleteError = null;
      })
      .addCase(deleteEventAsync.fulfilled, (state, action) => {
        state.deleting = false;
        state.list = state.list.filter(event => event.id !== action.payload);
        state.count -= 1; 
      })
      .addCase(deleteEventAsync.rejected, (state, action) => {
        state.deleting = false;
        state.deleteError = action.payload;
      });
  },
});

export const { clearEvents } = eventSlice.actions; 
export default eventSlice.reducer; 