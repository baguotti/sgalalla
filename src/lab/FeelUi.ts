/**
 * Controls for the FEEL mode's panels, in the Lab's style (LabUi): a setting's
 * row has a slider, a box to type an exact value, and ↺ for its default; its
 * name turns yellow while it differs from the default.
 */
import { element } from '../lighting/lab/LabUi';
import type { Setting } from './FeelCatalog';
import { framesOf } from './FeelMeasure';

const STYLESHEET = `
.lab-panel .row.tune { grid-template-columns: 116px minmax(0, 1fr) 58px 18px; }
.lab-panel .row.tune .name { line-height: 1.15; }
.lab-panel .row.tune.changed .name { color: #f0c040; }
.lab-panel .row.tune .name small { color: #7d7d7d; margin-left: 3px; font-size: 10px; }
.lab-panel input.num { width: 100%; font: inherit; font-size: 11px; color: #e0e0e0; background: #161616;
    border: 1px solid #3a3a3a; border-radius: 3px; padding: 0 3px; text-align: right; -moz-appearance: textfield; }
.lab-panel input.num::-webkit-inner-spin-button { display: none; }
.lab-panel input.num:focus, .lab-panel input.find:focus, .lab-dialog textarea:focus { outline: 1px solid #8bef8b; }
.lab-panel input.find { width: 100%; font: inherit; font-size: 11px; color: #e0e0e0; background: #161616;
    border: 1px solid #3a3a3a; border-radius: 4px; padding: 2px 6px; margin: 4px 0; }
.lab-panel .readout { font-size: 11px; line-height: 1.45; color: #cfcfcf; white-space: pre-wrap; font-variant-numeric: tabular-nums; }
.lab-panel .readout b { color: #8bef8b; font-weight: normal; }
.lab-panel .note { font-size: 10px; color: #f0c040; line-height: 1.4; margin: 3px 0; }
.lab-mode { position: fixed; bottom: 8px; left: 50%; transform: translateX(-50%); z-index: 1001; display: flex; align-items: center; gap: 3px;
    font: 12px/1.5 "Pixeloid Sans", monospace; background: rgba(10, 10, 10, 0.7); border: 1px solid rgba(51, 51, 51, 0.8);
    border-radius: 6px; padding: 3px; color: #9e9e9e; }
.lab-mode button { font: inherit; color: #e0e0e0; background: transparent; border: 1px solid transparent; border-radius: 4px; padding: 1px 10px; cursor: pointer; }
.lab-mode button.on { color: #101010; background: #8bef8b; }
.lab-mode span { padding: 0 6px 0 4px; font-size: 10px; }
.lab-dialog { position: fixed; inset: 0; z-index: 1002; display: grid; place-items: center; background: rgba(0, 0, 0, 0.5); }
.lab-dialog .box { width: min(560px, calc(100vw - 32px)); display: grid; gap: 8px; padding: 12px; border-radius: 6px;
    background: rgba(10, 10, 10, 0.92); border: 1px solid #3a3a3a; color: #e0e0e0; font: 12px/1.5 "Pixeloid Sans", monospace; }
.lab-dialog textarea { width: 100%; height: 260px; box-sizing: border-box; font: 11px/1.4 Menlo, monospace; color: #e0e0e0;
    background: #161616; border: 1px solid #3a3a3a; border-radius: 4px; padding: 6px; resize: vertical; }
.lab-dialog .buttons { display: flex; gap: 6px; justify-content: flex-end; align-items: center; }
.lab-dialog .buttons span { margin-right: auto; color: #f0c040; font-size: 11px; }
.lab-dialog button { font: inherit; font-size: 11px; color: #e0e0e0; background: #161616; border: 1px solid #3a3a3a; border-radius: 4px; padding: 2px 10px; }
.lab-dialog button:hover { border-color: #8bef8b; }
`;

let styleAdded = false;

export function addFeelStyles(): void {
    if (styleAdded) return;
    document.head.append(element('style', STYLESHEET));
    styleAdded = true;
}

/** A setting's row; `refresh` re-reads its value (after a reset or a paste). */
export interface TuneRow {
    node: HTMLElement;
    refresh(): void;
    /** Its label and hint, for the find box. */
    text: string;
}

/**
 * A numeric setting: `get` and `set` reach its live value, `fallback` is its
 * default. `onChange` runs when a change is done (slider let go, value typed).
 */
export function tuneRow(setting: Setting, range: readonly [number, number, number], get: () => number, set: (value: number) => void,
    fallback: number, onChange: () => void): TuneRow {
    const [min, max, step] = range;
    const node = element('label');
    node.className = 'row tune';
    const name = element('span', setting.label);
    name.className = 'name';
    const note = element('small');
    name.append(note);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);

    const box = document.createElement('input');
    box.type = 'number';
    box.step = 'any';
    box.className = 'num';

    const reset = element('button', '↺') as HTMLButtonElement;
    reset.className = 'reset';
    reset.type = 'button';

    const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
    const show = (value: number, typing = false) => {
        slider.value = String(value);
        if (!typing) box.value = String(Number(value.toFixed(decimals)) === value ? value.toFixed(decimals) : value);
        node.classList.toggle('changed', value !== fallback);
        note.textContent = setting.unit === 'ms' ? `${framesOf(value)}f` : setting.unit === 'steps' ? `${Math.round(value * 16.7)}ms` : '';
    };
    node.title = `${setting.hint ? setting.hint + '\n' : ''}Default: ${fallback}${setting.unit && setting.unit !== 'times' && setting.unit !== 'share' ? ' ' + setting.unit : ''}`;

    slider.addEventListener('input', () => {
        set(Number(slider.value));
        show(Number(slider.value));
    });
    slider.addEventListener('change', () => {
        onChange();
        slider.blur();
    });
    box.addEventListener('input', () => {
        const value = Number(box.value);
        if (box.value === '' || !Number.isFinite(value)) return;
        set(value);
        show(value, true);
    });
    box.addEventListener('change', () => {
        show(get());
        onChange();
    });
    box.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === 'Escape') box.blur();
    });
    reset.addEventListener('click', event => {
        event.preventDefault();
        set(fallback);
        show(fallback);
        onChange();
        reset.blur();
    });

    node.append(name, slider, box, reset);
    show(get());
    return { node, refresh: () => show(get()), text: `${setting.label} ${setting.hint ?? ''} ${setting.key}`.toLowerCase() };
}

/** A yes/no setting with ↺, the same shape as a numeric row. */
export function toggleRow(label: string, get: () => boolean, set: (value: boolean) => void, fallback: boolean, onChange: () => void): TuneRow {
    const node = element('label');
    node.className = 'row tune';
    const name = element('span', label);
    name.className = 'name';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.style.justifySelf = 'start';
    const reset = element('button', '↺') as HTMLButtonElement;
    reset.className = 'reset';
    reset.type = 'button';
    const show = () => {
        input.checked = get();
        node.classList.toggle('changed', input.checked !== fallback);
    };
    input.addEventListener('change', () => {
        set(input.checked);
        show();
        onChange();
        input.blur();
    });
    reset.addEventListener('click', event => {
        event.preventDefault();
        set(fallback);
        show();
        onChange();
    });
    node.append(name, input, element('span'), reset);
    show();
    return { node, refresh: show, text: label.toLowerCase() };
}

/** A box over the page for pasting settings in; `apply` returns a message to show, or null to close. */
export function pasteDialog(title: string, apply: (text: string) => string | null): void {
    addFeelStyles();
    const dialog = element('div');
    dialog.className = 'lab-dialog';
    const box = element('div');
    box.className = 'box';
    const area = document.createElement('textarea');
    area.placeholder = 'Paste the settings JSON here';
    const message = element('span');
    const close = () => dialog.remove();
    const cancel = element('button', 'Cancel');
    cancel.addEventListener('click', close);
    const ok = element('button', 'Apply');
    ok.addEventListener('click', () => {
        const result = apply(area.value);
        if (result === null) close();
        else message.textContent = result;
    });
    const buttons = element('div');
    buttons.className = 'buttons';
    buttons.append(message, cancel, ok);
    box.append(element('div', title), area, buttons);
    dialog.append(box);
    // Keys typed here stay here
    for (const type of ['keydown', 'keyup'] as const) {
        dialog.addEventListener(type, event => {
            event.stopPropagation();
            if (type === 'keydown' && (event as KeyboardEvent).key === 'Escape') close();
        });
    }
    dialog.addEventListener('pointerdown', event => {
        if (event.target === dialog) close();
    });
    document.body.append(dialog);
    area.focus();
}
