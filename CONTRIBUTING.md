# Contributing

Thanks for helping improve the Leadsets TypeScript SDK.

## Development

You need Node.js 20 or newer for the tooling (the published package supports Node.js 18+).

```bash
git clone https://github.com/leadsets/sdk.git
cd sdk
npm install
npm run check      # lint, typecheck, build and test
```

Individual steps:

```bash
npm run lint       # Biome
npm run format     # Biome, writing fixes
npm run typecheck  # tsc for src, tests and examples
npm run build      # tsup: ESM + CJS + .d.ts in dist/
npm test           # vitest
```

Tests use a mocked `fetch` only. They never call the live API and need no key.

## Pull requests

- Open an issue first for anything larger than a small fix, so we can agree on the approach.
- Keep each pull request to one change, with tests.
- Keep the package free of runtime dependencies and working on edge runtimes (no Node.js built-ins in `src/`).
- Update `CHANGELOG.md` under an "Unreleased" heading.
- Never commit API keys or `.env` files.

## Releases

Maintainers release by bumping `version` in `package.json` and `src/version.ts`, updating the
changelog, and pushing a `vX.Y.Z` tag. The release workflow publishes to npm.

## Code of conduct

Be kind and constructive. We may remove comments or contributions that aren't.
