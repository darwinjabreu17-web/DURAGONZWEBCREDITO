'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Usuario {
  id: number;
  nombre: string;
  username: string;
  password: string;
  rol: string;
  permisos: Record<string, boolean>;
  activo: boolean;
}

interface Sesion {
  id: number;
  nombre: string;
  username: string;
  rol: string;
  permisos: Record<string, boolean>;
}

// Permisos agrupados por módulo. Cada módulo se muestra como una
// sección separada en el formulario, con su propio título.
const GRUPOS_PERMISOS: { modulo: string; permisos: { clave: string; label: string }[] }[] = [
  {
    modulo: 'Productos',
    permisos: [
      { clave: 'crear_productos', label: 'Crear productos' },
      { clave: 'editar_productos', label: 'Editar productos' },
      { clave: 'editar_stock', label: 'Editar stock/inventario' },
      { clave: 'editar_precios', label: 'Editar precios' },
      { clave: 'editar_precio_costo', label: 'Editar precio de costo' },
    ],
  },
  {
    modulo: 'Ventas',
    permisos: [
      { clave: 'cancelar_ventas', label: 'Cancelar ventas' },
      { clave: 'aplicar_mayoreo', label: 'Aplicar precio de mayoreo' },
      { clave: 'reimprimir_tickets', label: 'Reimprimir tickets' },
      { clave: 'permitir_venta_credito', label: 'Ventas a crédito' },
    ],
  },
  {
    modulo: 'Reportes',
    permisos: [
      { clave: 'ver_reporte', label: 'Ver el reporte' },
      { clave: 'ver_filtro_reportes', label: 'Filtro por fecha' },
      { clave: 'ver_ganancia', label: 'Ver ganancia neta del día' },
      { clave: 'cerrar_caja', label: 'Hacer cierre de caja' },
    ],
  },
  {
    modulo: 'Clientes',
    permisos: [
      { clave: 'clientes_credito', label: 'Agregar clientes crédito' },
      { clave: 'clientes_factura', label: 'Agregar clientes factura' },
    ],
  },
  {
    modulo: 'Configuración',
    permisos: [
      { clave: 'cambiar_tasa', label: 'Cambiar tasa del dólar' },
    ],
  },
];

const MAX_EMPLEADOS = 2;

export default function UsuariosPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null);
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [permisos, setPermisos] = useState<Record<string, boolean>>({});

  // ---- Protección: solo administradores entran aquí ----
  useEffect(() => {
    const guardada = localStorage.getItem('sesion_usuario');
    if (!guardada) {
      router.push('/login');
      return;
    }
    const datos = JSON.parse(guardada) as Sesion;
    if (datos.rol !== 'admin') {
      alert('Solo el administrador puede entrar aquí');
      router.push('/dashboard');
      return;
    }
    setSesion(datos);
    setVerificandoSesion(false);
  }, [router]);

  useEffect(() => {
    if (!verificandoSesion) cargarUsuarios();
  }, [verificandoSesion]);

  async function cargarUsuarios() {
    setCargando(true);
    try {
      const res = await fetch('/api/usuarios');
      const { data, error } = await res.json();
      if (error) console.error(error);
      setUsuarios((data as Usuario[]) || []);
    } catch (err) {
      console.error(err);
    }
    setCargando(false);
  }

  const empleadosActivos = usuarios.filter(u => u.rol !== 'admin' && u.activo);

  function limpiarFormulario() {
    setUsuarioSeleccionado(null);
    setNombre('');
    setUsername('');
    setPassword('');
    setPermisos({});
  }

  function seleccionarUsuario(u: Usuario) {
    setUsuarioSeleccionado(u);
    setNombre(u.nombre || '');
    setUsername(u.username || '');
    setPassword(u.password || '');
    setPermisos(u.permisos || {});
  }

  function togglePermiso(clave: string) {
    setPermisos(prev => ({ ...prev, [clave]: !prev[clave] }));
  }

  async function guardarUsuario() {
    if (!nombre.trim() || !username.trim()) {
      alert('Completa nombre y usuario');
      return;
    }
    if (!usuarioSeleccionado && !password.trim()) {
      alert('Escribe una contraseña para el nuevo empleado');
      return;
    }

    if (!usuarioSeleccionado && empleadosActivos.length >= MAX_EMPLEADOS) {
      alert(`Ya tienes el máximo de ${MAX_EMPLEADOS} empleados activos. Da de baja a uno para poder agregar otro.`);
      return;
    }

    setGuardando(true);

    const payload: any = {
      nombre: nombre.trim(),
      username: username.trim(),
      permisos,
      rol: usuarioSeleccionado ? usuarioSeleccionado.rol : 'empleado',
    };
    if (password.trim()) {
      payload.password = password.trim();
    }

    try {
      let res;
      if (usuarioSeleccionado) {
        res = await fetch(`/api/usuarios/${usuarioSeleccionado.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, activo: true }),
        });
      }
      const { error } = await res.json();
      if (error) {
        alert('Error al guardar: ' + error);
        setGuardando(false);
        return;
      }
    } catch (err) {
      alert('Error al guardar');
      setGuardando(false);
      return;
    }

    setGuardando(false);
    await cargarUsuarios();
    limpiarFormulario();

  }

  async function darDeBaja() {
    if (!usuarioSeleccionado) return;
    if (usuarioSeleccionado.rol === 'admin') {
      alert('No puedes dar de baja al administrador');
      return;
    }
    const confirmar = confirm(`¿Dar de baja a ${usuarioSeleccionado.nombre}? No podrá iniciar sesión y su usuario se eliminará. Sus ventas ya registradas se conservan intactas.`);
    if (!confirmar) return;

    const res = await fetch(`/api/usuarios/${usuarioSeleccionado.id}`, {
      method: 'DELETE',
    });
    const { error } = await res.json();

    if (error) {
      alert('Error al dar de baja: ' + error);
      return;
    }

    await cargarUsuarios();
    limpiarFormulario();
  }

  const usuariosFiltrados = usuarios.filter(u =>
    (u.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const inputStyle = { padding: '11px 13px', border: '1px solid #d1d5db', borderRadius: '6px', width: '100%', boxSizing: 'border-box' as const, fontSize: '17px' };
  const btnPrimario = { backgroundColor: '#111827', color: 'white', padding: '11px 20px', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '16px' };
  const btnSecundario = { backgroundColor: '#f3f4f6', color: '#374151', padding: '11px 15px', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '16px' };
  const btnVolver = { backgroundColor: '#f9fafb', color: '#374151', padding: '8px 13px', borderRadius: '6px', fontWeight: 600, border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '15px' };

  if (verificandoSesion) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '17px' }}>Verificando sesión...</div>;
  }

  return (
    <div className="usuarios-root" style={{ fontFamily: 'sans-serif', backgroundColor: '#f9fafb' }}>

      <div className="usuarios-header">
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>Administración de Usuarios</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '16px', color: '#6b7280' }}>
            Empleados: <strong>{empleadosActivos.length} / {MAX_EMPLEADOS}</strong>
          </span>
          <button style={btnVolver} onClick={() => router.push('/configuracion')}>← Volver</button>
        </div>
      </div>

      <div className="usuarios-grid">

        {/* ---------- Lista de usuarios ---------- */}
        <div className="usuarios-lista-panel">
          <div style={{ padding: '9px', borderBottom: '1px solid #e5e7eb' }}>
            <input
              style={inputStyle}
              placeholder="Buscar usuario..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div className="usuarios-lista-scroll">
            {cargando && <div style={{ padding: '10px', color: '#6b7280', fontSize: '17px' }}>Cargando...</div>}
            {!cargando && usuariosFiltrados.map((u) => (
              <div
                key={u.id}
                onClick={() => seleccionarUsuario(u)}
                style={{
                  padding: '11px 13px',
                  borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                  backgroundColor: usuarioSeleccionado?.id === u.id ? '#f3f4f6' : 'white',
                  opacity: u.activo ? 1 : 0.5,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '17px' }}>{u.nombre || u.username}</div>
                <div style={{ fontSize: '14.5px', color: '#6b7280' }}>
                  {u.rol === 'admin' ? 'Administrador' : 'Empleado'} — {u.username} {!u.activo && '(baja)'}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '9px', borderTop: '1px solid #e5e7eb' }}>
            <button style={{ ...btnSecundario, width: '100%' }} onClick={limpiarFormulario}>
              + Nuevo Empleado
            </button>
          </div>
        </div>

        {/* ---------- Formulario ---------- */}
        <div className="usuarios-form-panel">
          <h3 style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '19px' }}>
            {usuarioSeleccionado ? `Editar: ${usuarioSeleccionado.nombre}` : 'Nuevo Empleado'}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <input style={inputStyle} placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <input style={inputStyle} placeholder="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <input style={{ ...inputStyle, marginBottom: '10px' }} placeholder={usuarioSeleccionado ? 'Nueva contraseña (vacío = no cambia)' : 'Contraseña'} value={password} onChange={(e) => setPassword(e.target.value)} />

          {usuarioSeleccionado?.rol === 'admin' ? (
            <div style={{ color: '#6b7280', fontSize: '16px', marginBottom: '10px' }}>
              El administrador tiene acceso a todo el sistema, no necesita permisos individuales.
            </div>
          ) : (
            <div className="usuarios-permisos-box">
              {GRUPOS_PERMISOS.map((grupo) => (
                <div key={grupo.modulo} className="usuarios-permisos-grupo">
                  <div className="usuarios-permisos-titulo">
                    {grupo.modulo}
                  </div>
                  <div className="usuarios-permisos-grid">
                    {grupo.permisos.map((p) => (
                      <label key={p.clave} className="usuarios-permiso-item">
                        <input
                          type="checkbox"
                          checked={!!permisos[p.clave]}
                          onChange={() => togglePermiso(p.clave)}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '10px', marginTop: '10px' }}>
            {usuarioSeleccionado && usuarioSeleccionado.rol !== 'admin' ? (
              <button
                onClick={darDeBaja}
                style={{ color: '#ef4444', fontWeight: 'bold', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '16px' }}
              >
                Dar de baja
              </button>
            ) : <span />}
            <button style={btnPrimario} onClick={guardarUsuario} disabled={guardando}>
              {guardando ? 'Guardando...' : usuarioSeleccionado ? 'Guardar Cambios' : 'Crear Empleado'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .usuarios-root {
          height: 100vh;
          height: 100dvh;
          display: flex;
          flex-direction: column;
          padding: 10px 14px;
          box-sizing: border-box;
          overflow: hidden;
        }
        .usuarios-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          flex-shrink: 0;
        }
        .usuarios-grid {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 10px;
        }
        .usuarios-lista-panel {
          background: white;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }
        .usuarios-lista-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }
        .usuarios-form-panel {
          background: white;
          padding: 14px 16px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          min-height: 0;
          overflow-y: auto;
        }
        .usuarios-permisos-box {
          background: #f9fafb;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          margin-bottom: 8px;
        }
        .usuarios-permisos-grupo {
          margin-bottom: 9px;
        }
        .usuarios-permisos-grupo:last-child {
          margin-bottom: 0;
        }
        .usuarios-permisos-titulo {
          font-size: 13.5px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 5px;
          padding-bottom: 3px;
          border-bottom: 1px solid #e5e7eb;
        }
        .usuarios-permisos-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 5px 10px;
        }
        .usuarios-permiso-item {
          display: flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          font-size: 16px;
          line-height: 1.3;
        }
        .usuarios-permiso-item input {
          flex-shrink: 0;
          width: 18px;
          height: 18px;
        }

        @media (max-width: 768px) {
          .usuarios-root {
            padding: 8px 10px;
          }
          .usuarios-grid {
            grid-template-columns: 1fr;
            grid-template-rows: 140px 1fr;
          }
          .usuarios-permisos-grid {
            grid-template-columns: 1fr;
          }
          .usuarios-header h1 {
            font-size: 17px;
          }
        }
      `}</style>
    </div>
  );
}
