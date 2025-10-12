import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  fetchEventsApi,
  createEventApi,
  updateEventApi,
  deleteEventApi,
} from "../../api/event";

export const fetchEventsAsync = createAsyncThunk(
  "events/fetchEvents",
  async (params, { rejectWithValue }) => {
    try {
      const response = await fetchEventsApi(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createEventAsync = createAsyncThunk(
  "events/createEvent",
  async (eventData, { rejectWithValue }) => {
    try {
      const newEvent = await createEventApi(eventData);
      return newEvent;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateEventAsync = createAsyncThunk(
  "events/updateEvent",
  async ({ eventId, updatedData }, { rejectWithValue }) => {
    try {
      const updatedEvent = await updateEventApi(eventId, updatedData);
      return updatedEvent;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteEventAsync = createAsyncThunk(
  "events/deleteEvent",
  async (eventId, { rejectWithValue }) => {
    try {
      await deleteEventApi(eventId);
      return eventId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
