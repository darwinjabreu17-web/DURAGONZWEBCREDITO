'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Activacion() {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [nombreDispositivo, setNombreDispositivo] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [avisoMantenimiento, setAvisoMantenimiento] = useState(false);

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

  // Pantalla de aviso de mantenimiento: aparece una sola vez, justo
  // después de activar, si la licencia ya lleva 8+ meses sin mantenimiento.
  if (avisoMantenimiento) {
    return (
      <main style={{
        minHeight: '100vh',
        backgroundColor: 'black',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'monospace',
        padding: '20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '50px', marginBottom: '20px' }}>⚠️</div>
        <h2 style={{ color: '#facc15', fontSize: '22px', maxWidth: '500px', lineHeight: 1.5 }}>
          NECESITA HACER MANTENIMIENTO DE BASE DE DATOS.
          <br />
          LLAME A SU PROVEEDOR DE SISTEMA.
        </h2>
        <button
          onClick={() => router.push('/login')}
          style={{
            padding: '15px 40px',
            marginTop: '30px',
            backgroundColor: 'black',
            color: '#00ff00',
            fontWeight: 'bold',
            border: '2px solid #00ff00',
            cursor: 'pointer',
            fontSize: '16px',
            letterSpacing: '2px',
            boxShadow: '0 0 15px #00ff00',
          }}
        >
          CONTINUAR
        </button>
      </main>
    );
  }

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: 'black',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'monospace',
      padding: '20px',
    }}>
      <h1 style={{
        color: '#00d9ff',
        fontSize: '40px',
        fontWeight: 900,
        marginBottom: '10px',
        letterSpacing: '3px',
      }}>ACTIVAR DURAGONZ</h1>
      <p style={{ color: '#9ca3af', marginBottom: '40px', fontSize: '15px' }}>
        Ingresa el código de licencia que te dio tu proveedor
      </p>

      <input
        type="text"
        placeholder="CÓDIGO DE LICENCIA"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        onKeyDown={manejarEnter}
        style={{
          padding: '15px',
          margin: '10px',
          width: '300px',
          backgroundColor: 'black',
          color: 'white',
          border: '2px solid #00d9ff',
          fontSize: '16px',
          outline: 'none',
          textAlign: 'center',
          boxShadow: '0 0 10px #00d9ff',
        }}
      />

      <input
        type="text"
        placeholder="NOMBRE DE ESTE DISPOSITIVO (ej: Caja 1)"
        value={nombreDispositivo}
        onChange={(e) => setNombreDispositivo(e.target.value)}
        onKeyDown={manejarEnter}
        style={{
          padding: '15px',
          margin: '10px',
          width: '300px',
          backgroundColor: 'black',
          color: 'white',
          border: '2px solid #4b5563',
          fontSize: '16px',
          outline: 'none',
          textAlign: 'center',
        }}
      />

      <button
        onClick={activar}
        disabled={verificando}
        style={{
          padding: '15px 40px',
          marginTop: '30px',
          backgroundColor: 'black',
          color: '#00ff00',
          fontWeight: 'bold',
          border: '2px solid #00ff00',
          cursor: verificando ? 'not-allowed' : 'pointer',
          fontSize: '16px',
          letterSpacing: '2px',
          boxShadow: '0 0 15px #00ff00',
        }}
      >
        {verificando ? 'ACTIVANDO...' : 'ACTIVAR'}
      </button>
    </main>
  );
}