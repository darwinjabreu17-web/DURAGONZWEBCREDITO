export type TipoCredito = 'ilimitado' | 'limite';

export interface Cliente {
  id: number;
  created_at: string;
  cedula_rif: string | null;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  tipo_credito: TipoCredito;
  monto_limite: number | null;
}

export interface SaldoCliente {
  cliente_id: number;
  total_credito_usd: number;
  total_abonado_usd: number;
  saldo_usd: number;
}

// Una venta que tiene parte pagada a crédito
export interface VentaCredito {
  id: number;
  created_at: string;
  total_usd: number;
  pago_credito_usd: number;
  cliente_id: number;
  anulada: boolean;
}

// Un abono registrado contra una venta específica
export interface AbonoCredito {
  id: number;
  created_at: string;
  venta_id: number;
  abono_efectivo_usd: number;
  abono_efectivo_bs: number;
  abono_tarjeta: number;
  abono_transferencia: number;
  abono_biopago: number;
  total_abono_usd: number;
}

// Fila combinada para mostrar en el Estado de Cuenta
export interface MovimientoEstadoCuenta {
  fecha: string;
  tipo: 'venta' | 'abono';
  folio: number; // id de la venta
  descripcion: string;
  monto: number; // positivo = venta a crédito, negativo = abono
  anulada?: boolean; // solo aplica a movimientos tipo 'venta'
}
