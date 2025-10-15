// ========== CONFIGURACIÓN Y CONSTANTES ==========
const CONFIG = {
    VERSION: '2.2.0',
    DATABASE_KEY: 'dany_shop_v2',
    NOTIFICATION_TIMEOUT: 5000,
    DEUDA_LIMITE_DIAS: 7,
    STOCK_BAJO_LIMITE: 10
};

// ========== MODELO DE DATOS MEJORADO ==========
class SistemaTienda {
    constructor() {
        this.cargarDatos();
        this.inicializarIDs();
    }

    cargarDatos() {
        try {
            const datos = JSON.parse(localStorage.getItem(CONFIG.DATABASE_KEY)) || {};
            this.clientes = datos.clientes || [];
            this.productos = datos.productos || [];
            this.ventas = datos.ventas || [];
            this.configuracion = datos.configuracion || { tema: 'claro' };
            this.metricas = datos.metricas || {
                ventasTotales: 0,
                gananciasTotales: 0,
                clientesActivos: 0,
                productosActivos: 0
            };
            this.actividad = datos.actividad || [];
        } catch (error) {
            console.error('Error cargando datos:', error);
            this.clientes = [];
            this.productos = [];
            this.ventas = [];
            this.configuracion = { tema: 'claro' };
            this.metricas = {
                ventasTotales: 0,
                gananciasTotales: 0,
                clientesActivos: 0,
                productosActivos: 0
            };
            this.actividad = [];
        }
    }

    guardarDatos() {
        try {
            // Actualizar métricas antes de guardar
            this.actualizarMetricas();
            
            const datos = {
                clientes: this.clientes,
                productos: this.productos,
                ventas: this.ventas,
                configuracion: this.configuracion,
                metricas: this.metricas,
                actividad: this.actividad,
                ultimaActualizacion: new Date().toISOString()
            };
            localStorage.setItem(CONFIG.DATABASE_KEY, JSON.stringify(datos));
            this.actualizarUI();
            return true;
        } catch (error) {
            console.error('Error guardando datos:', error);
            return false;
        }
    }

    actualizarMetricas() {
        this.metricas.ventasTotales = this.ventas.length;
        this.metricas.clientesActivos = this.clientes.filter(c => c.activo).length;
        this.metricas.productosActivos = this.productos.filter(p => p.activo).length;
        
        // Calcular ganancias totales
        this.metricas.gananciasTotales = this.ventas.reduce((total, venta) => {
            return total + (venta.ganancia || 0);
        }, 0);
    }

    agregarActividad(tipo, mensaje, datos = {}) {
        const actividad = {
            id: Date.now(),
            tipo,
            mensaje,
            datos,
            timestamp: new Date().toISOString(),
            leida: false
        };
        
        this.actividad.unshift(actividad);
        
        // Mantener solo las últimas 50 actividades
        if (this.actividad.length > 50) {
            this.actividad = this.actividad.slice(0, 50);
        }
        
        return actividad;
    }

    inicializarIDs() {
        // CORRECCIÓN: Verificar que los arrays no estén vacíos antes de calcular max
        this.nextClienteId = this.clientes.length > 0 ? Math.max(...this.clientes.map(c => c.id)) + 1 : 1;
        this.nextProductoId = this.productos.length > 0 ? Math.max(...this.productos.map(p => p.id)) + 1 : 1;
        this.nextVentaId = this.ventas.length > 0 ? Math.max(...this.ventas.map(v => v.id)) + 1 : 1;
    }

    // Métodos para gestionar clientes
    agregarCliente(nombre, folio, telefono = '', email = '') {
        if (!nombre || !folio) throw new Error('Nombre y folio son obligatorios');
        if (this.clientes.some(c => c.folio === folio)) throw new Error('El folio ya existe');

        const cliente = {
            id: this.nextClienteId++,
            nombre,
            folio,
            telefono,
            email,
            fechaRegistro: this.fechaHoy(),
            activo: true,
            totalCompras: 0,
            ultimaCompra: null
        };

        this.clientes.push(cliente);
        
        // Registrar actividad
        this.agregarActividad('cliente', `Nuevo cliente registrado: ${nombre} (${folio})`, { cliente });
        
        this.guardarDatos();
        return cliente;
    }

    obtenerClientePorFolio(folio) {
        return this.clientes.find(c => c.folio === folio && c.activo);
    }

    // Métodos para productos
    agregarProducto(nombre, precioCosto, precioVenta, cantidad = 0) {
        if (!nombre || precioCosto < 0 || precioVenta < 0) {
            throw new Error('Datos del producto inválidos');
        }

        const productoExistente = this.productos.find(p => 
            p.nombre.toLowerCase() === nombre.toLowerCase() && p.activo
        );

        if (productoExistente) {
            // Actualizar producto existente
            const cantidadAnterior = productoExistente.cantidad;
            productoExistente.precioCosto = precioCosto;
            productoExistente.precioVenta = precioVenta;
            productoExistente.cantidad += cantidad;
            if (productoExistente.cantidad < 0) productoExistente.cantidad = 0;
            
            // Registrar actividad
            if (cantidad !== 0) {
                const tipo = cantidad > 0 ? 'agregar' : 'quitar';
                this.agregarActividad('inventario', `Stock actualizado: ${nombre} (${cantidad > 0 ? '+' : ''}${cantidad})`, {
                    producto: productoExistente,
                    cambio: cantidad,
                    tipo
                });
            }
        } else {
            // Nuevo producto
            const producto = {
                id: this.nextProductoId++,
                nombre,
                precioCosto,
                precioVenta,
                cantidad: Math.max(0, cantidad),
                fechaCreacion: this.fechaHoy(),
                activo: true,
                ventasTotales: 0
            };
            this.productos.push(producto);
            
            // Registrar actividad
            this.agregarActividad('inventario', `Nuevo producto agregado: ${nombre}`, { producto });
        }

        this.guardarDatos();
    }

    obtenerProductoPorId(id) {
        return this.productos.find(p => p.id === id && p.activo);
    }

    obtenerProductosStockBajo() {
        return this.productos.filter(p => p.cantidad <= CONFIG.STOCK_BAJO_LIMITE && p.activo);
    }

    obtenerProductosSinStock() {
        return this.productos.filter(p => p.cantidad === 0 && p.activo);
    }

    // Métodos para ventas
    registrarVenta(folioCliente, tipoPago, productosInput) {
        const listaProductos = this.parsearProductosInput(productosInput);
        
        // Validaciones
        if (tipoPago === 'credito' && !folioCliente) {
            throw new Error('El folio es obligatorio para ventas a crédito');
        }

        if (listaProductos.length === 0) {
            throw new Error('Formato de productos inválido');
        }

        // Verificar stock y existencia
        for (const item of listaProductos) {
            const producto = this.obtenerProductoPorId(item.id);
            if (!producto) throw new Error(`Producto con ID ${item.id} no existe`);
            if (producto.cantidad < item.cantidad) {
                throw new Error(`Stock insuficiente para ${producto.nombre}. Disponible: ${producto.cantidad}`);
            }
        }

        // Procesar venta
        const productosConNombre = listaProductos.map(item => {
            const producto = this.obtenerProductoPorId(item.id);
            return {
                ...item,
                nombre: producto.nombre,
                precioUnitario: producto.precioVenta,
                costoUnitario: producto.precioCosto
            };
        });

        const total = this.calcularTotalVenta(listaProductos);
        const ganancia = this.calcularGananciaVenta(productosConNombre);
        
        const venta = {
            id: this.nextVentaId++,
            folioCliente: folioCliente || 'EFECTIVO',
            tipoPago,
            productos: productosConNombre,
            total,
            ganancia,
            fecha: this.fechaHoy(),
            hora: new Date().toLocaleTimeString(),
            pagada: tipoPago === 'efectivo'
        };

        this.ventas.push(venta);
        
        // Actualizar estadísticas de productos y clientes
        this.actualizarEstadisticasVenta(venta);
        
        // Registrar actividad
        this.agregarActividad('venta', `Nueva venta registrada: $${total.toFixed(2)}`, { venta });
        
        this.guardarDatos();
        return venta;
    }

    actualizarEstadisticasVenta(venta) {
        // Actualizar ventas por producto
        venta.productos.forEach(item => {
            const producto = this.obtenerProductoPorId(item.id);
            if (producto) {
                producto.ventasTotales = (producto.ventasTotales || 0) + item.cantidad;
                // Reducir stock
                producto.cantidad -= item.cantidad;
                if (producto.cantidad < 0) producto.cantidad = 0;
            }
        });

        // Actualizar cliente si existe
        if (venta.folioCliente !== 'EFECTIVO') {
            const cliente = this.obtenerClientePorFolio(venta.folioCliente);
            if (cliente) {
                cliente.totalCompras += venta.total;
                cliente.ultimaCompra = venta.fecha;
            }
        }
    }

    calcularGananciaVenta(productos) {
        return productos.reduce((ganancia, item) => {
            return ganancia + (item.precioUnitario - item.costoUnitario) * item.cantidad;
        }, 0);
    }

    // Métodos de utilidad
    fechaHoy() {
        return new Date().toISOString().split('T')[0];
    }

    sumarDias(fechaStr, dias) {
        const fecha = new Date(fechaStr);
        fecha.setDate(fecha.getDate() + dias);
        return fecha.toISOString().split('T')[0];
    }

    estaEnAtraso(fechaVenta) {
        const fechaLimite = this.sumarDias(fechaVenta, CONFIG.DEUDA_LIMITE_DIAS);
        return this.fechaHoy() > fechaLimite;
    }

    parsearProductosInput(input) {
        const resultado = [];
        if (!input) return resultado;
        
        const pares = input.split(',').map(p => p.trim());
        
        for (const par of pares) {
            if (!par) continue;
            const [idStr, cantidadStr] = par.split(':').map(s => s.trim());
            const id = parseInt(idStr);
            const cantidad = parseInt(cantidadStr);
            
            if (!isNaN(id) && !isNaN(cantidad) && cantidad > 0) {
                resultado.push({ id, cantidad });
            }
        }
        
        return resultado;
    }

    calcularTotalVenta(listaProductos) {
        let total = 0;
        for (const item of listaProductos) {
            const producto = this.obtenerProductoPorId(item.id);
            if (producto) {
                total += producto.precioVenta * item.cantidad;
            }
        }
        return total;
    }

    // Métodos para estadísticas
    obtenerEstadisticas() {
        const totalClientes = this.clientes.filter(c => c.activo).length;
        const totalProductos = this.productos.filter(p => p.activo).length;
        const totalVentas = this.ventas.length;
        
        const deudaTotal = this.ventas
            .filter(v => v.tipoPago === 'credito' && !v.pagada)
            .reduce((sum, v) => sum + v.total, 0);

        const ventasSemana = this.ventas.filter(v => {
            try {
                const fechaVenta = new Date(v.fecha);
                const hace7Dias = new Date();
                hace7Dias.setDate(hace7Dias.getDate() - 7);
                return fechaVenta >= hace7Dias;
            } catch {
                return false;
            }
        });

        const productosStockBajo = this.obtenerProductosStockBajo();
        const productosSinStock = this.obtenerProductosSinStock();

        return {
            totalClientes,
            totalProductos,
            totalVentas,
            deudaTotal,
            ventasSemana: ventasSemana.length,
            productosStockBajo: productosStockBajo.length,
            productosSinStock: productosSinStock.length,
            gananciasTotales: this.metricas.gananciasTotales
        };
    }

    // Métodos para reportes
    obtenerClientesEnAtraso() {
        const ventasCredito = this.ventas.filter(v => v.tipoPago === 'credito' && !v.pagada);
        const clientesEnAtraso = [];

        ventasCredito.forEach(v => {
            if (this.estaEnAtraso(v.fecha)) {
                const cliente = this.obtenerClientePorFolio(v.folioCliente);
                if (cliente && !clientesEnAtraso.some(c => c.folio === cliente.folio)) {
                    const deuda = this.ventas
                        .filter(venta => venta.folioCliente === cliente.folio && venta.tipoPago === 'credito' && !venta.pagada)
                        .reduce((sum, venta) => sum + venta.total, 0);
                        
                    clientesEnAtraso.push({
                        ...cliente,
                        deuda,
                        diasAtraso: this.calcularDiasAtraso(v.fecha)
                    });
                }
            }
        });

        return clientesEnAtraso;
    }

    calcularDiasAtraso(fechaVenta) {
        const fecha = new Date(fechaVenta);
        const hoy = new Date();
        const diferenciaTiempo = hoy.getTime() - fecha.getTime();
        return Math.ceil(diferenciaTiempo / (1000 * 3600 * 24)) - CONFIG.DEUDA_LIMITE_DIAS;
    }

    obtenerClientesConCreditoDisponible() {
        const foliosConCredito = new Set();
        
        this.ventas
            .filter(v => v.tipoPago === 'credito' && !this.estaEnAtraso(v.fecha) && !v.pagada)
            .forEach(v => foliosConCredito.add(v.folioCliente));

        return this.clientes.filter(c => foliosConCredito.has(c.folio));
    }

    // Métodos para búsqueda y filtrado
    buscarProductos(termino) {
        if (!termino) return this.productos.filter(p => p.activo);
        
        return this.productos.filter(p => 
            p.activo && (
                p.nombre.toLowerCase().includes(termino.toLowerCase()) ||
                p.id.toString().includes(termino)
            )
        );
    }

    filtrarProductos(productos, filtro) {
        switch (filtro) {
            case 'stock-bajo':
                return productos.filter(p => p.cantidad <= CONFIG.STOCK_BAJO_LIMITE);
            case 'sin-stock':
                return productos.filter(p => p.cantidad === 0);
            default:
                return productos;
        }
    }

    // Métodos para análisis de ventas
    obtenerTopProductos(periodo = 'semana', tipo = 'mas') {
        let fechaInicio;
        const hoy = new Date();
        
        switch (periodo) {
            case 'semana':
                fechaInicio = new Date(hoy);
                fechaInicio.setDate(hoy.getDate() - 7);
                break;
            case 'mes':
                fechaInicio = new Date(hoy);
                fechaInicio.setMonth(hoy.getMonth() - 1);
                break;
            case 'anio':
                fechaInicio = new Date(hoy);
                fechaInicio.setFullYear(hoy.getFullYear() - 1);
                break;
            default:
                fechaInicio = new Date(0); // Desde el inicio
        }
        
        const ventasFiltradas = this.ventas.filter(v => new Date(v.fecha) >= fechaInicio);
        const conteo = {};

        ventasFiltradas.forEach(v => {
            v.productos.forEach(p => {
                conteo[p.id] = (conteo[p.id] || 0) + p.cantidad;
            });
        });

        if (Object.keys(conteo).length === 0) {
            return null;
        }

        let idTop;
        if (tipo === 'mas') {
            idTop = Object.keys(conteo).reduce((a, b) => conteo[a] > conteo[b] ? a : b);
        } else {
            idTop = Object.keys(conteo).reduce((a, b) => conteo[a] < conteo[b] ? a : b);
        }

        const producto = this.obtenerProductoPorId(parseInt(idTop));
        return {
            producto,
            cantidad: conteo[idTop],
            periodo
        };
    }

    // Métodos para análisis financiero
    obtenerAnalisisFinanciero(periodo = 'todo') {
        let fechaInicio;
        const hoy = new Date();
        
        switch (periodo) {
            case 'hoy':
                fechaInicio = new Date(hoy);
                fechaInicio.setHours(0, 0, 0, 0);
                break;
            case 'semana':
                fechaInicio = new Date(hoy);
                fechaInicio.setDate(hoy.getDate() - 7);
                break;
            case 'mes':
                fechaInicio = new Date(hoy);
                fechaInicio.setMonth(hoy.getMonth() - 1);
                break;
            case 'anio':
                fechaInicio = new Date(hoy);
                fechaInicio.setFullYear(hoy.getFullYear() - 1);
                break;
            default:
                fechaInicio = new Date(0); // Desde el inicio
        }
        
        const ventasFiltradas = this.ventas.filter(v => new Date(v.fecha) >= fechaInicio);
        
        const totalInversion = this.productos.reduce((sum, p) => sum + p.precioCosto * p.cantidad, 0);
        let totalVentas = 0;
        let costoTotalVentas = 0;
        let gananciaTotal = 0;

        ventasFiltradas.forEach(v => {
            totalVentas += v.total;
            gananciaTotal += v.ganancia;
            
            v.productos.forEach(item => {
                costoTotalVentas += item.costoUnitario * item.cantidad;
            });
        });

        const margenGanancia = totalVentas > 0 ? (gananciaTotal / totalVentas) * 100 : 0;
        
        return {
            totalInversion,
            totalVentas,
            costoTotalVentas,
            gananciaTotal,
            margenGanancia,
            periodo,
            cantidadVentas: ventasFiltradas.length
        };
    }

    // Métodos para exportación de datos
    exportarDatos(formato = 'json') {
        const datos = {
            clientes: this.clientes,
            productos: this.productos,
            ventas: this.ventas,
            metricas: this.metricas,
            exportado: new Date().toISOString()
        };

        if (formato === 'json') {
            return JSON.stringify(datos, null, 2);
        } else if (formato === 'csv') {
            return this.convertirACSV(datos);
        }
        
        return datos;
    }

    convertirACSV(datos) {
        // Implementación básica de conversión a CSV
        let csv = 'Tipo,Datos\n';
        
        // Clientes
        csv += 'Clientes\n';
        csv += 'ID,Nombre,Folio,Telefono,Email,FechaRegistro\n';
        datos.clientes.forEach(c => {
            csv += `${c.id},${c.nombre},${c.folio},${c.telefono},${c.email},${c.fechaRegistro}\n`;
        });
        
        // Productos
        csv += '\nProductos\n';
        csv += 'ID,Nombre,PrecioCosto,PrecioVenta,Cantidad\n';
        datos.productos.forEach(p => {
            csv += `${p.id},${p.nombre},${p.precioCosto},${p.precioVenta},${p.cantidad}\n`;
        });
        
        return csv;
    }

    actualizarUI() {
        // Disparar evento personalizado para notificar cambios
        window.dispatchEvent(new CustomEvent('datosActualizados'));
    }
}

// ========== GESTIÓN DE LA INTERFAZ ==========
class InterfazUsuario {
    constructor(sistema) {
        this.sistema = sistema;
        this.panelActual = 'dashboard';
        this.filtroInventario = '';
        this.filtroTipo = 'todos';
        this.periodoTop = 'semana';
        this.periodoGanancias = 'todo';
    }

    inicializar() {
        this.inicializarTema();
        this.inicializarEventos();
        this.mostrarPanel('dashboard');
        this.actualizarDashboard();
        this.actualizarListasDesplegables();
        this.inicializarNavegacionScroll();
        this.ocultarLoading();
        this.inicializarMenuMovil();
        this.inicializarFiltros();
    }

    inicializarTema() {
        const temaGuardado = this.sistema.configuracion.tema || 'claro';
        if (temaGuardado === 'oscuro') {
            document.body.classList.add('tema-oscuro');
            this.actualizarIconoTema('sol');
        }
    }

    actualizarIconoTema(icono) {
        const btnTema = document.getElementById('btn-tema');
        if (!btnTema) return;
        
        const iconElement = btnTema.querySelector('i');
        if (icono === 'sol') {
            iconElement.classList.remove('fa-moon');
            iconElement.classList.add('fa-sun');
        } else {
            iconElement.classList.remove('fa-sun');
            iconElement.classList.add('fa-moon');
        }
    }

    inicializarEventos() {
        // CORRECCIÓN: Verificar que los elementos existen antes de agregar event listeners
        const btnTema = document.getElementById('btn-tema');
        if (btnTema) {
            btnTema.addEventListener('click', () => this.cambiarTema());
        }

        // Navegación principal
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const panel = e.currentTarget.dataset.panel;
                this.mostrarPanel(panel);
            });
        });

        // Acciones rápidas
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.mostrarPanel(action);
            });
        });

        // Formularios
        this.inicializarFormularios();

        // Evento para actualizaciones de datos
        window.addEventListener('datosActualizados', () => {
            this.actualizarDashboard();
            this.actualizarListasDesplegables();
        });

        // Botón de notificaciones
        const btnNotifications = document.getElementById('btn-notifications');
        if (btnNotifications) {
            btnNotifications.addEventListener('click', () => {
                this.mostrarNotificaciones();
            });
        }

        // Filtro de inventario
        const filtroInventario = document.getElementById('filtro-inventario');
        if (filtroInventario) {
            filtroInventario.addEventListener('input', (e) => {
                this.filtroInventario = e.target.value;
                this.renderizarInventario();
            });
        }

        // Exportar inventario
        const btnExportarInventario = document.getElementById('btn-exportar-inventario');
        if (btnExportarInventario) {
            btnExportarInventario.addEventListener('click', () => {
                this.exportarInventario();
            });
        }

        // Limpiar formularios
        this.inicializarBotonesLimpiar();
    }

    inicializarBotonesLimpiar() {
        const btnLimpiarVenta = document.getElementById('btn-limpiar-venta');
        if (btnLimpiarVenta) {
            btnLimpiarVenta.addEventListener('click', () => {
                this.limpiarFormularioVenta();
            });
        }

        const btnLimpiarProducto = document.getElementById('btn-limpiar-producto');
        if (btnLimpiarProducto) {
            btnLimpiarProducto.addEventListener('click', () => {
                this.limpiarFormularioProducto();
            });
        }

        const btnLimpiarCliente = document.getElementById('btn-limpiar-cliente');
        if (btnLimpiarCliente) {
            btnLimpiarCliente.addEventListener('click', () => {
                this.limpiarFormularioCliente();
            });
        }
    }

    inicializarMenuMovil() {
        const btnMenuMovil = document.getElementById('btn-menu-movil');
        const navegacion = document.getElementById('navegacion-principal');
        
        if (btnMenuMovil && navegacion) {
            btnMenuMovil.addEventListener('click', () => {
                navegacion.classList.toggle('activo');
            });
        }
    }

    inicializarFiltros() {
        // Filtros de inventario
        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remover clase active de todos los botones del mismo grupo
                e.currentTarget.parentElement.querySelectorAll('.filter-btn').forEach(b => {
                    b.classList.remove('active');
                });
                
                // Agregar clase active al botón clickeado
                e.currentTarget.classList.add('active');
                
                this.filtroTipo = e.currentTarget.dataset.filter;
                this.renderizarInventario();
            });
        });

        // Filtros de tiempo para top productos
        document.querySelectorAll('#top-mas-vendido .time-filter .filter-btn[data-period]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remover clase active de todos los botones del mismo grupo
                e.currentTarget.parentElement.querySelectorAll('.filter-btn').forEach(b => {
                    b.classList.remove('active');
                });
                
                // Agregar clase active al botón clickeado
                e.currentTarget.classList.add('active');
                
                this.periodoTop = e.currentTarget.dataset.period;
            });
        });

        // Filtros de tiempo para ganancias
        document.querySelectorAll('#costos-ganancias .time-filter .filter-btn[data-period]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remover clase active de todos los botones del mismo grupo
                e.currentTarget.parentElement.querySelectorAll('.filter-btn').forEach(b => {
                    b.classList.remove('active');
                });
                
                // Agregar clase active al botón clickeado
                e.currentTarget.classList.add('active');
                
                this.periodoGanancias = e.currentTarget.dataset.period;
            });
        });
    }

    inicializarFormularios() {
        // CORRECCIÓN: Verificar que los formularios existen antes de agregar event listeners
        
        // Alta de cliente
        const formAltaCliente = document.getElementById('form-alta-cliente');
        if (formAltaCliente) {
            formAltaCliente.addEventListener('submit', (e) => {
                e.preventDefault();
                this.procesarAltaCliente();
            });
        }

        // Consulta de deuda
        const formConsultaDeuda = document.getElementById('form-consulta-deuda');
        if (formConsultaDeuda) {
            formConsultaDeuda.addEventListener('submit', (e) => {
                e.preventDefault();
                this.procesarConsultaDeuda();
            });
        }

        // Historial de compras
        const formHistorialCompras = document.getElementById('form-historial-compras');
        if (formHistorialCompras) {
            formHistorialCompras.addEventListener('submit', (e) => {
                e.preventDefault();
                this.procesarHistorialCompras();
            });
        }

        // Registrar venta
        const formVenta = document.getElementById('form-venta');
        if (formVenta) {
            formVenta.addEventListener('submit', (e) => {
                e.preventDefault();
                this.procesarVenta();
            });
        }

        const btnCalcularTotal = document.getElementById('btn-calcular-total');
        if (btnCalcularTotal) {
            btnCalcularTotal.addEventListener('click', () => {
                this.calcularPreviewVenta();
            });
        }

        // Alta de producto
        const formAltaProducto = document.getElementById('form-alta-producto');
        if (formAltaProducto) {
            formAltaProducto.addEventListener('submit', (e) => {
                e.preventDefault();
                this.procesarAltaProducto();
            });
        }

        // Inventario
        const btnRefrescarInventario = document.getElementById('btn-refrescar-inventario');
        if (btnRefrescarInventario) {
            btnRefrescarInventario.addEventListener('click', () => {
                this.renderizarInventario();
            });
        }

        // Top más vendido
        const btnCalcularTopMas = document.getElementById('btn-calcular-top-mas');
        if (btnCalcularTopMas) {
            btnCalcularTopMas.addEventListener('click', () => {
                this.procesarTopMasVendido();
            });
        }

        // Top menos vendido
        const btnCalcularTopMenos = document.getElementById('btn-calcular-top-menos');
        if (btnCalcularTopMenos) {
            btnCalcularTopMenos.addEventListener('click', () => {
                this.procesarTopMenosVendido();
            });
        }

        // Costos y ganancias
        const btnCalcularGanancias = document.getElementById('btn-calcular-ganancias');
        if (btnCalcularGanancias) {
            btnCalcularGanancias.addEventListener('click', () => {
                this.procesarCostosGanancias();
            });
        }

        // Clientes en atraso
        const btnMostrarAtraso = document.getElementById('btn-mostrar-atraso');
        if (btnMostrarAtraso) {
            btnMostrarAtraso.addEventListener('click', () => {
                this.renderizarClientesAtraso();
            });
        }

        // Crédito disponible
        const btnMostrarCredito = document.getElementById('btn-mostrar-credito');
        if (btnMostrarCredito) {
            btnMostrarCredito.addEventListener('click', () => {
                this.renderizarClientesConCredito();
            });
        }
    }

    inicializarNavegacionScroll() {
        const navScrollContainer = document.querySelector('.nav-scroll-container');
        const scrollLeft = document.querySelector('.nav-scroll-indicator.left');
        const scrollRight = document.querySelector('.nav-scroll-indicator.right');
        
        if (!navScrollContainer) return;
        
        const updateScrollIndicators = () => {
            const { scrollLeft: scrollPos, scrollWidth, clientWidth } = navScrollContainer;
            
            // Mostrar/ocultar indicadores según la posición del scroll
            if (scrollLeft) {
                if (scrollPos > 0) {
                    scrollLeft.classList.remove('hidden');
                } else {
                    scrollLeft.classList.add('hidden');
                }
            }
            
            if (scrollRight) {
                if (scrollPos < scrollWidth - clientWidth - 1) {
                    scrollRight.classList.remove('hidden');
                } else {
                    scrollRight.classList.add('hidden');
                }
            }
        };
        
        // Eventos de scroll
        navScrollContainer.addEventListener('scroll', updateScrollIndicators);
        
        // Eventos de los botones de scroll
        if (scrollLeft) {
            scrollLeft.addEventListener('click', () => {
                navScrollContainer.scrollBy({ left: -200, behavior: 'smooth' });
            });
        }
        
        if (scrollRight) {
            scrollRight.addEventListener('click', () => {
                navScrollContainer.scrollBy({ left: 200, behavior: 'smooth' });
            });
        }
        
        // Actualizar indicadores al cargar
        updateScrollIndicators();
        
        // Actualizar en resize
        window.addEventListener('resize', updateScrollIndicators);
    }

    // Métodos para mostrar/ocultar paneles
    mostrarPanel(id) {
        // Ocultar todos los paneles
        document.querySelectorAll('.panel').forEach(panel => {
            panel.classList.remove('active');
        });

        // Ocultar menú móvil si está activo
        const navegacion = document.getElementById('navegacion-principal');
        if (navegacion && navegacion.classList.contains('activo')) {
            navegacion.classList.remove('activo');
        }

        // Mostrar panel seleccionado
        const panel = document.getElementById(id);
        if (panel) {
            panel.classList.add('active');
            this.panelActual = id;

            // Actualizar navegación activa
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            const btnNav = document.querySelector(`.nav-btn[data-panel="${id}"]`);
            if (btnNav) {
                btnNav.classList.add('active');
            }

            // Ejecutar acciones específicas del panel
            this.accionesPanel(id);
        }
    }

    accionesPanel(id) {
        switch (id) {
            case 'inventario':
                this.renderizarInventario();
                break;
            case 'clientes-atraso':
                this.renderizarClientesAtraso();
                break;
            case 'credito-disponible':
                this.renderizarClientesConCredito();
                break;
            case 'dashboard':
                this.actualizarDashboard();
                break;
        }
    }

    // Métodos de renderizado
    renderizarInventario() {
        const contenedor = document.getElementById('lista-inventario');
        if (!contenedor) return;

        let productos = this.sistema.buscarProductos(this.filtroInventario);
        productos = this.sistema.filtrarProductos(productos, this.filtroTipo);

        if (productos.length === 0) {
            contenedor.innerHTML = `
                <div class="text-center" style="padding: 2rem; color: var(--color-texto-secundario);">
                    <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p>No hay productos que coincidan con los filtros</p>
                </div>
            `;
            return;
        }

        let html = '<div class="inventario-grid">';
        
        productos.forEach(p => {
            const stockBajo = p.cantidad <= CONFIG.STOCK_BAJO_LIMITE;
            const sinStock = p.cantidad === 0;
            const stockClase = sinStock ? 'sin-stock' : (stockBajo ? 'stock-bajo' : '');
            const margen = ((p.precioVenta - p.precioCosto) / p.precioCosto * 100).toFixed(1);
            
            html += `
                <div class="producto-card ${stockClase}" style="border: 1px solid var(--color-borde); border-radius: var(--radio-bordes); padding: var(--espaciado-m); margin-bottom: var(--espaciado-s);">
                    <div class="producto-header" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--espaciado-s);">
                        <div>
                            <h4 style="margin: 0 0 0.25rem 0; color: var(--color-texto);">${p.nombre}</h4>
                            <span class="producto-id" style="color: var(--color-texto-secundario); font-size: 0.875rem;">ID: ${p.id}</span>
                        </div>
                        <div class="producto-stats">
                            <span class="stat-badge" style="background: var(--color-fondo); padding: 0.25rem 0.5rem; border-radius: var(--radio-bordes); font-size: 0.875rem; color: var(--color-texto);">
                                Margen: ${margen}%
                            </span>
                        </div>
                    </div>
                    <div class="producto-detalles" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                        <div class="detalle">
                            <span class="detalle-label" style="font-weight: var(--peso-fuente-semibold); color: var(--color-texto);">Precio costo:</span>
                            <span class="detalle-valor">$${p.precioCosto.toFixed(2)}</span>
                        </div>
                        <div class="detalle">
                            <span class="detalle-label" style="font-weight: var(--peso-fuente-semibold); color: var(--color-texto);">Precio venta:</span>
                            <span class="detalle-valor">$${p.precioVenta.toFixed(2)}</span>
                        </div>
                        <div class="detalle">
                            <span class="detalle-label" style="font-weight: var(--peso-fuente-semibold); color: var(--color-texto);">Stock:</span>
                            <span class="detalle-valor ${stockBajo ? 'stock-bajo' : ''}" style="${stockBajo ? 'color: var(--color-advertencia); font-weight: bold;' : ''}">${p.cantidad}</span>
                        </div>
                        ${p.ventasTotales ? `
                            <div class="detalle">
                                <span class="detalle-label" style="font-weight: var(--peso-fuente-semibold); color: var(--color-texto);">Ventas totales:</span>
                                <span class="detalle-valor">${p.ventasTotales}</span>
                            </div>
                        ` : '<div class="detalle"></div>'}
                    </div>
                    ${stockBajo ? `
                        <div class="producto-alerta" style="background: var(--color-advertencia); color: white; padding: 0.5rem; border-radius: var(--radio-bordes); margin-top: var(--espaciado-s); display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>${sinStock ? 'Sin stock' : 'Stock bajo'}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        html += '</div>';
        contenedor.innerHTML = html;
    }

    renderizarClientesAtraso() {
        const contenedor = document.getElementById('lista-atraso');
        if (!contenedor) return;

        const clientesAtraso = this.sistema.obtenerClientesEnAtraso();

        if (clientesAtraso.length === 0) {
            contenedor.innerHTML = `
                <div class="text-center" style="padding: 2rem; color: var(--color-texto-secundario);">
                    <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p>No hay clientes en atraso</p>
                </div>
            `;
            return;
        }

        let html = '<div class="clientes-lista">';
        clientesAtraso.forEach(c => {
            html += `
                <div class="cliente-item atraso" style="border: 1px solid var(--color-borde); border-radius: var(--radio-bordes); padding: var(--espaciado-m); margin-bottom: var(--espaciado-s);">
                    <div class="cliente-info">
                        <div class="cliente-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espaciado-s);">
                            <h4 style="margin: 0; color: var(--color-texto);">${c.nombre}</h4>
                            <span class="cliente-folio" style="background: var(--color-fondo); padding: 0.25rem 0.5rem; border-radius: var(--radio-bordes); font-size: 0.875rem; color: var(--color-texto-secundario);">${c.folio}</span>
                        </div>
                        <div class="cliente-detalles" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                            <div class="detalle">
                                <span class="detalle-label" style="font-weight: var(--peso-fuente-semibold); color: var(--color-texto);">Deuda:</span>
                                <span class="detalle-valor peligro" style="color: var(--color-acentuado); font-weight: bold;">$${c.deuda.toFixed(2)}</span>
                            </div>
                            <div class="detalle">
                                <span class="detalle-label" style="font-weight: var(--peso-fuente-semibold); color: var(--color-texto);">Días de atraso:</span>
                                <span class="detalle-valor">${c.diasAtraso}</span>
                            </div>
                            ${c.telefono ? `
                                <div class="detalle">
                                    <span class="detalle-label" style="font-weight: var(--peso-fuente-semibold); color: var(--color-texto);">Teléfono:</span>
                                    <span class="detalle-valor">${c.telefono}</span>
                                </div>
                            ` : '<div class="detalle"></div>'}
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        contenedor.innerHTML = html;
    }

    renderizarClientesConCredito() {
        const contenedor = document.getElementById('lista-credito');
        if (!contenedor) return;

        const clientesConCredito = this.sistema.obtenerClientesConCreditoDisponible();

        if (clientesConCredito.length === 0) {
            contenedor.innerHTML = `
                <div class="text-center" style="padding: 2rem; color: var(--color-texto-secundario);">
                    <i class="fas fa-credit-card" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p>No hay clientes con crédito disponible</p>
                </div>
            `;
            return;
        }

        let html = '<div class="clientes-lista">';
        clientesConCredito.forEach(c => {
            html += `
                <div class="cliente-item credito" style="border: 1px solid var(--color-borde); border-radius: var(--radio-bordes); padding: var(--espaciado-m); margin-bottom: var(--espaciado-s);">
                    <div class="cliente-info">
                        <div class="cliente-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espaciado-s);">
                            <h4 style="margin: 0; color: var(--color-texto);">${c.nombre}</h4>
                            <span class="cliente-folio" style="background: var(--color-fondo); padding: 0.25rem 0.5rem; border-radius: var(--radio-bordes); font-size: 0.875rem; color: var(--color-texto-secundario);">${c.folio}</span>
                        </div>
                        <div class="cliente-detalles" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                            ${c.telefono ? `
                                <div class="detalle">
                                    <span class="detalle-label" style="font-weight: var(--peso-fuente-semibold); color: var(--color-texto);">Teléfono:</span>
                                    <span class="detalle-valor">${c.telefono}</span>
                                </div>
                            ` : '<div class="detalle"></div>'}
                            ${c.email ? `
                                <div class="detalle">
                                    <span class="detalle-label" style="font-weight: var(--peso-fuente-semibold); color: var(--color-texto);">Email:</span>
                                    <span class="detalle-valor">${c.email}</span>
                                </div>
                            ` : '<div class="detalle"></div>'}
                            <div class="detalle">
                                <span class="detalle-label" style="font-weight: var(--peso-fuente-semibold); color: var(--color-texto);">Registrado:</span>
                                <span class="detalle-valor">${c.fechaRegistro}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        contenedor.innerHTML = html;
    }

    // Métodos para procesar formularios
    procesarAltaCliente() {
        try {
            const nombre = document.getElementById('nombre-cliente').value.trim();
            const folio = document.getElementById('folio-cliente').value.trim();
            const telefono = document.getElementById('telefono-cliente')?.value.trim() || '';
            const email = document.getElementById('email-cliente')?.value.trim() || '';

            // CORRECCIÓN: Validaciones adicionales
            if (!nombre || !folio) {
                this.mostrarToast('Nombre y folio son obligatorios', 'error');
                return;
            }

            this.sistema.agregarCliente(nombre, folio, telefono, email);
            this.mostrarToast('Cliente registrado exitosamente', 'success');
            this.limpiarFormularioCliente();
        } catch (error) {
            this.mostrarToast(error.message, 'error');
        }
    }

    procesarConsultaDeuda() {
        try {
            const folio = document.getElementById('folio-deuda').value.trim();
            const cliente = this.sistema.obtenerClientePorFolio(folio);
            const contenedor = document.getElementById('resultado-deuda');
            
            if (!contenedor) return;
            
            if (!cliente) {
                contenedor.innerHTML = `
                    <div class="text-center" style="padding: 2rem; color: var(--color-texto-secundario);">
                        <i class="fas fa-user-times" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <p>Cliente no encontrado</p>
                    </div>
                `;
                return;
            }
            
            const deuda = this.sistema.ventas
                .filter(v => v.folioCliente === folio && v.tipoPago === 'credito' && !v.pagada)
                .reduce((sum, v) => sum + v.total, 0);
                
            const tieneDeuda = deuda > 0;
            
            contenedor.innerHTML = `
                <div class="deuda-info ${tieneDeuda ? 'con-deuda' : 'sin-deuda'}" style="border: 1px solid var(--color-borde); border-radius: var(--radio-bordes); padding: var(--espaciado-m);">
                    <div class="deuda-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espaciado-s);">
                        <h3 style="margin: 0; color: var(--color-texto);">${cliente.nombre}</h3>
                        <span class="cliente-folio" style="background: var(--color-fondo); padding: 0.25rem 0.5rem; border-radius: var(--radio-bordes); font-size: 0.875rem; color: var(--color-texto-secundario);">${cliente.folio}</span>
                    </div>
                    <div class="deuda-detalles">
                        <div class="deuda-monto" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espaciado-s);">
                            <span class="deuda-label" style="font-weight: var(--peso-fuente-semibold); color: var(--color-texto);">Deuda total:</span>
                            <span class="deuda-valor ${tieneDeuda ? 'peligro' : 'exito'}" style="${tieneDeuda ? 'color: var(--color-acentuado);' : 'color: var(--color-exito);'} font-weight: bold; font-size: 1.25rem;">$${deuda.toFixed(2)}</span>
                        </div>
                        ${tieneDeuda ? `
                            <div class="deuda-alerta" style="background: var(--color-advertencia); color: white; padding: 0.75rem; border-radius: var(--radio-bordes); display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fas fa-exclamation-triangle"></i>
                                <span>Cliente tiene deuda pendiente</span>
                            </div>
                        ` : `
                            <div class="deuda-alerta exito" style="background: var(--color-exito); color: white; padding: 0.75rem; border-radius: var(--radio-bordes); display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fas fa-check-circle"></i>
                                <span>Cliente al corriente</span>
                            </div>
                        `}
                        ${cliente.telefono ? `
                            <div class="deuda-contacto" style="margin-top: var(--espaciado-s);">
                                <span class="contacto-label" style="font-weight: var(--peso-fuente-semibold); color: var(--color-texto);">Teléfono:</span>
                                <span class="contacto-valor" style="margin-left: 0.5rem;">${cliente.telefono}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        } catch (error) {
            this.mostrarToast('Error al consultar deuda: ' + error.message, 'error');
        }
    }

    procesarHistorialCompras() {
        try {
            const folio = document.getElementById('folio-historial').value.trim();
            const compras = this.sistema.ventas.filter(v => v.folioCliente === folio);
            const contenedor = document.getElementById('resultado-historial');
            
            if (!contenedor) return;
            
            if (compras.length === 0) {
                contenedor.innerHTML = `
                    <div class="text-center" style="padding: 2rem; color: var(--color-texto-secundario);">
                        <i class="fas fa-shopping-cart" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <p>No hay compras registradas para este cliente</p>
                    </div>
                `;
                return;
            }
            
            const cliente = this.sistema.obtenerClientePorFolio(folio);
            let html = `
                <div class="historial-header" style="margin-bottom: var(--espaciado-m);">
                    <h3 style="margin: 0 0 0.5rem 0; color: var(--color-texto);">Historial de compras</h3>
                    <span class="cliente-info" style="color: var(--color-texto-secundario);">${cliente?.nombre || 'Cliente'} (${folio})</span>
                </div>
                <div class="compras-lista">
            `;
            
            compras.forEach(v => {
                html += `
                    <div class="compra-item" style="border: 1px solid var(--color-borde); border-radius: var(--radio-bordes); padding: var(--espaciado-m); margin-bottom: var(--espaciado-s);">
                        <div class="compra-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espaciado-s);">
                            <div class="compra-fecha">
                                <span class="fecha" style="font-weight: var(--peso-fuente-semibold); color: var(--color-texto);">${v.fecha}</span>
                                <span class="hora" style="color: var(--color-texto-secundario); margin-left: 0.5rem;">${v.hora}</span>
                            </div>
                            <div class="compra-info" style="display: flex; align-items: center; gap: var(--espaciado-s);">
                                <span class="compra-tipo ${v.tipoPago}" style="background: ${v.tipoPago === 'credito' ? 'var(--color-primario)' : 'var(--color-exito)'}; color: white; padding: 0.25rem 0.5rem; border-radius: var(--radio-bordes); font-size: 0.875rem;">
                                    ${v.tipoPago === 'credito' ? 'Crédito' : 'Efectivo'}
                                </span>
                                <span class="compra-total" style="font-weight: var(--peso-fuente-bold); color: var(--color-texto);">$${v.total.toFixed(2)}</span>
                            </div>
                        </div>
                        <div class="compra-productos">
                            ${v.productos.map(p => `
                                <div class="producto-compra" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--color-borde);">
                                    <span class="producto-nombre" style="color: var(--color-texto);">${p.nombre}</span>
                                    <div style="display: flex; align-items: center; gap: 1rem;">
                                        <span class="producto-cantidad" style="color: var(--color-texto-secundario);">x${p.cantidad}</span>
                                        <span class="producto-precio" style="font-weight: var(--peso-fuente-semibold); color: var(--color-texto);">$${(p.precioUnitario * p.cantidad).toFixed(2)}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            contenedor.innerHTML = html;
        } catch (error) {
            this.mostrarToast('Error al consultar historial: ' + error.message, 'error');
        }
    }

    procesarVenta() {
        try {
            const folio = document.getElementById('folio-venta').value.trim();
            const tipoPagoElement = document.querySelector('input[name="tipo-pago"]:checked');
            if (!tipoPagoElement) throw new Error('No se seleccionó tipo de pago');
            
            const tipoPago = tipoPagoElement.value;
            const inputProductos = document.getElementById('productos-venta').value.trim();

            // CORRECCIÓN: Validar que hay productos
            if (!inputProductos) {
                this.mostrarToast('Debe ingresar productos para la venta', 'error');
                return;
            }

            const venta = this.sistema.registrarVenta(folio, tipoPago, inputProductos);
            this.mostrarTicket(venta);
            this.mostrarToast('Venta registrada exitosamente', 'success');
            this.limpiarFormularioVenta();
        } catch (error) {
            this.mostrarToast(error.message, 'error');
        }
    }

    procesarAltaProducto() {
        try {
            const nombre = document.getElementById('nombre-producto').value.trim();
            const precioCosto = parseFloat(document.getElementById('precio-costo').value);
            const precioVenta = parseFloat(document.getElementById('precio-venta').value);
            const cantidadCambio = parseInt(document.getElementById('cantidad-producto').value) || 0;

            // CORRECCIÓN: Validaciones
            if (!nombre || isNaN(precioCosto) || isNaN(precioVenta)) {
                this.mostrarToast('Complete todos los campos obligatorios correctamente', 'error');
                return;
            }

            if (precioCosto < 0 || precioVenta < 0) {
                this.mostrarToast('Los precios no pueden ser negativos', 'error');
                return;
            }

            this.sistema.agregarProducto(nombre, precioCosto, precioVenta, cantidadCambio);
            this.mostrarToast('Producto guardado exitosamente', 'success');
            this.limpiarFormularioProducto();
        } catch (error) {
            this.mostrarToast(error.message, 'error');
        }
    }

    procesarTopMasVendido() {
        try {
            const resultado = this.sistema.obtenerTopProductos(this.periodoTop, 'mas');
            const contenedor = document.getElementById('resultado-top-mas');
            
            if (!contenedor) return;

            if (!resultado) {
                contenedor.innerHTML = `
                    <div class="text-center" style="padding: 2rem; color: var(--color-texto-secundario);">
                        <i class="fas fa-chart-line" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <p>No hay ventas en el período seleccionado</p>
                    </div>
                `;
                return;
            }

            const { producto, cantidad, periodo } = resultado;
            const textoPeriodo = this.obtenerTextoPeriodo(periodo);
            
            contenedor.innerHTML = `
                <div class="top-producto" style="border: 1px solid var(--color-borde); border-radius: var(--radio-bordes); padding: var(--espaciado-m);">
                    <div class="top-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espaciado-m);">
                        <h3 style="margin: 0; color: var(--color-texto);">Producto Más Vendido</h3>
                        <span class="periodo-info" style="color: var(--color-texto-secundario);">${textoPeriodo}</span>
                    </div>
                    <div class="producto-destacado">
                        <div class="producto-info" style="margin-bottom: var(--espaciado-m);">
                            <h4 style="margin: 0 0 0.5rem 0; color: var(--color-texto);">${producto.nombre}</h4>
                            <span class="producto-id" style="color: var(--color-texto-secundario);">ID: ${producto.id}</span>
                        </div>
                        <div class="producto-estadisticas" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="estadistica">
                                <span class="estadistica-label" style="display: block; font-weight: var(--peso-fuente-semibold); color: var(--color-texto); margin-bottom: 0.25rem;">Unidades vendidas:</span>
                                <span class="estadistica-valor destacado" style="font-size: 1.5rem; font-weight: var(--peso-fuente-bold); color: var(--color-primario);">${cantidad}</span>
                            </div>
                            <div class="estadistica">
                                <span class="estadistica-label" style="display: block; font-weight: var(--peso-fuente-semibold); color: var(--color-texto); margin-bottom: 0.25rem;">Precio de venta:</span>
                                <span class="estadistica-valor">$${producto.precioVenta.toFixed(2)}</span>
                            </div>
                            <div class="estadistica">
                                <span class="estadistica-label" style="display: block; font-weight: var(--peso-fuente-semibold); color: var(--color-texto); margin-bottom: 0.25rem;">Stock actual:</span>
                                <span class="estadistica-valor">${producto.cantidad}</span>
                            </div>
                            <div class="estadistica">
                                <span class="estadistica-label" style="display: block; font-weight: var(--peso-fuente-semibold); color: var(--color-texto); margin-bottom: 0.25rem;">Ventas totales:</span>
                                <span class="estadistica-valor">${producto.ventasTotales || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            this.mostrarToast('Error al calcular top más vendido: ' + error.message, 'error');
        }
    }

    procesarTopMenosVendido() {
        try {
            const resultado = this.sistema.obtenerTopProductos(this.periodoTop, 'menos');
            const contenedor = document.getElementById('resultado-top-menos');
            
            if (!contenedor) return;

            if (!resultado) {
                contenedor.innerHTML = `
                    <div class="text-center" style="padding: 2rem; color: var(--color-texto-secundario);">
                        <i class="fas fa-chart-bar" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <p>No hay ventas en el período seleccionado</p>
                    </div>
                `;
                return;
            }

            const { producto, cantidad, periodo } = resultado;
            const textoPeriodo = this.obtenerTextoPeriodo(periodo);
            
            contenedor.innerHTML = `
                <div class="top-producto" style="border: 1px solid var(--color-borde); border-radius: var(--radio-bordes); padding: var(--espaciado-m);">
                    <div class="top-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espaciado-m);">
                        <h3 style="margin: 0; color: var(--color-texto);">Producto Menos Vendido</h3>
                        <span class="periodo-info" style="color: var(--color-texto-secundario);">${textoPeriodo}</span>
                    </div>
                    <div class="producto-destacado">
                        <div class="producto-info" style="margin-bottom: var(--espaciado-m);">
                            <h4 style="margin: 0 0 0.5rem 0; color: var(--color-texto);">${producto.nombre}</h4>
                            <span class="producto-id" style="color: var(--color-texto-secundario);">ID: ${producto.id}</span>
                        </div>
                        <div class="producto-estadisticas" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="estadistica">
                                <span class="estadistica-label" style="display: block; font-weight: var(--peso-fuente-semibold); color: var(--color-texto); margin-bottom: 0.25rem;">Unidades vendidas:</span>
                                <span class="estadistica-valor">${cantidad}</span>
                            </div>
                            <div class="estadistica">
                                <span class="estadistica-label" style="display: block; font-weight: var(--peso-fuente-semibold); color: var(--color-texto); margin-bottom: 0.25rem;">Precio de venta:</span>
                                <span class="estadistica-valor">$${producto.precioVenta.toFixed(2)}</span>
                            </div>
                            <div class="estadistica">
                                <span class="estadistica-label" style="display: block; font-weight: var(--peso-fuente-semibold); color: var(--color-texto); margin-bottom: 0.25rem;">Stock actual:</span>
                                <span class="estadistica-valor">${producto.cantidad}</span>
                            </div>
                            <div class="estadistica">
                                <span class="estadistica-label" style="display: block; font-weight: var(--peso-fuente-semibold); color: var(--color-texto); margin-bottom: 0.25rem;">Ventas totales:</span>
                                <span class="estadistica-valor">${producto.ventasTotales || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            this.mostrarToast('Error al calcular top menos vendido: ' + error.message, 'error');
        }
    }

    procesarCostosGanancias() {
        try {
            const analisis = this.sistema.obtenerAnalisisFinanciero(this.periodoGanancias);
            const contenedor = document.getElementById('resultado-ganancias');
            
            if (!contenedor) return;

            const textoPeriodo = this.obtenerTextoPeriodo(analisis.periodo, true);
            
            contenedor.innerHTML = `
                <div class="analisis-financiero">
                    <div class="analisis-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espaciado-m);">
                        <h3 style="margin: 0; color: var(--color-texto);">Análisis Financiero</h3>
                        <span class="periodo-info" style="color: var(--color-texto-secundario);">${textoPeriodo}</span>
                    </div>
                    
                    <div class="metricas-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--espaciado-m); margin-bottom: var(--espaciado-l);">
                        <div class="metrica-card" style="background: var(--color-fondo-card); border: 1px solid var(--color-borde); border-radius: var(--radio-bordes); padding: var(--espaciado-m); text-align: center;">
                            <div class="metrica-icon" style="font-size: 2rem; color: var(--color-primario); margin-bottom: var(--espaciado-s);">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <div class="metrica-info">
                                <span class="metrica-valor" style="display: block; font-size: 1.5rem; font-weight: var(--peso-fuente-bold); color: var(--color-texto); margin-bottom: 0.25rem;">$${analisis.totalVentas.toFixed(2)}</span>
                                <span class="metrica-label" style="color: var(--color-texto-secundario);">Ventas Totales</span>
                            </div>
                        </div>
                        
                        <div class="metrica-card" style="background: var(--color-fondo-card); border: 1px solid var(--color-borde); border-radius: var(--radio-bordes); padding: var(--espaciado-m); text-align: center;">
                            <div class="metrica-icon" style="font-size: 2rem; color: var(--color-exito); margin-bottom: var(--espaciado-s);">
                                <i class="fas fa-money-bill-wave"></i>
                            </div>
                            <div class="metrica-info">
                                <span class="metrica-valor" style="display: block; font-size: 1.5rem; font-weight: var(--peso-fuente-bold); color: var(--color-texto); margin-bottom: 0.25rem;">$${analisis.gananciaTotal.toFixed(2)}</span>
                                <span class="metrica-label" style="color: var(--color-texto-secundario);">Ganancia Neta</span>
                            </div>
                        </div>
                        
                        <div class="metrica-card" style="background: var(--color-fondo-card); border: 1px solid var(--color-borde); border-radius: var(--radio-bordes); padding: var(--espaciado-m); text-align: center;">
                            <div class="metrica-icon" style="font-size: 2rem; color: var(--color-secundario); margin-bottom: var(--espaciado-s);">
                                <i class="fas fa-percentage"></i>
                            </div>
                            <div class="metrica-info">
                                <span class="metrica-valor" style="display: block; font-size: 1.5rem; font-weight: var(--peso-fuente-bold); color: var(--color-texto); margin-bottom: 0.25rem;">${analisis.margenGanancia.toFixed(1)}%</span>
                                <span class="metrica-label" style="color: var(--color-texto-secundario);">Margen de Ganancia</span>
                            </div>
                        </div>
                        
                        <div class="metrica-card" style="background: var(--color-fondo-card); border: 1px solid var(--color-borde); border-radius: var(--radio-bordes); padding: var(--espaciado-m); text-align: center;">
                            <div class="metrica-icon" style="font-size: 2rem; color: var(--color-info); margin-bottom: var(--espaciado-s);">
                                <i class="fas fa-shopping-cart"></i>
                            </div>
                            <div class="metrica-info">
                                <span class="metrica-valor" style="display: block; font-size: 1.5rem; font-weight: var(--peso-fuente-bold); color: var(--color-texto); margin-bottom: 0.25rem;">${analisis.cantidadVentas}</span>
                                <span class="metrica-label" style="color: var(--color-texto-secundario);">Ventas Realizadas</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detalles-analisis" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--espaciado-l);">
                        <div class="detalle-grupo">
                            <h4 style="margin: 0 0 var(--espaciado-s) 0; color: var(--color-texto);">Detalles de Costos</h4>
                            <div class="detalle-item" style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-borde);">
                                <span class="detalle-label" style="color: var(--color-texto);">Costo de Ventas:</span>
                                <span class="detalle-valor">$${analisis.costoTotalVentas.toFixed(2)}</span>
                            </div>
                            <div class="detalle-item" style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-borde);">
                                <span class="detalle-label" style="color: var(--color-texto);">Inversión en Inventario:</span>
                                <span class="detalle-valor">$${analisis.totalInversion.toFixed(2)}</span>
                            </div>
                        </div>
                        
                        <div class="detalle-grupo">
                            <h4 style="margin: 0 0 var(--espaciado-s) 0; color: var(--color-texto);">Eficiencia</h4>
                            <div class="detalle-item" style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-borde);">
                                <span class="detalle-label" style="color: var(--color-texto);">Venta Promedio:</span>
                                <span class="detalle-valor">$${analisis.cantidadVentas > 0 ? (analisis.totalVentas / analisis.cantidadVentas).toFixed(2) : '0.00'}</span>
                            </div>
                            <div class="detalle-item" style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-borde);">
                                <span class="detalle-label" style="color: var(--color-texto);">Ganancia por Venta:</span>
                                <span class="detalle-valor">$${analisis.cantidadVentas > 0 ? (analisis.gananciaTotal / analisis.cantidadVentas).toFixed(2) : '0.00'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            this.mostrarToast('Error al calcular costos y ganancias: ' + error.message, 'error');
        }
    }

    // Métodos de utilidad de la UI
    calcularPreviewVenta() {
        try {
            const productosInput = document.getElementById('productos-venta').value.trim();
            if (!productosInput) {
                this.mostrarToast('Ingresa los productos para calcular el total', 'warning');
                return;
            }

            const listaProductos = this.sistema.parsearProductosInput(productosInput);
            let html = '';
            let total = 0;
            let productosValidos = 0;

            listaProductos.forEach(item => {
                const producto = this.sistema.obtenerProductoPorId(item.id);
                if (producto) {
                    productosValidos++;
                    const subtotal = producto.precioVenta * item.cantidad;
                    total += subtotal;
                    html += `
                        <div class="preview-item" style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-borde);">
                            <div class="producto-info">
                                <span class="producto-nombre" style="font-weight: var(--peso-fuente-semibold); color: var(--color-texto);">${producto.nombre}</span>
                                <span class="producto-detalle" style="display: block; color: var(--color-texto-secundario); font-size: 0.875rem;">ID: ${producto.id} x ${item.cantidad}</span>
                            </div>
                            <span class="producto-subtotal" style="font-weight: var(--peso-fuente-semibold); color: var(--color-texto);">$${subtotal.toFixed(2)}</span>
                        </div>
                    `;
                }
            });

            if (productosValidos === 0) {
                this.mostrarToast('No se encontraron productos válidos', 'error');
                return;
            }

            document.getElementById('preview-productos').innerHTML = html;
            document.getElementById('preview-total-monto').textContent = total.toFixed(2);
            document.getElementById('preview-total').classList.remove('oculto');
            
            this.mostrarToast(`Total calculado: $${total.toFixed(2)}`, 'success');
        } catch (error) {
            this.mostrarToast('Error al calcular el total: ' + error.message, 'error');
        }
    }

    limpiarFormularioCliente() {
        const form = document.getElementById('form-alta-cliente');
        if (form) form.reset();
    }

    limpiarFormularioProducto() {
        const form = document.getElementById('form-alta-producto');
        if (form) form.reset();
    }

    limpiarFormularioVenta() {
        const form = document.getElementById('form-venta');
        if (form) {
            form.reset();
            // Restablecer el tipo de pago a efectivo
            const efectivoRadio = document.querySelector('#venta input[name="tipo-pago"][value="efectivo"]');
            if (efectivoRadio) efectivoRadio.checked = true;
        }
        const previewTotal = document.getElementById('preview-total');
        if (previewTotal) previewTotal.classList.add('oculto');
        
        const ticketGenerado = document.getElementById('ticket-generado');
        if (ticketGenerado) ticketGenerado.innerHTML = '';
    }

    mostrarTicket(venta) {
        const contenedor = document.getElementById('ticket-generado');
        if (!contenedor) return;

        let ticket = `╔══════════════════════════════╗\n`;
        ticket += `║          DANY-SHOP           ║\n`;
        ticket += `╠══════════════════════════════╣\n`;
        ticket += `║ Fecha: ${venta.fecha.padEnd(19)} ║\n`;
        ticket += `║ Hora: ${venta.hora.padEnd(20)} ║\n`;
        ticket += `║ Tipo: ${(venta.tipoPago === 'credito' ? 'Crédito' : 'Efectivo').padEnd(19)} ║\n`;
        if (venta.folioCliente !== 'EFECTIVO') {
            ticket += `║ Cliente: ${venta.folioCliente.padEnd(16)} ║\n`;
        }
        ticket += `╠══════════════════════════════╣\n`;
        venta.productos.forEach(p => {
            const nombre = p.nombre.length > 18 ? p.nombre.substring(0, 15) + '...' : p.nombre.padEnd(18);
            const cantidad = p.cantidad.toString().padStart(2);
            const precio = `$${(p.precioUnitario * p.cantidad).toFixed(2)}`.padStart(8);
            ticket += `║ ${nombre} x${cantidad} ${precio} ║\n`;
        });
        ticket += `╠══════════════════════════════╣\n`;
        ticket += `║ TOTAL: $${venta.total.toFixed(2).padStart(20)} ║\n`;
        ticket += `║ GANANCIA: $${venta.ganancia.toFixed(2).padStart(16)} ║\n`;
        ticket += `╚══════════════════════════════╝\n`;
        ticket += `       ¡Gracias por su compra!`;

        contenedor.textContent = ticket;
    }

    obtenerTextoPeriodo(periodo, completo = false) {
        const periodos = {
            'hoy': 'Hoy',
            'semana': 'Esta Semana',
            'mes': 'Este Mes',
            'anio': 'Este Año',
            'todo': 'Todo el Tiempo'
        };
        
        return periodos[periodo] || (completo ? 'Período Seleccionado' : periodo);
    }

    actualizarDashboard() {
        try {
            const stats = this.sistema.obtenerEstadisticas();
            
            // Actualizar estadísticas
            const totalClientes = document.getElementById('total-clientes');
            const totalProductos = document.getElementById('total-productos');
            const totalVentas = document.getElementById('total-ventas');
            const totalDeuda = document.getElementById('total-deuda');
            
            if (totalClientes) totalClientes.textContent = stats.totalClientes;
            if (totalProductos) totalProductos.textContent = stats.totalProductos;
            if (totalVentas) totalVentas.textContent = stats.totalVentas;
            if (totalDeuda) totalDeuda.textContent = `$${stats.deudaTotal.toFixed(2)}`;

            // Actualizar gráficos simples
            this.actualizarGraficoVentas(stats.ventasSemana);
            this.actualizarGraficoStock(stats.productosStockBajo);

            // Actualizar última actualización
            const ultimaActualizacion = document.getElementById('ultima-actualizacion');
            if (ultimaActualizacion) {
                ultimaActualizacion.textContent = `Última actualización: ${new Date().toLocaleString()}`;
            }
        } catch (error) {
            console.error('Error actualizando dashboard:', error);
        }
    }

    actualizarGraficoVentas(ventasSemana) {
        const contenedor = document.getElementById('chart-ventas');
        if (!contenedor) return;

        if (ventasSemana > 0) {
            const altura = Math.min(ventasSemana * 10, 100);
            contenedor.innerHTML = `
                <div class="chart-bar" style="height: ${altura}%; width: 80%; margin: 0 auto; display: flex; justify-content: center; align-items: flex-end; padding: 10px; background: var(--gradiente-primario); border-radius: var(--radio-bordes);">
                    <span style="color: white; font-weight: bold;">${ventasSemana} ventas</span>
                </div>
            `;
        } else {
            contenedor.innerHTML = `
                <div class="text-center" style="padding: 2rem; color: var(--color-texto-secundario);">
                    <i class="fas fa-chart-bar" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p>No hay datos de ventas esta semana</p>
                </div>
            `;
        }
    }

    actualizarGraficoStock(productosStockBajo) {
        const contenedor = document.getElementById('chart-stock');
        if (!contenedor) return;

        if (productosStockBajo > 0) {
            contenedor.innerHTML = `
                <div class="chart-warning" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--espaciado-s); color: var(--color-advertencia); height: 100%;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem;"></i>
                    <p style="text-align: center; margin: 0;">${productosStockBajo} productos con stock bajo</p>
                </div>
            `;
        } else {
            contenedor.innerHTML = `
                <div class="text-center" style="padding: 2rem; color: var(--color-texto-secundario);">
                    <i class="fas fa-boxes" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p>No hay productos con stock bajo</p>
                </div>
            `;
        }
    }

    actualizarListasDesplegables() {
        // Actualizar datalist de clientes
        const datalist = document.getElementById('clientes-lista');
        if (!datalist) return;
        
        datalist.innerHTML = '';
        
        this.sistema.clientes.filter(c => c.activo).forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente.folio;
            option.textContent = `${cliente.folio} - ${cliente.nombre}`;
            datalist.appendChild(option);
        });
    }

    cambiarTema() {
        const btnTema = document.getElementById('btn-tema');
        const icono = btnTema.querySelector('i');
        
        if (document.body.classList.contains('tema-oscuro')) {
            document.body.classList.remove('tema-oscuro');
            this.sistema.configuracion.tema = 'claro';
            this.actualizarIconoTema('luna');
        } else {
            document.body.classList.add('tema-oscuro');
            this.sistema.configuracion.tema = 'oscuro';
            this.actualizarIconoTema('sol');
        }
        
        this.sistema.guardarDatos();
    }

    mostrarNotificaciones() {
        try {
            const clientesAtraso = this.sistema.obtenerClientesEnAtraso();
            const productosStockBajo = this.sistema.obtenerProductosStockBajo();
            const badge = document.getElementById('notification-badge');
            
            if (badge) {
                const totalNotificaciones = clientesAtraso.length + productosStockBajo.length;
                if (totalNotificaciones > 0) {
                    badge.textContent = totalNotificaciones;
                    badge.classList.remove('hidden');
                    
                    // Mostrar resumen de notificaciones
                    let mensaje = '';
                    if (clientesAtraso.length > 0) {
                        mensaje += `${clientesAtraso.length} cliente(s) en atraso\n`;
                    }
                    if (productosStockBajo.length > 0) {
                        mensaje += `${productosStockBajo.length} producto(s) con stock bajo`;
                    }
                    
                    this.mostrarToast(mensaje, 'warning');
                } else {
                    badge.classList.add('hidden');
                    this.mostrarToast('No hay notificaciones', 'info');
                }
            }
        } catch (error) {
            console.error('Error mostrando notificaciones:', error);
        }
    }

    exportarInventario() {
        try {
            const datos = this.sistema.exportarDatos('json');
            const blob = new Blob([datos], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `inventario_dany_shop_${this.sistema.fechaHoy()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.mostrarToast('Inventario exportado exitosamente', 'success');
        } catch (error) {
            this.mostrarToast('Error al exportar inventario: ' + error.message, 'error');
        }
    }

    mostrarToast(mensaje, tipo = 'info') {
        try {
            const contenedor = document.getElementById('toast-container');
            if (!contenedor) return;

            const toast = document.createElement('div');
            toast.className = `toast ${tipo}`;
            
            const iconos = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };

            toast.innerHTML = `
                <i class="fas ${iconos[tipo]}"></i>
                <span>${mensaje}</span>
                <button class="btn-icon btn-sm" onclick="this.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            `;

            contenedor.appendChild(toast);

            // Auto-eliminar después del timeout
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, CONFIG.NOTIFICATION_TIMEOUT);
        } catch (error) {
            console.error('Error mostrando toast:', error);
        }
    }

    ocultarLoading() {
        try {
            setTimeout(() => {
                const loadingScreen = document.getElementById('loading-screen');
                if (loadingScreen) {
                    loadingScreen.classList.add('oculto');
                }
            }, 1000);
        } catch (error) {
            console.error('Error ocultando loading:', error);
        }
    }
}

// ========== INICIALIZACIÓN DE DATOS DE EJEMPLO ==========
function inicializarDatosEjemplo(sistema) {
    // CORRECCIÓN: Solo inicializar datos si no existen
    if (sistema.productos.length === 0) {
        console.log('Inicializando datos de ejemplo...');
        
        const productosEjemplo = [
            { id: 1, nombre: "Arroz Integral", precioCosto: 12.00, precioVenta: 18.00, cantidad: 25, activo: true, fechaCreacion: sistema.fechaHoy(), ventasTotales: 45 },
            { id: 2, nombre: "Frijoles Negros", precioCosto: 10.00, precioVenta: 15.00, cantidad: 30, activo: true, fechaCreacion: sistema.fechaHoy(), ventasTotales: 38 },
            { id: 3, nombre: "Leche Deslactosada", precioCosto: 15.00, precioVenta: 22.00, cantidad: 5, activo: true, fechaCreacion: sistema.fechaHoy(), ventasTotales: 52 },
            { id: 4, nombre: "Aceite de Oliva", precioCosto: 25.00, precioVenta: 35.00, cantidad: 12, activo: true, fechaCreacion: sistema.fechaHoy(), ventasTotales: 28 },
            { id: 5, nombre: "Azúcar Morena", precioCosto: 8.00, precioVenta: 12.00, cantidad: 40, activo: true, fechaCreacion: sistema.fechaHoy(), ventasTotales: 33 },
            { id: 6, nombre: "Café Molido", precioCosto: 30.00, precioVenta: 45.00, cantidad: 8, activo: true, fechaCreacion: sistema.fechaHoy(), ventasTotales: 41 },
            { id: 7, nombre: "Galletas Integrales", precioCosto: 7.00, precioVenta: 12.00, cantidad: 22, activo: true, fechaCreacion: sistema.fechaHoy(), ventasTotales: 29 },
            { id: 8, nombre: "Jabón Líquido", precioCosto: 18.00, precioVenta: 25.00, cantidad: 15, activo: true, fechaCreacion: sistema.fechaHoy(), ventasTotales: 36 }
        ];

        productosEjemplo.forEach(p => sistema.productos.push(p));
        sistema.nextProductoId = 9;
    }

    if (sistema.clientes.length === 0) {
        try {
            sistema.agregarCliente("Ana García López", "CLI-001", "555-123-4567", "ana.garcia@email.com");
            sistema.agregarCliente("Carlos Mendoza Ruiz", "CLI-002", "555-987-6543", "carlos.mendoza@email.com");
            sistema.agregarCliente("María Torres Sánchez", "CLI-003", "555-456-7890");
            sistema.agregarCliente("Roberto Jiménez Flores", "CLI-004", "555-321-0987", "roberto.jimenez@email.com");
        } catch (error) {
            console.error('Error agregando clientes de ejemplo:', error);
        }
    }

    // Agregar algunas actividades de ejemplo
    sistema.agregarActividad('system', 'Sistema DANY-SHOP inicializado');
    sistema.agregarActividad('inventario', 'Productos de ejemplo cargados');
    sistema.agregarActividad('cliente', 'Clientes de ejemplo registrados');

    sistema.guardarDatos();
}

// ========== INICIALIZACIÓN DE LA APLICACIÓN ==========
let sistema, sistemaUI;

document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Inicializando DANY-SHOP...');
        
        // Inicializar sistema
        sistema = new SistemaTienda();
        
        // Cargar datos de ejemplo si es necesario
        inicializarDatosEjemplo(sistema);
        
        // Inicializar interfaz de usuario
        sistemaUI = new InterfazUsuario(sistema);
        sistemaUI.inicializar();
        
        // Hacer disponible globalmente para debugging
        window.sistema = sistema;
        window.sistemaUI = sistemaUI;
        
        console.log('DANY-SHOP v' + CONFIG.VERSION + ' inicializado correctamente');
    } catch (error) {
        console.error('Error al inicializar el sistema:', error);
        // Asegurarnos de ocultar el loading incluso si hay error
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('oculto');
        }
    }
});
