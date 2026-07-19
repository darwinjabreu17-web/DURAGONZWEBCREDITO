import { createClient } from '@supabase/supabase-js'

export const supabaseLicencias = createClient(
  process.env.LICENCIAS_SUPABASE_URL!,
  process.env.LICENCIAS_SUPABASE_SECRET_KEY!
)