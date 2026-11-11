import { describe, expect, it } from 'vitest'
import { validateSupabaseKey } from './supabaseConfig'

const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role }))}.signature`

describe('Supabase frontend keys', () => {
  it('accepts publishable and legacy anon keys', () => {
    expect(() => validateSupabaseKey('sb_publishable_test')).not.toThrow()
    expect(() => validateSupabaseKey(jwt('anon'))).not.toThrow()
  })

  it('rejects secret and legacy service-role keys', () => {
    expect(() => validateSupabaseKey('sb_secret_test')).toThrow('must never be used in the frontend')
    expect(() => validateSupabaseKey(jwt('service_role'))).toThrow('must never be used in the frontend')
  })

  it('rejects malformed keys and user tokens', () => {
    expect(() => validateSupabaseKey('not-a-key')).toThrow('Invalid Supabase public API key')
    expect(() => validateSupabaseKey(jwt('authenticated'))).toThrow('must be publishable or legacy anon')
  })
})
