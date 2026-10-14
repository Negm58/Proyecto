import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Boxes,
  UtensilsCrossed,
  ShoppingCart,
  TrendingUp,
  Users,
  Database,
  Flame,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const { user, logout, hasRole } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventario / Insumos', icon: Boxes },
    { id: 'menu', label: 'Menú & Recetario', icon: UtensilsCrossed },
    { id: 'pos', label: 'Punto de Venta (POS)', icon: ShoppingCart },
    { id: 'stats', label: 'Estadísticas & Reportes', icon: TrendingUp },
    ...(hasRole('ADMIN')
      ? [
          { id: 'users', label: 'Usuarios & Roles', icon: Users },
          { id: 'backups', label: 'Copias de Seguridad', icon: Database },
        ]
      : []),
  ];

  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: 'var(--bg-sidebar)',
        color: 'var(--text-white)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        borderRight: '1px solid rgba(255,255,255,0.08)',
        zIndex: 50,
      }}
    >
      <div>
        {/* Brand Header */}
        <div
          style={{
            padding: '1.5rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(249, 115, 22, 0.4)',
              flexShrink: 0,
            }}
          >
            <Flame size={24} color="#FFF" />
          </div>
          <div>
            <h2
              style={{
                fontSize: '1.05rem',
                fontWeight: 800,
                color: '#FFF',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              Pollos
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--primary-400)', fontWeight: 600 }}>
              La Llovizna
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: '1.25rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div
            style={{
              padding: '0.25rem 0.75rem 0.6rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            Módulos del Sistema
          </div>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: isActive ? 'var(--primary-500)' : 'transparent',
                  color: isActive ? '#FFF' : 'rgba(255,255,255,0.7)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 4px 12px rgba(249, 115, 22, 0.35)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-sidebar-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Icon size={19} color={isActive ? '#FFF' : 'rgba(255,255,255,0.6)'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* User profile & logout bottom */}
      <div
        style={{
          padding: '1.25rem',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          backgroundColor: 'rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--primary-700)',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.9rem',
              flexShrink: 0,
            }}
          >
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#FFF',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.name || 'Usuario'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShieldCheck size={13} color="var(--primary-400)" />
              <span style={{ fontSize: '0.725rem', color: 'rgba(255,255,255,0.5)' }}>
                {user?.roles?.[0] || 'Personal'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            width: '100%',
            padding: '0.6rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255,255,255,0.12)',
            backgroundColor: 'transparent',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '0.825rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            e.currentTarget.style.color = '#FCA5A5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
          }}
        >
          <LogOut size={15} />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
};
