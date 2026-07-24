import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: trae la deuda pendiente de un cliente, calculada con precios ACTUALES
// Uso: /api/creditos-pendientes?cliente_id=5
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clienteId = searchParams.get('cliente_id')

  if (!clienteId) {
    return NextResponse.json({ error: 'Falta cliente_id' }, { status: 400 })
  }

  // Traemos los pedidos del cliente con sus items pendientes y el producto
  // (para tener precio y costo actuales de cada uno)
  const { data: pedidos, error } = await supabaseAdmin
    .from('creditos_pedidos')
    .select(`
      id,
      created_at,
      saldado,
      creditos_pedido_items (
        id,
        producto_id,
        codigo_producto,
        nombre_producto,
        cantidad_original,
        cantidad_pendiente,
        productos ( precio, precio_costo )
      )
    `)
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let deudaTotalUsd = 0
  let gananciaPotencialUsd = 0

  const pedidosConTotales = (pedidos || []).map((pedido: any) => {
    let totalPedidoUsd = 0
    const items = (pedido.creditos_pedido_items || [])
      .filter((it: any) => Number(it.cantidad_pendiente) > 0)
      .map((it: any) => {
        const precioActual = Number(it.productos?.precio || 0)
        const costoActual = Number(it.productos?.precio_costo || 0)
        const cantidadPendiente = Number(it.cantidad_pendiente)
        const subtotalActual = cantidadPendiente * precioActual
        const gananciaItem = cantidadPendiente * (precioActual - costoActual)

        totalPedidoUsd += subtotalActual
        deudaTotalUsd += subtotalActual
        gananciaPotencialUsd += gananciaItem

        return {
          ...it,
          precio_actual: precioActual,
          subtotal_actual: subtotalActual,
        }
      })

    return { ...pedido, items, total_pedido_usd: totalPedidoUsd }
  }).filter((p: any) => p.items.length > 0)

  return NextResponse.json({
    pedidos: pedidosConTotales,
    deuda_total_usd: deudaTotalUsd,
    ganancia_potencial_usd: gananciaPotencialUsd,
  })
}

// POST: crea un pedido nuevo a crédito (cuando facturas "a crédito" en Vender)
// Body: { cliente_id, vendedor_id, vendedor_nombre, items: [{producto_id, codigo_producto, nombre_producto, cantidad}] }
export async function POST(request: Request) {
  const body = await request.json()
  const { cliente_id, vendedor_id, vendedor_nombre, items } = body

  if (!cliente_id || !items || items.length === 0) {
    return NextResponse.json({ error: 'Faltan datos del pedido a crédito' }, { status: 400 })
  }

  const { data: pedido, error: errorPedido } = await supabaseAdmin
    .from('creditos_pedidos')
    .insert({ cliente_id, vendedor_id, vendedor_nombre })
    .select()
    .single()

  if (errorPedido) return NextResponse.json({ error: errorPedido.message }, { status: 500 })

  const itemsParaInsertar = items.map((it: any) => ({
    pedido_id: pedido.id,
    producto_id: it.producto_id,
    codigo_producto: it.codigo_producto,
    nombre_producto: it.nombre_producto,
    cantidad_original: it.cantidad,
    cantidad_pendiente: it.cantidad,
  }))

  const { error: errorItems } = await supabaseAdmin
    .from('creditos_pedido_items')
    .insert(itemsParaInsertar)

  if (errorItems) {
    return NextResponse.json({ error: errorItems.message, pedido_id: pedido.id }, { status: 500 })
  }

  return NextResponse.json({ data: pedido })
}