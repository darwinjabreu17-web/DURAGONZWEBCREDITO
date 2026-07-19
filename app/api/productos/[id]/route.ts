import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// PATCH: actualizar un producto
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()

  const { error } = await supabaseAdmin
    .from('productos')
    .update(body)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE: eliminar un producto
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error } = await supabaseAdmin
    .from('productos')
    .delete()
    .eq('id', params.id)

  if (error) {
    // Código 23503 = violación de llave foránea en Postgres
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'No se puede eliminar: este producto ya tiene ventas registradas.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}