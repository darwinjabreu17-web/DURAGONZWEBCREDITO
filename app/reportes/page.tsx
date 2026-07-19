'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Devuelve la fecha de HOY usando la hora local del navegador (no UTC).
function obtenerFechaLocal(): string {
  const ahora = new Date();
  const año = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

// Formatea un monto en bolívares como 10.913,72 (punto para miles, coma para decimales)
function formatearBs(numero: number): string {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numero);
}

interface Sesion {
  id: number;
  nombre: string;
  username: string;
  rol: string;
  permisos: Record<string, boolean>;
}

export default function ReportesPage() {
  const router = useRouter();

  // ---- Protección: exige sesión y permiso 'ver_reporte' (o admin) ----
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);

  useEffect(() => {
    const guardada = localStorage.getItem('sesion_usuario');
    if (!guardada) {
      router.push('/login');
      return;
    }
    let datos: Sesion;
    try {
      datos = JSON.parse(guardada) as Sesion;
    } catch {
      router.push('/login');
      return;
    }
    const esAdminSesion = datos.rol === 'admin';
    if (!esAdminSesion && !datos.permisos?.ver_reporte) {
      alert('No tienes permiso para ver los reportes');
      router.push('/dashboard');
      return;
    }
    setSesion(datos);
    setVerificandoSesion(false);
  }, [router]);

  const esAdmin = sesion?.rol === 'admin';
  const permisos = sesion?.permisos || {};
  const puedeFiltrar = esAdmin || !!permisos.ver_filtro_reportes;
  const puedeVerGanancia = esAdmin || !!permisos.ver_ganancia;
  const puedeCerrarCaja = esAdmin || !!permisos.cerrar_caja;

  const [fecha, setFecha] = useState(obtenerFechaLocal());
  const [cargando, setCargando] = useState(false);
  const [listaVentas, setListaVentas] = useState<any[]>([]);
  const [listaAbonos, setListaAbonos] = useState<any[]>([]);
  const [totales, setTotales] = useState({
    efectivo_usd: 0,
    efectivo_bs: 0,
    efectivo_bs_en_usd: 0,
    efectivo_usd_en_bs: 0,
    transf: 0,
    transf_en_usd: 0,
    tarjeta: 0,
    tarjeta_en_usd: 0,
    biopago: 0,
    biopago_en_usd: 0,
    credito: 0,
    ganancia_usd: 0,
    ganancia_bs: 0,
    abonos_usd: 0,
    abonos_ganancia_usd: 0,
  });

  useEffect(() => {
    if (verificandoSesion) return;

    async function obtenerDatos() {
      const res = await fetch(`/api/reportes?fecha=${fecha}`);
      const { ventas: ventasApi, abonos: abonosApi, error: errorReporte } = await res.json();

      if (errorReporte) { console.error('Error cargando reporte:', errorReporte); }

      const ventas = ventasApi || [];
      const abonos = abonosApi || [];

      setListaVentas(ventas);
      setListaAbonos(abonos);

      // --- Totales que vienen de ventas nuevas del día ---
      const calcVentas = ventas.reduce((acc: any, i: any) => {
        const efectivoUsd = Number(i.pago_efectivo_usd || 0);
        const efectivoBs = Number(i.pago_efectivo_bs || 0);
        const transfBs = Number(i.pago_transferencia || 0);
        const tarjetaBs = Number(i.pago_tarjeta || 0);
        const biopagoBs = Number(i.pago_biopago || 0);
        const tasaVenta = Number(i.tasa_dolar || 0);
        const gananciaUsdVenta = Number(i.ganancia_usd || 0);
        const totalVentaUsd = Number(i.total_usd || 0);
        const creditoUsd = Number(i.pago_credito_usd || 0);

        const efectivoBsEnUsd = tasaVenta > 0 ? efectivoBs / tasaVenta : 0;
        const efectivoUsdEnBs = efectivoUsd * tasaVenta;
        const transfEnUsd = tasaVenta > 0 ? transfBs / tasaVenta : 0;
        const tarjetaEnUsd = tasaVenta > 0 ? tarjetaBs / tasaVenta : 0;
        const biopagoEnUsd = tasaVenta > 0 ? biopagoBs / tasaVenta : 0;

        const fraccionCobrada = totalVentaUsd > 0 ? (totalVentaUsd - creditoUsd) / totalVentaUsd : 1;
        const gananciaCobradaUsd = gananciaUsdVenta * fraccionCobrada;

        acc.efectivo_usd += efectivoUsd;
        acc.efectivo_bs += efectivoBs;
        acc.efectivo_bs_en_usd += efectivoBsEnUsd;
        acc.efectivo_usd_en_bs += efectivoUsdEnBs;
        acc.transf += transfBs;
        acc.transf_en_usd += transfEnUsd;
        acc.tarjeta += tarjetaBs;
        acc.tarjeta_en_usd += tarjetaEnUsd;
        acc.biopago += biopagoBs;
        acc.biopago_en_usd += biopagoEnUsd;
        acc.credito += creditoUsd;
        acc.ganancia_usd += gananciaCobradaUsd;
        acc.ganancia_bs += gananciaCobradaUsd * tasaVenta;
        return acc;
      }, {
        efectivo_usd: 0, efectivo_bs: 0, efectivo_bs_en_usd: 0, efectivo_usd_en_bs: 0,
        transf: 0, transf_en_usd: 0, tarjeta: 0, tarjeta_en_usd: 0,
        biopago: 0, biopago_en_usd: 0, credito: 0,
        ganancia_usd: 0, ganancia_bs: 0,
      });

      // --- Totales que vienen de abonos a crédito recibidos hoy ---
      const calcAbonos = abonos.reduce((acc: any, a: any) => {
        const efectivoUsd = Number(a.abono_efectivo_usd || 0);
        const efectivoBs = Number(a.abono_efectivo_bs || 0);
        const transfBs = Number(a.abono_transferencia || 0);
        const tarjetaBs = Number(a.abono_tarjeta || 0);
        const biopagoBs = Number(a.abono_biopago || 0);
        const tasaAbono = Number(a.tasa_dolar || 0);
        const totalAbonoUsd = Number(a.total_abono_usd || 0);

        const venta = a.ventas;
        const gananciaVentaUsd = Number(venta?.ganancia_usd || 0);
        const totalVentaUsd = Number(venta?.total_usd || 0);

        const margenPorDolar = totalVentaUsd > 0 ? gananciaVentaUsd / totalVentaUsd : 0;
        const gananciaLiberadaUsd = margenPorDolar * totalAbonoUsd;

        acc.efectivo_usd += efectivoUsd;
        acc.efectivo_bs += efectivoBs;
        acc.efectivo_bs_en_usd += tasaAbono > 0 ? efectivoBs / tasaAbono : 0;
        acc.efectivo_usd_en_bs += efectivoUsd * tasaAbono;
        acc.transf += transfBs;
        acc.transf_en_usd += tasaAbono > 0 ? transfBs / tasaAbono : 0;
        acc.tarjeta += tarjetaBs;
        acc.tarjeta_en_usd += tasaAbono > 0 ? tarjetaBs / tasaAbono : 0;
        acc.biopago += biopagoBs;
        acc.biopago_en_usd += tasaAbono > 0 ? biopagoBs / tasaAbono : 0;
        acc.ganancia_usd += gananciaLiberadaUsd;
        acc.ganancia_bs += gananciaLiberadaUsd * tasaAbono;
        acc.abonos_usd += totalAbonoUsd;
        acc.abonos_ganancia_usd += gananciaLiberadaUsd;
        return acc;
      }, {
        efectivo_usd: 0, efectivo_bs: 0, efectivo_bs_en_usd: 0, efectivo_usd_en_bs: 0,
        transf: 0, transf_en_usd: 0, tarjeta: 0, tarjeta_en_usd: 0,
        biopago: 0, biopago_en_usd: 0,
        ganancia_usd: 0, ganancia_bs: 0,
        abonos_usd: 0, abonos_ganancia_usd: 0,
      });

      setTotales({
        efectivo_usd: calcVentas.efectivo_usd + calcAbonos.efectivo_usd,
        efectivo_bs: calcVentas.efectivo_bs + calcAbonos.efectivo_bs,
        efectivo_bs_en_usd: calcVentas.efectivo_bs_en_usd + calcAbonos.efectivo_bs_en_usd,
        efectivo_usd_en_bs: calcVentas.efectivo_usd_en_bs + calcAbonos.efectivo_usd_en_bs,
        transf: calcVentas.transf + calcAbonos.transf,
        transf_en_usd: calcVentas.transf_en_usd + calcAbonos.transf_en_usd,
        tarjeta: calcVentas.tarjeta + calcAbonos.tarjeta,
        tarjeta_en_usd: calcVentas.tarjeta_en_usd + calcAbonos.tarjeta_en_usd,
        biopago: calcVentas.biopago + calcAbonos.biopago,
        biopago_en_usd: calcVentas.biopago_en_usd + calcAbonos.biopago_en_usd,
        credito: calcVentas.credito,
        ganancia_usd: calcVentas.ganancia_usd + calcAbonos.ganancia_usd,
        ganancia_bs: calcVentas.ganancia_bs + calcAbonos.ganancia_bs,
        abonos_usd: calcAbonos.abonos_usd,
        abonos_ganancia_usd: calcAbonos.abonos_ganancia_usd,
      });
    }
    obtenerDatos();
  }, [fecha, verificandoSesion]);

  const totalEnBs = totales.efectivo_bs + totales.transf + totales.tarjeta + totales.biopago;
  const totalEnBsUsd = totales.efectivo_bs_en_usd + totales.transf_en_usd + totales.tarjeta_en_usd + totales.biopago_en_usd;
  const totalVentasUsd = totales.efectivo_usd + totalEnBsUsd;
  const totalVentasBs = totales.efectivo_usd_en_bs + totalEnBs;
  const gananciaUsd = totales.ganancia_usd;
  const gananciaBs = totales.ganancia_bs;

  const realizarCierre = async () => {
    if (!puedeCerrarCaja) {
      alert('No tienes permiso para hacer el cierre de caja');
      return;
    }
    setCargando(true);
    const res = await fetch('/api/reportes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha: fecha,
        total_ventas_usd: totalVentasUsd,
        total_ventas_bs: totalVentasBs,
        total_pendientes_usd: totales.credito,
        total_ingresos_efectivo_usd: totales.efectivo_usd,
        total_efectivo_bs: totales.efectivo_bs,
        total_transf: totales.transf,
        total_tarjeta: totales.tarjeta,
        total_biopago: totales.biopago,
        total_ganancia_usd: gananciaUsd,
        total_ganancia_bs: gananciaBs,
      }),
    });
    const { error } = await res.json();

    if (error) { alert("Error al guardar: " + error); setCargando(false); return; }

    const ticket = window.open('', '_blank', 'width=400,height=600');
    if (ticket) {
      const lineaGanancia = puedeVerGanancia
        ? `<p><strong>Ganancia Neta del Día: $${gananciaUsd.toFixed(2)} (Bs${formatearBs(gananciaBs)})</strong></p>`
        : '';
      ticket.document.write(`<html><body><h3>CIERRE: ${fecha}</h3>
        <p>Efectivo USD: $${totales.efectivo_usd.toFixed(2)}</p>
        <p>Efectivo Bs: Bs${formatearBs(totales.efectivo_bs)} (≈ $${totales.efectivo_bs_en_usd.toFixed(2)})</p>
        <p>Transf: Bs${formatearBs(totales.transf)} (≈ $${totales.transf_en_usd.toFixed(2)})</p>
        <p>Tarjeta: Bs${formatearBs(totales.tarjeta)} (≈ $${totales.tarjeta_en_usd.toFixed(2)})</p>
        <p>Biopago: Bs${formatearBs(totales.biopago)} (≈ $${totales.biopago_en_usd.toFixed(2)})</p>
        <p>Crédito generado hoy (pendiente de cobro): $${totales.credito.toFixed(2)}</p>
        <p>Abonos a crédito recibidos hoy: $${totales.abonos_usd.toFixed(2)} (incluidos arriba)</p>
        <hr/>
        <p><strong>Total en Bs: Bs${formatearBs(totalEnBs)} (≈ $${totalEnBsUsd.toFixed(2)})</strong></p>
        <p><strong>Total Ventas del día: $${totalVentasUsd.toFixed(2)} (Bs${formatearBs(totalVentasBs)})</strong></p>
        ${lineaGanancia}
        <button onclick="window.print()">Imprimir Ticket</button></body></html>`);
    }
    setCargando(false);
  };

  if (verificandoSesion) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
        Verificando sesión...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', background: '#f9fafb', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h1>Reporte Detallado</h1>
        <div>
          <button onClick={() => router.push('/dashboard')} style={{ marginRight: '12px', padding: '8px 16px' }}>Volver</button>
          {puedeCerrarCaja && (
            <button onClick={realizarCierre} disabled={cargando} style={{ padding: '8px 16px', background: '#059669', color: 'white', border: 'none', cursor: 'pointer' }}>
              {cargando ? 'Guardando...' : 'Cerrar Caja'}
            </button>
          )}
        </div>
      </div>

      {puedeFiltrar ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Ver reporte del día:</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px' }}
          />
          {fecha !== obtenerFechaLocal() && (
            <span style={{ fontSize: '13px', color: '#b45309', background: '#fffbeb', padding: '4px 10px', borderRadius: '6px', border: '1px solid #fde68a' }}>
              Estás viendo un día anterior, no el de hoy
            </span>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: '24px', fontSize: '14px', color: '#374151' }}>
          Reporte de hoy — {fecha}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <p style={{ margin: 0, fontSize: '12px' }}>Efec. USD</p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>${totales.efectivo_usd.toFixed(2)}</p>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <p style={{ margin: 0, fontSize: '12px' }}>Efec. Bs</p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Bs{formatearBs(totales.efectivo_bs)}</p>
          <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>≈ ${totales.efectivo_bs_en_usd.toFixed(2)}</p>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <p style={{ margin: 0, fontSize: '12px' }}>Transf.</p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Bs{formatearBs(totales.transf)}</p>
          <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>≈ ${totales.transf_en_usd.toFixed(2)}</p>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <p style={{ margin: 0, fontSize: '12px' }}>Tarjeta</p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Bs{formatearBs(totales.tarjeta)}</p>
          <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>≈ ${totales.tarjeta_en_usd.toFixed(2)}</p>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <p style={{ margin: 0, fontSize: '12px' }}>Biopago</p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Bs{formatearBs(totales.biopago)}</p>
          <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>≈ ${totales.biopago_en_usd.toFixed(2)}</p>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <p style={{ margin: 0, fontSize: '12px' }}>Crédito generado hoy (pendiente)</p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>${totales.credito.toFixed(2)}</p>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <p style={{ margin: 0, fontSize: '12px' }}>Abonos a crédito recibidos hoy</p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>${totales.abonos_usd.toFixed(2)}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#ecfdf5', padding: '16px', borderRadius: '8px', border: '2px solid #a7f3d0' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#065f46' }}>Total en Bs (efec.Bs + Transf. + Tarjeta + Biopago)</p>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#059669' }}>Bs{formatearBs(totalEnBs)}</p>
          <p style={{ margin: 0, fontSize: '12px', color: '#065f46' }}>≈ ${totalEnBsUsd.toFixed(2)}</p>
        </div>
        <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '8px', border: '2px solid #bfdbfe' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#1e3a8a' }}>Total Ventas del día (incluye ventas nuevas + abonos)</p>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#2563eb' }}>${totalVentasUsd.toFixed(2)}</p>
          <p style={{ margin: 0, fontSize: '12px', color: '#1e3a8a' }}>Bs{formatearBs(totalVentasBs)}</p>
        </div>
        {puedeVerGanancia && (
          <div style={{ background: '#fdf4ff', padding: '16px', borderRadius: '8px', border: '2px solid #e9d5ff' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b21a8' }}>Ganancia Neta del Día</p>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#9333ea' }}>${gananciaUsd.toFixed(2)}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b21a8' }}>Bs{formatearBs(gananciaBs)}</p>
            {totales.abonos_ganancia_usd > 0 && (
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9333ea' }}>
                (de esa ganancia, ${totales.abonos_ganancia_usd.toFixed(2)} vienen de abonos)
              </p>
            )}
          </div>
        )}
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '24px' }}>
        <h2>Transacciones (ventas del día)</h2>
        <table style={{ width: '100%', textAlign: 'left' }}>
          <thead><tr><th>Hora</th><th>Total USD</th><th>Método</th></tr></thead>
          <tbody>{listaVentas.map((v, i) => (
            <tr key={i} style={{ borderTop: '1px solid #eee' }}>
              <td style={{ padding: '10px 0' }}>{new Date(v.created_at).toLocaleTimeString()}</td>
              <td>${Number(v.total_usd).toFixed(2)}</td>
              <td>{v.pago_credito_usd > 0 ? 'Crédito' : v.pago_biopago > 0 ? 'Biopago' : v.pago_tarjeta > 0 ? 'Tarjeta' : v.pago_transferencia > 0 ? 'Transf' : 'Efectivo'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {listaAbonos.length > 0 && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h2>Abonos a crédito recibidos hoy</h2>
          <table style={{ width: '100%', textAlign: 'left' }}>
            <thead><tr><th>Hora</th><th>Monto USD</th></tr></thead>
            <tbody>{listaAbonos.map((a, i) => (
              <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '10px 0' }}>{new Date(a.created_at).toLocaleTimeString()}</td>
                <td>${Number(a.total_abono_usd).toFixed(2)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
