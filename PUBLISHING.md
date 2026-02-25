# Publishing to GitHub and Gemini CLI Extensions

This repo is already structured for Gemini CLI extension discovery (`gemini-extension.json` at repo root).

## One-time repository setup

1. Make the GitHub repository public.
2. Add GitHub topic: `gemini-cli-extension`.
3. Ensure Actions are enabled for the repository.

## Release process

1. Bump versions to the same value in:
   - `package.json`
   - `gemini-extension.json`
2. Commit and push to `main`.
3. Create and push a tag in `vX.Y.Z` format:

```bash
git tag v0.1.1
git push origin v0.1.1
```

4. GitHub Actions workflow `.github/workflows/release-extension.yml` runs automatically:
   - `npm ci`
   - build + tests
   - version consistency check (tag vs both version files)
   - release archive creation (`.tar.gz` and `.zip`)
   - GitHub Release publication with assets

## What gets packaged in release assets

- `gemini-extension.json`
- `README.md`
- `LICENSE`
- `hooks/hooks.json`
- `commands/**`
- `dist/**`

## Gemini CLI install examples

Install from repository:

```bash
gemini extensions install owner/repo
```

Install pinned to a tag:

```bash
gemini extensions install owner/repo --ref v0.1.1
```

After release + topic setup, the extension can be indexed by extension directories/crawlers that track Gemini CLI extension repos.
