# PF2E Tools

## Purpose and Capabilities

A free, offline-capable character builder for Pathfinder 2e and Starfinder 2e (the two rulesets are compatible; enable either or both).

- Installable PWA for laptop and Android
- Powerful homebrew: custom feats, weapons, armor, armor/weapon groups, spells, items, ancestries and classes
- Homebrew effects: senses (e.g. darkvision), bonuses, proficiencies, speeds, resistances, languages, extra feat slots, granted entries
- Automatic backup and cross-device sync via Google sign-in (Supabase)
- Homebrew import/export as JSON

## Status

Early development. Homebrew editor, local storage and sync are in place; the character builder flow and official rules data are not yet implemented.

## Point of Contacts

@aegorsuch

## Ports Required

HTTPS (443) to Supabase for sync. None otherwise.

## Equipment Required

A modern web browser (desktop or Android).

## Equipment Supported

Chrome/Edge/Firefox/Safari on desktop; Chrome on Android (installable as an app).

## Compilation

```
npm install
npm run dev     # development
npm run build   # production build in dist/
```

For sync, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, run `supabase/schema.sql` in your project, and enable the Google provider.

## Developer Notes

Stack: React, TypeScript, Vite, Dexie (IndexedDB), Supabase, vite-plugin-pwa. Sync is last-write-wins on `updatedAt`.

Official rules content must come from ORC-licensed sources.

## License

GPLv3. See [LICENSE](LICENSE).
