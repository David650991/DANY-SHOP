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
    } catch (error) {
      console.error('Error guardando datos:', error);
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
    this.inicializarPreviews();
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
    // Eventos de navegación
    document.getElementById('btn-tema').addEventListener('click', () => this.cambiarTema());
    document.getElementById('btn-actualizar-dashboard').addEventListener('click', () => this.actualizarDashboard());
    
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
    document.getElementById('btn-notifications').addEventListener('click', () => {
      this.mostrarNotificaciones();
    });

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
    document.querySelectorAll('.time-filter .filter-btn[data-period]').forEach(btn => {
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
    document.querySelectorAll('.time-filter .filter-btn[data-period]').forEach(btn => {
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

  inicializarPreviews() {
    // Preview de cliente
    const nombreCliente = document.getElementById('nombre-cliente');
    const folioCliente = document.getElementById('folio-cliente');
    const telefonoCliente = document.getElementById('telefono-cliente');
    const emailCliente = document.getElementById('email-cliente');

    if (nombreCliente) {
      nombreCliente.addEventListener('input', () => this.actualizarPreviewCliente());
    }
    if (folioCliente) {
      folioCliente.addEventListener('input', () => this.actualizarPreviewCliente());
    }
    if (telefonoCliente) {
      telefonoCliente.addEventListener('input', () => this.actualizarPreviewCliente());
    }
    if (emailCliente) {
      emailCliente.addEventListener('input', () => this.actualizarPreviewCliente());
    }

    // Preview de producto
    const nombreProducto = document.getElementById('nombre-producto');
    const precioCosto = document.getElementById('precio-costo');
    const precioVenta = document.getElementById('precio-venta');
    const cantidadProducto = document.getElementById('cantidad-producto');

    if (nombreProducto) {
      nombreProducto.addEventListener('input', () => this.actualizarPreviewProducto());
    }
    if (precioCosto) {
      precioCosto.addEventListener('input', () => this.actualizarPreviewProducto());
    }
    if (precioVenta) {
      precioVenta.addEventListener('input', () => this.actualizarPreviewProducto());
    }
    if (cantidadProducto) {
      cantidadProducto.addEventListener('input', () => this.actualizarPreviewProducto());
    }
  }

  inicializarFormularios() {
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
    const navContainer = document.querySelector('.nav-container');
    const scrollLeft = document.querySelector('.nav-scroll-indicator.left');
    const scrollRight = document.querySelector('.nav-scroll-indicator.right');
    
    if (!navScrollContainer || !navContainer) return;
    
    const updateScrollIndicators = () => {
      const { scrollLeft, scrollWidth, clientWidth } = navScrollContainer;
      
      // Mostrar/ocultar indicadores según la posición del scroll
      if (scrollLeft > 0) {
        document.querySelector('.nav-scroll-indicator.left').classList.remove('hidden');
      } else {
        document.querySelector('.nav-scroll-indicator.left').classList.add('hidden');
      }
      
      if (scrollLeft < scrollWidth - clientWidth - 1) {
        document.querySelector('.nav-scroll-indicator.right').classList.remove('hidden');
      } else {
        document.querySelector('.nav-scroll-indicator.right').classList.add('hidden');
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

    // Actualizar estadísticas
    const totalProductos = document.getElementById('total-productos-inv');
    const totalStockBajo = document.getElementById('total-stock-bajo');
    const totalSinStock = document.getElementById('total-sin-stock');
    
    if (totalProductos) totalProductos.textContent = productos.length;
    if (totalStockBajo) totalStockBajo.textContent = this.sistema.obtenerProductosStockBajo().length;
    if (totalSinStock) totalSinStock.textContent = this.sistema.obtenerProductosSinStock().length;

    if (productos.length === 0) {
      contenedor.innerHTML = `
        <div class="result-placeholder">
          <i class="fas fa-box-open"></i>
          <p>No hay productos que coincidan con los filtros</p>
        </div>
      `;
      return;
    }

    let html = '';
    
    productos.forEach(p => {
      const stockBajo = p.cantidad <= CONFIG.STOCK_BAJO_LIMITE;
      const sinStock = p.cantidad === 0;
      const stockClase = sinStock ? 'sin-stock' : (stockBajo ? 'stock-bajo' : '');
      const margen = ((p.precioVenta - p.precioCosto) / p.precioCosto * 100).toFixed(1);
      
      html += `
        <div class="producto-card ${stockClase}">
          <div class="producto-header">
            <div>
              <h4>${p.nombre}</h4>
              <span class="producto-id">ID: ${p.id}</span>
            </div>
            <div class="producto-stats">
              <span class="stat-badge">Margen: ${margen}%</span>
            </div>
          </div>
          <div class="producto-detalles">
            <div class="detalle">
              <span class="detalle-label">Precio costo:</span>
              <span class="detalle-valor">$${p.precioCosto.toFixed(2)}</span>
            </div>
            <div class="detalle">
              <span class="detalle-label">Precio venta:</span>
              <span class="detalle-valor">$${p.precioVenta.toFixed(2)}</span>
            </div>
            <div class="detalle">
              <span class="detalle-label">Stock:</span>
              <span class="detalle-valor ${stockBajo ? 'stock-bajo' : ''}">${p.cantidad}</span>
            </div>
            ${p.ventasTotales ? `
              <div class="detalle">
                <span class="detalle-label">Ventas totales:</span>
                <span class="detalle-valor">${p.ventasTotales}</span>
              </div>
            ` : ''}
          </div>
          ${stockBajo ? `
            <div class="producto-alerta">
              <i class="fas fa-exclamation-triangle"></i>
              <span>${sinStock ? 'Sin stock' : 'Stock bajo'}</span>
            </div>
          ` : ''}
        </div>
      `;
    });
    
    contenedor.innerHTML = html;
  }

  renderizarClientesAtraso() {
    const contenedor = document.getElementById('lista-atraso');
    if (!contenedor) return;

    const clientesAtraso = this.sistema.obtenerClientesEnAtraso();

    if (clientesAtraso.length === 0) {
      contenedor.innerHTML = `
        <div class="result-placeholder">
          <i class="fas fa-check-circle"></i>
          <p>No hay clientes en atraso</p>
        </div>
      `;
      return;
    }

    let html = '<div class="clientes-lista">';
    clientesAtraso.forEach(c => {
      html += `
        <div class="cliente-item atraso">
          <div class="cliente-info">
            <div class="cliente-header">
              <h4>${c.nombre}</h4>
              <span class="cliente-folio">${c.folio}</span>
            </div>
            <div class="cliente-detalles">
              <div class="detalle">
                <span class="detalle-label">Deuda:</span>
                <span class="detalle-valor peligro">$${c.deuda.toFixed(2)}</span>
              </div>
              <div class="detalle">
                <span class="detalle-label">Días de atraso:</span>
                <span class="detalle-valor">${c.diasAtraso}</span>
              </div>
              ${c.telefono ? `
                <div class="detalle">
                  <span class="detalle-label">Teléfono:</span>
                  <span class="detalle-valor">${c.telefono}</span>
                </div>
              ` : ''}
            </div>
          </div>
          <div class="cliente-acciones">
            <button class="btn-secondary btn-sm">
              <i class="fas fa-phone"></i> Llamar
            </button>
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
        <div class="result-placeholder">
          <i class="fas fa-credit-card"></i>
          <p>No hay clientes con crédito disponible</p>
        </div>
      `;
      return;
    }

    let html = '<div class="clientes-lista">';
    clientesConCredito.forEach(c => {
      html += `
        <div class="cliente-item credito">
          <div class="cliente-info">
            <div class="cliente-header">
              <h4>${c.nombre}</h4>
              <span class="cliente-folio">${c.folio}</span>
            </div>
            <div class="cliente-detalles">
              ${c.telefono ? `
                <div class="detalle">
                  <span class="detalle-label">Teléfono:</span>
                  <span class="detalle-valor">${c.telefono}</span>
                </div>
              ` : ''}
              ${c.email ? `
                <div class="detalle">
                  <span class="detalle-label">Email:</span>
                  <span class="detalle-valor">${c.email}</span>
                </div>
              ` : ''}
              <div class="detalle">
                <span class="detalle-label">Registrado:</span>
                <span class="detalle-valor">${c.fechaRegistro}</span>
              </div>
            </div>
          </div>
          <div class="cliente-acciones">
            <button class="btn-primary btn-sm">
              <i class="fas fa-shopping-cart"></i> Vender
            </button>
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

      this.sistema.agregarCliente(nombre, folio, telefono, email);
      this.mostrarToast('Cliente registrado exitosamente', 'success');
      document.getElementById('form-alta-cliente').reset();
      this.limpiarPreviewCliente();
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
          <div class="result-placeholder">
            <i class="fas fa-user-times"></i>
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
        <div class="deuda-info ${tieneDeuda ? 'con-deuda' : 'sin-deuda'}">
          <div class="deuda-header">
            <h3>${cliente.nombre}</h3>
            <span class="cliente-folio">${cliente.folio}</span>
          </div>
          <div class="deuda-detalles">
            <div class="deuda-monto">
              <span class="deuda-label">Deuda total:</span>
              <span class="deuda-valor ${tieneDeuda ? 'peligro' : 'exito'}">$${deuda.toFixed(2)}</span>
            </div>
            ${tieneDeuda ? `
              <div class="deuda-alerta">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Cliente tiene deuda pendiente</span>
              </div>
            ` : `
              <div class="deuda-alerta exito">
                <i class="fas fa-check-circle"></i>
                <span>Cliente al corriente</span>
              </div>
            `}
            ${cliente.telefono ? `
              <div class="deuda-contacto">
                <span class="contacto-label">Teléfono:</span>
                <span class="contacto-valor">${cliente.telefono}</span>
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
          <div class="result-placeholder">
            <i class="fas fa-shopping-cart"></i>
            <p>No hay compras registradas para este cliente</p>
          </div>
        `;
        return;
      }
      
      const cliente = this.sistema.obtenerClientePorFolio(folio);
      let html = `
        <div class="historial-header">
          <h3>Historial de compras</h3>
          <span class="cliente-info">${cliente?.nombre || 'Cliente'} (${folio})</span>
        </div>
        <div class="compras-lista">
      `;
      
      compras.forEach(v => {
        html += `
          <div class="compra-item">
            <div class="compra-header">
              <div class="compra-fecha">
                <span class="fecha">${v.fecha}</span>
                <span class="hora">${v.hora}</span>
              </div>
              <div class="compra-info">
                <span class="compra-tipo ${v.tipoPago}">${v.tipoPago === 'credito' ? 'Crédito' : 'Efectivo'}</span>
                <span class="compra-total">$${v.total.toFixed(2)}</span>
              </div>
            </div>
            <div class="compra-productos">
              ${v.productos.map(p => `
                <div class="producto-compra">
                  <span class="producto-nombre">${p.nombre}</span>
                  <span class="producto-cantidad">x${p.cantidad}</span>
                  <span class="producto-precio">$${(p.precioUnitario * p.cantidad).toFixed(2)}</span>
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

      this.sistema.agregarProducto(nombre, precioCosto, precioVenta, cantidadCambio);
      this.mostrarToast('Producto guardado exitosamente', 'success');
      document.getElementById('form-alta-producto').reset();
      this.limpiarPreviewProducto();
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
          <div class="result-placeholder">
            <i class="fas fa-chart-line"></i>
            <p>No hay ventas en el período seleccionado</p>
          </div>
        `;
        return;
      }

      const { producto, cantidad, periodo } = resultado;
      const textoPeriodo = this.obtenerTextoPeriodo(periodo);
      
      contenedor.innerHTML = `
        <div class="top-producto">
          <div class="top-header">
            <h3>Producto Más Vendido</h3>
            <span class="periodo-info">${textoPeriodo}</span>
          </div>
          <div class="producto-destacado">
            <div class="producto-info">
              <h4>${producto.nombre}</h4>
              <span class="producto-id">ID: ${producto.id}</span>
            </div>
            <div class="producto-estadisticas">
              <div class="estadistica">
                <span class="estadistica-label">Unidades vendidas:</span>
                <span class="estadistica-valor destacado">${cantidad}</span>
              </div>
              <div class="estadistica">
                <span class="estadistica-label">Precio de venta:</span>
                <span class="estadistica-valor">$${producto.precioVenta.toFixed(2)}</span>
              </div>
              <div class="estadistica">
                <span class="estadistica-label">Stock actual:</span>
                <span class="estadistica-valor">${producto.cantidad}</span>
              </div>
              <div class="estadistica">
                <span class="estadistica-label">Ventas totales:</span>
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
          <div class="result-placeholder">
            <i class="fas fa-chart-bar"></i>
            <p>No hay ventas en el período seleccionado</p>
          </div>
        `;
        return;
      }

      const { producto, cantidad, periodo } = resultado;
      const textoPeriodo = this.obtenerTextoPeriodo(periodo);
      
      contenedor.innerHTML = `
        <div class="top-producto">
          <div class="top-header">
            <h3>Producto Menos Vendido</h3>
            <span class="periodo-info">${textoPeriodo}</span>
          </div>
          <div class="producto-destacado">
            <div class="producto-info">
              <h4>${producto.nombre}</h4>
              <span class="producto-id">ID: ${producto.id}</span>
            </div>
            <div class="producto-estadisticas">
              <div class="estadistica">
                <span class="estadistica-label">Unidades vendidas:</span>
                <span class="estadistica-valor">${cantidad}</span>
              </div>
              <div class="estadistica">
                <span class="estadistica-label">Precio de venta:</span>
                <span class="estadistica-valor">$${producto.precioVenta.toFixed(2)}</span>
              </div>
              <div class="estadistica">
                <span class="estadistica-label">Stock actual:</span>
                <span class="estadistica-valor">${producto.cantidad}</span>
              </div>
              <div class="estadistica">
                <span class="estadistica-label">Ventas totales:</span>
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
          <div class="analisis-header">
            <h3>Análisis Financiero</h3>
            <span class="periodo-info">${textoPeriodo}</span>
          </div>
          
          <div class="metricas-grid">
            <div class="metrica-card">
              <div class="metrica-icon">
                <i class="fas fa-chart-line"></i>
              </div>
              <div class="metrica-info">
                <span class="metrica-valor">$${analisis.totalVentas.toFixed(2)}</span>
                <span class="metrica-label">Ventas Totales</span>
              </div>
            </div>
            
            <div class="metrica-card">
              <div class="metrica-icon">
                <i class="fas fa-money-bill-wave"></i>
              </div>
              <div class="metrica-info">
                <span class="metrica-valor">$${analisis.gananciaTotal.toFixed(2)}</span>
                <span class="metrica-label">Ganancia Neta</span>
              </div>
            </div>
            
            <div class="metrica-card">
              <div class="metrica-icon">
                <i class="fas fa-percentage"></i>
              </div>
              <div class="metrica-info">
                <span class="metrica-valor">${analisis.margenGanancia.toFixed(1)}%</span>
                <span class="metrica-label">Margen de Ganancia</span>
              </div>
            </div>
            
            <div class="metrica-card">
              <div class="metrica-icon">
                <i class="fas fa-shopping-cart"></i>
              </div>
              <div class="metrica-info">
                <span class="metrica-valor">${analisis.cantidadVentas}</span>
                <span class="metrica-label">Ventas Realizadas</span>
              </div>
            </div>
          </div>
          
          <div class="detalles-analisis">
            <div class="detalle-grupo">
              <h4>Detalles de Costos</h4>
              <div class="detalle-item">
                <span class="detalle-label">Costo de Ventas:</span>
                <span class="detalle-valor">$${analisis.costoTotalVentas.toFixed(2)}</span>
              </div>
              <div class="detalle-item">
                <span class="detalle-label">Inversión en Inventario:</span>
                <span class="detalle-valor">$${analisis.totalInversion.toFixed(2)}</span>
              </div>
            </div>
            
            <div class="detalle-grupo">
              <h4>Eficiencia</h4>
              <div class="detalle-item">
                <span class="detalle-label">Venta Promedio:</span>
                <span class="detalle-valor">$${analisis.cantidadVentas > 0 ? (analisis.totalVentas / analisis.cantidadVentas).toFixed(2) : '0.00'}</span>
              </div>
              <div class="detalle-item">
                <span class="detalle-label">Ganancia por Venta:</span>
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
            <div class="preview-item">
              <div class="producto-info">
                <span class="producto-nombre">${producto.nombre}</span>
                <span class="producto-detalle">ID: ${producto.id} x ${item.cantidad}</span>
              </div>
              <span class="producto-subtotal">$${subtotal.toFixed(2)}</span>
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
      document.getElementById('preview-total').classList.add('activo');
      
      this.mostrarToast(`Total calculado: $${total.toFixed(2)}`, 'success');
    } catch (error) {
      this.mostrarToast('Error al calcular el total: ' + error.message, 'error');
    }
  }

  actualizarPreviewCliente() {
    const nombre = document.getElementById('nombre-cliente').value.trim() || 'Nombre del Cliente';
    const folio = document.getElementById('folio-cliente').value.trim() || '--';
    const telefono = document.getElementById('telefono-cliente').value.trim() || '--';
    const email = document.getElementById('email-cliente').value.trim() || '--';
    
    document.getElementById('preview-nombre').textContent = nombre;
    document.getElementById('preview-folio').textContent = `Folio: ${folio}`;
    document.getElementById('preview-telefono').textContent = telefono;
    document.getElementById('preview-email').textContent = email;
    document.getElementById('preview-fecha').textContent = new Date().toLocaleDateString();
  }

  actualizarPreviewProducto() {
    const nombre = document.getElementById('nombre-producto').value.trim() || 'Nombre del Producto';
    const precioCosto = parseFloat(document.getElementById('precio-costo').value) || 0;
    const precioVenta = parseFloat(document.getElementById('precio-venta').value) || 0;
    const cantidad = parseInt(document.getElementById('cantidad-producto').value) || 0;
    
    const margen = precioCosto > 0 ? ((precioVenta - precioCosto) / precioCosto * 100) : 0;
    const claseMargen = margen >= 0 ? 'positive' : 'negative';
    
    document.getElementById('preview-nombre-producto').textContent = nombre;
    document.getElementById('preview-costo').textContent = `$${precioCosto.toFixed(2)}`;
    document.getElementById('preview-venta').textContent = `$${precioVenta.toFixed(2)}`;
    document.getElementById('preview-stock').textContent = cantidad.toString();
    document.getElementById('preview-margen').textContent = `${margen.toFixed(1)}%`;
    document.getElementById('preview-margen').className = `preview-value ${claseMargen}`;
  }

  limpiarPreviewCliente() {
    document.getElementById('preview-nombre').textContent = 'Nombre del Cliente';
    document.getElementById('preview-folio').textContent = 'Folio: --';
    document.getElementById('preview-telefono').textContent = '--';
    document.getElementById('preview-email').textContent = '--';
    document.getElementById('preview-fecha').textContent = '--';
  }

  limpiarPreviewProducto() {
    document.getElementById('preview-nombre-producto').textContent = 'Nombre del Producto';
    document.getElementById('preview-costo').textContent = '$0.00';
    document.getElementById('preview-venta').textContent = '$0.00';
    document.getElementById('preview-stock').textContent = '0';
    document.getElementById('preview-margen').textContent = '0%';
    document.getElementById('preview-margen').className = 'preview-value';
  }

  limpiarFormularioVenta() {
    document.getElementById('form-venta').reset();
    document.querySelector('#venta input[name="tipo-pago"][value="efectivo"]').checked = true;
    document.getElementById('preview-total').classList.remove('activo');
    document.getElementById('ticket-generado').innerHTML = '';
  }

  limpiarFormularioProducto() {
    document.getElementById('form-alta-producto').reset();
    this.limpiarPreviewProducto();
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

      // Actualizar actividad reciente
      this.actualizarActividadReciente();

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
        <div class="chart-bar" style="height: ${altura}%; width: 80%; margin: 0 auto; justify-content: center; align-items: flex-end; padding: 10px;">
          <span style="color: white; font-weight: bold;">${ventasSemana} ventas</span>
        </div>
      `;
    } else {
      contenedor.innerHTML = `
        <div class="result-placeholder">
          <i class="fas fa-chart-bar"></i>
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
        <div class="chart-warning">
          <i class="fas fa-exclamation-triangle"></i>
          <p>${productosStockBajo} productos con stock bajo</p>
        </div>
      `;
    } else {
      contenedor.innerHTML = `
        <div class="result-placeholder">
          <i class="fas fa-boxes"></i>
          <p>No hay productos con stock bajo</p>
        </div>
      `;
    }
  }

  actualizarActividadReciente() {
    const contenedor = document.getElementById('lista-actividad');
    if (!contenedor) return;

    const actividades = this.sistema.actividad.slice(0, 5); // Últimas 5 actividades
    
    if (actividades.length === 0) {
      contenedor.innerHTML = `
        <div class="activity-item">
          <div class="activity-content">
            <p>No hay actividad reciente</p>
            <span class="activity-time">El sistema está listo</span>
          </div>
        </div>
      `;
      return;
    }

    let html = '';
    actividades.forEach(actividad => {
      const tiempo = this.calcularTiempoTranscurrido(actividad.timestamp);
      
      html += `
        <div class="activity-item">
          <div class="activity-icon">
            <i class="fas fa-${this.obtenerIconoActividad(actividad.tipo)}"></i>
          </div>
          <div class="activity-content">
            <p>${actividad.mensaje}</p>
            <span class="activity-time">${tiempo}</span>
          </div>
          ${actividad.datos.venta ? `
            <div class="activity-amount positive">
              +$${actividad.datos.venta.total.toFixed(2)}
            </div>
          ` : ''}
        </div>
      `;
    });
    
    contenedor.innerHTML = html;
  }

  calcularTiempoTranscurrido(timestamp) {
    const ahora = new Date();
    const fecha = new Date(timestamp);
    const diferencia = ahora - fecha;
    
    const minutos = Math.floor(diferencia / (1000 * 60));
    const horas = Math.floor(diferencia / (1000 * 60 * 60));
    const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
    
    if (minutos < 1) return 'Hace unos segundos';
    if (minutos < 60) return `Hace ${minutos} minuto${minutos > 1 ? 's' : ''}`;
    if (horas < 24) return `Hace ${horas} hora${horas > 1 ? 's' : ''}`;
    return `Hace ${dias} día${dias > 1 ? 's' : ''}`;
  }

  obtenerIconoActividad(tipo) {
    const iconos = {
      'venta': 'shopping-cart',
      'cliente': 'user-plus',
      'inventario': 'box',
      'system': 'cog'
    };
    
    return iconos[tipo] || 'info-circle';
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
  if (sistema.productos.length === 0) {
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
