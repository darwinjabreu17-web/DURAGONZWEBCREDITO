'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [recordarme, setRecordarme] = useState(false);
  const [focusUsuario, setFocusUsuario] = useState(false);
  const [focusClave, setFocusClave] = useState(false);
  const [verificando, setVerificando] = useState(false);

  // Si alguien llega aquí directo por la URL sin haber activado el
  // dispositivo, lo mandamos de vuelta a la pantalla de activación.
  useEffect(() => {
    const yaActivado = localStorage.getItem('duragonz_licencia');
    if (!yaActivado) {
      router.push('/activacion');
    }
  }, [router]);

  const iniciarSesion = async () => {
    if (!usuario || !clave) {
      alert('Escribe usuario y clave');
      return;
    }

    setVerificando(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usuario, password: clave }),
      });
      const { data, error } = await res.json();

      setVerificando(false);

      if (error) {
        alert(error);
        return;
      }

      localStorage.setItem('sesion_usuario', JSON.stringify({
        id: data.id,
        nombre: data.nombre,
        username: data.username,
        rol: data.rol,
        permisos: data.permisos || {},
      }));

      router.push('/dashboard');
    } catch (err) {
      setVerificando(false);
      alert('Error al iniciar sesión');
    }
  };

  const manejarEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') iniciarSesion();
  };

  const dorado = '#d4af37';

  return (
    <main style={{
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
}}>
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          backgroundColor: 'rgba(15,15,15,0.9)',
          border: `1px solid ${dorado}55`,
          borderRadius: '16px',
          padding: '36px 30px',
          boxShadow: `0 0 40px rgba(212,175,55,0.08)`,
        }}
      >
        {/* Logo hexagonal */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
  <img src="/logo.png" alt="Duragonz" style={{ width: '90px', height: '90px', objectFit: 'contain' }} />
</div>

        <h1
          style={{
            textAlign: 'center',
            color: dorado,
            fontSize: '32px',
            fontWeight: 800,
            letterSpacing: '4px',
            margin: 0,
          }}
        >
          DURAGONZ
        </h1>
        <p
          style={{
            textAlign: 'center',
            color: '#999',
            fontSize: '13px',
            margin: '6px 0 28px',
          }}
        >
          Sistema de Punto de Venta · Inicia sesión para continuar
        </p>

        {/* Usuario */}
        <label style={{ color: '#ccc', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
          Usuario
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#141414',
            border: `1px solid ${focusUsuario ? dorado : '#333'}`,
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '18px',
            boxShadow: focusUsuario ? `0 0 10px ${dorado}44` : 'none',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ color: dorado, fontSize: '16px' }}>👤</span>
          <input
            type="text"
            placeholder="Ingresa tu usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            onFocus={() => setFocusUsuario(true)}
            onBlur={() => setFocusUsuario(false)}
            onKeyDown={manejarEnter}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'white',
              fontSize: '15px',
            }}
          />
        </div>

        {/* Contraseña */}
        <label style={{ color: '#ccc', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
          Contraseña
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#141414',
            border: `1px solid ${focusClave ? dorado : '#333'}`,
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '10px',
            boxShadow: focusClave ? `0 0 10px ${dorado}44` : 'none',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ color: dorado, fontSize: '16px' }}>🔒</span>
          <input
            type={verClave ? 'text' : 'password'}
            placeholder="Ingresa tu contraseña"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            onFocus={() => setFocusClave(true)}
            onBlur={() => setFocusClave(false)}
            onKeyDown={manejarEnter}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'white',
              fontSize: '15px',
            }}
          />
          <span
            onClick={() => setVerClave(!verClave)}
            style={{ cursor: 'pointer', color: '#888', fontSize: '15px' }}
          >
            {verClave ? '🙈' : '👁️'}
          </span>
        </div>

        {/* Recordarme / olvidaste */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '26px',
            fontSize: '12.5px',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ccc', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={recordarme}
              onChange={(e) => setRecordarme(e.target.checked)}
              style={{ accentColor: dorado }}
            />
            Recordarme
          </label>
          <span style={{ color: dorado, cursor: 'pointer' }}>¿Olvidaste tu contraseña?</span>
        </div>

        {/* Botón */}
        <button
          onClick={iniciarSesion}
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
          {verificando ? 'VERIFICANDO...' : 'INGRESAR AL SISTEMA'}
        </button>

        <p style={{ textAlign: 'center', color: '#666', fontSize: '11px', marginTop: '22px' }}>
          v2.1.0 · Seguro 🛡️ Encriptado SSL
        </p>
      </div>
    </main>
  );
}
