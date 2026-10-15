/**
 * The Studio Lab's HTML controls, styled like the in-game debug panel (top
 * left): dark translucent boxes, Pixeloid Sans, green and yellow accents.
 * Every slider and colour has a ↺ button that puts its default back.
 */

/** A docked column's width (windowed view), panels included. */
export const DOCK_WIDTH = 344;

const STYLESHEET = `
.lab-panel { position: fixed; z-index: 1000; width: 330px; max-height: calc(100vh - 16px); display: flex; flex-direction: column;
    box-sizing: border-box; border-radius: 6px; background: rgba(10, 10, 10, 0.7); border: 1px solid rgba(51, 51, 51, 0.8);
    color: #e0e0e0; font: 12px/1.5 "Pixeloid Sans", monospace; }
.lab-panel * { box-sizing: border-box; }
.lab-panel .title { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; cursor: move;
    color: #8bef8b; letter-spacing: 0.06em; user-select: none; border-bottom: 1px solid rgba(51, 51, 51, 0.8); }
.lab-panel.folded .title { border-bottom: none; }
.lab-panel.folded .body, .lab-panel.folded .footer { display: none; }
.lab-panel .body { overflow-y: auto; overflow-x: hidden; padding: 4px 10px 8px; }
.lab-panel .hint { color: #9e9e9e; font-size: 10px; line-height: 1.4; margin: 2px 0; }
.lab-panel details { border-top: 1px solid rgba(51, 51, 51, 0.8); padding: 3px 0; }
.lab-panel summary { cursor: pointer; padding: 3px 0; color: #f0c040; letter-spacing: 0.05em; }
.lab-panel .row { display: grid; grid-template-columns: 124px minmax(0, 1fr) 40px 18px; gap: 6px; align-items: center; min-height: 21px; }
.lab-panel .row input[type=range] { width: 100%; margin: 0; accent-color: #8bef8b; }
.lab-panel .value { text-align: right; color: #e0e0e0; font-variant-numeric: tabular-nums; }
.lab-panel .buttons { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 4px 0; }
.lab-panel button, .lab-panel select { font: inherit; font-size: 11px; color: #e0e0e0; background: #161616; border: 1px solid #3a3a3a;
    border-radius: 4px; padding: 1px 7px; }
.lab-panel button:hover:not(:disabled) { background: #262626; border-color: #8bef8b; }
.lab-panel button:disabled { color: #555; }
.lab-panel button.reset { padding: 0; width: 18px; height: 18px; line-height: 16px; color: #9e9e9e; }
.lab-panel input[type=color] { width: 100%; height: 20px; padding: 0 2px; border: 1px solid #3a3a3a; border-radius: 4px; background: #161616; }
.lab-panel label.check { display: flex; gap: 6px; align-items: center; margin: 3px 0; }
.lab-panel .stop { border-top: 1px solid rgba(51, 51, 51, 0.8); padding-top: 3px; margin-top: 3px; }
.lab-panel .footer { display: flex; gap: 6px; padding: 6px 10px; border-top: 1px solid rgba(51, 51, 51, 0.8); }
.lab-dock { position: fixed; top: 0; bottom: 0; z-index: 1000; width: ${DOCK_WIDTH}px; box-sizing: border-box; padding: 8px 7px;
    overflow-y: auto; display: flex; flex-direction: column; gap: 6px; background: #0b0b0d; scrollbar-width: thin; }
.lab-dock.left { left: 0; border-right: 1px solid #222; }
.lab-dock.right { right: 0; border-left: 1px solid #222; }
.lab-panel.docked { position: relative; top: auto !important; left: auto !important; right: auto !important; width: 100%; max-height: none; flex: none; }
.lab-panel.docked .title { cursor: pointer; }
.lab-panel.docked .body { overflow: visible; }
`;

let styleAdded = false;

/**
 * A floating panel: drag its title bar to move it, click the title to fold it.
 * `left` or `right` places it (px from that edge), `top` from the top, and
 * `folded` starts it folded. Where it's been moved and whether it's folded are
 * kept in the browser, by title.
 */
export class LabPanelBox {
    readonly root = document.createElement('div');
    readonly body = document.createElement('div');
    readonly footer = document.createElement('div');
    private readonly titleText: HTMLElement;

    private readonly storageKey: string;
    private readonly setFoldedLook: (folded: boolean) => void;

    constructor(title: string, place: { top: number; left?: number; right?: number; folded?: boolean }) {
        if (!styleAdded) {
            document.head.append(element('style', STYLESHEET));
            styleAdded = true;
        }
        this.root.className = 'lab-panel';
        this.root.style.top = `${place.top}px`;
        if (place.left !== undefined) this.root.style.left = `${place.left}px`;
        else this.root.style.right = `${place.right ?? 8}px`;
        this.body.className = 'body';
        this.footer.className = 'footer';
        this.storageKey = `sgalalla.labPanel.${title}`;

        const bar = element('div');
        bar.className = 'title';
        const fold = element('span', '–');
        this.titleText = element('span', title);
        bar.append(this.titleText, fold);
        const setFolded = this.setFoldedLook = (folded: boolean) => {
            this.root.classList.toggle('folded', folded);
            fold.textContent = folded ? '+' : '–';
        };
        this.makeMovable(bar, () => {
            setFolded(!this.root.classList.contains('folded'));
            this.remember();
        });

        const saved = this.recall();
        setFolded(saved?.folded ?? place.folded ?? false);
        if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
            this.root.style.right = '';
            this.root.style.left = `${Math.max(0, Math.min(window.innerWidth - 60, saved.left))}px`;
            this.root.style.top = `${Math.max(0, Math.min(window.innerHeight - 30, saved.top))}px`;
        }

        this.root.append(bar, this.body, this.footer);
        document.body.append(this.root);

        // Typing in a text or number box doesn't reach the game's keys (Phaser listens on the window)
        for (const type of ['keydown', 'keyup'] as const) {
            this.root.addEventListener(type, event => {
                const target = event.target as HTMLElement;
                if (target.matches('input[type=number], input[type=text], input[type=search], textarea')) event.stopPropagation();
            });
        }
    }

    get isFolded(): boolean {
        return this.root.classList.contains('folded');
    }

    setFolded(folded: boolean): void {
        if (folded === this.isFolded) return;
        this.setFoldedLook(folded);
        this.remember();
    }

    /** Position (once moved) and fold, in the browser. */
    private remember(): void {
        const moved = this.root.style.left !== '';
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                folded: this.root.classList.contains('folded'),
                ...(moved ? { left: parseFloat(this.root.style.left), top: parseFloat(this.root.style.top) } : {}),
            }));
        } catch {
            // Browser storage unavailable: the layout lasts until the page reloads
        }
    }

    private recall(): { folded?: boolean; left?: number; top?: number } | null {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey) ?? 'null');
        } catch {
            return null;
        }
    }

    /** Into a column of the windowed view, or back to floating where it was (null). */
    dock(column: HTMLElement | null): void {
        this.root.classList.toggle('docked', column !== null);
        (column ?? document.body).append(this.root);
    }

    setTitle(title: string): void {
        this.titleText.textContent = title;
    }

    setVisible(visible: boolean): void {
        this.root.style.display = visible ? '' : 'none';
    }

    get isVisible(): boolean {
        return this.root.style.display !== 'none';
    }

    destroy(): void {
        this.root.remove();
    }

    /** Dragging the bar moves the panel; a click without dragging calls `onClick`. */
    private makeMovable(bar: HTMLElement, onClick: () => void): void {
        bar.addEventListener('pointerdown', down => {
            const rect = this.root.getBoundingClientRect();
            let moved = false;
            bar.setPointerCapture(down.pointerId);
            const onMove = (move: PointerEvent) => {
                // Docked panels stay in their column
                if (this.root.classList.contains('docked')) return;
                const dx = move.clientX - down.clientX;
                const dy = move.clientY - down.clientY;
                if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
                moved = true;
                this.root.style.right = '';
                this.root.style.left = `${Math.max(0, Math.min(window.innerWidth - 60, rect.left + dx))}px`;
                this.root.style.top = `${Math.max(0, Math.min(window.innerHeight - 30, rect.top + dy))}px`;
            };
            const onUp = () => {
                bar.removeEventListener('pointermove', onMove);
                bar.removeEventListener('pointerup', onUp);
                if (moved) this.remember();
                else onClick();
            };
            bar.addEventListener('pointermove', onMove);
            bar.addEventListener('pointerup', onUp);
        });
    }
}

export function element(tag: string, text = ''): HTMLElement {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
}

export function hint(text: string): HTMLElement {
    const node = element('div', text);
    node.className = 'hint';
    return node;
}

/** A section that folds away under its title; it remembers being open across rebuilds by title. */
export function section(title: string, open: boolean, ...children: HTMLElement[]): HTMLElement {
    const node = document.createElement('details');
    node.open = open;
    node.append(element('summary', title), ...children);
    return node;
}

/** Titles of the open sections under `root`, to keep them open when it's rebuilt. */
export function openSections(root: HTMLElement): Set<string> {
    return new Set([...root.querySelectorAll('details[open] > summary')].map(node => node.textContent ?? ''));
}

export function buttons(...children: HTMLElement[]): HTMLElement {
    const node = element('div');
    node.className = 'buttons';
    node.append(...children);
    return node;
}

export function button(text: string, onClick: () => void): HTMLButtonElement {
    const node = element('button', text) as HTMLButtonElement;
    node.addEventListener('click', () => {
        onClick();
        node.blur();
    });
    return node;
}

export function checkbox(text: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => {
        onChange(input.checked);
        input.blur();
    });
    const label = element('label', text);
    label.className = 'check';
    label.prepend(input);
    return label;
}

/** A label, a control, room for a value, and a reset button (or an empty cell). */
export function row(label: string, control: HTMLElement, value: HTMLElement = element('span'), reset: HTMLElement = element('span')): HTMLElement {
    const node = element('label');
    node.className = 'row';
    value.className = 'value';
    node.append(element('span', label), control, value, reset);
    return node;
}

function resetButton(onClick: () => void): HTMLButtonElement {
    const node = button('↺', onClick);
    node.className = 'reset';
    node.title = 'Back to the default';
    return node;
}

/**
 * A slider for `name` (shown as a label: `rimWidth` → `Rim width`). `onInput`
 * follows it as it moves, `onChange` runs when it's let go or reset. With a
 * `fallback`, ↺ puts that value back.
 */
export function slider(name: string, [min, max, step]: readonly number[], initial: number,
    onInput: (value: number) => void, onChange: () => void, fallback?: number): HTMLElement {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(initial);
    const value = element('span', formatValue(initial, step));
    const set = (next: number) => {
        onInput(next);
        value.textContent = formatValue(next, step);
    };
    input.addEventListener('input', () => set(Number(input.value)));
    // Save, and hand the arrow keys back to the game
    input.addEventListener('change', () => {
        onChange();
        input.blur();
    });
    const reset = fallback === undefined ? undefined : resetButton(() => {
        input.value = String(fallback);
        set(fallback);
        onChange();
    });
    return row(labelFor(name), input, value, reset);
}

/** A colour picker row; with a `fallback`, ↺ puts that colour back. */
export function colourRow(label: string, initial: number, onInput: (color: number) => void, onChange: () => void, fallback?: number): HTMLElement {
    const input = colourInput(initial, onInput, onChange);
    const reset = fallback === undefined ? undefined : resetButton(() => {
        input.value = colorToHex(fallback);
        onInput(fallback);
        onChange();
    });
    return row(label, input, element('span'), reset);
}

export function colourInput(initial: number, onInput: (color: number) => void, onChange: () => void): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = colorToHex(initial);
    input.addEventListener('input', () => onInput(parseInt(input.value.slice(1), 16)));
    input.addEventListener('change', () => {
        onChange();
        input.blur();
    });
    return input;
}

/** A dropdown row. */
export function choice(label: string, options: readonly [string, string][], selected: string, onChange: (value: string) => void): HTMLElement {
    const select = document.createElement('select');
    select.style.width = '100%';
    for (const [value, text] of options) {
        const option = element('option', text) as HTMLOptionElement;
        option.value = value;
        option.selected = value === selected;
        select.append(option);
    }
    select.addEventListener('change', () => {
        onChange(select.value);
        select.blur();
    });
    return row(label, select);
}

export function colorToHex(color: number): string {
    return '#' + color.toString(16).padStart(6, '0');
}

/** `rimWidth` → `Rim width`. */
function labelFor(key: string): string {
    const words = key.replace(/([A-Z])/g, ' $1').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatValue(value: number, step: number): string {
    const decimals = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)));
    return value.toFixed(decimals);
}
