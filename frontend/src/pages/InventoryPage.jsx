import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  PackagePlus,
  History,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Calendar,
  X,
  RefreshCw,
  Pencil,
  Trash2,
  Clock,
  ShieldAlert,
  Flame,
  Info,
} from 'lucide-react';

export const InventoryPage = () => {
  const { socket } = useSocket();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [expiredLots, setExpiredLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'expired'
  
  // Modales
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null = crear, object = editar
  const [showLotModal, setShowLotModal] = useState(false);
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [movements, setMovements] = useState([]);

  // Form states
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    unitOfMeasure: 'KG',
    currentPrice: '',
    minStockThreshold: '',
  });

  const [newLot, setNewLot] = useState({
    productId: '',
    supplierId: '',
    quantity: '',
    purchasePrice: '',
    expirationDate: '',
    lotCode: '',
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusBanner, setStatusBanner] = useState('');
  const [validating, setValidating] = useState(false);
  const [discardingId, setDiscardingId] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, supRes, expRes] = await Promise.allSettled([
        api.get('/products'),
        api.get('/categories'),
        api.get('/suppliers'),
        api.get('/inventory/expired-lots'),
      ]);

      if (prodRes.status === 'fulfilled' && prodRes.value?.success) {
        const prodData = Array.isArray(prodRes.value.data) ? prodRes.value.data : [];
        setProducts(
          prodData.map((p) => ({
            ...p,
            currentStock: Number(p?.currentStock ?? p?.totalStock ?? 0),
            minStockThreshold: Number(p?.minStockThreshold ?? 0),
            currentPrice: Number(p?.currentPrice ?? 0),
          }))
        );
      }
      if (catRes.status === 'fulfilled' && catRes.value?.success) {
        setCategories(Array.isArray(catRes.value.data) ? catRes.value.data : []);
      }
      if (supRes.status === 'fulfilled' && supRes.value?.success) {
        setSuppliers(Array.isArray(supRes.value.data) ? supRes.value.data : []);
      }
      if (expRes.status === 'fulfilled' && expRes.value?.success) {
        setExpiredLots(Array.isArray(expRes.value.data) ? expRes.value.data : []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (!socket) return undefined;
    const refresh = () => fetchData();
    const events = ['product:created', 'product:updated', 'product:deleted', 'inventory:lotAdded', 'inventory:lotDiscarded', 'sale:created'];
    events.forEach((ev) => socket.on(ev, refresh));
    return () => events.forEach((ev) => socket.off(ev, refresh));
  }, [socket]);

  // Abrir modal de producto en modo Crear
  const openCreateProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      description: '',
      categoryId: categories.length > 0 ? String(categories[0].id) : '',
      unitOfMeasure: 'KG',
      currentPrice: '',
      minStockThreshold: '',
    });
    setErrorMsg('');
    setShowProductModal(true);
  };

  // Abrir modal de producto en modo Editar
  const openEditProduct = (prod) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name || '',
      description: prod.description || '',
      categoryId: prod.categoryId ? String(prod.categoryId) : '',
      unitOfMeasure: prod.unitOfMeasure || 'KG',
      currentPrice: String(prod.currentPrice ?? ''),
      minStockThreshold: String(prod.minStockThreshold ?? ''),
    });
    setErrorMsg('');
    setShowProductModal(true);
  };

  // Guardar (Crear o Actualizar) Producto
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    try {
      const payload = {
        name: productForm.name,
        description: productForm.description,
        categoryId: productForm.categoryId ? parseInt(productForm.categoryId) : null,
        unitOfMeasure: productForm.unitOfMeasure,
        currentPrice: parseFloat(productForm.currentPrice) || 0,
        minStockThreshold: parseFloat(productForm.minStockThreshold) || 0,
      };

      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        setStatusBanner(`✅ Insumo "${productForm.name}" actualizado correctamente.`);
      } else {
        await api.post('/products', payload);
        setStatusBanner(`✅ Insumo "${productForm.name}" registrado con éxito.`);
      }

      setShowProductModal(false);
      setEditingProduct(null);
      fetchData();
    } catch (err) {
      setErrorMsg(err.message || 'Error guardando el insumo');
    } finally {
      setSaving(false);
    }
  };

  // Eliminar Producto
  const handleDeleteProduct = async (prod) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar o retirar el insumo "${prod.name}" del inventario?\n\nSi tiene recetas o historial asociado, se desactivará de forma segura.`
    );
    if (!confirmDelete) return;

    try {
      const res = await api.delete(`/products/${prod.id}`);
      setStatusBanner(`🗑️ ${res.message || `Insumo "${prod.name}" eliminado correctamente.`}`);
      fetchData();
    } catch (err) {
      alert(`Error eliminando el insumo: ${err.message}`);
    }
  };

  // Validar fechas de caducidad y emitir alertas
  const handleValidateExpirations = async () => {
    setValidating(true);
    try {
      const res = await api.post('/inventory/check-expirations');
      const expiredCount = res.data?.expiredCount ?? 0;
      const soonCount = res.data?.soonCount ?? 0;
      setStatusBanner(
        `🔔 Verificación completada: ${expiredCount} lote(s) vencido(s) y ${soonCount} lote(s) próximo(s) a vencer. Alertas actualizadas en el sistema.`
      );
      fetchData();
    } catch (err) {
      alert(`Error validando fechas de caducidad: ${err.message}`);
    } finally {
      setValidating(false);
    }
  };

  // Descartar lote individual por vencimiento (Merma)
  const handleDiscardLot = async (lot) => {
    const loss = lot.lossAmount || (lot.quantityRemaining * lot.purchasePrice);
    const confirm = window.confirm(
      `¿Confirmas el descarte por vencimiento del lote ${lot.lotCode || '#' + lot.id} de "${lot.product?.name}"?\n\n• Cantidad a descartar: ${lot.quantityRemaining} ${lot.product?.unitOfMeasure}\n• Pérdida por merma: $${loss.toFixed(2)}\n\nEsta pérdida se registrará en el módulo de Estadísticas/Mermas.`
    );
    if (!confirm) return;

    setDiscardingId(lot.id);
    try {
      const res = await api.post(`/inventory/lots/${lot.id}/discard`, {
        reason: 'Descarte por producto vencido',
      });
      setStatusBanner(`🗑️ ${res.message}`);
      fetchData();
    } catch (err) {
      alert(`Error descartando lote vencido: ${err.message}`);
    } finally {
      setDiscardingId(null);
    }
  };

  // Descartar todos los lotes vencidos en masa
  const handleDiscardAllExpired = async () => {
    const onlyExpired = expiredLots.filter((l) => l.isExpired);
    if (onlyExpired.length === 0) {
      alert('No hay lotes con fecha vencida pendientes de descarte.');
      return;
    }

    const totalEstLoss = onlyExpired.reduce((sum, l) => sum + (l.lossAmount || l.quantityRemaining * l.purchasePrice), 0);
    const confirm = window.confirm(
      `⚠️ ATENCIÓN: ¿Confirmas el descarte masivo de TODOS los ${onlyExpired.length} lotes vencidos?\n\nPérdida total estimada por merma: $${totalEstLoss.toFixed(2)}.\nEsta acción vaciará el stock de estos lotes y registrará la merma correspondiente.`
    );
    if (!confirm) return;

    setDiscardingId('all');
    try {
      const res = await api.post('/inventory/discard-expired-all');
      setStatusBanner(`🗑️ ${res.message}`);
      fetchData();
    } catch (err) {
      alert(`Error en descarte masivo: ${err.message}`);
    } finally {
      setDiscardingId(null);
    }
  };

  const handleRegisterLot = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    try {
      await api.post('/inventory/lots', {
        ...newLot,
        productId: parseInt(newLot.productId),
        supplierId: newLot.supplierId ? parseInt(newLot.supplierId) : null,
        quantity: parseFloat(newLot.quantity),
        purchasePrice: parseFloat(newLot.purchasePrice),
      });

      setShowLotModal(false);
      setStatusBanner(`✅ Nuevo lote registrado exitosamente bajo la política FIFO.`);
      setNewLot({
        productId: '',
        supplierId: '',
        quantity: '',
        purchasePrice: '',
        expirationDate: '',
        lotCode: '',
      });
      fetchData();
    } catch (err) {
      setErrorMsg(err.message || 'Error registrando lote');
    } finally {
      setSaving(false);
    }
  };

  const openMovements = async () => {
    setShowMovementsModal(true);
    try {
      const res = await api.get('/inventory/movements?limit=40');
      if (res.success) setMovements(res.data.movements);
    } catch (err) {
      console.error(err);
    }
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchSearch = (p.name || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory ? p.categoryId === parseInt(selectedCategory) : true;
    return matchSearch && matchCat;
  });

  const expiredCountTotal = expiredLots.filter((l) => l.isExpired).length;
  const soonCountTotal = expiredLots.filter((l) => !l.isExpired && l.daysUntil <= 3).length;

  return (
    <div className="page-wrapper">
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Inventario y Materia Prima</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Control integral de materias primas por lotes FIFO, trazabilidad de caducidad y alertas de reposición.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleValidateExpirations}
            disabled={validating}
            className="btn btn-secondary"
            title="Escanear lotes y verificar vencimientos ahora"
          >
            <Clock size={16} />
            {validating ? 'Validando...' : 'Validar Vencimientos'}
          </button>
          <button onClick={openMovements} className="btn btn-secondary">
            <History size={16} />
            Movimientos FIFO
          </button>
          <button onClick={openCreateProduct} className="btn btn-secondary">
            <Plus size={16} />
            Nuevo Insumo
          </button>
          <button onClick={() => setShowLotModal(true)} className="btn btn-primary">
            <PackagePlus size={16} />
            Ingreso de Lote
          </button>
        </div>
      </div>

      {/* Status banner */}
      {statusBanner && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: statusBanner.startsWith('❌') ? 'var(--danger-bg)' : 'var(--success-bg)',
            border: `1px solid ${statusBanner.startsWith('❌') ? 'var(--danger-border)' : 'var(--success-border)'}`,
            marginBottom: '1.25rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{statusBanner}</span>
          <button
            onClick={() => setStatusBanner('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Alerta de caducidad activa */}
      {(expiredCountTotal > 0 || soonCountTotal > 0) && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(245, 158, 11, 0.12) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <Flame size={24} color="var(--danger)" />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--danger)' }}>
                ALERTA DE CADUCIDAD EN ALMACÉN
              </div>
              <div style={{ fontSize: '0.825rem', color: 'var(--text-main)', marginTop: '2px' }}>
                Se detectaron <strong>{expiredCountTotal} lote(s) vencido(s)</strong> y{' '}
                <strong>{soonCountTotal} lote(s) próximo(s) a vencer (&le; 3 días)</strong>. Retíralos para evitar pérdidas mayores.
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('expired')}
            className="btn btn-sm btn-danger"
            style={{ padding: '0.5rem 1rem', fontWeight: 700 }}
          >
            <Trash2 size={15} /> Ver y Descartar Vencidos ({expiredLots.length})
          </button>
        </div>
      )}

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('inventory')}
          style={{
            background: activeTab === 'inventory' ? 'var(--primary-600)' : 'transparent',
            color: activeTab === 'inventory' ? '#FFF' : 'var(--text-muted)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '0.6rem 1.2rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Boxes size={17} />
          Catálogo de Insumos ({products.length})
        </button>

        <button
          onClick={() => setActiveTab('expired')}
          style={{
            background: activeTab === 'expired' ? 'var(--danger)' : 'transparent',
            color: activeTab === 'expired' ? '#FFF' : 'var(--text-muted)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '0.6rem 1.2rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={17} />
          Productos Vencidos &amp; Mermas
          {expiredLots.length > 0 && (
            <span
              style={{
                backgroundColor: activeTab === 'expired' ? '#FFF' : 'var(--danger)',
                color: activeTab === 'expired' ? 'var(--danger)' : '#FFF',
                borderRadius: '999px',
                padding: '0.1rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: 800,
              }}
            >
              {expiredLots.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: CATÁLOGO DE INSUMOS */}
      {activeTab === 'inventory' && (
        <>
          {/* Legend Banner sobre Fechas de Caducidad */}
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.25rem',
              fontSize: '0.785rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <Info size={16} color="var(--primary-600)" />
            <strong>Guía de Caducidad (FIFO):</strong>
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>🟢 Vigente (&gt;7 días)</span> |
            <span style={{ color: 'var(--warning)', fontWeight: 700 }}>🟡 Por vencer (4-7 días)</span> |
            <span style={{ color: 'var(--danger)', fontWeight: 700 }}>⚠️ Crítico (&le;3 días)</span> |
            <span style={{ color: 'var(--danger)', fontWeight: 800 }}>⛔ Vencido</span> |
            <span>⚪ Sin fecha registrada</span>
          </div>

          {/* Filter and Search Bar */}
          <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <input
                type="text"
                placeholder="Buscar insumo por nombre (ej: Pollo entero, Papas, Carbón)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-control"
                style={{ paddingLeft: '2.5rem' }}
              />
              <Search size={18} color="var(--text-light)" style={{ position: 'absolute', left: '0.85rem', top: '0.75rem' }} />
            </div>

            <div style={{ minWidth: '200px' }}>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="form-control"
              >
                <option value="">Todas las Categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <button onClick={fetchData} className="btn btn-secondary" title="Actualizar datos">
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Products Table */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Categoría</th>
                  <th>Stock Actual</th>
                  <th>Umbral Mínimo</th>
                  <th>Precio Compra</th>
                  <th>Estado Stock</th>
                  <th>Caducidad Lote Próximo</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                      Cargando insumos...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No se encontraron insumos. Crea tu primer producto con el botón "Nuevo Insumo".
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const isCritical = p.currentStock <= p.minStockThreshold;
                    const isWarning = p.currentStock > p.minStockThreshold && p.currentStock <= p.minStockThreshold * 1.5;

                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{p.name}</div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.description || 'Sin notas'}</span>
                        </td>
                        <td>
                          <span className="badge badge-primary">{p.category?.name || 'General'}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: isCritical ? 'var(--danger)' : 'var(--text-main)' }}>
                            {p.currentStock.toFixed(2)}
                          </span>{' '}
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{p.unitOfMeasure}</span>
                        </td>
                        <td>
                          {p.minStockThreshold} {p.unitOfMeasure}
                        </td>
                        <td style={{ fontWeight: 700 }}>${p.currentPrice.toFixed(2)}</td>
                        <td>
                          {isCritical ? (
                            <span className="badge badge-danger">
                              <AlertCircle size={13} /> CRÍTICO / BAJO
                            </span>
                          ) : isWarning ? (
                            <span className="badge badge-warning">
                              <AlertTriangle size={13} /> POR AGOTARSE
                            </span>
                          ) : (
                            <span className="badge badge-success">
                              <CheckCircle size={13} /> ÓPTIMO
                            </span>
                          )}
                        </td>
                        {/* Descripción de fecha de caducidad */}
                        <td>
                          {p.nearestExpiry ? (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '2px' }}>
                                {p.expiryStatus === 'EXPIRED' ? (
                                  <span className="badge badge-danger">
                                    ⛔ VENCIDO ({Math.abs(p.daysUntilExpiry)} d atrás)
                                  </span>
                                ) : p.expiryStatus === 'CRITICAL' ? (
                                  <span className="badge badge-danger">
                                    ⚠️ Vence en {p.daysUntilExpiry} d
                                  </span>
                                ) : p.expiryStatus === 'WARNING' ? (
                                  <span className="badge badge-warning">
                                    🟡 Vence en {p.daysUntilExpiry} d
                                  </span>
                                ) : (
                                  <span className="badge badge-success">
                                    🟢 Vigente
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {new Date(p.nearestExpiry).toLocaleDateString()} (FIFO)
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              ⚪ Sin fecha registrada
                            </span>
                          )}
                        </td>
                        {/* Botones de acción solicitados: + Lote, Editar, Eliminar */}
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => {
                                setNewLot((prev) => ({ ...prev, productId: p.id, purchasePrice: p.currentPrice }));
                                setShowLotModal(true);
                              }}
                              className="btn btn-sm btn-secondary"
                              title="Ingresar nuevo lote FIFO"
                              style={{ padding: '0.35rem 0.6rem' }}
                            >
                              <PackagePlus size={14} /> + Lote
                            </button>
                            <button
                              onClick={() => openEditProduct(p)}
                              className="btn btn-sm btn-secondary"
                              title="Editar materia prima / insumo"
                              style={{ padding: '0.35rem 0.55rem', color: 'var(--primary-600)' }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              className="btn btn-sm btn-danger"
                              title="Eliminar insumo del inventario"
                              style={{ padding: '0.35rem 0.55rem' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB 2: APARTADO DE PRODUCTOS VENCIDOS & MERMAS */}
      {activeTab === 'expired' && (
        <div>
          {/* Header del apartado */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger)' }}>
                Apartado de Lotes Vencidos &amp; Descarte por Merma
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                Visualiza los insumos vencidos o en riesgo. Al descartarlos, su costo se registrará automáticamente como pérdida por merma.
              </p>
            </div>

            {expiredLots.filter((l) => l.isExpired).length > 0 && (
              <button
                onClick={handleDiscardAllExpired}
                disabled={discardingId === 'all'}
                className="btn btn-danger"
                style={{ padding: '0.65rem 1.25rem', fontWeight: 800 }}
              >
                <Trash2 size={16} />
                {discardingId === 'all' ? 'Descartando...' : 'Descartar Todos los Lotes Vencidos'}
              </button>
            )}
          </div>

          {/* Cards resumen de mermas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
            <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>LOTES YA VENCIDOS</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--danger)', marginTop: '0.4rem' }}>
                {expiredLots.filter((l) => l.isExpired).length}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Requieren descarte inmediato</span>
            </div>

            <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>PRÓXIMOS A VENCER (&le; 7 DÍAS)</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning)', marginTop: '0.4rem' }}>
                {expiredLots.filter((l) => !l.isExpired).length}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Priorizar despacho FIFO</span>
            </div>

            <div className="card" style={{ borderLeft: '4px solid var(--primary-500)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-700)' }}>PÉRDIDA ESTIMADA TOTAL</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--danger)', marginTop: '0.4rem' }}>
                ${expiredLots.reduce((sum, l) => sum + (l.lossAmount || 0), 0).toFixed(2)}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Costo de adquisición en riesgo</span>
            </div>
          </div>

          {/* Table of Expired Lots */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Lote / Código</th>
                  <th>Insumo</th>
                  <th>Proveedor</th>
                  <th>Cantidad Restante</th>
                  <th>Fecha de Caducidad</th>
                  <th>Costo Unit. Compra</th>
                  <th>Pérdida Estimada ($)</th>
                  <th style={{ textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {expiredLots.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                      <CheckCircle size={36} color="var(--success)" style={{ margin: '0 auto 0.75rem' }} />
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                        ¡Excelente! No hay insumos vencidos en el almacén.
                      </div>
                      <div style={{ fontSize: '0.85rem' }}>
                        Todos los lotes se encuentran vigentes o han sido rotados correctamente.
                      </div>
                    </td>
                  </tr>
                ) : (
                  expiredLots.map((lot) => {
                    const isExp = lot.isExpired;

                    return (
                      <tr key={lot.id}>
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{lot.lotCode || `#${lot.id}`}</div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Ingreso: {new Date(lot.entryDate || lot.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{lot.product?.name}</div>
                        </td>
                        <td>{lot.supplier?.name || '—'}</td>
                        <td>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: isExp ? 'var(--danger)' : 'var(--text-main)' }}>
                            {lot.quantityRemaining}
                          </span>{' '}
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lot.product?.unitOfMeasure}</span>
                        </td>
                        <td>
                          <div>
                            {isExp ? (
                              <span className="badge badge-danger">
                                ⛔ VENCIDO ({Math.abs(lot.daysUntil)} d atrás)
                              </span>
                            ) : (
                              <span className="badge badge-warning">
                                🟡 Vence en {lot.daysUntil} d
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {lot.expirationDate ? new Date(lot.expirationDate).toLocaleDateString() : '—'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>${lot.purchasePrice?.toFixed(2)}</td>
                        <td style={{ fontWeight: 800, color: 'var(--danger)' }}>
                          ${(lot.lossAmount || 0).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleDiscardLot(lot)}
                            disabled={discardingId === lot.id}
                            className="btn btn-sm btn-danger"
                            title="Descartar este lote y registrar merma"
                            style={{ padding: '0.4rem 0.85rem', fontWeight: 700 }}
                          >
                            <Trash2 size={14} />
                            {discardingId === lot.id ? 'Descartando...' : 'Descartar por Merma'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Crear / Editar Insumo */}
      {showProductModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                {editingProduct ? `Editar Insumo: ${editingProduct.name}` : 'Registrar Nuevo Insumo'}
              </h3>
              <button onClick={() => setShowProductModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveProduct}>
              <div className="modal-body">
                {errorMsg && (
                  <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', padding: '0.5rem', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>
                    {errorMsg}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Nombre del Insumo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Pollo Entero Fresco, Papa Amarilla, Carbón Vegetal..."
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    className="form-control"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Categoría *</label>
                    <select
                      required
                      value={productForm.categoryId}
                      onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                      className="form-control"
                    >
                      <option value="">Seleccionar...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unidad de Medida *</label>
                    <select
                      value={productForm.unitOfMeasure}
                      onChange={(e) => setProductForm({ ...productForm, unitOfMeasure: e.target.value })}
                      className="form-control"
                    >
                      <option value="KG">Kilogramos (KG)</option>
                      <option value="UNIDAD">Unidades (UNIDAD)</option>
                      <option value="LITRO">Litros (LITRO)</option>
                      <option value="GRAMOS">Gramos (GRAMOS)</option>
                      <option value="SACO">Saco / Bulto (SACO)</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Precio de Compra Actual ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={productForm.currentPrice}
                      onChange={(e) => setProductForm({ ...productForm, currentPrice: e.target.value })}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Umbral de Alerta Mínima *</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="Ej: 10"
                      value={productForm.minStockThreshold}
                      onChange={(e) => setProductForm({ ...productForm, minStockThreshold: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción o Notas</label>
                  <input
                    type="text"
                    placeholder="Instrucciones de almacenamiento o proveedor preferente"
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowProductModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Guardando...' : editingProduct ? 'Actualizar Insumo' : 'Guardar Insumo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ingreso de Lote (FIFO) */}
      {showLotModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Ingreso de Nuevo Lote (FIFO)</h3>
              <button onClick={() => setShowLotModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRegisterLot}>
              <div className="modal-body">
                {errorMsg && (
                  <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', padding: '0.5rem', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>
                    {errorMsg}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Insumo / Producto *</label>
                  <select
                    required
                    value={newLot.productId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      const prod = products.find((x) => x.id === parseInt(pId));
                      setNewLot({
                        ...newLot,
                        productId: pId,
                        purchasePrice: prod ? prod.currentPrice : newLot.purchasePrice,
                      });
                    }}
                    className="form-control"
                  >
                    <option value="">Seleccionar insumo...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.unitOfMeasure})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Proveedor (Opcional)</label>
                    <select
                      value={newLot.supplierId}
                      onChange={(e) => setNewLot({ ...newLot, supplierId: e.target.value })}
                      className="form-control"
                    >
                      <option value="">Seleccionar proveedor...</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Código de Lote</label>
                    <input
                      type="text"
                      placeholder="Ej: LOTE-2026-001"
                      value={newLot.lotCode}
                      onChange={(e) => setNewLot({ ...newLot, lotCode: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Cantidad a Ingresar *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={newLot.quantity}
                      onChange={(e) => setNewLot({ ...newLot, quantity: e.target.value })}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Precio Unitario de Compra ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={newLot.purchasePrice}
                      onChange={(e) => setNewLot({ ...newLot, purchasePrice: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de Caducidad / Vencimiento</label>
                  <input
                    type="date"
                    value={newLot.expirationDate}
                    onChange={(e) => setNewLot({ ...newLot, expirationDate: e.target.value })}
                    className="form-control"
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    El sistema alertará automáticamente antes de que venza para priorizar su consumo FIFO.
                  </span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowLotModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Registrando...' : 'Registrar Lote FIFO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Historial de Movimientos FIFO */}
      {showMovementsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Historial de Movimientos (Lógica FIFO)</h3>
              <button onClick={() => setShowMovementsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Insumo</th>
                      <th>Cantidad</th>
                      <th>Detalle / Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                          No hay movimientos registrados
                        </td>
                      </tr>
                    ) : (
                      movements.map((m) => (
                        <tr key={m.id}>
                          <td>{new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            <span
                              className={`badge ${
                                m.movementType === 'ENTRY'
                                  ? 'badge-success'
                                  : m.movementType === 'SALE_DEDUCTION'
                                  ? 'badge-primary'
                                  : m.movementType === 'WASTE'
                                  ? 'badge-danger'
                                  : 'badge-warning'
                              }`}
                            >
                              {m.movementType}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{m.product?.name}</td>
                          <td style={{ fontWeight: 700, color: m.movementType === 'ENTRY' ? 'var(--success)' : 'var(--danger)' }}>
                            {m.movementType === 'ENTRY' ? '+' : '-'}{m.quantity} {m.product?.unitOfMeasure}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.reason || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowMovementsModal(false)} className="btn btn-secondary">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
