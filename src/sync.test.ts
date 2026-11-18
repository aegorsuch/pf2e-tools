import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const backend = vi.hoisted(() => ({
  auth: {
    initialize: vi.fn(),
    getSession: vi.fn(),
    getUser: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(),
}))
const database = vi.hoisted(() => ({ table: vi.fn(), transaction: vi.fn() }))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => backend }))
vi.mock('./db', () => ({ db: database }))
const auth = backend.auth

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key')
  vi.stubGlobal('window', { location: { origin: 'https://example.com' } })
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() })
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

  it('does not overwrite a newer local spell change with an in-flight remote pull', async () => {
    const local = { id: 'character', updatedAt: 30, spells: ['New spell'] }
    const target = { get: vi.fn().mockResolvedValue(local), put: vi.fn() }
    database.table.mockReturnValue(target)
    database.transaction.mockImplementation(async (_mode, _table, action) => action())
    const { applyRemoteRows } = await import('./sync')
    await applyRemoteRows('characters', [{ id: 'character', updatedAt: 20 }])
    expect(target.put).not.toHaveBeenCalled()
    await applyRemoteRows('characters', [{ id: 'character', updatedAt: 40 }])
    expect(target.put).toHaveBeenCalledWith({ id: 'character', updatedAt: 40 })
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

describe('settings sync', () => {
  it('defaults the training limit on for older settings and persists an explicit opt-out', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({
      settings: { rangerSnarecrafter: false }, updatedAt: 10,
    }))
    const settings = await import('./settings')
    expect(settings.getSettings().singleTrainingFeats).toBe(true)
    expect(settings.getSettings().championFormNoFlight).toBe(true)
    expect(settings.getSettings().rangerCavalier).toBe(true)
    expect(settings.getSettings().orderExplorerSkills).toBe(true)
    expect(settings.getSettings().gauntletFinesse).toBe(true)
    expect(settings.getSettings().bucklerMeleeFinesse).toBe(true)
    expect(settings.getSettings().unarmedCountsAsWeapons).toBe(true)
    expect(settings.getSettings().barbarianIgnoreAgile).toBe(true)
    expect(settings.getSettings().cyborgTestSubject).toBe(true)
    expect(settings.getSettings().adoptedDwarfClanDagger).toBe(true)
    expect(settings.getSettings().disableAdoptedAncestry).toBe(true)
    expect(settings.getSettings().disableAncientElfMultitalented).toBe(true)
    expect(settings.getSettings().singleAdditionalArms).toBe(true)
    expect(settings.getSettings().exclusiveCyborgHearts).toBe(true)
    expect(settings.getSettings().innateAutoHeighten).toBe(true)
    expect(settings.getSettings().deityLore).toBe(true)
    settings.updateSettings({ singleTrainingFeats: false, championFormNoFlight: false, orderExplorerSkills: false, gauntletFinesse: false, unarmedCountsAsWeapons: false, barbarianIgnoreAgile: false, adoptedDwarfClanDagger: false, disableAdoptedAncestry: false, singleAdditionalArms: false, exclusiveCyborgHearts: false })
    settings.updateSettings({ bucklerMeleeFinesse: false, rangerCavalier: false, innateAutoHeighten: false, deityLore: false, disableAncientElfMultitalented: false })
    const saved = vi.mocked(localStorage.setItem).mock.lastCall?.[1]
    if (!saved) throw new Error('Settings were not persisted')
    vi.mocked(localStorage.getItem).mockReturnValue(saved)
    vi.resetModules()
    const reloaded = await import('./settings')
    expect(reloaded.getSettings().singleTrainingFeats).toBe(false)
    expect(reloaded.getSettings().championFormNoFlight).toBe(false)
    expect(reloaded.getSettings().rangerCavalier).toBe(false)
    expect(reloaded.getSettings().orderExplorerSkills).toBe(false)
    expect(reloaded.getSettings().gauntletFinesse).toBe(false)
    expect(reloaded.getSettings().bucklerMeleeFinesse).toBe(false)
    expect(reloaded.getSettings().innateAutoHeighten).toBe(false)
    expect(reloaded.getSettings().deityLore).toBe(false)
    expect(reloaded.getSettings().unarmedCountsAsWeapons).toBe(false)
    expect(reloaded.getSettings().barbarianIgnoreAgile).toBe(false)
    expect(reloaded.getSettings().adoptedDwarfClanDagger).toBe(false)
    expect(reloaded.getSettings().disableAdoptedAncestry).toBe(false)
    expect(reloaded.getSettings().disableAncientElfMultitalented).toBe(false)
    expect(reloaded.getSettings().singleAdditionalArms).toBe(false)
    expect(reloaded.getSettings().exclusiveCyborgHearts).toBe(false)
    reloaded.applySyncedSettings({ singleTrainingFeats: true, championFormNoFlight: true, orderExplorerSkills: true, gauntletFinesse: true,
      disableAdoptedAncestry: false, disableAncientElfMultitalented: false }, reloaded.getSettingsUpdatedAt() + 1)
    expect(reloaded.getSettings().singleTrainingFeats).toBe(true)
    expect(reloaded.getSettings().championFormNoFlight).toBe(true)
    expect(reloaded.getSettings().orderExplorerSkills).toBe(true)
    expect(reloaded.getSettings().gauntletFinesse).toBe(true)
    expect(reloaded.getSettings().deityLore).toBe(true)
    expect(reloaded.getSettings().disableAdoptedAncestry).toBe(false)
    expect(reloaded.getSettings().disableAncientElfMultitalented).toBe(false)
    expect(reloaded.getSettings().bucklerMeleeFinesse).toBe(true)
    expect(reloaded.getSettings().unarmedCountsAsWeapons).toBe(true)
    expect(reloaded.getSettings().barbarianIgnoreAgile).toBe(true)
    expect(reloaded.getSettings().adoptedDwarfClanDagger).toBe(true)
    expect(reloaded.getSettings().singleAdditionalArms).toBe(true)
    expect(reloaded.getSettings().exclusiveCyborgHearts).toBe(true)
  })

  it('pulls newer settings from the signed-in account', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify({ rangerSnarecrafter: false })),
      setItem: vi.fn(),
    })
    const remote = { rangerSnarecrafter: true }
    const maybeSingle = vi.fn().mockResolvedValue({ data: { updated_at: 20, body: remote }, error: null })
    const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }))
    backend.from.mockReturnValue({ select, upsert: vi.fn() })

    const { syncUserSettings } = await import('./sync')
    await syncUserSettings('github-user')

    const { getSettings, getSettingsUpdatedAt } = await import('./settings')
    expect(getSettings().rangerSnarecrafter).toBe(true)
    expect(getSettingsUpdatedAt()).toBe(20)
    expect(backend.from).toHaveBeenCalledWith('user_settings')
  })

  it('uses remote settings to resolve equal timestamps from legacy installs', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify({ rangerSnarecrafter: false })),
      setItem: vi.fn(),
    })
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { updated_at: 1, body: { rangerSnarecrafter: true } },
      error: null,
    })
    const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }))
    backend.from.mockReturnValue({ select, upsert: vi.fn() })

    const { syncUserSettings } = await import('./sync')
    await syncUserSettings('github-user')

    const { getSettings } = await import('./settings')
    expect(getSettings().rangerSnarecrafter).toBe(true)
  })

  it('pushes changed local settings when they are newer than remote settings', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }))
    const upsert = vi.fn().mockResolvedValue({ error: null })
    backend.from.mockReturnValue({ select, upsert })
    const { updateSettings } = await import('./settings')
    updateSettings({ rangerSnarecrafter: true })

    const { syncUserSettings } = await import('./sync')
    await syncUserSettings('github-user')

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'github-user',
      body: expect.objectContaining({ rangerSnarecrafter: true }),
    }))
  })
})
