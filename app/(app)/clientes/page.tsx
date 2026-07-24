'use client';
import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cliente, SaldoCliente, TipoCredito, VentaCredito, AbonoCredito, MovimientoEstadoCuenta } from '@/lib/types';

type MetodoAbono = 'efectivo_usd' | 'efectivo_bs' | 'tarjeta' | 'transferencia' | 'biopago';

interface Sesion {
  id: number;
  nombre: string;
  username: string;
  rol: string;
  permisos: Record<string, boolean>;
}

// ----- Tipos para la sección "Créditos por pedidos" (Sistema A: creditos_pedidos / creditos_pagos) -----
interface ItemPedidoPendiente {
  id: number;
  producto_id: number;
  codigo_producto: string;
  nombre_producto: string;
  cantidad_original: number;
  cantidad_pendiente: number;
  precio_actual: number;
  subtotal_actual: number;
}

interface PedidoPendiente {
  id: number;
  created_at: string;
  saldado: boolean;
  items: ItemPedidoPendiente[];
  total_pedido_usd: number;
}

interface PagoPedidoHistorial {
  id?: number;
  created_at?: string;
  monto_usd?: number;
  ganancia_usd?: number;
  vendedor_nombre?: string;
  [key: string]: any;
}

type VistaCreditoPedidos = 'deuda' | 'pago' | 'historial' | null;

// Devuelve la fecha de HOY usando la hora local del navegador (no UTC).
function obtenerFechaLocal(): string {
  const ahora = new Date();
  const año = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

export default function ClientesPage() {
  const router = useRouter();

  // ----- Sesión -----
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);
  const esAdmin = sesion?.rol === 'admin';
  const puedeCancelarVentas = esAdmin || !!sesion?.permisos?.cancelar_ventas;

  // ----- Listado -----
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [saldos, setSaldos] = useState<Record<number, SaldoCliente>>({});
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [pestaña, setPestaña] = useState<'nuevo' | 'editar'>('nuevo');

    // ----- Vista en pantallas angostas (celular / tablet en vertical):
  // solo se muestra un panel a la vez, controlado por estas pestañas -----
  const [vistaMovil, setVistaMovil] = useState<'lista' | 'datos' | 'cuenta'>('lista');

  // ----- Formulario -----
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [cedulaRif, setCedulaRif] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [tipoCredito, setTipoCredito] = useState<TipoCredito>('contado');
  const [montoLimite, setMontoLimite] = useState('');
  const [guardando, setGuardando] = useState(false);

  // ----- Tasa del dólar del día (necesaria para convertir abonos en Bs) -----
  const [tasaHoy, setTasaHoy] = useState(0);

  // ---- Protección: solo usuarios con sesión iniciada entran aquí ----
  useEffect(() => {
    const guardada = localStorage.getItem('sesion_usuario');
    if (!guardada) {
      router.push('/login');
      return;
    }
    const datos = JSON.parse(guardada) as Sesion;
    setSesion(datos);
    setVerificandoSesion(false);
  }, [router]);

  useEffect(() => {
    async function cargarTasa() {
      try {
        const hoy = obtenerFechaLocal();
        const res = await fetch(`/api/tasas-diarias?fecha=${hoy}`);
        const { data } = await res.json();
        if (data) setTasaHoy(Number(data.valor));
      } catch (err) {
        // Sin internet no se puede cargar la tasa del día; los abonos en
        // Bs quedarán bloqueados hasta que vuelva la conexión.
        console.error('No se pudo cargar la tasa del día:', err);
      }
    }
    cargarTasa();
  }, []);

  // ----- Estado de cuenta -----
  const [ventasCredito, setVentasCredito] = useState<VentaCredito[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoEstadoCuenta[]>([]);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [mostrarAbono, setMostrarAbono] = useState(false);
  const [ventaAbono, setVentaAbono] = useState<number | null>(null);
  const [montoAbono, setMontoAbono] = useState('');
  const [metodoAbono, setMetodoAbono] = useState<MetodoAbono>('efectivo_usd');
  const [ticketAbierto, setTicketAbierto] = useState<number | null>(null);
  // null = falló la última carga (hay que reintentar), array = ya se cargó bien (aunque esté vacío)
  const [itemsPorVenta, setItemsPorVenta] = useState<Record<number, any[] | null>>({});
  const [cargandoItems, setCargandoItems] = useState<number | null>(null);
  const [registrandoAbono, setRegistrandoAbono] = useState(false);

  // ----- Créditos por pedidos (Sistema A: creditos_pedidos / creditos_pagos) -----
  const [vistaCreditoPedidos, setVistaCreditoPedidos] = useState<VistaCreditoPedidos>(null);
  const [pedidosPendientes, setPedidosPendientes] = useState<PedidoPendiente[]>([]);
  const [deudaPedidosUsd, setDeudaPedidosUsd] = useState(0);
  const [cargandoDeudaPedidos, setCargandoDeudaPedidos] = useState(false);
  const [errorDeudaPedidos, setErrorDeudaPedidos] = useState('');
  const [pagoPedidosEfectivoUsd, setPagoPedidosEfectivoUsd] = useState('');
  const [pagoPedidosEfectivoBs, setPagoPedidosEfectivoBs] = useState('');
  const [pagoPedidosTarjeta, setPagoPedidosTarjeta] = useState('');
  const [pagoPedidosTransferencia, setPagoPedidosTransferencia] = useState('');
  const [pagoPedidosBiopago, setPagoPedidosBiopago] = useState('');
  const [registrandoPagoPedidos, setRegistrandoPagoPedidos] = useState(false);
  const [errorPagoPedidos, setErrorPagoPedidos] = useState('');
  const [mensajePagoPedidosOk, setMensajePagoPedidosOk] = useState('');
  const [historialPagosPedidos, setHistorialPagosPedidos] = useState<PagoPedidoHistorial[]>([]);
  const [cargandoHistorialPedidos, setCargandoHistorialPedidos] = useState(false);
  const [errorHistorialPedidos, setErrorHistorialPedidos] = useState('');
  const [eliminandoPedidoId, setEliminandoPedidoId] = useState<number | null>(null);

  // Estilos compactos
  const btnPrimario = { backgroundColor: '#111827', color: 'white', padding: '9px 16px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '13px' };
  const btnSecundario = { backgroundColor: '#f3f4f6', color: '#374151', padding: '9px 14px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '13px' };
  const btnEliminar = { color: '#ef4444', fontWeight: 'bold', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', padding: '9px', fontSize: '13px' };
  const btnVolver = { backgroundColor: '#f9fafb', color: '#374151', padding: '7px 14px', borderRadius: '8px', fontWeight: 600, border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '13px' };
  const inputStyle = { padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: '8px', width: '100%', boxSizing: 'border-box' as const, fontSize: '13px' };

  // Describe el/los método(s) usados en un pago de creditos_pagos.
  // Si solo un método tiene monto > 0, muestra ese nombre.
  // Si hay más de uno, muestra "Mixto" con el detalle de cada uno.
  function describirMetodoPago(pago: PagoPedidoHistorial): string {
    const metodos: { nombre: string; monto: number }[] = [
      { nombre: 'Efectivo $', monto: Number(pago.abono_efectivo_usd || 0) },
      { nombre: 'Efectivo Bs', monto: Number(pago.abono_efectivo_bs || 0) },
      { nombre: 'Tarjeta', monto: Number(pago.abono_tarjeta || 0) },
      { nombre: 'Transferencia', monto: Number(pago.abono_transferencia || 0) },
      { nombre: 'Biopago', monto: Number(pago.abono_biopago || 0) },
    ].filter((m) => m.monto > 0.009);

    if (metodos.length === 0) return '—';
    if (metodos.length === 1) return metodos[0].nombre;
    return `Mixto (${metodos.map((m) => m.nombre).join(' + ')})`;
  }

  async function cargarClientes() {
    setCargando(true);

    try {
      const res = await fetch('/api/clientes');
      const { clientes: clientesData, saldos: saldosData, error } = await res.json();

      if (error) throw new Error(error);

      setClientes((clientesData as Cliente[]) || []);

      const mapaSaldos: Record<number, SaldoCliente> = {};
      (saldosData as SaldoCliente[] | null)?.forEach((s) => {
        mapaSaldos[s.cliente_id] = s;
      });
      setSaldos(mapaSaldos);
    } catch (err) {
      console.error('Error cargando clientes:', err);
      alert('No se pudieron cargar los clientes. Verifica tu conexión e intenta de nuevo.');
    }

    setCargando(false);
  }

  
  useEffect(() => {
    if (!verificandoSesion) cargarClientes();
  }, [verificandoSesion]);

  // ---------------------------------------------------------
  // Seleccionar cliente -> cargar formulario + estado de cuenta
  // ---------------------------------------------------------
  async function seleccionarCliente(cliente: Cliente) {
    setClienteSeleccionado(cliente);
    setPestaña('editar');
    setCedulaRif(cliente.cedula_rif || '');
    setNombre(cliente.nombre);
    setTelefono(cliente.telefono || '');
    setDireccion(cliente.direccion || '');
    setTipoCredito(cliente.tipo_credito);
    setMontoLimite(cliente.monto_limite ? String(cliente.monto_limite) : '');
    setMostrarAbono(false);
    setMontoAbono('');
    setMetodoAbono('efectivo_usd');
    setVentaAbono(null);
    setTicketAbierto(null);
    setItemsPorVenta({});
    // Limpiamos también la sección de "Créditos por pedidos" (Sistema A)
    setVistaCreditoPedidos(null);
    setPedidosPendientes([]);
    setDeudaPedidosUsd(0);
    setErrorDeudaPedidos('');
    setHistorialPagosPedidos([]);
    setErrorHistorialPedidos('');
    setPagoPedidosEfectivoUsd('');
    setPagoPedidosEfectivoBs('');
    setPagoPedidosTarjeta('');
    setPagoPedidosTransferencia('');
    setPagoPedidosBiopago('');
    setErrorPagoPedidos('');
    setMensajePagoPedidosOk('');
    // En pantallas angostas, al elegir un cliente vamos directo al estado
    // de cuenta, que es lo que casi siempre se necesita ver primero.
    setVistaMovil('cuenta');

    await cargarEstadoCuenta(cliente.id);
    // Cargamos la deuda por pedidos de una vez, para que "Créditos por
    // pedidos" no se vea vacío hasta que el usuario haga click en "Ver deuda".
    await verDeudaPedidos(cliente.id);
  }

  // ---------------------------------------------------------
  // Créditos por pedidos (Sistema A) — ver deuda detallada
  // ---------------------------------------------------------
  async function verDeudaPedidos(clienteIdParam?: number) {
    const clienteId = clienteIdParam ?? clienteSeleccionado?.id;
    if (!clienteId) return;
    setVistaCreditoPedidos('deuda');
    setCargandoDeudaPedidos(true);
    setErrorDeudaPedidos('');
    try {
      const res = await fetch(`/api/creditos-pendientes?cliente_id=${clienteId}`);
      const data = await res.json();
      if (data.error) {
        setErrorDeudaPedidos(data.error);
        setPedidosPendientes([]);
        setDeudaPedidosUsd(0);
      } else {
        setPedidosPendientes(data.pedidos || []);
        setDeudaPedidosUsd(Number(data.deuda_total_usd || 0));
      }
    } catch (err) {
      console.error('No se pudo cargar la deuda por pedidos:', err);
      setErrorDeudaPedidos('No se pudo cargar la deuda del cliente.');
    } finally {
      setCargandoDeudaPedidos(false);
    }
  }

  function abrirRegistrarPagoPedidos() {
    setVistaCreditoPedidos('pago');
    setErrorPagoPedidos('');
    setMensajePagoPedidosOk('');
  }

  // ---------------------------------------------------------
  // Créditos por pedidos (Sistema A) — eliminar un pedido agregado
  // por error (ej. el cliente pidió el producto equivocado).
  // Solo se puede si el pedido no tiene ningún abono aplicado.
  // ---------------------------------------------------------
  async function eliminarPedidoCredito(pedido: PedidoPendiente) {
    if (!puedeCancelarVentas) {
      alert('No tienes permiso para eliminar pedidos a crédito.');
      return;
    }

    const confirmar = confirm(
      `¿Eliminar el Pedido #${pedido.id}?\n\nEsto devolverá ${pedido.items.length} producto(s) al inventario. Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    setEliminandoPedidoId(pedido.id);
    try {
      // Primer intento: sin decisión. Si el pedido ya tenía abonos aplicados,
      // el servidor responde 409 con el monto sobrante, y aquí preguntamos
      // qué hacer con ese dinero antes de reintentar.
      let resEliminar = await fetch(`/api/creditos-pendientes/${pedido.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      let dataEliminar = await resEliminar.json();

      if (!resEliminar.ok && dataEliminar.sobrante) {
        const monto = Number(dataEliminar.montoSobrante || 0);
        const montoBs = tasaHoy > 0 ? ` (Bs ${formatoUsd(monto * tasaHoy)})` : '';
        const dejarComoGanancia = confirm(
          `Este pedido ya tiene un abono aplicado. Sobra $${formatoUsd(monto)}${montoBs} que el cliente ya pagó.\n\n` +
          `Aceptar = dejar ese dinero como ganancia (se suma al reporte)\n` +
          `Cancelar = devolver ese dinero como saldo a favor del cliente (no cuenta como ganancia)`
        );

        resEliminar = await fetch(`/api/creditos-pendientes/${pedido.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            dejarComoGanancia
              ? { decision: 'ganancia', tasaDolar: tasaHoy, vendedorId: sesion?.id, vendedorNombre: sesion?.nombre }
              : { decision: 'devolver' }
          ),
        });
        dataEliminar = await resEliminar.json();
      }

      if (!resEliminar.ok || dataEliminar.error) {
        alert(dataEliminar.error || 'No se pudo eliminar el pedido.');
        return;
      }

      // El pedido ya se borró: ahora devolvemos el stock de cada producto.
      const itemsDevolucion = pedido.items.map((it) => ({
        id: it.producto_id,
        cantidad: -Number(it.cantidad_pendiente),
      }));
      const resDevolucion = await fetch('/api/productos/descontar-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsDevolucion }),
      });
      const { error: errorDevolucion } = await resDevolucion.json();
      if (errorDevolucion) {
        alert('El pedido se eliminó, pero hubo un error devolviendo el stock al inventario: ' + errorDevolucion + '\nAjusta el stock manualmente si hace falta.');
      } else {
        alert(`Pedido #${pedido.id} eliminado. El stock ya fue devuelto al inventario.`);
      }

      await verDeudaPedidos();
      await cargarClientes();
    } catch (err) {
      console.error('No se pudo eliminar el pedido a crédito:', err);
      alert('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setEliminandoPedidoId(null);
    }
  }

  // ---------------------------------------------------------
  // Créditos por pedidos (Sistema A) — registrar pago (aplicar_pago_credito)
  // ---------------------------------------------------------
  async function registrarPagoPedidos() {
    if (!clienteSeleccionado) return;

    const monto = asignadoPagoPedidosUsd;
    if (!monto || monto <= 0) {
      setErrorPagoPedidos('Ingresa el monto en al menos un método de pago.');
      return;
    }
    if (monto > deudaPedidosUsd + 0.01) {
      setErrorPagoPedidos(`El monto no puede ser mayor a la deuda total: $${formatoUsd(deudaPedidosUsd)}.`);
      return;
    }

    setRegistrandoPagoPedidos(true);
    setErrorPagoPedidos('');
    setMensajePagoPedidosOk('');

    try {
      const res = await fetch('/api/creditos-pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteSeleccionado.id,
          monto_usd: monto,
          tasa_dolar: tasaHoy,
          abono_efectivo_usd: Number(pagoPedidosEfectivoUsd || 0),
          abono_efectivo_bs: Number(pagoPedidosEfectivoBs || 0),
          abono_tarjeta: Number(pagoPedidosTarjeta || 0),
          abono_transferencia: Number(pagoPedidosTransferencia || 0),
          abono_biopago: Number(pagoPedidosBiopago || 0),
          vendedor_id: sesion?.id || null,
          vendedor_nombre: sesion?.nombre || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorPagoPedidos(data.error || 'No se pudo registrar el pago.');
        return;
      }

      setMensajePagoPedidosOk('Pago registrado correctamente.');
      setPagoPedidosEfectivoUsd('');
      setPagoPedidosEfectivoBs('');
      setPagoPedidosTarjeta('');
      setPagoPedidosTransferencia('');
      setPagoPedidosBiopago('');

      await verDeudaPedidos();
    } catch (err) {
      console.error('No se pudo registrar el pago por pedidos:', err);
      setErrorPagoPedidos('No se pudo registrar el pago. Revisa la conexión.');
    } finally {
      setRegistrandoPagoPedidos(false);
    }
  }

  // ---------------------------------------------------------
  // Créditos por pedidos (Sistema A) — historial de pagos
  // ---------------------------------------------------------
  async function verHistorialPagosPedidos() {
    if (!clienteSeleccionado) return;
    setVistaCreditoPedidos('historial');
    setCargandoHistorialPedidos(true);
    setErrorHistorialPedidos('');
    try {
      const res = await fetch(`/api/creditos-pagos?cliente_id=${clienteSeleccionado.id}`);
      const data = await res.json();
      if (data.error) {
        setErrorHistorialPedidos(data.error);
        setHistorialPagosPedidos([]);
      } else {
        setHistorialPagosPedidos(data.data || []);
      }
    } catch (err) {
      console.error('No se pudo cargar el historial de pagos por pedidos:', err);
      setErrorHistorialPedidos('No se pudo cargar el historial de pagos.');
    } finally {
      setCargandoHistorialPedidos(false);
    }
  }

  async function cargarEstadoCuenta(clienteId: number) {
    setCargandoMovimientos(true);

    try {
      const resVentas = await fetch(`/api/ventas?cliente_id=${clienteId}&credito=true`);
      const { data: ventas, error: errVentas } = await resVentas.json();

      if (errVentas) throw new Error(errVentas);

      const ventasList = (ventas as VentaCredito[]) || [];
      setVentasCredito(ventasList.filter((v) => !v.anulada));

      let abonosList: AbonoCredito[] = [];
      if (ventasList.length > 0) {
        const idsVentas = ventasList.map((v) => v.id);
        const resAbonos = await fetch(`/api/creditos-abonos?venta_ids=${idsVentas.join(',')}`);
        const { data: abonos, error: errAbonos } = await resAbonos.json();

        if (errAbonos) throw new Error(errAbonos);
        abonosList = (abonos as AbonoCredito[]) || [];
      }

      const combinados: MovimientoEstadoCuenta[] = [
        ...ventasList.map((v) => ({
          fecha: v.created_at,
          tipo: 'venta' as const,
          folio: v.id,
          descripcion: `Venta #${v.id}`,
          monto: Number(v.pago_credito_usd),
          anulada: v.anulada,
        })),
        ...abonosList.map((a) => ({
          fecha: a.created_at,
          tipo: 'abono' as const,
          folio: a.venta_id,
          descripcion: `Abono a venta #${a.venta_id}`,
          monto: -Number(a.total_abono_usd),
          anulada: false,
        })),
      ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      setMovimientos(combinados);
    } catch (err) {
      console.error('No se pudo cargar el estado de cuenta:', err);
      alert('No se pudo cargar el estado de cuenta. Verifica tu conexión.');
      setVentasCredito([]);
      setMovimientos([]);
    }

    setCargandoMovimientos(false);
  }

  
  async function verTicket(ventaId: number) {
    setTicketAbierto(ventaId);

    // Si ya se cargó bien antes (aunque haya quedado un array vacío), no
    // volvemos a pedirlo. Si la carga anterior falló (quedó en null),
    // sí reintentamos.
    if (itemsPorVenta[ventaId]) return;

    setCargandoItems(ventaId);
    try {
      const res = await fetch(`/api/venta-items?venta_id=${ventaId}`);
      const { data, error } = await res.json();

      if (error) console.error(error);

      setItemsPorVenta((prev) => ({ ...prev, [ventaId]: data || [] }));
    } catch (err) {
      console.error('No se pudo cargar el detalle de productos (sin conexión):', err);
      // null en vez de [] para que la próxima vez que se abra esta venta
      // (ya con internet) se vuelva a intentar cargar, en vez de quedarse
      // mostrando "sin productos" para siempre.
      setItemsPorVenta((prev) => ({ ...prev, [ventaId]: null }));
    }
    setCargandoItems(null);
  }

  // ---------------------------------------------------------
  // Anular una venta/ticket agregado por error (mismo flujo que
  // usa el módulo de Vender): repone el stock de cada producto
  // y marca la venta como anulada.
  // ---------------------------------------------------------
  const [eliminandoVenta, setEliminandoVenta] = useState(false);

  async function anularVentaTicket(ventaId: number) {
    if (!puedeCancelarVentas) {
      alert('No tienes permiso para anular ventas.');
      return;
    }
    if (!clienteSeleccionado) return;

    const items = itemsPorVenta[ventaId];
    if (!items || items.length === 0) {
      alert('No se pudieron cargar los productos de este ticket, así que no se puede anular de forma segura. Vuelve a abrir el ticket con conexión a internet e intenta de nuevo.');
      return;
    }

    const confirmar = confirm(
      `¿Anular el Ticket #${ventaId}?\n\nEsto devolverá ${items.length} producto(s) al inventario y la venta quedará marcada como CANCELADA (dejará de contar en reportes y créditos, pero se podrá seguir consultando). Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    setEliminandoVenta(true);
    try {
      const itemsDevolucion = items.map((item: any) => ({
        id: item.producto_id,
        cantidad: -Number(item.cantidad),
      }));
      const resDevolucion = await fetch('/api/productos/descontar-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsDevolucion }),
      });
      const { error: errorDevolucion } = await resDevolucion.json();
      if (errorDevolucion) {
        alert('Error devolviendo el stock al inventario: ' + errorDevolucion);
        return;
      }

      const resAnular = await fetch(`/api/ventas/${ventaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anulada: true }),
      });
      const { error: errorAnular } = await resAnular.json();
      if (errorAnular) {
        alert('El stock ya se devolvió al inventario, pero no se pudo marcar la venta como anulada: ' + errorAnular);
        return;
      }

      alert(`Ticket #${ventaId} anulado. El stock ya fue devuelto al inventario.`);
      setTicketAbierto(null);
      await cargarClientes();
      await cargarEstadoCuenta(clienteSeleccionado.id);
    } catch (err) {
      console.error('No se pudo anular la venta:', err);
      alert('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setEliminandoVenta(false);
    }
  }

  function limpiarFormulario() {
    setClienteSeleccionado(null);
    setCedulaRif('');
    setNombre('');
    setTelefono('');
    setDireccion('');
    setTipoCredito('contado');
    setMontoLimite('');
    setMovimientos([]);
    setVentasCredito([]);
    setMostrarAbono(false);
    setMontoAbono('');
    setMetodoAbono('efectivo_usd');
    setVentaAbono(null);
    setPestaña('nuevo');
    setVistaMovil('datos');
  }

  // ---------------------------------------------------------
  // Guardar (crear o actualizar) cliente
  // ---------------------------------------------------------
  async function guardarCliente() {
    if (!nombre.trim()) {
      alert('El nombre es obligatorio');
      return;
    }
    if (tipoCredito === 'limite' && !montoLimite) {
      alert('Ingresa el monto máximo del límite de crédito');
      return;
    }

    setGuardando(true);

    const payload = {
      cedula_rif: cedulaRif || null,
      nombre: nombre.trim(),
      telefono: telefono || null,
      direccion: direccion || null,
      tipo_credito: tipoCredito,
      monto_limite: tipoCredito === 'limite' ? Number(montoLimite) : null,
    };

    try {
      if (clienteSeleccionado) {
        const res = await fetch(`/api/clientes/${clienteSeleccionado.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const { error } = await res.json();
        if (error) {
          console.error(error);
          alert('Error al actualizar el cliente');
          return;
        }
      } else {
        const res = await fetch('/api/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const { error } = await res.json();
        if (error) {
          console.error(error);
          alert('Error al crear el cliente');
          return;
        }
      }

      await cargarClientes();
      limpiarFormulario();
    } catch (err) {
      console.error('Error de conexión al guardar cliente:', err);
      alert('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  // ---------------------------------------------------------
  // Eliminar cliente
  // ---------------------------------------------------------
  async function eliminarCliente() {
    if (!clienteSeleccionado) return;

    const confirmar = confirm(`¿Eliminar a ${clienteSeleccionado.nombre}?`);
    if (!confirmar) return;

    try {
      const res = await fetch(`/api/clientes/${clienteSeleccionado.id}`, { method: 'DELETE' });
      const { error } = await res.json();

      if (error) {
        alert(error);
        return;
      }

      await cargarClientes();
      limpiarFormulario();
    } catch (err) {
      console.error('Error de conexión al eliminar cliente:', err);
      alert('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.');
    }
  }

  // ---------------------------------------------------------
  // Registrar abono a una venta a crédito específica
  // ---------------------------------------------------------
  async function registrarAbono() {
    if (!clienteSeleccionado) return;
    
    if (!ventaAbono) {
      alert('Selecciona a qué venta se aplica el abono');
      return;
    }
    const monto = Number(montoAbono);
    if (!monto || monto <= 0) {
      alert('Ingresa un monto de abono válido');
      return;
    }
    // Para los métodos en bolívares necesitamos la tasa del día para
    // poder convertir el monto a dólares (total_abono_usd).
    if (metodoAbono !== 'efectivo_usd' && tasaHoy <= 0) {
      alert('No se pudo cargar la tasa del dólar de hoy. Configúrala en el Dashboard antes de registrar este abono.');
      return;
    }

    const montoEnUsd = metodoAbono === 'efectivo_usd' ? monto : monto / tasaHoy;
    const deudaVenta = saldoDeVenta(ventaAbono);
    // Tolerancia mínima por redondeo de centavos
    if (montoEnUsd > deudaVenta + 0.01) {
      alert(`El abono no puede ser mayor a lo que debe esta venta: $${formatoUsd(deudaVenta)}.`);
      return;
    }

    const payload: any = {
      venta_id: ventaAbono,
      abono_efectivo_usd: 0,
      abono_efectivo_bs: 0,
      abono_tarjeta: 0,
      abono_transferencia: 0,
      abono_biopago: 0,
      tasa_dolar: tasaHoy,
    };

    if (metodoAbono === 'efectivo_usd') {
      // El monto ingresado ya está en dólares, no necesita conversión.
      payload.abono_efectivo_usd = monto;
      payload.total_abono_usd = monto;
    } else {
      // El monto ingresado está en bolívares para el resto de métodos.
      const campoPorMetodo: Record<Exclude<MetodoAbono, 'efectivo_usd'>, string> = {
        efectivo_bs: 'abono_efectivo_bs',
        tarjeta: 'abono_tarjeta',
        transferencia: 'abono_transferencia',
        biopago: 'abono_biopago',
      };
      payload[campoPorMetodo[metodoAbono]] = monto;
      payload.total_abono_usd = monto / tasaHoy;
    }

    setRegistrandoAbono(true);

    try {
      const res = await fetch('/api/creditos-abonos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const { error } = await res.json();

      if (error) {
        console.error(error);
        alert('Error al registrar el abono: ' + error);
        return;
      }

      setMostrarAbono(false);
      setMontoAbono('');
      setMetodoAbono('efectivo_usd');
      setVentaAbono(null);
      await cargarClientes();
      await cargarEstadoCuenta(clienteSeleccionado.id);
    } catch (err) {
      console.error('Error de conexión al registrar abono:', err);
      alert('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setRegistrandoAbono(false);
    }
  }

  const clientesFiltrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.cedula_rif || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const formatoUsd = (n: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const saldoSeleccionado = clienteSeleccionado ? saldos[clienteSeleccionado.id] : undefined;

  // Cuánto queda pendiente de una venta a crédito específica (venta - abonos ya hechos a esa venta)
  function saldoDeVenta(ventaId: number): number {
    return movimientos
      .filter((m) => m.folio === ventaId && !m.anulada)
      .reduce((acc, m) => acc + m.monto, 0);
  }

  const saldoVentaAbono = ventaAbono ? saldoDeVenta(ventaAbono) : 0;

  // Conversión en vivo del monto de abono para mostrar su equivalencia y lo que resta
  const montoAbonoUsd = metodoAbono === 'efectivo_usd'
    ? Number(montoAbono || 0)
    : tasaHoy > 0 ? Number(montoAbono || 0) / tasaHoy : 0;
  const restanteVentaTrasAbono = saldoVentaAbono - montoAbonoUsd;

  // ----- Créditos por pedidos: cuánto se ha asignado entre los métodos y cuánto falta -----
  const asignadoPagoPedidosUsd =
    Number(pagoPedidosEfectivoUsd || 0) +
    (tasaHoy > 0 ? Number(pagoPedidosEfectivoBs || 0) / tasaHoy : 0) +
    (tasaHoy > 0 ? Number(pagoPedidosTarjeta || 0) / tasaHoy : 0) +
    (tasaHoy > 0 ? Number(pagoPedidosTransferencia || 0) / tasaHoy : 0) +
    (tasaHoy > 0 ? Number(pagoPedidosBiopago || 0) / tasaHoy : 0);
  const deudaRestanteTrasPagoPedidos = deudaPedidosUsd - asignadoPagoPedidosUsd;

  // Etiqueta del input de monto: cambia entre $ y Bs según el método elegido
  const etiquetaMonto = metodoAbono === 'efectivo_usd' ? 'Monto a abonar ($)' : 'Monto a abonar (Bs)';

  if (verificandoSesion) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>Verificando sesión...</div>;
  }

  return (
    <div className="page">
      {/* ---------- Barra superior ---------- */}
      <div className="topbar">
        <h1 className="titulo">Clientes y Créditos</h1>
        <button style={btnVolver} onClick={() => router.push('/dashboard')}>← Menú</button>
      </div>

      {/* ---------- Pestañas solo visibles en pantallas angostas ---------- */}
      <div className="tabsMovil">
        <button
          className={`tab ${vistaMovil === 'lista' ? 'activo' : ''}`}
          onClick={() => setVistaMovil('lista')}
        >
          Clientes
        </button>
        <button
          className={`tab ${vistaMovil === 'datos' ? 'activo' : ''}`}
          onClick={() => setVistaMovil('datos')}
        >
          Datos
        </button>
        <button
          className={`tab ${vistaMovil === 'cuenta' ? 'activo' : ''}`}
          onClick={() => clienteSeleccionado && setVistaMovil('cuenta')}
          disabled={!clienteSeleccionado}
        >
          Cuenta
        </button>
      </div>

      <div className="main">
        {/* ---------- Panel 1: Lista de clientes ---------- */}
        <div className={`panel panelLista ${vistaMovil === 'lista' ? 'activo' : ''}`}>
          <div className="buscadorWrap">
            <input
              style={inputStyle}
              placeholder="Buscar cliente..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div className="listaScroll">
            {cargando && <div className="mensajeVacio">Cargando...</div>}
            {!cargando && clientesFiltrados.length === 0 && (
              <div className="mensajeVacio">Sin clientes registrados</div>
            )}
            {clientesFiltrados.map((c) => {
              const saldo = saldos[c.id]?.saldo_usd || 0;
              return (
                <div
                  key={c.id}
                  onClick={() => seleccionarCliente(c)}
                  className="itemCliente"
                  style={{
                    backgroundColor: clienteSeleccionado?.id === c.id ? '#f3f4f6' : 'white',
                  }}
                >
                  <div>
                    <div className="nombreCliente">{c.nombre}</div>
                    <div className="cedulaCliente">{c.cedula_rif || 'Sin cédula/RIF'}</div>
                  </div>
                  <div className="saldoCliente" style={{ color: saldo > 0 ? '#ef4444' : '#10b981' }}>
                    ${formatoUsd(saldo)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="panelFooter">
            <button style={{ ...btnSecundario, width: '100%' }} onClick={limpiarFormulario}>
              + Nuevo Cliente
            </button>
          </div>
        </div>

        {/* ---------- Panel 2: Datos / formulario ---------- */}
        <div className={`panel panelDatos ${vistaMovil === 'datos' ? 'activo' : ''}`}>
          <div className="tabsInternas">
            <button style={pestaña === 'nuevo' ? btnPrimario : btnSecundario} onClick={limpiarFormulario}>
              Nuevo
            </button>
            <button
              style={pestaña === 'editar' ? btnPrimario : btnSecundario}
              onClick={() => clienteSeleccionado && setPestaña('editar')}
              disabled={!clienteSeleccionado}
            >
              Editar
            </button>
          </div>

          <input style={{ ...inputStyle, marginBottom: '8px' }} placeholder="Cédula / RIF" value={cedulaRif} onChange={(e) => setCedulaRif(e.target.value)} />
          <input style={{ ...inputStyle, marginBottom: '8px' }} placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <input style={{ ...inputStyle, marginBottom: '8px' }} placeholder="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          <input style={{ ...inputStyle, marginBottom: '8px' }} placeholder="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />

          <div className="cajaCredito">
            <h3 className="tituloCajaCredito">Configuración de Crédito</h3>
            <label className="radioLabel">
              <input type="radio" name="tipo" value="contado" checked={tipoCredito === 'contado'} onChange={(e) => setTipoCredito(e.target.value as TipoCredito)} />
              Contado (sin crédito)
            </label>
            <label className="radioLabel">
              <input type="radio" name="tipo" value="ilimitado" checked={tipoCredito === 'ilimitado'} onChange={(e) => setTipoCredito(e.target.value as TipoCredito)} />
              Crédito Ilimitado
            </label>
            <label className="radioLabel">
              <input type="radio" name="tipo" value="limite" checked={tipoCredito === 'limite'} onChange={(e) => setTipoCredito(e.target.value as TipoCredito)} />
              Límite de Crédito
            </label>

            {tipoCredito === 'limite' && (
              <input
                style={{ ...inputStyle, marginTop: '8px' }}
                placeholder="Monto máximo ($)"
                type="number"
                value={montoLimite}
                onChange={(e) => setMontoLimite(e.target.value)}
              />
            )}

            {clienteSeleccionado && saldoSeleccionado && tipoCredito !== 'contado' && (
              <div className="infoSaldo">
                <div>
                  <span className="labelGris">Saldo: </span>
                  <strong style={{ color: saldoSeleccionado.saldo_usd > 0 ? '#ef4444' : '#10b981' }}>
                    ${formatoUsd(saldoSeleccionado.saldo_usd)}
                  </strong>
                </div>
                {clienteSeleccionado.tipo_credito === 'limite' && (
                  <div>
                    <span className="labelGris">Límite: </span>
                    <strong>${formatoUsd(Number(clienteSeleccionado.monto_limite))}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="accionesForm">
            {clienteSeleccionado ? (
              <button style={btnEliminar} onClick={eliminarCliente}>Eliminar</button>
            ) : <span />}
            <button style={btnPrimario} onClick={guardarCliente} disabled={guardando}>
              {guardando ? 'Guardando...' : clienteSeleccionado ? 'Guardar Cambios' : 'Crear Cliente'}
            </button>
          </div>
        </div>

        {/* ---------- Panel 3: Estado de cuenta ---------- */}
        <div className={`panel panelCuenta ${vistaMovil === 'cuenta' ? 'activo' : ''}`}>
          {!clienteSeleccionado ? (
            <div className="mensajeVacio" style={{ padding: '24px 12px' }}>
              Elige un cliente para ver su estado de cuenta.
            </div>
          ) : (
            <>
              <div className="cuentaHeader">
                <h3 className="tituloCuenta">Estado de Cuenta</h3>
                <button
                  style={btnSecundario}
                  onClick={() => setMostrarAbono(!mostrarAbono)}
                  disabled={ventasCredito.length === 0}
                >
                  Abonar a deuda
                </button>
              </div>
              
              {ventasCredito.length === 0 && (
                <div className="mensajeVacio">
                  Sin ventas a crédito pendientes (esto no incluye la deuda por pedidos, que se muestra más abajo).
                </div>
              )}

              {mostrarAbono && (
                <div style={{ marginBottom: '10px' }}>
                  <div className="filaAbono">
                    <select
                      style={inputStyle}
                      value={ventaAbono ?? ''}
                      onChange={(e) => setVentaAbono(Number(e.target.value))}
                    >
                      <option value="">Selecciona la venta a abonar</option>
                      {ventasCredito.map((v) => (
                        <option key={v.id} value={v.id}>
                          Venta #{v.id} — debe: ${formatoUsd(saldoDeVenta(v.id))}
                        </option>
                      ))}
                    </select>
                    <select
                      style={inputStyle}
                      value={metodoAbono}
                      onChange={(e) => setMetodoAbono(e.target.value as MetodoAbono)}
                    >
                      <option value="efectivo_usd">Efectivo $</option>
                      <option value="efectivo_bs">Efectivo Bs</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="biopago">Biopago</option>
                    </select>
                    <input
                      style={inputStyle}
                      type="number"
                      step="0.01"
                      max={metodoAbono === 'efectivo_usd' ? saldoVentaAbono : saldoVentaAbono * tasaHoy}
                      placeholder={etiquetaMonto}
                      value={montoAbono}
                      onChange={(e) => setMontoAbono(e.target.value)}
                    />
                    <button style={btnPrimario} onClick={registrarAbono} disabled={registrandoAbono}>
                      {registrandoAbono ? 'Guardando...' : 'Confirmar'}
                    </button>
                  </div>
                  {ventaAbono && (
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '0' }}>
                      Debe esta venta: ${formatoUsd(saldoVentaAbono)}
                      {tasaHoy > 0 ? ` (Bs ${formatoUsd(saldoVentaAbono * tasaHoy)})` : ''}
                      {Number(montoAbono || 0) > 0 && (
                        <>
                          {' — '}Ingresado: ${formatoUsd(montoAbonoUsd)}
                          {tasaHoy > 0 ? ` (Bs ${formatoUsd(montoAbonoUsd * tasaHoy)})` : ''}
                          {' — '}
                          <strong style={{ color: restanteVentaTrasAbono < -0.01 ? '#dc2626' : '#111827' }}>
                            Resta: ${formatoUsd(Math.max(restanteVentaTrasAbono, 0))}
                            {tasaHoy > 0 ? ` (Bs ${formatoUsd(Math.max(restanteVentaTrasAbono, 0) * tasaHoy)})` : ''}
                          </strong>
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}

              <div className="cuentaScrollable">
              {cargandoMovimientos && <div className="mensajeVacio">Cargando movimientos...</div>}

              {!cargandoMovimientos && movimientos.length === 0 && ventasCredito.length > 0 && (
                <div className="mensajeVacio">Sin movimientos.</div>
              )}

              {!cargandoMovimientos && movimientos.length > 0 && (
                <div className="tablaCuentaScroll">
                  <table className="tablaCuenta">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Mov.</th>
                        <th>Descripción</th>
                        <th style={{ textAlign: 'right' }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.map((m, i) => (
                        <tr
                          key={i}
                          onClick={() => m.tipo === 'venta' && verTicket(m.folio)}
                          style={{ cursor: m.tipo === 'venta' ? 'pointer' : 'default', opacity: m.anulada ? 0.6 : 1 }}
                        >
                          <td>{new Date(m.fecha).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            <span className="badge" style={{
                              backgroundColor: m.tipo === 'venta' ? '#dcfce7' : '#fee2e2',
                              color: m.tipo === 'venta' ? '#166534' : '#991b1b',
                            }}>
                              {m.tipo.toUpperCase()}
                            </span>
                            {m.anulada && (
                              <span className="badge" style={{ marginLeft: '4px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #dc2626' }}>
                                CANC.
                              </span>
                            )}
                          </td>
                          <td style={{ color: '#6b7280', textDecoration: m.anulada ? 'line-through' : 'none' }}>
                            {m.descripcion}
                            {m.tipo === 'venta' && (
                              <span className="verProductos">🧾 Ver ticket</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', color: m.monto >= 0 ? '#166534' : '#991b1b', textDecoration: m.anulada ? 'line-through' : 'none' }}>
                            {m.monto >= 0 ? '+' : ''}${formatoUsd(m.monto)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ---------- Créditos por pedidos (Sistema A) ---------- */}
              <div className="cajaCredito" style={{ marginTop: '14px' }}>
                <h3 className="tituloCajaCredito">Créditos por pedidos</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <button
                    style={vistaCreditoPedidos === 'pago' ? btnPrimario : btnSecundario}
                    onClick={abrirRegistrarPagoPedidos}
                  >
                    Registrar pago
                  </button>
                  <button
                    style={vistaCreditoPedidos === 'historial' ? btnPrimario : btnSecundario}
                    onClick={verHistorialPagosPedidos}
                  >
                    Historial de pagos
                  </button>
                </div>

                {vistaCreditoPedidos === 'deuda' && (
                  <div>
                    {cargandoDeudaPedidos && <div className="mensajeVacio">Cargando deuda...</div>}
                    {errorDeudaPedidos && <div className="mensajeVacio" style={{ color: '#dc2626' }}>{errorDeudaPedidos}</div>}
                    {!cargandoDeudaPedidos && !errorDeudaPedidos && (
                      <>
                        <p style={{ fontSize: '22px', fontWeight: 'bold', margin: '4px 0 2px' }}>
                          ${formatoUsd(deudaPedidosUsd)}
                          {tasaHoy > 0 ? <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#6b7280' }}> — Bs {formatoUsd(deudaPedidosUsd * tasaHoy)}</span> : ''}
                        </p>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 10px' }}>
                          {tasaHoy > 0
                            ? `Tasa del día: ${formatoUsd(tasaHoy)}`
                            : 'No se pudo cargar la tasa del día, no se puede mostrar el equivalente en Bs.'}
                        </p>
                        {pedidosPendientes.length === 0 && (
                          <div className="mensajeVacio">Sin deuda pendiente por pedidos.</div>
                        )}
                        {pedidosPendientes.map((pedido) => (
                          <div key={pedido.id} style={{ marginBottom: '10px', borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                                Pedido #{pedido.id} — {new Date(pedido.created_at).toLocaleDateString()} — ${formatoUsd(pedido.total_pedido_usd)}
                              </p>
                              {puedeCancelarVentas && (
                                <button
                                  style={{ ...btnEliminar, padding: '2px 6px', fontSize: '11px' }}
                                  onClick={() => eliminarPedidoCredito(pedido)}
                                  disabled={eliminandoPedidoId === pedido.id}
                                >
                                  {eliminandoPedidoId === pedido.id ? 'Eliminando...' : 'Eliminar'}
                                </button>
                              )}
                            </div>
                            <table className="tablaCuenta">
                              <thead>
                                <tr>
                                  <th>Producto</th>
                                  <th style={{ textAlign: 'right' }}>Pend.</th>
                                  <th style={{ textAlign: 'right' }}>Subt.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pedido.items.map((it) => (
                                  <tr key={it.id}>
                                    <td>{it.nombre_producto}</td>
                                    <td style={{ textAlign: 'right' }}>{it.cantidad_pendiente}</td>
                                    <td style={{ textAlign: 'right' }}>${formatoUsd(it.subtotal_actual)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {vistaCreditoPedidos === 'pago' && (
                  <div>
                    <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
                      <p style={{ fontSize: '11px', color: '#78716c', margin: '0 0 2px', fontWeight: 'bold' }}>A pagar:</p>
                      <p style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
                        ${formatoUsd(deudaPedidosUsd)}
                        {tasaHoy > 0 ? <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#57534e' }}> — Bs {formatoUsd(deudaPedidosUsd * tasaHoy)}</span> : ''}
                      </p>
                      <p style={{ fontSize: '11px', color: '#78716c', margin: '2px 0 0' }}>
                        {tasaHoy > 0 ? `Tasa del día: ${formatoUsd(tasaHoy)}` : 'No se pudo cargar la tasa del día'}
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Monto total asignado (USD)</label>
                        <div style={{ ...inputStyle, background: '#f3f4f6', minHeight: '36px', display: 'flex', alignItems: 'center' }}>
                          ${formatoUsd(asignadoPagoPedidosUsd)}
                          {tasaHoy > 0 && asignadoPagoPedidosUsd > 0 ? ` — Bs ${formatoUsd(asignadoPagoPedidosUsd * tasaHoy)}` : ''}
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Efectivo USD</label>
                        <input style={inputStyle} type="number" step="0.01" value={pagoPedidosEfectivoUsd} onChange={(e) => setPagoPedidosEfectivoUsd(e.target.value)} />
                        {tasaHoy > 0 && Number(pagoPedidosEfectivoUsd || 0) > 0 && (
                          <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0' }}>
                            Bs {formatoUsd(Number(pagoPedidosEfectivoUsd) * tasaHoy)}
                          </p>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Efectivo Bs</label>
                        <input style={inputStyle} type="number" step="0.01" value={pagoPedidosEfectivoBs} onChange={(e) => setPagoPedidosEfectivoBs(e.target.value)} />
                        {tasaHoy > 0 && Number(pagoPedidosEfectivoBs || 0) > 0 && (
                          <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0' }}>
                            ${formatoUsd(Number(pagoPedidosEfectivoBs) / tasaHoy)}
                          </p>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Tarjeta</label>
                        <input style={inputStyle} type="number" step="0.01" value={pagoPedidosTarjeta} onChange={(e) => setPagoPedidosTarjeta(e.target.value)} />
                        {tasaHoy > 0 && Number(pagoPedidosTarjeta || 0) > 0 && (
                          <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0' }}>
                            ${formatoUsd(Number(pagoPedidosTarjeta) / tasaHoy)}
                          </p>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Transferencia</label>
                        <input style={inputStyle} type="number" step="0.01" value={pagoPedidosTransferencia} onChange={(e) => setPagoPedidosTransferencia(e.target.value)} />
                        {tasaHoy > 0 && Number(pagoPedidosTransferencia || 0) > 0 && (
                          <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0' }}>
                            ${formatoUsd(Number(pagoPedidosTransferencia) / tasaHoy)}
                          </p>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Biopago</label>
                        <input style={inputStyle} type="number" step="0.01" value={pagoPedidosBiopago} onChange={(e) => setPagoPedidosBiopago(e.target.value)} />
                        {tasaHoy > 0 && Number(pagoPedidosBiopago || 0) > 0 && (
                          <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0' }}>
                            ${formatoUsd(Number(pagoPedidosBiopago) / tasaHoy)}
                          </p>
                        )}
                      </div>
                    </div>

                    {asignadoPagoPedidosUsd > 0 && (
                      <p style={{ fontSize: '12px', margin: '10px 0 0', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                        Total a abonar: ${formatoUsd(asignadoPagoPedidosUsd)}
                        {tasaHoy > 0 ? ` (Bs ${formatoUsd(asignadoPagoPedidosUsd * tasaHoy)})` : ''}
                        <br />
                        Deuda restante después de este pago: ${formatoUsd(Math.max(deudaRestanteTrasPagoPedidos, 0))}
                      </p>
                    )}

                    {errorPagoPedidos && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px' }}>{errorPagoPedidos}</p>}
                    {mensajePagoPedidosOk && <p style={{ fontSize: '12px', color: '#16a34a', marginTop: '8px' }}>{mensajePagoPedidosOk}</p>}

                    <button
                      style={{ ...btnPrimario, marginTop: '10px', opacity: registrandoPagoPedidos ? 0.6 : 1 }}
                      onClick={registrarPagoPedidos}
                      disabled={registrandoPagoPedidos}
                    >
                      {registrandoPagoPedidos ? 'Registrando...' : 'Registrar pago'}
                    </button>
                  </div>
                )}

                {vistaCreditoPedidos === 'historial' && (
                  <div>
                    {cargandoHistorialPedidos && <div className="mensajeVacio">Cargando historial...</div>}
                    {errorHistorialPedidos && <div className="mensajeVacio" style={{ color: '#dc2626' }}>{errorHistorialPedidos}</div>}
                    {!cargandoHistorialPedidos && !errorHistorialPedidos && (
                      <>
                        {historialPagosPedidos.length === 0 && (
                          <div className="mensajeVacio">Sin pagos registrados por pedidos.</div>
                        )}
                        {historialPagosPedidos.length > 0 && (
                          <table className="tablaCuenta">
                            <thead>
                              <tr>
                                <th>Fecha</th>
                                <th style={{ textAlign: 'right' }}>Monto</th>
                                <th style={{ textAlign: 'right' }}>Ganancia</th>
                                <th>Método</th>
                                <th>Vendedor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historialPagosPedidos.map((pago, idx) => (
                                <tr key={pago.id ?? idx}>
                                  <td>{pago.created_at ? new Date(pago.created_at).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                  <td style={{ textAlign: 'right' }}>${formatoUsd(Number(pago.monto_usd || 0))}</td>
                                  <td style={{ textAlign: 'right' }}>${formatoUsd(Number(pago.ganancia_usd || 0))}</td>
                                  <td>{describirMetodoPago(pago)}</td>
                                  <td>{pago.vendedor_nombre || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---------- Modal: ticket de la venta ---------- */}
      {ticketAbierto !== null && (() => {
        const ventaTicket = movimientos.find((m) => m.tipo === 'venta' && m.folio === ticketAbierto);
        const items = itemsPorVenta[ticketAbierto];
        const cargandoEsteTicket = cargandoItems === ticketAbierto;
        const totalTicket = (items || []).reduce((acc, it: any) => acc + Number(it.subtotal || 0), 0);

        return (
          <div className="ticketOverlay" onClick={() => setTicketAbierto(null)}>
            <div className="ticketModal" onClick={(e) => e.stopPropagation()}>
              <div className="ticketHeader">
                <div className="ticketNegocio">DURAGONZ V1.0</div>
                <div className="ticketFolio">Venta #{ticketAbierto}</div>
                {ventaTicket && (
                  <div className="ticketFecha">
                    {new Date(ventaTicket.fecha).toLocaleString('es-VE', {
                      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                )}
                {clienteSeleccionado && (
                  <div className="ticketCliente">Cliente: {clienteSeleccionado.nombre}</div>
                )}
                {ventaTicket?.anulada && (
                  <div className="ticketAviso">⚠ Venta anulada — el stock ya fue repuesto</div>
                )}
              </div>

              <div className="ticketLineaDivisoria" />

              {cargandoEsteTicket && <div className="mensajeVacio">Cargando ticket...</div>}

              {!cargandoEsteTicket && (!items || items.length === 0) && (
                <div className="mensajeVacio">Sin productos registrados para esta venta.</div>
              )}

              {!cargandoEsteTicket && items && items.length > 0 && (
                <>
                  <table className="ticketTabla">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th style={{ textAlign: 'right' }}>Cant.</th>
                        <th style={{ textAlign: 'right' }}>P.U.</th>
                        <th style={{ textAlign: 'right' }}>Subt.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it: any) => (
                        <tr key={it.id}>
                          <td>{it.nombre_producto}</td>
                          <td style={{ textAlign: 'right' }}>{it.cantidad}</td>
                          <td style={{ textAlign: 'right' }}>${formatoUsd(Number(it.precio_unitario))}</td>
                          <td style={{ textAlign: 'right' }}>${formatoUsd(Number(it.subtotal))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="ticketLineaDivisoria" />

                  <div className="ticketTotal">
                    <span>TOTAL</span>
                    <span>${formatoUsd(totalTicket)}</span>
                  </div>
                </>
              )}

              {!ventaTicket?.anulada && puedeCancelarVentas && (
                <button
                  className="ticketCerrar"
                  style={{ background: '#ef4444', marginTop: '8px' }}
                  onClick={() => anularVentaTicket(ticketAbierto)}
                  disabled={eliminandoVenta}
                >
                  {eliminandoVenta ? 'Anulando...' : 'Anular este ticket'}
                </button>
              )}

              <button className="ticketCerrar" onClick={() => setTicketAbierto(null)}>
                Cerrar
              </button>
            </div>
          </div>
        );
      })()}

      <style jsx>{`
        .page {
          height: 100vh;
          height: 100dvh;
          display: flex;
          flex-direction: column;
          background-color: #f9fafb;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
        }
        .avisoOffline {
          flex-shrink: 0;
          background-color: #fef3c7;
          color: #92400e;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 16px;
          text-align: center;
        }
        .topbar {
          flex-shrink: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          background: white;
          border-bottom: 1px solid #e5e7eb;
        }
        .titulo {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
          color: #111827;
        }
        .tabsMovil {
          display: none;
        }
        .main {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: 230px 300px 1fr;
          gap: 10px;
          padding: 10px;
        }
        .panel {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }
        .panelDatos {
          padding: 12px;
          overflow-y: auto;
        }
        .panelCuenta {
          padding: 12px;
          overflow: hidden;
        }
        .cuentaScrollable {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
        }
        .buscadorWrap {
          padding: 10px;
          border-bottom: 1px solid #e5e7eb;
          flex-shrink: 0;
        }
        .listaScroll {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
        }
        .panelFooter {
          padding: 8px 10px;
          border-top: 1px solid #e5e7eb;
          flex-shrink: 0;
        }
        .mensajeVacio {
          padding: 14px 10px;
          color: #6b7280;
          font-size: 13px;
        }
        .itemCliente {
          padding: 10px 12px;
          border-bottom: 1px solid #f3f4f6;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .nombreCliente {
          font-weight: 600;
          font-size: 13px;
        }
        .cedulaCliente {
          font-size: 11px;
          color: #6b7280;
        }
        .saldoCliente {
          font-size: 12px;
          font-weight: bold;
        }
        .tabsInternas {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        .cajaCredito {
          background: #f9fafb;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          margin: 8px 0;
        }
        .tituloCajaCredito {
          font-weight: bold;
          font-size: 13px;
          margin: 0 0 6px 0;
        }
        .radioLabel {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-size: 13px;
          margin-bottom: 8px;
        }
        .infoSaldo {
          margin-top: 10px;
          display: flex;
          gap: 16px;
          font-size: 13px;
        }
        .labelGris {
          color: #6b7280;
        }
        .accionesForm {
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
        }
        .cuentaHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          flex-shrink: 0;
        }
        .tituloCuenta {
          font-weight: bold;
          font-size: 15px;
          margin: 0;
        }
        .filaAbono {
          display: flex;
          gap: 6px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .tablaCuentaScroll {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
        }
        .tablaCuenta {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .tablaCuenta th {
          text-align: left;
          color: #6b7280;
          border-bottom: 1px solid #e5e7eb;
          padding: 6px 4px;
          position: sticky;
          top: 0;
          background: white;
        }
        .tablaCuenta td {
          padding: 6px 4px;
          border-bottom: 1px solid #f3f4f6;
        }
        .badge {
          padding: 2px 6px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: bold;
        }
        .verProductos {
          margin-left: 5px;
          font-size: 11px;
          color: #2563eb;
        }
        /* ---------- Modal del ticket ---------- */
        .ticketOverlay {
          position: fixed;
          inset: 0;
          background: rgba(17, 24, 39, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }
        .ticketModal {
          background: white;
          width: 100%;
          max-width: 340px;
          max-height: 85vh;
          overflow-y: auto;
          border-radius: 12px;
          padding: 18px;
          font-family: 'Courier New', monospace;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        }
        .ticketHeader {
          text-align: center;
        }
        .ticketNegocio {
          font-weight: bold;
          font-size: 15px;
          letter-spacing: 1px;
          color: #111827;
        }
        .ticketFolio {
          font-size: 12px;
          color: #374151;
          margin-top: 4px;
        }
        .ticketFecha {
          font-size: 11px;
          color: #6b7280;
        }
        .ticketCliente {
          font-size: 12px;
          color: #111827;
          margin-top: 4px;
          font-weight: bold;
        }
        .ticketAviso {
          margin-top: 6px;
          font-size: 11px;
          color: #dc2626;
          font-weight: bold;
        }
        .ticketLineaDivisoria {
          border-top: 1px dashed #9ca3af;
          margin: 10px 0;
        }
        .ticketTabla {
          width: 100%;
          font-size: 11px;
          border-collapse: collapse;
        }
        .ticketTabla th {
          text-align: left;
          color: #6b7280;
          padding: 3px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .ticketTabla td {
          padding: 4px 0;
          color: #111827;
        }
        .ticketTotal {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          font-size: 14px;
          color: #111827;
        }
        .ticketCerrar {
          width: 100%;
          margin-top: 16px;
          padding: 10px;
          border-radius: 8px;
          border: none;
          background: #111827;
          color: white;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* ---------- Tablet / pantallas medianas ---------- */
        @media (max-width: 1100px) {
          .main {
            grid-template-columns: 200px 260px 1fr;
          }
        }

        /* ---------- Celular y tablet en vertical: un panel a la vez ---------- */
        @media (max-width: 860px) {
          .tabsMovil {
            display: flex;
            gap: 6px;
            padding: 8px 10px;
            background: white;
            border-bottom: 1px solid #e5e7eb;
            flex-shrink: 0;
          }
          .tab {
            flex: 1;
            padding: 8px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #f3f4f6;
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            color: #374151;
          }
          .tab.activo {
            background: #111827;
            color: white;
            border-color: #111827;
          }
          .tab:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .main {
            grid-template-columns: 1fr;
            padding: 8px;
          }
          .panel {
            display: none;
          }
          .panel.activo {
            display: flex;
          }
        }
      `}</style>
    </div>
  );
}
