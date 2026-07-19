import { NextResponse } from 'next/server'
import { verify } from 'crypto'
import { supabaseLicencias } from '@/lib/supabase-licencias'

const publicKey = process.env.LICENCIA_PUBLIC_KEY!.replace(/\\n/g, '\n')

function firmaValida(licencia: any): boolean {
  if (!licencia.firma) return false

  const fechaExpiracion = licencia.fecha_expiracion
    ? new Date(licencia.fecha_expiracion).toISOString().split('T')[0]
    : null
  const payload = `${licencia.codigo}|${licencia.tipo}|${licencia.max_dispositivos}|${fechaExpiracion || 'null'}`

  try {
    return verify(null, Buffer.from(payload), publicKey, Buffer.from(licencia.firma, 'base64'))
  } catch {
    return false
  }
}

function calcularAvisoMantenimiento(ultimoMantenimiento: string): boolean {
  const fechaUltimo = new Date(ultimoMantenimiento)
  const ahora = new Date()

  let meses = (ahora.getFullYear() - fechaUltimo.getFullYear()) * 12
  meses += ahora.getMonth() - fechaUltimo.getMonth()
  if (ahora.getDate() < fechaUltimo.getDate()) meses -= 1

  return meses >= 8
}

export async function POST(request: Request) {
  const { codigo, dispositivo_uuid, nombre_dispositivo } = await request.json()
  const codigoLimpio = codigo?.trim().toUpperCase()

  if (!codigoLimpio || !dispositivo_uuid) {
    return NextResponse.json({ valido: false, error: 'Faltan datos' }, { status: 400 })
  }

  const { data: licencia, error: errorLicencia } = await supabaseLicencias
    .from('licencias')
    .select('*')
    .eq('codigo', codigoLimpio)
    .single()

  if (errorLicencia || !licencia) {
    return NextResponse.json({ valido: false, error: 'Código de licencia no encontrado' }, { status: 404 })
  }

  if (!firmaValida(licencia)) {
    return NextResponse.json({ valido: false, error: 'Licencia inválida' }, { status: 403 })
  }

  if (!licencia.activa) {
    return NextResponse.json({ valido: false, error: 'Esta licencia está desactivada' }, { status: 403 })
  }

  if (licencia.tipo === 'tiempo' && licencia.fecha_expiracion) {
    if (new Date(licencia.fecha_expiracion) < new Date()) {
      return NextResponse.json({ valido: false, error: 'Esta licencia ha expirado' }, { status: 403 })
    }
  }

  const avisoMantenimiento = calcularAvisoMantenimiento(licencia.ultimo_mantenimiento)

  const { data: dispositivoExistente } = await supabaseLicencias
    .from('dispositivos_licencia')
    .select('*')
    .eq('licencia_id', licencia.id)
    .eq('dispositivo_uuid', dispositivo_uuid)
    .single()

  if (dispositivoExistente) {
    await supabaseLicencias
      .from('dispositivos_licencia')
      .update({ ultima_conexion: new Date().toISOString(), nombre_dispositivo })
      .eq('id', dispositivoExistente.id)

    return NextResponse.json({ valido: true, licencia, avisoMantenimiento })
  }

  const { count } = await supabaseLicencias
    .from('dispositivos_licencia')
    .select('*', { count: 'exact', head: true })
    .eq('licencia_id', licencia.id)

  if ((count || 0) >= licencia.max_dispositivos) {
    return NextResponse.json({
      valido: false,
      error: `Esta licencia ya alcanzó el límite de ${licencia.max_dispositivos} dispositivos`
    }, { status: 403 })
  }

  await supabaseLicencias
    .from('dispositivos_licencia')
    .insert({
      licencia_id: licencia.id,
      dispositivo_uuid,
      nombre_dispositivo: nombre_dispositivo || 'Sin nombre',
    })

  return NextResponse.json({ valido: true, licencia, avisoMantenimiento })
}