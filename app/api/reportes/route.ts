import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: ventas y abonos de un día, ya combinados -> ?fecha=YYYY-MM-DD
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

  const { data: abonosCrudos, error: errorAbonos } = await supabaseAdmin
    .from('creditos_abonos')
    .select('*')
    .gte('created_at', `${fecha}T00:00:00-04:00`)
    .lte('created_at', `${fecha}T23:59:59-04:00`)

  if (errorAbonos) return NextResponse.json({ error: errorAbonos.message }, { status: 500 })

  const ventas = ventasData || []
  const abonosCrudosList = abonosCrudos || []

  let mapaVentasOrigen: Record<number, any> = {}
  if (abonosCrudosList.length > 0) {
    const idsVentasOrigen = [...new Set(abonosCrudosList.map((a: any) => a.venta_id))]
    const { data: ventasOrigen, error: errorVentasOrigen } = await supabaseAdmin
      .from('ventas')
      .select('id, ganancia_usd, total_usd, pago_credito_usd, cliente_id')
      .in('id', idsVentasOrigen)

    if (errorVentasOrigen) return NextResponse.json({ error: errorVentasOrigen.message }, { status: 500 })

    ;(ventasOrigen || []).forEach((v: any) => { mapaVentasOrigen[v.id] = v })
  }

  const abonos = abonosCrudosList.map((a: any) => ({ ...a, ventas: mapaVentasOrigen[a.venta_id] }))

  return NextResponse.json({ ventas, abonos })
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