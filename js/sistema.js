import { CONFIG } from './config.js';

// ========== MODELO DE DATOS MEJORADO ==========
export class SistemaTienda {
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
