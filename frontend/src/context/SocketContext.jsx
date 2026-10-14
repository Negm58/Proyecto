import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_WS_URL || 'http://localhost:5000';
    const s = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => {
      console.log('🔌 Conectado al servidor WebSocket');
    });

    s.on('alert:new', (alert) => {
      addToast({
        id: Date.now(),
        type: alert.alertType === 'LOW_STOCK' || alert.alertType === 'EXPIRED' ? 'danger' : 'warning',
        title: alert.alertType === 'LOW_STOCK' ? 'Stock Crítico' : 'Alerta de Lote',
        message: alert.message,
      });
      setUnreadAlertCount((prev) => prev + 1);
    });

    s.on('inventory:lotAdded', (lot) => {
      addToast({
        id: Date.now(),
        type: 'success',
        title: 'Lote Ingresado',
        message: `Se registró nuevo lote para ${lot.product?.name || 'producto'} (+${lot.quantityInitial})`,
      });
    });

    s.on('sale:created', (sale) => {
      addToast({
        id: Date.now(),
        type: 'info',
        title: 'Venta Registrada',
        message: `Venta #${sale.id} completada ($${sale.totalAmount.toFixed(2)}). Stock actualizado (FIFO).`,
      });
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  const addToast = (toast) => {
    setToasts((prev) => [toast, ...prev.slice(0, 4)]);
    setTimeout(() => {
      removeToast(toast.id);
    }, 6000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <SocketContext.Provider value={{ socket, toasts, removeToast, addToast, unreadAlertCount, setUnreadAlertCount }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
