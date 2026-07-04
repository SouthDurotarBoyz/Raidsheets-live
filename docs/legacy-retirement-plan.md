# Legacy Retirement Plan Status

This document is the concise status pointer for the legacy cleanup sequence. It is not the full historical plan and does not request more runtime migration work.

## Status

| Task | Status |
| --- | --- |
| Task 1 | Completed and merged: removed dead Gruul alias fallbacks. |
| Task 2 | Completed and merged: normalized the Gruul boss shell. |
| Task 3 | Completed and merged: removed eager storage key capture. |
| Task 4 | Completed and merged: required explicit raid identity and metadata-driven page roles. |
| Task 5 | Completed and merged: made soft reserve session-aware and anchor-based. |
| Task 6 | Completed and merged: made raid navigation use metadata roster routes. |
| Task 7 | Completed and merged: retired Gruul legacy field migration. |
| Task 8 | Completed and merged: retired `?key=` edit-token compatibility. |
| Task 9 | Current docs truth pass: update docs only so they match the completed cleanup sequence. |

## Current invariants

- Public filenames and public URLs were preserved.
- Local roster mode remains supported.
- The API route prefix remains `/api`.
- `?session=`, `?edit=`, and `#roster=` remain supported where their page flows use them.
- `?key=` edit-token compatibility is retired. A write request with only `?key=` is rejected.
- The docs truth pass must not change runtime code.
