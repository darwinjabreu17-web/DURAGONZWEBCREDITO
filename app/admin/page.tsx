'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Cliente = {
  usuario: string;
  clave: string;
};

export default function Admin() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [listaClientes, setListaClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    const admin = localStorage.getItem('admin_cuenta');
    if (!admin) router.push('/setup');

    const guardados = localStorage.getItem('lista_clientes');
    if (guardados) setListaClientes(JSON.parse(guardados));
  }, [router]);

  const agregarCliente = () => {
    if (usuario === '' || clave === '') {
      alert('LLENA LOS CAMPOS');
      return;
    }

    // SOLO ESTA ES LA LÍNEA NUEVA: BLOQUEA EN 2 CLIENTES
    if (listaClientes.length >= 2) {
      alert('LIMITE ALCANZADO: SOLO PUEDES CREAR 2 CLIENTES');
      return;
    }

    const existe = listaClientes.find(c => c.usuario === usuario);
    if (existe) {
      alert('ESE USUARIO YA EXISTE');
      return;
    }

    const nuevoCliente: Cliente = { usuario, clave };
    const nuevaLista = [...listaClientes, nuevoCliente];
    setListaClientes(nuevaLista);
    localStorage.setItem('lista_clientes', JSON.stringify(nuevaLista));
    setUsuario('');
    setClave('');
    alert(`CLIENTE REGISTRADO. QUEDAN ${2 - nuevaLista.length} ESPACIOS`);
  };

  const eliminarCliente = (usuarioCliente: string) => {
    const nuevaLista = listaClientes.filter(c => c.usuario!== usuarioCliente);
    setListaClientes(nuevaLista);
    localStorage.setItem('lista_clientes', JSON.stringify(nuevaLista));
  };

  const cancelar = () => {
    setUsuario('');
    setClave('');
  };

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: 'black',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'monospace',
      padding: '20px'
    }}>
      <h1 style={{
        color: '#ff2d2d',
        fontSize: '56px',
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
        marginBottom: '10px',
        fontSize: '24px',
        fontWeight: 900
      }}>BIENVENIDO ADMIN</h2>

      <p style={{ color: 'white', marginBottom: '20px' }}>
        CLIENTES: {listaClientes.length}/2
      </p>

      <input
        type="text"
        placeholder="USUARIO CLIENTE"
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
        type="text"
        placeholder="CLAVE CLIENTE"
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
        onClick={agregarCliente}
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
        REGISTRAR CLIENTE
      </button>

      <button
        onClick={cancelar}
        style={{
          padding: '15px',
          margin: '10px',
          width: '350px',
          backgroundColor: 'black',
          color: '#ff2d2d',
          border: '2px solid #ff2d2d',
          boxShadow: '0 0 15px #ff2d2d',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          textShadow: '0 0 10px #ff2d2d'
        }}
      >
        CANCELAR
      </button>

      {/* LISTA DE CLIENTES */}
      <div style={{ marginTop: '30px', width: '350px' }}>
        {listaClientes.map((cliente) => (
          <div key={cliente.usuario} style={{
            border: '1px solid #00ff00',
            padding: '10px',
            margin: '10px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 0 10px #00ff00'
          }}>
            <span style={{ color: '#00ff00', textShadow: '0 0 5px #00ff00' }}>
              {cliente.usuario} | {cliente.clave}
            </span>
            <button
              onClick={() => eliminarCliente(cliente.usuario)}
              style={{
                backgroundColor: 'black',
                color: '#ff2d2d',
                border: '1px solid #ff2d2d',
                padding: '5px 10px',
                cursor: 'pointer',
                textShadow: '0 0 5px #ff2d2d'
              }}
            >
              ELIMINAR
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => router.push('/login')}
        style={{
          padding: '10px',
          marginTop: '30px',
          width: '200px',
          backgroundColor: 'black',
          color: 'white',
          border: '1px solid white',
          cursor: 'pointer',
          fontSize: '12px'
        }}
      >
        CERRAR SESION
      </button>
    </main>
  );
}