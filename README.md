# PF2E Tools

## Purpose and Capabilities

A free, offline-capable character builder for Pathfinder 2e and Starfinder 2e (the two rulesets are compatible; enable either or both).

- Installable PWA for laptop and Android
- Powerful homebrew: custom feats, weapons, armor, armor/weapon groups, spells, items, ancestries and classes
- Homebrew effects: senses (e.g. darkvision), bonuses, proficiencies, speeds, resistances, languages, extra feat slots, granted entries
- Automatic backup and cross-device sync of characters, homebrew and settings via Supabase, with sign-in by email link or GitHub
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

For sync, create a free Supabase project, run `supabase/schema.sql` in its SQL editor, and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (GitHub Actions secrets for the Pages deploy). Enable the Email provider (on by default) and optionally the GitHub provider, and add the site URL (e.g. `https://aegorsuch.github.io/pf2e-tools/`) under Authentication → URL Configuration. Existing Supabase projects must also run the `user_settings` table and row-level security statements from `supabase/schema.sql` to enable settings sync.

For GitHub sign-in, register a GitHub OAuth application with callback URL `https://<project-ref>.supabase.co/auth/v1/callback`. Save its Client ID and Client Secret in Supabase's GitHub provider settings and enable the provider. Set both Supabase's Site URL and an allowed Redirect URL to `https://aegorsuch.github.io/pf2e-tools/`; otherwise sign-in can redirect to the default `localhost:3000`. Keep the OAuth secret in Supabase, never in the frontend.

After adding Actions secrets, rerun the deploy. A successful sign-in shows **Sign out**, even for accounts without an email address. **Sync** reports errors instead of claiming success when signed out. Confirm character, homebrew and settings changes appear in a second signed-in browser; official AoN content is not synced.

`VITE_SUPABASE_ANON_KEY` accepts a modern `sb_publishable_` key or a legacy JWT with role `anon`. Never use an `sb_secret_` or `service_role` key: Vite embeds these values in public JavaScript. The build rejects privileged keys. Revoke any privileged key previously deployed, even after replacing the repository secret.

## Developer Notes

Stack: React, TypeScript, Vite, Dexie (IndexedDB), Supabase, vite-plugin-pwa. Character and homebrew sync is last-write-wins on `updatedAt`; settings sync is last-write-wins on its local update timestamp.

Installed Windows apps can reload with Ctrl+R or the header's **Refresh** button. Refresh checks for app updates before reloading; offline, it reloads the cached app. Saved characters and settings are not cleared.

Official (designer-made) content for both PF2e and SF2e is sourced from the Archives of Nethys (2e.aonprd.com and Starfinder's AoN). Respect Paizo's Community Use/ORC licensing and attribution terms when importing it. Homebrew entries are kept separate (`source: 'homebrew'`).

Feat repeatability is imported from AoN's special rules; homebrew feats can be marked repeatable. Warden feats offer distinct spell choices and grant those spells while the feat remains selected. Other repeatable feats can record a text choice; their effects are not applied automatically.

## License

GPLv3. See [LICENSE](LICENSE).
