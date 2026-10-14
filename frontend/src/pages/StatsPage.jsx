import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Calendar,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  FileSpreadsheet,
  X,
} from 'lucide-react';

export const StatsPage = () => {
  const [salesSummary, setSalesSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [priceHistory, setPriceHistory] = useState([]);
  const [rotation, setRotation] = useState([]);
  const [shrinkageData, setShrinkageData] = useState({ totalLoss: 0, totalItems: 0, totalEvents: 0, movements: [] });
  const [loading, setLoading] = useState(true);

  // Modal new expense
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseCat, setExpenseCat] = useState('SERVICIOS');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [salesRes, expRes, priceRes, rotRes, shrinkRes] = await Promise.all([
        api.get('/stats/sales-summary?period=month'),
        api.get('/stats/expenses'),
        api.get('/stats/price-history'),
        api.get('/stats/inventory-rotation'),
        api.get('/stats/shrinkage?period=month'),
      ]);

      if (salesRes.success) setSalesSummary(salesRes.data);
      if (expRes.success) {
        setExpenses(expRes.data.expenses);
        setExpenseTotal(expRes.data.totalAmount);
      }
      if (priceRes.success) setPriceHistory(priceRes.data);
      if (rotRes.success) setRotation(rotRes.data);
      if (shrinkRes.success) setShrinkageData(shrinkRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    setSavingExpense(true);
    try {
      await api.post('/stats/expenses', {
        category: expenseCat,
        description: expenseDesc,
        amount: parseFloat(expenseAmount),
      });
      setShowExpenseModal(false);
      setExpenseDesc('');
      setExpenseAmount('');
      fetchStats();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingExpense(false);
    }
  };

  const netProfit = (salesSummary?.totalProfit || 0) - expenseTotal - (shrinkageData?.totalLoss || 0);

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Estadísticas, Costos & Reportes</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Métricas de ventas, rotación de insumos, pérdidas por mermas y balance operativo general.
          </p>
        </div>

        <button onClick={() => setShowExpenseModal(true)} className="btn btn-primary">
          <Plus size={17} /> Registrar Gasto Operativo
        </button>
      </div>

      {/* Financial Health Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        <div className="card">
          <span style={{ fontSize: '0.785rem', fontWeight: 700, color: 'var(--text-muted)' }}>INGRESOS BRUTOS</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.5rem' }}>
            ${(salesSummary?.totalRevenue || 0).toFixed(2)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{salesSummary?.salesCount || 0} pedidos del período</span>
        </div>

        <div className="card">
          <span style={{ fontSize: '0.785rem', fontWeight: 700, color: 'var(--text-muted)' }}>COSTO DE INSUMOS VENDIDOS</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            ${(salesSummary?.totalCost || 0).toFixed(2)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Materia prima descontada (FIFO)</span>
        </div>

        <div className="card">
          <span style={{ fontSize: '0.785rem', fontWeight: 700, color: 'var(--text-muted)' }}>GASTOS OPERATIVOS</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--danger)', marginTop: '0.5rem' }}>
            ${expenseTotal.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gas, carbón adicional, servicios</span>
        </div>

        {/* Recuadro de Pérdidas por Mermas */}
        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <span style={{ fontSize: '0.785rem', fontWeight: 700, color: 'var(--danger)' }}>PÉRDIDAS POR MERMAS</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--danger)', marginTop: '0.5rem' }}>
            -${(shrinkageData?.totalLoss || 0).toFixed(2)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {shrinkageData?.totalEvents || 0} descartes ({shrinkageData?.totalItems || 0} unidades/kg)
          </span>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--primary-500)' }}>
          <span style={{ fontSize: '0.785rem', fontWeight: 700, color: 'var(--primary-700)' }}>BENEFICIO NETO ESTIMADO</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: '0.5rem' }}>
            ${netProfit.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Margen bruto: {salesSummary?.profitMarginPct?.toFixed(1) || 0}%</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Price Variation History (Monthly fluctuation) */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Historial de Precios de Materia Prima</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Variación mensual por proveedor</p>
            </div>
            <TrendingUp size={20} color="var(--primary-600)" />
          </div>

          {priceHistory.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No se han registrado variaciones de precio en las compras de insumos.
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Insumo</th>
                    <th>Precio Ant.</th>
                    <th>Nuevo Precio</th>
                    <th>Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {priceHistory.slice(0, 8).map((ph) => {
                    const diff = ph.newPrice - ph.oldPrice;
                    const pct = ph.oldPrice > 0 ? (diff / ph.oldPrice) * 100 : 0;
                    return (
                      <tr key={ph.id}>
                        <td>{new Date(ph.recordedAt).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600 }}>{ph.product?.name}</td>
                        <td>${ph.oldPrice.toFixed(2)}</td>
                        <td style={{ fontWeight: 700 }}>${ph.newPrice.toFixed(2)}</td>
                        <td>
                          <span
                            className={`badge ${diff > 0 ? 'badge-danger' : 'badge-success'}`}
                          >
                            {diff > 0 ? '+' : ''}{pct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Sold Dishes & Inventory Turnover */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Rotación de Menú & Más Vendidos</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Platos con mayor rotación e impacto</p>
            </div>
            <PieChart size={20} color="var(--primary-600)" />
          </div>

          {rotation.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Aún no hay suficientes ventas registradas para calcular la rotación.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {rotation.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.85rem 1rem',
                    backgroundColor: 'var(--bg-main)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: idx === 0 ? 'var(--primary-500)' : 'var(--border-color)',
                        color: idx === 0 ? '#FFF' : 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                      }}
                    >
                      #{idx + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{item.name}</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.unitsSold} raciones despachadas</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: '0.95rem' }}>
                      ${(item.totalRevenue || 0).toFixed(2)}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 600 }}>Alta Rotación</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Operational Expenses Log */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Registro de Gastos Operativos</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Luz, agua, gas, transporte, sueldos</p>
          </div>
          <button onClick={() => setShowExpenseModal(true)} className="btn btn-sm btn-secondary">
            <Plus size={14} /> Añadir Gasto
          </button>
        </div>

        {expenses.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No hay gastos operativos registrados en este período.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th>Monto ($)</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.expenseDate).toLocaleDateString()}</td>
                    <td>
                      <span className="badge badge-primary">{e.category}</span>
                    </td>
                    <td>{e.description}</td>
                    <td style={{ fontWeight: 700, color: 'var(--danger)' }}>-${e.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recuadro de Registro de Pérdidas por Mermas y Vencimientos */}
      <div className="card" style={{ marginTop: '2rem', borderTop: '4px solid var(--danger)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--danger)' }}>
              Registro de Pérdidas por Mermas y Descarte de Insumos Vencidos
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Detalle de materias primas retiradas por fecha de caducidad o merma operativa con impacto financiero.
            </p>
          </div>
          <span className="badge badge-danger" style={{ fontSize: '0.9rem', padding: '0.4rem 0.85rem', fontWeight: 800 }}>
            Pérdida acumulada: -${(shrinkageData?.totalLoss || 0).toFixed(2)}
          </span>
        </div>

        {shrinkageData.movements.length === 0 ? (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-main)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
            }}
          >
            <p style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              No se han registrado mermas ni productos vencidos descartados en este período.
            </p>
            <p style={{ fontSize: '0.8rem' }}>
              El despacho bajo rotación FIFO mantiene el inventario fresco y minimiza las pérdidas.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Materia Prima / Insumo</th>
                  <th>Código Lote</th>
                  <th>Cantidad Descartada</th>
                  <th>Costo Unit. Compra</th>
                  <th>Pérdida Económica ($)</th>
                  <th>Motivo / Razón</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {shrinkageData.movements.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{new Date(m.date).toLocaleDateString()}</div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>{m.productName}</td>
                    <td>
                      <span className="badge badge-secondary">{m.lotCode}</span>
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      {m.quantity} {m.unitOfMeasure}
                    </td>
                    <td>${m.unitCost.toFixed(2)}</td>
                    <td style={{ fontWeight: 800, color: 'var(--danger)' }}>
                      -${m.lossAmount.toFixed(2)}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.reason}</td>
                    <td style={{ fontSize: '0.8rem' }}>{m.userName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Registrar Gasto */}
      {showExpenseModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Registrar Gasto Operativo</h3>
              <button onClick={() => setShowExpenseModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateExpense}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Categoría *</label>
                  <select
                    value={expenseCat}
                    onChange={(e) => setExpenseCat(e.target.value)}
                    className="form-control"
                  >
                    <option value="SERVICIOS">Servicios (Luz, Agua, Gas, Internet)</option>
                    <option value="PERSONAL">Personal / Sueldos</option>
                    <option value="ALQUILER">Alquiler de Local</option>
                    <option value="MANTENIMIENTO">Mantenimiento (Hornos, Freidoras)</option>
                    <option value="PUBLICIDAD">Publicidad & Marketing</option>
                    <option value="OTROS">Otros Gastos</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Recarga balón de gas de 45kg para broster"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Monto ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="form-control"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowExpenseModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={savingExpense} className="btn btn-primary">
                  {savingExpense ? 'Guardando...' : 'Guardar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
