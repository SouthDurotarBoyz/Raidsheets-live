# Serpentshrine Cavern Boss Images

This folder holds Serpentshrine Cavern boss-sheet images.

Boss-specific images live under `assets/ssc/bosses/<boss-id>/`.

## Naming conventions

- Use lowercase kebab-case filenames.
- Prefer `.webp` for compressed sheet images unless a source image requires PNG transparency.
- Do not store raid marker icons here; raid markers belong in `assets/shared/markers/`.
- Do not inline base64 images in boss fragments.
- Boss fragments should reference images with relative paths from the root page, for example:
  `assets/ssc/bosses/hydross/hydross-frost-positioning.webp`

## Suggested image names

- `hydross-frost-positioning.webp`
- `hydross-poison-positioning.webp`
- `lurker-phase-1-positioning.webp`
- `lurker-phase-2-adds.webp`
- `leotheras-humanoid-positioning.webp`
- `leotheras-demon-positioning.webp`
- `leotheras-split-positioning.webp`
- `karathress-stage-1-positioning.webp`
- `karathress-stage-3-caribdis-positioning.webp`
- `morogrim-phase-1-positioning.webp`
- `morogrim-phase-2-upper-platform.webp`
- `vashj-phase-1-positioning.webp`
- `vashj-phase-2-pylons.webp`
- `vashj-phase-3-burn.webp`
