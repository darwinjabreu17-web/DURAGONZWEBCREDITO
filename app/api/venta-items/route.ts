import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: obtener los items de una venta -> ?venta_id=123
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ventaId = searchParams.get('venta_id')

  if (!ventaId) return NextResponse.json({ error: 'Falta venta_id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('venta_items')
    .select('*')
    .eq('venta_id', ventaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST: insertar items de una venta
export async function POST(request: Request) {
  const body = await request.json()

  const { error } = await supabaseAdmin
    .from('venta_items')
    .insert(body)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}