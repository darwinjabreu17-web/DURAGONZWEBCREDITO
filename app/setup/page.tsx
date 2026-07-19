'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Setup() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');

  useEffect(() => {
    const adminExiste = localStorage.getItem('admin_cuenta');
    if (adminExiste) {
      router.push('/login');
    }
  }, [router]);

  const crearAdmin = () => {
    if (usuario === '' || clave === '') {
      alert('LLENA LOS CAMPOS');
      return;
    }

    const admin = { usuario, clave };
    localStorage.setItem('admin_cuenta', JSON.stringify(admin));
    alert('ADMINISTRADOR CREADO CON ÉXITO');
    router.push('/login');
  };

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: 'black',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'monospace'
    }}>
      <h1 style={{
        color: '#ff2d2d',
        fontSize: '48px',
        fontWeight: 900,
        fontFamily: 'Impact, "Arial Black", sans-serif',
        letterSpacing: '6px',
        textShadow: '0 0 20px #ff2d2d',
        marginBottom: '10px',
        transform: 'scaleY(1.2)'
      }}>DURAGONZ</h1>

      <h2 style={{
        color: '#00ff00',
        textShadow: '0 0 15px #00ff00',
        marginBottom: '30px',
        fontSize: '20px',
        fontWeight: 900
      }}>CONFIGURACION INICIAL</h2>

      <p style={{ color: 'white', marginBottom: '20px' }}>
        CREA LA CUENTA ADMINISTRADOR PARA ESTA BODEGA
      </p>

      <input
        type="text"
        placeholder="USUARIO ADMIN"
        value={usuario}
        onChange={(e) => setUsuario(e.target.value)}
        style={{
          padding: '15px',
          margin: '10px',
          width: '350px',
          backgroundColor: 'black',
          color: '#00ff00',
          border: '2px solid #00ff00',
          fontSize: '16px',
          outline: 'none',
          textAlign: 'center',
          boxShadow: '0 0 15px #00ff00',
          fontWeight: 'bold',
          textShadow: '0 0 10px #00ff00'
        }}
      />

      <input
        type="password"
        placeholder="CLAVE ADMIN"
        value={clave}
        onChange={(e) => setClave(e.target.value)}
        style={{
          padding: '15px',
          margin: '10px',
          width: '350px',
          backgroundColor: 'black',
          color: '#ff2d2d',
          border: '2px solid #ff2d2d',
          fontSize: '16px',
          outline: 'none',
          textAlign: 'center',
          boxShadow: '0 0 15px #ff2d2d',
          fontWeight: 'bold',
          textShadow: '0 0 10px #ff2d2d'
        }}
      />

      <button
        onClick={crearAdmin}
        style={{
          padding: '15px',
          margin: '10px',
          width: '350px',
          backgroundColor: 'black',
          color: '#00ff00',
          border: '2px solid #00ff00',
          boxShadow: '0 0 15px #00ff00',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          textShadow: '0 0 10px #00ff00'
        }}
      >
        CREAR ADMINISTRADOR
      </button>
    </main>
  );
}