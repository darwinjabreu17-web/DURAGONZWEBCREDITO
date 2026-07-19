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

class DuragonzDB extends Dexie {
  ventasPendientes!: Table<VentaPendiente, number>;
  productosCache!: Table<ProductoCache, number>;
  clientesCache!: Table<ClienteCache, number>;

  constructor() {
    super('duragonz_offline');
    this.version(2).stores({
      ventasPendientes: '++id, sincronizado, fecha',
      productosCache: 'id, nombre',
      clientesCache: 'id, nombre',
    });
  }
}

export const dbLocal = new DuragonzDB();