export async function fetchConTimeout(url: string, opciones: RequestInit = {}, ms = 2000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { ...opciones, signal: controller.signal })
    clearTimeout(timeoutId)
    return res
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}