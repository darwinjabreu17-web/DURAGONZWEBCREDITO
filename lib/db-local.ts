import Dexie, { type Table } from 'dexie';

export interface VentaPendiente {
  id?: number;
  cliente_id: number | null;
  items: {
    producto_id: number;
    nombre: string;
    cantidad: number;
    precio: number;
  }[];
  total_usd: number;
  total_bs: number;
  metodo_pago: Record<string, number>;
  fecha: string;
  sincronizado: boolean;
}

export interface ProductoCache {
  id: number;
  nombre: string;
  precio_detalle: number;
  precio_mayor: number;
  stock: number;
}

export interface ClienteCache {
  id: number;
  nombre: string;
  cedula_rif: string | null;
  tipo_credito: 'ilimitado' | 'limite';
  monto_limite: number | null;
  saldo_usd: number;
}

// Caché de ventas a crédito (no anuladas) de cada cliente, para poder
// mostrar el estado de cuenta detallado aunque no haya internet.
export interface VentaCreditoCache {
  id: number;
  cliente_id: number;
  pago_credito_usd: number;
  created_at: string;
  anulada: boolean;
}

// Caché de abonos hechos a esas ventas a crédito.
export interface AbonoCreditoCache {
  id: number;
  venta_id: number;
  cliente_id: number;
  total_abono_usd: number;
  created_at: string;
}

class DuragonzDB extends Dexie {
  ventasPendientes!: Table<VentaPendiente, number>;
  productosCache!: Table<ProductoCache, number>;
  clientesCache!: Table<ClienteCache, number>;
  ventasCreditoCache!: Table<VentaCreditoCache, number>;
  abonosCreditoCache!: Table<AbonoCreditoCache, number>;

  constructor() {
    super('duragonz_offline');
    this.version(2).stores({
      ventasPendientes: '++id, sincronizado, fecha',
      productosCache: 'id, nombre',
      clientesCache: 'id, nombre',
    });
    // v3: se agregan las tablas de caché de movimientos de crédito
    // (ventas y abonos) para poder ver el estado de cuenta sin internet.
    this.version(3).stores({
      ventasPendientes: '++id, sincronizado, fecha',
      productosCache: 'id, nombre',
      clientesCache: 'id, nombre',
      ventasCreditoCache: 'id, cliente_id',
      abonosCreditoCache: 'id, venta_id, cliente_id',
    });
  }
}

export const dbLocal = new DuragonzDB();
