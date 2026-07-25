'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fetchConTimeout } from '@/lib/fetch-timeout'
import EscanerCamara from '@/components/EscanerCamara'

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

interface ItemVenta extends Producto {
  cantidad: number
  precioDetalle: number
}

interface Cliente {
  id: number
  nombre: string
  cedula_rif: string | null
  tipo_credito: 'contado' | 'ilimitado' | 'limite'
  monto_limite: number | null
}

interface SaldoCliente {
  cliente_id: number
  saldo_usd: number
}

interface TicketItem {
  nombre: string
  cantidad: number
  precio: number
}

interface TicketConfig {
  nombre_negocio: string
  rif_cedula: string
  direccion: string
  incluir_telefono: boolean
  telefono: string
  tamano_letra: number
  tipo_letra: string
  espaciado: number
}

const TICKET_CONFIG_DEFAULT: TicketConfig = {
  nombre_negocio: 'MI NEGOCIO',
  rif_cedula: 'J-00000000-0',
  direccion: 'Tu dirección aquí',
  incluir_telefono: false,
  telefono: '0000-0000000',
  tamano_letra: 12,
  tipo_letra: 'Courier New',
  espaciado: 1,
}

interface Sesion {
  id: number
  nombre: string
  username: string
  rol: string
  permisos: Record<string, boolean>
}

interface VentaResumen {
  id: number
  created_at: string
  total_usd: number
  pago_credito_usd?: number
  clientes?: { nombre: string } | null
}

interface ProductoStockBajo {
  id: number
  nombre: string
  stock: number
}

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

export default function Vender() {
  async function fetchConReintento(url: string, options: RequestInit, intentos = 3, esperaMs = 400) {
  let ultimoError: any = null
  for (let i = 0; i < intentos; i++) {
    try {
      const res = await fetch(url, options)
      const data = await res.json()
      if (!data.error) return { data }
      ultimoError = data.error
    } catch (err) {
      ultimoError = err
    }
    if (i < intentos - 1) {
      await new Promise(resolve => setTimeout(resolve, esperaMs * (i + 1)))
    }
  }
  return { error: ultimoError }
}
  const router = useRouter()

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

  const esAdmin = sesion?.rol === 'admin'
  const puedeCancelarVentas = esAdmin || !!sesion?.permisos?.cancelar_ventas
  const puedeAplicarMayoreo = esAdmin || !!sesion?.permisos?.aplicar_mayoreo
  const puedeReimprimir = esAdmin || !!sesion?.permisos?.reimprimir_tickets
  const puedeVentaCredito = esAdmin || !!sesion?.permisos?.permitir_venta_credito
  const puedeEditarProductos = esAdmin || !!sesion?.permisos?.editar_productos || !!sesion?.permisos?.editar_precios || !!sesion?.permisos?.editar_stock
  const puedeEditarPrecioCosto = esAdmin || !!sesion?.permisos?.editar_precio_costo
  const puedeCambiarTasa = esAdmin || !!sesion?.permisos?.cambiar_tasa

  const [items, setItems] = useState<ItemVenta[]>([])
  const [itemSeleccionadoId, setItemSeleccionadoId] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarBuscador, setMostrarBuscador] = useState(false)
  const [mostrarCobro, setMostrarCobro] = useState(false)
  const [mostrarEditar, setMostrarEditar] = useState(false)
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null)
  const [tasaDolar, setTasaDolar] = useState(0)
  const [mostrarCambiarTasa, setMostrarCambiarTasa] = useState(false)
  const [nuevaTasaInput, setNuevaTasaInput] = useState('')
  const [guardandoTasa, setGuardandoTasa] = useState(false)
  const abrirCambiarTasa = () => {
  if (!puedeCambiarTasa) {
    alert('No tienes permiso para cambiar la tasa del día')
    return
  }
  setNuevaTasaInput(tasaDolar > 0 ? String(tasaDolar) : '')
  setMostrarCambiarTasa(true)
}

const guardarNuevaTasa = async () => {
  const valor = parseFloat(nuevaTasaInput)
  if (!valor || isNaN(valor) || valor <= 0) {
    alert('Ingresa una tasa válida')
    return
  }
  setGuardandoTasa(true)
  try {
    const hoy = obtenerFechaLocal()
    const res = await fetch('/api/tasas-diarias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha: hoy, valor }),
    })
    const data = await res.json()
    if (data.error) {
      alert('Error al actualizar la tasa: ' + data.error)
      setGuardandoTasa(false)
      return
    }
    setTasaDolar(valor)
    setMostrarCambiarTasa(false)
    alert('Tasa del día actualizada ✅')
    window.dispatchEvent(new CustomEvent('tasaActualizada', { detail: valor })) // <-- AGREGAR
  } catch (err) {
    alert('Error de conexión al actualizar la tasa')
  }
  setGuardandoTasa(false)

}

  const [mostrarVerificadorPrecio, setMostrarVerificadorPrecio] = useState(false)
  const [busquedaPrecio, setBusquedaPrecio] = useState('')
  const [productoVerificado, setProductoVerificado] = useState<Producto | null>(null)
  const inputVerificadorRef = useRef<HTMLInputElement>(null)

  const [mostrarCalculadora, setMostrarCalculadora] = useState(false)
  const [calcExpresion, setCalcExpresion] = useState('')
  const [calcResultado, setCalcResultado] = useState('0')

  const calcPresionarTecla = (tecla: string) => {
    if (tecla === 'C') {
      setCalcExpresion('')
      setCalcResultado('0')
      return
    }
    if (tecla === '⌫') {
      setCalcExpresion((prev) => prev.slice(0, -1))
      return
    }
    if (tecla === '=') {
      try {
        if (!/^[0-9+\-*/.() ]*$/.test(calcExpresion)) return
        // eslint-disable-next-line no-eval
        const resultado = eval(calcExpresion)
        setCalcResultado(String(resultado))
      } catch {
        setCalcResultado('Error')
      }
      return
    }
    setCalcExpresion((prev) => prev + tecla)
  }

  const [ticketConfig, setTicketConfig] = useState<TicketConfig>(TICKET_CONFIG_DEFAULT)

  useEffect(() => {
    const cargarConfigTicket = async () => {
      const res = await fetch('/api/configuracion-ticket')
      const { data } = await res.json()
      if (data) {
        setTicketConfig({
          nombre_negocio: data.nombre_negocio || TICKET_CONFIG_DEFAULT.nombre_negocio,
          rif_cedula: data.rif_cedula || TICKET_CONFIG_DEFAULT.rif_cedula,
          direccion: data.direccion || TICKET_CONFIG_DEFAULT.direccion,
          incluir_telefono: !!data.incluir_telefono,
          telefono: data.telefono || TICKET_CONFIG_DEFAULT.telefono,
          tamano_letra: data.tamano_letra || TICKET_CONFIG_DEFAULT.tamano_letra,
          tipo_letra: data.tipo_letra || TICKET_CONFIG_DEFAULT.tipo_letra,
          espaciado: data.espaciado ?? TICKET_CONFIG_DEFAULT.espaciado,
        })
      }
    }
    cargarConfigTicket()

    const canal = supabase
      .channel('configuracion_ticket_cambios_venta')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'configuracion_ticket' },
        (payload) => {
          const nuevo = payload.new as any
          setTicketConfig({
            nombre_negocio: nuevo.nombre_negocio || TICKET_CONFIG_DEFAULT.nombre_negocio,
            rif_cedula: nuevo.rif_cedula || TICKET_CONFIG_DEFAULT.rif_cedula,
            direccion: nuevo.direccion || TICKET_CONFIG_DEFAULT.direccion,
            incluir_telefono: !!nuevo.incluir_telefono,
            telefono: nuevo.telefono || TICKET_CONFIG_DEFAULT.telefono,
            tamano_letra: nuevo.tamano_letra || TICKET_CONFIG_DEFAULT.tamano_letra,
            tipo_letra: nuevo.tipo_letra || TICKET_CONFIG_DEFAULT.tipo_letra,
            espaciado: nuevo.espaciado ?? TICKET_CONFIG_DEFAULT.espaciado,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [])

  const [ultimaVenta, setUltimaVenta] = useState<VentaResumen | null>(null)
  const [ultimaVentaCredito, setUltimaVentaCredito] = useState<VentaResumen | null>(null)
  const [productosStockBajo, setProductosStockBajo] = useState<ProductoStockBajo[]>([])

  const CLAVE_CACHE_TASA = 'pos_tasa_cache'

  useEffect(() => {
  const cargarTasa = async () => {
    try {
      const hoy = obtenerFechaLocal()
      const res = await fetch(`/api/tasas-diarias?fecha=${hoy}`)
      const { data } = await res.json()
      if (data) {
        setTasaDolar(data.valor)
        try { localStorage.setItem(CLAVE_CACHE_TASA, String(data.valor)) } catch {}
      }
    } catch (err) {
      try {
        const cache = localStorage.getItem(CLAVE_CACHE_TASA)
        if (cache) setTasaDolar(Number(cache))
      } catch {}
    }
  }
  cargarTasa()
  cargarResumenVender()
}, [])
useEffect(() => {
  const handler = (e: any) => setTasaDolar(e.detail)
  window.addEventListener('tasaActualizada', handler)
  return () => window.removeEventListener('tasaActualizada', handler)
}, [])

  const cargarResumenVender = async () => {
    try {
      const [resVenta, resCredito, resStock] = await Promise.all([
        fetch('/api/ventas?ultima=true'),
        fetch('/api/ventas?ultimaCredito=true'),
        fetch('/api/productos?stockBajo=true'),
      ])
      const { data: venta } = await resVenta.json()
      const { data: credito } = await resCredito.json()
      const { data: stockBajo } = await resStock.json()
      setUltimaVenta(venta || null)
      setUltimaVentaCredito(credito || null)
      setProductosStockBajo(stockBajo || [])
    } catch (err) {
      console.error('Error cargando resumen en Vender:', err)
    }
  }

  // ---------------- Ventas sin conexión (offline-first) ----------------
  const CLAVE_VENTAS_PENDIENTES = 'pos_ventas_pendientes_sync'
  const [estaOnline, setEstaOnline] = useState(true)
  const [ventasPendientes, setVentasPendientes] = useState<any[]>([])
  const [sincronizandoVentas, setSincronizandoVentas] = useState(false)

  const leerVentasPendientesStorage = (): any[] => {
    try {
      const raw = localStorage.getItem(CLAVE_VENTAS_PENDIENTES)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  const guardarVentasPendientesStorage = (lista: any[]) => {
    try {
      localStorage.setItem(CLAVE_VENTAS_PENDIENTES, JSON.stringify(lista))
    } catch {}
    setVentasPendientes(lista)
  }

  const guardarVentaOffline = (imprimir: boolean) => {
    const idLocal = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const idTicketOffline = -Date.now() // negativo para distinguirlo de un ticket real hasta que sincronice

    const itemsDescuento = items.map(item => ({ id: item.id, cantidad: item.cantidad }))
    const itemsDetalle = items.map(item => ({ id: item.id, codigo: item.codigo, nombre: item.nombre, precio: item.precio }))

    const payloadVenta = {
      total_bs: totalBs,
      total_usd: totalDolares,
      tasa_dolar: tasaEfectiva,
      pago_efectivo_bs: pagoEfectivoBs,
      pago_efectivo_usd: pagoEfectivoUsd,
      pago_tarjeta: pagoTarjeta,
      pago_transferencia: pagoTransferencia,
      pago_biopago: pagoBiopago,
      cliente_id: clienteSeleccionadoId || null,
      vendedor_id: sesion?.id || null,
      vendedor_nombre: sesion?.nombre || null,
      ganancia_usd: gananciaVentaUsd,
      items_snapshot: items.map(item => ({
        producto_id: item.id,
        codigo: item.codigo,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio_unitario: item.precio,
        subtotal: item.precio * item.cantidad,
      })),
    }

    const ventaLocal = { idLocal, payloadVenta, itemsDescuento, itemsDetalle, creadaEn: new Date().toISOString() }

    guardarVentasPendientesStorage([...leerVentasPendientesStorage(), ventaLocal])

    const itemsParaTicket = items
    const clienteParaTicket = clienteSeleccionado
    const pagosParaTicket = {
      efectivoBs: pagoEfectivoBs,
      efectivoUsd: pagoEfectivoUsd,
      tarjeta: pagoTarjeta,
      transferencia: pagoTransferencia,
      biopago: pagoBiopago,
      creditoUsd: 0,
    }

    if (imprimir) {
      imprimirTicket(
        idTicketOffline,
        itemsParaTicket,
        totalDolares,
        totalBs,
        tasaEfectiva,
        clienteParaTicket,
        sesion?.nombre,
        pagosParaTicket
      )
    }

    setProductos(prev => prev.map(p => {
      const vendido = itemsParaTicket.find(it => it.id === p.id)
      return vendido ? { ...p, stock: p.stock - vendido.cantidad } : p
    }))

    setItems([])
    setItemSeleccionadoId(null)
    setMostrarCobro(false)
    setPagoEfectivoBs(0)
    setPagoEfectivoUsd(0)
    setPagoTarjeta(0)
    setPagoTransferencia(0)
    setPagoBiopago(0)
    setClienteSeleccionadoId('')
    setBusquedaCliente('')
    setMostrarListaClientes(false)
    setProcesandoVenta(false)

    alert('🔌 Sin conexión: la venta se guardó en este dispositivo y se subirá sola cuando vuelva el internet.')
  }

  const [toastSync, setToastSync] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)
  const toastSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mostrarToastSync = (tipo: 'exito' | 'error', mensaje: string) => {
    if (toastSyncTimeoutRef.current) clearTimeout(toastSyncTimeoutRef.current)
    setToastSync({ tipo, mensaje })
    toastSyncTimeoutRef.current = setTimeout(() => setToastSync(null), 4000)
  }

  const sincronizarVentasPendientes = async () => {
    if (sincronizandoVentas) return
    const pendientes = leerVentasPendientesStorage()
    if (pendientes.length === 0) return

    setSincronizandoVentas(true)
    let restantes = [...pendientes]

    for (const ventaLocal of pendientes) {
      try {
        const resDescuento = await fetchConTimeout('/api/productos/descontar-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: ventaLocal.itemsDescuento }),
        })
        const descuentoData = await resDescuento.json()
        if (descuentoData.error) throw new Error(descuentoData.error)

        const resVenta = await fetch('/api/ventas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ventaLocal.payloadVenta),
        })
        const ventaResp = await resVenta.json()
        if (ventaResp.error || !ventaResp.data) throw new Error(ventaResp.error || 'sin datos')
        const ventaGuardada = ventaResp.data

        const itemsParaInsertar = ventaLocal.itemsDescuento.map((it: any) => {
          const detalle = ventaLocal.itemsDetalle.find((d: any) => d.id === it.id)
          return {
            venta_id: ventaGuardada.id,
            producto_id: it.id,
            codigo_producto: detalle?.codigo,
            nombre_producto: detalle?.nombre,
            cantidad: it.cantidad,
            precio_unitario: detalle?.precio,
            subtotal: (detalle?.precio || 0) * it.cantidad,
          }
        })
        await fetchConReintento('/api/venta-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemsParaInsertar),
        })

        restantes = restantes.filter(v => v.idLocal !== ventaLocal.idLocal)
        guardarVentasPendientesStorage(restantes)
      } catch (err) {
        // Esta no se pudo subir (seguimos sin señal o falló el servidor).
        // Dejamos esta y las que faltan en la cola para el próximo intento.
        break
      }
    }

    setSincronizandoVentas(false)

    const subidas = pendientes.length - restantes.length
    if (subidas > 0) {
      mostrarToastSync('exito', `✅ ${subidas} venta${subidas === 1 ? '' : 's'} sincronizada${subidas === 1 ? '' : 's'} correctamente`)
    } else if (restantes.length > 0) {
      mostrarToastSync('error', `⚠️ No se pudieron subir las ventas guardadas. Se reintentará solo.`)
    }

    if (restantes.length < pendientes.length) {
      cargarProductos()
      cargarClientes()
      cargarResumenVender()
    }
  }

  useEffect(() => {
    setEstaOnline(navigator.onLine)
    guardarVentasPendientesStorage(leerVentasPendientesStorage())

    const marcarOnline = () => {
      setEstaOnline(true)
      sincronizarVentasPendientes()
    }
    const marcarOffline = () => setEstaOnline(false)

    window.addEventListener('online', marcarOnline)
    window.addEventListener('offline', marcarOffline)

    if (navigator.onLine) sincronizarVentasPendientes()

    return () => {
      window.removeEventListener('online', marcarOnline)
      window.removeEventListener('offline', marcarOffline)
    }
  }, [])

  const inputBusquedaRef = useRef<HTMLInputElement>(null)
  const [mostrarEscanerCamara, setMostrarEscanerCamara] = useState(false)
  const scannerBufferRef = useRef('')
  const scannerUltimaTeclaRef = useRef(0)

  const [scanFeedback, setScanFeedback] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)
  const scanFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mostrarScanFeedback = (tipo: 'exito' | 'error', mensaje: string) => {
    if (scanFeedbackTimeoutRef.current) clearTimeout(scanFeedbackTimeoutRef.current)
    setScanFeedback({ tipo, mensaje })
    scanFeedbackTimeoutRef.current = setTimeout(() => setScanFeedback(null), 1800)
  }

  useEffect(() => {
    return () => {
      if (scanFeedbackTimeoutRef.current) clearTimeout(scanFeedbackTimeoutRef.current)
    }
  }, [])

  const [pagoEfectivoBs, setPagoEfectivoBs] = useState(0)
  const [pagoEfectivoUsd, setPagoEfectivoUsd] = useState(0)
  const [pagoTarjeta, setPagoTarjeta] = useState(0)
  const [pagoTransferencia, setPagoTransferencia] = useState(0)
  const [pagoBiopago, setPagoBiopago] = useState(0)
  const [deudaClienteUsd, setDeudaClienteUsd] = useState(0)
  const [cargandoDeudaCliente, setCargandoDeudaCliente] = useState(false)
  const [facturandoCredito, setFacturandoCredito] = useState(false)

  const [productos, setProductos] = useState<Producto[]>([])
  const [cargandoProductos, setCargandoProductos] = useState(true)
  const [procesandoVenta, setProcesandoVenta] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [saldos, setSaldos] = useState<Record<number, number>>({})
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<number | ''>('')

  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [mostrarListaClientes, setMostrarListaClientes] = useState(false)

  const [reimprimiendo, setReimprimiendo] = useState(false)

  const [mostrarDevoluciones, setMostrarDevoluciones] = useState(false)
  const [folioBuscado, setFolioBuscado] = useState('')
  const [buscandoVenta, setBuscandoVenta] = useState(false)
  const [ventasFiltradas, setVentasFiltradas] = useState<any[]>([])
  const [modoFecha, setModoFecha] = useState<'dia' | 'mes'>('dia')
  const [fechaFiltro, setFechaFiltro] = useState(obtenerFechaLocal())
  const [mesFiltro, setMesFiltro] = useState(obtenerFechaLocal().slice(0, 7))
  const [ventaParaAnular, setVentaParaAnular] = useState<any | null>(null)
  const [itemsVentaParaAnular, setItemsVentaParaAnular] = useState<any[]>([])
  const [procesandoAnulacion, setProcesandoAnulacion] = useState(false)

  const [mostrarGuardarTicket, setMostrarGuardarTicket] = useState(false)
  const [referenciaTicket, setReferenciaTicket] = useState('')
  const [guardandoTicket, setGuardandoTicket] = useState(false)

  const [mostrarBuscarTickets, setMostrarBuscarTickets] = useState(false)
  const [busquedaTicketGuardado, setBusquedaTicketGuardado] = useState('')
  const [ticketsEncontrados, setTicketsEncontrados] = useState<any[]>([])
  const [buscandoTickets, setBuscandoTickets] = useState(false)

  useEffect(() => {
    if (!verificandoSesion) {
      cargarProductos()
      cargarClientes()
    }
  }, [verificandoSesion])

  const CLAVE_CACHE_PRODUCTOS = 'pos_productos_cache'

  const cargarProductos = async () => {
    setCargandoProductos(true)
    try {
      const res = await fetch('/api/productos')
      const { data, error } = await res.json()

      if (error) throw new Error(error)

      setProductos(data || [])
      try {
        localStorage.setItem(CLAVE_CACHE_PRODUCTOS, JSON.stringify(data || []))
      } catch {}
    } catch (err) {
      // Sin conexión (o el servidor falló): usamos la última lista de
      // productos guardada en este dispositivo para poder seguir vendiendo.
      try {
        const cache = localStorage.getItem(CLAVE_CACHE_PRODUCTOS)
        if (cache) {
          setProductos(JSON.parse(cache))
        } else {
          alert('No hay productos guardados en este dispositivo y no se pudo conectar al servidor.')
        }
      } catch {
        alert('Error cargando productos')
      }
    }
    setCargandoProductos(false)
  }

  const CLAVE_CACHE_CLIENTES = 'pos_clientes_cache'

  const cargarClientes = async () => {
    try {
      const res = await fetch('/api/clientes')
      const { clientes: clientesData, saldos: saldosData, error } = await res.json()

      if (error) throw new Error(error)

      const mapa: Record<number, number> = {}
      ;(saldosData as SaldoCliente[] | null)?.forEach((s) => {
        mapa[s.cliente_id] = Number(s.saldo_usd)
      })
      setClientes(clientesData || [])
      setSaldos(mapa)
      try {
        localStorage.setItem(CLAVE_CACHE_CLIENTES, JSON.stringify({ clientes: clientesData || [], saldos: mapa }))
      } catch {}
    } catch (err) {
      console.error(err)
      try {
        const cache = localStorage.getItem(CLAVE_CACHE_CLIENTES)
        if (cache) {
          const { clientes: clientesCache, saldos: saldosCache } = JSON.parse(cache)
          setClientes(clientesCache || [])
          setSaldos(saldosCache || {})
        }
      } catch {}
    }
  }

  const terminosBusqueda = busqueda.trim().toLowerCase().split(/\s+/).filter(Boolean)

  const productosFiltrados = terminosBusqueda.length === 0
    ? []
    : productos.filter(p => {
        const nombreLower = p.nombre.toLowerCase()
        const codigoLower = p.codigo.toLowerCase()
        return terminosBusqueda.every(
          termino => nombreLower.includes(termino) || codigoLower.includes(termino)
        )
      })

  const terminosBusquedaPrecio = busquedaPrecio.trim().toLowerCase().split(/\s+/).filter(Boolean)

  const productosFiltradosPrecio = terminosBusquedaPrecio.length === 0
    ? []
    : productos.filter(p => {
        const nombreLower = p.nombre.toLowerCase()
        const codigoLower = p.codigo.toLowerCase()
        return terminosBusquedaPrecio.every(
          termino => nombreLower.includes(termino) || codigoLower.includes(termino)
        )
      })

  const agregarProducto = (producto: Producto) => {
    const existe = items.find(item => item.id === producto.id)
    if (existe) {
      if (existe.cantidad + 1 > producto.stock) {
        alert(`Stock insuficiente. Solo quedan ${producto.stock} unidades`)
        return
      }
      setItems(items.map(item =>
        item.id === producto.id
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      ))
    } else {
      if (producto.stock <= 0) {
        alert('Este producto no tiene stock disponible')
        return
      }
      setItems([...items, { ...producto, precioDetalle: producto.precio, cantidad: 1 }])
    }
    setMostrarBuscador(false)
    setBusqueda('')
  }

  const buscarYAgregarPorCodigo = (codigoEscaneado: string) => {
    const codigoLimpio = codigoEscaneado.trim()
    if (!codigoLimpio) return
    const producto = productos.find(
      p => p.codigo.toLowerCase() === codigoLimpio.toLowerCase()
    )
    if (!producto) {
      mostrarScanFeedback('error', `Código "${codigoLimpio}" no encontrado`)
      return
    }
    agregarProducto(producto)
    mostrarScanFeedback('exito', `${producto.nombre} agregado`)
  }

  const abrirVerificadorPrecio = () => {
    setBusquedaPrecio('')
    setProductoVerificado(null)
    setMostrarVerificadorPrecio(true)
    setTimeout(() => inputVerificadorRef.current?.focus(), 100)
  }

  const cerrarVerificadorPrecio = () => {
    setMostrarVerificadorPrecio(false)
    setBusquedaPrecio('')
    setProductoVerificado(null)
  }

  const verificarPrecioPorCodigo = (codigoEscaneado: string) => {
    const codigoLimpio = codigoEscaneado.trim()
    if (!codigoLimpio) return
    const producto = productos.find(
      p => p.codigo.toLowerCase() === codigoLimpio.toLowerCase()
    )
    if (!producto) {
      mostrarScanFeedback('error', `Código "${codigoLimpio}" no encontrado`)
      setProductoVerificado(null)
      return
    }
    setBusquedaPrecio('')
    setProductoVerificado(producto)
    mostrarScanFeedback('exito', `${producto.nombre}: $ ${producto.precio.toFixed(2)}`)
  }

  const alternarPrecioMayor = (id: number) => {
    if (!puedeAplicarMayoreo) {
      alert('No tienes permiso para aplicar precio de mayoreo')
      return
    }
    setItems(items.map(item => {
      if (item.id !== id) return item
      const usandoMayor = item.precio === item.precio_mayoreo && item.precio_mayoreo > 0
      if (usandoMayor) {
        return { ...item, precio: item.precioDetalle }
      }
      if (!item.precio_mayoreo || item.precio_mayoreo <= 0) {
        alert('Este producto no tiene precio de mayoreo configurado')
        return item
      }
      return { ...item, precio: item.precio_mayoreo }
    }))
  }

  const abrirEditarProducto = (producto: Producto) => {
    if (!puedeEditarProductos) {
      alert('No tienes permiso para editar productos')
      return
    }
    setProductoEditando({ ...producto })
    setMostrarEditar(true)
  }

  const guardarProductoEditado = async () => {
    if (!productoEditando) return

    const payload: any = {
      codigo: productoEditando.codigo,
      nombre: productoEditando.nombre,
      precio: productoEditando.precio,
      precio_mayoreo: productoEditando.precio_mayoreo,
      stock: productoEditando.stock,
      stock_minimo: productoEditando.stock_minimo,
    }
    if (puedeEditarPrecioCosto) {
      payload.precio_costo = productoEditando.precio_costo
    }

    const res = await fetch(`/api/productos/${productoEditando.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const { error } = await res.json()

    if (error) {
      alert('Error al actualizar el producto: ' + error)
      return
    }

    setProductos(productos.map(p =>
      p.id === productoEditando.id ? productoEditando : p
    ))
    setMostrarEditar(false)
    setProductoEditando(null)
    alert('Producto actualizado ✅')
  }

  const guardarTicketActual = async () => {
    if (items.length === 0) {
      alert('No hay productos en el ticket para guardar')
      return
    }
    if (!referenciaTicket.trim()) {
      alert('Escribe un nombre o cédula de referencia')
      return
    }

    setGuardandoTicket(true)

    const payload = {
      referencia: referenciaTicket.trim(),
      items: items,
      total_usd: totalDolares,
      total_bs: totalBs,
      cliente_id: clienteSeleccionadoId || null,
      vendedor_nombre: sesion?.nombre || null,
    }

    try {
      const res = await fetch('/api/tickets-pendientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const { error } = await res.json()

      if (error) {
        alert('Error al guardar el ticket: ' + error)
        setGuardandoTicket(false)
        return
      }

      alert(`✅ Ticket guardado para "${referenciaTicket.trim()}"`)
      setItems([])
      setItemSeleccionadoId(null)
      setClienteSeleccionadoId('')
      setReferenciaTicket('')
      setMostrarGuardarTicket(false)
    } catch (err) {
      alert('Error de conexión al guardar el ticket')
    }
    setGuardandoTicket(false)
  }

  const buscarTicketsGuardados = async (texto: string) => {
    setBuscandoTickets(true)
    try {
      const res = await fetch(`/api/tickets-pendientes?buscar=${encodeURIComponent(texto)}`)
      const { data, error } = await res.json()
      if (error) {
        console.error(error)
        setTicketsEncontrados([])
      } else {
        setTicketsEncontrados(data || [])
      }
    } catch (err) {
      setTicketsEncontrados([])
    }
    setBuscandoTickets(false)
  }

  const retomarTicket = async (ticket: any) => {
    setItems(ticket.items)
    setClienteSeleccionadoId(ticket.cliente_id || '')
    setMostrarBuscarTickets(false)
    setBusquedaTicketGuardado('')
    setTicketsEncontrados([])

    try {
      await fetch(`/api/tickets-pendientes/${ticket.id}`, { method: 'DELETE' })
    } catch (err) {
      console.error('Error eliminando ticket pendiente ya retomado:', err)
    }
  }

  const cambiarCantidad = (id: number, cantidad: number) => {
    const item = items.find(i => i.id === id)
    if (!item) return

    if (cantidad > item.stock) {
      alert(`Stock insuficiente. Solo quedan ${item.stock} unidades`)
      return
    }

    if (cantidad <= 0) {
      setItems(items.filter(item => item.id !== id))
    } else {
      setItems(items.map(item =>
        item.id === id ? { ...item, cantidad } : item
      ))
    }
  }

  const eliminarItem = (id: number) => {
    setItems(items.filter(item => item.id !== id))
    if (itemSeleccionadoId === id) setItemSeleccionadoId(null)
  }

  const cancelarVenta = () => {
    if (items.length === 0) return
    const confirmar = confirm('¿Cancelar venta? Los productos volverán al inventario.')
    if (confirmar) {
      setItems([])
      setItemSeleccionadoId(null)
      alert('Venta cancelada ✅')
    }
  }

  const totalDolares = items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0)
  const tasaEfectiva = tasaDolar > 0 ? tasaDolar : 1
  const totalBs = totalDolares * tasaEfectiva
  const totalPagadoBs =
    pagoEfectivoBs +
    (pagoEfectivoUsd * tasaEfectiva) +
    pagoTarjeta +
    pagoTransferencia +
    pagoBiopago
  const restantePago = totalBs - totalPagadoBs

  const gananciaVentaUsd = items.reduce(
    (sum, item) => sum + (item.precio - (item.precio_costo || 0)) * item.cantidad,
    0
  )

  const clienteSeleccionado = clientes.find(c => c.id === clienteSeleccionadoId)
  const saldoClienteSeleccionado = deudaClienteUsd
  const creditoDisponible = clienteSeleccionado?.tipo_credito === 'limite'
    ? Number(clienteSeleccionado.monto_limite || 0) - saldoClienteSeleccionado
    : null

  useEffect(() => {
    if (!clienteSeleccionadoId) {
      setDeudaClienteUsd(0)
      return
    }
    setCargandoDeudaCliente(true)
    fetch(`/api/creditos-pendientes?cliente_id=${clienteSeleccionadoId}`)
      .then(res => res.json())
      .then(({ deuda_total_usd }) => setDeudaClienteUsd(Number(deuda_total_usd || 0)))
      .catch(() => setDeudaClienteUsd(0))
      .finally(() => setCargandoDeudaCliente(false))
  }, [clienteSeleccionadoId])

  const clientesFiltrados = busquedaCliente.trim() === ''
    ? []
    : clientes.filter(c => {
        const textoBusqueda = busquedaCliente.toLowerCase()
        const nombreLower = c.nombre.toLowerCase()
        const cedulaLower = (c.cedula_rif || '').toLowerCase()
        return nombreLower.includes(textoBusqueda) || cedulaLower.includes(textoBusqueda)
      })

  const imprimirTicket = (
    ventaId: number,
    itemsVenta: TicketItem[],
    totalUsd: number,
    totalBsVenta: number,
    tasa: number,
    cliente: Cliente | undefined,
    vendedorNombre: string | undefined,
    pagos: {
      efectivoBs: number
      efectivoUsd: number
      tarjeta: number
      transferencia: number
      biopago: number
      creditoUsd: number
    },
    anulada: boolean = false
  ) => {
    const ahora = new Date()
    const fechaStr = ahora.toLocaleDateString('es-VE')
    const horaStr = ahora.toLocaleTimeString('es-VE')

    const padCelda = 2 + (ticketConfig.espaciado * 2)

    const filasItems = itemsVenta.map(item => `
      <tr>
        <td style="text-align:left;padding:2px ${padCelda}px 2px 0;word-break:break-word;">${item.nombre}</td>
        <td style="text-align:center;padding:2px ${padCelda}px;">${item.cantidad}</td>
        <td style="text-align:right;padding:2px ${padCelda}px;">${item.precio.toFixed(2)}</td>
        <td style="text-align:right;padding:2px 0;">${(item.precio * item.cantidad).toFixed(2)}</td>
      </tr>
    `).join('')

    let pagosHtml = ''
    if (pagos.efectivoBs > 0) pagosHtml += `<div>Efectivo Bs: ${formatearBs(pagos.efectivoBs)}</div>`
    if (pagos.efectivoUsd > 0) pagosHtml += `<div>Efectivo $: ${pagos.efectivoUsd.toFixed(2)}</div>`
    if (pagos.tarjeta > 0) pagosHtml += `<div>Tarjeta: ${pagos.tarjeta.toFixed(2)}</div>`
    if (pagos.transferencia > 0) pagosHtml += `<div>Transferencia: ${pagos.transferencia.toFixed(2)}</div>`
    if (pagos.biopago > 0) pagosHtml += `<div>Biopago: ${pagos.biopago.toFixed(2)}</div>`
    if (pagos.creditoUsd > 0) pagosHtml += `<div>Crédito $: ${pagos.creditoUsd.toFixed(2)}</div>`
    if (pagosHtml) pagosHtml = `<div><strong>Forma de Pago:</strong></div>${pagosHtml}`

    const bannerCancelado = anulada
      ? `<div style="text-align:center;border:3px solid #dc2626;color:#dc2626;font-weight:bold;padding:6px;margin:8px 0;font-size:15px;letter-spacing:1px;">*** VENTA CANCELADA ***</div>`
      : ''

    const bannerPendienteSync = ventaId < 0
      ? `<div style="text-align:center;border:2px dashed #b45309;color:#92400e;font-weight:bold;padding:6px;margin:8px 0;font-size:12px;">🔌 GUARDADO SIN CONEXIÓN — PENDIENTE DE SINCRONIZAR</div>`
      : ''

    const html = `
      <html>
      <head>
        <title>Ticket #${ventaId}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: '${ticketConfig.tipo_letra}', monospace; width: 280px; margin: 0 auto; padding: 8px; font-size: ${ticketConfig.tamano_letra}px; color:#000; }
          h2 { text-align:center; margin: 4px 0; font-size: ${ticketConfig.tamano_letra + 4}px; }
          .linea { border-top: 1px dashed #000; margin: 6px 0; }
          table { width:100%; border-collapse: collapse; table-layout: fixed; }
          col.col-producto { width: 46%; }
          col.col-cant { width: 16%; }
          col.col-pu { width: 19%; }
          col.col-subt { width: 19%; }
          .center { text-align:center; }
          .right { text-align:right; }
          .total { font-weight:bold; font-size: ${ticketConfig.tamano_letra + 2}px; }
          @media print {
            body { width: 100%; }
          }
        </style>
      </head>
      <body>
        <h2>${ticketConfig.nombre_negocio}</h2>
        <div class="center">RIF: ${ticketConfig.rif_cedula}</div>
        <div class="center">${ticketConfig.direccion}</div>
        ${ticketConfig.incluir_telefono ? `<div class="center">Tel: ${ticketConfig.telefono}</div>` : ''}
        <div class="center">Ticket N° ${ventaId < 0 ? '(pendiente)' : ventaId}</div>
        <div class="center">${fechaStr} ${horaStr}</div>
        ${bannerCancelado}
        ${bannerPendienteSync}
        <div class="linea"></div>
        <div>Cliente: ${cliente ? cliente.nombre : 'Consumidor Final'}</div>
        <div>Atendido por: ${vendedorNombre || '—'}</div>
        <div class="linea"></div>
        <table>
          <colgroup>
            <col class="col-producto" />
            <col class="col-cant" />
            <col class="col-pu" />
            <col class="col-subt" />
          </colgroup>
          <tr>
            <td style="text-align:left;padding:2px ${padCelda}px 2px 0;"><strong>Producto</strong></td>
            <td style="text-align:center;padding:2px ${padCelda}px;"><strong>Cant</strong></td>
            <td style="text-align:right;padding:2px ${padCelda}px;"><strong>P.U.</strong></td>
            <td style="text-align:right;padding:2px 0;"><strong>Subt.</strong></td>
          </tr>
          ${filasItems}
        </table>
        <div class="linea"></div>
        <div class="right total">TOTAL $ ${totalUsd.toFixed(2)}</div>
        <div class="right total">TOTAL Bs ${formatearBs(totalBsVenta)}</div>
        <div>Tasa del día: ${formatearBs(tasa)}</div>
        <div class="linea"></div>
        ${pagosHtml}
        <div class="linea"></div>
        <div class="center">¡Gracias por su compra!</div>
      </body>
      </html>
    `

    const ventana = window.open('', '_blank', 'width=320,height=600')
    if (!ventana) {
      alert('No se pudo abrir la ventana de impresión. Verifica que tu navegador no esté bloqueando ventanas emergentes.')
      return
    }
    ventana.document.write(html)
    ventana.document.close()
    ventana.onload = () => {
      ventana.focus()
      ventana.print()
    }
  }

  const confirmarVenta = async (imprimir: boolean) => {
    if (Math.abs(restantePago) > 0.01) {
      alert(`El pago no cuadra. ${restantePago > 0 ? 'Faltan' : 'Sobran'} Bs ${formatearBs(Math.abs(restantePago))}`)
      return
    }

    if (items.length === 0) return

    if (!navigator.onLine) {
      guardarVentaOffline(imprimir)
      return
    }

    setProcesandoVenta(true)

    let venta: any = null
    let stockYaDescontado = false

    try {
      const itemsDescuento = items.map(item => ({ id: item.id, cantidad: item.cantidad }))
      const resDescuento = await fetchConTimeout('/api/productos/descontar-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsDescuento }),
      })
      const descuentoData = await resDescuento.json()

      if (descuentoData.error) {
        if (descuentoData.stockInsuficiente) {
          alert(descuentoData.error)
          setProcesandoVenta(false)
          cargarProductos()
          return
        }
        throw new Error(descuentoData.error)
      }
      stockYaDescontado = true

      const resVenta = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total_bs: totalBs,
          total_usd: totalDolares,
          tasa_dolar: tasaEfectiva,
          pago_efectivo_bs: pagoEfectivoBs,
          pago_efectivo_usd: pagoEfectivoUsd,
          pago_tarjeta: pagoTarjeta,
          pago_transferencia: pagoTransferencia,
          pago_biopago: pagoBiopago,
          cliente_id: clienteSeleccionadoId || null,
          vendedor_id: sesion?.id || null,
          vendedor_nombre: sesion?.nombre || null,
          ganancia_usd: gananciaVentaUsd,
          items_snapshot: items.map(item => ({
            producto_id: item.id,
            codigo: item.codigo,
            nombre: item.nombre,
            cantidad: item.cantidad,
            precio_unitario: item.precio,
            subtotal: item.precio * item.cantidad,
          })),
        })
      })
      const ventaResp = await resVenta.json()
      if (ventaResp.error || !ventaResp.data) throw new Error(ventaResp.error || 'sin datos')
      venta = ventaResp.data

    } catch (err) {
      if (stockYaDescontado) {
        const itemsDevolucion = items.map(item => ({ id: item.id, cantidad: -item.cantidad }))
        await fetch('/api/productos/descontar-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsDevolucion }),
        }).catch(() => {})
        alert('Error de conexión al procesar la venta.')
        setProcesandoVenta(false)
        return
      }
      // No se alcanzó ni a descontar el stock en el servidor: probablemente
      // se cayó la conexión justo al vender. Guardamos la venta en el
      // dispositivo para no perderla, en vez de mostrar solo un error.
      setProcesandoVenta(false)
      guardarVentaOffline(imprimir)
      return
    }

    try {
      const itemsParaInsertar = items.map(item => ({
        venta_id: venta.id,
        producto_id: item.id,
        codigo_producto: item.codigo,
        nombre_producto: item.nombre,
        cantidad: item.cantidad,
        precio_unitario: item.precio,
        subtotal: item.precio * item.cantidad,
      }))

      const { error: errorItems } = await fetchConReintento('/api/venta-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemsParaInsertar)
      })
      if (errorItems) {
        alert(`⚠️ La venta #${venta.id} se guardó, pero hubo un error guardando el detalle de productos tras varios intentos: ${errorItems}. El respaldo de los productos quedó guardado en la venta — revisa el ticket #${venta.id} en Ventas y Devoluciones.`)
      }
    } catch (err) {
      alert(`⚠️ La venta #${venta.id} se guardó correctamente, pero hubo un problema de conexión al finalizar el detalle de productos. Verifica manualmente en Ventas y Devoluciones.`)
    }

    const itemsParaTicket = items
    const clienteParaTicket = clienteSeleccionado
    const pagosParaTicket = {
      efectivoBs: pagoEfectivoBs,
      efectivoUsd: pagoEfectivoUsd,
      tarjeta: pagoTarjeta,
      transferencia: pagoTransferencia,
      biopago: pagoBiopago,
      creditoUsd: 0,
    }

    if (imprimir) {
      imprimirTicket(
        venta.id,
        itemsParaTicket,
        totalDolares,
        totalBs,
        tasaEfectiva,
        clienteParaTicket,
        sesion?.nombre,
        pagosParaTicket
      )
    }

    setItems([])
    setItemSeleccionadoId(null)
    setMostrarCobro(false)
    setPagoEfectivoBs(0)
    setPagoEfectivoUsd(0)
    setPagoTarjeta(0)
    setPagoTransferencia(0)
    setPagoBiopago(0)
    setClienteSeleccionadoId('')
    setBusquedaCliente('')
    setMostrarListaClientes(false)
    setProcesandoVenta(false)
    setProductos(prev => prev.map(p => {
      const vendido = itemsParaTicket.find(it => it.id === p.id)
      return vendido ? { ...p, stock: p.stock - vendido.cantidad } : p
    }))
    cargarClientes()
    cargarResumenVender()
  }
const facturarACredito = async () => {
    if (!puedeVentaCredito) {
      alert('No tienes permiso para facturar ventas a crédito')
      return
    }
    if (!clienteSeleccionadoId) {
      alert('Selecciona el cliente al que se le va a fiar')
      return
    }
    if (clienteSeleccionado?.tipo_credito === 'contado') {
      alert('Este cliente es de contado y no se le puede fiar. Si quieres poder fiarle, cambia su tipo de crédito en su ficha (Clientes).')
      return
    }
    if (items.length === 0) return

    if (clienteSeleccionado?.tipo_credito === 'limite' && creditoDisponible !== null && totalDolares > creditoDisponible) {
      alert(`Este cliente solo tiene $${creditoDisponible.toFixed(2)} de crédito disponible`)
      return
    }

    setFacturandoCredito(true)
    let stockYaDescontado = false

    try {
      const itemsDescuento = items.map(item => ({ id: item.id, cantidad: item.cantidad }))
      const resDescuento = await fetchConTimeout('/api/productos/descontar-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsDescuento }),
      })
      const descuentoData = await resDescuento.json()

      if (descuentoData.error) {
        if (descuentoData.stockInsuficiente) {
          alert(descuentoData.error)
          setFacturandoCredito(false)
          cargarProductos()
          return
        }
        throw new Error(descuentoData.error)
      }
      stockYaDescontado = true

      const resPedido = await fetch('/api/creditos-pendientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteSeleccionadoId,
          vendedor_id: sesion?.id || null,
          vendedor_nombre: sesion?.nombre || null,
          items: items.map(item => ({
            producto_id: item.id,
            codigo_producto: item.codigo,
            nombre_producto: item.nombre,
            cantidad: item.cantidad,
          })),
        }),
      })
      const pedidoResp = await resPedido.json()
      if (pedidoResp.error) throw new Error(pedidoResp.error)

      alert(`✅ Se fió a ${clienteSeleccionado?.nombre}. El stock ya fue descontado.`)

      setProductos(prev => prev.map(p => {
        const vendido = items.find(it => it.id === p.id)
        return vendido ? { ...p, stock: p.stock - vendido.cantidad } : p
      }))
      setItems([])
      setItemSeleccionadoId(null)
      setMostrarCobro(false)
      setPagoEfectivoBs(0)
      setPagoEfectivoUsd(0)
      setPagoTarjeta(0)
      setPagoTransferencia(0)
      setPagoBiopago(0)
      setClienteSeleccionadoId('')
      setBusquedaCliente('')
      setMostrarListaClientes(false)
      setDeudaClienteUsd(0)
      cargarClientes()
      cargarResumenVender()
    } catch (err) {
      if (stockYaDescontado) {
        const itemsDevolucion = items.map(item => ({ id: item.id, cantidad: -item.cantidad }))
        await fetch('/api/productos/descontar-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsDevolucion }),
        }).catch(() => {})
      }
      alert('Error al facturar a crédito: ' + (err instanceof Error ? err.message : 'error desconocido'))
    } finally {
      setFacturandoCredito(false)
    }
  }
  const reimprimirUltimoTicket = async () => {
    if (!puedeReimprimir) {
      alert('No tienes permiso para reimprimir tickets')
      return
    }
    setReimprimiendo(true)

    const resVenta = await fetch('/api/ventas?ultima=true')
    const { data: ultimaVentaResp, error: errorVenta } = await resVenta.json()

    if (errorVenta || !ultimaVentaResp) {
      alert('No se encontró ninguna venta para reimprimir.')
      setReimprimiendo(false)
      return
    }

    const resItems = await fetch(`/api/venta-items?venta_id=${ultimaVentaResp.id}`)
    const { data: itemsVenta, error: errorItems } = await resItems.json()

    if (errorItems || !itemsVenta) {
      alert('Error al cargar los productos de la última venta: ' + (errorItems || ''))
      setReimprimiendo(false)
      return
    }

    let clienteDeLaVenta: Cliente | undefined = undefined
    if (ultimaVentaResp.cliente_id) {
      clienteDeLaVenta = clientes.find(c => c.id === ultimaVentaResp.cliente_id)
      if (!clienteDeLaVenta) {
        const resCliente = await fetch(`/api/clientes/${ultimaVentaResp.cliente_id}`)
        const { data: clienteData } = await resCliente.json()
        if (clienteData) clienteDeLaVenta = clienteData
      }
    }

    const itemsParaTicket: TicketItem[] = itemsVenta.map((it: any) => ({
      nombre: it.nombre_producto,
      cantidad: Number(it.cantidad),
      precio: Number(it.precio_unitario),
    }))

    imprimirTicket(
      ultimaVentaResp.id,
      itemsParaTicket,
      Number(ultimaVentaResp.total_usd),
      Number(ultimaVentaResp.total_bs),
      Number(ultimaVentaResp.tasa_dolar),
      clienteDeLaVenta,
      ultimaVentaResp.vendedor_nombre,
      {
        efectivoBs: Number(ultimaVentaResp.pago_efectivo_bs || 0),
        efectivoUsd: Number(ultimaVentaResp.pago_efectivo_usd || 0),
        tarjeta: Number(ultimaVentaResp.pago_tarjeta || 0),
        transferencia: Number(ultimaVentaResp.pago_transferencia || 0),
        biopago: Number(ultimaVentaResp.pago_biopago || 0),
        creditoUsd: Number(ultimaVentaResp.pago_credito_usd || 0),
      },
      ultimaVentaResp.anulada === true
    )

    setReimprimiendo(false)
  }

  const cargarVentasFiltradas = async () => {
    let fechaInicio: string
    let fechaFin: string

    if (modoFecha === 'dia') {
      fechaInicio = fechaFiltro
      fechaFin = fechaFiltro
    } else {
      const [año, mes] = mesFiltro.split('-').map(Number)
      const ultimoDia = new Date(año, mes, 0).getDate()
      fechaInicio = `${mesFiltro}-01`
      fechaFin = `${mesFiltro}-${String(ultimoDia).padStart(2, '0')}`
    }

    const res = await fetch(`/api/ventas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
    const { data } = await res.json()
    setVentasFiltradas(data || [])
  }

  useEffect(() => {
    if (mostrarDevoluciones) {
      cargarVentasFiltradas()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarDevoluciones, modoFecha, fechaFiltro, mesFiltro])

  const abrirDevoluciones = () => {
    setFolioBuscado('')
    setVentaParaAnular(null)
    setItemsVentaParaAnular([])
    setModoFecha('dia')
    setFechaFiltro(obtenerFechaLocal())
    setMostrarDevoluciones(true)
  }

  const buscarVentaPorFolio = async (folio: string) => {
    const idNumerico = parseInt(folio)
    if (!idNumerico || isNaN(idNumerico)) {
      alert('Ingresa un número de ticket válido')
      return
    }
    await cargarVentaParaAnular(idNumerico)
  }

  const cargarVentaParaAnular = async (ventaId: number) => {
    setBuscandoVenta(true)
    const resVenta = await fetch(`/api/ventas/${ventaId}`)
    const { data: venta, error: errorVenta } = await resVenta.json()

    if (errorVenta || !venta) {
      alert('No se encontró ningún ticket con ese número.')
      setVentaParaAnular(null)
      setItemsVentaParaAnular([])
      setBuscandoVenta(false)
      return
    }

    const resItems = await fetch(`/api/venta-items?venta_id=${ventaId}`)
    const { data: itemsVenta, error: errorItems } = await resItems.json()

    if (errorItems) {
      alert('Error al cargar los productos del ticket: ' + errorItems)
      setBuscandoVenta(false)
      return
    }

    setVentaParaAnular(venta)
    setItemsVentaParaAnular(itemsVenta || [])
    setBuscandoVenta(false)
  }

  const anularVenta = async () => {
    if (!puedeCancelarVentas) {
      alert('No tienes permiso para anular ventas')
      return
    }
    if (!ventaParaAnular || ventaParaAnular.anulada) return

    const confirmar = confirm(
      `¿Anular el Ticket #${ventaParaAnular.id}?\n\nEsto devolverá ${itemsVentaParaAnular.length} producto(s) al inventario y la venta quedará marcada como CANCELADA (dejará de contar en reportes y créditos, pero se podrá seguir consultando). Esta acción no se puede deshacer.`
    )
    if (!confirmar) return

    setProcesandoAnulacion(true)

    const idsDevolucion = itemsVentaParaAnular.map(it => it.producto_id).join(',')
    const resProductosActuales = await fetch(`/api/productos?ids=${idsDevolucion}`)
    const { data: productosActuales } = await resProductosActuales.json()

    const itemsDevolucion = itemsVentaParaAnular.map(item => ({
      id: item.producto_id,
      cantidad: -Number(item.cantidad),
    }))
    const resDevolucion = await fetch('/api/productos/descontar-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: itemsDevolucion }),
    })
    const { error: errorDevolucion } = await resDevolucion.json()
    if (errorDevolucion) {
      alert('Error devolviendo stock al inventario: ' + errorDevolucion)
    }

    const resAnular = await fetch(`/api/ventas/${ventaParaAnular.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anulada: true })
    })
    const { error: errorAnular } = await resAnular.json()

    if (errorAnular) {
      alert('Error al anular la venta: ' + errorAnular)
      setProcesandoAnulacion(false)
      return
    }

    alert(`Ticket #${ventaParaAnular.id} anulado ✅. El stock ya fue devuelto al inventario.`)

    setVentaParaAnular({ ...ventaParaAnular, anulada: true })
    setProcesandoAnulacion(false)
    setProductos(prev => prev.map(p => {
      const devuelto = itemsVentaParaAnular.find((it: any) => it.producto_id === p.id)
      return devuelto ? { ...p, stock: p.stock + Number(devuelto.cantidad) } : p
    }))
    cargarClientes()
    cargarVentasFiltradas()
  }

  const imprimirCopiaTicket = (venta: any, itemsVenta: any[]) => {
    if (!puedeReimprimir) {
      alert('No tienes permiso para reimprimir tickets')
      return
    }
    let clienteDeLaVenta: Cliente | undefined = undefined
    if (venta.cliente_id) {
      clienteDeLaVenta = clientes.find(c => c.id === venta.cliente_id)
    }

    const itemsParaTicket: TicketItem[] = itemsVenta.map((it: any) => ({
      nombre: it.nombre_producto,
      cantidad: Number(it.cantidad),
      precio: Number(it.precio_unitario),
    }))

    imprimirTicket(
      venta.id,
      itemsParaTicket,
      Number(venta.total_usd),
      Number(venta.total_bs),
      Number(venta.tasa_dolar),
      clienteDeLaVenta,
      venta.vendedor_nombre,
      {
        efectivoBs: Number(venta.pago_efectivo_bs || 0),
        efectivoUsd: Number(venta.pago_efectivo_usd || 0),
        tarjeta: Number(venta.pago_tarjeta || 0),
        transferencia: Number(venta.pago_transferencia || 0),
        biopago: Number(venta.pago_biopago || 0),
        creditoUsd: Number(venta.pago_credito_usd || 0),
      },
      venta.anulada === true
    )
  }

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const elementoActivo = document.activeElement as HTMLElement | null
      const escribiendoEnCampoNumero =
        elementoActivo?.tagName === 'INPUT' &&
        (elementoActivo as HTMLInputElement).type === 'number'
      const escaneoActivo =
        !mostrarCalculadora &&
        !mostrarEditar &&
        !mostrarCobro &&
        !mostrarDevoluciones &&
        !mostrarCambiarTasa &&
        !escribiendoEnCampoNumero
        && !mostrarEscanerCamara

      if (escaneoActivo) {
        const ahora = Date.now()
        const tiempoDesdeUltimaTecla = ahora - scannerUltimaTeclaRef.current
        scannerUltimaTeclaRef.current = ahora

        if (tiempoDesdeUltimaTecla > 60) {
          scannerBufferRef.current = ''
        }

        if (e.key === 'Enter') {
          const codigoEscaneado = scannerBufferRef.current
          scannerBufferRef.current = ''
          if (codigoEscaneado.length >= 3) {
            e.preventDefault()
            e.stopPropagation()
            if (mostrarVerificadorPrecio) {
              verificarPrecioPorCodigo(codigoEscaneado)
            } else {
              buscarYAgregarPorCodigo(codigoEscaneado)
            }
            return
          }
        } else if (e.key.length === 1) {
          scannerBufferRef.current += e.key
        }
      }

      if (mostrarCalculadora) {
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault()
          calcPresionarTecla(e.key)
        } else if (['+', '-', '*', '/', '.'].includes(e.key)) {
          e.preventDefault()
          calcPresionarTecla(e.key)
        } else if (e.key === 'Enter' || e.key === '=') {
          e.preventDefault()
          calcPresionarTecla('=')
        } else if (e.key === 'Backspace') {
          e.preventDefault()
          calcPresionarTecla('⌫')
        } else if (e.key.toLowerCase() === 'c') {
          e.preventDefault()
          calcPresionarTecla('C')
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setMostrarCalculadora(false)
        }
        return
      }

      if (e.key === 'F1') {
        e.preventDefault()
        if (mostrarCobro) {
          if (Math.abs(restantePago) < 0.01 && !procesandoVenta) {
            confirmarVenta(true)
          }
        }
      }
      if (e.key === 'F2') {
        e.preventDefault()
        if (mostrarCobro) {
          if (Math.abs(restantePago) < 0.01 && !procesandoVenta) {
            confirmarVenta(false)
          }
        }
      }
      if (e.key === 'F10') {
        e.preventDefault()
        if (!mostrarCobro && !mostrarVerificadorPrecio) {
          setMostrarBuscador(true)
          setTimeout(() => inputBusquedaRef.current?.focus(), 100)
        }
      }
      if (e.key === 'F11') {
        e.preventDefault()
        if (!mostrarCobro && !mostrarBuscador && !mostrarDevoluciones && !mostrarVerificadorPrecio) {
          if (!itemSeleccionadoId) {
            alert('Primero selecciona un producto de la lista haciendo clic sobre su fila')
            return
          }
          alternarPrecioMayor(itemSeleccionadoId)
        }
      }
      if (e.key === 'F3') {
        e.preventDefault()
        if (mostrarVerificadorPrecio) {
          cerrarVerificadorPrecio()
        } else if (!mostrarCobro && !mostrarBuscador && !mostrarDevoluciones && !mostrarEditar && !mostrarCalculadora) {
          abrirVerificadorPrecio()
        }
      }
      if (e.key === 'F12') {
        e.preventDefault()
        if (items.length > 0 && !mostrarCobro && !mostrarVerificadorPrecio) {
          setPagoEfectivoBs(0)
          setPagoEfectivoUsd(0)
          setPagoTarjeta(0)
          setPagoTransferencia(0)
          setPagoBiopago(0)
          setClienteSeleccionadoId('')
          setBusquedaCliente('')
          setMostrarListaClientes(false)
          setMostrarCobro(true)
        }
      }
      if (e.key === 'F5') {
        e.preventDefault()
        if (!mostrarCobro && !mostrarBuscador && !mostrarDevoluciones && !mostrarVerificadorPrecio && !reimprimiendo) {
          reimprimirUltimoTicket()
        }
      }
      if (e.key === 'F6') {
        e.preventDefault()
        if (!mostrarCobro && !mostrarBuscador && !mostrarVerificadorPrecio) {
          abrirDevoluciones()
        }
      }
      if (e.key === 'F8') {
        e.preventDefault()
        if (items.length > 0 && !mostrarCobro && !mostrarBuscador && !mostrarVerificadorPrecio && !mostrarDevoluciones) {
          setMostrarGuardarTicket(true)
        }
      }
      if (e.key === 'F9') {
        e.preventDefault()
        if (!mostrarCobro && !mostrarBuscador && !mostrarVerificadorPrecio && !mostrarDevoluciones) {
          setMostrarBuscarTickets(true)
        }
      }
      if (e.key === 'Escape') {
        setMostrarBuscador(false)
        setMostrarCobro(false)
        setMostrarEditar(false)
        setMostrarDevoluciones(false)
        setMostrarGuardarTicket(false)
        setMostrarBuscarTickets(false)
        setMostrarCambiarTasa(false)
        cerrarVerificadorPrecio()
      }
      
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [
    items,
    itemSeleccionadoId,
    mostrarCobro,
    mostrarBuscador,
    mostrarDevoluciones,
    mostrarEditar,
    mostrarVerificadorPrecio,
    mostrarCalculadora,
    mostrarCambiarTasa,
    calcExpresion,
    reimprimiendo,
    restantePago,
    procesandoVenta,
    clienteSeleccionadoId,
    pagoEfectivoBs,
    pagoEfectivoUsd,
    pagoTarjeta,
    pagoTransferencia,
    pagoBiopago,
    productos,
  ])

  if (verificandoSesion) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '18px' }}>
        Verificando sesión...
      </div>
    )
  }

  const hayStockBajo = productosStockBajo.length > 0
  const textoTicker = hayStockBajo
    ? productosStockBajo.map(p => `${p.nombre} (${p.stock})`).join('   •   ')
    : 'SIN PRODUCTOS EN STOCK BAJO'

  const hayVentaPendienteAntigua = ventasPendientes.some(
    (v) => Date.now() - new Date(v.creadaEn).getTime() > 24 * 60 * 60 * 1000
  )

  return (
    <div style={styles.container} className="contenedor-principal-movil">
      {estiloBotonBuscarMovil}
          <style>{`
        @keyframes scanToastEntrada {
          from { opacity: 0; transform: translate(-50%, -14px) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        @keyframes scanPulso {
          0% { box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.45); }
          70% { box-shadow: 0 0 0 10px rgba(5, 150, 105, 0); }
          100% { box-shadow: 0 0 0 0 rgba(5, 150, 105, 0); }
        }
        @keyframes desplazarLedVender {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ledMiniVender {
          background: #000;
          border-radius: 7px;
          padding: 5px 0;
          flex: 1 1 auto;
          min-width: 150px;
          overflow: hidden;
          position: relative;
          box-shadow: inset 0 2px 5px rgba(0,0,0,0.8);
        }
        .ledMiniVenderScanlines {
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 3px);
          pointer-events: none;
        }
        .ledMiniVenderFade {
          -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
        }
        .ledMiniVenderTicker {
          display: inline-block;
          white-space: nowrap;
          animation: desplazarLedVender 12s linear infinite;
        }
        .ledMiniVenderTexto {
          color: #4ade80;
          font-family: "Courier New", monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          padding-left: 14px;
          text-shadow: 0 0 5px rgba(74,222,128,0.85);
        }
        @keyframes pulsoConexion {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
        .pulsoIconoConexion {
          display: inline-block;
          animation: pulsoConexion 1.4s ease-in-out infinite;
        }
      `}</style>

      {!estaOnline && (
        <div
          style={{
            position: 'sticky' as const,
            top: 0,
            zIndex: 1500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap' as const,
            gap: '10px',
            padding: '10px 16px',
            background: hayVentaPendienteAntigua
              ? 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)'
              : 'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
            color: 'white',
            fontSize: '13px',
            fontWeight: 600 as const,
            textAlign: 'center' as const,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <span className="pulsoIconoConexion" style={{ fontSize: '16px' }}>🔌</span>
          <span>
            Sin conexión a internet — puedes seguir vendiendo con normalidad.
            {ventasPendientes.length > 0 && ` Tienes ${ventasPendientes.length} venta${ventasPendientes.length === 1 ? '' : 's'} guardada${ventasPendientes.length === 1 ? '' : 's'} en este dispositivo.`}
            {' '}Se sincronizarán solas en cuanto vuelva la señal.
            {hayVentaPendienteAntigua && ' ⚠️ Hay ventas guardadas hace más de 24h — revisa la conexión de este dispositivo.'}
          </span>
        </div>
      )}

      {estaOnline && ventasPendientes.length > 0 && (
        <div
          style={{
            position: 'sticky' as const,
            top: 0,
            zIndex: 1500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap' as const,
            gap: '12px',
            padding: '10px 16px',
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            color: 'white',
            fontSize: '13px',
            fontWeight: 600 as const,
            textAlign: 'center' as const,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <span className={sincronizandoVentas ? 'pulsoIconoConexion' : ''} style={{ fontSize: '16px' }}>🔄</span>
          <span>
            {sincronizandoVentas
              ? 'Sincronizando tus ventas guardadas...'
              : `${ventasPendientes.length} venta${ventasPendientes.length === 1 ? '' : 's'} guardada${ventasPendientes.length === 1 ? '' : 's'} sin subir todavía.`}
          </span>
          {!sincronizandoVentas && (
            <button
              onClick={sincronizarVentasPendientes}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.5)',
                color: 'white',
                borderRadius: '8px',
                padding: '4px 12px',
                fontWeight: 700 as const,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Sincronizar ahora
            </button>
          )}
        </div>
      )}

      {scanFeedback && (
        <div
          style={{
            position: 'fixed' as const,
            top: '18px',
            left: '50%',
            transform: 'translate(-50%, 0)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 20px',
            borderRadius: '12px',
            fontWeight: 700 as const,
            fontSize: '16px',
            color: 'white',
            backgroundColor: scanFeedback.tipo === 'exito' ? '#059669' : '#dc2626',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
            animation: 'scanToastEntrada 0.2s ease-out, scanPulso 0.6s ease-out',
          }}
        >
          <span style={{ fontSize: '20px' }}>
            {scanFeedback.tipo === 'exito' ? '📷✅' : '📷⚠️'}
          </span>
          {scanFeedback.mensaje}
        </div>
      )}

      {toastSync && (
        <div
          style={{
            position: 'fixed' as const,
            bottom: '24px',
            left: '50%',
            transform: 'translate(-50%, 0)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 20px',
            borderRadius: '12px',
            fontWeight: 700 as const,
            fontSize: '14px',
            color: 'white',
            backgroundColor: toastSync.tipo === 'exito' ? '#059669' : '#dc2626',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
            animation: 'scanToastEntrada 0.2s ease-out',
            maxWidth: '90vw',
            textAlign: 'center' as const,
          }}
        >
          {toastSync.mensaje}
        </div>
      )}

      <div style={styles.header} className="header-desktop-vender">
        <div style={styles.headerUnica}>
          <span style={styles.resumenItem}>
            💵 <strong>{ultimaVenta ? `$${ultimaVenta.total_usd.toFixed(2)}` : '—'}</strong>
            {ultimaVenta && <span style={styles.resumenSub}> · {formatearHaceTiempo(ultimaVenta.created_at)}</span>}
          </span>
          <span style={styles.resumenSeparador}>·</span>
          <span style={styles.resumenItem}>
            ⏳ <strong>{ultimaVentaCredito ? `$${(ultimaVentaCredito.pago_credito_usd || 0).toFixed(2)}` : '—'}</strong>
            {ultimaVentaCredito && <span style={styles.resumenSub}> · {ultimaVentaCredito.clientes?.nombre || 'Cliente'}</span>}
          </span>
          <span style={styles.resumenSeparador}>·</span>

          {(!estaOnline || ventasPendientes.length > 0) && (
            <>
              <span
                className={!estaOnline || sincronizandoVentas ? 'pulsoIconoConexion' : ''}
                style={{
                  ...styles.resumenItem,
                  color: estaOnline ? '#92400e' : '#dc2626',
                  fontWeight: 700,
                }}
                title={estaOnline ? 'Subiendo ventas guardadas sin conexión' : 'Sin conexión a internet'}
              >
                {estaOnline ? '🔄' : '🔌'} {ventasPendientes.length > 0 ? `${ventasPendientes.length} sin subir` : 'Sin conexión'}
              </span>
              <span style={styles.resumenSeparador}>·</span>
            </>
          )}

          <div className="ledMiniVender">
            <div className="ledMiniVenderScanlines" />
            <div className="ledMiniVenderFade">
              <div className="ledMiniVenderTicker">
                <span className="ledMiniVenderTexto">{textoTicker}{'   •   '}{textoTicker}</span>
              </div>
            </div>
          </div>

          <span style={styles.resumenSeparador}>·</span>

          <button
            onClick={() => {
              setMostrarBuscador(true)
              setTimeout(() => inputBusquedaRef.current?.focus(), 100)
            }}
            style={{ ...styles.botonSecundarioHeader, backgroundColor: '#e0f2fe', color: '#0369a1' }}
          >
            🔍 Buscar Producto [F10]
          </button>
          {puedeReimprimir && (
            <button
              onClick={reimprimirUltimoTicket}
              style={styles.botonSecundarioHeader}
              disabled={reimprimiendo}
            >
              🖨️ {reimprimiendo ? 'Imprimiendo...' : 'Reimprimir [F5]'}
            </button>
          )}
          {puedeAplicarMayoreo && (
            <button
              onClick={() => {
                if (!itemSeleccionadoId) {
                  alert('Primero selecciona un producto de la lista haciendo clic sobre su fila')
                  return
                }
                alternarPrecioMayor(itemSeleccionadoId)
              }}
              style={{ ...styles.botonSecundarioHeader, backgroundColor: '#dbeafe', color: '#1d4ed8' }}
              disabled={items.length === 0}
            >
              🏷️ Mayoreo [F11]
            </button>
          )}
          <button
            onClick={abrirDevoluciones}
            style={styles.botonSecundarioHeader}
          >
            🧾 Devoluciones [F6]
          </button>
          <button
  onClick={() => setMostrarCalculadora(true)}
  style={{ ...styles.botonSecundarioHeader, backgroundColor: '#ede9fe', color: '#6d28d9' }}
>
  🧮 Calculadora
</button>
<span
  style={{
    ...styles.botonSecundarioHeader,
    backgroundColor: '#fef3c7',
    color: '#92400e',
    cursor: 'default',
  }}
>
  💱 Tasa: {tasaDolar > 0 ? tasaDolar.toFixed(2) : '—'}
</span>
<button
  onClick={() => {
    setMostrarBuscador(true)
    setTimeout(() => inputBusquedaRef.current?.focus(), 100)
  }}
  style={{ ...styles.botonSecundarioHeader, backgroundColor: '#e0f2fe', color: '#0369a1' }}
>
  🔍 Buscar Producto [F10]
</button>
<button
  onClick={() => setMostrarEscanerCamara(true)}
  style={{ ...styles.botonSecundarioHeader, backgroundColor: '#dcfce7', color: '#166534' }}
>
  📷 Escanear
</button>
        </div>
      </div>

      <div style={styles.tablaContainer} className="tabla-desktop-pos">
        <div style={styles.tablaHeader}>
          <div style={{ ...styles.col, flex: '0 0 90px' }}>Código</div>
          <div style={{ ...styles.col, flex: '1' }}>Descripción</div>
          <div style={{ ...styles.col, flex: '0 0 90px', textAlign: 'center' }}>Stock</div>
          <div style={{ ...styles.col, flex: '0 0 130px', textAlign: 'right' }}>Precio $</div>
          <div style={{ ...styles.col, flex: '0 0 130px', textAlign: 'right' }}>Cantidad</div>
          <div style={{ ...styles.col, flex: '0 0 130px', textAlign: 'right' }}>Importe $</div>
          <div style={{ ...styles.col, flex: '0 0 55px' }}></div>
        </div>

        <div style={styles.tablaBody}>
          {items.length === 0 ? (
            <div style={styles.tablaVacia}>
              <p>Presiona <strong>F10</strong> para buscar productos, o escanea un código de barras</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                onClick={() => setItemSeleccionadoId(item.id)}
                style={{
                  ...styles.tablaRow,
                  cursor: 'pointer',
                  backgroundColor: itemSeleccionadoId === item.id ? '#eff6ff' : 'white',
                  outline: itemSeleccionadoId === item.id ? '2px solid #93c5fd' : 'none',
                  outlineOffset: '-2px',
                }}
              >
                <div style={{ ...styles.col, flex: '0 0 90px' }}>{item.codigo}</div>
                <div style={{ ...styles.col, flex: '1' }}>{item.nombre}</div>
                <div style={{ ...styles.col, flex: '0 0 90px', textAlign: 'center' }}>
                  <span style={{
                    backgroundColor: item.stock > 10 ? '#dcfce7' : '#fee2e2',
                    color: item.stock > 10 ? '#166534' : '#dc2626',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '15px',
                    fontWeight: '600'
                  }}>
                    {item.stock}
                  </span>
                </div>
                <div style={{
                  ...styles.col,
                  flex: '0 0 130px',
                  textAlign: 'right',
                  fontWeight: '600',
                  color: (item.precio === item.precio_mayoreo && item.precio_mayoreo > 0) ? '#2563eb' : '#059669'
                }}>
                  {item.precio.toFixed(2)}
                </div>
                <div style={{ ...styles.col, flex: '0 0 130px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="number"
                    value={item.cantidad}
                    onChange={(e) => cambiarCantidad(item.id, parseFloat(e.target.value) || 0)}
                    style={styles.inputCantidad}
                    step="0.001"
                    max={item.stock}
                  />
                </div>
                <div style={{ ...styles.col, flex: '0 0 130px', textAlign: 'right', fontWeight: '600' }}>
                  {(item.precio * item.cantidad).toFixed(2)}
                </div>
                <div style={{ ...styles.col, flex: '0 0 55px', textAlign: 'center' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      eliminarItem(item.id)
                    }}
                    style={styles.botonEliminar}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="carrito-movil">
        {items.length === 0 ? (
          <div className="estado-vacio-movil" style={{ textAlign: 'center', color: '#9ca3af', padding: '30px 10px' }}>
            Toca "Buscar Producto" para agregar artículos
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="tarjeta-item-movil">
              <div className="tarjeta-item-movil-nombre">{item.nombre}</div>
              <div className="tarjeta-item-movil-codigo">{item.codigo} · Stock: {item.stock}</div>
              <div className="tarjeta-item-movil-fila">
                <div className="stepper-cantidad">
                  <button className="stepper-boton" onClick={() => cambiarCantidad(item.id, item.cantidad - 1)}>−</button>
                  <span className="stepper-valor">{item.cantidad}</span>
                  <button className="stepper-boton" onClick={() => cambiarCantidad(item.id, item.cantidad + 1)}>+</button>
                </div>
                {puedeAplicarMayoreo && item.precio_mayoreo > 0 && (
                  <button
                    className="toggle-mayoreo-movil"
                    onClick={() => alternarPrecioMayor(item.id)}
                    style={{
                      backgroundColor: item.precio === item.precio_mayoreo ? '#2563eb' : '#dbeafe',
                      color: item.precio === item.precio_mayoreo ? 'white' : '#1d4ed8',
                    }}
                  >
                    {item.precio === item.precio_mayoreo ? '✓ Mayoreo' : 'Mayoreo'}
                  </button>
                )}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#059669' }}>
                    $ {(item.precio * item.cantidad).toFixed(2)}
                  </div>
                  <button
                    onClick={() => eliminarItem(item.id)}
                    style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div style={styles.footer} className="footer-movil">
        <div style={styles.totalContainer} className="total-container-movil">
          <div>
            <span style={styles.totalLabel}>TOTAL $</span>
            <span style={styles.totalValor} className="total-valor-movil">{totalDolares.toFixed(2)}</span>
          </div>
          <div>
            <span style={styles.totalLabel}>TOTAL Bs</span>
            <span style={styles.totalValorBs} className="total-valor-movil">{formatearBs(totalBs)}</span>
          </div>
        </div>
        <div style={styles.botonesFooter} className="botones-footer-movil">
          <button
            onClick={() => {
              setMostrarBuscador(true)
              setTimeout(() => inputBusquedaRef.current?.focus(), 100)
            }}
            className="boton-buscar-movil"
            style={{ ...styles.botonCobrar, backgroundColor: '#2563eb' }}
          >
            🔍 Buscar Producto
          </button>
          <button
            onClick={() => setMostrarBuscarTickets(true)}
            className="boton-oculto-movil"
            style={{ ...styles.botonCancelar, backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}
          >
            🔍 Buscar Ticket [F9]
          </button>
          <button
            onClick={() => setMostrarEscanerCamara(true)}
            className="boton-buscar-movil"
            style={{ ...styles.botonCobrar, backgroundColor: '#059669' }}
          >
            📷 Escanear
          </button>
          <button
            onClick={() => setMostrarGuardarTicket(true)}
            className="boton-oculto-movil"
            style={{ ...styles.botonCancelar, backgroundColor: '#fffbeb', color: '#92400e', borderColor: '#fde68a' }}
            disabled={items.length === 0}
          >
            💾 Guardar Ticket [F8]
          </button>
          <button
            onClick={cancelarVenta}
            className="boton-oculto-movil"
            style={styles.botonCancelar}
            disabled={items.length === 0}
          >
            [ESC] Cancelar Venta
          </button>
          <button
            onClick={() => {
              setPagoEfectivoBs(0)
              setPagoEfectivoUsd(0)
              setPagoTarjeta(0)
              setPagoTransferencia(0)
              setPagoBiopago(0)
              setClienteSeleccionadoId('')
              setBusquedaCliente('')
              setMostrarListaClientes(false)
              setMostrarCobro(true)
            }}
            style={styles.botonCobrar}
            className="boton-cobrar-movil"
            disabled={items.length === 0}
          >
            [F12] COBRAR
          </button>
        </div>
      </div>

      {mostrarBuscador && (
        <div style={styles.modal} onClick={() => setMostrarBuscador(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2>Buscar Producto - F10</h2>
              <button onClick={() => setMostrarBuscador(false)} style={styles.botonCerrar}>✕</button>
            </div>
            <input
              ref={inputBusquedaRef}
              type="text"
              placeholder="Escribe código o nombre, o escanea un código de barras..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={styles.inputBusqueda}
              autoFocus
            />
            <div style={styles.listaProductos}>
              {terminosBusqueda.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px', fontSize: '16px' }}>
                  Escribe el nombre, una palabra o el código del producto para buscar
                </p>
              ) : cargandoProductos ? (
                <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px', fontSize: '16px' }}>Cargando productos...</p>
              ) : productosFiltrados.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px', fontSize: '16px' }}>No se encontraron productos</p>
              ) : (
                productosFiltrados.map((p) => (
                  <div key={p.id} style={styles.itemProducto}>
                    <div onClick={() => agregarProducto(p)} style={{ flex: 1, cursor: 'pointer' }}>
                      <span style={styles.codigoProducto}>{p.codigo}</span>
                      <span style={styles.nombreProducto}>{p.nombre}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={styles.precioProducto}>$ {p.precio.toFixed(2)}</span>
                        <span style={{ ...styles.stockProducto, color: '#2563eb', display: 'block', fontWeight: '600' }}>
                          Bs {formatearBs(p.precio * tasaEfectiva)}
                        </span>
                        <span style={{ fontSize: '14px', color: '#6b7280', display: 'block' }}>
                          Mayor: $ {p.precio_mayoreo?.toFixed(2) || '0.00'} (Bs {formatearBs((p.precio_mayoreo || 0) * tasaEfectiva)})
                        </span>
                        <span style={styles.stockProducto}>Stock: {p.stock}</span>
                      </div>
                      {puedeEditarProductos && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            abrirEditarProducto(p)
                          }}
                          style={styles.botonEditar}
                        >
                          ✏️ Editar
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {mostrarVerificadorPrecio && (
        <div style={styles.modal} onClick={cerrarVerificadorPrecio}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...styles.modalHeader, background: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)', color: 'white' }}>
              <h2 style={{ margin: 0 }}>💲 Verificar Precio - F3</h2>
              <button
                onClick={cerrarVerificadorPrecio}
                style={{ ...styles.botonCerrar, backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
              >✕</button>
            </div>
            <input
              ref={inputVerificadorRef}
              type="text"
              placeholder="Escribe código o nombre, o escanea un código de barras..."
              value={busquedaPrecio}
              onChange={(e) => {
                setBusquedaPrecio(e.target.value)
                setProductoVerificado(null)
              }}
              style={styles.inputBusqueda}
              autoFocus
            />

            {productoVerificado ? (
              <div style={{ padding: '0 24px 24px' }}>
                <div style={{
                  border: '2px solid #bae6fd',
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  borderRadius: '14px',
                  padding: '22px',
                  textAlign: 'center' as const,
                }}>
                  <div style={{ fontSize: '13px', color: '#0369a1', fontWeight: 700 as const, marginBottom: '2px' }}>
                    {productoVerificado.codigo}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800 as const, color: '#111827', marginBottom: '14px' }}>
                    {productoVerificado.nombre}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '28px', flexWrap: 'wrap' as const }}>
                    <div>
                      <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600 as const }}>Precio Detalle</div>
                      <div style={{ fontSize: '30px', fontWeight: 800 as const, color: '#059669' }}>
                        $ {productoVerificado.precio.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '15px', color: '#2563eb', fontWeight: 700 as const }}>
                        Bs {formatearBs(productoVerificado.precio * tasaEfectiva)}
                      </div>
                    </div>
                    {productoVerificado.precio_mayoreo > 0 && (
                      <div>
                        <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600 as const }}>Precio Mayoreo</div>
                        <div style={{ fontSize: '30px', fontWeight: 800 as const, color: '#7c3aed' }}>
                          $ {productoVerificado.precio_mayoreo.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '15px', color: '#2563eb', fontWeight: 700 as const }}>
                          Bs {formatearBs(productoVerificado.precio_mayoreo * tasaEfectiva)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: '14px', fontSize: '14px', color: '#6b7280' }}>
                    Stock disponible: <strong>{productoVerificado.stock}</strong>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setBusquedaPrecio('')
                    setProductoVerificado(null)
                    inputVerificadorRef.current?.focus()
                  }}
                  style={{ ...styles.botonCancelar, width: '100%', marginTop: '14px' }}
                >
                  🔍 Buscar otro producto
                </button>
              </div>
            ) : (
              <div style={styles.listaProductos}>
                {terminosBusquedaPrecio.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px', fontSize: '16px' }}>
                    Escribe el nombre, una palabra o el código del producto, o escanéalo, para ver su precio
                  </p>
                ) : cargandoProductos ? (
                  <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px', fontSize: '16px' }}>Cargando productos...</p>
                ) : productosFiltradosPrecio.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px', fontSize: '16px' }}>No se encontraron productos</p>
                ) : (
                  productosFiltradosPrecio.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setProductoVerificado(p)}
                      style={{ ...styles.itemProducto, cursor: 'pointer' }}
                    >
                      <div style={{ flex: 1 }}>
                        <span style={styles.codigoProducto}>{p.codigo}</span>
                        <span style={styles.nombreProducto}>{p.nombre}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={styles.precioProducto}>$ {p.precio.toFixed(2)}</span>
                        <span style={{ ...styles.stockProducto, color: '#2563eb', display: 'block', fontWeight: '600' }}>
                          Bs {formatearBs(p.precio * tasaEfectiva)}
                        </span>
                        <span style={styles.stockProducto}>Stock: {p.stock}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {mostrarEditar && productoEditando && (
        <div style={styles.modal} onClick={() => setMostrarEditar(false)}>
          <div style={estilosEditar.modalEditar} onClick={(e) => e.stopPropagation()}>
            <div style={estilosEditar.headerEditar}>
              <h2 style={estilosEditar.tituloEditar}>✏️ Editar Producto</h2>
              <button onClick={() => setMostrarEditar(false)} style={estilosEditar.botonCerrarEditar}>✕</button>
            </div>

            <div style={estilosEditar.cuerpoEditar}>
              <div style={estilosEditar.campoAncho}>
                <label style={estilosEditar.labelEditar}>Nombre del producto</label>
                <input
                  type="text"
                  value={productoEditando.nombre}
                  onChange={(e) => setProductoEditando({ ...productoEditando, nombre: e.target.value })}
                  style={estilosEditar.inputEditar}
                />
              </div>

              <div style={estilosEditar.grilla2}>
                <div>
                  <label style={estilosEditar.labelEditar}>Código</label>
                  <input
                    type="text"
                    value={productoEditando.codigo}
                    onChange={(e) => setProductoEditando({ ...productoEditando, codigo: e.target.value })}
                    style={estilosEditar.inputEditar}
                  />
                </div>
                <div>
                  <label style={estilosEditar.labelEditar}>Stock actual</label>
                  <input
                    type="number"
                    value={productoEditando.stock}
                    onChange={(e) => setProductoEditando({ ...productoEditando, stock: parseInt(e.target.value) || 0 })}
                    style={estilosEditar.inputEditar}
                    min="0"
                  />
                </div>
              </div>

              <div style={estilosEditar.grilla2}>
                <div>
                  <label style={estilosEditar.labelEditar}>Precio Detalle $</label>
                  <input
                    type="number"
                    value={productoEditando.precio}
                    onChange={(e) => setProductoEditando({ ...productoEditando, precio: parseFloat(e.target.value) || 0 })}
                    style={estilosEditar.inputEditar}
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label style={estilosEditar.labelEditar}>Precio Mayoreo $</label>
                  <input
                    type="number"
                    value={productoEditando.precio_mayoreo || 0}
                    onChange={(e) => setProductoEditando({ ...productoEditando, precio_mayoreo: parseFloat(e.target.value) || 0 })}
                    style={estilosEditar.inputEditar}
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              <div style={estilosEditar.grilla2}>
                {puedeEditarPrecioCosto && (
                  <div>
                    <label style={estilosEditar.labelEditar}>Precio Costo $</label>
                    <input
                      type="number"
                      value={productoEditando.precio_costo || 0}
                      onChange={(e) => setProductoEditando({ ...productoEditando, precio_costo: parseFloat(e.target.value) || 0 })}
                      style={estilosEditar.inputEditar}
                      step="0.01"
                      min="0"
                    />
                  </div>
                )}
                <div>
                  <label style={estilosEditar.labelEditar}>Stock Mínimo ⚠️</label>
                  <input
                    type="number"
                    value={productoEditando.stock_minimo ?? 5}
                    onChange={(e) => setProductoEditando({ ...productoEditando, stock_minimo: parseInt(e.target.value) || 0 })}
                    style={estilosEditar.inputEditar}
                    min="0"
                  />
                </div>
              </div>
            </div>

            <div style={estilosEditar.piePagina}>
              <button onClick={() => setMostrarEditar(false)} style={estilosEditar.botonCancelarEditar}>
                Cancelar
              </button>
              <button onClick={guardarProductoEditado} style={estilosEditar.botonGuardarEditar}>
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarCobro && (
        <div style={styles.modal} className="cobro-overlay-mobile">
          <div style={{
            ...styles.modalContentSmall,
            maxWidth: '900px',
            width: '94%',
            display: 'flex',
            flexDirection: 'column' as const,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }} className="cobro-modal-mobile">
            <div style={{
              ...styles.modalHeader,
              padding: '18px 24px',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: 'white',
              borderRadius: '16px 16px 0 0',
              borderBottom: 'none',
              flexShrink: 0
            }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>
                💳 Cobro Múltiple
              </h2>
              <button onClick={() => !procesandoVenta && setMostrarCobro(false)} style={{
                ...styles.botonCerrar,
                width: '30px',
                height: '30px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white'
              }}>✕</button>
            </div>

            <div style={{ padding: '28px 32px', display: 'grid', gridTemplateColumns: '260px 1fr', gap: '28px' }} className="cobro-grid-mobile">
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '20px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  border: '2px solid #bbf7d0',
                  padding: '20px',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '14px', color: '#166534', fontWeight: '600' }}>
                    TOTAL A COBRAR
                  </div>
                  <div style={{ fontSize: '30px', fontWeight: '800', color: '#059669', lineHeight: 1.3 }}>
                    Bs {formatearBs(totalBs)}
                  </div>
                  <div style={{ fontSize: '15px', color: '#6b7280' }}>
                    $ {totalDolares.toFixed(2)}
                  </div>
                </div>

                <div style={{ position: 'relative' as const }}>
                  <label style={styles.labelElegante}>🧑 Cliente (opcional)</label>
                  {clienteSeleccionado ? (
                    <div style={{
                      ...styles.inputElegante,
                      padding: '12px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        {clienteSeleccionado.nombre}{clienteSeleccionado.cedula_rif ? ` (${clienteSeleccionado.cedula_rif})` : ''}
                      </span>
                      <button
                        onClick={() => {
                          setClienteSeleccionadoId('')
                          setBusquedaCliente('')
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '16px',
                          padding: '0 0 0 8px',
                        }}
                        title="Quitar cliente (vuelve a Consumidor Final)"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Nombre o cédula/RIF... (vacío = Consumidor Final)"
                        value={busquedaCliente}
                        onChange={(e) => {
                          setBusquedaCliente(e.target.value)
                          setMostrarListaClientes(true)
                        }}
                        onFocus={() => setMostrarListaClientes(true)}
                        onBlur={() => setTimeout(() => setMostrarListaClientes(false), 150)}
                        style={{ ...styles.inputElegante, padding: '12px 12px' }}
                      />
                      {mostrarListaClientes && busquedaCliente.trim() !== '' && (
                        <div style={{
                          position: 'absolute' as const,
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 20,
                          backgroundColor: 'white',
                          border: '2px solid #e5e7eb',
                          borderRadius: '10px',
                          marginTop: '4px',
                          maxHeight: '180px',
                          overflowY: 'auto' as const,
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
                        }}>
                          {clientesFiltrados.length === 0 ? (
                            <div style={{ padding: '10px 12px', color: '#9ca3af', fontSize: '14px' }}>
                              No se encontraron clientes
                            </div>
                          ) : (
                            clientesFiltrados.map((c) => (
                              <div
                                key={c.id}
                                onMouseDown={() => {
                                  setClienteSeleccionadoId(c.id)
                                  setBusquedaCliente('')
                                  setMostrarListaClientes(false)
                                }}
                                style={{
                                  padding: '10px 12px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f3f4f6',
                                  fontSize: '14px',
                                }}
                              >
                                <div style={{ fontWeight: 600, color: '#111827' }}>{c.nombre}</div>
                                {c.cedula_rif && (
                                  <div style={{ color: '#6b7280', fontSize: '13px' }}>{c.cedula_rif}</div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div style={{
                  background: Math.abs(restantePago) < 0.01
                    ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)'
                    : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                  border: Math.abs(restantePago) < 0.01 ? '2px solid #86efac' : '2px solid #fecaca',
                  padding: '18px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  marginTop: 'auto'
                }}>
                  <div style={{
                    color: Math.abs(restantePago) < 0.01 ? '#166534' : '#dc2626',
                    fontWeight: '800',
                    fontSize: '17px'
                  }}>
                    {Math.abs(restantePago) < 0.01 ? '✓ PAGO COMPLETO' : `RESTANTE: Bs ${formatearBs(restantePago)}`}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                    Recibido: Bs {formatearBs(totalPagadoBs)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' as const }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '18px' }} className="cobro-metodos-mobile">
                  <div>
                    <label style={styles.labelElegante}>💵 Efectivo Bs</label>
                    <input
                      type="number"
                      value={pagoEfectivoBs || ''}
                      onChange={(e) => setPagoEfectivoBs(Number(e.target.value) || 0)}
                      style={{ ...styles.inputElegante, padding: '14px 14px', fontSize: '17px' }}
                      placeholder="0.00"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label style={styles.labelElegante}>💵 Efectivo $</label>
                    <input
                      type="number"
                      value={pagoEfectivoUsd || ''}
                      onChange={(e) => setPagoEfectivoUsd(Number(e.target.value) || 0)}
                      style={{ ...styles.inputElegante, padding: '14px 14px', fontSize: '17px' }}
                      placeholder="0.00"
                    />
                    {pagoEfectivoUsd > 0 && (
                      <span style={{ fontSize: '13px', color: '#059669', fontWeight: '600' }}>
                        ≈ Bs {formatearBs(pagoEfectivoUsd * tasaEfectiva)}
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={styles.labelElegante}>💳 Tarjeta</label>
                    <input
                      type="number"
                      value={pagoTarjeta || ''}
                      onChange={(e) => setPagoTarjeta(Number(e.target.value) || 0)}
                      style={{ ...styles.inputElegante, padding: '14px 14px', fontSize: '17px' }}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label style={styles.labelElegante}>🏦 Transferencia</label>
                    <input
                      type="number"
                      value={pagoTransferencia || ''}
                      onChange={(e) => setPagoTransferencia(Number(e.target.value) || 0)}
                      style={{ ...styles.inputElegante, padding: '14px 14px', fontSize: '17px' }}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label style={styles.labelElegante}>📱 Biopago</label>
                    <input
                      type="number"
                      value={pagoBiopago || ''}
                      onChange={(e) => setPagoBiopago(Number(e.target.value) || 0)}
                      style={{ ...styles.inputElegante, padding: '14px 14px', fontSize: '17px' }}
                      placeholder="0.00"
                    />
                  </div>

                </div>

                {puedeVentaCredito && clienteSeleccionado && clienteSeleccionado.tipo_credito !== 'contado' && (
                  <div style={{
                    border: '2px solid #fde68a',
                    backgroundColor: '#fffbeb',
                    borderRadius: '12px',
                    padding: '14px',
                    marginTop: '18px',
                  }}>
                    <div style={{ fontSize: '14px', color: '#92400e', marginBottom: '10px' }}>
                      {cargandoDeudaCliente
                        ? 'Consultando deuda actual...'
                        : clienteSeleccionado.tipo_credito === 'ilimitado'
                          ? 'Este cliente tiene crédito ilimitado.'
                          : `Disponible: $${(creditoDisponible ?? 0).toFixed(2)} (debe actualmente: $${saldoClienteSeleccionado.toFixed(2)})`}
                    </div>
                    <button
                      onClick={facturarACredito}
                      disabled={facturandoCredito || items.length === 0}
                      style={{
                        width: '100%',
                        backgroundColor: facturandoCredito ? '#d1d5db' : '#f59e0b',
                        color: 'white',
                        border: 'none',
                        padding: '14px',
                        borderRadius: '10px',
                        cursor: facturandoCredito ? 'not-allowed' : 'pointer',
                        fontWeight: '800',
                        fontSize: '15px',
                      }}
                    >
                      {facturandoCredito ? 'GUARDANDO...' : '📝 Facturar a Crédito (sin cobrar)'}
                    </button>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: 'auto', paddingTop: '28px' }} className="cobro-botones-mobile">
                  <button
                    onClick={() => confirmarVenta(true)}
                    style={{
                      background: Math.abs(restantePago) < 0.01 && !procesandoVenta
                        ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                        : '#d1d5db',
                      color: 'white',
                      border: 'none',
                      padding: '18px 6px',
                      borderRadius: '12px',
                      cursor: Math.abs(restantePago) < 0.01 && !procesandoVenta ? 'pointer' : 'not-allowed',
                      fontWeight: '800',
                      fontSize: '16px',
                      boxShadow: Math.abs(restantePago) < 0.01 ? '0 8px 20px -5px rgba(5, 150, 105, 0.4)' : 'none',
                      transition: 'all 0.2s',
                    }}
                    disabled={Math.abs(restantePago) >= 0.01 || procesandoVenta}
                  >
                    {procesandoVenta ? 'PROCESANDO...' : '[F1] Cobrar e Imprimir'}
                  </button>

                  <button
                    onClick={() => confirmarVenta(false)}
                    style={{
                      background: Math.abs(restantePago) < 0.01 && !procesandoVenta
                        ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                        : '#d1d5db',
                      color: 'white',
                      border: 'none',
                      padding: '18px 6px',
                      borderRadius: '12px',
                      cursor: Math.abs(restantePago) < 0.01 && !procesandoVenta ? 'pointer' : 'not-allowed',
                      fontWeight: '800',
                      fontSize: '16px',
                      boxShadow: Math.abs(restantePago) < 0.01 ? '0 8px 20px -5px rgba(37, 99, 235, 0.4)' : 'none',
                      transition: 'all 0.2s',
                    }}
                    disabled={Math.abs(restantePago) >= 0.01 || procesandoVenta}
                  >
                    {procesandoVenta ? 'PROCESANDO...' : '[F2] Cobrar sin Imprimir'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarDevoluciones && (
        <div style={styles.modal} onClick={() => !procesandoAnulacion && setMostrarDevoluciones(false)}>
          <div style={{
            ...styles.modalContent,
            maxWidth: '720px',
            width: '92%',
            maxHeight: '76vh',
            borderRadius: '14px',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              ...styles.modalHeader,
              padding: '12px 16px',
            }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>🧾 Ventas y Devoluciones</h2>
              <button
                onClick={() => !procesandoAnulacion && setMostrarDevoluciones(false)}
                style={{ ...styles.botonCerrar, width: '26px', height: '26px', fontSize: '14px' }}
              >✕</button>
            </div>

            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{
                width: '280px',
                flexShrink: 0,
                borderRight: '1px solid #e5e7eb',
                display: 'flex',
                flexDirection: 'column' as const,
                overflow: 'hidden'
              }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6' }}>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 5px', fontWeight: 600 }}>
                    Buscar por N° de ticket:
                  </p>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="number"
                      placeholder="N° de Ticket..."
                      value={folioBuscado}
                      onChange={(e) => setFolioBuscado(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') buscarVentaPorFolio(folioBuscado) }}
                      style={{ ...styles.inputBusqueda, margin: 0, flex: 1, padding: '6px 8px', fontSize: '15px', borderRadius: '8px' }}
                      autoFocus
                    />
                    <button
                      onClick={() => buscarVentaPorFolio(folioBuscado)}
                      disabled={buscandoVenta}
                      style={{ ...styles.botonCobrar, padding: '6px 12px', fontSize: '14px', borderRadius: '8px' }}
                    >
                      🔍
                    </button>
                  </div>
                </div>

                <div style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6' }}>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 5px', fontWeight: 600 }}>
                    Ver ventas por:
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' as const }}>
                    <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                      <button
                        onClick={() => setModoFecha('dia')}
                        style={{
                          padding: '5px 10px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 700 as const,
                          backgroundColor: modoFecha === 'dia' ? '#111827' : '#f3f4f6',
                          color: modoFecha === 'dia' ? 'white' : '#374151',
                        }}
                      >
                        Día
                      </button>
                      <button
                        onClick={() => setModoFecha('mes')}
                        style={{
                          padding: '5px 10px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 700 as const,
                          backgroundColor: modoFecha === 'mes' ? '#111827' : '#f3f4f6',
                          color: modoFecha === 'mes' ? 'white' : '#374151',
                        }}
                      >
                        Mes
                      </button>
                    </div>

                    {modoFecha === 'dia' ? (
                      <input
                        type="date"
                        value={fechaFiltro}
                        onChange={(e) => setFechaFiltro(e.target.value)}
                        style={{ padding: '5px 7px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }}
                      />
                    ) : (
                      <input
                        type="month"
                        value={mesFiltro}
                        onChange={(e) => setMesFiltro(e.target.value)}
                        style={{ padding: '5px 7px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }}
                      />
                    )}

                    {modoFecha === 'dia' && fechaFiltro !== obtenerFechaLocal() && (
                      <button
                        onClick={() => setFechaFiltro(obtenerFechaLocal())}
                        style={{ padding: '5px 9px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', backgroundColor: 'white' }}
                      >
                        Hoy
                      </button>
                    )}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700 as const,
                  color: '#6b7280',
                  borderBottom: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb'
                }}>
                  <div style={{ flex: '0 0 45px' }}>Folio</div>
                  <div style={{ flex: 1 }}>{modoFecha === 'mes' ? 'Fecha' : 'Hora'}</div>
                  <div style={{ flex: '0 0 70px', textAlign: 'right' as const }}>Total</div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' as const }}>
                  {ventasFiltradas.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#9ca3af', padding: '16px 12px', fontSize: '14px' }}>
                      No hay ventas en ese período
                    </p>
                  ) : (
                    ventasFiltradas.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => cargarVentaParaAnular(v.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '7px 12px',
                          borderBottom: '1px solid #f3f4f6',
                          cursor: 'pointer',
                          fontSize: '14px',
                          backgroundColor: ventaParaAnular?.id === v.id ? '#eff6ff' : 'white',
                          opacity: v.anulada ? 0.6 : 1
                        }}
                      >
                        <div style={{ flex: '0 0 45px', fontWeight: 600 }}>{v.id}</div>
                        <div style={{ flex: 1 }}>
                          {modoFecha === 'mes'
                            ? new Date(v.created_at).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                            : new Date(v.created_at).toLocaleTimeString('es-VE')}
                          {v.anulada && (
                            <span style={{ color: '#dc2626', fontWeight: 800, marginLeft: '5px', fontSize: '11px' }}>
                              CANCEL.
                            </span>
                          )}
                        </div>
                        <div style={{ flex: '0 0 70px', textAlign: 'right' as const, fontWeight: 600, textDecoration: v.anulada ? 'line-through' : 'none' }}>
                          $ {Number(v.total_usd).toFixed(2)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' as const, padding: '14px 18px' }}>
                {!ventaParaAnular ? (
                  <div style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column' as const,
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9ca3af',
                    textAlign: 'center' as const
                  }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧾</div>
                    <p style={{ fontSize: '15px', margin: 0 }}>Elige un ticket de la lista o búscalo por número</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ textAlign: 'center' as const, marginBottom: '12px' }}>
                      <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: 600, marginBottom: '2px' }}>
                        Ticket
                      </div>
                      <div style={{ fontSize: '21px', fontWeight: 800 as const, color: '#111827' }}>
                        #{ventaParaAnular.id}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '3px' }}>
                      <span style={{ color: '#6b7280' }}>Cliente:</span>
                      <strong>{clientes.find(c => c.id === ventaParaAnular.cliente_id)?.nombre || 'Consumidor Final'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '3px' }}>
                      <span style={{ color: '#6b7280' }}>Vendedor:</span>
                      <strong>{ventaParaAnular.vendedor_nombre || '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '10px' }}>
                      <span style={{ color: '#6b7280' }}>Fecha:</span>
                      <span>{new Date(ventaParaAnular.created_at).toLocaleString('es-VE')}</span>
                    </div>

                    {(() => {
                      const metodos: { label: string; valor: string }[] = []
                      if (Number(ventaParaAnular.pago_efectivo_bs || 0) > 0) metodos.push({ label: '💵 Efectivo Bs', valor: `Bs ${formatearBs(Number(ventaParaAnular.pago_efectivo_bs))}` })
                      if (Number(ventaParaAnular.pago_efectivo_usd || 0) > 0) metodos.push({ label: '💵 Efectivo $', valor: `$ ${Number(ventaParaAnular.pago_efectivo_usd).toFixed(2)}` })
                      if (Number(ventaParaAnular.pago_tarjeta || 0) > 0) metodos.push({ label: '💳 Tarjeta', valor: `Bs ${formatearBs(Number(ventaParaAnular.pago_tarjeta))}` })
                      if (Number(ventaParaAnular.pago_transferencia || 0) > 0) metodos.push({ label: '🏦 Transferencia', valor: `Bs ${formatearBs(Number(ventaParaAnular.pago_transferencia))}` })
                      if (Number(ventaParaAnular.pago_biopago || 0) > 0) metodos.push({ label: '📱 Biopago', valor: `Bs ${formatearBs(Number(ventaParaAnular.pago_biopago))}` })
                      if (Number(ventaParaAnular.pago_credito_usd || 0) > 0) metodos.push({ label: '🧾 Crédito $', valor: `$ ${Number(ventaParaAnular.pago_credito_usd).toFixed(2)}` })
                      if (metodos.length === 0) return null
                      return (
                        <div style={{
                          backgroundColor: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          marginBottom: '12px'
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '6px' }}>
                            FORMA DE PAGO
                          </div>
                          {metodos.map((m, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '2px' }}>
                              <span>{m.label}</span>
                              <strong>{m.valor}</strong>
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    <div style={{ position: 'relative' as const }}>
                      {ventaParaAnular.anulada && (
                        <div style={{
                          position: 'absolute' as const,
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%) rotate(-18deg)',
                          border: '4px solid #dc2626',
                          color: '#dc2626',
                          fontSize: '30px',
                          fontWeight: 900 as const,
                          padding: '4px 20px',
                          borderRadius: '8px',
                          opacity: 0.85,
                          pointerEvents: 'none' as const,
                          letterSpacing: '2px',
                          backgroundColor: 'rgba(255,255,255,0.75)',
                          zIndex: 5,
                          whiteSpace: 'nowrap' as const
                        }}>
                          CANCELADO
                        </div>
                      )}

                      <table style={{ width: '100%', fontSize: '14px', marginBottom: '4px', borderCollapse: 'collapse' as const }}>
                        <thead>
                          <tr style={{ textAlign: 'left' as const, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '4px 0' }}>Cant.</th>
                            <th style={{ padding: '4px 0' }}>Descripción</th>
                            <th style={{ textAlign: 'right' as const, padding: '4px 0' }}>Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemsVentaParaAnular.map((it, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '4px 0' }}>{it.cantidad}</td>
                              <td style={{ padding: '4px 0' }}>{it.nombre_producto}</td>
                              <td style={{ textAlign: 'right' as const, padding: '4px 0' }}>$ {Number(it.subtotal).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{
                      textAlign: 'right' as const,
                      marginTop: '10px',
                      paddingTop: '10px',
                      borderTop: '2px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>TOTAL</div>
                      <div style={{ fontSize: '21px', fontWeight: 800 as const, color: '#111827' }}>
                        $ {Number(ventaParaAnular.total_usd).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>
                        Bs {formatearBs(Number(ventaParaAnular.total_bs))}
                      </div>
                    </div>

                    {ventaParaAnular.anulada && (
                      <p style={{ textAlign: 'center' as const, color: '#dc2626', fontWeight: 700, fontSize: '14px', margin: '10px 0 0' }}>
                        Esta venta ya fue anulada — el stock ya fue devuelto al inventario.
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                      {puedeReimprimir && (
                        <button
                          onClick={() => imprimirCopiaTicket(ventaParaAnular, itemsVentaParaAnular)}
                          style={{
                            flex: 1,
                            backgroundColor: '#2563eb',
                            color: 'white',
                            border: 'none',
                            padding: '9px 6px',
                            borderRadius: '9px',
                            cursor: 'pointer',
                            fontWeight: '700',
                            fontSize: '14px'
                          }}
                          disabled={procesandoAnulacion}
                        >
                          🖨️ Imprimir Copia
                        </button>
                      )}
                      {!ventaParaAnular.anulada && (
                        puedeCancelarVentas ? (
                          <button
                            onClick={anularVenta}
                            disabled={procesandoAnulacion}
                            style={{
                              flex: 1,
                              backgroundColor: '#dc2626',
                              color: 'white',
                              border: 'none',
                              padding: '9px',
                              borderRadius: '9px',
                              cursor: procesandoAnulacion ? 'not-allowed' : 'pointer',
                              fontWeight: '800',
                              fontSize: '14px'
                            }}
                          >
                            {procesandoAnulacion ? 'ANULANDO...' : '🗑️ Anular Venta'}
                          </button>
                        ) : (
                          <div style={{ flex: 1, textAlign: 'center' as const, fontSize: '13px', color: '#9ca3af', padding: '9px' }}>
                            No tienes permiso para anular ventas
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {mostrarGuardarTicket && (
        <div style={styles.modal} onClick={() => !guardandoTicket && setMostrarGuardarTicket(false)}>
          <div style={{ ...styles.modalContentSmall, maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={{ fontSize: '18px' }}>💾 Guardar Ticket</h2>
              <button onClick={() => setMostrarGuardarTicket(false)} style={styles.botonCerrar}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <label style={styles.labelElegante}>Nombre o cédula del cliente</label>
              <input
                type="text"
                value={referenciaTicket}
                onChange={(e) => setReferenciaTicket(e.target.value)}
                placeholder="Ej: María Pérez, 0414-1234567..."
                style={{ ...styles.inputElegante, padding: '12px 12px' }}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') guardarTicketActual() }}
              />
              <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '10px' }}>
                {items.length} producto(s) — Total: $ {totalDolares.toFixed(2)}
              </div>
              <button
                onClick={guardarTicketActual}
                disabled={guardandoTicket}
                style={{ ...styles.botonGuardar, marginTop: '18px' }}
              >
                {guardandoTicket ? 'Guardando...' : 'Guardar Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
      {mostrarBuscarTickets && (
        <div style={styles.modal} onClick={() => setMostrarBuscarTickets(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2>🔍 Buscar Ticket Guardado</h2>
              <button onClick={() => setMostrarBuscarTickets(false)} style={styles.botonCerrar}>✕</button>
            </div>
            <input
              type="text"
              placeholder="Escribe el nombre o cédula del cliente..."
              value={busquedaTicketGuardado}
              onChange={(e) => {
                setBusquedaTicketGuardado(e.target.value)
                if (e.target.value.trim()) {
                  buscarTicketsGuardados(e.target.value.trim())
                } else {
                  setTicketsEncontrados([])
                }
              }}
              style={styles.inputBusqueda}
              autoFocus
            />
            <div style={styles.listaProductos}>
              {busquedaTicketGuardado.trim() === '' ? (
                <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px', fontSize: '16px' }}>
                  Escribe el nombre o cédula para buscar tickets pendientes
                </p>
              ) : buscandoTickets ? (
                <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px', fontSize: '16px' }}>Buscando...</p>
              ) : ticketsEncontrados.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px', fontSize: '16px' }}>No se encontraron tickets guardados</p>
              ) : (
                ticketsEncontrados.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => retomarTicket(ticket)}
                    style={{ ...styles.itemProducto, cursor: 'pointer' }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={styles.nombreProducto}>{ticket.referencia}</span>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                        {ticket.items.length} producto(s) · {new Date(ticket.created_at).toLocaleString('es-VE')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={styles.precioProducto}>$ {Number(ticket.total_usd).toFixed(2)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {mostrarCambiarTasa && (
        <div style={styles.modal} onClick={() => !guardandoTasa && setMostrarCambiarTasa(false)}>
          <div style={{ ...styles.modalContentSmall, maxWidth: '360px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={{ fontSize: '18px' }}>💱 Cambiar Tasa del Día</h2>
              <button onClick={() => setMostrarCambiarTasa(false)} style={styles.botonCerrar}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <label style={styles.labelElegante}>Nueva tasa (Bs por $)</label>
              <input
                type="number"
                value={nuevaTasaInput}
                onChange={(e) => setNuevaTasaInput(e.target.value)}
                placeholder="Ej: 75.50"
                style={{ ...styles.inputElegante, padding: '12px 12px' }}
                step="0.01"
                min="0"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') guardarNuevaTasa() }}
              />
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                Tasa actual: {tasaDolar > 0 ? tasaDolar.toFixed(2) : '—'}
              </div>
              <button
                onClick={guardarNuevaTasa}
                disabled={guardandoTasa}
                style={{ ...styles.botonGuardar, marginTop: '18px' }}
              >
                {guardandoTasa ? 'Guardando...' : 'Guardar Tasa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarCalculadora && (
        <div style={styles.modal} onClick={() => setMostrarCalculadora(false)}>
          <div style={{ ...styles.modalContentSmall, maxWidth: '340px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={{ fontSize: '18px' }}>🧮 Calculadora</h2>
              <button onClick={() => setMostrarCalculadora(false)} style={styles.botonCerrar}>✕</button>
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{
                backgroundColor: '#111827',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '14px',
                textAlign: 'right' as const
              }}>
                <div style={{ color: '#9ca3af', fontSize: '16px', minHeight: '20px', wordBreak: 'break-all' as const }}>
                  {calcExpresion || ' '}
                </div>
                <div style={{ color: 'white', fontSize: '30px', fontWeight: 700, wordBreak: 'break-all' as const }}>
                  {calcResultado}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {['C', '⌫', '/', '*',
                  '7', '8', '9', '-',
                  '4', '5', '6', '+',
                  '1', '2', '3', '=',
                  '0', '.'].map((tecla, i) => (
                  <button
                    key={i}
                    onClick={() => calcPresionarTecla(tecla)}
                    style={{
                      gridColumn: tecla === '0' ? 'span 2' : undefined,
                      padding: '18px 0',
                      fontSize: '20px',
                      fontWeight: 700,
                      borderRadius: '10px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor:
                        tecla === '=' ? '#059669' :
                        tecla === 'C' || tecla === '⌫' ? '#fee2e2' :
                        ['/', '*', '-', '+'].includes(tecla) ? '#dbeafe' : '#f3f4f6',
                      color:
                        tecla === '=' ? 'white' :
                        tecla === 'C' || tecla === '⌫' ? '#dc2626' :
                        ['/', '*', '-', '+'].includes(tecla) ? '#1d4ed8' : '#111827',
                    }}
                  >
                    {tecla}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {mostrarEscanerCamara && (
  <EscanerCamara
    onDetectado={(codigo) => {
      setMostrarEscanerCamara(false)
      buscarYAgregarPorCodigo(codigo)
    }}
    onCerrar={() => setMostrarEscanerCamara(false)}
  />
)}
    </div>
  )
}

const estiloBotonBuscarMovil = (
  <style jsx global>{`
    .boton-buscar-movil { display: none; }
    .carrito-movil { display: none; }
    @media (max-width: 768px) {
      .boton-buscar-movil { display: inline-flex !important; }
      .tabla-desktop-pos { display: none !important; }
      .header-desktop-vender { display: none !important; }
      .carrito-movil {
        display: flex !important;
        flex-direction: column;
        gap: 10px;
        padding: 4px 2px 12px;
      }
      .botones-footer-movil {
        flex-wrap: wrap !important;
      }
      .boton-oculto-movil {
        display: none !important;
      }
      .boton-cobrar-movil {
        flex: 1 1 100% !important;
        order: 10 !important;
      }
      .tarjeta-item-movil {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 14px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      }
      .tarjeta-item-movil-nombre { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 2px; }
      .tarjeta-item-movil-codigo { font-size: 12px; color: #9ca3af; margin-bottom: 10px; }
      .tarjeta-item-movil-fila { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .stepper-cantidad { display: flex; align-items: center; background: #f3f4f6; border-radius: 10px; overflow: hidden; }
      .stepper-boton { width: 38px; height: 38px; border: none; background: #e5e7eb; font-size: 20px; font-weight: 700; color: #374151; cursor: pointer; }
      .stepper-valor { width: 44px; text-align: center; font-size: 16px; font-weight: 700; color: #111827; }
      .toggle-mayoreo-movil { border: none; border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer; }

      .footer-movil {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 12px !important;
      }
      .total-container-movil {
        justify-content: space-between !important;
        gap: 12px !important;
      }
      .total-valor-movil {
        font-size: 22px !important;
        word-break: break-word;
      }

      .cobro-overlay-mobile {
        align-items: stretch !important;
        justify-content: stretch !important;
        padding: 0 !important;
      }
      .cobro-modal-mobile {
        width: 100% !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        border-radius: 0 !important;
        overflow-y: auto !important;
      }
      .cobro-grid-mobile {
        grid-template-columns: 1fr !important;
        padding: 14px 16px !important;
        gap: 14px !important;
      }
      .cobro-metodos-mobile {
        grid-template-columns: 1fr 1fr !important;
        gap: 10px !important;
      }
      .cobro-botones-mobile {
        grid-template-columns: 1fr 1fr !important;
        gap: 10px !important;
        padding-top: 16px !important;
      }
      .info-header-movil {
        display: none !important;
      }
      .estado-vacio-movil {
        display: none !important;
      }
      .contenedor-principal-movil {
      height: auto !important;
      min-height: 100vh !important;
      overflow-y: auto !important;
      padding-bottom: 90px !important;
      }
      .footer-fijo-movil {
        position: fixed !important;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 50;
        border-radius: 0 !important;
      }
    }
  `}</style>
)

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px 20px',
    backgroundColor: '#f9fafb',
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    boxSizing: 'border-box' as const,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    backgroundColor: 'white',
    padding: '8px 16px',
    borderRadius: '10px',
    marginBottom: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  headerUnica: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'nowrap' as const,
  },
  resumenItem: {
    color: '#374151',
    whiteSpace: 'nowrap' as const,
    fontSize: '12.5px',
  },
  resumenSub: {
    color: '#9ca3af',
    fontWeight: 400,
  },
  resumenSeparador: {
    color: '#cbd5e1',
    flexShrink: 0,
  },
  botonSecundarioHeader: {
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    padding: '6px 9px',
    borderRadius: '7px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '12px',
    color: '#374151',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  tablaContainer: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    marginBottom: '14px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: 0,
  },
  tablaHeader: {
    display: 'flex',
    backgroundColor: '#f9fafb',
    padding: '14px 16px',
    borderBottom: '2px solid #e5e7eb',
    fontWeight: '700',
    fontSize: '15px',
    color: '#374151',
    flexShrink: 0,
  },
  col: {
    padding: '0 8px'
  },
  tablaBody: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto' as const
  },
  tablaVacia: {
    padding: '100px 20px',
    textAlign: 'center' as const,
    color: '#9ca3af',
    fontSize: '17px'
  },
  tablaRow: {
    display: 'flex',
    padding: '14px 16px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '17px',
    color: '#111827',
    alignItems: 'center'
  },
  inputCantidad: {
    width: '100%',
    padding: '8px 8px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    textAlign: 'right' as const,
    fontSize: '17px',
    outline: 'none'
  },
  botonEliminar: {
    width: '32px',
    height: '32px',
    backgroundColor: '#fee2e2',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#dc2626',
    fontWeight: '700',
    fontSize: '15px'
  },
  footer: {
    backgroundColor: 'white',
    padding: '16px 20px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  totalContainer: {
    display: 'flex',
    gap: '40px'
  },
  totalLabel: {
    fontSize: '15px',
    color: '#6b7280',
    display: 'block',
    marginBottom: '4px'
  },
  totalValor: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#059669'
  },
  totalValorBs: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#2563eb'
  },
  botonesFooter: {
    display: 'flex',
    gap: '12px'
  },
  botonCancelar: {
    backgroundColor: 'white',
    color: '#6b7280',
    border: '1px solid #e5e7eb',
    padding: '14px 28px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '16px'
  },
  botonCobrar: {
    backgroundColor: '#059669',
    color: 'white',
    border: 'none',
    padding: '14px 40px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '17px',
    boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
  },
  modal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '650px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  },
  modalContentSmall: {
    backgroundColor: 'white',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '450px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  },
  modalHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  botonCerrar: {
    width: '32px',
    height: '32px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '18px',
    color: '#6b7280'
  },
  inputBusqueda: {
    margin: '16px 24px',
    padding: '12px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    fontSize: '17px',
    outline: 'none'
  },
  listaProductos: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0 24px 24px'
  },
  itemProducto: {
    padding: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    marginBottom: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'all 0.2s'
  },
  codigoProducto: {
    fontSize: '14px',
    color: '#6b7280',
    display: 'block',
    marginBottom: '4px'
  },
  nombreProducto: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#111827'
  },
  precioProducto: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#059669',
    display: 'block',
    marginBottom: '2px'
  },
  stockProducto: {
    fontSize: '14px',
    color: '#6b7280'
  },
  botonEditar: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    whiteSpace: 'nowrap' as const
  },
  formEditar: {
    padding: '24px'
  },
  campoForm: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    fontSize: '15px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '6px'
  },
  inputForm: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '16px',
    outline: 'none',
    boxSizing: 'border-box' as const
  },
  botonGuardar: {
    width: '100%',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    padding: '14px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '17px',
    marginTop: '8px'
  },
  labelElegante: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '700',
    color: '#374151',
    marginBottom: '6px',
    letterSpacing: '0.3px'
  },
  inputElegante: {
    width: '100%',
    padding: '10px 12px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'all 0.2s',
    backgroundColor: 'white'
  }
}

const estilosEditar: Record<string, React.CSSProperties> = {
  modalEditar: {
    backgroundColor: 'white',
    borderRadius: '18px',
    width: '92%',
    maxWidth: '420px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    overflow: 'hidden' as const,
  },
  headerEditar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 20px',
    backgroundColor: '#111827',
  },
  tituloEditar: {
    margin: 0,
    fontSize: '19px',
    fontWeight: '700' as const,
    color: 'white',
  },
  botonCerrarEditar: {
    width: '32px',
    height: '32px',
    backgroundColor: 'rgba(255,255,255,0.15)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    color: 'white',
  },
  cuerpoEditar: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  campoAncho: {
    width: '100%',
  },
  grilla2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  labelEditar: {
    display: 'block',
    fontSize: '15px',
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: '6px',
  },
  inputEditar: {
    width: '100%',
    padding: '12px 14px',
    border: '2px solid #d1d5db',
    borderRadius: '10px',
    fontSize: '18px',
    fontWeight: '600' as const,
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box' as const,
    backgroundColor: '#fff',
  },
  piePagina: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    gap: '12px',
    padding: '16px 20px',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  botonCancelarEditar: {
    backgroundColor: 'white',
    color: '#6b7280',
    border: '2px solid #e5e7eb',
    padding: '13px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '700' as const,
    fontSize: '15px',
  },
  botonGuardarEditar: {
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    padding: '13px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '700' as const,
    fontSize: '16px',
    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)',
  },
}
// prueba deploy