'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';

// Mismo orden de tablas que usa el endpoint /api/respaldo. Se usa para saber
// qué hoja de Excel corresponde a qué tabla al importar/exportar.
const TABLAS = [
  'clientes',
  'productos',
  'ventas',
  'venta_items',
  'creditos_abonos',
  'tasas_diarias',
  'historial_cierres',
  'reportes_diarios',
  'configuracion_ticket',
];

type Formato = 'json' | 'excel';

export default function RespaldoPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [formato, setFormato] = useState<Formato>('json');
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error' | 'warn'; texto: string } | null>(null);

  function descargarArchivo(blob: Blob, nombre: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function exportarRespaldo() {
    setExportando(true);
    setMensaje(null);
    try {
      const res = await fetch('/api/respaldo');
      const data = await res.json();

      if (!res.ok || data.error) {
        setMensaje({ tipo: 'error', texto: data.error || 'No se pudo exportar el respaldo.' });
        setExportando(false);
        return;
      }

      const fecha = new Date().toISOString().slice(0, 10);

      if (formato === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        descargarArchivo(blob, `respaldo-duragonz-${fecha}.json`);
      } else {
        // Excel: una hoja por tabla, con el nombre exacto de la tabla
        const libro = XLSX.utils.book_new();
        for (const tabla of TABLAS) {
          const filas = data.tablas?.[tabla] || [];
          const hoja = XLSX.utils.json_to_sheet(filas.length > 0 ? filas : [{}]);
          XLSX.utils.book_append_sheet(libro, hoja, tabla.slice(0, 31));
        }
        const buffer = XLSX.write(libro, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        descargarArchivo(blob, `respaldo-duragonz-${fecha}.xlsx`);
      }

      setMensaje({ tipo: 'ok', texto: 'Respaldo descargado correctamente.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'No se pudo exportar el respaldo.' });
    }
    setExportando(false);
  }

  function elegirArchivo() {
    inputRef.current?.click();
  }

  async function archivoSeleccionado(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo después
    if (!archivo) return;

    const confirmar = confirm(
      '¿Importar este respaldo?\n\nEsto va a BORRAR todos los datos actuales (ventas, clientes, productos, créditos, etc.) y los va a reemplazar por los del archivo. Esta acción no se puede deshacer.'
    );
    if (!confirmar) return;

    setImportando(true);
    setMensaje(null);

    try {
      const esExcel = archivo.name.toLowerCase().endsWith('.xlsx') || archivo.name.toLowerCase().endsWith('.xls');
      let tablas: Record<string, any[]> = {};

      if (esExcel) {
        const buffer = await archivo.arrayBuffer();
        const libro = XLSX.read(buffer, { type: 'array' });
        for (const tabla of TABLAS) {
          const nombreHoja = tabla.slice(0, 31);
          const hoja = libro.Sheets[nombreHoja];
          if (hoja) {
            const filas = XLSX.utils.sheet_to_json(hoja, { defval: null });
            // Quita filas completamente vacías que a veces deja Excel al final
            tablas[tabla] = (filas as any[]).filter((f) => Object.values(f).some((v) => v !== null && v !== ''));
          } else {
            tablas[tabla] = [];
          }
        }
      } else {
        const texto = await archivo.text();
        let json: any;
        try {
          json = JSON.parse(texto);
        } catch {
          setMensaje({ tipo: 'error', texto: 'El archivo no es un JSON válido.' });
          setImportando(false);
          return;
        }
        tablas = json.tablas || {};
      }

      const res = await fetch('/api/respaldo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 1, tablas }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setMensaje({ tipo: 'error', texto: data.error || 'No se pudo importar el respaldo.' });
      } else if (data.advertencia) {
        setMensaje({ tipo: 'warn', texto: data.advertencia });
      } else {
        setMensaje({ tipo: 'ok', texto: 'Respaldo importado correctamente. Se reemplazaron todos los datos.' });
      }
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'No se pudo importar el respaldo.' });
    }
    setImportando(false);
  }

  const btnVolver = { backgroundColor: '#f9fafb', color: '#374151', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, border: '1px solid #e5e7eb', cursor: 'pointer' };
  const btnPrimario = { backgroundColor: '#111827', color: 'white', padding: '12px 22px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '14px' };
  const btnPeligro = { backgroundColor: '#fff', color: '#dc2626', padding: '12px 22px', borderRadius: '8px', fontWeight: 'bold', border: '1.5px solid #fecaca', cursor: 'pointer', fontSize: '14px' };
  const card = { backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };

  return (
    <div style={{ padding: '32px', fontFamily: 'sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Respaldo de la Base de Datos</h1>
        <button style={btnVolver} onClick={() => router.push('/configuracion')}>← Volver a Configuración</button>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
        <span style={{ color: '#6b7280', fontWeight: 600 }}>Formato:</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input type="radio" checked={formato === 'json'} onChange={() => setFormato('json')} />
          JSON (recomendado)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input type="radio" checked={formato === 'excel'} onChange={() => setFormato('excel')} />
          Excel (.xlsx)
        </label>
      </div>

      {mensaje && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '14px',
            backgroundColor: mensaje.tipo === 'ok' ? '#ecfdf5' : mensaje.tipo === 'warn' ? '#fffbeb' : '#fef2f2',
            border: `1px solid ${mensaje.tipo === 'ok' ? '#a7f3d0' : mensaje.tipo === 'warn' ? '#fde68a' : '#fecaca'}`,
            color: mensaje.tipo === 'ok' ? '#065f46' : mensaje.tipo === 'warn' ? '#92400e' : '#b91c1c',
          }}
        >
          {mensaje.texto}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '900px' }}>
        <div style={card}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '8px' }}>📤 Exportar Respaldo</h3>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '18px' }}>
            Descarga un archivo con todos los datos del sistema: clientes, productos, ventas, créditos, tasas del dólar,
            cierres de caja y configuración del ticket, en el formato que elijas arriba.
          </p>
          <button style={btnPrimario} onClick={exportarRespaldo} disabled={exportando}>
            {exportando ? 'Exportando...' : `Descargar Respaldo (.${formato === 'json' ? 'json' : 'xlsx'})`}
          </button>
        </div>

        <div style={card}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '8px' }}>📥 Importar Respaldo</h3>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '18px' }}>
            Acepta archivos <strong>.json</strong> o <strong>.xlsx</strong> (detecta el formato automáticamente).{' '}
            <strong>Esto reemplaza todos los datos actuales</strong> del sistema por los del archivo — úsalo con cuidado.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json,.xlsx,.xls"
            onChange={archivoSeleccionado}
            style={{ display: 'none' }}
          />
          <button style={btnPeligro} onClick={elegirArchivo} disabled={importando}>
            {importando ? 'Importando...' : 'Elegir Archivo e Importar'}
          </button>
        </div>
      </div>

      <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '18px', maxWidth: '900px' }}>
        Nota: el formato Excel es útil para revisar o editar los datos a mano en hojas de cálculo, pero puede perder
        precisión en algunos valores (por ejemplo, casillas vacías). Para respaldos de seguridad exactos, se recomienda
        usar JSON.
      </p>
    </div>
  );
}
