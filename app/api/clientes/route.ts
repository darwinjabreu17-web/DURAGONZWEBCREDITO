import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: lista de clientes junto con sus saldos (vista saldo_clientes)
export async function GET() {
  const { data: clientesData, error: errClientes } = await supabaseAdmin
    .from('clientes')
    .select('*')
    .order('nombre', { ascending: true })

  if (errClientes) return NextResponse.json({ error: errClientes.message }, { status: 500 })

  const { data: saldosData, error: errSaldos } = await supabaseAdmin
    .from('saldo_clientes')
    .select('*')

  if (errSaldos) return NextResponse.json({ error: errSaldos.message }, { status: 500 })

  return NextResponse.json({ clientes: clientesData || [], saldos: saldosData || [] })
}

// POST: crear un cliente nuevo
export async function POST(request: Request) {
  const body = await request.json()

  const { error } = await supabaseAdmin.from('clientes').insert(body)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}