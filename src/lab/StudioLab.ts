import Phaser from 'phaser';
import type { GameSceneData, PlayerSlot } from '../scenes/GameScene';
import type { Lighting } from '../lighting/Lighting';
import { LIGHT_LAB_SCENE_DATA, startLightLab, type LabScene, type LookLab } from '../lighting/LightLab';
import { DOCK_WIDTH, element, type LabPanelBox } from '../lighting/lab/LabUi';
import { PERFORMANCE_BAND } from '../lighting/lab/LabStats';
import { ALL_CHARACTERS } from '../config/CharacterConfig';
import { FeelLab, type FeelHost } from './FeelLab';
import { addFeelStyles } from './FeelUi';

/**
 * The Studio Lab (main menu) in two modes, TAB switching between them: LOOK
 * tunes the lighting, camera and stage (LightLab), FEEL every gameplay setting
 * (FeelLab). Full screen, the panels float over the game; windowed, the game
 * sits in the middle with the panels in a column either side. ESC opens the
 * Lab's pause menu (mode, view, characters); H hides the panels. In FEEL: F
 * freezes, N steps one frame, R restarts the match.
 */

export type LabMode = 'look' | 'feel';

const MODE_KEY = 'sgalalla.labMode';
const WINDOWED_KEY = 'sgalalla.labWindowed';
const FIGHTERS_KEY = 'sgalalla.labFighters';

export interface StudioLab {
    lighting: Lighting | null;
    feel: FeelLab;
    readonly mode: LabMode;
    setMode(mode: LabMode): void;
    readonly windowed: boolean;
    setWindowed(windowed: boolean): void;
    /** While the pause menu is up: full screen, the panels step aside. */
    setSuspended(suspended: boolean): void;
}

export function startStudioLab(scene: Phaser.Scene, look: LabScene, feelHost: FeelHost & { isPaused(): boolean }): StudioLab {
    const lookLab: LookLab | null = startLightLab(scene, look);
    const feel = new FeelLab(scene, feelHost);
    addFeelStyles();

    let mode: LabMode = loadString(MODE_KEY) === 'feel' ? 'feel' : 'look';
    let windowed = loadString(WINDOWED_KEY) === 'true';
    let shown = true;
    let suspended = false;

    const bar = element('div');
    bar.className = 'lab-mode';
    const lookButton = element('button', 'LOOK');
    const feelButton = element('button', 'FEEL');
    const viewButton = element('button');
    lookButton.title = 'Lights, camera and stage';
    feelButton.title = 'Every gameplay setting';
    viewButton.title = 'The game in the middle with the panels either side, or full screen';
    bar.append(lookButton, feelButton, element('span', 'TAB'), viewButton);
    document.body.append(bar);

    const view = new WindowedView(scene, [...(lookLab ? [lookLab.columns] : []), feel.columns], on => lookLab?.setWindowed(on));

    const apply = () => {
        const visible = shown && !(suspended && !windowed);
        lookLab?.setShown(visible && mode === 'look');
        feel.setShown(visible && mode === 'feel');
        lookButton.classList.toggle('on', mode === 'look');
        feelButton.classList.toggle('on', mode === 'feel');
        viewButton.textContent = windowed ? 'FULL SCREEN' : 'WINDOWED';
        bar.style.display = visible ? '' : 'none';
        view.set(windowed);
        saveString(MODE_KEY, mode);
        saveString(WINDOWED_KEY, String(windowed));
    };
    const lab: StudioLab = {
        lighting: lookLab?.lighting ?? null,
        feel,
        get mode() { return mode; },
        setMode: next => {
            mode = next;
            shown = true;
            apply();
        },
        get windowed() { return windowed; },
        setWindowed: next => {
            windowed = next;
            apply();
        },
        setSuspended: next => {
            suspended = next;
            apply();
        },
    };
    lookButton.addEventListener('click', () => lab.setMode('look'));
    feelButton.addEventListener('click', () => lab.setMode('feel'));
    viewButton.addEventListener('click', () => {
        lab.setWindowed(!windowed);
        viewButton.blur();
    });
    apply();

    const keyboard = scene.input.keyboard;
    const onKey = (event: KeyboardEvent) => {
        if (event.code === 'Tab') event.preventDefault();
        if (feelHost.isPaused() || event.repeat) return;
        switch (event.code) {
            case 'Tab': lab.setMode(mode === 'look' ? 'feel' : 'look'); break;
            case 'KeyH': shown = !shown; apply(); break;
            case 'KeyF': if (mode === 'feel') feel.toggleFreeze(); break;
            case 'KeyN': if (mode === 'feel') feel.nextFrame(); break;
            case 'KeyR': if (mode === 'feel') feel.restart(); break;
        }
    };
    keyboard?.on('keydown', onKey);
    const onPostUpdate = () => feel.update();
    scene.events.on('postupdate', onPostUpdate);

    scene.events.once('shutdown', () => {
        keyboard?.off('keydown', onKey);
        scene.events.off('postupdate', onPostUpdate);
        feel.destroy();
        view.destroy();
        bar.remove();
    });
    return lab;
}

/**
 * The windowed view: the game's container narrowed to the middle of the page
 * (Phaser fits the game into it), and the panels moved into a column either
 * side, under a band on top (`topBand` px, for the PERFORMANCE strip). The
 * DERAPATE Lab uses it too.
 */
export class WindowedView {
    private readonly scene: Phaser.Scene;
    private readonly groups: { left: LabPanelBox[]; right: LabPanelBox[] }[];
    private readonly onChange: (windowed: boolean) => void;
    private readonly container: HTMLElement | null;
    private columns: { left: HTMLElement; right: HTMLElement } | null = null;
    private on = false;
    private readonly topBand: number;

    constructor(scene: Phaser.Scene, groups: { left: LabPanelBox[]; right: LabPanelBox[] }[], onChange: (windowed: boolean) => void,
        topBand = PERFORMANCE_BAND) {
        this.scene = scene;
        this.topBand = topBand;
        this.groups = groups;
        this.onChange = onChange;
        this.container = scene.game.canvas.parentElement;
    }

    set(on: boolean): void {
        if (on === this.on) return;
        this.on = on;
        if (on) {
            const left = element('div');
            left.className = 'lab-dock left';
            const right = element('div');
            right.className = 'lab-dock right';
            document.body.append(left, right);
            this.columns = { left, right };
        }
        for (const group of this.groups) {
            for (const box of group.left) box.dock(on ? this.columns!.left : null);
            for (const box of group.right) box.dock(on ? this.columns!.right : null);
        }
        if (!on) {
            this.columns?.left.remove();
            this.columns?.right.remove();
            this.columns = null;
        }
        this.onChange(on);
        this.fitGame();
    }

    destroy(): void {
        if (!this.on) return;
        this.on = false;
        this.columns?.left.remove();
        this.columns?.right.remove();
        this.columns = null;
        this.fitGame();
    }

    private fitGame(): void {
        const style = this.container?.style;
        if (style) {
            // The page's stylesheet makes the container 100% wide: the width is set outright
            style.position = this.on ? 'fixed' : '';
            // A band on top for the PERFORMANCE strip, so it never covers the game
            style.top = this.on ? `${this.topBand}px` : '';
            style.left = this.on ? `${DOCK_WIDTH}px` : '';
            style.width = this.on ? `calc(100% - ${2 * DOCK_WIDTH}px)` : '';
            style.height = this.on ? `calc(100% - ${this.topBand}px)` : '';
        }
        // Once now and once the next frame: a refresh during the scene's start doesn't stick
        const scale = this.scene.scale;
        scale.refresh();
        requestAnimationFrame(() => scale.refresh());
    }
}

// ─── Characters ───

/** The Lab's scene data with the characters picked in its menu (Fok against Fok at first). */
export function labSceneData(): GameSceneData {
    const saved = labFighters();
    const slots = LIGHT_LAB_SCENE_DATA.playerData ?? [];
    const playerData: PlayerSlot[] = slots.map((slot, i) => ({ ...slot, character: i === 0 ? saved.player : saved.dummy }));
    return { ...LIGHT_LAB_SCENE_DATA, playerData };
}

export function labFighters(): { player: string; dummy: string } {
    try {
        const saved = JSON.parse(localStorage.getItem(FIGHTERS_KEY) ?? 'null');
        const pick = (value: unknown) => typeof value === 'string' && ALL_CHARACTERS.includes(value) ? value : 'fok';
        return { player: pick(saved?.player), dummy: pick(saved?.dummy) };
    } catch {
        return { player: 'fok', dummy: 'fok' };
    }
}

export function saveLabFighters(fighters: { player: string; dummy: string }): void {
    saveString(FIGHTERS_KEY, JSON.stringify(fighters));
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
