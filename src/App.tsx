import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'
import { NotificationsProvider } from '@/hooks/useNotifications'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { OwnerDashboard } from '@/pages/owner/OwnerDashboard'
import { ClientsPage } from '@/pages/owner/ClientsPage'
import { ProcurementPage } from '@/pages/owner/ProcurementPage'
import { ProcurementFormPage } from '@/pages/owner/ProcurementFormPage'
import { ShipmentsPage } from '@/pages/owner/ShipmentsPage'
import { ShipmentFormPage } from '@/pages/owner/ShipmentFormPage'
import { FinancePage } from '@/pages/owner/FinancePage'
import { EmployeesPage } from '@/pages/owner/EmployeesPage'
import { HubOverviewPage } from '@/pages/owner/HubOverviewPage'
import { WarehouseDashboard } from '@/pages/warehouse/WarehouseDashboard'
import {
  WarehouseProcurementListPage,
  WarehouseProcurementDetailPage,
} from '@/pages/warehouse/WarehouseProcurementPage'
import {
  WarehouseShipmentsListPage,
  WarehouseShipmentDetailPage,
} from '@/pages/warehouse/WarehouseShipmentsPage'
import { WarehouseShipmentCreatePage } from '@/pages/warehouse/WarehouseShipmentCreatePage'
import { WarehouseClientsPage } from '@/pages/warehouse/WarehouseClientsPage'
import { ClientPortal, ClientShipmentDetail } from '@/pages/client/ClientPortal'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/notifications" element={<NotificationsPage />} />

              <Route
                path="/owner"
                element={
                  <ProtectedRoute allowedRoles={['owner']}>
                    <OwnerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/owner/clients"
                element={
                  <ProtectedRoute allowedRoles={['owner']}>
                    <ClientsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/owner/procurement"
                element={
                  <ProtectedRoute allowedRoles={['owner']}>
                    <ProcurementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/owner/procurement/:id"
                element={
                  <ProtectedRoute allowedRoles={['owner']}>
                    <ProcurementFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/owner/shipments"
                element={
                  <ProtectedRoute allowedRoles={['owner']}>
                    <ShipmentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/owner/shipments/:id"
                element={
                  <ProtectedRoute allowedRoles={['owner']}>
                    <ShipmentFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/owner/finance"
                element={
                  <ProtectedRoute allowedRoles={['owner']}>
                    <FinancePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/owner/employees"
                element={
                  <ProtectedRoute allowedRoles={['owner']}>
                    <EmployeesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/owner/hubs"
                element={
                  <ProtectedRoute allowedRoles={['owner']}>
                    <HubOverviewPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/warehouse"
                element={
                  <ProtectedRoute allowedRoles={['warehouse_manager']}>
                    <WarehouseDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/warehouse/procurement"
                element={
                  <ProtectedRoute allowedRoles={['warehouse_manager']}>
                    <WarehouseProcurementListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/warehouse/procurement/:id"
                element={
                  <ProtectedRoute allowedRoles={['warehouse_manager']}>
                    <WarehouseProcurementDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/warehouse/shipments"
                element={
                  <ProtectedRoute allowedRoles={['warehouse_manager']}>
                    <WarehouseShipmentsListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/warehouse/shipments/new"
                element={
                  <ProtectedRoute allowedRoles={['warehouse_manager']}>
                    <WarehouseShipmentCreatePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/warehouse/shipments/:id"
                element={
                  <ProtectedRoute allowedRoles={['warehouse_manager']}>
                    <WarehouseShipmentDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/warehouse/clients"
                element={
                  <ProtectedRoute allowedRoles={['warehouse_manager']}>
                    <WarehouseClientsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/client"
                element={
                  <ProtectedRoute allowedRoles={['client']}>
                    <ClientPortal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/client/shipments/:id"
                element={
                  <ProtectedRoute allowedRoles={['client']}>
                    <ClientShipmentDetail />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
        </NotificationsProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
