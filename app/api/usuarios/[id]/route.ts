import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// PATCH: actualizar usuario (editar datos/permisos, cambiar clave, o dar de baja)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()

  const { error } = await supabaseAdmin
    .from('users')
    .update(body)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE: eliminar usuario definitivamente.
// Sus ventas quedan intactas porque vendedor_id/vendedor_nombre viven
// en la tabla ventas (sin llave foránea real hacia users), así que
// borrar aquí no afecta el historial ni los reportes.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}