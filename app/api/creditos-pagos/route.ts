import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// POST: registra un abono o pago total (llama la función SQL aplicar_pago_credito)
// Body: { cliente_id, monto_usd, tasa_dolar, abono_efectivo_usd, abono_efectivo_bs,
//         abono_tarjeta, abono_transferencia, abono_biopago, vendedor_id, vendedor_nombre }
export async function POST(request: Request) {
  const body = await request.json()

  const { data, error } = await supabaseAdmin.rpc('aplicar_pago_credito', {
    p_cliente_id: body.cliente_id,
    p_monto_usd: body.monto_usd,
    p_tasa_dolar: body.tasa_dolar,
    p_abono_efectivo_usd: body.abono_efectivo_usd || 0,
    p_abono_efectivo_bs: body.abono_efectivo_bs || 0,
    p_abono_tarjeta: body.abono_tarjeta || 0,
    p_abono_transferencia: body.abono_transferencia || 0,
    p_abono_biopago: body.abono_biopago || 0,
    p_vendedor_id: body.vendedor_id || null,
    p_vendedor_nombre: body.vendedor_nombre || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data?.[0] || null })
}

// GET: historial de pagos de un cliente, o del día (para reportes)
// Uso: /api/creditos-pagos?cliente_id=5   ó   /api/creditos-pagos?fecha=2026-07-23
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clienteId = searchParams.get('cliente_id')
  const fecha = searchParams.get('fecha')

  let query = supabaseAdmin.from('creditos_pagos').select('*').order('created_at', { ascending: false })

  if (clienteId) {
    query = query.eq('cliente_id', clienteId)
  } else if (fecha) {
    query = query.gte('created_at', `${fecha}T00:00:00`).lte('created_at', `${fecha}T23:59:59`)
  } else {
    return NextResponse.json({ error: 'Falta cliente_id o fecha' }, { status: 400 })
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}