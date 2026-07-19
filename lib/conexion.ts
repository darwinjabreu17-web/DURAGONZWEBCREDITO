export async function hayInternetReal(): Promise<boolean> {
  if (!navigator.onLine) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch('/api/ping', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}