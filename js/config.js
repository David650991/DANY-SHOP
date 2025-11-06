/**
 * @file Archivo de configuración principal de la aplicación DANY-SHOP.
 * @description Define constantes y parámetros utilizados en todo el sistema.
 */

/**
 * @typedef {Object} AppConfig
 * @property {string} VERSION - Versión actual de la aplicación.
 * @property {string} DATABASE_KEY - Clave utilizada para almacenar los datos en localStorage.
 * @property {number} NOTIFICATION_TIMEOUT - Tiempo en milisegundos que las notificaciones permanecen visibles.
 * @property {number} DEUDA_LIMITE_DIAS - Número de días para considerar a un cliente en atraso.
 * @property {number} STOCK_BAJO_LIMITE - Límite de cantidad para considerar un producto con stock bajo.
 */

/**
 * @type {AppConfig}
 * @description Objeto de configuración con todas las constantes de la aplicación.
 */
export const CONFIG = {
  VERSION: '2.2.0',
  DATABASE_KEY: 'dany_shop_v2',
  NOTIFICATION_TIMEOUT: 5000,
  DEUDA_LIMITE_DIAS: 7,
  STOCK_BAJO_LIMITE: 10
};
