import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { ToastContainer } from './components/ToastContainer';
import { AiAssistant } from './components/AiAssistant';
import { ErrorBoundary } from './components/ErrorBoundary';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { MenuPage } from './pages/MenuPage';
import { POSPage } from './pages/POSPage';
import { StatsPage } from './pages/StatsPage';
import { UsersPage } from './pages/UsersPage';
import { BackupsPage } from './pages/BackupsPage';

const MainLayout = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#171513',
          color: '#FFF',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        <div style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--primary-500)' }}>
          🍗 Pollo al Carbón & Broster
        </div>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>Cargando sistema de inventario...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Panel Principal & Métricas';
      case 'inventory':
        return 'Gestión de Inventario (Lotes FIFO)';
      case 'menu':
        return 'Menú, Platos & Recetario';
      case 'pos':
        return 'Punto de Venta (Caja)';
      case 'stats':
        return 'Estadísticas & Rentabilidad';
      case 'users':
        return 'Usuarios & Control de Acceso (RBAC)';
      case 'backups':
        return 'Copias de Seguridad (Backups)';
      default:
        return 'Sistema de Inventario';
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage setActiveTab={setActiveTab} />;
      case 'inventory':
        return <InventoryPage />;
      case 'menu':
        return <MenuPage />;
      case 'pos':
        return <POSPage />;
      case 'stats':
        return <StatsPage />;
      case 'users':
        return <UsersPage />;
      case 'backups':
        return <BackupsPage />;
      default:
        return <DashboardPage setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="main-content">
        <Navbar activeTitle={getPageTitle()} />
        <main style={{ flex: 1 }}>{renderContent()}</main>
      </div>

      {/* Floating AI Assistant */}
      <AiAssistant />

      {/* Real-time Toast Alerts Container */}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ErrorBoundary>
          <MainLayout />
        </ErrorBoundary>
      </SocketProvider>
    </AuthProvider>
  );
}
