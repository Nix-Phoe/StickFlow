// Page « À propos » : la liste des bibliothèques livrées et de leurs licences, calculée au build.
import './page';

import licenses from 'virtual:licenses';

import { h } from '../ui/dom';

const list = document.querySelector('#licenses');
list?.replaceChildren(
  ...licenses.map(({ name, version, license, author, url, text }) =>
    h('li', { class: 'license' }, [
      h('p', { class: 'license__name' }, [url ? h('a', { href: url, rel: 'noopener' }, [name]) : name, h('span', { class: 'license__version' }, [` ${version}`])]),
      h('p', { class: 'license__meta' }, [[license, author].filter(Boolean).join(' · ')]),
      ...(text ? [h('details', { class: 'license__details' }, [h('summary', {}, ['Texte de la licence']), h('pre', { class: 'license__text' }, [text])])] : []),
    ]),
  ),
);
