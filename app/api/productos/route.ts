import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: lista de productos. Soporta varios modos:
// - sin parámetros              -> todos los productos, ordenados por nombre (comportamiento original)
// - ?stockBajo=true             -> solo productos donde stock <= su propio stock_minimo
// - ?ids=1,2,3                  -> solo esos productos puntuales (usado por Vender para revisar
//                                   stock actual de lo que hay en el carrito, sin traer todo el catálogo)
// - ?pagina=1&limite=30         -> paginado, para catálogos grandes
// - ?buscar=texto                -> filtra por nombre o código (se puede combinar con pagina/limite)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const stockBajo = searchParams.get('stockBajo')
  const idsParam = searchParams.get('ids')
  const pagina = searchParams.get('pagina')
  const buscar = searchParams.get('buscar')?.trim()

  if (stockBajo === 'true') {
    const { data, error } = await supabaseAdmin
      .from('productos')
      .select('id, codigo, nombre, precio, precio_mayoreo, precio_costo, stock, stock_minimo')
      .order('stock', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const bajos = (data || []).filter(p => p.stock <= p.stock_minimo)
    return NextResponse.json({ data: bajos })
  }

  // Trae solo un puñado de productos puntuales por su id. Pensado para
  // cuando ya sabes exactamente cuáles necesitas (ej. revisar el stock
  // actual de lo que hay en el carrito de una venta) y no tiene sentido
  // traer el catálogo completo solo para eso.
  if (idsParam) {
    const ids = idsParam
      .split(',')
      .map(v => parseInt(v.trim(), 10))
      .filter(v => !isNaN(v))

    if (ids.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const { data, error } = await supabaseAdmin
      .from('productos')
      .select('id, codigo, nombre, precio, precio_mayoreo, precio_costo, stock, stock_minimo')
      .in('id', ids)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  // Modo paginado: se activa si viene "pagina" o "buscar" en la URL.
  // El catálogo (app/productos/page.tsx) siempre usa este modo.
  if (pagina || buscar) {
    const paginaActual = Math.max(parseInt(pagina || '1', 10) || 1, 1)
    const limite = Math.min(Math.max(parseInt(searchParams.get('limite') || '30', 10) || 30, 1), 100)
    const desde = (paginaActual - 1) * limite
    const hasta = desde + limite - 1

    let query = supabaseAdmin
      .from('productos')
      .select('id, codigo, nombre, precio, precio_mayoreo, precio_costo, stock, stock_minimo', { count: 'exact' })
      .order('nombre', { ascending: true })
      .range(desde, hasta)

    if (buscar) {
      query = query.or(`nombre.ilike.%${buscar}%,codigo.ilike.%${buscar}%`)
    }

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({
      data,
      total: count || 0,
      pagina: paginaActual,
      totalPaginas: Math.max(Math.ceil((count || 0) / limite), 1),
    })
  }

  // Comportamiento original: trae todos los productos de una vez.
  // La usa el módulo de Vender al abrir la pantalla (una sola vez por
  // turno de caja, para que la búsqueda y el escaneo respondan al
  // instante sin depender de la red en cada producto).
  const { data, error } = await supabaseAdmin
    .from('productos')
    .select('id, codigo, nombre, precio, precio_mayoreo, precio_costo, stock, stock_minimo')
    .order('nombre', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST: crear un producto nuevo
export async function POST(request: Request) {
  const body = await request.json()
  const { codigo, nombre, precio_costo, precio, precio_mayoreo, stock, stock_minimo } = body

  if (!codigo || !nombre || precio_costo === undefined || precio === undefined || stock === undefined) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('productos')
    .insert([
      {
        codigo: String(codigo).trim(),
        nombre: String(nombre).trim(),
        precio_costo: parseFloat(precio_costo) || 0,
        precio: parseFloat(precio) || 0,
        precio_mayoreo: parseFloat(precio_mayoreo) || 0,
        stock: parseInt(stock) || 0,
        stock_minimo: stock_minimo !== undefined && stock_minimo !== '' ? parseInt(stock_minimo) : 5,
      }
    ])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
