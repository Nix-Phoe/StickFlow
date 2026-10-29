import { EXPORT_FORMATS, type ExportFormat } from '../../../core/types';
import type { Component } from '../../component';
import { createSegmented } from '../../controls/segmented';
import { createSheet } from '../../controls/sheet';
import { h } from '../../dom';
import { icon } from '../../icons';
import { strings } from '../../strings';
import type { HomeContext } from './context';

const t = strings.home.exportSheet;

/** Feuille « Exporter » d'un projet enregistré (menu de sa carte) : format du fichier, avancement. */
export function createExportSheet({ bus, store }: HomeContext): Component {
  let format: ExportFormat = 'gif';
  let projectId: string | null = null;

  const formatControl = createSegmented<ExportFormat>({
    label: t.format,
    action: 'library:export',
    options: EXPORT_FORMATS.map((value) => ({ value, label: strings.panel.formats[value] })),
    value: format,
    onChange: (value) => {
      format = value;
      formatControl.setValue(value);
    },
  });
  const submitLabel = h('span', {}, [t.submit]);
  const submit = h('button', { type: 'button', class: 'button-primary', 'data-action': 'library:export' }, [icon('download'), submitLabel]);
  submit.addEventListener('click', () => {
    if (projectId) bus.emit('library:export', { projectId, format });
  });
  const cancel = h('button', { type: 'button', class: 'button-secondary', 'data-action': 'home:sheet' }, [t.cancel]);
  cancel.addEventListener('click', () => bus.emit('home:sheet', { sheet: null }));

  const sheet = createSheet({
    id: 'export-sheet',
    title: '',
    closeLabel: t.cancel,
    body: [h('div', { class: 'sheet__field' }, [h('span', { class: 'sheet__label' }, [t.format]), formatControl.element])],
    actions: [cancel, submit],
    onClose: () => bus.emit('home:sheet', { sheet: null }),
  });

  const stops = [
    store.watch(
      (s) => s.sheet,
      (value) => {
        projectId = value?.kind === 'export' ? value.projectId : null;
        const project = store.state.projects?.find((p) => p.id === projectId);
        sheet.title.textContent = project ? t.title(project.name) : '';
        sheet.setOpen(projectId !== null);
      },
    ),
    store.watch(
      (s) => s.exporting,
      (exporting) => {
        submit.disabled = exporting !== null;
        submitLabel.textContent = exporting ? strings.home.card.exporting(exporting.progress) : t.submit;
        // Export terminé avec succès : la feuille se referme (le message reste affiché).
        if (exporting === null && store.state.notice?.code === 'exported' && store.state.sheet?.kind === 'export') {
          bus.emit('home:sheet', { sheet: null });
        }
      },
    ),
  ];

  return {
    mount(parent) {
      parent.append(sheet.dialog);
    },
    destroy() {
      stops.forEach((stop) => stop());
      sheet.setOpen(false);
      sheet.dialog.remove();
    },
  };
}
