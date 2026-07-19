'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const yaActivado = localStorage.getItem('duragonz_licencia');
    if (yaActivado) {
      router.push('/login');
    } else {
      router.push('/activacion');
    }
  }, [router]);

  return (
    <div style={{
      backgroundColor: 'black',
      color: '#00ff00',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'monospace'
    }}>
      CARGANDO...
    </div>
  );
}