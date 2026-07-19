import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: abonos de un conjunto de ventas -> ?venta_ids=1,2,3
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ventaIdsParam = searchParams.get('venta_ids')

  if (!ventaIdsParam) return NextResponse.json({ error: 'Falta venta_ids' }, { status: 400 })

  const ventaIds = ventaIdsParam.split(',').map((id) => Number(id))

  const { data, error } = await supabaseAdmin
    .from('creditos_abonos')
    .select('*')
    .in('venta_id', ventaIds)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST: registrar un abono a crédito
export async function POST(request: Request) {
  const body = await request.json()

  const { error } = await supabaseAdmin.from('creditos_abonos').insert(body)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}