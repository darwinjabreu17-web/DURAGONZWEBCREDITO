import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: trae la única fila de configuración del ticket (si existe)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('configuracion_ticket')
      .select('*')
      .order('id', { ascending: true })
      .limit(1)

    if (error) return NextResponse.json({ error: error.message, details: error.details }, { status: 500 })
    return NextResponse.json({ data: data && data.length > 0 ? data[0] : null })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: err.message }, { status: 500 })
  }
}

// POST: crea o actualiza la fila de configuración del ticket
// - Si el body trae "id", hace UPDATE de esa fila.
// - Si no trae "id" (todavía no existe ninguna fila), hace INSERT.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, ...campos } = body

    const payload = {
      nombre_negocio: campos.nombre_negocio,
      rif_cedula: campos.rif_cedula,
      direccion: campos.direccion,
      incluir_telefono: campos.incluir_telefono,
      telefono: campos.telefono,
      tamano_letra: campos.tamano_letra,
      tipo_letra: campos.tipo_letra,
      espaciado: campos.espaciado,
      ancho_papel: campos.ancho_papel,
      updated_at: new Date().toISOString(),
    }

    if (id) {
      const { data, error } = await supabaseAdmin
        .from('configuracion_ticket')
        .update(payload)
        .eq('id', id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message, details: error.details }, { status: 500 })
      return NextResponse.json({ data })
    } else {
      const { data, error } = await supabaseAdmin
        .from('configuracion_ticket')
        .insert(payload)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message, details: error.details }, { status: 500 })
      return NextResponse.json({ data })
    }
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: err.message }, { status: 500 })
  }
}
