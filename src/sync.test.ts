import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  initialize: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }))
vi.mock('./db', () => ({ db: {} }))

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key')
  vi.stubGlobal('window', { location: { origin: 'https://example.com' } })
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  auth.initialize.mockResolvedValue({ error: null })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('authentication', () => {
  it('recognizes signed-in users without an email address', async () => {
    const user = { id: 'github-user' }
    auth.getSession.mockResolvedValue({ data: { session: { user } }, error: null })
    const { onAuthChange } = await import('./sync')
    const changed = vi.fn()
    const failed = vi.fn()
    const stop = onAuthChange(changed, failed)
    await vi.waitFor(() => expect(changed).toHaveBeenCalledWith(user))
    expect(failed).not.toHaveBeenCalled()
    stop()
  })

  it('reports session initialization errors', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: new Error('Invalid callback') })
    const { onAuthChange } = await import('./sync')
    const failed = vi.fn()
    const stop = onAuthChange(vi.fn(), failed)
    await vi.waitFor(() => expect(failed).toHaveBeenCalledWith('Invalid callback'))
    stop()
  })

  it('surfaces callback failures that getSession would otherwise hide', async () => {
    auth.initialize.mockResolvedValue({ error: new Error('Invalid API key') })
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    const { onAuthChange } = await import('./sync')
    const failed = vi.fn()
    const stop = onAuthChange(vi.fn(), failed)
    await vi.waitFor(() => expect(failed).toHaveBeenCalledWith('Invalid API key'))
    expect(auth.getSession).not.toHaveBeenCalled()
    stop()
  })

  it('throws OAuth errors instead of silently ignoring them', async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: new Error('Provider disabled') })
    const { signInWithGitHub } = await import('./sync')
    await expect(signInWithGitHub()).rejects.toThrow('Provider disabled')
  })

  it('does not report successful sync without an authenticated user', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { syncAll } = await import('./sync')
    await expect(syncAll()).rejects.toThrow('Sign in before syncing')
  })
})
