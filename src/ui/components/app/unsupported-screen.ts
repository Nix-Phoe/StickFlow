// Page « Navigateur non compatible » (v2.2) : montrée à la place de l'app quand WebGL 2 manque.

import { h } from '../../dom';
import { logo } from '../../logo';
import { strings } from '../../strings';

const t = strings.app.unsupported;

export function showUnsupportedScreen(root: HTMLElement): void {
  document.title = `${t.title} · ${strings.appName}`;
  root.replaceChildren(
    h('main', { class: 'app-screen', 'aria-labelledby': 'unsupported-title' }, [
      h('div', { class: 'app-screen__card' }, [
        logo('app-screen__logo'),
        h('h1', { class: 'app-screen__title', id: 'unsupported-title' }, [t.title]),
        h('p', { class: 'app-screen__text' }, [t.text]),
        h('p', { class: 'app-screen__text' }, [t.browsers]),
        h('ul', { class: 'app-screen__list' }, t.list.map((browser) => h('li', {}, [browser]))),
        h('p', { class: 'app-screen__hint' }, [t.hint]),
      ]),
    ]),
  );
}
