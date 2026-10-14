import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import {
  UtensilsCrossed,
  Plus,
  Percent,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Layers,
  Trash2,
  X,
  Pencil,
  Save,
  RotateCcw,
  PackageX,
} from 'lucide-react';

const MAX_MARGIN = 30; // Política Pollos La Llovizna: ganancia máxima 30% sobre el costo

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (v) => `$${num(v).toFixed(2)}`;
const round2 = (v) => Math.round(num(v) * 100) / 100;
const marginOf = (price, cost) => (cost > 0 ? ((num(price) - cost) / cost) * 100 : 0);
const priceFor = (cost, margin) => round2(cost * (1 + num(margin) / 100));

/* ------------------------------------------------------------------ */
/* Medidor visual de margen (en tiempo real)                           */
/* ------------------------------------------------------------------ */
const MarginMeter = ({ cost, price, compact = false }) => {
  const margin = marginOf(price, cost);
  const profit = num(price) - cost;
  const over = margin > MAX_MARGIN + 0.05;
  const negative = margin < 0;
  const color = over || negative ? 'var(--danger)' : margin >= 20 ? 'var(--success)' : 'var(--warning)';
  const fill = Math.max(0, Math.min(100, (margin / MAX_MARGIN) * 100));

  return (
    <div style={{ marginTop: compact ? '0.4rem' : '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.3rem' }}>
        <span style={{ color }}>
          {over ? <AlertCircle size={12} style={{ verticalAlign: '-2px' }} /> : <Percent size={12} style={{ verticalAlign: '-2px' }} />}{' '}
          Margen: {margin.toFixed(1)}%
        </span>
        <span style={{ color: profit < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
          Ganancia/unidad: {money(profit)}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--border-subtle)', overflow: 'hidden' }}>
        <div
          style={{
            width: `${over ? 100 : fill}%`,
            height: '100%',
            background: color,
            borderRadius: 999,
            transition: 'width 0.25s ease, background 0.25s ease',
          }}
        />
      </div>
      {over && (
        <div style={{ fontSize: '0.72rem', color: 'var(--danger)', fontWeight: 600, marginTop: '0.3rem' }}>
          Supera la política del 30%. Precio máximo: {money(priceFor(cost, MAX_MARGIN))}
        </div>
      )}
      {negative && !over && (
        <div style={{ fontSize: '0.72rem', color: 'var(--danger)', fontWeight: 600, marginTop: '0.3rem' }}>
          El precio está por debajo del costo (pérdida).
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Editor de precio en la tarjeta: jugar con el precio y guardar      */
/* ------------------------------------------------------------------ */
const CardPriceEditor = ({ item, onSaved, notify }) => {
  const [price, setPrice] = useState(String(round2(item.salePrice)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrice(String(round2(item.salePrice)));
  }, [item.salePrice]);

  const cost = num(item.productionCost);
  const maxPrice = priceFor(cost, MAX_MARGIN);
  const margin = marginOf(price, cost);
  const changed = round2(price) !== round2(item.salePrice);
  const invalid = num(price) <= 0 || margin > MAX_MARGIN + 0.05;

  const save = async () => {
    if (invalid) return;
    setSaving(true);
    try {
      await api.put(`/menu/items/${item.id}`, { salePrice: round2(price) });
      notify('success', 'Precio actualizado', `${item.name}: ${money(price)} (margen ${margin.toFixed(1)}%)`);
      onSaved();
    } catch (err) {
      notify('danger', 'No se pudo guardar', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span>Costo Producción:</span>
        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{money(cost)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span>Precio Sugerido (máx. 30%):</span>
        <button
          type="button"
          onClick={() => setPrice(String(maxPrice))}
          title="Usar el precio sugerido"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--primary-600)', padding: 0 }}
        >
          {money(maxPrice)}
        </button>
      </div>

      <label htmlFor={`price-${item.id}`} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        Precio de venta (editable)
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.3rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--primary-600)' }}>$</span>
          <input
            id={`price-${item.id}`}
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="form-control"
            style={{
              paddingLeft: '1.6rem',
              fontSize: '1.15rem',
              fontWeight: 800,
              color: invalid ? 'var(--danger)' : 'var(--primary-600)',
              borderColor: invalid ? 'var(--danger)' : undefined,
            }}
          />
        </div>
        {changed && (
          <>
            <button
              type="button"
              onClick={() => setPrice(String(round2(item.salePrice)))}
              className="btn btn-sm btn-secondary"
              title="Deshacer cambios"
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || invalid}
              className="btn btn-sm btn-primary"
              title={invalid ? 'Precio fuera de la política del 30%' : 'Guardar nuevo precio'}
            >
              <Save size={14} /> {saving ? '...' : 'Guardar'}
            </button>
          </>
        )}
      </div>
      <MarginMeter cost={cost} price={price} compact />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Página principal                                                    */
/* ------------------------------------------------------------------ */
export const MenuPage = () => {
  const { addToast } = useSocket() || {};
  const [menuItems, setMenuItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDishModal, setShowDishModal] = useState(false);
  const [showComboModal, setShowComboModal] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Plato
  const [editingDishId, setEditingDishId] = useState(null);
  const [dishName, setDishName] = useState('');
  const [dishDesc, setDishDesc] = useState('');
  const [recipe, setRecipe] = useState([{ productId: '', quantityNeeded: '' }]);
  const [dishPrice, setDishPrice] = useState('');
  const [dishPriceTouched, setDishPriceTouched] = useState(false);

  // Combo
  const [editingComboId, setEditingComboId] = useState(null);
  const [comboName, setComboName] = useState('');
  const [comboDesc, setComboDesc] = useState('');
  const [comboItems, setComboItems] = useState([{ menuItemId: '', quantity: 1 }]);
  const [comboPrice, setComboPrice] = useState('');
  const [comboPriceTouched, setComboPriceTouched] = useState(false);

  const notify = (type, title, message) => {
    if (addToast) addToast({ id: Date.now() + Math.random(), type, title, message });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [menuRes, prodRes] = await Promise.allSettled([api.get('/menu/items'), api.get('/products?active=true')]);
      if (menuRes.status === 'fulfilled' && menuRes.value?.success) setMenuItems(menuRes.value.data || []);
      if (prodRes.status === 'fulfilled' && prodRes.value?.success) {
        setProducts(
          (prodRes.value.data || []).map((p) => ({
            ...p,
            currentPrice: num(p.currentPrice),
            currentStock: num(p.currentStock ?? p.totalStock),
          }))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* ---------------------- Cálculos del plato ---------------------- */
  const dishCost = useMemo(
    () =>
      round2(
        recipe.reduce((total, r) => {
          const prod = products.find((p) => p.id === parseInt(r.productId));
          return prod ? total + prod.currentPrice * num(r.quantityNeeded) : total;
        }, 0)
      ),
    [recipe, products]
  );
  const dishSuggested = priceFor(dishCost, MAX_MARGIN);
  const effectiveDishPrice = dishPriceTouched ? dishPrice : dishCost > 0 ? String(dishSuggested) : '';
  const dishMarginLive = marginOf(effectiveDishPrice, dishCost);

  // Validación en vivo contra inventario
  const recipeIssues = useMemo(() => {
    const issues = [];
    const seen = new Set();
    recipe.forEach((r, idx) => {
      if (!r.productId) return;
      const pid = parseInt(r.productId);
      const prod = products.find((p) => p.id === pid);
      const qty = num(r.quantityNeeded);
      if (seen.has(pid)) {
        issues.push({ idx, level: 'danger', name: prod?.name || 'Insumo', text: 'está repetido en la receta' });
        return;
      }
      seen.add(pid);
      if (!prod) {
        issues.push({ idx, level: 'danger', name: `Insumo #${pid}`, text: 'no se encuentra en el inventario' });
      } else if (prod.currentStock <= 0) {
        issues.push({ idx, level: 'danger', name: prod.name, text: `sin existencias (0 ${prod.unitOfMeasure})` });
      } else if (qty > 0 && prod.currentStock < qty) {
        issues.push({
          idx,
          level: 'danger',
          name: prod.name,
          text: `escaso: hay ${prod.currentStock} ${prod.unitOfMeasure}, la receta requiere ${qty} ${prod.unitOfMeasure}`,
        });
      } else if (qty > 0 && prod.minStockThreshold && prod.currentStock - qty < prod.minStockThreshold) {
        issues.push({ idx, level: 'warning', name: prod.name, text: `stock bajo (${prod.currentStock} ${prod.unitOfMeasure})` });
      }
    });
    return issues;
  }, [recipe, products]);
  const blockingIssues = recipeIssues.filter((i) => i.level === 'danger');

  /* ---------------------- Cálculos del combo ---------------------- */
  const comboCost = useMemo(
    () =>
      round2(
        comboItems.reduce((total, ci) => {
          const m = menuItems.find((x) => x.id === parseInt(ci.menuItemId));
          return m ? total + num(m.productionCost) * (parseInt(ci.quantity) || 1) : total;
        }, 0)
      ),
    [comboItems, menuItems]
  );
  const comboSuggested = priceFor(comboCost, MAX_MARGIN);
  const effectiveComboPrice = comboPriceTouched ? comboPrice : comboCost > 0 ? String(comboSuggested) : '';
  const comboMarginLive = marginOf(effectiveComboPrice, comboCost);

  /* ---------------------- Abrir / cerrar modales ---------------------- */
  const resetDish = () => {
    setEditingDishId(null);
    setDishName('');
    setDishDesc('');
    setRecipe([{ productId: '', quantityNeeded: '' }]);
    setDishPrice('');
    setDishPriceTouched(false);
    setErrorMsg('');
  };

  const openNewDish = () => {
    resetDish();
    setShowDishModal(true);
  };

  const openEditDish = (item) => {
    setErrorMsg('');
    setEditingDishId(item.id);
    setDishName(item.name || '');
    setDishDesc(item.description || '');
    setRecipe(
      item.recipeItems?.length
        ? item.recipeItems.map((ri) => ({ productId: String(ri.productId), quantityNeeded: String(ri.quantityNeeded) }))
        : [{ productId: '', quantityNeeded: '' }]
    );
    setDishPrice(String(round2(item.salePrice)));
    setDishPriceTouched(true);
    setShowDishModal(true);
  };

  const resetCombo = () => {
    setEditingComboId(null);
    setComboName('');
    setComboDesc('');
    setComboItems([{ menuItemId: '', quantity: 1 }]);
    setComboPrice('');
    setComboPriceTouched(false);
    setErrorMsg('');
  };

  const openNewCombo = () => {
    resetCombo();
    setShowComboModal(true);
  };

  const openEditCombo = (item) => {
    setErrorMsg('');
    setEditingComboId(item.id);
    setComboName(item.name || '');
    setComboDesc(item.description || '');
    setComboItems(
      item.comboItems?.length
        ? item.comboItems.map((ci) => ({ menuItemId: String(ci.menuItemId), quantity: ci.quantity }))
        : [{ menuItemId: '', quantity: 1 }]
    );
    setComboPrice(String(round2(item.salePrice)));
    setComboPriceTouched(true);
    setShowComboModal(true);
  };

  /* ---------------------- Guardar plato ---------------------- */
  const handleSaveDish = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const validRecipe = recipe
      .filter((r) => r.productId && num(r.quantityNeeded) > 0)
      .map((r) => {
        const prod = products.find((p) => p.id === parseInt(r.productId));
        return {
          productId: parseInt(r.productId),
          quantityNeeded: num(r.quantityNeeded),
          unitOfMeasure: prod ? prod.unitOfMeasure : 'UNIDAD',
        };
      });

    if (validRecipe.length === 0) {
      setErrorMsg('Debes agregar al menos un insumo del inventario con una cantidad mayor a 0.');
      return;
    }

    if (blockingIssues.length > 0) {
      const detail = blockingIssues.map((i) => `• ${i.name}: ${i.text}`).join('\n');
      setErrorMsg(`No se puede guardar. Ingredientes escasos o inexistentes en inventario:\n${detail}`);
      notify('danger', 'Ingredientes escasos', detail);
      return;
    }

    const price = round2(effectiveDishPrice);
    if (price <= 0) {
      setErrorMsg('El precio de venta debe ser mayor a 0.');
      return;
    }
    if (dishCost > 0 && dishMarginLive > MAX_MARGIN + 0.05) {
      setErrorMsg(
        `El precio ${money(price)} genera un margen de ${dishMarginLive.toFixed(1)}% y supera el 30% permitido. Precio máximo: ${money(dishSuggested)}.`
      );
      return;
    }

    setSaving(true);
    try {
      const payload = { name: dishName, description: dishDesc, salePrice: price, recipe: validRecipe };
      if (editingDishId) {
        await api.put(`/menu/items/${editingDishId}`, payload);
        notify('success', 'Plato actualizado', `${dishName} se actualizó correctamente.`);
      } else {
        await api.post('/menu/items', { ...payload, type: 'PLATO' });
        notify('success', 'Plato creado', `${dishName} se agregó al menú.`);
      }
      setShowDishModal(false);
      resetDish();
      fetchData();
    } catch (err) {
      setErrorMsg(err.message || 'Error guardando el plato');
      if (err.details?.length) {
        notify('danger', 'Ingredientes escasos', err.details.map((d) => `• ${d.name}: ${d.message}`).join('\n'));
      }
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------- Guardar combo ---------------------- */
  const handleSaveCombo = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const validComboItems = comboItems
      .filter((ci) => ci.menuItemId)
      .map((ci) => ({ menuItemId: parseInt(ci.menuItemId), quantity: parseInt(ci.quantity) || 1 }));

    if (validComboItems.length === 0) {
      setErrorMsg('Selecciona al menos un plato para armar el combo.');
      return;
    }
    const price = round2(effectiveComboPrice);
    if (price <= 0) {
      setErrorMsg('El precio de venta debe ser mayor a 0.');
      return;
    }
    if (comboCost > 0 && comboMarginLive > MAX_MARGIN + 0.05) {
      setErrorMsg(`El precio del combo supera el 30% de margen. Precio máximo: ${money(comboSuggested)}.`);
      return;
    }

    setSaving(true);
    try {
      const payload = { name: comboName, description: comboDesc, salePrice: price, items: validComboItems, comboItems: validComboItems };
      if (editingComboId) {
        await api.put(`/menu/items/${editingComboId}`, payload);
        notify('success', 'Combo actualizado', `${comboName} se actualizó correctamente.`);
      } else {
        await api.post('/menu/combos', payload);
        notify('success', 'Combo creado', `${comboName} se agregó al menú.`);
      }
      setShowComboModal(false);
      resetCombo();
      fetchData();
    } catch (err) {
      setErrorMsg(err.message || 'Error guardando el combo');
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculateCosts = async () => {
    try {
      setRecalculating(true);
      const res = await api.post('/menu/recalculate-costs');
      notify('info', 'Costos recalculados', res?.message || 'Costos actualizados según precios del inventario.');
      await fetchData();
    } catch (err) {
      notify('danger', 'Error', err.message);
    } finally {
      setRecalculating(false);
    }
  };

  const handleDeleteMenuItem = async (item) => {
    const isCombo = item.type === 'COMBO';
    const label = isCombo ? 'el combo' : 'el plato';
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar ${label} "${item.name}"?\n\nEsta acción lo retirará del catálogo de ventas.`
    );
    if (!confirmed) return;

    try {
      const res = await api.delete(`/menu/items/${item.id}`);
      notify('success', 'Eliminado', res.message || `${item.name} ha sido eliminado.`);
      fetchData();
    } catch (err) {
      notify('danger', 'Error al eliminar', err.message);
    }
  };

  const errorBox = errorMsg && (
    <div
      style={{
        color: 'var(--danger)',
        fontSize: '0.85rem',
        marginBottom: '1rem',
        padding: '0.65rem 0.8rem',
        backgroundColor: 'var(--danger-bg)',
        border: '1px solid var(--danger-border)',
        borderRadius: 'var(--radius-sm)',
        whiteSpace: 'pre-line',
        display: 'flex',
        gap: '0.5rem',
      }}
    >
      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{errorMsg}</span>
    </div>
  );

  const iconBtn = {
    background: 'var(--bg-main)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    padding: '0.35rem',
    display: 'inline-flex',
    color: 'var(--primary-600)',
    transition: 'all 0.15s ease',
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Menú, Recetario &amp; Costos</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Costo calculado desde el inventario. Edita el precio de cada plato y observa el margen en tiempo real (máx. 30%).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button id="btn-recalculate" onClick={handleRecalculateCosts} disabled={recalculating} className="btn btn-secondary">
            <RefreshCw size={17} className={recalculating ? 'animate-spin' : ''} />
            {recalculating ? 'Recalculando...' : 'Recalcular Costos'}
          </button>
          <button id="btn-new-combo" onClick={openNewCombo} className="btn btn-secondary">
            <Layers size={17} />
            Nuevo Combo
          </button>
          <button id="btn-new-dish" onClick={openNewDish} className="btn btn-primary">
            <Plus size={17} />
            Crear Plato &amp; Receta
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>Cargando catálogo del menú...</div>
      ) : menuItems.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <UtensilsCrossed size={48} color="var(--primary-400)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>No hay platos ni combos registrados</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
            Crea tu primer plato y vincula los insumos del inventario para calcular su costo exacto y precio recomendado.
          </p>
          <button onClick={openNewDish} className="btn btn-primary">
            <Plus size={17} /> Crear Primer Plato
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {menuItems.map((item) => {
            const isCombo = item.type === 'COMBO';
            const margin = marginOf(item.salePrice, num(item.productionCost));
            const healthy = margin <= MAX_MARGIN + 0.05;

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: isCombo ? '4px solid var(--primary-500)' : '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem' }}>
                    <span className={`badge ${isCombo ? 'badge-primary' : 'badge-success'}`}>
                      {isCombo ? 'COMBO ESPECIAL' : 'PLATO INDIVIDUAL'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span
                        className={`badge ${healthy ? 'badge-success' : 'badge-danger'}`}
                        title={healthy ? 'Margen dentro de la política (≤30%)' : 'Margen superior a la política del 30%'}
                      >
                        <Percent size={12} /> {margin.toFixed(1)}%
                      </span>
                      <button
                        id={`btn-edit-${item.id}`}
                        type="button"
                        onClick={() => (isCombo ? openEditCombo(item) : openEditDish(item))}
                        style={iconBtn}
                        title={isCombo ? 'Editar combo' : 'Editar receta'}
                        aria-label={isCombo ? `Editar combo ${item.name}` : `Editar receta ${item.name}`}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        id={`btn-delete-${item.id}`}
                        type="button"
                        onClick={() => handleDeleteMenuItem(item)}
                        style={{
                          ...iconBtn,
                          color: 'var(--danger)',
                          borderColor: 'rgba(239, 68, 68, 0.3)',
                        }}
                        title={isCombo ? 'Eliminar combo del menú' : 'Eliminar plato del menú'}
                        aria-label={isCombo ? `Eliminar combo ${item.name}` : `Eliminar plato ${item.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.35rem' }}>{item.name}</h3>
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    {item.description || 'Especialidad de la casa preparada con los mejores insumos.'}
                  </p>

                  {item.recipeItems?.length > 0 && (
                    <div style={{ backgroundColor: 'var(--bg-main)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          Insumos requeridos por ración:
                        </span>
                        <button
                          type="button"
                          onClick={() => openEditDish(item)}
                          style={{ background: 'none', border: 'none', color: 'var(--primary-600)', cursor: 'pointer', padding: 0 }}
                          title="Editar receta"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                      <ul style={{ listStyle: 'none', marginTop: '0.4rem', fontSize: '0.8rem' }}>
                        {item.recipeItems.map((ri) => {
                          const prod = products.find((p) => p.id === ri.productId);
                          const scarce = prod && prod.currentStock < ri.quantityNeeded;
                          return (
                            <li key={ri.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                              <span style={{ color: scarce ? 'var(--danger)' : undefined }}>
                                • {ri.product?.name}
                                {scarce && <AlertTriangle size={12} style={{ marginLeft: 4, verticalAlign: '-2px' }} title="Stock insuficiente" />}
                              </span>
                              <span style={{ fontWeight: 600 }}>
                                {ri.quantityNeeded} {ri.unitOfMeasure}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {item.comboItems?.length > 0 && (
                    <div style={{ backgroundColor: 'var(--primary-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-700)' }}>
                        Contenido del combo:
                      </span>
                      <ul style={{ listStyle: 'none', marginTop: '0.4rem', fontSize: '0.8rem' }}>
                        {item.comboItems.map((ci) => (
                          <li key={ci.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span>• {ci.menuItem?.name}</span>
                            <span style={{ fontWeight: 700 }}>x{ci.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <CardPriceEditor item={item} onSaved={fetchData} notify={notify} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================= Modal: Plato ======================= */}
      {showDishModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                {editingDishId ? 'Editar Plato & Receta' : 'Crear Plato & Definir Receta'}
              </h3>
              <button onClick={() => setShowDishModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveDish}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {errorBox}

                <div className="form-group">
                  <label className="form-label" htmlFor="dish-name">Nombre del Plato *</label>
                  <input
                    id="dish-name"
                    type="text"
                    required
                    placeholder="Ej: 1/4 Pollo a la Brasa con Papas Fritas"
                    value={dishName}
                    onChange={(e) => setDishName(e.target.value)}
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="dish-desc">Descripción</label>
                  <input
                    id="dish-desc"
                    type="text"
                    placeholder="Detalles de preparación, guarniciones incluidas..."
                    value={dishDesc}
                    onChange={(e) => setDishDesc(e.target.value)}
                    className="form-control"
                  />
                </div>

                {/* Receta */}
                <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 700 }}>Insumos del Inventario (Receta)</label>
                    <button
                      type="button"
                      onClick={() => setRecipe([...recipe, { productId: '', quantityNeeded: '' }])}
                      className="btn btn-sm btn-secondary"
                    >
                      <Plus size={14} /> Agregar Insumo
                    </button>
                  </div>

                  {products.length === 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--warning)', marginBottom: '0.5rem' }}>
                      No hay insumos en el inventario. Regístralos primero en "Inventario / Insumos".
                    </div>
                  )}

                  {recipe.map((line, index) => {
                    const prod = products.find((p) => p.id === parseInt(line.productId));
                    const lineCost = prod ? prod.currentPrice * num(line.quantityNeeded) : 0;
                    const issue = recipeIssues.find((i) => i.idx === index);

                    return (
                      <div key={index} style={{ marginBottom: '0.6rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <select
                            required
                            value={line.productId}
                            onChange={(e) => {
                              const updated = recipe.map((r, i) => (i === index ? { ...r, productId: e.target.value } : r));
                              setRecipe(updated);
                            }}
                            className="form-control"
                            style={{ flex: 2, padding: '0.5rem', borderColor: issue?.level === 'danger' ? 'var(--danger)' : undefined }}
                          >
                            <option value="">Seleccionar insumo del inventario...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} — {money(p.currentPrice)}/{p.unitOfMeasure} · Stock: {p.currentStock} {p.unitOfMeasure}
                                {p.currentStock <= 0 ? ' (AGOTADO)' : ''}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            required
                            placeholder={`Cant (${prod?.unitOfMeasure || 'U'})`}
                            value={line.quantityNeeded}
                            onChange={(e) => {
                              const updated = recipe.map((r, i) => (i === index ? { ...r, quantityNeeded: e.target.value } : r));
                              setRecipe(updated);
                            }}
                            className="form-control"
                            style={{ flex: 1, padding: '0.5rem', borderColor: issue?.level === 'danger' ? 'var(--danger)' : undefined }}
                          />
                          <div style={{ minWidth: '70px', fontSize: '0.8rem', fontWeight: 700, textAlign: 'right' }}>{money(lineCost)}</div>
                          {recipe.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setRecipe(recipe.filter((_, idx) => idx !== index))}
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                              aria-label="Quitar insumo"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        {issue && (
                          <div
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              marginTop: '0.25rem',
                              color: issue.level === 'danger' ? 'var(--danger)' : 'var(--warning)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            {issue.level === 'danger' ? <PackageX size={13} /> : <AlertTriangle size={13} />}
                            {issue.name} {issue.text}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.65rem', marginTop: '0.65rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ fontWeight: 700 }}>Costo Total de Producción:</span>
                    <span style={{ fontWeight: 800, color: 'var(--primary-700)' }}>{money(dishCost)}</span>
                  </div>
                </div>

                {blockingIssues.length > 0 && (
                  <div
                    style={{
                      marginBottom: '1.25rem',
                      padding: '0.75rem 0.9rem',
                      background: 'var(--danger-bg)',
                      border: '1px solid var(--danger-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.8rem',
                      color: 'var(--danger)',
                    }}
                  >
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                      <PackageX size={15} /> Ingredientes escasos en inventario
                    </strong>
                    {blockingIssues.map((i) => (
                      <div key={i.idx}>• {i.name}: {i.text}</div>
                    ))}
                  </div>
                )}

                {/* Simulador de precio */}
                <PriceSimulator
                  idPrefix="dish"
                  cost={dishCost}
                  price={effectiveDishPrice}
                  suggested={dishSuggested}
                  onPrice={(v) => {
                    setDishPrice(v);
                    setDishPriceTouched(true);
                  }}
                />
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowDishModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button id="btn-save-dish" type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Guardando...' : editingDishId ? 'Guardar Cambios' : 'Guardar Plato & Receta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= Modal: Combo ======================= */}
      {showComboModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{editingComboId ? 'Editar Combo' : 'Crear Combo Promocional'}</h3>
              <button onClick={() => setShowComboModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveCombo}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {errorBox}
                <div className="form-group">
                  <label className="form-label" htmlFor="combo-name">Nombre del Combo *</label>
                  <input
                    id="combo-name"
                    type="text"
                    required
                    placeholder="Ej: Combo Familiar 1 Pollo + Papas + Refresco"
                    value={comboName}
                    onChange={(e) => setComboName(e.target.value)}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="combo-desc">Descripción</label>
                  <input
                    id="combo-desc"
                    type="text"
                    placeholder="Para cuántas personas rinde, incluye salsas..."
                    value={comboDesc}
                    onChange={(e) => setComboDesc(e.target.value)}
                    className="form-control"
                  />
                </div>

                <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 700 }}>Platos a Incluir</label>
                    <button
                      type="button"
                      onClick={() => setComboItems([...comboItems, { menuItemId: '', quantity: 1 }])}
                      className="btn btn-sm btn-secondary"
                    >
                      <Plus size={14} /> Añadir Plato
                    </button>
                  </div>

                  {comboItems.map((line, index) => (
                    <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <select
                        required
                        value={line.menuItemId}
                        onChange={(e) => setComboItems(comboItems.map((c, i) => (i === index ? { ...c, menuItemId: e.target.value } : c)))}
                        className="form-control"
                        style={{ flex: 2, padding: '0.5rem' }}
                      >
                        <option value="">Seleccionar plato...</option>
                        {menuItems
                          .filter((m) => m.type !== 'COMBO' && m.id !== editingComboId)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} (Costo: {money(m.productionCost)})
                            </option>
                          ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        required
                        value={line.quantity}
                        onChange={(e) => setComboItems(comboItems.map((c, i) => (i === index ? { ...c, quantity: e.target.value } : c)))}
                        className="form-control"
                        style={{ flex: 1, padding: '0.5rem' }}
                        placeholder="Cant"
                      />
                      {comboItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setComboItems(comboItems.filter((_, idx) => idx !== index))}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                          aria-label="Quitar plato"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.65rem', marginTop: '0.65rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ fontWeight: 700 }}>Costo Total del Combo:</span>
                    <span style={{ fontWeight: 800, color: 'var(--primary-700)' }}>{money(comboCost)}</span>
                  </div>
                </div>

                <PriceSimulator
                  idPrefix="combo"
                  cost={comboCost}
                  price={effectiveComboPrice}
                  suggested={comboSuggested}
                  onPrice={(v) => {
                    setComboPrice(v);
                    setComboPriceTouched(true);
                  }}
                />
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowComboModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button id="btn-save-combo" type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Guardando...' : editingComboId ? 'Guardar Cambios' : 'Crear Combo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Simulador de precio: precio editable <-> margen (slider) en vivo    */
/* ------------------------------------------------------------------ */
const PriceSimulator = ({ idPrefix, cost, price, suggested, onPrice }) => {
  const margin = marginOf(price, cost);
  const sliderValue = Math.max(0, Math.min(MAX_MARGIN, margin));

  return (
    <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-card-subtle)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>Simulador de Precio y Margen</span>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => onPrice(String(suggested))}
          disabled={cost <= 0}
          title="Aplicar el precio sugerido (costo + 30%)"
        >
          <CheckCircle size={14} /> Usar sugerido: {money(suggested)}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor={`${idPrefix}-price`}>Precio de Venta ($) *</label>
          <input
            id={`${idPrefix}-price`}
            type="number"
            step="0.01"
            min="0"
            placeholder={cost > 0 ? `Sugerido: ${money(suggested)}` : 'Agrega insumos primero'}
            value={price}
            onChange={(e) => onPrice(e.target.value)}
            className="form-control"
            style={{ fontWeight: 800, fontSize: '1.05rem' }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor={`${idPrefix}-margin`}>
            Margen sobre costo: <strong>{margin.toFixed(1)}%</strong> (máx. 30%)
          </label>
          <input
            id={`${idPrefix}-margin`}
            type="range"
            min="0"
            max={MAX_MARGIN}
            step="0.5"
            value={sliderValue}
            disabled={cost <= 0}
            onChange={(e) => onPrice(String(priceFor(cost, e.target.value)))}
            style={{ width: '100%', accentColor: 'var(--primary-500)' }}
          />
        </div>
      </div>

      {cost > 0 ? (
        <MarginMeter cost={cost} price={price} />
      ) : (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          El margen se calculará cuando agregues insumos con cantidades.
        </div>
      )}
    </div>
  );
};
