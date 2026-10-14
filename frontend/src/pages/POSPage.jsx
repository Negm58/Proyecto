import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  CheckCircle,
  Receipt,
  UtensilsCrossed,
  ArrowRight,
  Flame,
} from 'lucide-react';

export const POSPage = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
  const [processing, setProcessing] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const res = await api.get('/menu/items');
      if (res.success) setMenuItems(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.salePrice * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    setErrorMsg('');

    try {
      const payload = {
        paymentMethod,
        items: cart.map((i) => ({
          menuItemId: i.id,
          quantity: i.quantity,
        })),
      };

      const res = await api.post('/sales', payload);
      if (res.success) {
        setLastSale(res.data);
        setCart([]);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error procesando la venta');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="page-wrapper" style={{ maxWidth: '1600px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.75rem', alignItems: 'start' }}>
        {/* Left: Menu Items Grid */}
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Punto de Venta (Caja)</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Selecciona platos o combos. El inventario de materia prima se descontará automáticamente por FIFO.
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando catálogo...</div>
          ) : menuItems.length === 0 ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No hay platos configurados en el menú.</p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '1rem',
              }}
            >
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="card"
                  onClick={() => addToCart(item)}
                  style={{
                    cursor: 'pointer',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '140px',
                    transition: 'all 0.15s ease',
                    border: '1px solid var(--border-color)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary-400)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div>
                    <span
                      className={`badge ${item.type === 'COMBO' ? 'badge-primary' : 'badge-success'}`}
                      style={{ fontSize: '0.7rem', marginBottom: '0.4rem' }}
                    >
                      {item.type}
                    </span>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.3, marginBottom: '0.35rem' }}>
                      {item.name}
                    </h4>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-600)' }}>
                      ${item.salePrice.toFixed(2)}
                    </span>
                    <button
                      className="btn btn-sm btn-primary"
                      style={{ borderRadius: 'var(--radius-full)', width: '30px', height: '30px', padding: 0 }}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Cart & Ticket Checkout */}
        <div
          className="card"
          style={{
            position: 'sticky',
            top: '5rem',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Receipt size={22} color="var(--primary-600)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Comanda / Ticket</h3>
          </div>

          {errorMsg && (
            <div style={{ padding: '0.65rem', marginBottom: '1rem', backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', fontSize: '0.8rem', borderRadius: 'var(--radius-md)' }}>
              {errorMsg}
            </div>
          )}

          {cart.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ShoppingCart size={36} color="var(--border-color)" style={{ margin: '0 auto 0.75rem' }} />
              <p style={{ fontSize: '0.875rem' }}>El ticket está vacío</p>
              <span style={{ fontSize: '0.75rem' }}>Haz clic en un plato a la izquierda para agregarlo</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', marginBottom: '1.25rem' }}>
              {cart.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>{item.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ${item.salePrice.toFixed(2)} c/u
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        background: '#FFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Minus size={13} />
                    </button>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', minWidth: '18px', textAlign: 'center' }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        background: '#FFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  <div style={{ width: '65px', textAlign: 'right', fontWeight: 800, fontSize: '0.9rem' }}>
                    ${(item.salePrice * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Payment Method */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Forma de Pago</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setPaymentMethod('EFECTIVO')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${paymentMethod === 'EFECTIVO' ? 'var(--primary-500)' : 'var(--border-color)'}`,
                  backgroundColor: paymentMethod === 'EFECTIVO' ? 'var(--primary-50)' : '#FFF',
                  color: paymentMethod === 'EFECTIVO' ? 'var(--primary-700)' : 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                }}
              >
                <Banknote size={16} /> Efectivo
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('TARJETA')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${paymentMethod === 'TARJETA' ? 'var(--primary-500)' : 'var(--border-color)'}`,
                  backgroundColor: paymentMethod === 'TARJETA' ? 'var(--primary-50)' : '#FFF',
                  color: paymentMethod === 'TARJETA' ? 'var(--primary-700)' : 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                }}
              >
                <CreditCard size={16} /> Tarjeta / QR
              </button>
            </div>
          </div>

          {/* Total & Checkout */}
          <div style={{ borderTop: '2px dashed var(--border-color)', paddingTop: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>Total a Pagar:</span>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-600)' }}>
                ${totalAmount.toFixed(2)}
              </span>
            </div>
            <p style={{ fontSize: '0.725rem', color: 'var(--text-light)', textAlign: 'center' }}>
              ⚡ Descuenta automáticamente ingredientes según recetas (FIFO).
            </p>
          </div>

          <button
            onClick={handleCheckout}
            disabled={processing || cart.length === 0}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}
          >
            {processing ? 'Descontando inventario...' : 'Completar Venta (Cobrar)'}
          </button>

          {/* Last Sale Confirmation */}
          {lastSale && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--success-bg)',
                border: '1px solid var(--success-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
              }}
            >
              <CheckCircle size={20} color="var(--success)" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--success)' }}>
                  ¡Venta #{lastSale.id} confirmada!
                </p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Total: ${lastSale.totalAmount.toFixed(2)} ({lastSale.paymentMethod})
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
