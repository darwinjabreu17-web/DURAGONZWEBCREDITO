'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [focusUsuario, setFocusUsuario] = useState(false);
  const [focusClave, setFocusClave] = useState(false);
  const [presionado, setPresionado] = useState(false);
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

  return (
    <>
      <style jsx>{`
        @keyframes neonPulse {
          0% { color: #ff2d2d; text-shadow: 0 0 20px #ff2d2d, 0 0 40px #ff2d2d; }
          25% { color: #00ff00; text-shadow: 0 0 20px #00ff00, 0 0 40px #00ff00; }
          50% { color: #00d9ff; text-shadow: 0 0 20px #00d9ff, 0 0 40px #00d9ff; }
          75% { color: #ff00ff; text-shadow: 0 0 20px #ff00ff, 0 0 40px #ff00ff; }
          100% { color: #ff2d2d; text-shadow: 0 0 20px #ff2d2d, 0 0 40px #ff2d2d; }
        }
        .titulo-neon {
          animation: neonPulse 8s infinite ease-in-out;
        }
      `}</style>

      <main style={{
        minHeight: '100vh',
        backgroundColor: 'black',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'monospace'
      }}>
        <h1 className="titulo-neon" style={{
          fontSize: '70px',
          fontWeight: 900,
          marginBottom: '50px',
          letterSpacing: '4px'
        }}>DURAGONZ</h1>
        
        <input 
          type="text" 
          placeholder="USUARIO"
          value={usuario} 
          onChange={(e) => setUsuario(e.target.value)}
          onFocus={() => setFocusUsuario(true)}
          onBlur={() => setFocusUsuario(false)}
          onKeyDown={manejarEnter}
          style={{
            padding: '15px',
            margin: '10px',
            width: '300px',
            backgroundColor: 'black',
            color: 'white',
            border: `2px solid ${focusUsuario ? '#00ff00' : '#ff2d2d'}`,
            fontSize: '16px',
            outline: 'none',
            textAlign: 'center',
            boxShadow: focusUsuario ? '0 0 15px #00ff00' : '0 0 10px #ff2d2d',
            transition: 'all 0.2s'
          }} 
        />
        
        <input 
          type="password" 
          placeholder="CLAVE"
          value={clave} 
          onChange={(e) => setClave(e.target.value)}
          onFocus={() => setFocusClave(true)}
          onBlur={() => setFocusClave(false)}
          onKeyDown={manejarEnter}
          style={{
            padding: '15px',
            margin: '10px',
            width: '300px',
            backgroundColor: 'black',
            color: 'white',
            border: `2px solid ${focusClave ? '#00ff00' : '#ff2d2d'}`,
            fontSize: '16px',
            outline: 'none',
            textAlign: 'center',
            boxShadow: focusClave ? '0 0 15px #00ff00' : '0 0 10px #ff2d2d',
            transition: 'all 0.2s'
          }} 
        />
        
        <button 
          onClick={iniciarSesion}
          onMouseDown={() => setPresionado(true)}
          onMouseUp={() => setPresionado(false)}
          onMouseLeave={() => setPresionado(false)}
          disabled={verificando}
          style={{
            padding: '15px 40px',
            marginTop: '30px',
            backgroundColor: presionado ? '#00ff00' : 'black',
            color: presionado ? 'black' : '#00ff00',
            fontWeight: 'bold',
            border: '2px solid #00ff00',
            cursor: verificando ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            letterSpacing: '2px',
            boxShadow: '0 0 15px #00ff00',
            transition: 'all 0.1s'
          }}
        >
          {verificando ? 'VERIFICANDO...' : 'INICIAR SESIÓN'}
        </button>
      </main>
    </>
  );
}
