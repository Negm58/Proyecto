import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import { Bell, Wifi, Check, Trash2 } from 'lucide-react';

export const Navbar = ({ activeTitle }) => {
  const { unreadAlertCount, setUnreadAlertCount } = useSocket();
  const [alerts, setAlerts] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/alerts?isRead=false&limit=8');
      if (res.success && res.data) {
        setAlerts(res.data.alerts);
        setUnreadAlertCount(res.data.unreadCount);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [unreadAlertCount]);

  const markAllRead = async () => {
    try {
      await api.put('/alerts/mark-all-read');
      setAlerts([]);
      setUnreadAlertCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header
      style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid var(--border-color)',
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          {activeTitle}
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Sistema de Control & Abastecimiento Automatizado
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {/* Status pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            color: 'var(--success)',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}
        >
          <Wifi size={13} />
          <span>EN LÍNEA (WS)</span>
        </div>

        {/* Notifications Bell */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              position: 'relative',
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              backgroundColor: showDropdown ? 'var(--primary-50)' : '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-main)',
              transition: 'all 0.2s',
            }}
          >
            <Bell size={19} />
            {unreadAlertCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: 'var(--danger)',
                  color: '#FFF',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  width: '18px',
                  height: '18px',
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 5px rgba(220, 38, 38, 0.4)',
                }}
              >
                {unreadAlertCount > 9 ? '9+' : unreadAlertCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '50px',
                right: 0,
                width: '340px',
                backgroundColor: '#FFF',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-xl)',
                overflow: 'hidden',
                zIndex: 100,
              }}
            >
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--bg-main)',
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Alertas del Sistema</span>
                {alerts.length > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-600)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <Check size={14} /> Marcar todas leídas
                  </button>
                )}
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {alerts.length === 0 ? (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '0.85rem' }}>No hay alertas activas</p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Stock y lotes bajo control ✨</span>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      style={{
                        padding: '0.85rem 1rem',
                        borderBottom: '1px solid var(--border-subtle)',
                        fontSize: '0.825rem',
                        lineHeight: 1.4,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span
                          className={`badge ${
                            alert.alertType === 'LOW_STOCK' ? 'badge-danger' : 'badge-warning'
                          }`}
                          style={{ fontSize: '0.7rem' }}
                        >
                          {alert.alertType === 'LOW_STOCK' ? 'Stock Bajo' : 'Vencimiento'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                          {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-main)', marginTop: '4px' }}>{alert.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
