'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { resolverPrecioDesdeTexto } from '@/lib/precio'

interface Sesion {
  id: number
  nombre: string
  username: string
  rol: string
  permisos: Record<string, boolean>
}

interface Producto {
  id: number
  codigo: string
  nombre: string
  precio: number
  precio_mayoreo: number
  precio_costo: number
  stock: number
  stock_minimo: number
}

const LIMITE_POR_PAGINA = 30

export default function ProductosPage() {
  const router = useRouter()

  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [verificandoSesion, setVerificandoSesion] = useState(true)
  const [puedeEditar, setPuedeEditar] = useState(false)

  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [busquedaDebounced, setBusquedaDebounced] = useState('')
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [total, setTotal] = useState(0)

  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [valoresEdicion, setValoresEdicion] = useState<Partial<Producto>>({})
  const [guardandoId, setGuardandoId] = useState<number | null>(null)

  // ---- Protección: exige sesión ----
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
    setSesion(datos)
    setPuedeEditar(datos.rol === 'admin' || !!datos.permisos?.editar_productos)
    setVerificandoSesion(false)
  }, [router])

  // Espera un momento después de que el usuario deja de escribir antes de
  // buscar, para no mandar una consulta a Supabase por cada letra.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusquedaDebounced(busqueda)
      setPagina(1)
    }, 350)
    return () => clearTimeout(t)
  }, [busqueda])

  const cargarProductos = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        pagina: String(pagina),
        limite: String(LIMITE_POR_PAGINA),
      })
      if (busquedaDebounced) params.set('buscar', busquedaDebounced)

      const res = await fetch(`/api/productos?${params.toString()}`)
      const json = await res.json()

      if (!res.ok || json.error) {
        setError(json.error || 'No se pudieron cargar los productos.')
        setProductos([])
      } else {
        setProductos(json.data || [])
        setTotal(json.total || 0)
        setTotalPaginas(json.totalPaginas || 1)
      }
    } catch {
      setError('No se pudieron cargar los productos.')
    }
    setCargando(false)
  }, [pagina, busquedaDebounced])

  useEffect(() => {
    if (!verificandoSesion) cargarProductos()
  }, [verificandoSesion, cargarProductos])

  function iniciarEdicion(p: Producto) {
    setEditandoId(p.id)
    setValoresEdicion({ ...p })
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setValoresEdicion({})
  }

  // Al salir del campo Detalle o Mayoreo durante la edición: si escribieron
  // un %, lo convierte al monto final usando el precio_costo actual de la fila.
  function manejarBlurPrecioEdicion(campo: 'precio' | 'precio_mayoreo') {
    const valorActual = valoresEdicion[campo]
    if (valorActual === undefined || String(valorActual) === '') return
    const costo = parseFloat(String(valoresEdicion.precio_costo)) || 0
    const resultado = resolverPrecioDesdeTexto(String(valorActual), costo)
    setValoresEdicion(v => ({ ...v, [campo]: resultado as any }))
  }

  function manejarEnterPrecioEdicion(e: React.KeyboardEvent<HTMLInputElement>, campo: 'precio' | 'precio_mayoreo') {
    if (e.key !== 'Enter') return
    e.preventDefault()
    manejarBlurPrecioEdicion(campo)
  }

  async function guardarEdicion(id: number) {
    setGuardandoId(id)
    try {
      const res = await fetch(`/api/productos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: valoresEdicion.nombre,
          precio_costo: parseFloat(String(valoresEdicion.precio_costo)) || 0,
          precio: parseFloat(String(valoresEdicion.precio)) || 0,
          precio_mayoreo: parseFloat(String(valoresEdicion.precio_mayoreo)) || 0,
          stock: parseInt(String(valoresEdicion.stock)) || 0,
          stock_minimo: parseInt(String(valoresEdicion.stock_minimo)) || 0,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        alert('No se pudo guardar: ' + (json.error || ''))
      } else {
        cancelarEdicion()
        cargarProductos()
      }
    } catch {
      alert('No se pudo guardar el producto.')
    }
    setGuardandoId(null)
  }

  async function eliminarProducto(p: Producto) {
    const confirmar = confirm(`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`)
    if (!confirmar) return

    try {
      const res = await fetch(`/api/productos/${p.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || json.error) {
        alert('No se pudo eliminar: ' + (json.error || ''))
      } else {
        cargarProductos()
      }
    } catch {
      alert('No se pudo eliminar el producto.')
    }
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
          <p style={styles.subtitulo}>Módulo de Productos / Catálogo</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {puedeEditar && (
            <button onClick={() => router.push('/productos/nuevo')} style={styles.botonNuevo}>
              + Nuevo Producto
            </button>
          )}
          <button onClick={() => router.push('/dashboard')} style={styles.botonVolver}>
            Volver al Menú
          </button>
        </div>
      </div>

      <div style={styles.cardTabla}>
        <div style={styles.barraSuperior}>
          <input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={styles.inputBusqueda}
          />
          <span style={styles.contador}>
            {total.toLocaleString('es-VE')} producto{total === 1 ? '' : 's'}
          </span>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={{ overflowX: 'auto' }}>
          <table style={styles.tabla}>
            <thead>
              <tr>
                <th style={styles.th}>Código</th>
                <th style={styles.th}>Nombre</th>
                <th style={styles.thNum}>Costo</th>
                <th style={styles.thNum}>Detalle</th>
                <th style={styles.thNum}>Mayoreo</th>
                <th style={styles.thNum}>Stock</th>
                <th style={styles.thNum}>Mínimo</th>
                {puedeEditar && <th style={styles.thAcciones}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr><td colSpan={8} style={styles.tdVacio}>Cargando...</td></tr>
              )}
              {!cargando && productos.length === 0 && (
                <tr><td colSpan={8} style={styles.tdVacio}>No se encontraron productos.</td></tr>
              )}
              {!cargando && productos.map((p) => {
                const editando = editandoId === p.id
                const stockBajo = p.stock <= p.stock_minimo
                return (
                  <tr key={p.id} style={stockBajo ? styles.filaStockBajo : undefined}>
                    <td style={styles.td}>{p.codigo}</td>
                    <td style={styles.td}>
                      {editando ? (
                        <input
                          style={styles.inputEdicion}
                          value={valoresEdicion.nombre ?? ''}
                          onChange={(e) => setValoresEdicion(v => ({ ...v, nombre: e.target.value }))}
                        />
                      ) : p.nombre}
                    </td>
                    <td style={styles.tdNum}>
                      {editando ? (
                        <input
                          type="number" step="0.01"
                          style={{ ...styles.inputEdicion, textAlign: 'right' }}
                          value={valoresEdicion.precio_costo ?? ''}
                          onChange={(e) => setValoresEdicion(v => ({ ...v, precio_costo: e.target.value as any }))}
                        />
                      ) : `$${Number(p.precio_costo).toFixed(2)}`}
                    </td>
                    <td style={styles.tdNum}>
                      {editando ? (
                        <input
                          type="text" inputMode="decimal"
                          placeholder="0.00 o 30%"
                          style={{ ...styles.inputEdicion, textAlign: 'right' }}
                          value={valoresEdicion.precio ?? ''}
                          onChange={(e) => setValoresEdicion(v => ({ ...v, precio: e.target.value as any }))}
                          onBlur={() => manejarBlurPrecioEdicion('precio')}
                          onKeyDown={(e) => manejarEnterPrecioEdicion(e, 'precio')}
                        />
                      ) : `$${Number(p.precio).toFixed(2)}`}
                    </td>
                    <td style={styles.tdNum}>
                      {editando ? (
                        <input
                          type="text" inputMode="decimal"
                          placeholder="0.00 o 20%"
                          style={{ ...styles.inputEdicion, textAlign: 'right' }}
                          value={valoresEdicion.precio_mayoreo ?? ''}
                          onChange={(e) => setValoresEdicion(v => ({ ...v, precio_mayoreo: e.target.value as any }))}
                          onBlur={() => manejarBlurPrecioEdicion('precio_mayoreo')}
                          onKeyDown={(e) => manejarEnterPrecioEdicion(e, 'precio_mayoreo')}
                        />
                      ) : `$${Number(p.precio_mayoreo).toFixed(2)}`}
                    </td>
                    <td style={styles.tdNum}>
                      {editando ? (
                        <input
                          type="number"
                          style={{ ...styles.inputEdicion, textAlign: 'right' }}
                          value={valoresEdicion.stock ?? ''}
                          onChange={(e) => setValoresEdicion(v => ({ ...v, stock: e.target.value as any }))}
                        />
                      ) : (
                        <span style={stockBajo ? { color: '#dc2626', fontWeight: 700 } : undefined}>{p.stock}</span>
                      )}
                    </td>
                    <td style={styles.tdNum}>
                      {editando ? (
                        <input
                          type="number"
                          style={{ ...styles.inputEdicion, textAlign: 'right' }}
                          value={valoresEdicion.stock_minimo ?? ''}
                          onChange={(e) => setValoresEdicion(v => ({ ...v, stock_minimo: e.target.value as any }))}
                        />
                      ) : p.stock_minimo}
                    </td>
                    {puedeEditar && (
                      <td style={styles.tdAcciones}>
                        {editando ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              style={styles.botonGuardarFila}
                              onClick={() => guardarEdicion(p.id)}
                              disabled={guardandoId === p.id}
                            >
                              {guardandoId === p.id ? '...' : 'Guardar'}
                            </button>
                            <button style={styles.botonCancelarFila} onClick={cancelarEdicion}>
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button style={styles.botonEditarFila} onClick={() => iniciarEdicion(p)}>
                              Editar
                            </button>
                            <button style={styles.botonEliminarFila} onClick={() => eliminarProducto(p)}>
                              Eliminar
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={styles.paginacion}>
          <button
            style={styles.botonPagina}
            onClick={() => setPagina(p => Math.max(p - 1, 1))}
            disabled={pagina <= 1 || cargando}
          >
            ← Anterior
          </button>
          <span style={styles.textoPagina}>
            Página {pagina} de {totalPaginas}
          </span>
          <button
            style={styles.botonPagina}
            onClick={() => setPagina(p => Math.min(p + 1, totalPaginas))}
            disabled={pagina >= totalPaginas || cargando}
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    backgroundColor: '#f9fafb',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
    border: '1px solid #e5e7eb',
  },
  titulo: { margin: 0, fontSize: '28px', fontWeight: 700, color: '#111827' },
  subtitulo: { margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' },
  botonVolver: {
    backgroundColor: 'white', color: '#4b5563', border: '1px solid #e5e7eb',
    padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 500, fontSize: '14px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  botonNuevo: {
    backgroundColor: '#2563eb', color: 'white', border: 'none',
    padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
  },
  cardTabla: {
    backgroundColor: 'white', padding: '20px', borderRadius: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', borderTop: '4px solid #2563eb',
  },
  barraSuperior: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap',
  },
  inputBusqueda: {
    flex: 1, minWidth: '220px', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: '10px',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  },
  contador: { fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' },
  error: {
    padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
    borderRadius: '8px', fontSize: '13px', marginBottom: '14px',
  },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' },
  th: { textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' },
  thNum: { textAlign: 'right', padding: '10px 8px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' },
  thAcciones: { textAlign: 'center', padding: '10px 8px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' },
  td: { padding: '9px 8px', borderBottom: '1px solid #f3f4f6', color: '#111827' },
  tdNum: { padding: '9px 8px', borderBottom: '1px solid #f3f4f6', color: '#111827', textAlign: 'right' },
  tdAcciones: { padding: '9px 8px', borderBottom: '1px solid #f3f4f6' },
  tdVacio: { padding: '24px', textAlign: 'center', color: '#9ca3af' },
  filaStockBajo: { backgroundColor: '#fef2f2' },
  inputEdicion: {
    width: '100%', padding: '5px 8px', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  },
  botonEditarFila: {
    backgroundColor: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', padding: '5px 10px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
  },
  botonEliminarFila: {
    backgroundColor: 'white', color: '#dc2626', border: '1px solid #fecaca', padding: '5px 10px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
  },
  botonGuardarFila: {
    backgroundColor: '#111827', color: 'white', border: 'none', padding: '5px 10px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
  },
  botonCancelarFila: {
    backgroundColor: '#f3f4f6', color: '#374151', border: 'none', padding: '5px 10px',
    borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
  },
  paginacion: {
    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '18px',
  },
  botonPagina: {
    backgroundColor: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb', padding: '8px 16px',
    borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
  },
  textoPagina: { fontSize: '13px', color: '#6b7280' },
}
