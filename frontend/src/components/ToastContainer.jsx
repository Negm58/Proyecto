import React from 'react';
import { useSocket } from '../context/SocketContext';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

export const ToastContainer = () => {
  const { toasts, removeToast } = useSocket();

  if (!toasts || toasts.length === 0) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'danger':
        return <AlertCircle size={20} className="text-red-500" />;
      case 'warning':
        return <AlertTriangle size={20} className="text-amber-500" />;
      case 'success':
        return <CheckCircle size={20} className="text-emerald-500" />;
      default:
        return <Info size={20} className="text-blue-500" />;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '1.25rem',
        right: '1.25rem',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        maxWidth: '380px',
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            pointerEvents: 'auto',
            background: 'white',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            animation: 'toastIn 0.3s ease forwards',
            borderLeft: `5px solid ${
              toast.type === 'danger'
                ? 'var(--danger)'
                : toast.type === 'warning'
                ? 'var(--warning)'
                : toast.type === 'success'
                ? 'var(--success)'
                : 'var(--info)'
            }`,
          }}
        >
          <div style={{ flexShrink: 0, marginTop: '2px' }}>{getIcon(toast.type)}</div>
          <div style={{ flex: 1 }}>
            <h5 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '2px' }}>{toast.title}</h5>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.4, whiteSpace: 'pre-line' }}>{toast.message}</p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-light)',
              padding: '2px',
            }}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
