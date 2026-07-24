import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: trae un cliente por su id
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { data, error } = await supabaseAdmin
    .from('clientes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// PATCH: actualiza los datos de un cliente
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()

  const { error } = await supabaseAdmin
    .from('clientes')
    .update(body)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE: elimina un cliente.
// Si el cliente tiene ventas, pedidos a crédito o pagos asociados, la base
// de datos puede rechazar el borrado por las restricciones de llave foránea;
// en ese caso devolvemos el mensaje tal cual para que se entienda por qué.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error } = await supabaseAdmin
    .from('clientes')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
