'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Sesion {
  id: number
  nombre: string
  username: string
  rol: string
  permisos: Record<string, boolean>
}

const MODULOS = [
  { nombre: 'Vender', icono: '🛒', ruta: '/vender' },
  { nombre: 'Clientes y Créditos', icono: '👤', ruta: '/clientes' },
  { nombre: 'Productos', icono: '📦', ruta: '/productos/nuevo' },
  { nombre: 'Inventario', icono: '🗃️', ruta: '/productos' },
  { nombre: 'Configuración', icono: '⚙️', ruta: '/configuracion' },
  { nombre: 'Reportes', icono: '📊', ruta: '/reportes' },
]

function obtenerFechaLocal(): string {
  const ahora = new Date()
  const año = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${año}-${mes}-${dia}`
}

function formatearBs(numero: number): string {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numero)
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [tasaDolar, setTasaDolar] = useState(0)
  const [editandoTasa, setEditandoTasa] = useState(false)
  const [nuevoPrecioTasa, setNuevoPrecioTasa] = useState('')

  useEffect(() => {
    const guardada = localStorage.getItem('sesion_usuario')
    if (guardada) {
      try {
        setSesion(JSON.parse(guardada))
      } catch {}
    }
  }, [])

  useEffect(() => {
    const cargarTasa = async () => {
      const hoy = obtenerFechaLocal()
      const res = await fetch(`/api/tasas-diarias?fecha=${hoy}`)
      const { data } = await res.json()
      if (data) setTasaDolar(data.valor)
    }
    cargarTasa()
  }, [])

  const guardarNuevaTasa = async () => {
    const hoy = obtenerFechaLocal()
    const valorNumerico = parseFloat(nuevoPrecioTasa)
    if (isNaN(valorNumerico)) return

    const res = await fetch('/api/tasas-diarias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha: hoy, valor: valorNumerico }),
    })

    if (res.ok) {
      setTasaDolar(valorNumerico)
      setEditandoTasa(false)
      setNuevoPrecioTasa('')
    window.dispatchEvent(new CustomEvent('tasaActualizada', { detail: valorNumerico })) // <-- AGREGAR
  } else {
    const { error } = await res.json()
    alert('Error al guardar la tasa: ' + error)
  }
}

  function cerrarSesion() {
    localStorage.removeItem('sesion_usuario')
    router.push('/login')
  }

  const esAdmin = sesion?.rol === 'admin'
  const puedeCambiarTasa = esAdmin || !!sesion?.permisos?.cambiar_tasa

  function esActiva(ruta: string) {
    if (ruta === '/productos') return pathname === '/productos'
    if (ruta === '/productos/nuevo') return pathname === '/productos/nuevo'
    return pathname?.startsWith(ruta)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div style={estilos.marcaBar}>
        <div style={estilos.marcaIzq}>
          <img src="/logo.png" alt="Duragonz" style={estilos.logoImg} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 2.1 }}>
            <span style={estilos.marcaNombre}>DURAGONZ</span>
            <span style={estilos.marcaSubtitulo}>PUNTO DE VENTA</span>
          </div>
        </div>
        <div style={estilos.marcaDer}>
          <div style={estilos.tasaTopbar}>
            <span style={estilos.tasaLabel}>Tasa BCV</span>
            {puedeCambiarTasa && editandoTasa ? (
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.01"
                  value={nuevoPrecioTasa}
                  onChange={(e) => setNuevoPrecioTasa(e.target.value)}
                  style={{ width: '70px', padding: '3px', fontSize: '13px' }}
                  autoFocus
                />
                <button onClick={guardarNuevaTasa} style={{ cursor: 'pointer' }}>✓</button>
              </div>
            ) : (
              <span
                onClick={() => puedeCambiarTasa && setEditandoTasa(true)}
                style={{ ...estilos.tasaValor, cursor: puedeCambiarTasa ? 'pointer' : 'default' }}
              >
                Bs {formatearBs(tasaDolar)}{puedeCambiarTasa ? ' ✎' : ''}
              </span>
            )}
          </div>
          {sesion && (
            <span style={estilos.usuario}>
              {sesion.nombre} <span style={{ color: '#9ca3af' }}>({sesion.rol === 'admin' ? 'Administrador' : sesion.rol})</span>
            </span>
          )}
          <button onClick={cerrarSesion} style={estilos.botonSalir}>Salir</button>
        </div>
      </div>

      <div style={estilos.tabs}>
        {MODULOS.map((m) => (
          <button
            key={m.ruta}
            onClick={() => router.push(m.ruta)}
            style={{
              ...estilos.tab,
              ...(esActiva(m.ruta) ? estilos.tabActivo : {}),
            }}
          >
            <span style={{ fontSize: '15px' }}>{m.icono}</span> {m.nombre}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

const estilos: Record<string, React.CSSProperties> = {
  marcaBar: {
    background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
    borderBottom: '1px solid #d1d5db',
    color: '#111827',
    padding: '8px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  marcaIzq: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoImg: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    objectFit: 'cover' as const,
  },
  marcaSubtitulo: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#06692a',
    letterSpacing: '0.5px',
  },
  marcaNombre: {
    fontSize: '25px',
    fontWeight: 800,
    letterSpacing: '0.3px',
    lineHeight: 1.1,
  },
  marcaDer: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  tasaTopbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    padding: '4px 12px',
    borderRadius: '8px',
    fontSize: '13px',
  },
  tasaLabel: {
    color: '#6b7280',
  },
  tasaValor: {
    fontWeight: 700,
    color: '#0d0e0d',
  },
  usuario: {
    fontSize: '13px',
    fontWeight: 600,
  },
  botonSalir: {
    background: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '6px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabs: {
    background: '#e5e7eb',
    borderBottom: '1px solid #cbd5e1',
    display: 'flex',
    alignItems: 'stretch',
    padding: '4px 8px',
    gap: '4px',
    flexShrink: 0,
    overflowX: 'auto',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#374151',
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tabActivo: {
    background: 'white',
    color: '#059669',
    borderColor: '#059669',
    boxShadow: '0 1px 3px rgba(5,150,105,0.25)',
  },
}