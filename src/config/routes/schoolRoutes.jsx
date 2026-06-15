import { createProtectedRoute } from "./helpers";
import { lazy } from "react";
const SchoolStudents = lazy(() => import("../../Components/Sectors/School/Students/Students"));
const SchoolCoursesGroups = lazy(() => import("../../Components/Sectors/School/CoursesGroups/CoursesGroups"));
const SchoolLessonsRooms = lazy(() => import("../../Components/Sectors/School/LessonsRooms/LessonsRooms"));
const SchoolTeachers = lazy(() => import("../../Components/Sectors/School/Teachers/Teachers"));
const SchoolLeads = lazy(() => import("../../Components/Sectors/School/Leads/Leads"));
const SchoolInvoices = lazy(() => import("../../Components/Sectors/School/Invoices/Invoices"));
const SchoolDocuments = lazy(() => import("../../Components/Sectors/School/Documents/Documents"));

export const schoolRoutes = () => [
  createProtectedRoute("school/students", SchoolStudents),
  createProtectedRoute("school/groups", SchoolCoursesGroups),
  createProtectedRoute("school/lessons", SchoolLessonsRooms),
  createProtectedRoute("school/teachers", SchoolTeachers),
  createProtectedRoute("school/leads", SchoolLeads),
  createProtectedRoute("school/invoices", SchoolInvoices),
  createProtectedRoute("school/documents", SchoolDocuments),
];
