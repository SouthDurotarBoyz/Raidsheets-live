# Gruul's Lair assets

This folder holds Gruul's Lair boss-sheet images.

## Folder layout

- Boss-specific images live under `assets/gruul/bosses/<boss-id>/`.
- Background images live under `assets/gruul/backgrounds/`.
- Do not store raid marker icons here; raid markers belong in `assets/shared/markers/`.

## File conventions

- Use lowercase kebab-case filenames.
- Prefer `.webp` for compressed sheet images unless PNG transparency/source quality is required.
- Do not inline base64 images in boss fragments.
- Boss fragments should reference images with root-relative paths like:
  `assets/gruul/bosses/maulgar/pre-pull.png`.
