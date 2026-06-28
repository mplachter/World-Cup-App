# Development Workflow

## Git Workflow

### Branches

- **`main`** — production; protected branch
  - All commits must pass CI (typecheck, lint, build)
  - GitHub Actions auto-deploys to GitHub Pages on push
  - Direct pushes disabled; use PRs only

- **Feature branches** — off main, named descriptively
  - `feature/bracket-projection`
  - `fix/espn-parsing`
  - `refactor/dom-helpers`

### Creating a Feature

```bash
# Start from main
git checkout main
git pull

# Create feature branch
git checkout -b feature/my-feature

# Make changes, test locally
npm run dev        # Test in browser
npm run typecheck  # Verify types
npm run lint       # Check linting
npm run build      # Test production build

# Commit with clear message
git add src/
git commit -m "Add new simulation feature

- Implement new algorithm
- Update UI to show results
- Cache results in localStorage"

# Push and create PR
git push -u origin HEAD
/pr                # Skill to open PR
```

### Commit Messages

**Format:** `<subject> + body (optional)`

Good examples:
- `Extract ESPN parsing into separate module`
- `Fix suspension logic for discipline block 3`
- `Improve bracket projection with Elo weighting`
- `Cache ESPN summaries forever for finalized games`
- `Add suspensions prefetch for upcoming matches`

**Don't:**
- `Fix bug` (what bug?)
- `Update code` (what changed?)
- `WIP` (commit something meaningful)

### Merging to Main

1. Push your branch: `git push -u origin HEAD`
2. Open PR: `/pr` skill
3. Wait for CI to pass (GitHub Actions)
4. If approved, merge via PR (use "Squash and merge" or "Create a merge commit" depending on branch cleanliness)
5. Delete branch after merge

---

## Running Locally

### Development Server

```bash
npm run dev
# Vite dev server with Hot Module Replacement (HMR)
# Opens http://localhost:5173
# Changes auto-reload in browser
```

### TypeScript Checking

```bash
npm run typecheck
# Runs tsc --noEmit
# Reports all type errors without building
# Use this while editing to catch issues early
```

### Linting

```bash
npm run lint
# Runs ESLint on src/
# Reports style issues (unused vars, unsafe patterns)
# Fix most issues automatically: eslint src --fix
```

### Production Build

```bash
npm run build
# Vite production build → dist/
# Includes minification, tree-shaking, base path injection (/World-Cup-App/)
# Always test the build locally before pushing:
npm run preview  # Serve dist/ on localhost
```

---

## Adding a Feature

### 1. Understand the Current State

Read the relevant modules:
- **Adding state?** Look at `src/state.ts`
- **Adding a view?** Look at `src/ui/*.ts`
- **Adding data logic?** Look at `src/data.ts`, `src/espn.ts`, `src/suspensions.ts`
- **Adding a utility?** Look at `src/constants.ts`

### 2. Decide Where It Lives

| Feature | Belongs in |
|---|---|
| New reactive store | `src/state.ts` |
| New view (schedule/groups/bracket/teams) | `src/ui/*.ts` (new file) |
| New calculation | `src/constants.ts` (small) or new module (complex) |
| New data source | `src/data.ts` or `src/espn.ts` |
| New domain logic | New module or existing domain module |

### 3. Create Types First

Add interfaces to `src/types.ts`:

```typescript
export interface MyFeature {
  id: string;
  name: string;
  value: number;
}
```

### 4. Implement the Logic

Create or modify the module. Import types and any dependencies:

```typescript
// src/myfeature.ts
import type { MyFeature } from './types';
import { createStore } from './store';

export const $myFeature = createStore<MyFeature[]>([]);

export function computeMyFeature(data: MatchData): MyFeature[] {
  return [...];
}
```

### 5. Add State (if needed)

Register stores in `src/state.ts`:

```typescript
export const $myFeature = createStore([]);
export const $myFeatureStatus = createStore('idle');
```

### 6. Add a UI Component (if needed)

Create in `src/ui/myfeature.ts`:

```typescript
import { div, span } from '../dom';
import type { MyFeature } from '../types';

export function myFeatureView(features: MyFeature[]) {
  return div({ className: 'my-feature' },
    features.map(f =>
      div({ className: 'item' }, f.name)
    )
  );
}
```

### 7. Wire It Up in `main.ts`

Import and initialize:

```typescript
import { computeMyFeature } from './myfeature';
import { $myFeature } from './state';

$data.sub(data => {
  if (data) {
    $myFeature.set(computeMyFeature(data));
  }
});
```

### 8. Test

```bash
npm run typecheck
npm run lint
npm run build
npm run dev  # Test in browser
```

---

## Refactoring

The codebase is modular, so refactoring is safe:

### Moving Code Between Files

1. Create new file with imports/exports
2. Update old file to remove code + add import from new file
3. Update any other files that imported from old file
4. `npm run typecheck` — should catch all import errors
5. `npm run build` — verify tree-shaking doesn't break anything

### Renaming a Variable

1. Use your editor's "Rename Symbol" refactoring
2. `npm run typecheck` — catches missed renames
3. `npm run lint` — checks for style issues

### Simplifying Logic

- Keep functions focused and small
- Extract complex conditionals into separate functions
- Use descriptive variable names
- Add a comment only if the WHY is non-obvious

---

## Debugging

### Enable Debug Mode

```typescript
// In browser console
window.__WC_DEBUG = true;
```

Logs internal state changes.

### Inspect ESPN Data

```typescript
// In browser console
window.__WC_ESPN_DUMPED = true;
// Logs raw ESPN responses to console when a match card expands
```

### Check localStorage

```javascript
// In browser console
localStorage;                    // View all keys
localStorage.getItem('wc2026:tab');  // Get a specific value
localStorage.clear();            // Clear all (careful!)
```

### Check Simulated Data

```typescript
// During a simulation, the $sim store contains:
$sim.get()
// {
//   status: 'running' | 'done',
//   data: bracketProjection,
//   trials: 5000,
//   completed: 2500,
//   elapsedMs: 1234
// }
```

---

## Performance

This is a small app, so performance is generally not a concern. But if you're adding a lot of data:

- **Avoid recomputing large lists** on every subscription update
- **Use `.filter()` / `.map()` only when data changes**, not on every render
- **Batch DOM updates** — don't append 1000 elements one by one
- **Lazy-load expensive data** — fetch ESPN details on card expand, not upfront

Example (lazy load):

```typescript
// In matchCard.ts
if (!detail) {
  loadEspnSummary(match.id).then(() => {
    // Detail loaded, subscription will trigger re-render
  });
}
```

---

## Testing Philosophy

No unit test framework is set up. Instead:

1. **Manual testing** in the browser (`npm run dev`)
2. **Type safety** from TypeScript (`npm run typecheck`)
3. **Linting** catches obvious mistakes (`npm run lint`)
4. **Build verification** ensures the code tree-shakes cleanly (`npm run build`)

If you're adding complex logic (like suspension calculation or bracket projection), test it manually:
1. Write the function
2. Call it in browser console with test data
3. Verify the output
4. If it's critical, add debug logs

---

## CI/CD

GitHub Actions runs automatically on every push and PR:

### CI Workflow (`.github/workflows/ci.yml`)

```
push/PR to main
  → typecheck (tsc)
  → lint (eslint)
  → build (vite)
  → ✓ All green? Merge allowed
  → ❌ Any failure? Merge blocked
```

### Deploy Workflow (`.github/workflows/deploy.yml`)

```
push to main (after merge)
  → build with GITHUB_ACTIONS=true (sets base path to /World-Cup-App/)
  → deploy to GitHub Pages
  → live at https://mplachter.github.io/World-Cup-App/
```

---

## Troubleshooting

### `npm install` fails
- Delete `node_modules/` and `package-lock.json`
- Run `npm install` again
- Ensure Node 18+ installed

### TypeScript errors after changes
- Run `npm run typecheck` to see all errors
- Check `src/types.ts` for the correct interface
- Cast with `as Type` if necessary (use sparingly)

### Linting errors
- Run `eslint src --fix` to auto-fix most
- Read the error message; usually clear

### Build fails
- Check the error message for which file
- Verify imports are correct
- Run `npm run typecheck` first to catch errors early

### App doesn't work locally
- Check browser console for errors (`F12`)
- Verify `npm run dev` is running
- Hard refresh (`Ctrl+Shift+R`)
- Check that localhost:5173 is open (not another port due to conflict)

### Data not loading
- Check Network tab in dev tools
- Verify CDN is reachable (GitHub Raw / jsDelivr)
- Check browser console for fetch errors
- Inspect `$data.get()` in console to see current state

---

## Useful Commands

```bash
# One-liner to dev, check, lint, and build
npm run dev & npm run typecheck && npm run lint && npm run build

# Auto-fix linting issues
eslint src --fix

# Check bundle size
npm run build  # See output size

# Reload TypeScript
# (sometimes needed if you changed types)
# Just re-run typecheck:
npm run typecheck
```
