import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: obtener la tasa del día
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')

  if (!fecha) {
    return NextResponse.json({ error: 'Falta el parámetro fecha' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('tasas_diarias')
    .select('valor')
    .eq('fecha', fecha)
    .order('id', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// POST: guardar/actualizar la tasa del día
export async function POST(request: Request) {
  const body = await request.json()
  const { fecha, valor } = body

  if (!fecha || valor === undefined || isNaN(parseFloat(valor))) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('tasas_diarias')
    .upsert({ fecha, valor: parseFloat(valor) }, { onConflict: 'fecha' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}