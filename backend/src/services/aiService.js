const prisma = require('../config/database');

/**
 * Servicio del Asistente IA para "Pollos La Llovizna".
 * Proporciona un motor analítico inteligente local totalmente dinámico
 * con conexión opcional a Google Gemini 1.5/2.0 Flash.
 */
class AiService {
  /**
   * Obtiene todos los datos en vivo del restaurante desde la base de datos
   */
  async getLiveBusinessContext() {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [
        products,
        alerts,
        menuItems,
        salesToday,
        allSales,
        suppliers,
        expenses,
      ] = await Promise.all([
        prisma.product.findMany({
          where: { isActive: true },
          include: {
            category: { select: { name: true } },
            productSuppliers: { include: { supplier: { select: { name: true, contactPhone: true } } } },
            inventoryLots: {
              where: { status: 'ACTIVE', quantityRemaining: { gt: 0 } },
              orderBy: { entryDate: 'asc' }, // FIFO
            },
          },
          orderBy: { name: 'asc' },
        }),
        prisma.alert.findMany({
          where: { isRead: false },
          orderBy: { createdAt: 'desc' },
          take: 15,
        }),
        prisma.menuItem.findMany({
          where: { isActive: true },
          include: {
            recipeItems: { include: { product: true } },
            comboParent: { include: { menuItem: true } },
          },
          orderBy: { profitMarginPct: 'desc' },
        }).then((items) => items.map(({ comboParent, ...m }) => ({ ...m, comboItems: comboParent }))),
        prisma.sale.findMany({
          where: { saleDate: { gte: startOfDay }, status: 'COMPLETED' },
          include: { saleItems: { include: { menuItem: true } } },
        }),
        prisma.sale.findMany({
          where: { status: 'COMPLETED' },
          include: { saleItems: { include: { menuItem: true } } },
          orderBy: { saleDate: 'desc' },
          take: 50,
        }),
        prisma.supplier.findMany({
          where: { isActive: true },
          include: { productSuppliers: { include: { product: { select: { name: true } } } } },
        }),
        prisma.operationalExpense.findMany({
          orderBy: { expenseDate: 'desc' },
          take: 10,
        }),
      ]);

      // Calcular stock total por producto
      const productsWithMetrics = products.map((p) => {
        const totalStock = p.inventoryLots.reduce((sum, l) => sum + l.quantityRemaining, 0);
        const isLow = totalStock <= p.minStockThreshold;
        const isCritical = totalStock <= (p.minStockThreshold * 0.5);
        const earliestLot = p.inventoryLots[0] || null;
        return {
          ...p,
          totalStock: Math.round(totalStock * 100) / 100,
          isLow,
          isCritical,
          earliestLot,
        };
      });

      // Lotes próximos a vencer (en los próximos 7 días o ya vencidos)
      const expiringLots = [];
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      products.forEach((p) => {
        p.inventoryLots.forEach((lot) => {
          if (lot.expirationDate) {
            const exp = new Date(lot.expirationDate);
            if (exp <= sevenDaysFromNow) {
              const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
              expiringLots.push({
                productName: p.name,
                lotCode: lot.lotCode,
                quantityRemaining: lot.quantityRemaining,
                unitOfMeasure: p.unitOfMeasure,
                expirationDate: exp,
                diffDays,
                isExpired: diffDays < 0,
              });
            }
          }
        });
      });

      // Métricas de ventas
      const todayRevenue = salesToday.reduce((sum, s) => sum + s.totalAmount, 0);
      const todayCost = salesToday.reduce((sum, s) => sum + s.totalCost, 0);
      const todayProfit = todayRevenue - todayCost;

      // Ranking de platos más vendidos
      const itemCounts = {};
      allSales.forEach((s) => {
        s.saleItems.forEach((si) => {
          const name = si.menuItem.name;
          if (!itemCounts[name]) itemCounts[name] = { name, count: 0, revenue: 0 };
          itemCounts[name].count += si.quantity;
          itemCounts[name].revenue += si.subtotal;
        });
      });
      const topSellingItems = Object.values(itemCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        products: productsWithMetrics,
        alerts,
        menuItems,
        expiringLots,
        salesToday: {
          count: salesToday.length,
          revenue: Math.round(todayRevenue * 100) / 100,
          cost: Math.round(todayCost * 100) / 100,
          profit: Math.round(todayProfit * 100) / 100,
        },
        topSellingItems,
        suppliers,
        expenses,
      };
    } catch (err) {
      console.error('Error obteniendo contexto del restaurante:', err);
      return null;
    }
  }

  /**
   * Procesa la consulta del usuario mediante Gemini o el Motor Analítico Local Dinámico
   */
  async processQuery(userId, userMessage) {
    const liveData = await this.getLiveBusinessContext();

    if (!liveData) {
      return '⚠️ Lo siento, ocurrió una dificultad técnica al consultar la base de datos de Pollos La Llovizna. Por favor, reintenta en un momento.';
    }

    // Regla de negocio: rechazar consultas ajenas al restaurante
    const qLower = userMessage.toLowerCase().trim();
    const outOfContextKeywords = [
      'politica', 'presidente', 'futbol', 'fifa', 'champions', 'pelicula', 'cine',
      'cancion', 'cuentame un chiste', 'clima', 'formula 1', 'nba', 'poema',
    ];
    if (outOfContextKeywords.some((k) => qLower.includes(k))) {
      return '⚠️ **Ámbito Operativo de PolloBot:**\n\nSolo puedo responder preguntas y brindar análisis sobre inventario, insumos, recetas, costos, ventas y proveedores de **Pollos La Llovizna**.\n\n¿Deseas consultar el stock de algún insumo o el costo de producción de nuestros platos?';
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Si hay Gemini API Key configurada, llamar a Google Gemini
    if (apiKey && apiKey.trim() !== '') {
      try {
        const systemPrompt = `
Eres "PolloBot", el Asistente Experto en Gestión de Inventario, Costos y Operaciones de "Pollos La Llovizna".
Tu misión es asistir al dueño, gerentes y cajeros con información veraz y accionable.

REGLA DE NEGOCIO CRÍTICA:
- La política de rentabilidad de Pollos La Llovizna establece que el margen de ganancia máxima por plato o combo NO puede superar el 30% de su costo de producción (Precio Sugerido = Costo * 1.30).

DATOS EN VIVO DEL RESTAURANTE (BASE DE DATOS EN TIEMPO REAL):
- INSUMOS Y STOCK ACTUAL:
${liveData.products.map((p) => `* ${p.name} (${p.category?.name || 'General'}): Stock ${p.totalStock} ${p.unitOfMeasure} | Mínimo: ${p.minStockThreshold} ${p.unitOfMeasure} | Precio Costo: $${p.currentPrice.toFixed(2)} | Estado: ${p.isCritical ? 'CRÍTICO' : p.isLow ? 'BAJO' : 'NORMAL'}`).join('\n')}

- LOTES POR VENCER O VENCIDOS:
${liveData.expiringLots.length > 0 ? liveData.expiringLots.map((l) => `* ${l.productName} (Lote: ${l.lotCode}): ${l.quantityRemaining} ${l.unitOfMeasure} vence en ${l.diffDays} días (${l.diffDays < 0 ? 'VENCIDO' : 'PRÓXIMO'}).`).join('\n') : 'No hay insumos próximos a vencer en los próximos 7 días.'}

- MENÚ, RECETAS Y MÁRGENES:
${liveData.menuItems.map((m) => `* ${m.name} (${m.type}): Costo Producción $${m.productionCost.toFixed(2)} | Precio Venta $${m.salePrice.toFixed(2)} | Margen: ${m.profitMarginPct.toFixed(1)}% (Máx 30%)`).join('\n')}

- VENTAS DE HOY:
* Total Órdenes: ${liveData.salesToday.count} | Ingresos: $${liveData.salesToday.revenue.toFixed(2)} | Costo Alimentos: $${liveData.salesToday.cost.toFixed(2)} | Ganancia: $${liveData.salesToday.profit.toFixed(2)}

- PLATOS MÁS VENDIDOS:
${liveData.topSellingItems.map((t, idx) => `${idx + 1}. ${t.name}: ${t.count} unidades vendidas ($${t.revenue.toFixed(2)})`).join('\n') || 'Aún no hay ventas registradas.'}

INSTRUCCIONES DE RESPUESTA:
1. Responde de forma clara, directa, profesional y usando emojis de restaurante.
2. Si te preguntan por un insumo o plato específico, usa los datos exactos del inventario arriba.
3. Si un insumo tiene stock bajo o crítico, adviértelo con claridad.
4. Usa formato Markdown con negritas y listas para fácil lectura.
`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: systemPrompt },
                    { text: `Pregunta del usuario: ${userMessage}` },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.25,
                maxOutputTokens: 900,
              },
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Gemini HTTP Error ${response.status}`);
        }

        const data = await response.json();
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
          const aiText = data.candidates[0].content.parts[0].text;
          await this.saveHistory(userId, userMessage, aiText);
          return aiText;
        } else {
          throw new Error('Respuesta vacía de Gemini');
        }
      } catch (geminiError) {
        console.warn('Fallo llamada a Gemini API, activando Motor Analítico Local Dinámico:', geminiError.message);
        // Fallback fluido y transparente al motor analítico dinámico
        const localReply = this.processLocalSmartQuery(userMessage, liveData);
        await this.saveHistory(userId, userMessage, localReply);
        return localReply;
      }
    }

    // Motor analítico local dinámico (cálculos reales sobre la base de datos)
    const reply = this.processLocalSmartQuery(userMessage, liveData);
    await this.saveHistory(userId, userMessage, reply);
    return reply;
  }

  /**
   * Motor Analítico Dinámico Local:
   * Calcula métricas exactas y genera respuestas en tiempo real analizando la base de datos.
   */
  processLocalSmartQuery(query, data) {
    const q = query.toLowerCase();

    // 1. CONSULTA DE STOCK ESPECÍFICO DE UN PRODUCTO
    const foundProduct = data.products.find((p) => {
      const name = p.name.toLowerCase();
      const pWords = name.split(' ');
      return q.includes(name) || pWords.some((w) => w.length > 3 && q.includes(w));
    });

    if (foundProduct && (q.includes('stock') || q.includes('cuanto') || q.includes('queda') || q.includes('precio') || q.includes('costo') || q.includes('hay') || q.includes('tengo'))) {
      const p = foundProduct;
      const valuation = Math.round((p.totalStock * p.currentPrice) * 100) / 100;
      let statusEmoji = '🟢';
      let statusText = 'Nivel Óptimo';

      if (p.isCritical) {
        statusEmoji = '🔴';
        statusText = 'CRÍTICO (Stock por debajo del 50% del umbral mínimo)';
      } else if (p.isLow) {
        statusEmoji = '🟡';
        statusText = 'BAJO (Por debajo del umbral mínimo)';
      }

      let response = `🍗 **Detalle en Tiempo Real: ${p.name}**\n\n`;
      response += `- **Stock Disponible:** **${p.totalStock} ${p.unitOfMeasure}**\n`;
      response += `- **Umbral Mínimo:** ${p.minStockThreshold} ${p.unitOfMeasure}\n`;
      response += `- **Estado Operativo:** ${statusEmoji} ${statusText}\n`;
      response += `- **Precio de Costo Actual:** $${p.currentPrice.toFixed(2)} por ${p.unitOfMeasure}\n`;
      response += `- **Valorización del Stock:** $${valuation.toFixed(2)}\n`;

      if (p.inventoryLots.length > 0) {
        response += `\n📦 **Lotes Activos (FIFO):**\n`;
        p.inventoryLots.slice(0, 3).forEach((lot, i) => {
          const expText = lot.expirationDate
            ? new Date(lot.expirationDate).toLocaleDateString('es-ES')
            : 'Sin fecha';
          response += `  ${i + 1}. Lote \`${lot.lotCode}\`: ${lot.quantityRemaining} ${p.unitOfMeasure} (Vence: ${expText}, Costo: $${lot.purchasePrice.toFixed(2)})\n`;
        });
      } else {
        response += `\n⚠️ *No hay lotes activos con existencia registrada para este producto.*\n`;
      }

      if (p.isLow) {
        const toOrder = Math.max(p.minStockThreshold * 2 - p.totalStock, p.minStockThreshold);
        response += `\n💡 **Recomendación:** Se sugiere realizar un pedido de reposición de aproximadamente **${toOrder} ${p.unitOfMeasure}**.`;
        const supp = p.productSuppliers[0]?.supplier;
        if (supp) {
          response += ` Proveedor habitual: **${supp.name}** (Tel: ${supp.contactPhone || 'No registrado'}).`;
        }
      }

      return response;
    }

    // 2. CONSULTA DE UN PLATO O RECETA ESPECÍFICA
    const foundMenuItem = data.menuItems.find((m) => {
      const name = m.name.toLowerCase();
      const mWords = name.split(' ');
      return q.includes(name) || mWords.some((w) => w.length > 3 && q.includes(w));
    });

    if (foundMenuItem && (q.includes('receta') || q.includes('costo') || q.includes('plato') || q.includes('preparar') || q.includes('precio') || q.includes('margen') || q.includes('ingrediente'))) {
      const m = foundMenuItem;
      const profitPerUnit = Math.round((m.salePrice - m.productionCost) * 100) / 100;
      const marginRespectsPolicy = m.profitMarginPct <= 30;

      let response = `📋 **Ficha Técnica de Cocina: ${m.name}** (${m.type})\n\n`;
      response += `- **Costo de Producción:** **$${m.productionCost.toFixed(2)}**\n`;
      response += `- **Precio de Venta:** **$${m.salePrice.toFixed(2)}**\n`;
      response += `- **Ganancia Neta por Unidad:** $${profitPerUnit.toFixed(2)}\n`;
      response += `- **Margen sobre Costo:** **${m.profitMarginPct.toFixed(1)}%** ${marginRespectsPolicy ? '✅ (Cumple política ≤ 30%)' : '⚠️ (Supera la política del 30%)'}\n`;
      response += `- **Precio Sugerido Máximo (Costo + 30%):** $${(m.productionCost * 1.30).toFixed(2)}\n\n`;

      if (m.recipeItems && m.recipeItems.length > 0) {
        response += `🥗 **Insumos Requeridos por Porción:**\n`;
        m.recipeItems.forEach((ri) => {
          const itemCost = (ri.quantityNeeded * (ri.product?.currentPrice || 0)).toFixed(2);
          response += `  • ${ri.product?.name || 'Insumo'}: ${ri.quantityNeeded} ${ri.unitOfMeasure} (Costo: $${itemCost})\n`;
        });
      } else if (m.comboItems && m.comboItems.length > 0) {
        response += `🍱 **Componentes del Combo:**\n`;
        m.comboItems.forEach((ci) => {
          response += `  • ${ci.quantity}x ${ci.menuItem?.name} (Costo unitario: $${ci.menuItem?.productionCost.toFixed(2)})\n`;
        });
      }

      return response;
    }

    // 3. ALERTAS DE STOCK BAJO Y SUGERENCIAS DE COMPRA
    if (q.includes('alerta') || q.includes('bajo') || q.includes('critico') || q.includes('comprar') || q.includes('reabastecer') || q.includes('falta') || q.includes('pedido')) {
      const lowStockItems = data.products.filter((p) => p.isLow);

      if (lowStockItems.length === 0) {
        return `✅ **Excelente Estado Operativo:**\n\nTodos los insumos del restaurante se encuentran por encima de sus umbrales mínimos de stock. No hay alertas de desabastecimiento pendientes en este momento.`;
      }

      let response = `🚨 **Insumos con Stock Bajo o Crítico (${lowStockItems.length}):**\n\n`;
      let totalEstimatedBudget = 0;

      lowStockItems.forEach((p) => {
        const orderQty = Math.max(p.minStockThreshold * 2 - p.totalStock, p.minStockThreshold);
        const estCost = Math.round((orderQty * p.currentPrice) * 100) / 100;
        totalEstimatedBudget += estCost;

        const icon = p.isCritical ? '🔴' : '🟡';
        response += `${icon} **${p.name}**\n`;
        response += `   - Stock Actual: **${p.totalStock} ${p.unitOfMeasure}** (Mínimo: ${p.minStockThreshold} ${p.unitOfMeasure})\n`;
        response += `   - Cantidad Sugerida a Pedir: **${orderQty} ${p.unitOfMeasure}** (~$${estCost.toFixed(2)})\n`;
        const supp = p.productSuppliers[0]?.supplier;
        if (supp) {
          response += `   - Proveedor: ${supp.name} ${supp.contactPhone ? `(Tel: ${supp.contactPhone})` : ''}\n`;
        }
        response += `\n`;
      });

      response += `💰 **Presupuesto Estimado de Reposición Total:** **$${totalEstimatedBudget.toFixed(2)}**`;
      return response;
    }

    // 4. VENCIMIENTOS Y LOTES PRÓXIMOS A EXPIRAR
    if (q.includes('venc') || q.includes('caduc') || q.includes('expir') || q.includes('lote')) {
      if (data.expiringLots.length === 0) {
        return `📅 **Control de Caducidad:**\n\nNingún lote de inventario vence en los próximos 7 días. Todo el producto en cámara y almacén se encuentra en fecha óptima de consumo.`;
      }

      let response = `⚠️ **Control de Lotes Próximos a Vencer (${data.expiringLots.length}):**\n\n`;
      data.expiringLots.forEach((l) => {
        const status = l.isExpired
          ? `❌ VENCIDO HACE ${Math.abs(l.diffDays)} DÍAS`
          : l.diffDays === 0
          ? `🚨 VENCE HOY`
          : `⏳ Vence en ${l.diffDays} días (${l.expirationDate.toLocaleDateString('es-ES')})`;

        response += `- **${l.productName}** | Lote: \`${l.lotCode}\`\n`;
        response += `  Cantidad: **${l.quantityRemaining} ${l.unitOfMeasure}** — ${status}\n`;
      });

      response += `\n💡 **Recomendación Operativa:** Aplica rotación estricta FIFO y prioriza el uso de estos insumos en los combos y platos de mayor salida de la jornada para evitar mermas.`;
      return response;
    }

    // 5. VENTAS, INGRESOS Y PLATOS MÁS VENDIDOS
    if (q.includes('venta') || q.includes('ganancia') || q.includes('ingreso') || q.includes('recaud') || q.includes('vendido') || q.includes('caja')) {
      const t = data.salesToday;
      let response = `💰 **Resumen Financiero y de Ventas de Hoy:**\n\n`;
      response += `- **Órdenes Realizadas:** **${t.count} pedidos**\n`;
      response += `- **Venta Total Bruta:** **$${t.revenue.toFixed(2)}**\n`;
      response += `- **Costo de Insumos (Food Cost):** $${t.cost.toFixed(2)}\n`;
      response += `- **Ganancia Neta del Día:** **$${t.profit.toFixed(2)}**\n`;

      if (data.topSellingItems.length > 0) {
        response += `\n🏆 **Top Platos Más Vendidos:**\n`;
        data.topSellingItems.forEach((item, idx) => {
          response += `  ${idx + 1}. **${item.name}**: ${item.count} unidades ($${item.revenue.toFixed(2)})\n`;
        });
      }

      return response;
    }

    // 6. POLÍTICA DE MARGEN DE GANANCIA (30%)
    if (q.includes('margen') || q.includes('30%') || q.includes('politica') || q.includes('ganancia maxima')) {
      const compliantItems = data.menuItems.filter((m) => m.profitMarginPct <= 30);
      const nonCompliant = data.menuItems.filter((m) => m.profitMarginPct > 30);

      let response = `📊 **Auditoría de Márgenes de Ganancia (Regla Máxima 30%):**\n\n`;
      response += `Por política de Pollos La Llovizna, la ganancia sobre el costo de producción **no puede superar el 30%**.\n\n`;
      response += `- Total de Platos Analizados: **${data.menuItems.length}**\n`;
      response += `- Platos que cumplen la regla (≤30%): **${compliantItems.length}** ✅\n`;

      if (nonCompliant.length > 0) {
        response += `- ⚠️ Platos que exceden el 30%: **${nonCompliant.length}**:\n`;
        nonCompliant.forEach((m) => {
          const maxPrice = (m.productionCost * 1.30).toFixed(2);
          response += `  • **${m.name}**: Margen actual ${m.profitMarginPct.toFixed(1)}% (Precio: $${m.salePrice.toFixed(2)} | Máximo sugerido: $${maxPrice})\n`;
        });
      } else {
        response += `\n✨ **¡Excelente!** El 100% de la carta cumple rigurosamente el margen máximo del 30% establecido por la dirección.`;
      }

      return response;
    }

    // 7. INVENTARIO COMPLETO O RESUMEN GENERAL
    if (q.includes('inventario') || q.includes('insumo') || q.includes('stock') || q.includes('general') || q.includes('lista')) {
      let response = `📦 **Estado General del Inventario (${data.products.length} Insumos Activos):**\n\n`;
      const criticalCount = data.products.filter((p) => p.isCritical).length;
      const lowCount = data.products.filter((p) => p.isLow && !p.isCritical).length;

      response += `*Resumen:* ${criticalCount > 0 ? `🔴 ${criticalCount} Críticos | ` : ''}${lowCount > 0 ? `🟡 ${lowCount} Bajos | ` : ''}🟢 ${data.products.length - criticalCount - lowCount} Óptimos\n\n`;

      data.products.slice(0, 10).forEach((p) => {
        const icon = p.isCritical ? '🔴' : p.isLow ? '🟡' : '🟢';
        response += `${icon} **${p.name}**: **${p.totalStock} ${p.unitOfMeasure}** (Mín: ${p.minStockThreshold}, Costo: $${p.currentPrice.toFixed(2)})\n`;
      });

      if (data.products.length > 10) {
        response += `\n*...y ${data.products.length - 10} insumos más monitoreados en tiempo real.*`;
      }

      return response;
    }

    // 8. SALUDO O AYUDA GENERAL
    return `🍗 ¡Hola! Soy **PolloBot**, tu Asistente de Operaciones e Inventario en **Pollos La Llovizna**.\n
Actualmente estoy monitoreando:
- **${data.products.length} Insumos** en inventario (${data.products.filter((p) => p.isLow).length} con alerta de stock).
- **${data.menuItems.length} Platos y Combos** en recetario (verificando la regla de margen máx 30%).
- **${data.expiringLots.length} Lotes** con seguimiento de caducidad.
- **${data.salesToday.count} Ventas** registradas hoy ($${data.salesToday.revenue.toFixed(2)} recaudados).

💡 **Puedes preguntarme cosas como:**
- *"¿Cuánto pollo y papas tenemos en almacén?"*
- *"¿Hay insumos con stock bajo o sugerencia de compra?"*
- *"¿Qué lotes están próximos a vencer?"*
- *"¿Cuál es el costo y margen de ganancia de 1/4 Pollo al Carbón?"*
- *"¿Cuánto vendimos el día de hoy?"*
- *"¿Todos los platos cumplen la política de ganancia máxima del 30%?"*`;
  }

  /**
   * Guarda el historial de interacción del usuario
   */
  async saveHistory(userId, userMessage, aiResponse) {
    try {
      if (userId) {
        await prisma.aiChatHistory.create({
          data: {
            userId,
            userMessage,
            aiResponse,
          },
        });
      }
    } catch (saveError) {
      console.error('Error guardando historial de chat:', saveError.message);
    }
  }

  /**
   * Obtiene el historial de chat
   */
  async getChatHistory(userId, limit = 25) {
    return prisma.aiChatHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Limpia el historial de chat
   */
  async clearChatHistory(userId) {
    return prisma.aiChatHistory.deleteMany({
      where: { userId },
    });
  }
}

module.exports = new AiService();
