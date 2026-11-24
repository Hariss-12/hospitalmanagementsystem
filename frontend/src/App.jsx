import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar, ProtectedRoute } from './components/HospitalComponents';

import LandingPage from './pages/LandingPage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DoctorDirectoryPage from './pages/DoctorDirectoryPage';
import BookAppointmentPage from './pages/BookAppointmentPage';
import RescheduleAppointmentPage from './pages/RescheduleAppointmentPage';
import AppointmentHistoryPage from './pages/AppointmentHistoryPage';
import DFAVisualizationPage from './pages/DFAVisualizationPage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import { UnauthorizedPage, NotFoundPage } from './pages/ErrorPages';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/doctors" element={<DoctorDirectoryPage />} />
              <Route path="/dfa-visualizer" element={<DFAVisualizationPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* Role-Protected Dashboards */}
              <Route
                path="/patient/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['Patient']}>
                    <PatientDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctor/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['Doctor']}>
                    <DoctorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['Administrator']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Protected Appointment & Profile Routes */}
              <Route
                path="/appointments/book"
                element={
                  <ProtectedRoute allowedRoles={['Patient', 'Administrator']}>
                    <BookAppointmentPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/appointments/:id/reschedule"
                element={
                  <ProtectedRoute allowedRoles={['Patient', 'Doctor', 'Administrator']}>
                    <RescheduleAppointmentPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/appointments/history"
                element={
                  <ProtectedRoute allowedRoles={['Patient', 'Doctor', 'Administrator']}>
                    <AppointmentHistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute allowedRoles={['Patient', 'Doctor', 'Administrator']}>
                    <ProfileSettingsPage />
                  </ProtectedRoute>
                }
              />

              {/* 404 Fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
