# Tempest Keep assets

This folder holds Tempest Keep boss-sheet images.

## Folder layout

- Boss-specific images live under `assets/tk/bosses/<boss-id>/`.
- Background images live under `assets/tk/backgrounds/`.
- Do not store raid marker icons here; raid markers belong in `assets/shared/markers/`.

## File conventions

- Use lowercase kebab-case filenames.
- Prefer `.webp` for compressed sheet images unless `.png` transparency is required.
- Do not inline base64 images in boss fragments.
- Boss fragments should reference images with relative paths from the root page, for example:
  `assets/tk/bosses/alar/alar-phase-1-positioning.webp`.

## Suggested image names

- `alar-phase-1-positioning.webp`
- `alar-phase-2-positioning.webp`
- `void-reaver-positioning.webp`
- `solarian-phase-1-positioning.webp`
- `solarian-add-phase-positioning.webp`
- `kaelthas-phase-1-advisors.webp`
- `kaelthas-phase-2-weapons.webp`
- `kaelthas-phase-3-positioning.webp`
- `kaelthas-phase-4-positioning.webp`
