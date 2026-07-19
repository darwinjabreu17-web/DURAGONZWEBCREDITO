import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: obtener una venta específica por id
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { data, error } = await supabaseAdmin
    .from('ventas')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// PATCH: anular una venta
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()

  const { error } = await supabaseAdmin
    .from('ventas')
    .update(body)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}