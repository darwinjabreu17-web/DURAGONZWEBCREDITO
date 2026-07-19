export function obtenerUuidDispositivo(): string {
  const clave = 'duragonz_dispositivo_uuid'
  let uuid = localStorage.getItem(clave)

  if (!uuid) {
    uuid = crypto.randomUUID()
    localStorage.setItem(clave, uuid)
  }

  return uuid
}