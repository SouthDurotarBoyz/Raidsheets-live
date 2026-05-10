# Gruul's Lair Main Package

Open `roster.html`, `maulgar.html`, or `gruul.html` from this same folder.

Required structure:

```text
roster.html
maulgar.html
gruul.html
asset-manifest.json
README.md
assets/
  gruul/
    bosses/
      maulgar/
        pre-pull.png
        raid-position.png
      gruul/
        gruul-positioning.png
    backgrounds/
      gruul-background.jpg
      magtheridon-background.webp
  shared/
    markers/
```

Do not move `gruul.html` away from the `assets` folder. Gruul references `assets/gruul/backgrounds/gruul-background.jpg` and `assets/gruul/bosses/gruul/gruul-positioning.png`.
