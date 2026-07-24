import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: ventas y pagos de crédito de un día, ya combinados -> ?fecha=YYYY-MM-DD
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')

  if (!fecha) return NextResponse.json({ error: 'Falta fecha' }, { status: 400 })

  const { data: ventasData, error: errorVentas } = await supabaseAdmin
    .from('ventas')
    .select('*')
    .eq('anulada', false)
    .gte('created_at', `${fecha}T00:00:00-04:00`)
    .lte('created_at', `${fecha}T23:59:59-04:00`)
    .order('created_at', { ascending: false })

  if (errorVentas) return NextResponse.json({ error: errorVentas.message }, { status: 500 })

  // Pagos de crédito (abonos y pagos totales) del día — ya vienen con la
  // ganancia calculada de una vez por la función aplicar_pago_credito,
  // no hace falta recalcular nada aquí.
  const { data: pagosCredito, error: errorPagos } = await supabaseAdmin
    .from('creditos_pagos')
    .select('*')
    .gte('created_at', `${fecha}T00:00:00-04:00`)
    .lte('created_at', `${fecha}T23:59:59-04:00`)
    .order('created_at', { ascending: false })

  if (errorPagos) return NextResponse.json({ error: errorPagos.message }, { status: 500 })

  return NextResponse.json({ ventas: ventasData || [], abonos: pagosCredito || [] })
}

// POST: guarda el cierre de caja del día (upsert en reportes_diarios)
export async function POST(request: Request) {
  const body = await request.json()

  const { error } = await supabaseAdmin
    .from('reportes_diarios')
    .upsert(body, { onConflict: 'fecha' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}