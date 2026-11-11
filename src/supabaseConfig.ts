export function validateSupabaseKey(key: string) {
  const secretError = 'Supabase secret/service-role keys must never be used in the frontend. Revoke the exposed key and use a publishable or legacy anon key.'
  if (key.startsWith('sb_secret_')) throw new Error(secretError)
  if (key.startsWith('sb_publishable_')) return

  let role: unknown
  try {
    const payload = key.split('.')[1]
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    role = JSON.parse(atob(normalized)).role
  } catch {
    throw new Error('Invalid Supabase public API key. Use a publishable or legacy anon key.')
  }
  if (role === 'service_role') throw new Error(secretError)
  if (role !== 'anon') throw new Error('Supabase frontend key must be publishable or legacy anon.')
}
