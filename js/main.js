/**
 * @file Punto de entrada principal de la aplicación DANY-SHOP.
 * @description Inicializa el sistema, la interfaz de usuario y carga datos de ejemplo si es necesario.
 */

import { CONFIG } from './config.js';
import { SistemaTienda } from './sistema.js';
import { InterfazUsuario } from './ui.js';

/**
 * @function inicializarDatosEjemplo
 * @description Carga un conjunto de datos de ejemplo (productos y clientes) si la base de datos está vacía.
 * @param {SistemaTienda} sistema - La instancia del sistema de tienda.
 */
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
    sistema.nextProductoId = productosEjemplo.length + 1;
  }

  if (sistema.clientes.length === 0) {
    try {
      sistema.agregarCliente("Ana García López", "CLI-001", "555-123-4567", "ana.garcia@email.com");
      sistema.agregarCliente("Carlos Mendoza Ruiz", "CLI-002", "555-987-6543", "carlos.mendoza@email.com");
    } catch (error) {
      console.error('Error agregando clientes de ejemplo:', error);
    }
  }

  sistema.agregarActividad('system', 'Sistema DANY-SHOP inicializado');
  sistema.guardarDatos();
}

/**
 * @event DOMContentLoaded
 * @description Evento que se dispara cuando el contenido del DOM ha sido completamente cargado y parseado.
 *              Inicializa la aplicación.
 */
document.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('Inicializando DANY-SHOP...');

    const sistema = new SistemaTienda();
    inicializarDatosEjemplo(sistema);

    const sistemaUI = new InterfazUsuario(sistema);
    sistemaUI.inicializar();

    window.sistema = sistema;
    window.sistemaUI = sistemaUI;

    console.log(`DANY-SHOP v${CONFIG.VERSION} inicializado.`);
  } catch (error) {
    console.error('Error fatal al inicializar:', error);
    document.getElementById('loading-screen')?.classList.add('oculto');
  }
});
