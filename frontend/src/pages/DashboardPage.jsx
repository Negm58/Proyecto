import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  Boxes,
  TrendingUp,
  ArrowUpRight,
  Clock,
  Sparkles,
  ChevronRight,
  Flame,
} from 'lucide-react';

export const DashboardPage = ({ setActiveTab }) => {
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, alertsRes, salesRes] = await Promise.all([
        api.get('/stats/dashboard'),
        api.get('/alerts?isRead=false&limit=5'),
        api.get('/sales?limit=5'),
      ]);

      if (statsRes.success) setMetrics(statsRes.data);
      if (alertsRes.success) setAlerts(alertsRes.data.alerts);
      if (salesRes.success) setRecentSales(salesRes.data.sales);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="page-wrapper">
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1C1917 0%, #292524 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem',
          color: '#FFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '600px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: 'rgba(249, 115, 22, 0.2)',
              border: '1px solid rgba(249, 115, 22, 0.4)',
              color: 'var(--primary-300)',
              padding: '0.3rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 700,
              marginBottom: '0.85rem',
            }}
          >
            <Flame size={14} color="var(--primary-400)" />
            GESTIÓN INTELIGENTE DE RESTAURANTE
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FFF', marginBottom: '0.5rem' }}>
            Panel de Control Operativo
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Monitorea el inventario bajo regla FIFO, verifica las alertas de caducidad en tiempo real y gestiona ventas con descuento automático de materias primas.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', zIndex: 1 }}>
          <button onClick={() => setActiveTab('pos')} className="btn btn-primary" style={{ padding: '0.75rem 1.25rem' }}>
            <ShoppingCart size={18} />
            Punto de Venta
          </button>
          <button onClick={() => setActiveTab('inventory')} className="btn btn-secondary" style={{ padding: '0.75rem 1.25rem' }}>
            <Boxes size={18} />
            Ver Inventario
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        {/* Card 1: Today's Revenue */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-muted)' }}>VENTAS DE HOY</span>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary-100)',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            ${(metrics?.todayRevenue || 0).toFixed(2)}
          </div>
          <p style={{ fontSize: '0.785rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            {metrics?.todaySalesCount || 0} pedidos atendidos
          </p>
        </div>

        {/* Card 2: Low Stock Alert */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-muted)' }}>STOCK CRÍTICO</span>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: (metrics?.lowStockCount || 0) > 0 ? 'var(--danger-bg)' : 'var(--success-bg)',
                color: (metrics?.lowStockCount || 0) > 0 ? 'var(--danger)' : 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: (metrics?.lowStockCount || 0) > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
            {metrics?.lowStockCount || 0}
          </div>
          <p style={{ fontSize: '0.785rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            Insumos bajo el umbral mínimo
          </p>
        </div>

        {/* Card 3: Active Products */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-muted)' }}>INSUMOS ACTIVOS</span>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--info-bg)',
                color: 'var(--info)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Boxes size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {metrics?.totalProducts || 0}
          </div>
          <p style={{ fontSize: '0.785rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            Pollo, papas, carbón, condimentos
          </p>
        </div>

        {/* Card 4: Menu Items */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-muted)' }}>PLATOS Y COMBOS</span>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary-100)',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {metrics?.totalMenuItems || 0}
          </div>
          <p style={{ fontSize: '0.785rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            Recetas con margen validado ≤30%
          </p>
        </div>
      </div>

      {/* Two columns: Alerts & Recent Sales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* Active Alerts */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Alertas Pendientes</h3>
            <button
              onClick={() => setActiveTab('inventory')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-600)',
                fontWeight: 700,
                fontSize: '0.825rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              Gestionar <ChevronRight size={15} />
            </button>
          </div>

          {alerts.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontWeight: 600 }}>No hay alertas activas</p>
              <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>
                Todos los insumos cumplen con el stock mínimo y fechas de caducidad.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: alert.alertType === 'LOW_STOCK' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                  }}
                >
                  <AlertTriangle
                    size={18}
                    color={alert.alertType === 'LOW_STOCK' ? 'var(--danger)' : 'var(--warning)'}
                    style={{ flexShrink: 0, marginTop: '2px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {alert.message}
                    </p>
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sales (FIFO Traceability) */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Últimas Ventas Registradas</h3>
            <button
              onClick={() => setActiveTab('pos')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-600)',
                fontWeight: 700,
                fontSize: '0.825rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              Nueva Venta <ChevronRight size={15} />
            </button>
          </div>

          {recentSales.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontWeight: 600 }}>Aún no hay ventas hoy</p>
              <span style={{ fontSize: '0.8rem' }}>Usa el Punto de Venta para registrar pedidos y descontar stock automáticamente.</span>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Hora</th>
                    <th>Total</th>
                    <th>Método</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale) => (
                    <tr key={sale.id}>
                      <td style={{ fontWeight: 700 }}>#{sale.id}</td>
                      <td>{new Date(sale.saleDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary-700)' }}>
                        ${sale.totalAmount.toFixed(2)}
                      </td>
                      <td>{sale.paymentMethod}</td>
                      <td>
                        <span className="badge badge-success">COMPLETADA</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
