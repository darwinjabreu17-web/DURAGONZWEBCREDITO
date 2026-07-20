'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

function formatearHaceTiempo(fechaIso: string): string {
  const fecha = new Date(fechaIso)
  const ahora = new Date()
  const diffMin = Math.floor((ahora.getTime() - fecha.getTime()) / 60000)

  if (diffMin < 1) return 'hace un momento'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHoras = Math.floor(diffMin / 60)
  if (diffHoras < 24) return `hace ${diffHoras} h`
  return fecha.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' })
}

interface Sesion {
  id: number
  nombre: string
  username: string
  rol: string
  permisos: Record<string, boolean>
}

interface Venta {
  id: number
  created_at: string
  total_usd: number
  pago_credito_usd?: number
  cliente_id: number | null
  clientes?: { nombre: string } | null
}

interface ProductoStockBajo {
  id: number
  nombre: string
  stock: number
}

export default function Dashboard() {
  const router = useRouter()
  const [tasaDolar, setTasaDolar] = useState(0)
  const [editando, setEditando] = useState(false)
  const [nuevoPrecio, setNuevoPrecio] = useState('')
  const [ultimaVenta, setUltimaVenta] = useState<Venta | null>(null)
  const [ultimaVentaCredito, setUltimaVentaCredito] = useState<Venta | null>(null)
  const [productosStockBajo, setProductosStockBajo] = useState<ProductoStockBajo[]>([])
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [verificandoSesion, setVerificandoSesion] = useState(true)

  useEffect(() => {
    const guardada = localStorage.getItem('sesion_usuario')
    if (!guardada) {
      router.push('/login')
      return
    }
    try {
      const datos = JSON.parse(guardada) as Sesion
      setSesion(datos)
    } catch {
      router.push('/login')
      return
    }
    setVerificandoSesion(false)
  }, [router])

  useEffect(() => {
    cargarTasa()
    cargarResumenDashboard()
  }, [])

  async function cargarTasa() {
    const hoy = obtenerFechaLocal()
    const res = await fetch(`/api/tasas-diarias?fecha=${hoy}`)
    const { data } = await res.json()
    if (data) setTasaDolar(data.valor)
  }

  async function cargarResumenDashboard() {
    try {
      const [resVenta, resCredito, resStock] = await Promise.all([
        fetch('/api/ventas?ultima=true'),
        fetch('/api/ventas?ultimaCredito=true'),
        fetch('/api/productos?stockBajo=true')
      ])
      const { data: venta } = await resVenta.json()
      const { data: credito } = await resCredito.json()
      const { data: stockBajo } = await resStock.json()

      setUltimaVenta(venta || null)
      setUltimaVentaCredito(credito || null)
      setProductosStockBajo(stockBajo || [])
    } catch (err) {
      console.error('Error cargando resumen del dashboard:', err)
    }
  }

  async function guardarNuevoPrecio() {
    const hoy = obtenerFechaLocal()
    const valorNumerico = parseFloat(nuevoPrecio)

    if (isNaN(valorNumerico)) return

    const res = await fetch('/api/tasas-diarias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha: hoy, valor: valorNumerico })
    })

    if (res.ok) {
      setTasaDolar(valorNumerico)
      setEditando(false)
      setNuevoPrecio('')
    } else {
      const { error } = await res.json()
      alert("Error al guardar en base de datos: " + error)
    }
  }

  function cerrarSesion() {
    localStorage.removeItem('sesion_usuario')
    router.push('/login')
  }

  const esAdmin = sesion?.rol === 'admin'
  const permisos = sesion?.permisos || {}
  const puedeCambiarTasa = esAdmin || !!permisos.cambiar_tasa

  const todosLosBotones = [
    { nombre: 'VENDER', icono: '💰', ruta: '/vender', color: '#059669', atajo: 'F1', visible: true },
    { nombre: 'PRODUCTOS', icono: '📦', ruta: '/productos', color: '#2563eb', atajo: 'F2', visible: esAdmin || permisos.crear_productos || permisos.editar_productos || permisos.editar_precios || permisos.editar_stock },
    { nombre: 'CLIENTES Y CRÉDITOS', icono: '👥', ruta: '/clientes', color: '#7c3aed', atajo: 'F3', visible: esAdmin || permisos.clientes_factura || permisos.clientes_credito },
    { nombre: 'REPORTES', icono: '📊', ruta: '/reportes', color: '#0891b2', atajo: 'F5', visible: esAdmin || permisos.ver_reporte || permisos.ver_ganancia || permisos.cerrar_caja },
    { nombre: 'CONFIGURACIÓN', icono: '⚙️', ruta: '/configuracion', color: '#4b5563', atajo: 'F6', visible: esAdmin },
  ]

  const botones = todosLosBotones.filter(b => b.visible)

  useEffect(() => {
    const manejarTecla = (e: KeyboardEvent) => {
      const boton = botones.find(b => b.atajo === e.key)
      if (boton) {
        e.preventDefault()
        router.push(boton.ruta)
      }
    }
    window.addEventListener('keydown', manejarTecla)
    return () => window.removeEventListener('keydown', manejarTecla)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion])

  // Estilos solo para pantallas angostas (celulares y tablets) — no afectan la vista de PC.
  const estiloDashboardMovil = (
    <style jsx global>{`
      @media (max-width: 768px) {
        .dashboard-container-mobil {
          padding: 14px !important;
        }
        .dashboard-header-mobil {
          padding: 16px 18px !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 14px !important;
        }
        .dashboard-header-mobil > div:last-child {
          width: 100% !important;
          justify-content: space-between !important;
        }
        .dashboard-titulo-mobil {
          font-size: 21px !important;
        }
        .dashboard-resumen-mobil {
          grid-template-columns: 1fr 1fr !important;
          gap: 10px !important;
          margin-bottom: 20px !important;
        }
        .dashboard-card-resumen-mobil {
          padding: 12px !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 8px !important;
        }
        .dashboard-card-resumen-mobil .dashboard-card-icono-mobil {
          width: 38px !important;
          height: 38px !important;
          font-size: 18px !important;
        }
        .dashboard-card-resumen-mobil .dashboard-card-valor-mobil {
          font-size: 18px !important;
        }
        .dashboard-card-led-mobil {
          grid-column: 1 / -1 !important;
          padding: 14px !important;
        }
        .dashboard-led-texto-mobil {
          font-size: 14px !important;
        }
        .dashboard-menu-mobil {
          grid-template-columns: 1fr 1fr !important;
          gap: 12px !important;
        }
        .dashboard-boton-menu-mobil {
          padding: 20px 10px !important;
          gap: 8px !important;
        }
        .dashboard-icono-boton-mobil {
          font-size: 30px !important;
        }
        .dashboard-texto-boton-mobil {
          font-size: 12px !important;
        }
        .dashboard-atajo-badge-mobil {
          display: none !important;
        }
      }
    `}</style>
  )

  if (verificandoSesion) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
        Verificando sesión...
      </div>
    )
  }

  const textoTicker = productosStockBajo.map(p => `${p.nombre} (${p.stock})`).join('   •   ')
  const hayStockBajo = productosStockBajo.length > 0

  return (
    <div style={styles.container} className="dashboard-container-mobil">
      {estiloDashboardMovil}
      <style>{`
        @keyframes desplazarLed {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes parpadearAlerta {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px 2px rgba(248,113,113,0.7); }
          50% { opacity: 0.35; box-shadow: 0 0 2px 0 rgba(248,113,113,0.3); }
        }
        @keyframes parpadearPixel {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        .dz-tarjeta-resumen {
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
        }
        .dz-tarjeta-resumen:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 24px rgba(17,24,39,0.09);
          border-color: #d1d5db;
        }
        .dz-punto-alerta {
          width: 7px; height: 7px; border-radius: 50%;
          background: #f87171; display: inline-block;
          animation: parpadearAlerta 1.6s ease-in-out infinite;
        }
        .dz-boton-menu:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 26px rgba(17,24,39,0.10);
        }
      `}</style>

      <div style={styles.header} className="dashboard-header-mobil">
        <div>
          <h1 style={styles.titulo} className="dashboard-titulo-mobil">DURAGONZ V1.0</h1>
          <p style={styles.subtitulo}>
            Sistema de Gestión {sesion && `— Hola, ${sesion.nombre || sesion.username} (${esAdmin ? 'Administrador' : 'Empleado'})`}
          </p>
        </div>
        <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
          <div style={styles.tasa}>
            <span style={styles.tasaLabel}>Tasa del día</span>
            {puedeCambiarTasa && editando ? (
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.01"
                  value={nuevoPrecio}
                  onChange={(e) => setNuevoPrecio(e.target.value)}
                  style={{ width: '70px', padding: '4px' }}
                />
                <button onClick={guardarNuevoPrecio} style={{ cursor: 'pointer' }}>✓</button>
              </div>
            ) : (
              <span
                onClick={() => puedeCambiarTasa && setEditando(true)}
                style={{ ...styles.tasaValor, cursor: puedeCambiarTasa ? 'pointer' : 'default' }}
              >
                Bs {formatearBs(tasaDolar)}{puedeCambiarTasa ? ' ✎' : ''}
              </span>
            )}
          </div>
          <button onClick={cerrarSesion} style={styles.botonSalir}>Salir</button>
        </div>
      </div>

      <div style={styles.resumenContainer} className="dashboard-resumen-mobil">
        <div className="dz-tarjeta-resumen dashboard-card-resumen-mobil" style={styles.cardResumen}>
          <div style={{...styles.cardIcono, background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'}} className="dashboard-card-icono-mobil"><span>💵</span></div>
          <div>
            <p style={styles.cardLabel}>Última Venta</p>
            <p style={styles.cardValor} className="dashboard-card-valor-mobil">
              {ultimaVenta ? `$ ${ultimaVenta.total_usd.toFixed(2)}` : '—'}
            </p>
            {ultimaVenta && (
              <p style={styles.cardSub}>{formatearHaceTiempo(ultimaVenta.created_at)}</p>
            )}
          </div>
        </div>

        <div className="dz-tarjeta-resumen dashboard-card-resumen-mobil" style={styles.cardResumen}>
          <div style={{...styles.cardIcono, background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'}} className="dashboard-card-icono-mobil"><span>⏳</span></div>
          <div>
            <p style={styles.cardLabel}>Última Venta a Crédito</p>
            <p style={styles.cardValor} className="dashboard-card-valor-mobil">
              {ultimaVentaCredito ? `$ ${(ultimaVentaCredito.pago_credito_usd || 0).toFixed(2)}` : '—'}
            </p>
            {ultimaVentaCredito && (
              <p style={styles.cardSub}>
                {ultimaVentaCredito.clientes?.nombre || 'Cliente sin nombre'} · {formatearHaceTiempo(ultimaVentaCredito.created_at)}
              </p>
            )}
          </div>
        </div>

        {/* ---------- Letrero LED de stock bajo, estilo cartelería digital ---------- */}
        <div style={styles.cardLed} className="dashboard-card-led-mobil">
          <div style={styles.ledHeader}>
            {hayStockBajo && <span className="dz-punto-alerta" />}
            <span style={styles.ledHeaderTexto}>STOCK BAJO</span>
            {hayStockBajo && (
              <span style={styles.ledContador}>{productosStockBajo.length}</span>
            )}
          </div>
          <div style={styles.ledPantalla}>
            <div style={styles.ledScanlines} />
            {hayStockBajo ? (
              <div style={styles.ledFade}>
                <div style={styles.ledTicker}>
                  <span style={styles.ledTexto} className="dashboard-led-texto-mobil">{textoTicker}{'   •   '}{textoTicker}</span>
                </div>
              </div>
            ) : (
              <span style={{...styles.ledTexto, paddingLeft: '10px', opacity: 0.75}} className="dashboard-led-texto-mobil">SIN PRODUCTOS EN STOCK BAJO</span>
            )}
          </div>
        </div>
      </div>

      <div style={styles.menuGrid} className="dashboard-menu-mobil">
        {botones.map((boton) => (
          <button
            key={boton.ruta}
            className="dz-boton-menu dashboard-boton-menu-mobil"
            style={{...styles.botonMenu, borderTop: `4px solid ${boton.color}`}}
            onClick={() => router.push(boton.ruta)}
          >
            <span style={{...styles.atajoBadge, backgroundColor: boton.color}} className="dashboard-atajo-badge-mobil">{boton.atajo}</span>
            <span style={{...styles.iconoBoton, color: boton.color}} className="dashboard-icono-boton-mobil">{boton.icono}</span>
            <span style={styles.textoBoton} className="dashboard-texto-boton-mobil">{boton.nombre}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

const styles = {
  container: { padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh', fontFamily: '-apple-system, sans-serif' },
  header: { backgroundColor: 'white', padding: '24px', borderRadius: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' },
  titulo: { margin: 0, fontSize: '28px', fontWeight: '700', color: '#111827' },
  subtitulo: { margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' },
  tasa: { backgroundColor: '#f3f4f6', padding: '10px 18px', borderRadius: '10px', display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', border: '1px solid #e5e7eb' },
  tasaLabel: { fontSize: '12px', color: '#6b7280', marginBottom: '2px' },
  tasaValor: { fontSize: '16px', fontWeight: '600', color: '#111827' },
  botonSalir: { backgroundColor: 'white', color: '#dc2626', border: '1px solid #fca5a5', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: '500', fontSize: '14px' },
  resumenContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' },
  cardResumen: { backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' },
  cardIcono: { width: '56px', height: '56px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.6)' },
  cardLabel: { margin: 0, color: '#6b7280', fontSize: '14px', marginBottom: '4px' },
  cardValor: { margin: 0, fontSize: '28px', fontWeight: '700', color: '#111827' },
  cardSub: { margin: '2px 0 0 0', fontSize: '12px', color: '#9ca3af' },
  cardLed: {
    background: 'linear-gradient(145deg, #16181f 0%, #0b0d12 100%)',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid #262b36',
    boxShadow: '0 10px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)',
    overflow: 'hidden' as const
  },
  ledHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' },
  ledHeaderTexto: { color: '#f87171', fontSize: '12px', fontWeight: '700', letterSpacing: '1.5px' },
  ledContador: {
    marginLeft: 'auto', backgroundColor: 'rgba(248,113,113,0.15)', color: '#f87171',
    fontSize: '11px', fontWeight: '800', padding: '1px 8px', borderRadius: '999px',
    border: '1px solid rgba(248,113,113,0.35)'
  },
  ledPantalla: {
    backgroundColor: '#000',
    borderRadius: '8px',
    padding: '10px 0',
    overflow: 'hidden' as const,
    position: 'relative' as const,
    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.8), inset 0 0 20px rgba(74,222,128,0.05)'
  },
  ledScanlines: {
    position: 'absolute' as const,
    inset: 0,
    backgroundImage: 'repeating-linear-gradient(rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 3px)',
    pointerEvents: 'none' as const
  },
  ledFade: {
    WebkitMaskImage: 'linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)',
    maskImage: 'linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)',
  },
  ledTicker: { display: 'inline-block', whiteSpace: 'nowrap' as const, animation: 'desplazarLed 14s linear infinite' },
  ledTexto: {
    color: '#4ade80',
    fontFamily: '"Courier New", monospace',
    fontSize: '18px',
    fontWeight: '700',
    letterSpacing: '2px',
    paddingLeft: '20px',
    textShadow: '0 0 6px rgba(74,222,128,0.85), 0 0 14px rgba(74,222,128,0.45)'
  },
  menuGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' },
  botonMenu: { position: 'relative' as const, backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '32px 20px', color: '#111827', cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '12px', fontWeight: '600', transition: 'all 0.2s' },
  atajoBadge: { position: 'absolute' as const, top: '10px', right: '10px', color: 'white', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px' },
  iconoBoton: { fontSize: '42px' },
  textoBoton: { fontSize: '14px', color: '#374151' }
}