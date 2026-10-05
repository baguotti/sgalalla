import Phaser from 'phaser';
import { button, buttons, choice, colorToHex, colourInput, element, hint, LabPanelBox, section } from '../../lighting/lab/LabUi';
import { addFeelStyles, pasteDialog, toggleRow, tuneRow, type TuneRow } from '../../lab/FeelUi';
import type { Setting, Unit } from '../../lab/FeelCatalog';
import { WindowedView } from '../../lab/StudioLab';
import { groundMove, screenX, screenY } from './DonutIso';
import {
    DEFAULT_LAMPS, LAMP_RANGES, LAMPS, MAX_LAMPS, NEW_LAMP, TIMES_OF_DAY, TIME_NAMES, applyTimeOfDay, currentTimeOfDay, lampsAreDefault, resetLamps,
    type LampDef,
} from './DonutLight';
import { DonutLighting } from './DonutLighting';
import { DONUT, createDonut, topSpeed, type DonutState } from './DonutSim';
import {
    BALANCE_GROUPS, CAMERA_GROUPS, CAR_GROUPS, DRIVING_GROUPS, EFFECTS_GROUPS, FEEL_TAB_GROUPS, HUD_GROUPS, LIGHT_GROUPS, LOOK_TAB_GROUPS,
    PEOPLE_GROUPS, SOUND_GROUPS, allDonutSettings, applyDonutChanges, changeCount, donutChanges, resetDonutTuning, resetSetting,
    setSetting, settingChanged, settingDefault, settingValue, type DonutGroup, type DonutSetting,
} from './DonutTuning';

/**
 * The DERAPATE Lab (L in the game): every setting of the mini-game live, in
 * the Studio Lab's style, in two tabs (TAB switches): LOOK, how it looks and
 * sounds (the lights and lamps, the camera's picture and view, the car, the
 * smoke and marks, the HUD, the sound), and FEEL, how it plays (a short list
 * in clear units). The game sits in the middle with the panels docked either
 * side; the TEST panel (restart, freeze, step, slow motion, readouts, the
 * car's live values, find, copy and paste) is in both tabs. Changes are kept
 * in this browser and used whenever DERAPATE runs here; Copy changes puts
 * only what differs from the defaults on the clipboard. Left open, it opens
 * again next time DERAPATE starts.
 * Keys while it's open: TAB the other tab, G lights on/off, F freeze, N next step.
 */

/** What the Lab needs from the game. */
export interface DonutLabHost {
    /** The game now (a new one after each restart). */
    state(): DonutState;
    /** Testacodas, overheats and people hit since the last restart. */
    readonly stats: { spins: number; overheats: number; walkers: number; boosters: number };
    restart(): void;
    /** Sim speed (1 = normal) and freeze; frozen, stepFrame runs one step. */
    setTime(scale: number, frozen: boolean): void;
    stepFrame(): void;
    /** The junction or the camera moved. */
    redrawGround(): void;
    shake(kind: 'hit' | 'boost'): void;
    /** The lights (null where the browser can't light). */
    readonly lighting: DonutLighting | null;
}

type Tab = 'look' | 'feel';

const STORAGE_KEY = 'sgalalla.donutLab';
const OPEN_KEY = 'sgalalla.donutLabOpen';
const TAB_KEY = 'sgalalla.donutLabTab';
/** Docked panels sit in columns, so where they'd float doesn't matter. */
const PLACE = { top: 8, left: 8 };

/** The saved changes on top of the defaults: every DERAPATE run on this browser plays with them. */
export function loadDonutTuning(): void {
    try {
        applyDonutChanges(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
    } catch {
        resetDonutTuning();
    }
}

/** Whether the Lab was open when DERAPATE was last left (it opens again). */
export function donutLabWasOpen(): boolean {
    return loadString(OPEN_KEY) === 'true';
}

function saveDonutTuning(): void {
    saveString(STORAGE_KEY, JSON.stringify(donutChanges()));
}

/** The changes (or every value) as JSON, on the clipboard and in the console, ready to paste to Claude. */
function copy(all: boolean): void {
    const json = JSON.stringify({ sgalallaDerapate: 1, ...(all ? allDonutSettings() : donutChanges()) }, null, 2);
    console.log(json);
    navigator.clipboard?.writeText(json).catch(() => undefined);
}

/** A panel the Lab can refresh, recount and search. */
interface Panel {
    readonly box: LabPanelBox;
    readonly rows: TuneRow[];
    updateTitle(): void;
}

export class DonutLab {
    private readonly host: DonutLabHost;
    private readonly test: TestPanel;
    private readonly lights: LightsPanel;
    private readonly tabs: Record<Tab, Panel[]>;
    private readonly view: WindowedView;
    private readonly bar: HTMLElement;
    private readonly tabButtons: Record<Tab, HTMLElement>;
    private tab: Tab;
    private saveTimer = 0;

    constructor(scene: Phaser.Scene, host: DonutLabHost) {
        this.host = host;
        addFeelStyles();

        const changed = (redraw: boolean) => this.changed(redraw);
        this.lights = new LightsPanel(scene, host, changed, () => {
            this.refreshAll();
            this.changed(false);
        });
        const look = {
            left: [this.lights, new GroupPanel('CAR', CAR_GROUPS, changed)],
            right: [new GroupPanel('CAMERA', CAMERA_GROUPS, changed), new GroupPanel('EFFECTS', EFFECTS_GROUPS, changed),
                new GroupPanel('HUD', HUD_GROUPS, changed), new GroupPanel('SOUND', SOUND_GROUPS, changed)],
        };
        const feel = {
            left: [new GroupPanel('BALANCE', BALANCE_GROUPS, changed)],
            right: [new GroupPanel('DRIVING', DRIVING_GROUPS, changed), new GroupPanel('PEOPLE AND POINTS', PEOPLE_GROUPS, changed)],
        };
        this.tabs = { look: [...look.left, ...look.right], feel: [...feel.left, ...feel.right] };
        this.test = new TestPanel(host, {
            copy,
            paste: () => this.paste(),
            resetAll: () => {
                resetDonutTuning();
                this.refreshAll();
                this.changed(true);
            },
            rows: () => this.tabs[this.tab].flatMap(panel => panel.rows),
        });

        // Always windowed: the game in the middle, TEST at the top of the left column in both tabs
        const boxes = (panels: Panel[]) => panels.map(panel => panel.box);
        this.view = new WindowedView(scene, [
            { left: [this.test.box], right: [] },
            { left: boxes(look.left), right: boxes(look.right) },
            { left: boxes(feel.left), right: boxes(feel.right) },
        ], () => undefined, 0);
        this.view.set(true);

        this.bar = element('div');
        this.bar.className = 'lab-mode';
        const title = element('span', 'DERAPATE LAB');
        this.tabButtons = { look: element('button', 'LOOK'), feel: element('button', 'FEEL') };
        this.tabButtons.look.title = 'How it looks and sounds: lights, camera, car, effects, HUD, sound';
        this.tabButtons.feel.title = 'How it plays';
        for (const tab of ['look', 'feel'] as const) {
            this.tabButtons[tab].addEventListener('click', () => {
                this.setTab(tab);
                this.tabButtons[tab].blur();
            });
        }
        this.bar.append(title, this.tabButtons.look, this.tabButtons.feel, element('span', 'TAB · G LIGHTS · L CLOSE · F FREEZE · N STEP'));
        document.body.append(this.bar);

        this.tab = loadString(TAB_KEY) === 'feel' ? 'feel' : 'look';
        this.setTab(this.tab);
        this.updateTitles();
        saveString(OPEN_KEY, 'true');
    }

    /** Once per frame, after the game stepped. */
    update(): void {
        this.test.update();
        this.lights.update(this.tab === 'look');
    }

    toggleTab(): void {
        this.setTab(this.tab === 'look' ? 'feel' : 'look');
    }

    toggleFreeze(): void {
        this.test.toggleFreeze();
    }

    nextFrame(): void {
        this.test.nextFrame();
    }

    toggleLights(): void {
        const lighting = this.host.lighting;
        lighting?.setEnabled(!lighting.isEnabled);
    }

    /** Closed by the player (L): it stays closed next time, and the lights go back to how the player wants them if G switched them. */
    close(): void {
        saveString(OPEN_KEY, 'false');
        this.host.lighting?.setEnabled(DonutLighting.wanted());
        this.destroy();
    }

    /** Gone with the scene (closed, or DERAPATE left with it open). */
    destroy(): void {
        window.clearTimeout(this.saveTimer);
        saveDonutTuning();
        this.view.destroy();
        this.test.box.destroy();
        for (const panel of [...this.tabs.look, ...this.tabs.feel]) panel.box.destroy();
        this.lights.destroy();
        this.bar.remove();
        this.host.setTime(1, false);
    }

    private setTab(tab: Tab): void {
        this.tab = tab;
        for (const name of ['look', 'feel'] as const) {
            for (const panel of this.tabs[name]) panel.box.setVisible(name === tab);
            this.tabButtons[name].classList.toggle('on', name === tab);
        }
        saveString(TAB_KEY, tab);
    }

    /** A value moved: redraw the ground if it needs it, count the changes, save once things settle. */
    private changed(redraw: boolean): void {
        if (redraw) this.host.redrawGround();
        window.clearTimeout(this.saveTimer);
        this.saveTimer = window.setTimeout(() => {
            saveDonutTuning();
            this.updateTitles();
        }, 150);
    }

    private updateTitles(): void {
        for (const panel of [...this.tabs.look, ...this.tabs.feel]) panel.updateTitle();
        this.lights.showTime();
        this.tabButtons.look.textContent = withCount('LOOK', changeCount(LOOK_TAB_GROUPS) + (this.lights.lampsChanged ? 1 : 0));
        this.tabButtons.feel.textContent = withCount('FEEL', changeCount(FEEL_TAB_GROUPS));
    }

    private refreshAll(): void {
        for (const panel of [...this.tabs.look, ...this.tabs.feel]) for (const row of panel.rows) row.refresh();
        this.lights.rebuildLamps();
    }

    private paste(): void {
        pasteDialog('Paste DERAPATE settings (they replace the current ones)', text => {
            let parsed: unknown;
            try {
                parsed = JSON.parse(text);
            } catch {
                return 'That isn\'t valid JSON.';
            }
            const applied = applyDonutChanges(parsed);
            this.refreshAll();
            this.changed(true);
            return applied > 0 || text.trim() === '{}' ? null : 'No DERAPATE settings found in that.';
        });
    }
}

function withCount(title: string, count: number): string {
    return count > 0 ? `${title} (${count})` : title;
}

// ─── Rows ───

/** A setting's row: a slider (or a colour picker), its default on ↺. */
function settingRow(setting: DonutSetting, changed: (redraw: boolean) => void): TuneRow {
    const redraw = setting.redraw ?? false;
    const fallback = settingDefault(setting);
    // The default goes back exactly (a worked-out value written back could be a rounding off)
    const set = (value: number) => (value === fallback ? resetSetting(setting) : setSetting(setting, value));
    if (setting.unit === 'colour') {
        return colourRow(setting.label, () => settingValue(setting), set, fallback, () => changed(redraw));
    }
    return tuneRow(asSetting(setting.label, setting.unit, setting.hint, setting.keys.join(' ')), setting.range,
        () => settingValue(setting),
        value => {
            set(value);
            if (redraw) changed(true);
        },
        fallback,
        () => changed(redraw));
}

/** A colour picker in the shape of a numeric row (its name yellow while it differs from the default, ↺ for the default). */
function colourRow(label: string, get: () => number, set: (value: number) => void, fallback: number, onChange: () => void): TuneRow {
    const node = element('label');
    node.className = 'row tune';
    const name = element('span', label);
    name.className = 'name';
    const show = () => {
        input.value = colorToHex(get());
        node.classList.toggle('changed', get() !== fallback);
    };
    const input = colourInput(get(), value => {
        set(value);
        node.classList.toggle('changed', value !== fallback);
    }, onChange);
    const reset = element('button', '↺') as HTMLButtonElement;
    reset.className = 'reset';
    reset.type = 'button';
    reset.addEventListener('click', event => {
        event.preventDefault();
        set(fallback);
        show();
        onChange();
        reset.blur();
    });
    node.title = `Default: ${colorToHex(fallback)}`;
    node.append(name, input, element('span'), reset);
    show();
    return { node, refresh: show, text: label.toLowerCase() };
}

/** The shape FeelUi's rows take: its units are the fighting game's (DERAPATE's own only go in the tooltip), and its ms would show as frames. */
function asSetting(label: string, unit: string, hint: string | undefined, key: string): Setting {
    return { key, label, hint, unit: (unit === 'ms' ? '' : unit) as Unit };
}

// ─── Panels ───

/** One topic's panel: a folding section per group, a row per setting. */
class GroupPanel implements Panel {
    readonly box: LabPanelBox;
    readonly rows: TuneRow[] = [];
    private readonly title: string;
    private readonly groups: DonutGroup[];

    constructor(title: string, groups: DonutGroup[], changed: (redraw: boolean) => void) {
        this.title = title;
        this.groups = groups;
        this.box = new LabPanelBox(title, PLACE);
        groups.forEach((group, i) => {
            const rows = group.settings.map(setting => settingRow(setting, changed));
            this.rows.push(...rows);
            this.box.body.append(section(group.title, i === 0, ...rows.map(row => row.node)));
        });
        this.box.footer.append(button('Reset panel', () => {
            for (const group of groups) for (const setting of group.settings) resetSetting(setting);
            for (const row of this.rows) row.refresh();
            changed(groups.some(group => group.settings.some(setting => setting.redraw)));
        }));
    }

    updateTitle(): void {
        this.box.setTitle(withCount(this.title, changeCount(this.groups)));
    }
}

/** The lights: the time of day, the street lamps (pick, add, move and tune them; rings on screen drag them), then the light settings. */
class LightsPanel implements Panel {
    readonly box: LabPanelBox;
    readonly rows: TuneRow[] = [];
    private readonly host: DonutLabHost;
    private readonly changed: (redraw: boolean) => void;
    private readonly lampList = document.createElement('select');
    private readonly lampEditor = element('div');
    private readonly handles: LampHandles;
    private readonly timeButtons = new Map<string, HTMLButtonElement>();
    private selected: LampDef | null = null;
    private position: HTMLElement | null = null;

    constructor(scene: Phaser.Scene, host: DonutLabHost, changed: (redraw: boolean) => void, timeChanged: () => void) {
        this.host = host;
        this.changed = changed;
        this.box = new LabPanelBox('LIGHTS', PLACE);
        this.lampList.addEventListener('change', () => {
            this.select(LAMPS[Number(this.lampList.value)] ?? null);
            this.lampList.blur();
        });
        const times = TIMES_OF_DAY.map(time => {
            const node = button(TIME_NAMES[time], () => {
                applyTimeOfDay(time);
                timeChanged();
            });
            this.timeButtons.set(time, node);
            return node;
        });
        this.box.body.append(
            hint(host.lighting ? 'G lights on / off · drag the rings on screen to move the lamps' : 'This browser can\'t light the game: the settings here do nothing.'),
            section('TIME OF DAY', true, buttons(...times),
                hint('Sets the ambient light, the lamps, the car\'s lights and the grading for that time; tweak them after.')),
            section('LAMPS', true, buttons(this.lampList, button('+ Lamp', () => this.addLamp()), button('Delete', () => this.removeSelected())), this.lampEditor),
        );
        LIGHT_GROUPS.forEach(group => {
            const rows = group.settings.map(setting => settingRow(setting, changed));
            this.rows.push(...rows);
            this.box.body.append(section(group.title, false, ...rows.map(row => row.node)));
        });
        this.box.footer.append(button('Reset panel', () => {
            for (const group of LIGHT_GROUPS) for (const setting of group.settings) resetSetting(setting);
            resetLamps();
            for (const row of this.rows) row.refresh();
            this.rebuildLamps();
            changed(false);
        }));
        this.handles = new LampHandles(scene, lamp => this.select(lamp), lamp => this.showPosition(lamp), () => changed(false));
        this.rebuildLamps();
    }

    get lampsChanged(): boolean {
        return !lampsAreDefault();
    }

    updateTitle(): void {
        let count = 0;
        for (const group of LIGHT_GROUPS) for (const setting of group.settings) if (settingChanged(setting)) count++;
        this.box.setTitle(withCount('LIGHTS', count + (this.lampsChanged ? 1 : 0)));
    }

    /** The time of day the light is set to, lit up (none once it's been tweaked). */
    showTime(): void {
        const now = currentTimeOfDay();
        for (const [time, node] of this.timeButtons) {
            node.style.background = time === now ? '#8bef8b' : '';
            node.style.color = time === now ? '#101010' : '';
        }
    }

    /** The handles follow the lamps, shown in the LOOK tab while lighting is on. */
    update(lookTab: boolean): void {
        this.handles.update(this.selected, lookTab && (this.host.lighting?.isEnabled ?? false));
    }

    /** The lamp list and editor again (after a reset or a paste). */
    rebuildLamps(): void {
        this.select(LAMPS.includes(this.selected!) ? this.selected : LAMPS[0] ?? null);
    }

    destroy(): void {
        this.handles.destroy();
    }

    private select(lamp: LampDef | null): void {
        this.selected = lamp;
        let n = 0;
        this.lampList.replaceChildren(...LAMPS.map((each, i) => {
            const option = element('option', `Lamp ${++n}`) as HTMLOptionElement;
            option.value = String(i);
            option.selected = each === lamp;
            return option;
        }));
        this.buildEditor();
    }

    private buildEditor(): void {
        const lamp = this.selected;
        this.position = null;
        if (!lamp) {
            this.lampEditor.replaceChildren(hint('No lamps: + Lamp adds one.'));
            return;
        }
        const index = LAMPS.indexOf(lamp);
        const fallback: Omit<LampDef, 'x' | 'y'> = DEFAULT_LAMPS[index] ?? NEW_LAMP;
        const done = () => this.changed(false);
        this.position = hint('');
        this.showPosition(lamp);
        const sliders = (Object.keys(LAMP_RANGES) as (keyof typeof LAMP_RANGES)[]).map(key => tuneRow(
            asSetting(key[0].toUpperCase() + key.slice(1), key === 'height' || key === 'reach' ? 'm' : 'times', undefined, key),
            LAMP_RANGES[key], () => lamp[key], value => { lamp[key] = value; }, fallback[key], done));
        this.lampEditor.replaceChildren(
            this.position,
            colourRow('Colour', () => lamp.colour, value => { lamp.colour = value; }, fallback.colour, done).node,
            ...sliders.map(row => row.node),
            toggleRow('Post', () => lamp.post, on => { lamp.post = on; }, fallback.post, done).node,
        );
    }

    private showPosition(lamp: LampDef): void {
        if (lamp === this.selected && this.position) this.position.textContent = `Stands at x ${lamp.x.toFixed(1)} m, y ${lamp.y.toFixed(1)} m`;
    }

    /** A new lamp in the middle of the junction. */
    private addLamp(): void {
        if (LAMPS.length >= MAX_LAMPS) {
            window.alert(`At most ${MAX_LAMPS} lamps (the car's lights and flashes need the rest).`);
            return;
        }
        const lamp: LampDef = { ...NEW_LAMP, x: 0, y: 0 };
        LAMPS.push(lamp);
        this.select(lamp);
        this.changed(false);
    }

    private removeSelected(): void {
        const lamp = this.selected;
        if (!lamp) return;
        LAMPS.splice(LAMPS.indexOf(lamp), 1);
        this.select(LAMPS[0] ?? null);
        this.changed(false);
    }
}

/** Rings on the HUD's camera at the lamps' feet: drag one to move its lamp along the ground. */
class LampHandles {
    private readonly scene: Phaser.Scene;
    private readonly onSelect: (lamp: LampDef) => void;
    private readonly onMove: (lamp: LampDef) => void;
    private readonly onMoved: () => void;
    private readonly rings = new Map<LampDef, Phaser.GameObjects.Arc>();

    constructor(scene: Phaser.Scene, onSelect: (lamp: LampDef) => void, onMove: (lamp: LampDef) => void, onMoved: () => void) {
        this.scene = scene;
        this.onSelect = onSelect;
        this.onMove = onMove;
        this.onMoved = onMoved;
    }

    /** One ring per lamp. Once per frame. */
    update(selected: LampDef | null, visible: boolean): void {
        for (const [lamp, ring] of this.rings) {
            if (LAMPS.includes(lamp)) continue;
            ring.destroy();
            this.rings.delete(lamp);
        }
        for (const lamp of LAMPS) {
            const ring = this.rings.get(lamp) ?? this.createRing(lamp);
            const isSelected = lamp === selected;
            ring.setPosition(screenX(lamp.x, lamp.y), screenY(lamp.x, lamp.y))
                .setStrokeStyle(isSelected ? 5 : 3, isSelected ? 0xffffff : lamp.colour)
                .setVisible(visible);
        }
    }

    destroy(): void {
        for (const ring of this.rings.values()) ring.destroy();
        this.rings.clear();
    }

    private createRing(lamp: LampDef): Phaser.GameObjects.Arc {
        const ring = this.scene.add.circle(0, 0, 18).setFillStyle(0x000000, 0.3).setDepth(1000)
            .setInteractive({ draggable: true, useHandCursor: true });
        // On the HUD's camera: no shake, zoom or camera effects
        this.scene.cameras.main.ignore(ring);
        let from = { x: 0, y: 0, pointerX: 0, pointerY: 0 };
        ring.on('pointerdown', () => this.onSelect(lamp));
        ring.on('dragstart', (pointer: Phaser.Input.Pointer) => {
            from = { x: lamp.x, y: lamp.y, pointerX: pointer.x, pointerY: pointer.y };
        });
        ring.on('drag', (pointer: Phaser.Input.Pointer) => {
            const moved = groundMove(pointer.x - from.pointerX, pointer.y - from.pointerY);
            lamp.x = Math.round((from.x + moved.x) * 10) / 10;
            lamp.y = Math.round((from.y + moved.y) * 10) / 10;
            this.onMove(lamp);
        });
        ring.on('dragend', this.onMoved);
        this.rings.set(lamp, ring);
        return ring;
    }
}

interface TestTools {
    copy(all: boolean): void;
    paste(): void;
    resetAll(): void;
    /** The rows of the tab showing, for the find box. */
    rows(): TuneRow[];
}

/** The tools: restart, time, test shakes, readouts, the car's live values, find, copy and paste. */
class TestPanel {
    readonly box: LabPanelBox;
    private readonly host: DonutLabHost;
    private readonly tools: TestTools;
    private readonly freezeButton: HTMLButtonElement;
    private readonly readout = element('div');
    private readonly liveRows: TuneRow[];
    private scale = 1;
    private frozen = false;
    private frames = 0;

    constructor(host: DonutLabHost, tools: TestTools) {
        this.host = host;
        this.tools = tools;
        this.box = new LabPanelBox('TEST', PLACE);
        this.readout.className = 'readout';

        this.freezeButton = button('Freeze (F)', () => this.toggleFreeze());
        const speeds: [string, string][] = [['1', 'Normal'], ['0.5', 'Half'], ['0.25', 'Quarter'], ['0.1', 'Tenth']];
        const time = section('GAME', true,
            buttons(button('Restart (R)', () => host.restart()), this.freezeButton, button('Next step (N)', () => this.nextFrame())),
            choice('Speed', speeds, '1', value => {
                this.scale = Number(value);
                this.host.setTime(this.scale, this.frozen);
            }),
            buttons(button('Shake: hit', () => host.shake('hit')), button('Shake: boost', () => host.shake('boost'))),
        );

        // The car's live values: set them (best while frozen) to put the car somewhere
        const state = () => this.host.state();
        const fresh = createDonut(1);
        const live = (label: string, key: 'radius' | 'speed' | 'revs' | 'heat' | 'slip', range: readonly [number, number, number]) =>
            tuneRow(asSetting(label, '', undefined, key), range, () => state()[key], value => { state()[key] = value; }, fresh[key], () => undefined);
        this.liveRows = [
            tuneRow(asSetting('Angle round', '°', 'Where round the donut the car is (degrees).', 'angle'), [0, 360, 1],
                () => ((state().angle * 180) / Math.PI + 360) % 360, value => { state().angle = (value * Math.PI) / 180; }, 0, () => undefined),
            live('Radius', 'radius', [0.5, 30, 0.1]),
            live('Speed', 'speed', [0, 50, 0.5]),
            live('Revs', 'revs', [0, 1, 0.01]),
            live('Heat', 'heat', [0, 1, 0.01]),
            live('Balance', 'slip', [-1, 1, 0.01]),
        ];
        const liveSection = section('THE CAR NOW', false,
            hint('The car\'s live values: freeze (F) and drag them to put it where you want, then step or unfreeze.'),
            ...this.liveRows.map(row => row.node));

        // Find: only the matching rows stay in the tab's panels, their sections open
        const find = document.createElement('input');
        find.className = 'find';
        find.type = 'search';
        find.placeholder = 'Find a setting in this tab…';
        find.addEventListener('input', () => {
            const query = find.value.trim().toLowerCase();
            for (const row of this.tools.rows()) {
                const match = !query || row.text.includes(query);
                row.node.style.display = match ? '' : 'none';
                if (query && match) {
                    row.node.closest('details')?.setAttribute('open', '');
                    row.node.closest('.lab-panel')?.classList.remove('folded');
                }
            }
        });

        this.box.body.append(time, section('NOW', true, this.readout), liveSection, section('FIND', false, find));
        this.box.footer.append(
            button('Copy changes', () => this.tools.copy(false)),
            button('Copy all', () => this.tools.copy(true)),
            button('Paste', () => this.tools.paste()),
            button('Reset all', () => this.tools.resetAll()),
        );
        this.box.footer.style.flexWrap = 'wrap';
    }

    toggleFreeze(): void {
        this.frozen = !this.frozen;
        this.freezeButton.textContent = this.frozen ? 'Unfreeze (F)' : 'Freeze (F)';
        this.host.setTime(this.scale, this.frozen);
    }

    nextFrame(): void {
        if (!this.frozen) this.toggleFreeze();
        this.host.stepFrame();
    }

    /** Readouts a few times a second; the live values too, unless one is being dragged or typed in. */
    update(): void {
        if (this.frames++ % 6 !== 0) return;
        const s = this.host.state();
        const stats = this.host.stats;
        const lines = [
            `<b>Speed</b>   ${(s.speed * 3.6).toFixed(0)} km/h  top ${(topSpeed(s) * 3.6).toFixed(0)}`,
            `<b>In a row</b> ${s.streak}   <b>Burst</b> ${(s.boost * 3.6).toFixed(0)} km/h`,
            `<b>Radius</b>  ${s.radius.toFixed(2)} m`,
            `<b>Revs</b>    ${s.revs.toFixed(2)}  ${s.locked ? 'IN THE GREEN' : 'white'}`,
            `<b>Heat</b>    ${Math.round(s.heat * 100)}%   <b>Pedal up</b> ${s.lifted.toFixed(1)} s`,
            `<b>Balance</b> ${s.slip.toFixed(2)}${Math.abs(s.slip) < DONUT.CLEAN ? '  clean' : ''}${s.overEdge > 0 ? `  AT THE EDGE ${s.overEdge.toFixed(2)} s` : ''}`,
            `<b>Combo</b>   ×${s.combo.toFixed(2)}   <b>Score</b> ${Math.floor(s.score)}`,
            `<b>Testacodas</b> ${stats.spins}   <b>Overheats</b> ${stats.overheats}   <b>Blue hit</b> ${stats.walkers}   <b>White</b> ${stats.boosters}`,
            `<b>Time</b>    ${(s.steps / 60).toFixed(1)} s${s.spinning > 0 ? '   TESTACODA' : ''}${s.stalled ? '   STALLED' : ''}`,
        ];
        this.readout.innerHTML = lines.join('\n');
        const active = document.activeElement;
        for (const row of this.liveRows) if (!row.node.contains(active) && !row.node.matches(':hover')) row.refresh();
    }
}

function loadString(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function saveString(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Browser storage unavailable: the Lab starts from its defaults next time
    }
}
