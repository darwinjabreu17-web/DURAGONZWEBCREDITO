import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: soporta varios modos según los parámetros que le mandes
// - ?ultima=true              -> la última venta registrada (para el dashboard)
// - ?ultimaCredito=true       -> la última venta hecha a crédito (para el dashboard)
// - ?fechaInicio=X&fechaFin=Y -> ventas filtradas por rango de fechas
// - ?cliente_id=X&credito=true -> ventas a crédito de un cliente específico
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ultima = searchParams.get('ultima')
    const ultimaCredito = searchParams.get('ultimaCredito')
    const fechaInicio = searchParams.get('fechaInicio')
    const fechaFin = searchParams.get('fechaFin')
    const clienteId = searchParams.get('cliente_id')
    const credito = searchParams.get('credito')

    // Última venta registrada (sin importar el método de pago), para la
    // card "Última Venta" del dashboard. Se excluyen las ventas anuladas.
    if (ultima === 'true') {
      const { data, error } = await supabaseAdmin
        .from('ventas')
        .select('id, created_at, total_usd, cliente_id, anulada')
        .neq('anulada', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) return NextResponse.json({ error: error.message, details: error.details }, { status: 500 })
      return NextResponse.json({ data })
    }

    // Última venta hecha a crédito (pago_credito_usd > 0), para la card
    // "Última Venta a Crédito" del dashboard.
    // Usa el join directo a clientes gracias a la foreign key
    // ventas_cliente_id_fkey (ventas.cliente_id -> clientes.id).
    if (ultimaCredito === 'true') {
      const { data, error } = await supabaseAdmin
        .from('ventas')
        .select('id, created_at, total_usd, pago_credito_usd, cliente_id, anulada, clientes ( nombre )')
        .neq('anulada', true)
        .gt('pago_credito_usd', 0)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) return NextResponse.json({ error: error.message, details: error.details }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (clienteId && credito === 'true') {
      const { data, error } = await supabaseAdmin
        .from('ventas')
        .select('id, created_at, total_usd, pago_credito_usd, cliente_id, anulada')
        .eq('cliente_id', clienteId)
        .gt('pago_credito_usd', 0)
        .order('created_at', { ascending: false })

      if (error) return NextResponse.json({ error: error.message, details: error.details }, { status: 500 })
      return NextResponse.json({ data })
    }

    if (fechaInicio && fechaFin) {
      const { data, error } = await supabaseAdmin
        .from('ventas')
        .select('id, created_at, total_usd, total_bs, cliente_id, anulada')
        .gte('created_at', `${fechaInicio}T00:00:00-04:00`)
        .lte('created_at', `${fechaFin}T23:59:59-04:00`)
        .order('created_at', { ascending: false })

      if (error) return NextResponse.json({ error: error.message, details: error.details }, { status: 500 })
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: err.message }, { status: 500 })
  }
}

// POST: crear una venta nueva
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('ventas')
      .insert(body)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message, details: error.details }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: err.message }, { status: 500 })
  }
}
