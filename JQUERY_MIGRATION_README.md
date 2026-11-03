# jQuery Migration — COMPLETED

**Date Completed:** 2026-05-27

All jQuery and jQuery-lite dependencies have been removed from the browserLegacy project.
The build succeeds with zero errors and the Online.js bundle contains no jQuery code.

## Acceptance Criteria — All Passed

| AC | Description | Status |
|----|-------------|--------|
| AC1 | Zero files in `src/` requiring `Utils/jquery`, `Utils/jquery-lite`, or `Vendors/jquery-1.9.1` | PASS |
| AC2 | Build succeeds (`npm run build -- -O -T -H`), `dist/Web/Online.js` exists | PASS |
| AC3 | `Online.js` bundle contains no `"jquery-lite"` or `"jQuery JavaScript Library"` strings | PASS |
| AC4 | All viewer app configs and test HTML have no jquery path alias | PASS |
| AC5 | No `this.ui.find()` calls in `src/` | PASS |
| AC6 | `jquery-lite.js` deleted | PASS |

## Removed Files

- `src/Utils/jquery-lite.js` — deleted
- `src/Utils/jquery.js` — deleted (no-op stub removed)
- `src/Vendors/jquery.js` — deleted (no-op stub removed)

## Updated Build Config

- `applications/tools/builder-web.js` — removed `jquery: 'Utils/jquery-lite'` path
- `applications/tools/build/worker.js` — removed jquery path
- `applications/tools/tests/*.html` — removed jquery AMD path entries

## Key Patterns Reference

### Selector Replacement
```js
// Before
this.ui.find('.item')

// After
this.ui.querySelector('.item')
this.ui.querySelectorAll('.item')
```

### CSS Assignment
```js
// Before
this.ui.css({ top: 100, left: 200 });

// After
DOM.setCss(this.ui, { top: 100, left: 200 });
```

### Event Delegation
```js
// Before
this.ui.on('click', '.item', handler);

// After
DOM.addDelegatedEvent(this.ui, 'click', '.item', handler);
```

## Build Verification

```bash
npm run build -- -O -T -H
# Online.js has been created (~5300ms)
# Exit code: 0
```

## Early Detection (post-migration)

Catch incomplete migration patterns and login-flow regressions before manual QA:

```bash
npm run check:migration   # static scan for leftover jQuery / DOM footguns
npm run test:smoke        # jsdom smoke test (WinLogin init/onAppend wiring)
npm run check             # migration scan + smoke tests
npm run validate          # check + build Online bundle (-O -T -H)
```

`check:migration` flags patterns such as `.ui.find()`, jQuery method calls, assigning
`addEventListener` return values to variables, and jQuery-style method chaining.

`test:smoke` exercises the WinLogin server-selection → login screen path that previously
threw `Cannot set properties of undefined (setting 'value')`.

Manual QA is still required for full UI flows, networking, and renderer behavior.

## Note on Vendors/jquery-1.9.1.js

The legacy vendor file remains on disk but is no longer referenced by any AMD config or build entry point. It can be deleted in a follow-up cleanup if desired.
