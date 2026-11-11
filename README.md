# PF2E Tools

## Purpose and Capabilities

A free, offline-capable character builder for Pathfinder 2e and Starfinder 2e (the two rulesets are compatible; enable either or both).

- Installable PWA for laptop and Android
- Powerful homebrew: custom feats, weapons, armor, armor/weapon groups, spells, items, ancestries and classes
- Homebrew effects: senses (e.g. darkvision), bonuses, proficiencies, speeds, resistances, languages, extra feat slots, granted entries
- Automatic backup and cross-device sync through your own Google Drive (hidden app data folder, no server)
- Homebrew import/export as JSON

## Status

Early development. Homebrew editor, local storage and sync are in place; the character builder flow and official rules data are not yet implemented.

## Point of Contacts

@aegorsuch

## Ports Required

HTTPS (443) to Google (accounts.google.com, googleapis.com) for Drive sync. None otherwise.

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

For Drive sync, create a Google Cloud OAuth client ID (type Web application), add your site origin (e.g. `https://aegorsuch.github.io` and `http://localhost:5173`) under Authorized JavaScript origins, enable the Google Drive API, and set `VITE_GOOGLE_CLIENT_ID` (a GitHub Actions secret for the Pages deploy). The only scope requested is `drive.appdata`.

## Developer Notes

Stack: React, TypeScript, Vite, Dexie (IndexedDB), Google Drive appDataFolder, vite-plugin-pwa. Sync is last-write-wins on `updatedAt`.

Official (designer-made) content for both PF2e and SF2e is sourced from the Archives of Nethys (2e.aonprd.com and Starfinder's AoN). Respect Paizo's Community Use/ORC licensing and attribution terms when importing it. Homebrew entries are kept separate (`source: 'homebrew'`).

## License

GPLv3. See [LICENSE](LICENSE).
