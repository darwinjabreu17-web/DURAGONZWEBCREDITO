import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: lista de usuarios (sin password)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, nombre, username, rol, permisos, activo')
    .order('rol', { ascending: false })
    .order('nombre', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST: crear un usuario nuevo
export async function POST(request: Request) {
  const body = await request.json()

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert(body)
    .select('id, nombre, username, rol, permisos, activo')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}