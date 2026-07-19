import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const body = await request.json()
  const items = body.items // [{ id, cantidad }, ...]

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Faltan productos' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.rpc('descontar_stock_venta', { items })

  if (error) {
    const match = error.message.match(/STOCK_INSUFICIENTE:(\d+):(.*?):(-?\d+(\.\d+)?)/)
    if (match) {
      return NextResponse.json({
        error: `Stock insuficiente para "${match[2]}". Disponible: ${match[3]}`,
        stockInsuficiente: true,
        productoId: parseInt(match[1]),
        nombreProducto: match[2],
        stockDisponible: parseFloat(match[3]),
      }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}