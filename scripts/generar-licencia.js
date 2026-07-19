
const { sign } = require('crypto')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

const privateKey = process.env.LICENCIA_PRIVATE_KEY.replace(/\\n/g, '\n')

const clienteNombre = process.argv[2] || 'Cliente sin nombre'
const tipo = process.argv[3] || 'ilimitada'
const maxDispositivos = parseInt(process.argv[4] || '2', 10)
const fechaExpiracion = process.argv[5] || null

const azar = Math.random().toString(36).substring(2, 8).toUpperCase()
const codigoBase = `DGZ-${azar}`

const payload = `${codigoBase}|${tipo}|${maxDispositivos}|${fechaExpiracion || 'null'}`

const firma = sign(null, Buffer.from(payload), privateKey).toString('base64')

const sql = `insert into licencias (codigo, cliente_nombre, tipo, max_dispositivos, fecha_expiracion, firma, activa, ultimo_mantenimiento) values ('${codigoBase}', '${clienteNombre}', '${tipo}', ${maxDispositivos}, ${fechaExpiracion ? `'${fechaExpiracion}'` : 'null'}, '${firma}', true, now());`

fs.writeFileSync('scripts/ultima-licencia.sql', sql)

console.log('Codigo generado:', codigoBase)
console.log('El SQL para pegar en Supabase quedo guardado en: scripts/ultima-licencia.sql')
console.log('Abre ese archivo en VS Code y copia todo su contenido.')