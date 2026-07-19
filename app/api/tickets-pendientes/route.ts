import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: buscar tickets pendientes por referencia (nombre/cédula)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const buscar = searchParams.get('buscar')

  let query = supabaseAdmin
    .from('tickets_pendientes')
    .select('*')
    .order('created_at', { ascending: false })

  if (buscar) {
    query = query.ilike('referencia', `%${buscar}%`)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST: guardar un ticket nuevo
export async function POST(request: Request) {
  const body = await request.json()

  const { data, error } = await supabaseAdmin
    .from('tickets_pendientes')
    .insert({
      referencia: body.referencia,
      items: body.items,
      total_usd: body.total_usd,
      total_bs: body.total_bs,
      cliente_id: body.cliente_id || null,
      vendedor_nombre: body.vendedor_nombre || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}