'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  LayoutDashboard,
  Store,
  Type as TypeIcon,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Printer,
} from 'lucide-react';

interface TicketConfig {
  id?: string;
  nombre_negocio: string;
  rif_cedula: string;
  direccion: string;
  incluir_telefono: boolean;
  telefono: string;
  tamano_letra: number;
  tipo_letra: string;
  espaciado: number;
  ancho_papel: number;
}

const CONFIG_DEFAULT: TicketConfig = {
  nombre_negocio: '',
  rif_cedula: '',
  direccion: '',
  incluir_telefono: false,
  telefono: '',
  tamano_letra: 10,
  tipo_letra: 'Courier New',
  espaciado: 1,
  ancho_papel: 58,
};

const TIPOS_LETRA = ['Courier New', 'Consolas', 'monospace', 'Arial', 'Verdana'];

const ANCHOS_PAPEL = [
  { valor: 58, label: '58mm', caracteres: 32, previewPx: 190 },
  { valor: 60, label: '60mm', caracteres: 34, previewPx: 200 },
  { valor: 80, label: '80mm', caracteres: 48, previewPx: 270 },
];

function obtenerAncho(valor: number) {
  return ANCHOS_PAPEL.find((a) => a.valor === valor) ?? ANCHOS_PAPEL[0];
}

function formatearLineaProducto(nombre: string, cant: string, precio: string, columnas: number): string {
  const derecha = `${cant} ${precio}`;
  const espacio = Math.max(columnas - nombre.length - derecha.length, 1);
  return nombre + ' '.repeat(espacio) + derecha;
}

// Productos ficticios usados únicamente para la impresión de prueba,
// los mismos que ya se ven en la vista previa (Pan y Café).
const PRODUCTOS_PRUEBA = [
  { nombre: 'Pan', cantidad: 2, precio: 1.5 },
  { nombre: 'Café', cantidad: 1, precio: 0.8 },
]

export default function ConfiguracionTicket() {
  const router = useRouter();
  const [config, setConfig] = useState<TicketConfig>(CONFIG_DEFAULT);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewAbierto, setPreviewAbierto] = useState(false);

  useEffect(() => {
    async function cargarConfig() {
      try {
        const res = await fetch('/api/configuracion-ticket');
        const { data, error } = await res.json();
        if (error) {
          setError('No se pudo cargar la configuración. ' + error);
        } else if (data) {
          setConfig({ ...CONFIG_DEFAULT, ...data });
        }
        // Si no hay ninguna fila todavía, simplemente se queda con CONFIG_DEFAULT
        // (sin id) y se crea automáticamente la primera vez que se guarde.
      } catch (err) {
        setError('No se pudo cargar la configuración.');
      }
      setCargando(false);
    }
    cargarConfig();
  }, []);

  function actualizar<K extends keyof TicketConfig>(campo: K, valor: TicketConfig[K]) {
    setConfig((prev) => ({ ...prev, [campo]: valor }));
    setGuardado(false);
  }

  async function guardarConfiguracion() {
    setGuardando(true);
    setError(null);

    const payload = {
      id: config.id,
      nombre_negocio: config.nombre_negocio,
      rif_cedula: config.rif_cedula,
      direccion: config.direccion,
      incluir_telefono: config.incluir_telefono,
      telefono: config.telefono,
      tamano_letra: config.tamano_letra,
      tipo_letra: config.tipo_letra,
      espaciado: config.espaciado,
      ancho_papel: config.ancho_papel,
    };

    try {
      const res = await fetch('/api/configuracion-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const { data, error } = await res.json();

      setGuardando(false);
      if (error) {
        setError('No se pudo guardar. ' + error);
        return;
      }
      if (data) {
        setConfig((prev) => ({ ...prev, id: data.id }));
      }
    } catch (err) {
      setGuardando(false);
      setError('No se pudo guardar la configuración.');
      return;
    }

    setGuardado(true);
    setTimeout(() => setGuardado(false), 2200);
  }

  // Imprime un ticket de ejemplo usando la configuración ACTUAL del formulario
  // (aunque todavía no se haya guardado), con productos ficticios, para que
  // el usuario vea cómo va a quedar el ticket real antes de confirmar.
  function imprimirPrueba() {
    const padCelda = 2 + (config.espaciado * 2)
    const totalPrueba = PRODUCTOS_PRUEBA.reduce((s, p) => s + p.cantidad * p.precio, 0)

    const filasItems = PRODUCTOS_PRUEBA.map(item => `
      <tr>
        <td style="text-align:left;padding:2px ${padCelda}px 2px 0;word-break:break-word;">${item.nombre}</td>
        <td style="text-align:center;padding:2px ${padCelda}px;">${item.cantidad}</td>
        <td style="text-align:right;padding:2px ${padCelda}px;">${item.precio.toFixed(2)}</td>
        <td style="text-align:right;padding:2px 0;">${(item.precio * item.cantidad).toFixed(2)}</td>
      </tr>
    `).join('')

    const ahora = new Date()
    const fechaStr = ahora.toLocaleDateString('es-VE')
    const horaStr = ahora.toLocaleTimeString('es-VE')

    const html = `
      <html>
      <head>
        <title>Ticket de Prueba</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: '${config.tipo_letra}', monospace; width: ${config.ancho_papel}mm; margin: 0 auto; padding: 8px; font-size: ${config.tamano_letra}px; color:#000; }
          h2 { text-align:center; margin: 4px 0; font-size: ${config.tamano_letra + 4}px; }
          .linea { border-top: 1px dashed #000; margin: 6px 0; }
          table { width:100%; border-collapse: collapse; table-layout: fixed; }
          col.col-producto { width: 46%; }
          col.col-cant { width: 16%; }
          col.col-pu { width: 19%; }
          col.col-subt { width: 19%; }
          .center { text-align:center; }
          .right { text-align:right; }
          .total { font-weight:bold; font-size: ${config.tamano_letra + 2}px; }
          .banner-prueba { text-align:center;border:2px dashed #4338ca;color:#4338ca;font-weight:bold;padding:5px;margin:8px 0;font-size:${config.tamano_letra}px; }
          @media print {
            body { width: ${config.ancho_papel}mm; }
          }
        </style>
      </head>
      <body>
        <h2>${config.nombre_negocio || 'Nombre del Negocio'}</h2>
        <div class="center">RIF: ${config.rif_cedula || 'RIF/Cédula'}</div>
        <div class="center">${config.direccion || 'Dirección'}</div>
        ${config.incluir_telefono ? `<div class="center">Tel: ${config.telefono || 'Teléfono'}</div>` : ''}
        <div class="center">${fechaStr} ${horaStr}</div>
        <div class="banner-prueba">*** TICKET DE PRUEBA ***</div>
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
        <div class="right total">TOTAL $ ${totalPrueba.toFixed(2)}</div>
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

  if (cargando) {
    return (
      <div className="dz-carga">
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        Cargando configuración…
      </div>
    );
  }

  const anchoActual = obtenerAncho(config.ancho_papel);

  const Recibo = (
    <div className="dz-recibo" style={{ width: `${anchoActual.previewPx}px` }}>
      <div
        style={{
          color: '#1f2937',
          lineHeight: 1.55,
          fontFamily: config.tipo_letra,
          fontSize: `${config.tamano_letra}px`,
          whiteSpace: 'pre-wrap',
        }}
      >
        <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{config.nombre_negocio || 'Nombre del Negocio'}</div>
        <div style={{ textAlign: 'center' }}>{config.rif_cedula || 'RIF/Cédula'}</div>
        <div style={{ textAlign: 'center' }}>{config.direccion || 'Dirección'}</div>
        {config.incluir_telefono && <div style={{ textAlign: 'center' }}>{config.telefono || 'Teléfono'}</div>}
        <div className="dz-linea-punteada" />
        <div>{formatearLineaProducto('Producto', 'Cant', 'Precio', anchoActual.caracteres)}</div>
        <div>{formatearLineaProducto('Pan', '2', '1.50', anchoActual.caracteres)}</div>
        <div>{formatearLineaProducto('Café', '1', '0.80', anchoActual.caracteres)}</div>
        <div className="dz-linea-punteada" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
          <span>TOTAL</span>
          <span>2.30</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="dz-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes dzAparecer { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dzFadeIn { from { opacity: 0; } to { opacity: 1; } }

        html, body { height: 100%; }

        .dz-carga {
          height: 100dvh; display: flex; align-items: center; justify-content: center;
          gap: 8px; color: #98a2b3; font-size: 16px; font-family: 'Inter', sans-serif; background: #f5f6f8;
        }

        .dz-page {
          height: 100dvh;
          overflow: hidden;
          background: #f5f6f8;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          padding: clamp(8px, 1.8vw, 18px);
          display: flex;
          flex-direction: column;
        }
        .dz-wrapper {
          max-width: 1220px;
          margin: 0 auto;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .dz-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: clamp(6px, 1.2vh, 12px);
          flex-shrink: 0;
        }
        .dz-eyebrow {
          font-size: 15px; font-weight: 700; color: #4338ca; letter-spacing: 0.08em;
          text-transform: uppercase; margin: 0; font-family: 'Inter', sans-serif;
        }
        .dz-titulo {
          font-size: clamp(22px, 3vw, 29px); font-weight: 800; color: #101828;
          margin: 2px 0 0; letter-spacing: -0.02em; font-family: 'Manrope', sans-serif;
        }
        .dz-header-actions { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
        .dz-btn-header {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 13px; font-size: 16px; font-weight: 600; color: #475467;
          background: white; border: 1px solid #e4e7ec; border-radius: 9999px; cursor: pointer;
          transition: all 0.15s ease; white-space: nowrap;
        }
        .dz-btn-header:hover { border-color: #c7d2fe; color: #4338ca; }
        .dz-btn-header span.dz-solo-desktop { display: none; }
        @media (min-width: 700px) { .dz-btn-header span.dz-solo-desktop { display: inline; } }

        .dz-btn-prueba {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 13px; font-size: 16px; font-weight: 700; color: #4338ca;
          background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 9999px; cursor: pointer;
          transition: all 0.15s ease; white-space: nowrap;
        }
        .dz-btn-prueba:hover { background: #e0e7ff; }

        .dz-error {
          display: flex; align-items: flex-start; gap: 8px;
          margin-bottom: 8px; padding: 8px 12px; background: #fef2f2;
          border: 1px solid #fecaca; color: #b91c1c; border-radius: 10px; font-size: 16px; flex-shrink: 0;
        }

        .dz-main {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: 1fr 230px;
          gap: clamp(8px, 1.4vw, 16px);
        }

        .dz-form-col {
          display: flex;
          flex-direction: column;
          gap: clamp(6px, 1.2vh, 10px);
          min-height: 0;
        }
        .dz-cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: clamp(8px, 1.2vw, 12px);
        }

        .dz-card {
          background: white; border: 1px solid #e4e7ec; border-radius: 14px;
          padding: clamp(10px, 1.4vw, 14px);
          box-shadow: 0 1px 2px rgba(16,24,40,0.04);
        }
        .dz-card-header { display: flex; align-items: center; gap: 9px; margin-bottom: 8px; }
        .dz-icon { padding: 7px; background: #eef2ff; color: #4338ca; border-radius: 8px; display: flex; flex-shrink: 0; }
        .dz-card-titulo { font-size: 18px; font-weight: 700; color: #101828; margin: 0; font-family: 'Manrope', sans-serif; }

        .dz-campo { margin-bottom: 8px; }
        .dz-campo:last-child { margin-bottom: 0; }
        .dz-fila { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 8px; }
        .dz-label {
          display: block; font-size: 15px; font-weight: 600; color: #667085; margin-bottom: 4px;
        }
        .dz-input {
          width: 100%; padding: 8px 11px; font-size: 17px; border: 1px solid #e4e7ec;
          border-radius: 8px; outline: none; color: #101828; background: white;
          transition: border-color 0.15s, box-shadow 0.15s; font-family: inherit;
        }
        .dz-input:focus {
          border-color: #4338ca; box-shadow: 0 0 0 3px rgba(67,56,202,0.12);
        }
        .dz-input:focus-visible { outline: none; }

        .dz-check-fila { display: flex; align-items: center; gap: 10px; margin-top: 7px; flex-wrap: wrap; }
        .dz-check-label { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 16px; color: #4b5563; }

        .dz-slider-fila { display: flex; justify-content: space-between; font-size: 15px; font-weight: 600; color: #667085; margin-bottom: 4px; }
        .dz-slider-valor { color: #101828; font-weight: 700; font-family: 'JetBrains Mono', monospace; }

        .dz-ancho-fila { display: flex; gap: 6px; }
        .dz-btn-ancho {
          flex: 1; padding: 8px 0; font-size: 16px; font-weight: 700; color: #475467;
          background: #f9fafb; border: 1px solid #e4e7ec; border-radius: 8px; cursor: pointer;
          font-family: 'JetBrains Mono', monospace; transition: all 0.15s ease;
        }
        .dz-btn-ancho:hover { border-color: #c7d2fe; }
        .dz-btn-ancho.activo {
          background: #4338ca; border-color: #4338ca; color: white; box-shadow: 0 3px 8px rgba(67,56,202,0.28);
        }
        .dz-nota { font-size: 13.5px; color: #98a2b3; margin: 6px 0 0; }

        .dz-footer {
          display: flex; align-items: center; gap: 10px; flex-shrink: 0; flex-wrap: wrap;
          margin-top: clamp(6px, 1.2vh, 10px);
        }
        .dz-btn-guardar {
          display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px;
          font-size: 17px; font-weight: 700; color: white;
          background: linear-gradient(135deg, #4f46e5, #4338ca); border: none;
          border-radius: 10px; cursor: pointer; box-shadow: 0 4px 12px rgba(67,56,202,0.26);
          transition: all 0.15s ease;
        }
        .dz-btn-guardar:hover:not(:disabled) { box-shadow: 0 6px 16px rgba(67,56,202,0.32); transform: translateY(-1px); }
        .dz-btn-guardar:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: none; }
        .dz-btn-guardar-prueba {
          display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px;
          font-size: 17px; font-weight: 700; color: #4338ca;
          background: white; border: 1.5px solid #c7d2fe;
          border-radius: 10px; cursor: pointer;
          transition: all 0.15s ease;
        }
        .dz-btn-guardar-prueba:hover { background: #eef2ff; border-color: #a5b4fc; }
        .dz-mensaje-guardado { display: inline-flex; align-items: center; gap: 6px; font-size: 16px; color: #059669; font-weight: 700; animation: dzAparecer 0.2s ease; }

        /* --- Vista previa --- */
        .dz-preview-label {
          font-size: 15px; font-weight: 700; color: #98a2b3; text-transform: uppercase;
          letter-spacing: 0.06em; margin: 0 0 8px; font-family: 'JetBrains Mono', monospace;
        }
        .dz-recibo {
          position: relative;
          background: #fffdf6; border: 1px solid #ece7d9; border-radius: 3px 3px 0 0;
          padding: 14px 12px 12px; box-shadow: 0 10px 22px rgba(16,24,40,0.10), 0 2px 6px rgba(16,24,40,0.06);
          transform: rotate(-0.4deg);
          transition: width 0.3s cubic-bezier(0.4,0,0.2,1);
          margin: 0 auto;
        }
        .dz-recibo::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: -8px; height: 8px;
          background-image: linear-gradient(-45deg, #f5f6f8 6px, transparent 0), linear-gradient(45deg, #f5f6f8 6px, transparent 0);
          background-size: 12px 12px; background-position: left bottom; background-repeat: repeat-x;
        }
        .dz-linea-punteada { margin: 5px 0; border-top: 1px dashed #c9c2ac; }
        .dz-preview-nota { font-size: 14px; color: #98a2b3; margin-top: 12px; text-align: center; }

        .dz-preview-modal {
          position: fixed; inset: 0; background: rgba(16,24,40,0.45);
          display: none; align-items: center; justify-content: center; z-index: 50;
          padding: 20px; animation: dzFadeIn 0.15s ease;
        }
        .dz-preview-modal.abierto { display: flex; }
        .dz-preview-inner {
          display: flex; flex-direction: column; align-items: center;
          max-height: 90dvh; overflow-y: auto; padding: 4px;
        }
        .dz-preview-modal-header {
          display: flex; align-items: center; justify-content: space-between; width: 100%;
          margin-bottom: 10px;
        }
        .dz-preview-close {
          background: white; border: 1px solid #e4e7ec; border-radius: 9999px;
          width: 32px; height: 32px; align-items: center; justify-content: center;
          cursor: pointer; color: #475467; display: flex;
        }
        @media (min-width: 900px) {
          .dz-preview-close { display: none; }
        }

        .dz-preview-fab {
          position: fixed; bottom: 16px; right: 16px; z-index: 40;
          display: inline-flex; align-items: center; gap: 7px;
          padding: 13px 20px; font-size: 16px; font-weight: 700; color: white;
          background: linear-gradient(135deg, #4f46e5, #4338ca); border: none;
          border-radius: 9999px; cursor: pointer; box-shadow: 0 6px 18px rgba(67,56,202,0.35);
        }

        /* --- Breakpoints --- */
        @media (max-width: 899px) {
          .dz-main { grid-template-columns: 1fr; }
          .dz-preview-modal { position: fixed !important; }
          .dz-preview-modal-header { display: flex; }
        }
        @media (min-width: 900px) {
          .dz-preview-modal {
            position: static !important; background: none !important; display: flex !important;
            padding: 0; z-index: auto; align-items: flex-start; justify-content: flex-start;
            animation: none;
          }
          .dz-preview-inner { max-height: none; overflow: visible; align-items: stretch; }
          .dz-preview-fab { display: none; }
        }
        @media (max-width: 560px) {
          .dz-cards-grid { grid-template-columns: 1fr; }
          .dz-fila { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="dz-wrapper">
        <div className="dz-header">
          <div>
            <p className="dz-eyebrow">Configuración</p>
            <h1 className="dz-titulo">Personalizar Ticket de Venta</h1>
          </div>
          <div className="dz-header-actions">
            <button onClick={imprimirPrueba} className="dz-btn-prueba">
              <Printer size={15} />
              <span className="dz-solo-desktop">Imprimir Prueba</span>
            </button>
            <button onClick={() => router.push('/configuracion')} className="dz-btn-header">
              <ArrowLeft size={15} />
              <span className="dz-solo-desktop">Configuración</span>
            </button>
            <button onClick={() => router.push('/dashboard')} className="dz-btn-header">
              <LayoutDashboard size={15} />
              <span className="dz-solo-desktop">Dashboard</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="dz-error">
            <AlertCircle size={15} style={{ marginTop: '1px', flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div className="dz-main">
          <div className="dz-form-col">
            <div className="dz-cards-grid">
              {/* Card: Datos del negocio */}
              <section className="dz-card">
                <div className="dz-card-header">
                  <div className="dz-icon"><Store size={16} /></div>
                  <h2 className="dz-card-titulo">Datos del negocio</h2>
                </div>

                <div className="dz-campo">
                  <label className="dz-label">Nombre del negocio</label>
                  <input
                    type="text"
                    className="dz-input"
                    value={config.nombre_negocio}
                    onChange={(e) => actualizar('nombre_negocio', e.target.value)}
                    placeholder="Ej: Panadería La Espiga"
                  />
                </div>

                <div className="dz-campo dz-fila">
                  <div>
                    <label className="dz-label">RIF/Cédula</label>
                    <input
                      type="text"
                      className="dz-input"
                      value={config.rif_cedula}
                      onChange={(e) => actualizar('rif_cedula', e.target.value)}
                      placeholder="J-12345678-9"
                    />
                  </div>
                  <div>
                    <label className="dz-label">Dirección</label>
                    <input
                      type="text"
                      className="dz-input"
                      value={config.direccion}
                      onChange={(e) => actualizar('direccion', e.target.value)}
                      placeholder="Av. Principal"
                    />
                  </div>
                </div>

                <div className="dz-check-fila">
                  <label className="dz-check-label">
                    <input
                      type="checkbox"
                      checked={config.incluir_telefono}
                      onChange={(e) => actualizar('incluir_telefono', e.target.checked)}
                      style={{ width: '17px', height: '17px', accentColor: '#4338ca' }}
                    />
                    Incluir teléfono
                  </label>

                  {config.incluir_telefono && (
                    <input
                      type="text"
                      className="dz-input"
                      value={config.telefono}
                      onChange={(e) => actualizar('telefono', e.target.value)}
                      placeholder="0414-1234567"
                      style={{ maxWidth: '150px', padding: '7px 9px', fontSize: '13.5px' }}
                    />
                  )}
                </div>
              </section>

              {/* Card: Formato del ticket */}
              <section className="dz-card">
                <div className="dz-card-header">
                  <div className="dz-icon"><TypeIcon size={16} /></div>
                  <h2 className="dz-card-titulo">Formato del ticket</h2>
                </div>

                <div className="dz-campo">
                  <label className="dz-label">Tipo de letra</label>
                  <select
                    value={config.tipo_letra}
                    onChange={(e) => actualizar('tipo_letra', e.target.value)}
                    className="dz-input"
                    style={{ cursor: 'pointer' }}
                  >
                    {TIPOS_LETRA.map((tipo) => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>

                <div className="dz-campo dz-fila">
                  <div>
                    <div className="dz-slider-fila">
                      <span>Letra</span>
                      <span className="dz-slider-valor">{config.tamano_letra}px</span>
                    </div>
                    <input
                      type="range" min={8} max={16}
                      value={config.tamano_letra}
                      onChange={(e) => actualizar('tamano_letra', Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#4338ca', height: '20px' }}
                    />
                  </div>
                  <div>
                    <div className="dz-slider-fila">
                      <span>Espacio</span>
                      <span className="dz-slider-valor">{config.espaciado}</span>
                    </div>
                    <input
                      type="range" min={1} max={6}
                      value={config.espaciado}
                      onChange={(e) => actualizar('espaciado', Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#4338ca', height: '20px' }}
                    />
                  </div>
                </div>

                <div className="dz-campo">
                  <label className="dz-label">Ancho de papel</label>
                  <div className="dz-ancho-fila">
                    {ANCHOS_PAPEL.map((a) => (
                      <button
                        key={a.valor}
                        type="button"
                        onClick={() => actualizar('ancho_papel', a.valor)}
                        className={`dz-btn-ancho ${config.ancho_papel === a.valor ? 'activo' : ''}`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                  <p className="dz-nota">~{anchoActual.caracteres} caracteres por línea</p>
                </div>
              </section>
            </div>

            <div className="dz-footer">
              <button onClick={guardarConfiguracion} disabled={guardando} className="dz-btn-guardar">
                {guardando ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                {guardando ? 'Guardando…' : 'Guardar configuración'}
              </button>
              <button onClick={imprimirPrueba} className="dz-btn-guardar-prueba">
                <Printer size={16} />
                Imprimir Prueba
              </button>
              {guardado && (
                <span className="dz-mensaje-guardado">
                  <CheckCircle2 size={16} /> Guardado
                </span>
              )}
            </div>
          </div>

          {/* Vista previa: sidebar en desktop, modal en móvil/tablet */}
          <div className={`dz-preview-modal ${previewAbierto ? 'abierto' : ''}`} onClick={() => setPreviewAbierto(false)}>
            <div className="dz-preview-inner" onClick={(e) => e.stopPropagation()}>
              <div className="dz-preview-modal-header">
                <p className="dz-preview-label" style={{ margin: 0 }}>Vista previa · {anchoActual.label}</p>
                <button className="dz-preview-close" onClick={() => setPreviewAbierto(false)}>
                  <X size={16} />
                </button>
              </div>
              {Recibo}
              <p className="dz-preview-nota">Se actualiza mientras escribes.</p>
            </div>
          </div>
        </div>
      </div>

      <button className="dz-preview-fab" onClick={() => setPreviewAbierto(true)}>
        <Eye size={16} /> Vista previa
      </button>
    </div>
  );
}
