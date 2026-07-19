import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// DELETE: eliminar un ticket pendiente (cuando se retoma y se cobra)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error } = await supabaseAdmin
    .from('tickets_pendientes')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}