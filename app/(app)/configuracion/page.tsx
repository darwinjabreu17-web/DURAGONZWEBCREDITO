'use client';
import { useRouter } from 'next/navigation';

export default function Configuracion() {
  const router = useRouter();

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Configuración</h1>
      <button onClick={() => router.push('/dashboard')}>Volver al inicio</button>

      <div style={{ marginTop: '20px' }}>
        <button
          onClick={() => router.push('/configuracion/usuarios')}
          style={{ padding: '10px 20px', background: '#4b5563', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          👥 Administrar Usuarios y Permisos
        </button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <button
          onClick={() => router.push('/configuracion/ticket')}
          style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          🧾 Personalizar Ticket de Venta
        </button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <button
          onClick={() => router.push('/configuracion/respaldo')}
          style={{ padding: '10px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          💾 Respaldo de la Base de Datos
        </button>
      </div>
    </div>
  );
}
