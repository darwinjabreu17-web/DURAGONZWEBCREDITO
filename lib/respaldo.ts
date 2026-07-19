export async function ejecutarRespaldoYSalir(tipo: 'con_cierre' | 'sin_cierre') {
  try {
    const res = await fetch('/api/respaldo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo }),
    })
    const { data, error } = await res.json()

    if (error) {
      const continuar = confirm('Hubo un problema haciendo el respaldo: ' + error + '\n¿Deseas salir de todas formas?')
      if (!continuar) return false
    } else if (data) {
      // Descarga el respaldo como archivo a la PC (carpeta Descargas)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const fecha = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `respaldo-duragonz-${fecha}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  } catch {
    const continuar = confirm('No se pudo conectar para hacer el respaldo. ¿Deseas salir de todas formas?')
    if (!continuar) return false
  }

  localStorage.removeItem('sesion_usuario')
  window.location.href = '/login'
  return true
}