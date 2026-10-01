import Phaser from 'phaser';
import { button, buttons, choice, element, hint, LabPanelBox, section } from '../../lighting/lab/LabUi';
import { addFeelStyles, pasteDialog, toggleRow, tuneRow, type TuneRow } from '../../lab/FeelUi';
import type { Setting } from '../../lab/FeelCatalog';
import { WindowedView } from '../../lab/StudioLab';
import { DONUT, createDonut, type DonutState } from './DonutSim';
import {
    DRIVING_GROUPS, GREEN_GROUPS, LOOK_GROUPS, STEERING_GROUPS, WORLD_GROUPS, allDonutSettings, applyDonutChanges, changeCount, donutChanges,
    resetDonutTuning, setSetting, settingDefault, settingValue, type DonutGroup,
} from './DonutTuning';

/**
 * The DERAPATE Lab (L in the game): every setting of the mini-game live, in
 * the Studio Lab's style. Windowed (the default), the game sits in the middle
 * with the panels docked either side; full screen, they float over it.
 * DRIVING, GREEN AND HEAT, STEERING and PEOPLE AND ROAD hold the rules, CAR AND CAMERA the
 * drawing, the camera and the shakes, TEST the tools: restart, freeze, frame
 * step, slow motion, test shakes, live readouts, the car's live values and a
 * find box. Changes are kept in this browser and used whenever DERAPATE runs
 * here; Copy changes puts only what differs from the defaults on the clipboard.
 * Keys while it's open: F freeze, N next step, H hide the panels.
 */

/** What the Lab needs from the game. */
export interface DonutLabHost {
    readonly state: DonutState;
    /** Testacodas, overheats and people hit since the last restart. */
    readonly stats: { spins: number; overheats: number; walkers: number; boosters: number };
    restart(): void;
    /** Sim speed (1 = normal) and freeze; frozen, stepFrame runs one step. */
    setTime(scale: number, frozen: boolean): void;
    stepFrame(): void;
    /** The junction or the camera moved. */
    redrawGround(): void;
    shake(kind: 'hit' | 'boost'): void;
}

const STORAGE_KEY = 'sgalalla.donutLab';
const WINDOWED_KEY = 'sgalalla.donutLabWindowed';
const PANEL_STEP = 338;

/** The saved changes on top of the defaults: every DERAPATE run on this browser plays with them. */
export function loadDonutTuning(): void {
    try {
        applyDonutChanges(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
    } catch {
        resetDonutTuning();
    }
}

function saveDonutTuning(): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(donutChanges()));
    } catch {
        // Browser storage unavailable: the settings last until the page reloads
    }
}

/** The changes (or every value) as JSON, on the clipboard and in the console, ready to paste to Claude. */
function copy(all: boolean): void {
    const json = JSON.stringify({ sgalallaDerapate: 1, ...(all ? allDonutSettings() : donutChanges()) }, null, 2);
    console.log(json);
    navigator.clipboard?.writeText(json).catch(() => undefined);
}

export class DonutLab {
    private readonly host: DonutLabHost;
    private readonly panels: GroupPanel[];
    private readonly test: TestPanel;
    private readonly view: WindowedView;
    private readonly bar: HTMLElement;
    private readonly viewButton: HTMLElement;
    private windowed: boolean;
    private shown = true;
    private saveTimer = 0;

    constructor(scene: Phaser.Scene, host: DonutLabHost) {
        this.host = host;
        addFeelStyles();

        const changed = (redraw: boolean) => this.changed(redraw);
        const driving = new GroupPanel('DRIVING', DRIVING_GROUPS, changed, { top: 8, right: 8 });
        const green = new GroupPanel('GREEN AND HEAT', GREEN_GROUPS, changed, { top: 8, right: 8 + PANEL_STEP });
        const world = new GroupPanel('PEOPLE AND ROAD', WORLD_GROUPS, changed, { top: 8, right: 8 + 2 * PANEL_STEP, folded: true });
        const look = new GroupPanel('CAR AND CAMERA', LOOK_GROUPS, changed, { top: 8, left: 8 + PANEL_STEP, folded: true });
        const steering = new GroupPanel('STEERING', STEERING_GROUPS, changed, { top: 8, left: 8 + 2 * PANEL_STEP });
        this.panels = [driving, green, steering, world, look];
        this.test = new TestPanel(host, {
            copy,
            paste: () => this.paste(),
            resetAll: () => {
                resetDonutTuning();
                this.refreshAll();
                this.changed(true);
            },
            rows: () => this.panels.flatMap(panel => panel.rows),
        }, { top: 8, left: 8 });

        this.view = new WindowedView(scene, [{ left: [this.test.box, steering.box, look.box], right: [driving.box, green.box, world.box] }], () => undefined, 0);
        this.windowed = loadString(WINDOWED_KEY) !== 'false';

        this.bar = element('div');
        this.bar.className = 'lab-mode';
        const title = element('button', 'DERAPATE LAB');
        title.classList.add('on');
        title.title = 'L closes the Lab';
        this.viewButton = element('button');
        this.viewButton.title = 'The game in the middle with the panels either side, or full screen';
        this.viewButton.addEventListener('click', () => {
            this.windowed = !this.windowed;
            this.apply();
            this.viewButton.blur();
        });
        this.bar.append(title, element('span', 'L CLOSE · F FREEZE · N STEP · H HIDE'), this.viewButton);
        document.body.append(this.bar);
        this.apply();
        this.updateTitles();
    }

    /** Once per frame, after the game stepped. */
    update(): void {
        this.test.update();
    }

    toggleFreeze(): void {
        this.test.toggleFreeze();
    }

    nextFrame(): void {
        this.test.nextFrame();
    }

    toggleShown(): void {
        this.shown = !this.shown;
        this.apply();
    }

    destroy(): void {
        window.clearTimeout(this.saveTimer);
        saveDonutTuning();
        this.view.destroy();
        for (const panel of this.panels) panel.box.destroy();
        this.test.box.destroy();
        this.bar.remove();
        this.host.setTime(1, false);
    }

    private apply(): void {
        for (const panel of this.panels) panel.box.setVisible(this.shown);
        this.test.box.setVisible(this.shown);
        this.view.set(this.windowed);
        this.viewButton.textContent = this.windowed ? 'FULL SCREEN' : 'WINDOWED';
        saveString(WINDOWED_KEY, String(this.windowed));
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
        for (const panel of this.panels) panel.updateTitle();
        this.test.updateTitle();
    }

    private refreshAll(): void {
        for (const panel of this.panels) for (const row of panel.rows) row.refresh();
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

/** One topic's panel: a folding section per group, a row per setting. */
class GroupPanel {
    readonly box: LabPanelBox;
    readonly rows: TuneRow[] = [];
    private readonly title: string;
    private readonly groups: DonutGroup[];

    constructor(title: string, groups: DonutGroup[], changed: (redraw: boolean) => void,
        place: { top: number; left?: number; right?: number; folded?: boolean }) {
        this.title = title;
        this.groups = groups;
        this.box = new LabPanelBox(title, place);
        groups.forEach((group, i) => {
            const rows = group.settings.map(setting => setting.unit === 'switch'
                ? toggleRow(setting.label, () => settingValue(setting) !== 0, on => setSetting(setting, on ? 1 : 0), settingDefault(setting) !== 0,
                    () => changed(false))
                : tuneRow(asSetting(setting.label, setting.unit, setting.hint, setting.key), setting.range,
                () => settingValue(setting),
                value => {
                    setSetting(setting, value);
                    if (setting.redraw) changed(true);
                },
                settingDefault(setting),
                () => changed(setting.redraw ?? false)));
            this.rows.push(...rows);
            this.box.body.append(section(group.title, i === 0, ...rows.map(row => row.node)));
        });
        this.box.footer.append(button('Reset panel', () => {
            for (const group of groups) for (const setting of group.settings) setSetting(setting, settingDefault(setting));
            for (const row of this.rows) row.refresh();
            changed(groups.some(group => group.settings.some(setting => setting.redraw)));
        }));
    }

    updateTitle(): void {
        const count = changeCount(this.groups);
        this.box.setTitle(count > 0 ? `${this.title}  (${count} changed)` : this.title);
    }
}

interface TestTools {
    copy(all: boolean): void;
    paste(): void;
    resetAll(): void;
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

    constructor(host: DonutLabHost, tools: TestTools, place: { top: number; left?: number; right?: number }) {
        this.host = host;
        this.tools = tools;
        this.box = new LabPanelBox('TEST', place);
        this.readout.className = 'readout';

        this.freezeButton = button('Freeze (F)', () => this.toggleFreeze());
        const speeds: [string, string][] = [['1', 'Normal'], ['0.5', 'Half'], ['0.25', 'Quarter'], ['0.1', 'Tenth']];
        const time = section('GAME', true,
            buttons(button('Restart (R)', () => host.restart()), this.freezeButton, button('Next step (N)', () => this.nextFrame())),
            choice('Speed', speeds, '1', value => {
                this.scale = Number(value);
                this.host.setTime(this.scale, this.frozen);
            }),
            buttons(button('Shake: red hit', () => host.shake('hit')), button('Shake: boost', () => host.shake('boost'))),
        );

        // The car's live values: set them (best while frozen) to put the car somewhere
        const state = () => this.host.state;
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

        // Find: only the matching rows stay in the panels, their sections open
        const find = document.createElement('input');
        find.className = 'find';
        find.type = 'search';
        find.placeholder = 'Find a setting…';
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

        this.box.body.append(
            time,
            section('NOW', true, this.readout),
            liveSection,
            section('FIND', true, find),
        );
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

    updateTitle(): void {
        const count = changeCount();
        this.box.setTitle(count > 0 ? `TEST  (${count} changed in all)` : 'TEST');
    }

    /** Readouts a few times a second; the live values too, unless one is being dragged or typed in. */
    update(): void {
        if (this.frames++ % 6 !== 0) return;
        const s = this.host.state;
        const stats = this.host.stats;
        const lines = [
            `<b>Speed</b>   ${(s.speed * 3.6).toFixed(0)} km/h  (${s.speed.toFixed(1)} m/s)`,
            `<b>Radius</b>  ${s.radius.toFixed(2)} m`,
            `<b>Revs</b>    ${s.revs.toFixed(2)}  ${s.locked ? 'IN THE GREEN' : 'white'}`,
            `<b>Heat</b>    ${Math.round(s.heat * 100)}%   <b>Pedal up</b> ${s.lifted.toFixed(1)} s`,
            `<b>Balance</b> ${s.slip.toFixed(2)}${Math.abs(s.slip) < DONUT.CLEAN ? '  clean' : ''}${s.overEdge > 0 ? `  AT THE EDGE ${s.overEdge.toFixed(2)} s` : ''}`,
            `<b>Combo</b>   ×${s.combo.toFixed(2)}   <b>Score</b> ${Math.floor(s.score)}`,
            `<b>Testacodas</b> ${stats.spins}   <b>Overheats</b> ${stats.overheats}   <b>Red hit</b> ${stats.walkers}   <b>Green</b> ${stats.boosters}`,
            `<b>Time</b>    ${(s.steps / 60).toFixed(1)} s${s.spinning > 0 ? '   TESTACODA' : ''}${s.stalled ? '   STALLED' : ''}`,
        ];
        this.readout.innerHTML = lines.join('\n');
        const active = document.activeElement;
        for (const row of this.liveRows) if (!row.node.contains(active) && !row.node.matches(':hover')) row.refresh();
    }
}

/** The shape FeelUi's rows take. */
function asSetting(label: string, unit: string, hint: string | undefined, key: string): Setting {
    // FeelUi turns ms into frames; here ms are plain milliseconds
    return { key, label, hint, unit: (unit === 'ms' || unit === 'steps' ? '' : unit) } as unknown as Setting;
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
