import { CONFIG } from './config.js';

// ========== GESTIÓN DE LA INTERFAZ ==========
export class InterfazUsuario {
  constructor(sistema) {
    this.sistema = sistema;
    this.panelActual = 'dashboard';
    this.filtroInventario = '';
    this.filtroTipo = 'todos';
    this.periodoTop = 'semana';
    this.periodoGanancias = 'todo';
    this.cacheDomElements();
  }

  cacheDomElements() {
    this.dom = {
        body: document.body,
        loadingScreen: document.getElementById('loading-screen'),
        toastContainer: document.getElementById('toast-container'),
        btnTema: document.getElementById('btn-tema'),
        btnNotifications: document.getElementById('btn-notifications'),
        notificationBadge: document.getElementById('notification-badge'),
        btnMenuMovil: document.getElementById('btn-menu-movil'),
        navegacionPrincipal: document.getElementById('navegacion-principal'),
        btnActualizarDashboard: document.getElementById('btn-actualizar-dashboard'),
        totalClientes: document.getElementById('total-clientes'),
        totalProductos: document.getElementById('total-productos'),
        totalVentas: document.getElementById('total-ventas'),
        totalDeuda: document.getElementById('total-deuda'),
        chartVentas: document.getElementById('chart-ventas'),
        chartStock: document.getElementById('chart-stock'),
        listaActividad: document.getElementById('lista-actividad'),
        formAltaCliente: document.getElementById('form-alta-cliente'),
        formConsultaDeuda: document.getElementById('form-consulta-deuda'),
        formHistorialCompras: document.getElementById('form-historial-compras'),
        formVenta: document.getElementById('form-venta'),
        formAltaProducto: document.getElementById('form-alta-producto'),
        previewNombre: document.getElementById('preview-nombre'),
        previewFolio: document.getElementById('preview-folio'),
        previewTelefono: document.getElementById('preview-telefono'),
        previewEmail: document.getElementById('preview-email'),
        previewFecha: document.getElementById('preview-fecha'),
        previewNombreProducto: document.getElementById('preview-nombre-producto'),
        previewCosto: document.getElementById('preview-costo'),
        previewVenta: document.getElementById('preview-venta'),
        previewStock: document.getElementById('preview-stock'),
        previewMargen: document.getElementById('preview-margen'),
        previewProductos: document.getElementById('preview-productos'),
        previewTotalMonto: document.getElementById('preview-total-monto'),
        previewTotal: document.getElementById('preview-total'),
        resultadoDeuda: document.getElementById('resultado-deuda'),
        resultadoHistorial: document.getElementById('resultado-historial'),
        ticketGenerado: document.getElementById('ticket-generado'),
        listaInventario: document.getElementById('lista-inventario'),
        totalProductosInv: document.getElementById('total-productos-inv'),
        totalStockBajo: document.getElementById('total-stock-bajo'),
        totalSinStock: document.getElementById('total-sin-stock'),
        resultadoTopMas: document.getElementById('resultado-top-mas'),
        resultadoTopMenos: document.getElementById('resultado-top-menos'),
        resultadoGanancias: document.getElementById('resultado-ganancias'),
        listaAtraso: document.getElementById('lista-atraso'),
        listaCredito: document.getElementById('lista-credito'),
        clientesLista: document.getElementById('clientes-lista'),
        filtroInventarioInput: document.getElementById('filtro-inventario'),
    };
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
      this.dom.body.classList.add('tema-oscuro');
      this.actualizarIconoTema('sol');
    }
  }

  actualizarIconoTema(icono) {
    const iconElement = this.dom.btnTema.querySelector('i');
    if (icono === 'sol') {
      iconElement.classList.remove('fa-moon');
      iconElement.classList.add('fa-sun');
    } else {
      iconElement.classList.remove('fa-sun');
      iconElement.classList.add('fa-moon');
    }
  }

  inicializarEventos() {
    this.dom.btnTema.addEventListener('click', () => this.cambiarTema());
    this.dom.btnActualizarDashboard.addEventListener('click', () => this.actualizarDashboard());

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const panel = e.currentTarget.dataset.panel;
        this.mostrarPanel(panel);
      });
    });

    document.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        this.mostrarPanel(action);
      });
    });

    this.inicializarFormularios();

    window.addEventListener('datosActualizados', () => {
      this.actualizarDashboard();
      this.actualizarListasDesplegables();
    });

    this.dom.btnNotifications.addEventListener('click', () => this.mostrarNotificaciones());

    if (this.dom.filtroInventarioInput) {
      this.dom.filtroInventarioInput.addEventListener('input', (e) => {
        this.filtroInventario = e.target.value;
        this.renderizarInventario();
      });
    }

    const btnExportarInventario = document.getElementById('btn-exportar-inventario');
    if (btnExportarInventario) {
      btnExportarInventario.addEventListener('click', () => this.exportarInventario());
    }

    const btnLimpiarVenta = document.getElementById('btn-limpiar-venta');
    if (btnLimpiarVenta) {
      btnLimpiarVenta.addEventListener('click', () => this.limpiarFormularioVenta());
    }

    const btnLimpiarProducto = document.getElementById('btn-limpiar-producto');
    if (btnLimpiarProducto) {
      btnLimpiarProducto.addEventListener('click', () => this.limpiarFormularioProducto());
    }
  }

  inicializarMenuMovil() {
    if (this.dom.btnMenuMovil && this.dom.navegacionPrincipal) {
      this.dom.btnMenuMovil.addEventListener('click', () => {
        this.dom.navegacionPrincipal.classList.toggle('activo');
      });
    }
  }

  inicializarFiltros() {
    document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.currentTarget.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.filtroTipo = e.currentTarget.dataset.filter;
        this.renderizarInventario();
      });
    });

    document.querySelectorAll('.time-filter .filter-btn[data-period]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.currentTarget.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.periodoTop = e.currentTarget.dataset.period;
      });
    });
  }

  inicializarPreviews() {
    ['nombre-cliente', 'folio-cliente', 'telefono-cliente', 'email-cliente'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => this.actualizarPreviewCliente());
    });

    ['nombre-producto', 'precio-costo', 'precio-venta', 'cantidad-producto'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => this.actualizarPreviewProducto());
    });
  }

  inicializarFormularios() {
    this.dom.formAltaCliente?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.procesarAltaCliente();
    });

    this.dom.formConsultaDeuda?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.procesarConsultaDeuda();
    });

    this.dom.formHistorialCompras?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.procesarHistorialCompras();
    });

    this.dom.formVenta?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.procesarVenta();
    });

    document.getElementById('btn-calcular-total')?.addEventListener('click', () => this.calcularPreviewVenta());

    this.dom.formAltaProducto?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.procesarAltaProducto();
    });

    document.getElementById('btn-refrescar-inventario')?.addEventListener('click', () => this.renderizarInventario());
    document.getElementById('btn-calcular-top-mas')?.addEventListener('click', () => this.procesarTopMasVendido());
    document.getElementById('btn-calcular-top-menos')?.addEventListener('click', () => this.procesarTopMenosVendido());
    document.getElementById('btn-calcular-ganancias')?.addEventListener('click', () => this.procesarCostosGanancias());
    document.getElementById('btn-mostrar-atraso')?.addEventListener('click', () => this.renderizarClientesAtraso());
    document.getElementById('btn-mostrar-credito')?.addEventListener('click', () => this.renderizarClientesConCredito());
  }

  inicializarNavegacionScroll() {
    const navScrollContainer = document.querySelector('.nav-scroll-container');
    if (!navScrollContainer) return;

    const updateScrollIndicators = () => {
      const { scrollLeft, scrollWidth, clientWidth } = navScrollContainer;
      document.querySelector('.nav-scroll-indicator.left').classList.toggle('hidden', scrollLeft <= 0);
      document.querySelector('.nav-scroll-indicator.right').classList.toggle('hidden', scrollLeft >= scrollWidth - clientWidth - 1);
    };

    navScrollContainer.addEventListener('scroll', updateScrollIndicators);
    document.querySelector('.nav-scroll-indicator.left')?.addEventListener('click', () => navScrollContainer.scrollBy({ left: -200, behavior: 'smooth' }));
    document.querySelector('.nav-scroll-indicator.right')?.addEventListener('click', () => navScrollContainer.scrollBy({ left: 200, behavior: 'smooth' }));

    updateScrollIndicators();
    window.addEventListener('resize', updateScrollIndicators);
  }

  mostrarPanel(id) {
    document.querySelectorAll('.panel.active').forEach(panel => panel.classList.remove('active'));
    this.dom.navegacionPrincipal?.classList.remove('activo');

    const panel = document.getElementById(id);
    if (panel) {
      panel.classList.add('active');
      this.panelActual = id;

      document.querySelectorAll('.nav-btn.active').forEach(btn => btn.classList.remove('active'));
      document.querySelector(`.nav-btn[data-panel="${id}"]`)?.classList.add('active');

      this.accionesPanel(id);
    }
  }

  accionesPanel(id) {
    switch (id) {
      case 'inventario': this.renderizarInventario(); break;
      case 'clientes-atraso': this.renderizarClientesAtraso(); break;
      case 'credito-disponible': this.renderizarClientesConCredito(); break;
      case 'dashboard': this.actualizarDashboard(); break;
    }
  }

  renderizarInventario() {
    const contenedor = this.dom.listaInventario;
    if (!contenedor) return;

    let productos = this.sistema.buscarProductos(this.filtroInventario);
    productos = this.sistema.filtrarProductos(productos, this.filtroTipo);

    if (this.dom.totalProductosInv) this.dom.totalProductosInv.textContent = productos.length;
    if (this.dom.totalStockBajo) this.dom.totalStockBajo.textContent = this.sistema.obtenerProductosStockBajo().length;
    if (this.dom.totalSinStock) this.dom.totalSinStock.textContent = this.sistema.obtenerProductosSinStock().length;

    if (productos.length === 0) {
      contenedor.innerHTML = `<div class="result-placeholder"><i class="fas fa-box-open"></i><p>No hay productos</p></div>`;
      return;
    }

    contenedor.innerHTML = productos.map(p => this.crearHtmlProducto(p)).join('');
  }

  crearHtmlProducto(p) {
      const stockBajo = p.cantidad <= CONFIG.STOCK_BAJO_LIMITE;
      const sinStock = p.cantidad === 0;
      const stockClase = sinStock ? 'sin-stock' : (stockBajo ? 'stock-bajo' : '');
      const margen = p.precioCosto > 0 ? ((p.precioVenta - p.precioCosto) / p.precioCosto * 100).toFixed(1) : 0;

      return `
        <div class="producto-card ${stockClase}">
          <div class="producto-header">
            <div><h4>${p.nombre}</h4><span class="producto-id">ID: ${p.id}</span></div>
            <div class="producto-stats"><span class="stat-badge">Margen: ${margen}%</span></div>
          </div>
          <div class="producto-detalles">
            ${this.crearHtmlDetalle("Precio costo:", `$${p.precioCosto.toFixed(2)}`)}
            ${this.crearHtmlDetalle("Precio venta:", `$${p.precioVenta.toFixed(2)}`)}
            ${this.crearHtmlDetalle("Stock:", p.cantidad, stockBajo ? 'stock-bajo' : '')}
            ${p.ventasTotales ? this.crearHtmlDetalle("Ventas totales:", p.ventasTotales) : ''}
          </div>
          ${stockBajo ? `<div class="producto-alerta"><i class="fas fa-exclamation-triangle"></i><span>${sinStock ? 'Sin stock' : 'Stock bajo'}</span></div>` : ''}
        </div>`;
  }

  crearHtmlDetalle(label, value, valueClass = '') {
      return `<div class="detalle"><span class="detalle-label">${label}</span><span class="detalle-valor ${valueClass}">${value}</span></div>`;
  }


  renderizarClientesAtraso() {
    const contenedor = this.dom.listaAtraso;
    if (!contenedor) return;

    const clientesAtraso = this.sistema.obtenerClientesEnAtraso();
    if (clientesAtraso.length === 0) {
      contenedor.innerHTML = `<div class="result-placeholder"><i class="fas fa-check-circle"></i><p>No hay clientes en atraso</p></div>`;
      return;
    }

    contenedor.innerHTML = `<div class="clientes-lista">${clientesAtraso.map(c => this.crearHtmlCliente(c, 'atraso')).join('')}</div>`;
  }

  renderizarClientesConCredito() {
    const contenedor = this.dom.listaCredito;
    if (!contenedor) return;

    const clientesConCredito = this.sistema.obtenerClientesConCreditoDisponible();
    if (clientesConCredito.length === 0) {
      contenedor.innerHTML = `<div class="result-placeholder"><i class="fas fa-credit-card"></i><p>No hay clientes con crédito</p></div>`;
      return;
    }

    contenedor.innerHTML = `<div class="clientes-lista">${clientesConCredito.map(c => this.crearHtmlCliente(c, 'credito')).join('')}</div>`;
  }

  crearHtmlCliente(c, tipo) {
      let detallesExtra = '';
      if (tipo === 'atraso') {
          detallesExtra = `
            ${this.crearHtmlDetalle("Deuda:", `$${c.deuda.toFixed(2)}`, "peligro")}
            ${this.crearHtmlDetalle("Días de atraso:", c.diasAtraso)}
            ${c.telefono ? this.crearHtmlDetalle("Teléfono:", c.telefono) : ''}`;
      } else {
          detallesExtra = `
            ${c.telefono ? this.crearHtmlDetalle("Teléfono:", c.telefono) : ''}
            ${c.email ? this.crearHtmlDetalle("Email:", c.email) : ''}
            ${this.crearHtmlDetalle("Registrado:", c.fechaRegistro)}`;
      }

      return `
        <div class="cliente-item ${tipo}">
          <div class="cliente-info">
            <div class="cliente-header"><h4>${c.nombre}</h4><span class="cliente-folio">${c.folio}</span></div>
            <div class="cliente-detalles">${detallesExtra}</div>
          </div>
          <div class="cliente-acciones">
            <button class="btn-secondary btn-sm"><i class="fas fa-${tipo === 'atraso' ? 'phone' : 'shopping-cart'}"></i> ${tipo === 'atraso' ? 'Llamar' : 'Vender'}</button>
          </div>
        </div>`;
  }

  procesarAltaCliente() {
    try {
      const nombre = document.getElementById('nombre-cliente').value.trim();
      const folio = document.getElementById('folio-cliente').value.trim();
      const telefono = document.getElementById('telefono-cliente').value.trim() || '';
      const email = document.getElementById('email-cliente').value.trim() || '';
      this.sistema.agregarCliente(nombre, folio, telefono, email);
      this.mostrarToast('Cliente registrado', 'success');
      this.dom.formAltaCliente.reset();
      this.limpiarPreviewCliente();
    } catch (error) {
      this.mostrarToast(error.message, 'error');
    }
  }

  procesarConsultaDeuda() {
    try {
      const folio = document.getElementById('folio-deuda').value.trim();
      const cliente = this.sistema.obtenerClientePorFolio(folio);
      const contenedor = this.dom.resultadoDeuda;
      if (!contenedor) return;
      if (!cliente) {
        contenedor.innerHTML = `<div class="result-placeholder"><i class="fas fa-user-times"></i><p>Cliente no encontrado</p></div>`;
        return;
      }
      const deuda = this.sistema.ventas.filter(v => v.folioCliente === folio && v.tipoPago === 'credito' && !v.pagada).reduce((s, v) => s + v.total, 0);
      contenedor.innerHTML = this.crearHtmlDeuda(cliente, deuda);
    } catch (error) {
      this.mostrarToast('Error al consultar deuda', 'error');
    }
  }

  crearHtmlDeuda(cliente, deuda) {
      const tieneDeuda = deuda > 0;
      return `
        <div class="deuda-info ${tieneDeuda ? 'con-deuda' : 'sin-deuda'}">
          <div class="deuda-header"><h3>${cliente.nombre}</h3><span class="cliente-folio">${cliente.folio}</span></div>
          <div class="deuda-detalles">
            <div class="deuda-monto"><span class="deuda-label">Deuda:</span><span class="deuda-valor ${tieneDeuda ? 'peligro' : 'exito'}">$${deuda.toFixed(2)}</span></div>
            <div class="deuda-alerta ${tieneDeuda ? '' : 'exito'}"><i class="fas ${tieneDeuda ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i><span>${tieneDeuda ? 'Pendiente' : 'Al corriente'}</span></div>
            ${cliente.telefono ? `<div class="deuda-contacto"><span class="contacto-label">Tel:</span><span class="contacto-valor">${cliente.telefono}</span></div>` : ''}
          </div>
        </div>`;
  }

  procesarHistorialCompras() {
    try {
      const folio = document.getElementById('folio-historial').value.trim();
      const compras = this.sistema.ventas.filter(v => v.folioCliente === folio);
      const contenedor = this.dom.resultadoHistorial;
      if (!contenedor) return;
      if (compras.length === 0) {
        contenedor.innerHTML = `<div class="result-placeholder"><i class="fas fa-shopping-cart"></i><p>No hay compras</p></div>`;
        return;
      }
      const cliente = this.sistema.obtenerClientePorFolio(folio);
      contenedor.innerHTML = `
        <div class="historial-header"><h3>Historial</h3><span class="cliente-info">${cliente?.nombre || 'Cliente'} (${folio})</span></div>
        <div class="compras-lista">${compras.map(v => this.crearHtmlCompra(v)).join('')}</div>`;
    } catch (error) {
      this.mostrarToast('Error al ver historial', 'error');
    }
  }

  crearHtmlCompra(v) {
      return `
        <div class="compra-item">
          <div class="compra-header">
            <div class="compra-fecha"><span class="fecha">${v.fecha}</span><span class="hora">${v.hora}</span></div>
            <div class="compra-info"><span class="compra-tipo ${v.tipoPago}">${v.tipoPago}</span><span class="compra-total">$${v.total.toFixed(2)}</span></div>
          </div>
          <div class="compra-productos">${v.productos.map(p => `<div class="producto-compra"><span class="producto-nombre">${p.nombre}</span><span class="producto-cantidad">x${p.cantidad}</span><span class="producto-precio">$${(p.precioUnitario * p.cantidad).toFixed(2)}</span></div>`).join('')}</div>
        </div>`;
  }

  procesarVenta() {
    try {
      const folio = document.getElementById('folio-venta').value.trim();
      const tipoPago = document.querySelector('input[name="tipo-pago"]:checked').value;
      const inputProductos = document.getElementById('productos-venta').value.trim();
      const venta = this.sistema.registrarVenta(folio, tipoPago, inputProductos);
      this.mostrarTicket(venta);
      this.mostrarToast('Venta registrada', 'success');
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
      const cantidad = parseInt(document.getElementById('cantidad-producto').value) || 0;
      this.sistema.agregarProducto(nombre, precioCosto, precioVenta, cantidad);
      this.mostrarToast('Producto guardado', 'success');
      this.dom.formAltaProducto.reset();
      this.limpiarPreviewProducto();
    } catch (error) {
      this.mostrarToast(error.message, 'error');
    }
  }

  procesarTopMasVendido() { this.procesarTopProductos('mas'); }
  procesarTopMenosVendido() { this.procesarTopProductos('menos'); }

  procesarTopProductos(tipo) {
      try {
          const resultado = this.sistema.obtenerTopProductos(this.periodoTop, tipo);
          const contenedor = tipo === 'mas' ? this.dom.resultadoTopMas : this.dom.resultadoTopMenos;
          if (!contenedor) return;

          if (!resultado) {
              contenedor.innerHTML = `<div class="result-placeholder"><i class="fas fa-chart-line"></i><p>No hay ventas</p></div>`;
              return;
          }

          contenedor.innerHTML = this.crearHtmlTopProducto(resultado, tipo);
      } catch (error) {
          this.mostrarToast(`Error al calcular top ${tipo} vendido`, 'error');
      }
  }

  crearHtmlTopProducto(resultado, tipo) {
      const { producto, cantidad, periodo } = resultado;
      return `
        <div class="top-producto">
          <div class="top-header"><h3>${tipo === 'mas' ? 'Más' : 'Menos'} Vendido</h3><span class="periodo-info">${this.obtenerTextoPeriodo(periodo)}</span></div>
          <div class="producto-destacado">
            <div class="producto-info"><h4>${producto.nombre}</h4><span class="producto-id">ID: ${producto.id}</span></div>
            <div class="producto-estadisticas">
              ${this.crearHtmlDetalle("Unidades vendidas:", cantidad, "destacado")}
              ${this.crearHtmlDetalle("Precio venta:", `$${producto.precioVenta.toFixed(2)}`)}
              ${this.crearHtmlDetalle("Stock actual:", producto.cantidad)}
              ${this.crearHtmlDetalle("Ventas totales:", producto.ventasTotales || 0)}
            </div>
          </div>
        </div>`;
  }

  procesarCostosGanancias() {
    try {
      const analisis = this.sistema.obtenerAnalisisFinanciero(this.periodoGanancias);
      this.dom.resultadoGanancias.innerHTML = this.crearHtmlAnalisis(analisis);
    } catch (error) {
      this.mostrarToast('Error al calcular ganancias', 'error');
    }
  }

  crearHtmlAnalisis(a) {
      return `
        <div class="analisis-financiero">
          <div class="analisis-header"><h3>Análisis Financiero</h3><span class="periodo-info">${this.obtenerTextoPeriodo(a.periodo, true)}</span></div>
          <div class="metricas-grid">
            ${this.crearHtmlMetrica("Ventas Totales", `$${a.totalVentas.toFixed(2)}`, "fa-chart-line")}
            ${this.crearHtmlMetrica("Ganancia Neta", `$${a.gananciaTotal.toFixed(2)}`, "fa-money-bill-wave")}
            ${this.crearHtmlMetrica("Margen", `${a.margenGanancia.toFixed(1)}%`, "fa-percentage")}
            ${this.crearHtmlMetrica("Ventas", a.cantidadVentas, "fa-shopping-cart")}
          </div>
        </div>`;
  }

  crearHtmlMetrica(label, value, icon) {
      return `
        <div class="metrica-card">
          <div class="metrica-icon"><i class="fas ${icon}"></i></div>
          <div class="metrica-info"><span class="metrica-valor">${value}</span><span class="metrica-label">${label}</span></div>
        </div>`;
  }

  calcularPreviewVenta() {
    try {
      const productosInput = document.getElementById('productos-venta').value.trim();
      if (!productosInput) return;

      const listaProductos = this.sistema.parsearProductosInput(productosInput);
      let total = 0;
      const htmlProductos = listaProductos.map(item => {
        const producto = this.sistema.obtenerProductoPorId(item.id);
        if (!producto) return '';
        const subtotal = producto.precioVenta * item.cantidad;
        total += subtotal;
        return this.crearHtmlPreviewItem(producto, item.cantidad, subtotal);
      }).join('');

      if (!htmlProductos) {
        this.mostrarToast('No se encontraron productos', 'error');
        return;
      }

      this.dom.previewProductos.innerHTML = htmlProductos;
      this.dom.previewTotalMonto.textContent = total.toFixed(2);
      this.dom.previewTotal.classList.add('activo');
    } catch (error) {
      this.mostrarToast('Error al calcular total', 'error');
    }
  }

  crearHtmlPreviewItem(producto, cantidad, subtotal) {
      return `
        <div class="preview-item">
          <div class="producto-info"><span class="producto-nombre">${producto.nombre}</span><span class="producto-detalle">ID: ${producto.id} x ${cantidad}</span></div>
          <span class="producto-subtotal">$${subtotal.toFixed(2)}</span>
        </div>`;
  }

  actualizarPreviewCliente() {
    this.dom.previewNombre.textContent = document.getElementById('nombre-cliente').value.trim() || 'Nombre';
    this.dom.previewFolio.textContent = `Folio: ${document.getElementById('folio-cliente').value.trim() || '--'}`;
    this.dom.previewTelefono.textContent = document.getElementById('telefono-cliente').value.trim() || '--';
    this.dom.previewEmail.textContent = document.getElementById('email-cliente').value.trim() || '--';
    this.dom.previewFecha.textContent = new Date().toLocaleDateString();
  }

  actualizarPreviewProducto() {
    const costo = parseFloat(document.getElementById('precio-costo').value) || 0;
    const venta = parseFloat(document.getElementById('precio-venta').value) || 0;
    const margen = costo > 0 ? ((venta - costo) / costo * 100) : 0;

    this.dom.previewNombreProducto.textContent = document.getElementById('nombre-producto').value.trim() || 'Producto';
    this.dom.previewCosto.textContent = `$${costo.toFixed(2)}`;
    this.dom.previewVenta.textContent = `$${venta.toFixed(2)}`;
    this.dom.previewStock.textContent = document.getElementById('cantidad-producto').value || '0';
    this.dom.previewMargen.textContent = `${margen.toFixed(1)}%`;
    this.dom.previewMargen.className = `preview-value ${margen >= 0 ? 'positive' : 'negative'}`;
  }

  limpiarPreviewCliente() {
    this.dom.previewNombre.textContent = 'Nombre';
    this.dom.previewFolio.textContent = 'Folio: --';
    this.dom.previewTelefono.textContent = '--';
    this.dom.previewEmail.textContent = '--';
    this.dom.previewFecha.textContent = '--';
  }

  limpiarPreviewProducto() {
    this.dom.previewNombreProducto.textContent = 'Producto';
    this.dom.previewCosto.textContent = '$0.00';
    this.dom.previewVenta.textContent = '$0.00';
    this.dom.previewStock.textContent = '0';
    this.dom.previewMargen.textContent = '0%';
    this.dom.previewMargen.className = 'preview-value';
  }

  limpiarFormularioVenta() {
    this.dom.formVenta.reset();
    document.querySelector('#venta input[name="tipo-pago"][value="efectivo"]').checked = true;
    this.dom.previewTotal.classList.remove('activo');
    this.dom.ticketGenerado.innerHTML = '';
  }

  limpiarFormularioProducto() {
    this.dom.formAltaProducto.reset();
    this.limpiarPreviewProducto();
  }

  mostrarTicket(venta) {
    let ticket = `DANY-SHOP\nFecha: ${venta.fecha} ${venta.hora}\nTipo: ${venta.tipoPago}\n`;
    if (venta.folioCliente !== 'EFECTIVO') ticket += `Cliente: ${venta.folioCliente}\n`;
    ticket += '------------------------------\n';
    venta.productos.forEach(p => {
        ticket += `${p.nombre.padEnd(15)} x${p.cantidad} $${(p.precioUnitario * p.cantidad).toFixed(2)}\n`;
    });
    ticket += '------------------------------\n';
    ticket += `TOTAL: $${venta.total.toFixed(2)}\n`;
    this.dom.ticketGenerado.textContent = ticket;
  }

  obtenerTextoPeriodo(p, c = false) { return {'hoy':'Hoy','semana':'Semana','mes':'Mes','anio':'Año','todo':'Todo'}[p] || (c ? 'Período' : p); }

  actualizarDashboard() {
    try {
      const stats = this.sistema.obtenerEstadisticas();
      if(this.dom.totalClientes) this.dom.totalClientes.textContent = stats.totalClientes;
      if(this.dom.totalProductos) this.dom.totalProductos.textContent = stats.totalProductos;
      if(this.dom.totalVentas) this.dom.totalVentas.textContent = stats.totalVentas;
      if(this.dom.totalDeuda) this.dom.totalDeuda.textContent = `$${stats.deudaTotal.toFixed(2)}`;
      this.actualizarGraficoVentas(stats.ventasSemana);
      this.actualizarGraficoStock(stats.productosStockBajo);
      this.actualizarActividadReciente();
      document.getElementById('ultima-actualizacion').textContent = `Actualizado: ${new Date().toLocaleTimeString()}`;
    } catch (e) { console.error('Error en dashboard', e); }
  }

  actualizarGraficoVentas(ventas) {
    if (!this.dom.chartVentas) return;
    this.dom.chartVentas.innerHTML = ventas > 0 ? `<div class="chart-bar" style="height:${Math.min(ventas*10,100)}%">${ventas}</div>` : `<p>No hay ventas</p>`;
  }

  actualizarGraficoStock(productos) {
    if (!this.dom.chartStock) return;
    this.dom.chartStock.innerHTML = productos > 0 ? `<div class="chart-warning"><i class="fas fa-exclamation-triangle"></i><p>${productos} con stock bajo</p></div>` : `<p>Stock OK</p>`;
  }

  actualizarActividadReciente() {
    if (!this.dom.listaActividad) return;
    const actividades = this.sistema.actividad.slice(0, 5);
    if (actividades.length === 0) {
      this.dom.listaActividad.innerHTML = `<div class="activity-item"><p>No hay actividad</p></div>`;
      return;
    }
    this.dom.listaActividad.innerHTML = actividades.map(a => this.crearHtmlActividad(a)).join('');
  }

  crearHtmlActividad(a) {
      return `
        <div class="activity-item">
          <div class="activity-icon"><i class="fas fa-${this.obtenerIconoActividad(a.tipo)}"></i></div>
          <div class="activity-content"><p>${a.mensaje}</p><span class="activity-time">${this.calcularTiempoTranscurrido(a.timestamp)}</span></div>
          ${a.datos.venta ? `<div class="activity-amount positive">+$${a.datos.venta.total.toFixed(2)}</div>` : ''}
        </div>`;
  }

  calcularTiempoTranscurrido(ts) {
    const s = Math.floor((new Date() - new Date(ts)) / 1000);
    if(s < 60) return `Ahora`;
    const m = Math.floor(s/60); if(m < 60) return `Hace ${m}m`;
    const h = Math.floor(m/60); if(h < 24) return `Hace ${h}h`;
    const d = Math.floor(h/24); return `Hace ${d}d`;
  }

  obtenerIconoActividad(t) { return {'venta':'shopping-cart','cliente':'user-plus','inventario':'box'}[t] || 'info-circle'; }

  actualizarListasDesplegables() {
    if (!this.dom.clientesLista) return;
    this.dom.clientesLista.innerHTML = this.sistema.clientes.filter(c => c.activo)
        .map(c => `<option value="${c.folio}">${c.nombre}</option>`).join('');
  }

  cambiarTema() {
    this.dom.body.classList.toggle('tema-oscuro');
    this.sistema.configuracion.tema = this.dom.body.classList.contains('tema-oscuro') ? 'oscuro' : 'claro';
    this.actualizarIconoTema(this.sistema.configuracion.tema === 'oscuro' ? 'sol' : 'luna');
    this.sistema.guardarDatos();
  }

  mostrarNotificaciones() {
    try {
      const atraso = this.sistema.obtenerClientesEnAtraso().length;
      const bajoStock = this.sistema.obtenerProductosStockBajo().length;
      const total = atraso + bajoStock;

      if (this.dom.notificationBadge) {
        this.dom.notificationBadge.textContent = total;
        this.dom.notificationBadge.classList.toggle('hidden', total === 0);
      }

      if (total > 0) {
        let msg = `${atraso} cliente(s) en atraso\n${bajoStock} producto(s) con stock bajo`;
        this.mostrarToast(msg, 'warning');
      } else {
        this.mostrarToast('Sin notificaciones', 'info');
      }
    } catch (e) { console.error('Error en notificaciones', e); }
  }

  exportarInventario() {
    try {
      const datos = this.sistema.exportarDatos('json');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([datos], {type:'application/json'}));
      a.download = `inventario_${this.sistema.fechaHoy()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      this.mostrarToast('Inventario exportado', 'success');
    } catch (e) { this.mostrarToast('Error al exportar', 'error'); }
  }

  mostrarToast(mensaje, tipo = 'info') {
    if (!this.dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    const icon = {'success':'check-circle','error':'exclamation-circle','warning':'exclamation-triangle','info':'info-circle'}[tipo];
    toast.innerHTML = `<i class="fas fa-${icon}"></i><span>${mensaje}</span><button onclick="this.parentElement.remove()">&times;</button>`;
    this.dom.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), CONFIG.NOTIFICATION_TIMEOUT);
  }

  ocultarLoading() {
    this.dom.loadingScreen?.classList.add('oculto');
  }
}
