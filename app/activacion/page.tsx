'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const dorado = '#d4af37';

export default function Activacion() {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [nombreDispositivo, setNombreDispositivo] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [avisoMantenimiento, setAvisoMantenimiento] = useState(false);
  const [focusCodigo, setFocusCodigo] = useState(false);
  const [focusNombre, setFocusNombre] = useState(false);

  // Cada dispositivo necesita un identificador único y permanente.
  // Se genera una sola vez y se guarda en este navegador/dispositivo
  // para siempre — así el servidor de licencias sabe distinguir
  // "el mismo dispositivo de nuevo" de "un dispositivo nuevo".
  const obtenerOCrearUuidDispositivo = (): string => {
    let uuid = localStorage.getItem('dispositivo_uuid');
    if (!uuid) {
      uuid = crypto.randomUUID();
      localStorage.setItem('dispositivo_uuid', uuid);
    }
    return uuid;
  };

  // Si este dispositivo ya fue activado antes, no tiene sentido pedirle
  // el código de nuevo — lo mandamos directo al login.
  useEffect(() => {
    const yaActivado = localStorage.getItem('duragonz_licencia');
    if (yaActivado) {
      router.push('/login');
    }
  }, [router]);

  const activar = async () => {
    if (!codigo.trim()) {
      alert('Escribe el código de licencia');
      return;
    }

    setVerificando(true);

    try {
      const dispositivo_uuid = obtenerOCrearUuidDispositivo();

      const res = await fetch('/api/licencia/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: codigo.trim(),
          dispositivo_uuid,
          nombre_dispositivo: nombreDispositivo.trim() || 'Sin nombre',
        }),
      });
      const data = await res.json();

      setVerificando(false);

      if (!data.valido) {
        alert(data.error || 'No se pudo activar la licencia');
        return;
      }

      // Guardamos localmente que este dispositivo ya está activado,
      // junto con el código (lo necesitaremos para revalidar más adelante).
      localStorage.setItem('duragonz_licencia', JSON.stringify({
        codigo: codigo.trim(),
        activadoEn: new Date().toISOString(),
      }));

      if (data.avisoMantenimiento) {
        setAvisoMantenimiento(true);
      } else {
        router.push('/login');
      }
    } catch (err) {
      setVerificando(false);
      alert('Error al activar. Verifica tu conexión a internet e intenta de nuevo.');
    }
  };

  const manejarEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') activar();
  };

  const fondo = {
    minHeight: '100vh',
    backgroundColor: '#0a0806',
    backgroundImage: `
      radial-gradient(circle at 8% 15%, rgba(212,175,55,0.35) 0%, transparent 3%),
      radial-gradient(circle at 22% 8%, rgba(212,175,55,0.25) 0%, transparent 4%),
      radial-gradient(circle at 88% 12%, rgba(212,175,55,0.3) 0%, transparent 3%),
      radial-gradient(circle at 92% 30%, rgba(212,175,55,0.2) 0%, transparent 5%),
      radial-gradient(circle at 5% 60%, rgba(212,175,55,0.25) 0%, transparent 4%),
      radial-gradient(circle at 15% 85%, rgba(212,175,55,0.3) 0%, transparent 3%),
      radial-gradient(circle at 85% 80%, rgba(212,175,55,0.25) 0%, transparent 4%),
      radial-gradient(circle at 95% 95%, rgba(212,175,55,0.2) 0%, transparent 5%),
      radial-gradient(circle at 50% 50%, rgba(212,175,55,0.06) 0%, transparent 60%)
    `,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    padding: '20px',
  };

  const tarjeta = {
    width: '100%',
    maxWidth: '380px',
    backgroundColor: 'rgba(20,18,14,0.55)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${dorado}66`,
    borderRadius: '16px',
    padding: '36px 30px',
    boxShadow: `0 0 40px rgba(212,175,55,0.15), inset 0 0 60px rgba(212,175,55,0.03)`,
    textAlign: 'center' as const,
  };

  // Pantalla de aviso de mantenimiento: aparece una sola vez, justo
  // después de activar, si la licencia ya lleva 8+ meses sin mantenimiento.
  if (avisoMantenimiento) {
    return (
      <main style={fondo}>
        <div style={tarjeta}>
          <div style={{ fontSize: '48px', marginBottom: '18px' }}>⚠️</div>
          <h2 style={{ color: dorado, fontSize: '19px', lineHeight: 1.5, margin: 0 }}>
            NECESITA HACER MANTENIMIENTO DE BASE DE DATOS.
            <br />
            LLAME A SU PROVEEDOR DE SISTEMA.
          </h2>
          <button
            onClick={() => router.push('/login')}
            style={{
              width: '100%',
              padding: '14px',
              marginTop: '28px',
              borderRadius: '8px',
              border: 'none',
              background: `linear-gradient(90deg, ${dorado}, #b8912f)`,
              color: '#111',
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '1.5px',
              cursor: 'pointer',
              boxShadow: `0 0 20px ${dorado}55`,
            }}
          >
            CONTINUAR
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={fondo}>
      <div style={tarjeta}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
          <img src="/logo.png" alt="Duragonz" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
        </div>

        <h1 style={{ color: dorado, fontSize: '26px', fontWeight: 800, letterSpacing: '3px', margin: 0 }}>
          ACTIVAR DURAGONZ
        </h1>
        <p style={{ color: '#999', fontSize: '13px', margin: '8px 0 28px' }}>
          Ingresa el código de licencia que te dio tu proveedor
        </p>

        <input
          type="text"
          placeholder="Código de licencia"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          onFocus={() => setFocusCodigo(true)}
          onBlur={() => setFocusCodigo(false)}
          onKeyDown={manejarEnter}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '13px 14px',
            marginBottom: '14px',
            backgroundColor: '#141414',
            color: 'white',
            border: `1px solid ${focusCodigo ? dorado : '#333'}`,
            borderRadius: '8px',
            fontSize: '15px',
            outline: 'none',
            textAlign: 'center',
            boxShadow: focusCodigo ? `0 0 10px ${dorado}44` : 'none',
            transition: 'all 0.2s',
          }}
        />

        <input
          type="text"
          placeholder="Nombre de este dispositivo (ej: Caja 1)"
          value={nombreDispositivo}
          onChange={(e) => setNombreDispositivo(e.target.value)}
          onFocus={() => setFocusNombre(true)}
          onBlur={() => setFocusNombre(false)}
          onKeyDown={manejarEnter}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '13px 14px',
            marginBottom: '26px',
            backgroundColor: '#141414',
            color: 'white',
            border: `1px solid ${focusNombre ? dorado : '#333'}`,
            borderRadius: '8px',
            fontSize: '15px',
            outline: 'none',
            textAlign: 'center',
            boxShadow: focusNombre ? `0 0 10px ${dorado}44` : 'none',
            transition: 'all 0.2s',
          }}
        />

        <button
          onClick={activar}
          disabled={verificando}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '8px',
            border: 'none',
            background: verificando ? '#8a7526' : `linear-gradient(90deg, ${dorado}, #b8912f)`,
            color: '#111',
            fontWeight: 700,
            fontSize: '14px',
            letterSpacing: '1.5px',
            cursor: verificando ? 'not-allowed' : 'pointer',
            boxShadow: `0 0 20px ${dorado}55`,
          }}
        >
          {verificando ? 'ACTIVANDO...' : 'ACTIVAR'}
        </button>
      </div>
    </main>
  );
}
