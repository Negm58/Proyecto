const prisma = require('../config/database');

const MAX_MARGIN = 30; // Política Pollos La Llovizna: ganancia máxima 30% sobre el costo

const httpError = (message, statusCode = 400, extra = {}) =>
  Object.assign(new Error(message), { statusCode, ...extra });

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

class MenuService {
  /**
   * Calcular el costo de producción de un plato (receta) o combo (suma de platos)
   */
  async calculateProductionCost(menuItemId) {
    const item = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      include: {
        recipeItems: { include: { product: true } },
        comboParent: { include: { menuItem: true } },
      },
    });
    if (!item) return 0;

    if (item.type === 'COMBO') {
      return round2(
        item.comboParent.reduce((sum, ci) => sum + (ci.menuItem?.productionCost || 0) * (ci.quantity || 1), 0)
      );
    }

    return round2(
      item.recipeItems.reduce((sum, ri) => sum + ri.product.currentPrice * ri.quantityNeeded, 0)
    );
  }

  /**
   * Calcular precio sugerido basado en el margen de ganancia (sobre costo, máx 30%)
   */
  calculateSuggestedPrice(productionCost, maxMarginPct = MAX_MARGIN) {
    const cappedMargin = Math.min(parseFloat(maxMarginPct) || MAX_MARGIN, MAX_MARGIN);
    return round2(productionCost * (1 + cappedMargin / 100));
  }

  /**
   * Validar que la ganancia no supere el 30% sobre el costo
   */
  validateProfitMargin(salePrice, productionCost, maxMarginPct = MAX_MARGIN) {
    const cappedMaxMargin = Math.min(parseFloat(maxMarginPct) || MAX_MARGIN, MAX_MARGIN);
    if (!productionCost) {
      return { valid: true, actualMargin: 0, maxMarginPct: cappedMaxMargin, maxAllowedPrice: 0, productionCost: 0, salePrice };
    }
    const actualMargin = ((salePrice - productionCost) / productionCost) * 100;
    return {
      valid: actualMargin <= cappedMaxMargin + 0.05, // tolerancia por redondeo
      actualMargin: round2(actualMargin),
      maxMarginPct: cappedMaxMargin,
      maxAllowedPrice: round2(productionCost * (1 + cappedMaxMargin / 100)),
      productionCost,
      salePrice,
    };
  }

  /**
   * Verifica que todos los ingredientes existan en el inventario y tengan stock suficiente.
   * Devuelve la receta normalizada + costo calculado. Lanza error 400 con detalle si hay faltantes.
   */
  async validateRecipeAgainstInventory(recipe = []) {
    const clean = (recipe || [])
      .filter((r) => r && r.productId && parseFloat(r.quantityNeeded) > 0)
      .map((r) => ({ productId: parseInt(r.productId), quantityNeeded: parseFloat(r.quantityNeeded) }));

    if (clean.length === 0) {
      throw httpError('Debes agregar al menos un insumo del inventario con una cantidad mayor a 0.');
    }

    // Detectar insumos repetidos
    const ids = clean.map((r) => r.productId);
    const dup = ids.find((id, i) => ids.indexOf(id) !== i);
    if (dup) {
      throw httpError('Hay un insumo repetido en la receta. Unifica las cantidades en una sola línea.');
    }

    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      include: { inventoryLots: { where: { status: 'ACTIVE', quantityRemaining: { gt: 0 } }, select: { quantityRemaining: true } } },
    });

    const problems = [];
    let cost = 0;
    const normalized = [];

    for (const r of clean) {
      const p = products.find((x) => x.id === r.productId);
      if (!p || !p.isActive) {
        problems.push({ productId: r.productId, name: p?.name || `Insumo #${r.productId}`, reason: 'NO_EXISTE', message: 'no se encuentra registrado/activo en el inventario' });
        continue;
      }
      const stock = round2(p.inventoryLots.reduce((s, l) => s + l.quantityRemaining, 0));
      if (stock <= 0) {
        problems.push({ productId: p.id, name: p.name, reason: 'SIN_STOCK', stock, required: r.quantityNeeded, unit: p.unitOfMeasure, message: `sin existencias (0 ${p.unitOfMeasure})` });
      } else if (stock < r.quantityNeeded) {
        problems.push({ productId: p.id, name: p.name, reason: 'ESCASO', stock, required: r.quantityNeeded, unit: p.unitOfMeasure, message: `escaso: hay ${stock} ${p.unitOfMeasure} y la receta requiere ${r.quantityNeeded} ${p.unitOfMeasure}` });
      }
      cost += p.currentPrice * r.quantityNeeded;
      normalized.push({ ...r, unitOfMeasure: p.unitOfMeasure });
    }

    if (problems.length > 0) {
      const detail = problems.map((p) => `• ${p.name}: ${p.message}`).join('\n');
      throw httpError(`No se puede guardar el plato. Ingredientes escasos o inexistentes en inventario:\n${detail}`, 400, { details: problems });
    }

    return { recipe: normalized, productionCost: round2(cost) };
  }

  /**
   * Resolver precio final y margen real garantizando la política del 30%
   */
  resolvePricing(productionCost, salePrice, profitMarginPct) {
    const requestedMargin = profitMarginPct !== undefined && profitMarginPct !== null && profitMarginPct !== ''
      ? parseFloat(profitMarginPct)
      : MAX_MARGIN;
    if (requestedMargin > MAX_MARGIN) {
      throw httpError('La política de Pollos La Llovizna establece que el margen de ganancia máxima no puede superar el 30% de su costo.');
    }
    const suggestedPrice = this.calculateSuggestedPrice(productionCost, MAX_MARGIN);
    const finalSalePrice = salePrice !== undefined && salePrice !== null && salePrice !== '' && !isNaN(parseFloat(salePrice))
      ? round2(parseFloat(salePrice))
      : this.calculateSuggestedPrice(productionCost, requestedMargin);

    if (finalSalePrice <= 0) throw httpError('El precio de venta debe ser mayor a 0.');

    const validation = this.validateProfitMargin(finalSalePrice, productionCost, MAX_MARGIN);
    if (!validation.valid && productionCost > 0) {
      throw httpError(
        `El precio asignado ($${finalSalePrice.toFixed(2)}) genera un margen de ${validation.actualMargin}% y supera el 30% permitido sobre el costo ($${productionCost.toFixed(2)}). Precio máximo permitido: $${validation.maxAllowedPrice.toFixed(2)}`
      );
    }

    return {
      suggestedPrice,
      salePrice: finalSalePrice,
      profitMarginPct: productionCost > 0 ? validation.actualMargin : 0,
    };
  }

  /**
   * Crear un plato con su receta (validando inventario y margen ANTES de guardar)
   */
  async createMenuItem({ name, description, type, salePrice, profitMarginPct, imageUrl, recipe }) {
    const { recipe: cleanRecipe, productionCost } = await this.validateRecipeAgainstInventory(recipe);
    const pricing = this.resolvePricing(productionCost, salePrice, profitMarginPct);

    const created = await prisma.$transaction(async (tx) => {
      const menuItem = await tx.menuItem.create({
        data: {
          name,
          description,
          type: type === 'DISH' ? 'PLATO' : type || 'PLATO',
          productionCost,
          ...pricing,
          imageUrl,
        },
      });
      await tx.recipeItem.createMany({
        data: cleanRecipe.map((r) => ({ menuItemId: menuItem.id, ...r })),
      });
      return menuItem;
    });

    return prisma.menuItem.findUnique({
      where: { id: created.id },
      include: { recipeItems: { include: { product: true } } },
    });
  }

  /**
   * Actualizar un plato o combo (receta, contenido, precio) y recalcular costos
   */
  async updateMenuItem(id, { name, description, salePrice, profitMarginPct, imageUrl, isActive, recipe, comboItems, items }) {
    const current = await prisma.menuItem.findUnique({ where: { id } });
    if (!current) throw httpError('Plato no encontrado.', 404);

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (isActive !== undefined) updateData.isActive = isActive;

    let productionCost = current.productionCost;
    let cleanRecipe = null;
    let cleanCombo = null;

    if (current.type !== 'COMBO' && recipe) {
      const res = await this.validateRecipeAgainstInventory(recipe);
      cleanRecipe = res.recipe;
      productionCost = res.productionCost;
    } else if (current.type === 'COMBO' && (comboItems || items)) {
      const input = (comboItems || items).filter((ci) => ci.menuItemId);
      if (input.length === 0) throw httpError('El combo debe tener al menos un plato.');
      cleanCombo = input.map((ci) => ({ menuItemId: parseInt(ci.menuItemId), quantity: parseInt(ci.quantity) || 1 }));
      const children = await prisma.menuItem.findMany({ where: { id: { in: cleanCombo.map((c) => c.menuItemId) } } });
      productionCost = round2(cleanCombo.reduce((s, c) => s + (children.find((x) => x.id === c.menuItemId)?.productionCost || 0) * c.quantity, 0));
    } else {
      productionCost = await this.calculateProductionCost(id);
    }

    // Si no se envía precio, se conserva el actual (validándolo contra el nuevo costo)
    const priceToUse = salePrice !== undefined ? salePrice : (profitMarginPct !== undefined ? undefined : current.salePrice);
    const pricing = this.resolvePricing(productionCost, priceToUse, profitMarginPct);

    Object.assign(updateData, { productionCost, ...pricing });

    await prisma.$transaction(async (tx) => {
      if (cleanRecipe) {
        await tx.recipeItem.deleteMany({ where: { menuItemId: id } });
        await tx.recipeItem.createMany({ data: cleanRecipe.map((r) => ({ menuItemId: id, ...r })) });
      }
      if (cleanCombo) {
        await tx.comboItem.deleteMany({ where: { comboId: id } });
        await tx.comboItem.createMany({ data: cleanCombo.map((c) => ({ comboId: id, ...c })) });
      }
      await tx.menuItem.update({ where: { id }, data: updateData });
    });

    return prisma.menuItem.findUnique({
      where: { id },
      include: {
        recipeItems: { include: { product: true } },
        comboParent: { include: { menuItem: true } },
      },
    });
  }

  /**
   * Recalcular todos los costos de producción (platos primero, luego combos)
   */
  async recalculateAllCosts() {
    const items = await prisma.menuItem.findMany({ where: { isActive: true } });
    const ordered = [...items.filter((i) => i.type !== 'COMBO'), ...items.filter((i) => i.type === 'COMBO')];

    let updated = 0;
    for (const item of ordered) {
      const productionCost = await this.calculateProductionCost(item.id);
      const suggestedPrice = this.calculateSuggestedPrice(productionCost, MAX_MARGIN);
      if (productionCost !== item.productionCost || suggestedPrice !== item.suggestedPrice) {
        const actualMargin = productionCost > 0 ? round2(((item.salePrice - productionCost) / productionCost) * 100) : 0;
        await prisma.menuItem.update({
          where: { id: item.id },
          data: { productionCost, suggestedPrice, profitMarginPct: actualMargin },
        });
        updated++;
      }
    }

    return { updated, total: items.length };
  }
}

module.exports = new MenuService();
