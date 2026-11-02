// Pages publiques (v2.2) : Confidentialité, À propos, page introuvable. Leur texte est dans le HTML
// (lisible sans JavaScript) ; ce script applique le thème choisi dans l'app et affiche la version.
import '../ui/styles/tokens.css';
import '../ui/styles/base.css';
import './page.css';

import { normalizePreferences } from '../core/home-state';
import { createLocalPreferences } from '../storage/preferences';
import { applyTheme } from '../ui/theme';

applyTheme(normalizePreferences(createLocalPreferences().load()).theme);
for (const element of document.querySelectorAll('[data-version]')) element.textContent = __APP_VERSION__;
