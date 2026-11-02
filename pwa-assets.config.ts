// Icônes de la PWA (favicon, apple-touch-icon, icônes du manifeste, maskable), générées depuis
// public/app-icon.svg par `npm run icons`. Elles servent aussi à l'app Android (phase 7B).
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/** Couleur d'accent (--color-accent-fill) : fond des icônes maskable et Apple, sans bord visible. */
const ACCENT = '#0066cc';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: ACCENT } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: ACCENT } },
  },
  images: ['public/app-icon.svg'],
});
