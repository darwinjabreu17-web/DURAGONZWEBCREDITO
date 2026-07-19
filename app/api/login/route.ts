import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const { username, password } = await request.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, nombre, username, rol, permisos, activo, password')
    .ilike('username', username)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'USUARIO O CLAVE INCORRECTOS' }, { status: 401 })

  // ⚠️ Comparación en texto plano — pendiente migrar a bcrypt más adelante
  if (data.password !== password) {
    return NextResponse.json({ error: 'USUARIO O CLAVE INCORRECTOS' }, { status: 401 })
  }

  if (!data.activo) {
    return NextResponse.json({ error: 'Este usuario está dado de baja. Contacta al administrador.' }, { status: 403 })
  }

  const { password: _pw, ...usuarioSinPassword } = data
  return NextResponse.json({ data: usuarioSinPassword })
}