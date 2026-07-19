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
  const [tipoCredito, setTipoCredito] = useState<TipoCredito>('ilimitado');
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
      const hoy = obtenerFechaLocal();
      const res = await fetch(`/api/tasas-diarias?fecha=${hoy}`);
      const { data } = await res.json();
      if (data) setTasaHoy(Number(data.valor));
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
  const [ventaExpandida, setVentaExpandida] = useState<number | null>(null);
  const [itemsPorVenta, setItemsPorVenta] = useState<Record<number, any[]>>({});
  const [cargandoItems, setCargandoItems] = useState<number | null>(null);

  // Estilos compactos
  const btnPrimario = { backgroundColor: '#111827', color: 'white', padding: '9px 16px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '13px' };
  const btnSecundario = { backgroundColor: '#f3f4f6', color: '#374151', padding: '9px 14px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '13px' };
  const btnEliminar = { color: '#ef4444', fontWeight: 'bold', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', padding: '9px', fontSize: '13px' };
  const btnVolver = { backgroundColor: '#f9fafb', color: '#374151', padding: '7px 14px', borderRadius: '8px', fontWeight: 600, border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '13px' };
  const inputStyle = { padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: '8px', width: '100%', boxSizing: 'border-box' as const, fontSize: '13px' };

  // ---------------------------------------------------------
  // Cargar clientes + saldos (vista saldo_clientes)
  // ---------------------------------------------------------
  async function cargarClientes() {
    setCargando(true);

    try {
      const res = await fetch('/api/clientes');
      const { clientes: clientesData, saldos: saldosData, error } = await res.json();

      if (error) console.error(error);

      setClientes((clientesData as Cliente[]) || []);

      const mapaSaldos: Record<number, SaldoCliente> = {};
      (saldosData as SaldoCliente[] | null)?.forEach((s) => {
        mapaSaldos[s.cliente_id] = s;
      });
      setSaldos(mapaSaldos);
    } catch (err) {
      console.error(err);
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
    setVentaExpandida(null);
    setItemsPorVenta({});
    // En pantallas angostas, al elegir un cliente vamos directo al estado
    // de cuenta, que es lo que casi siempre se necesita ver primero.
    setVistaMovil('cuenta');

    await cargarEstadoCuenta(cliente.id);
  }

  async function cargarEstadoCuenta(clienteId: number) {
    setCargandoMovimientos(true);

    const resVentas = await fetch(`/api/ventas?cliente_id=${clienteId}&credito=true`);
    const { data: ventas, error: errVentas } = await resVentas.json();

    if (errVentas) console.error(errVentas);

    const ventasList = (ventas as VentaCredito[]) || [];
    setVentasCredito(ventasList.filter((v) => !v.anulada));

    let abonosList: AbonoCredito[] = [];
    if (ventasList.length > 0) {
      const idsVentas = ventasList.map((v) => v.id);
      const resAbonos = await fetch(`/api/creditos-abonos?venta_ids=${idsVentas.join(',')}`);
      const { data: abonos, error: errAbonos } = await resAbonos.json();

      if (errAbonos) console.error(errAbonos);
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
      })),
    ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    setMovimientos(combinados);
    setCargandoMovimientos(false);
  }

  async function verDetalleVenta(ventaId: number) {
    if (ventaExpandida === ventaId) {
      setVentaExpandida(null);
      return;
    }

    setVentaExpandida(ventaId);

    if (itemsPorVenta[ventaId]) return;

    setCargandoItems(ventaId);
    const res = await fetch(`/api/venta-items?venta_id=${ventaId}`);
    const { data, error } = await res.json();

    if (error) console.error(error);

    setItemsPorVenta((prev) => ({ ...prev, [ventaId]: data || [] }));
    setCargandoItems(null);
  }

  function limpiarFormulario() {
    setClienteSeleccionado(null);
    setCedulaRif('');
    setNombre('');
    setTelefono('');
    setDireccion('');
    setTipoCredito('ilimitado');
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
      }
    }

    setGuardando(false);
    await cargarClientes();
    limpiarFormulario();
  }

  // ---------------------------------------------------------
  // Eliminar cliente
  // ---------------------------------------------------------
  async function eliminarCliente() {
    if (!clienteSeleccionado) return;
    const confirmar = confirm(`¿Eliminar a ${clienteSeleccionado.nombre}?`);
    if (!confirmar) return;

    const res = await fetch(`/api/clientes/${clienteSeleccionado.id}`, { method: 'DELETE' });
    const { error } = await res.json();

    if (error) {
      alert(error);
      return;
    }

    await cargarClientes();
    limpiarFormulario();
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
  }

  const clientesFiltrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.cedula_rif || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const formatoUsd = (n: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const saldoSeleccionado = clienteSeleccionado ? saldos[clienteSeleccionado.id] : undefined;

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

            {clienteSeleccionado && saldoSeleccionado && (
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
                  Este cliente no tiene ventas a crédito pendientes.
                </div>
              )}

              {mostrarAbono && (
                <div className="filaAbono">
                  <select
                    style={inputStyle}
                    value={ventaAbono ?? ''}
                    onChange={(e) => setVentaAbono(Number(e.target.value))}
                  >
                    <option value="">Selecciona la venta a abonar</option>
                    {ventasCredito.map((v) => (
                      <option key={v.id} value={v.id}>
                        Venta #{v.id} — crédito: ${formatoUsd(Number(v.pago_credito_usd))}
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
                    placeholder={etiquetaMonto}
                    value={montoAbono}
                    onChange={(e) => setMontoAbono(e.target.value)}
                  />
                  <button style={btnPrimario} onClick={registrarAbono}>Confirmar</button>
                </div>
              )}

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
                        <Fragment key={i}>
                          <tr
                            onClick={() => m.tipo === 'venta' && verDetalleVenta(m.folio)}
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
                                <span className="verProductos">
                                  {ventaExpandida === m.folio ? '▲' : '▼'}
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', color: m.monto >= 0 ? '#166534' : '#991b1b', textDecoration: m.anulada ? 'line-through' : 'none' }}>
                              {m.monto >= 0 ? '+' : ''}${formatoUsd(m.monto)}
                            </td>
                          </tr>
                          {m.tipo === 'venta' && ventaExpandida === m.folio && (
                            <tr>
                              <td colSpan={4} className="detalleVentaCelda">
                                {m.anulada && (
                                  <div className="avisoCancelada">
                                    ⚠ Venta anulada. El stock ya fue repuesto y no cuenta en la deuda.
                                  </div>
                                )}
                                {cargandoItems === m.folio && (
                                  <div className="mensajeVacio">Cargando productos...</div>
                                )}
                                {cargandoItems !== m.folio && (
                                  <table className="tablaDetalle">
                                    <thead>
                                      <tr>
                                        <th>Producto</th>
                                        <th style={{ textAlign: 'right' }}>Cant.</th>
                                        <th style={{ textAlign: 'right' }}>P.U.</th>
                                        <th style={{ textAlign: 'right' }}>Subt.</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(itemsPorVenta[m.folio] || []).length === 0 && (
                                        <tr><td colSpan={4} style={{ color: '#9ca3af' }}>Sin productos registrados</td></tr>
                                      )}
                                      {(itemsPorVenta[m.folio] || []).map((it: any) => (
                                        <tr key={it.id}>
                                          <td>{it.nombre_producto}</td>
                                          <td style={{ textAlign: 'right' }}>{it.cantidad}</td>
                                          <td style={{ textAlign: 'right' }}>${formatoUsd(Number(it.precio_unitario))}</td>
                                          <td style={{ textAlign: 'right' }}>${formatoUsd(Number(it.subtotal))}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

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
        .panelDatos, .panelCuenta {
          padding: 12px;
          overflow-y: auto;
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
          padding: 12px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          margin: 10px 0;
        }
        .tituloCajaCredito {
          font-weight: bold;
          font-size: 13px;
          margin: 0 0 8px 0;
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
        .detalleVentaCelda {
          padding: 0 4px 10px 4px !important;
          background-color: #f9fafb;
        }
        .avisoCancelada {
          color: #dc2626;
          font-weight: bold;
          font-size: 11px;
          padding: 6px 0;
        }
        .tablaDetalle {
          width: 100%;
          font-size: 11px;
          margin-top: 4px;
        }
        .tablaDetalle th {
          color: #6b7280;
          text-align: left;
          padding: 3px;
        }
        .tablaDetalle td {
          padding: 3px;
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
