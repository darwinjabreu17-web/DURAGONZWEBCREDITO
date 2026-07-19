'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { resolverPrecioDesdeTexto } from '@/lib/precio'

interface Sesion {
  id: number
  nombre: string
  username: string
  rol: string
  permisos: Record<string, boolean>
}

export default function NuevoProducto() {
  const router = useRouter()

  // ---- Protección: exige sesión y permiso 'crear_productos' (o admin) ----
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [verificandoSesion, setVerificandoSesion] = useState(true)

  useEffect(() => {
    const guardada = localStorage.getItem('sesion_usuario')
    if (!guardada) {
      router.push('/login')
      return
    }
    let datos: Sesion
    try {
      datos = JSON.parse(guardada) as Sesion
    } catch {
      router.push('/login')
      return
    }
    const esAdmin = datos.rol === 'admin'
    if (!esAdmin && !datos.permisos?.crear_productos) {
      alert('No tienes permiso para crear productos')
      router.push('/dashboard')
      return
    }
    setSesion(datos)
    setVerificandoSesion(false)
  }, [router])

  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [precioCosto, setPrecioCosto] = useState('')
  const [precio, setPrecio] = useState('')
  const [precioMayoreo, setPrecioMayoreo] = useState('')
  const [stock, setStock] = useState('')
  const [stockMinimo, setStockMinimo] = useState('5')
  const [guardando, setGuardando] = useState(false)

  // Se ejecuta al salir del campo "Precio Detalle": si escribieron un %,
  // lo convierte al monto final usando el precio de costo actual.
  const manejarBlurPrecio = () => {
    if (!precio) return
    const costo = parseFloat(precioCosto) || 0
    const resultado = resolverPrecioDesdeTexto(precio, costo)
    setPrecio(resultado.toString())
  }

  const manejarBlurPrecioMayoreo = () => {
    if (!precioMayoreo) return
    const costo = parseFloat(precioCosto) || 0
    const resultado = resolverPrecioDesdeTexto(precioMayoreo, costo)
    setPrecioMayoreo(resultado.toString())
  }

  // Enter también dispara el cálculo (sin enviar el formulario de una vez)
  const manejarEnterPrecio = (e: React.KeyboardEvent<HTMLInputElement>, tipo: 'detalle' | 'mayoreo') => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (tipo === 'detalle') manejarBlurPrecio()
    else manejarBlurPrecioMayoreo()
  }

  const manejarGuardar = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!codigo.trim() || !nombre.trim() || !precioCosto || !precio || !stock) {
      alert('Por favor, rellene todos los campos obligatorios.')
      return
    }

    setGuardando(true)

    const res = await fetch('/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        precio_costo: precioCosto,
        precio: precio,
        precio_mayoreo: precioMayoreo,
        stock: stock,
        stock_minimo: stockMinimo,
      })
    })

    if (!res.ok) {
      const { error } = await res.json()
      alert('Error al registrar el producto: ' + error)
      setGuardando(false)
      return
    }

    alert('¡Producto registrado con éxito! ✅')

    setCodigo('')
    setNombre('')
    setPrecioCosto('')
    setPrecio('')
    setPrecioMayoreo('')
    setStock('')
    setStockMinimo('5')
    setGuardando(false)

    router.push('/dashboard')
  }

  if (verificandoSesion) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
        Verificando sesión...
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.titulo}>DURAGONZ V1.0</h1>
          <p style={styles.subtitulo}>Módulo de Productos / Registrar Nuevo</p>
        </div>
        <div>
          <button
            onClick={() => router.push('/dashboard')}
            style={styles.botonVolver}
          >
            Volver al Menú
          </button>
        </div>
      </div>

      <div style={styles.cardFormulario}>
        <h2 style={styles.seccionTitulo}>⚙️ DATOS DEL PRODUCTO</h2>

        <form onSubmit={manejarGuardar}>
          <div style={styles.row}>
            <div style={styles.campoForm}>
              <label style={styles.label}>Código de Barra / Único *</label>
              <input
                type="text"
                placeholder="Ej: 750123456789"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                style={styles.inputForm}
                required
                autoFocus
              />
            </div>

            <div style={styles.campoForm}>
              <label style={styles.label}>Nombre del Producto *</label>
              <input
                type="text"
                placeholder="Ej: Harina Pan 1kg"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                style={styles.inputForm}
                required
              />
            </div>
          </div>

          <div style={styles.rowCuatroColumnas}>
            <div style={styles.campoForm}>
              <label style={styles.label}>Precio Costo ($) *</label>
              <input
                type="number"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={precioCosto}
                onChange={(e) => setPrecioCosto(e.target.value)}
                style={styles.inputForm}
                required
              />
            </div>

            <div style={styles.campoForm}>
              <label style={styles.label}>Precio Detalle ($) *</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00 o 30%"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                onBlur={manejarBlurPrecio}
                onKeyDown={(e) => manejarEnterPrecio(e, 'detalle')}
                style={styles.inputForm}
                required
              />
              <span style={styles.ayudaCampo}>Escribe un monto o un % sobre el costo (ej. 30%)</span>
            </div>

            <div style={styles.campoForm}>
              <label style={styles.label}>Precio Mayoreo ($)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00 o 20%"
                value={precioMayoreo}
                onChange={(e) => setPrecioMayoreo(e.target.value)}
                onBlur={manejarBlurPrecioMayoreo}
                onKeyDown={(e) => manejarEnterPrecio(e, 'mayoreo')}
                style={styles.inputForm}
              />
            </div>

            <div style={styles.campoForm}>
              <label style={styles.label}>Stock Inicial *</label>
              <input
                type="number"
                placeholder="0"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                style={styles.inputForm}
                required
              />
            </div>
          </div>

          <div style={styles.rowCuatroColumnas}>
            <div style={styles.campoForm}>
              <label style={styles.label}>Stock Mínimo (para alerta de stock bajo)</label>
              <input
                type="number"
                placeholder="5"
                min="0"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
                style={styles.inputForm}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button
              type="submit"
              disabled={guardando}
              style={{
                ...styles.botonGuardar,
                opacity: guardando ? 0.7 : 1
              }}
            >
              {guardando ? 'Guardando...' : 'Guardar Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: {
    padding: '24px',
    backgroundColor: '#f9fafb',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    backgroundColor: 'white',
    color: '#111827',
    padding: '24px',
    borderRadius: '16px',
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb'
  },
  titulo: {
    margin: 0,
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827'
  },
  subtitulo: {
    margin: '4px 0 0 0',
    fontSize: '14px',
    color: '#6b7280'
  },
  botonVolver: {
    backgroundColor: 'white',
    color: '#4b5563',
    border: '1px solid #e5e7eb',
    padding: '10px 20px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px',
    transition: 'all 0.2s',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  },
  cardFormulario: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb',
    borderTop: '4px solid #2563eb'
  },
  seccionTitulo: {
    margin: '0 0 20px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#374151',
    letterSpacing: '0.5px'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px',
    marginBottom: '16px'
  },
  rowCuatroColumnas: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
    marginBottom: '20px'
  },
  campoForm: {
    display: 'flex',
    flexDirection: 'column' as const
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#4b5563',
    marginBottom: '6px'
  },
  inputForm: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    backgroundColor: '#fff',
    color: '#111827',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  },
  ayudaCampo: {
    fontSize: '11px',
    color: '#9ca3af',
    marginTop: '4px'
  },
  botonGuardar: {
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
    transition: 'all 0.2s'
  }
}
