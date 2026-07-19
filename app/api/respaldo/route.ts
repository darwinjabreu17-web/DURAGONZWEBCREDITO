import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Orden de las tablas respetando las relaciones (padres antes que hijos).
// Si agregas una tabla nueva al sistema en el futuro, agrégala aquí también
// para que quede incluida en los respaldos.
const TABLAS = [
  'clientes',
  'productos',
  'ventas',
  'venta_items',
  'creditos_abonos',
  'tasas_diarias',
  'historial_cierres',
  'reportes_diarios',
  'configuracion_ticket',
]

// GET: exporta todas las tablas como un solo JSON descargable
export async function GET() {
  try {
    const tablas: Record<string, any[]> = {}

    for (const tabla of TABLAS) {
      const { data, error } = await supabaseAdmin.from(tabla).select('*')
      if (error) {
        return NextResponse.json(
          { error: `Error exportando la tabla '${tabla}': ${error.message}` },
          { status: 500 }
        )
      }
      tablas[tabla] = data || []
    }

    return NextResponse.json({
      version: 1,
      exportado_en: new Date().toISOString(),
      tablas,
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: err.message }, { status: 500 })
  }
}

// POST: importa un respaldo. ADVERTENCIA: reemplaza TODOS los datos actuales
// de las tablas incluidas en el respaldo por los datos del archivo.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const tablas = body?.tablas

    if (!tablas || typeof tablas !== 'object') {
      return NextResponse.json(
        { error: 'El archivo de respaldo no tiene el formato esperado (falta "tablas").' },
        { status: 400 }
      )
    }

    // 1. Borra los datos actuales, en orden inverso (hijos primero) para no
    //    romper ninguna relación de llave foránea.
    const ordenBorrado = [...TABLAS].reverse()
    for (const tabla of ordenBorrado) {
      const { error } = await supabaseAdmin.from(tabla).delete().not('id', 'is', null)
      if (error) {
        return NextResponse.json(
          { error: `Error limpiando la tabla '${tabla}' antes de importar: ${error.message}` },
          { status: 500 }
        )
      }
    }

    // 2. Inserta los datos del respaldo, en orden correcto (padres primero).
    for (const tabla of TABLAS) {
      const filas = tablas[tabla]
      if (Array.isArray(filas) && filas.length > 0) {
        const { error } = await supabaseAdmin.from(tabla).insert(filas)
        if (error) {
          return NextResponse.json(
            { error: `Error restaurando la tabla '${tabla}': ${error.message}` },
            { status: 500 }
          )
        }
      }
    }

    // 3. Corrige los contadores de ID automáticos (requiere la función
    //    reset_secuencias() creada una sola vez en Supabase). Si por algún
    //    motivo no existe, no hacemos fallar la importación por esto.
    const { error: rpcError } = await supabaseAdmin.rpc('reset_secuencias')
    if (rpcError) {
      return NextResponse.json({
        ok: true,
        advertencia:
          'El respaldo se restauró, pero no se pudo corregir el contador de IDs automático (' +
          rpcError.message +
          '). Es posible que la próxima venta/cliente nuevo que agregues falle. Verifica que la función reset_secuencias() exista en Supabase.',
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: err.message }, { status: 500 })
  }
}
