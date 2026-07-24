import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// DELETE: elimina un pedido a crédito.
// Si el pedido no tiene abonos, se borra directo.
// Si ya tiene abonos aplicados, la función SQL devuelve un error especial
// "SOBRANTE:<monto>" y esta ruta responde 409 con ese monto para que el
// frontend muestre el modal de "devolver / dejar como ganancia".
// Para confirmar la decisión, se vuelve a llamar esta misma ruta mandando
// { decision: 'devolver' } o { decision: 'ganancia', tasaDolar, vendedorId, vendedorNombre }.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const pedidoId = params.id

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const { decision, tasaDolar, vendedorId, vendedorNombre } = body

  const { data, error } = await supabaseAdmin.rpc('eliminar_pedido_credito', {
    p_pedido_id: pedidoId,
    p_decision: decision ?? null,
    p_tasa_dolar: tasaDolar ?? null,
    p_vendedor_id: vendedorId ?? null,
    p_vendedor_nombre: vendedorNombre ?? null,
  })

  if (error) {
    const msg = error.message || ''
    if (msg.includes('SOBRANTE:')) {
      const monto = parseFloat(msg.split('SOBRANTE:')[1])
      return NextResponse.json({ sobrante: true, montoSobrante: monto }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const resultado = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ success: true, ...resultado })
}
