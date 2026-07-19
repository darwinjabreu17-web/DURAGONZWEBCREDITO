import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// PATCH: actualizar un cliente
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()

  const { error } = await supabaseAdmin
    .from('clientes')
    .update(body)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE: eliminar un cliente (solo si no tiene deuda pendiente)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  // Revisamos el saldo del cliente en la vista saldo_clientes.
  const { data: saldo, error: errSaldo } = await supabaseAdmin
    .from('saldo_clientes')
    .select('saldo_usd')
    .eq('cliente_id', params.id)
    .maybeSingle()

  if (errSaldo) return NextResponse.json({ error: errSaldo.message }, { status: 500 })

  if (saldo && Number(saldo.saldo_usd) > 0) {
    return NextResponse.json(
      { error: 'CLIENTE CON DEUDA PENDIENTE NO SE PUEDE ELIMINAR' },
      { status: 409 }
    )
  }

  const { error } = await supabaseAdmin
    .from('clientes')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}