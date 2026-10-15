import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import { button, buttons, checkbox, choice, element, hint, LabPanelBox, section } from '../lighting/lab/LabUi';
import { AttackDirection, AttackRegistry, AttackType } from '../../shared/AttackData';
import type { MatchState } from '../../shared/GameSim';
import type { MatchEvent } from '../../shared/MatchEvents';
import { PhysicsConfig } from '../../shared/PhysicsConfig';
import { DEFAULT_EFFECTS, effects, type EffectKey } from '../config/EffectConfig';
import {
    COMBAT_GROUPS, EFFECT_GROUPS, MOVE_SETTINGS, MOVEMENT_GROUPS, MOVES, rangeFor,
    type Group, type MoveInfo, type Setting,
} from './FeelCatalog';
import { measure, type Measurements } from './FeelMeasure';
import { addFeelStyles, pasteDialog, toggleRow, tuneRow, type TuneRow } from './FeelUi';
import {
    allTuning, applyTuning, DEFAULT_PHYSICS, defaultMoveValue, moveValue, resetTuning, setEffect, setMoveValue, setPhysics,
    tuningChanges, type MoveField, type PhysicsKey,
} from './Tuning';

/**
 * The Studio Lab's FEEL mode: every gameplay setting live, in four panels.
 * MOVEMENT and COMBAT hold the physics, MOVES each move's numbers (with its
 * hitbox drawn on Fok), TEST the tools: slow motion, freeze and frame step,
 * the dummy's damage, live readouts of the last hit, measured jump heights,
 * a find box and the screen effects. Changes are kept in the browser; Copy
 * changes puts only what differs from the defaults on the clipboard.
 */

/** What FEEL mode needs from the match scene. */
export interface FeelHost {
    readonly match: MatchState;
    readonly players: readonly Player[];
    readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
    restartMatch(): void;
    /** Sim speed (1 = normal) and freeze; frozen, stepFrame runs one step. */
    setTime(scale: number, frozen: boolean): void;
    stepFrame(): void;
    setHitboxes(on: boolean): void;
}

const STORAGE_KEY = 'sgalalla.feelLab';
const PANEL_STEP = 338;
const START_LIVES = 3;
/** The dummy's slot in the Lab. */
const DUMMY = 1;

export class FeelLab {
    private readonly host: FeelHost;
    private readonly panels: FeelPanel[];
    /** The panels' columns in the windowed view. */
    readonly columns: { left: LabPanelBox[]; right: LabPanelBox[] };
    private readonly moves: MovesPanel;
    private readonly test: TestPanel;
    private readonly preview: Phaser.GameObjects.Graphics;
    private shown = false;
    private recount = 0;

    constructor(scene: Phaser.Scene, host: FeelHost) {
        this.host = host;
        addFeelStyles();
        applyTuning(loadSaved());

        const tools: PanelTools = {
            save: () => save(),
            copy: all => copy(all),
            paste: () => this.paste(),
            touched: () => this.touched(),
        };
        // On narrower screens MOVEMENT and COMBAT start folded, so the stage shows; each panel remembers after that
        const folded = window.innerWidth < 1800;
        this.moves = new MovesPanel(tools, { top: 8, right: 8 });
        const combat = new GroupPanel('COMBAT', COMBAT_GROUPS, physicsAccess, tools, { top: 8, right: 8 + PANEL_STEP, folded });
        const movement = new GroupPanel('MOVEMENT', MOVEMENT_GROUPS, physicsAccess, tools, { top: 8, right: 8 + 2 * PANEL_STEP, folded });
        this.test = new TestPanel(host, tools, () => this.findRows(), { top: 200, left: 8 });
        this.panels = [this.moves, combat, movement, this.test];
        this.columns = { left: [this.test.box, movement.box], right: [this.moves.box, combat.box] };

        this.preview = scene.add.graphics().setDepth(998);
        host.uiCamera.ignore(this.preview);
        this.setShown(false);
        this.touched();
    }

    setShown(shown: boolean): void {
        this.shown = shown;
        for (const panel of this.panels) panel.box.setVisible(shown);
        this.host.setHitboxes(shown && this.test.hitboxes);
        if (!shown) this.preview.clear();
    }

    /** Once per frame, after the match stepped. */
    update(): void {
        this.test.update();
        this.preview.clear();
        if (this.shown && this.moves.showPreview) drawPreview(this.preview, this.host, this.moves.selected);
    }

    onEvent(event: MatchEvent): void {
        if (event.type === 'attack' && event.fighter === 0) this.moves.follow(event.key);
        this.test.onEvent(event);
    }

    toggleFreeze(): void {
        this.test.toggleFreeze();
    }

    nextFrame(): void {
        this.test.nextFrame();
    }

    restart(): void {
        this.host.restartMatch();
    }

    destroy(): void {
        window.clearTimeout(this.recount);
        for (const panel of this.panels) panel.box.destroy();
        this.preview.destroy();
        this.host.setTime(1, false);
        // Every other match plays with the defaults
        resetTuning();
    }

    /** A value moved: recount the changes and re-measure, once things settle. */
    private touched(): void {
        window.clearTimeout(this.recount);
        this.recount = window.setTimeout(() => {
            for (const panel of this.panels) panel.updateTitle();
            this.test.remeasure();
        }, 120);
    }

    private paste(): void {
        pasteDialog('Paste FEEL settings (they replace the current ones)', text => {
            let parsed: unknown;
            try {
                parsed = JSON.parse(text);
            } catch {
                return 'That isn\'t valid JSON.';
            }
            const applied = applyTuning(parsed);
            if (applied === 0) return 'No settings found in it.';
            for (const panel of this.panels) panel.refresh();
            save();
            this.touched();
            return null;
        });
    }

    private findRows(): FindableRow[] {
        return this.panels.flatMap(panel => panel.rows);
    }
}

// ─── Panels ───

interface PanelTools {
    save(): void;
    copy(all: boolean): void;
    paste(): void;
    /** A value moved (live, while dragging too). */
    touched(): void;
}

interface FindableRow {
    row: TuneRow;
    /** The foldable section it sits in, and its panel. */
    section: HTMLDetailsElement | null;
    panel: LabPanelBox;
}

interface Access<K extends string> {
    get(key: K): number;
    set(key: K, value: number): void;
    fallback(key: K): number;
}

const physicsAccess: Access<PhysicsKey> = {
    get: key => PhysicsConfig[key],
    set: setPhysics,
    fallback: key => DEFAULT_PHYSICS[key],
};

const effectAccess: Access<EffectKey> = {
    get: key => effects[key],
    set: setEffect,
    fallback: key => DEFAULT_EFFECTS[key],
};

abstract class FeelPanel {
    readonly box: LabPanelBox;
    readonly rows: FindableRow[] = [];
    protected readonly tools: PanelTools;
    private readonly title: string;

    constructor(title: string, tools: PanelTools, place: { top: number; left?: number; right?: number; folded?: boolean }) {
        this.title = title;
        this.tools = tools;
        this.box = new LabPanelBox(title, place);
        const copyButton = button('Copy changes', () => undefined);
        copyButton.title = 'Only what differs from the defaults, as JSON. Shift-click copies every value.';
        copyButton.addEventListener('click', event => {
            tools.copy(event.shiftKey);
            copyButton.textContent = event.shiftKey ? 'Copied all ✓' : 'Copied ✓';
            window.setTimeout(() => copyButton.textContent = 'Copy changes', 1400);
        });
        this.box.footer.append(copyButton, button('Paste', () => tools.paste()), button('Reset panel', () => this.resetPanel()));
    }

    /** How many values in this panel differ from the defaults. */
    abstract changes(): number;

    updateTitle(): void {
        const count = this.changes();
        this.box.setTitle(count > 0 ? `${this.title} · ${count} changed` : this.title);
    }

    refresh(): void {
        for (const { row } of this.rows) row.refresh();
        this.updateTitle();
    }

    protected abstract resetPanel(): void;

    /** Foldable sections of setting rows, the first `openFirst` of them open. */
    protected groups<K extends string>(groups: Group<K>[], access: Access<K>, openFirst: number): HTMLElement[] {
        return groups.map((group, i) => {
            const rows = group.settings.map(setting => this.settingRow(setting, access));
            const node = section(group.title, i < openFirst, ...rows.map(row => row.node)) as HTMLDetailsElement;
            for (const row of rows) this.rows.push({ row, section: node, panel: this.box });
            return node;
        });
    }

    protected settingRow<K extends string>(setting: Setting<K>, access: Access<K>): TuneRow {
        return tuneRow(setting, rangeFor(setting, access.fallback(setting.key)), () => access.get(setting.key), value => {
            access.set(setting.key, value);
            this.tools.touched();
        }, access.fallback(setting.key), () => this.tools.save());
    }
}

/** MOVEMENT or COMBAT: physics settings in sections. */
class GroupPanel extends FeelPanel {
    private readonly groupList: Group<PhysicsKey>[];

    constructor(title: string, groups: Group<PhysicsKey>[], access: Access<PhysicsKey>, tools: PanelTools,
        place: { top: number; right: number; folded?: boolean }) {
        super(title, tools, place);
        this.groupList = groups;
        this.box.body.append(hint('Hover a setting for what it does and its default. Yellow: changed.'), ...this.groups(groups, access, 1));
        this.updateTitle();
    }

    changes(): number {
        return this.keys().filter(key => PhysicsConfig[key] !== DEFAULT_PHYSICS[key]).length;
    }

    protected resetPanel(): void {
        for (const key of this.keys()) setPhysics(key, DEFAULT_PHYSICS[key]);
        this.refresh();
        this.tools.save();
        this.tools.touched();
    }

    private keys(): PhysicsKey[] {
        return this.groupList.flatMap(group => group.settings.map(setting => setting.key));
    }
}

/** MOVES: one move's numbers at a time, picked from a list or by using it. */
class MovesPanel extends FeelPanel {
    selected: MoveInfo = MOVES[0];
    showPreview = true;
    private following = true;
    private readonly picker = element('div');
    private readonly editor = element('div');

    constructor(tools: PanelTools, place: { top: number; right: number }) {
        super('MOVES', tools, place);
        const options = element('div');
        options.append(
            checkbox('Follow my moves (select the move Fok just used)', this.following, on => this.following = on),
            checkbox('Show its hitbox on Fok (cyan), and the knockback angle', this.showPreview, on => this.showPreview = on),
        );
        this.box.body.append(this.picker, options, this.editor);
        this.build();
    }

    /** Fok used `key`: select it, if following. */
    follow(key: string): void {
        if (!this.following || key === this.selected.key) return;
        const move = MOVES.find(m => m.key === key);
        if (!move) return;
        this.selected = move;
        this.build();
    }

    changes(): number {
        return Object.keys(tuningChanges().moves ?? {}).length;
    }

    override updateTitle(): void {
        super.updateTitle();
        this.buildPicker();
    }

    protected resetPanel(): void {
        for (const move of MOVES) this.resetMove(move.key);
        this.build();
        this.tools.save();
        this.tools.touched();
    }

    private resetMove(key: string): void {
        for (const field of Object.keys(MOVE_SETTINGS) as MoveField[]) setMoveValue(key, field, defaultMoveValue(key, field));
        setMoveValue(key, 'shouldStallInAir', defaultMoveValue(key, 'shouldStallInAir'));
    }

    private buildPicker(): void {
        const changed = tuningChanges().moves ?? {};
        const options = MOVES.map(move => [move.key, move.label + (move.key in changed ? '  •' : '')] as [string, string]);
        this.picker.replaceChildren(choice('Move', options, this.selected.key, key => {
            this.selected = MOVES.find(m => m.key === key) ?? MOVES[0];
            this.build();
        }));
    }

    private build(): void {
        this.rows.length = 0;
        this.buildPicker();
        const move = this.selected;
        const key = move.key;
        const access: Access<MoveField> = {
            get: field => moveValue(key, field) as number,
            set: (field, value) => setMoveValue(key, field, value),
            fallback: field => defaultMoveValue(key, field) as number,
        };
        const row = (field: Exclude<MoveField, 'shouldStallInAir'>) => {
            const r = this.settingRow(MOVE_SETTINGS[field], access);
            this.rows.push({ row: r, section: null, panel: this.box });
            return r.node;
        };
        const notes: HTMLElement[] = [];
        if (move.signature) notes.push(note('A signature: its damage is in COMBAT › SIGNATURES, and it hits where its ghost is (COMBAT › GHOSTS).'));
        if (move.groundPound) notes.push(note('The ground pound: its damage and timing are in COMBAT › GROUND POUND.'));

        const hitting = [
            ...(move.signature || move.groundPound ? [] : [row('damage')]),
            row('baseKnockback'), row('knockbackGrowth'), row('knockbackAngle'),
        ];
        const timing = move.groundPound ? [] : [row('startupDuration'), row('activeDuration'), row('recoveryDuration')];
        const hitbox = move.signature ? [] : [row('hitboxWidth'), row('hitboxHeight'), row('hitboxOffsetX'), row('hitboxOffsetY')];
        const stall = toggleRow('Stalls in the air', () => moveValue(key, 'shouldStallInAir') as boolean,
            value => setMoveValue(key, 'shouldStallInAir', value), defaultMoveValue(key, 'shouldStallInAir') as boolean, () => {
                this.tools.save();
                this.tools.touched();
            });
        this.rows.push({ row: stall, section: null, panel: this.box });

        this.editor.replaceChildren(
            ...notes,
            section('HIT', true, ...hitting),
            ...(timing.length ? [section('TIMING', true, ...timing, hint('Steps are 16.7 ms: the small number is how many steps it lasts.'))] : []),
            ...(hitbox.length ? [section('HITBOX', true, ...hitbox)] : []),
            section('MORE', false, stall.node),
            buttons(button('Reset this move', () => {
                this.resetMove(key);
                this.build();
                this.tools.save();
                this.tools.touched();
            })),
        );
        this.updateTitle();
    }
}

/** TEST: time, the dummy, readouts, measurements, find, and the screen effects. */
class TestPanel extends FeelPanel {
    hitboxes = true;
    private readonly host: FeelHost;
    private speed = 1;
    private frozen = false;
    private dummyDamage = 0;
    private holdDamage = false;
    private infiniteLives = true;
    private readonly freezeBox: HTMLInputElement;
    private readonly lastHit = element('div');
    private readonly live = element('div');
    private readonly measured = element('div');
    private hit: { text: string; target: number; frame: number; stunFrames: number | null } | null = null;
    private readoutAt = 0;

    constructor(host: FeelHost, tools: PanelTools, findRows: () => FindableRow[], place: { top: number; left: number }) {
        super('TEST', tools, place);
        this.host = host;
        for (const node of [this.lastHit, this.live, this.measured]) node.className = 'readout';

        const speed = tuneRow({ key: 'speed', label: 'Game speed', unit: 'times', hint: 'Slow motion for watching hitboxes and ghosts.' },
            [0.05, 1, 0.05], () => this.speed, value => {
                this.speed = value;
                this.applyTime();
            }, 1, () => undefined);
        const freeze = checkbox('Freeze (F) · next step: N', false, on => {
            this.frozen = on;
            this.applyTime();
        });
        this.freezeBox = freeze.querySelector('input')!;

        const dummy = tuneRow({ key: 'dummy', label: 'Dummy damage', unit: '%', hint: 'Sets the dummy\'s damage now; with Hold, it goes back to it after every hit.' },
            [0, 300, 1], () => this.dummyDamage, value => {
                this.dummyDamage = value;
                const f = this.host.match.fighters[DUMMY];
                if (f) f.damagePercent = value;
            }, 0, () => undefined);

        const find = document.createElement('input');
        find.type = 'search';
        find.className = 'find';
        find.placeholder = 'Find a setting (e.g. jump, ghost, hitstun)';
        find.addEventListener('input', () => filterRows(findRows(), find.value.trim().toLowerCase()));

        this.box.body.append(
            find,
            section('TIME', true, speed.node, freeze, buttons(
                button('Next step (N)', () => this.nextFrame()),
                button('Restart match (R)', () => host.restartMatch()),
            )),
            section('DUMMY', true, dummy.node,
                checkbox('Hold this damage', false, on => this.holdDamage = on),
                checkbox('Dummy fights back (T)', false, on => {
                    for (const p of this.host.players) if (p.isAI) p.isTrainingDummy = !on;
                }),
                checkbox('Infinite lives', true, on => this.infiniteLives = on),
                checkbox('Show hitboxes', true, on => {
                    this.hitboxes = on;
                    this.host.setHitboxes(on);
                })),
            section('LAST HIT', true, this.lastHit),
            section('LIVE', false, this.live),
            section('MEASURED', true, this.measured, hint('From the simulation with the current settings.')),
            ...this.groups(EFFECT_GROUPS, effectAccess, 0),
        );
        this.lastHit.textContent = 'Hit the dummy.';
        this.updateTitle();
    }

    changes(): number {
        return Object.keys(tuningChanges().effects ?? {}).length;
    }

    protected resetPanel(): void {
        for (const key of Object.keys(DEFAULT_EFFECTS) as EffectKey[]) setEffect(key, DEFAULT_EFFECTS[key]);
        this.refresh();
        this.tools.save();
        this.tools.touched();
    }

    toggleFreeze(): void {
        this.frozen = !this.frozen;
        this.freezeBox.checked = this.frozen;
        this.applyTime();
    }

    nextFrame(): void {
        if (!this.frozen) this.toggleFreeze();
        this.host.stepFrame();
    }

    onEvent(event: MatchEvent): void {
        if (event.type === 'hit') {
            const target = this.host.match.fighters[event.target];
            const knockback = Math.hypot(event.knockbackX, event.knockbackY);
            const angle = Math.round((Math.atan2(-event.knockbackY, Math.abs(event.knockbackX)) * 180) / Math.PI + 360) % 360;
            const move = event.attackKey ? MOVES.find(m => m.key === event.attackKey)?.label ?? event.attackKey : 'Recovery';
            this.hit = {
                text: `<b>${move}</b>  ${event.damage}% → target at ${target.damagePercent}%\n` +
                    `Knockback ${Math.round(knockback)} px/s at ${angle}°\nHit-stop ${target.hitstopSteps} steps`,
                target: event.target, frame: this.host.match.frame, stunFrames: null,
            };
            this.showHit();
        } else if (event.type === 'ko' && this.hit && event.fighter === this.hit.target) {
            this.hit.text += '\n<b>KO</b>';
            this.showHit();
        }
    }

    /** Once per frame. */
    update(): void {
        const match = this.host.match;
        const dummy = match.fighters[DUMMY];
        if (this.infiniteLives) {
            for (const f of match.fighters) if (f.lives > 0 && f.lives < START_LIVES) f.lives = START_LIVES;
        }
        if (dummy && this.holdDamage && dummy.respawnSteps === 0 && !dummy.isHitStunned && dummy.hitstopSteps === 0) {
            dummy.damagePercent = this.dummyDamage;
        }
        if (this.hit && this.hit.stunFrames === null) {
            const target = match.fighters[this.hit.target];
            if (!target.isHitStunned) {
                this.hit.stunFrames = match.frame - this.hit.frame;
                this.showHit();
            }
        }
        const now = performance.now();
        if (now - this.readoutAt < 100) return;
        this.readoutAt = now;
        const f = match.fighters[0];
        if (!f) return;
        const b = f.body;
        this.live.innerHTML = `<b>Fok</b>  ${f.state}${b.isGrounded ? ', grounded' : ''}\n` +
            `Speed ${Math.round(b.vx)}, ${Math.round(b.vy)} px/s\nJumps left ${b.jumpsRemaining} · ${f.damagePercent}%` +
            (dummy ? `\n<b>Dummy</b>  ${dummy.state} · ${dummy.damagePercent}%` : '');
    }

    remeasure(): void {
        let m: Measurements;
        try {
            m = measure();
        } catch {
            this.measured.textContent = 'Couldn\'t measure with these settings.';
            return;
        }
        this.measured.innerHTML =
            `Jump <b>${m.jumpHeight} px</b>, top in ${m.jumpFrames} steps, ${m.jumpAirFrames} in the air\n` +
            `Short hop <b>${m.shortHopHeight} px</b> · Air jump <b>+${m.airJumpHeight} px</b>\n` +
            `Top speed <b>${m.runSpeed} px/s</b> · Dash <b>${m.dashDistance} px</b>`;
    }

    private showHit(): void {
        if (!this.hit) return;
        const stun = this.hit.stunFrames === null ? '' : `\nStun ${this.hit.stunFrames} steps (${Math.round(this.hit.stunFrames * 16.7)} ms)`;
        this.lastHit.innerHTML = this.hit.text + stun;
    }

    private applyTime(): void {
        this.host.setTime(this.speed, this.frozen);
    }
}

// ─── Find ───

/** Shows only rows matching `query`, opening the sections and panels they're in; an empty query shows everything. */
function filterRows(rows: FindableRow[], query: string): void {
    const sections = new Map<HTMLDetailsElement, boolean>();
    for (const { row, section, panel } of rows) {
        const match = query === '' || row.text.includes(query);
        row.node.style.display = match ? '' : 'none';
        if (section) sections.set(section, (sections.get(section) ?? false) || match);
        if (match && query.length >= 2) panel.setFolded(false);
    }
    for (const [section, anyMatch] of sections) {
        section.style.display = anyMatch ? '' : 'none';
        if (query !== '' && anyMatch) section.open = true;
    }
}

function note(text: string): HTMLElement {
    const node = element('div', text);
    node.className = 'note';
    return node;
}

// ─── Hitbox preview ───

const PREVIEW = 0x5fe3ff;

/** The selected move's hitbox where it would be on Fok now, and its knockback angle. */
function drawPreview(g: Phaser.GameObjects.Graphics, host: FeelHost, move: MoveInfo): void {
    const f = host.match.fighters[0];
    if (!f || f.respawnSteps > 0) return;
    const b = f.body;
    const facing = b.facingDirection;
    const data = AttackRegistry[move.key];

    let centreX: number;
    let centreY: number;
    if (move.signature) {
        // The ghost's start, and where it ends up with no charge and at full charge
        const vertical = data.direction === AttackDirection.UP || data.direction === AttackDirection.NEUTRAL;
        const offset = f.character === 'nock' ? PhysicsConfig.NOCK_GHOST_OFFSET : PhysicsConfig.GHOST_OFFSET;
        const startX = b.x + offset * facing + (vertical ? 0 : PhysicsConfig.GHOST_FORWARD * facing);
        const startY = b.y - (vertical ? PhysicsConfig.GHOST_LIFT : 0);
        const size = 256 * PhysicsConfig.GHOST_HITBOX_SCALE;
        const end = (travel: number) => vertical ? [startX, startY - travel] : [startX + travel * facing, startY];
        const [x0, y0] = end(PhysicsConfig.GHOST_TRAVEL);
        const [x1, y1] = end(PhysicsConfig.GHOST_TRAVEL + PhysicsConfig.GHOST_TRAVEL_PER_CHARGE);
        g.lineStyle(1, PREVIEW, 0.5).strokeRect(startX - size / 2, startY - size / 2, size, size);
        g.lineStyle(2, PREVIEW, 0.9).strokeRect(x0 - size / 2, y0 - size / 2, size, size);
        g.lineStyle(1, PREVIEW, 0.6).strokeRect(x1 - size / 2, y1 - size / 2, size, size);
        g.lineBetween(startX, startY, x1, y1);
        centreX = x0;
        centreY = y0;
    } else {
        centreX = b.x + data.hitboxOffsetX * facing;
        centreY = b.y + data.hitboxOffsetY;
        g.fillStyle(PREVIEW, 0.12).fillRect(centreX - data.hitboxWidth / 2, centreY - data.hitboxHeight / 2, data.hitboxWidth, data.hitboxHeight);
        g.lineStyle(2, PREVIEW, 0.9).strokeRect(centreX - data.hitboxWidth / 2, centreY - data.hitboxHeight / 2, data.hitboxWidth, data.hitboxHeight);
    }

    // Knockback angle: 0 forward, 90 up
    const radians = (data.knockbackAngle * Math.PI) / 180;
    const length = 90;
    const tipX = centreX + Math.cos(radians) * length * facing;
    const tipY = centreY - Math.sin(radians) * length;
    g.lineStyle(3, 0xffffff, 0.9).lineBetween(centreX, centreY, tipX, tipY);
    const back = Math.atan2(centreY - tipY, centreX - tipX);
    for (const side of [-0.5, 0.5]) {
        g.lineBetween(tipX, tipY, tipX + Math.cos(back + side) * 14, tipY + Math.sin(back + side) * 14);
    }
    if (data.type === AttackType.HEAVY && move.groundPound) g.fillStyle(PREVIEW, 0.8).fillCircle(b.x, b.y, 3);
}

// ─── Kept in the browser, copied, pasted ───

function loadSaved(): unknown {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    } catch {
        return null;
    }
}

function save(): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tuningChanges()));
    } catch {
        // Browser storage unavailable: the settings last until the page reloads
    }
}

/** The changes (or every value) as JSON, on the clipboard and in the console, ready to paste to Claude. */
function copy(all: boolean): void {
    const json = JSON.stringify({ sgalallaFeel: 1, ...(all ? allTuning() : tuningChanges()) }, null, 2);
    console.log(json);
    navigator.clipboard?.writeText(json).catch(() => undefined);
}
