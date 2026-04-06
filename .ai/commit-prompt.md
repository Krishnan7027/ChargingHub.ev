# Commit Message Format

## Format
```
[type]: short description
```

## Types
- `feat` — New feature
- `fix` — Bug fix
- `refactor` — Code restructuring (no behavior change)
- `perf` — Performance improvement
- `test` — Adding/updating tests
- `docs` — Documentation changes
- `chore` — Build, config, dependency updates
- `style` — Formatting, no logic change

## Rules
- Keep subject line under 72 characters
- Use imperative mood ("add", not "added")
- No period at end of subject
- Body (optional): explain WHY, not WHAT

## Examples
```
feat: add battery health prediction endpoint
fix: resolve slot conflict detection in reservation service
refactor: extract pricing logic from charging controller to service
perf: add composite index for reservation schedule queries
test: add integration tests for auth flow
```
