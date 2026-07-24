'use client';
import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface Props {
  onDetectado: (codigo: string) => void;
  onCerrar: () => void;
}

export default function EscanerCamara({ onDetectado, onCerrar }: Props) {
  const contenedorId = 'lector-camara-duragonz';
  const escanerRef = useRef<Html5Qrcode | null>(null);
  const yaDetectoRef = useRef(false);

  useEffect(() => {
    yaDetectoRef.current = false;
    const escaner = new Html5Qrcode(contenedorId);
    escanerRef.current = escaner;

    escaner
      .start(
        { facingMode: 'environment' }, // cámara trasera
        {
          fps: 10,
          qrbox: { width: 260, height: 140 },
        },
        (codigoDetectado) => {
          if (yaDetectoRef.current) return;
          yaDetectoRef.current = true;
          onDetectado(codigoDetectado);
        },
        () => {
          // errores de "no encontrado en este frame" son normales, se ignoran
        }
      )
      .catch(() => {
        alert('No se pudo acceder a la cámara. Verifica que le diste permiso de cámara a este sitio.');
        onCerrar();
      });

    return () => {
      escanerRef.current
        ?.stop()
        .then(() => escanerRef.current?.clear())
        .catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        zIndex: 3000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#111',
          borderRadius: '14px',
          overflow: 'hidden',
          border: '2px solid #333',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            color: 'white',
            fontWeight: 700,
          }}
        >
          <span>📷 Escanear código</span>
          <button
            onClick={onCerrar}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
        <div id={contenedorId} style={{ width: '100%' }} />
        <p style={{ color: '#9ca3af', textAlign: 'center', fontSize: '13px', padding: '10px 16px' }}>
          Apunta la cámara al código de barras
        </p>
      </div>
    </div>
  );
}
