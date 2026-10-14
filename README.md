# 🍗 Sistema de Gestión de Inventario Automatizado
### Restaurante Pollos La Llovizna

Sistema integral de información y gestión operativa con lógica **FIFO (First-In, First-Out)**, recetario dinámico con validación de márgenes de ganancia, punto de venta (POS) con descuento automático de insumos, monitoreo de precios, asistente con Inteligencia Artificial (PolloBot) y sincronización en tiempo real vía WebSockets.

---

## 🚀 Arquitectura y Tecnologías

- **Frontend:** React (Vite), Vanilla CSS3 estructurado (paleta cálida naranja `#F97316` + Sidebar oscuro `#171513`), Socket.io-client, Lucide Icons.
- **Backend:** Node.js, Express.js, JWT, bcryptjs, Socket.io, node-cron.
- **Base de Datos & ORM:** Prisma ORM. Compatible con SQLite (desarrollo rápido sin dependencias).
- **Asistente IA:** PolloBot con restricción de contexto estricta al restaurante y alimentación con datos en tiempo real (Gemini API / motor analítico contextual integrado).
- **Automatización:** Tareas programadas (*Cron Jobs*) para alertas de stock crítico y vencimientos de lotes.

---

## 📋 Módulos del Sistema

### 1. Autenticación & Usuarios (RBAC)
- **Primer usuario registrado:** Se convierte automáticamente en **Administrador / Superusuario**.
- **Usuarios secundarios:** Creación con control de acceso basado en roles (`ADMIN`, `GERENTE`, `CAJERO`, `VISUALIZADOR`) con matriz de 28 permisos granulares.
- Autenticación segura mediante **JWT** (JSON Web Tokens).

### 2. Inventario & Materia Prima (FIFO)
- Registro de insumos: Pollo entero, papas, carbón vegetal, aceite, condimentos, envases, etc.
- Gestión por **LOTE** con fecha de ingreso, proveedor, precio de compra y fecha de caducidad.
- **Lógica FIFO:** Las ventas descuentan primero del lote activo más antiguo.
- **Semáforo de Stock:** Indicadores de estado Óptimo, Por Agotarse y Crítico con alertas visuales y sonoras en tiempo real.

### 3. Menú, Platos & Recetario (Costos y Márgenes)
- Creación de platos individuales y combos familiares.
- **Recetario dinámico:** Selección de insumos y cantidades requeridas por ración.
- **Cálculo automático de costo:** $\text{Costo} = \sum (\text{Insumo} \times \text{Cantidad})$.
- **Validación de margen de ganancia:** Regla de negocio configurable (máximo 30% sobre el costo). Cálculo automático de precio sugerido.
- Botón de recálculo masivo ante cambios en los precios de compra de los insumos.

### 4. Punto de Venta (POS) & Ventas
- Registro ágil de comandas en mostrador con selección de platos/combos y método de pago (Efectivo / Tarjeta).
- **Descuento automático de inventario:** Al confirmar la comanda, el servidor descuenta las materias primas lote por lote en estricto orden FIFO y registra la trazabilidad en `InventoryMovement`.

### 5. Estadísticas, Costos & Reportes
- Resumen financiero: Ingresos brutos, costo de materia prima vendida, gastos operativos (gas, luz, sueldos) y beneficio neto estimado.
- Historial de variación mensual de precios de materias primas por proveedor.
- Rotación de menú y ranking de platos más vendidos.

### 6. Agente de IA Asistente (PolloBot)
- Widget flotante interactivo con acceso a los datos en vivo del inventario, alertas y márgenes de los platos.
- **Restricción estricta de contexto:** Solo responde consultas del negocio gastronómico e ignora temas ajenos.

### 7. Copias de Seguridad (Backups)
- Generación de respaldos manuales con un solo clic.
- Descarga directa de archivos de respaldo JSON con estructura relacional completa.
- Programación periódica automatizada vía *Cron*.

---

## ⚙️ Instrucciones de Instalación y Ejecución

### Requisitos previos
- **Node.js** v18+ instalado.

### 1. Iniciar el Servidor Backend
```bash
cd backend
npm start
```
> El servidor iniciará en `http://localhost:5000` con la base de datos `dev.db` lista y los roles/categorías pre-cargados.

### 2. Iniciar la Interfaz Web Frontend
En una nueva terminal:
```bash
cd frontend
npm run dev
```
> La aplicación estará disponible en `http://localhost:5173`.

### 3. Primer Acceso
1. Abre tu navegador en `http://localhost:5173`.
2. Haz clic en **"¿Primer acceso o nuevo usuario? Regístrate aquí"**.
3. Ingresa tu nombre, correo y contraseña.
4. **¡Listo!** El sistema te registrará automáticamente como **Superadministrador** con acceso completo a todos los módulos.

---# Proyecto
