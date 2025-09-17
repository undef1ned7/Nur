
import { createSlice } from '@reduxjs/toolkit';
import { fetchOrdersAsync, fetchOrderByIdAsync, createOrderAsync,deleteOrderAsync,updateOrderAsync } from '../creators/orderCreators'; 

const initialState = {
  list: [], 
  currentOrder: null, 
  count: 0, 
  next: null, 
  previous: null,
  loading: false,
  error: null,
  deleting: false,
  deleteError: null,
    updating: false,
  updateError: null,  
};

const orderSlice = createSlice({
  name: 'order', 
  initialState,
  reducers: {
    clearOrders: (state) => {
      state.list = [];  
      state.count = 0;
      state.next = null;
      state.previous = null;
      state.loading = false;
      state.error = null;
    },
    
    clearCurrentOrder: (state) => {
      state.currentOrder = null;
      state.loading = false; 
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      
      .addCase(fetchOrdersAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOrdersAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.results; 
        state.count = action.payload.count;
        state.next = action.payload.next;
        state.previous = action.payload.previous;
        state.error = null;
      })
      .addCase(fetchOrdersAsync.rejected, (state, action) => {
        state.loading = false;
        state.list = [];
        state.count = 0;
        state.next = null;
        state.previous = null;
        state.error = action.payload;
      })
      
      .addCase(fetchOrderByIdAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.currentOrder = null; 
      })
      .addCase(fetchOrderByIdAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.currentOrder = action.payload; 
        state.error = null;
      })
      .addCase(fetchOrderByIdAsync.rejected, (state, action) => {
        state.loading = false;
        state.currentOrder = null;
        state.error = action.payload;
      })      .addCase(createOrderAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createOrderAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.list.unshift(action.payload); 
        state.count++;
    
        state.error = null;
      })
      .addCase(createOrderAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })      .addCase(deleteOrderAsync.pending, (state) => {
        state.deleting = true;
        state.deleteError = null;
      })
      .addCase(deleteOrderAsync.fulfilled, (state, action) => {
        state.deleting = false;
        // Удаляем заказ из списка по его ID
        state.list = state.list.filter(order => order.id !== action.payload);
        state.count--; 
        state.deleteError = null;
        if (state.currentOrder && state.currentOrder.id === action.payload) {
          state.currentOrder = null;
        }
      })
      .addCase(deleteOrderAsync.rejected, (state, action) => {
        state.deleting = false;
        state.deleteError = action.payload; 
      }) .addCase(updateOrderAsync.pending, (state) => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(updateOrderAsync.fulfilled, (state, action) => {
        state.updating = false;
       
        const index = state.list.findIndex(order => order.id === action.payload.id);
        if (index !== -1) {
          state.list[index] = action.payload; 
        }
        
        if (state.currentOrder && state.currentOrder.id === action.payload.id) {
          state.currentOrder = action.payload;
        }
        state.updateError = null;
      })
      .addCase(updateOrderAsync.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload; 
      });
      
  },
});

export const { clearOrders, clearCurrentOrder } = orderSlice.actions; 
export default orderSlice.reducer; 