// Thème de l'interface : automatique (celui du système), ou clair / sombre imposé par les Réglages.
import type { ThemePreference } from '../core/home-state';

export function applyTheme(theme: ThemePreference): void {
  const root = document.documentElement;
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;
}
