import Phaser from 'phaser';
import { charConfigs } from '../config/CharacterConfig';

/**
 * A player's card in the character select screens (BOTTE IN LOCALE and BOTTE
 * IN REMOTO): a rounded card in the player's colour with a soft gradient, the
 * fighter's idle animation standing on a shadow, arrows while choosing, the
 * slot label and the fighter's name, and a line of state over the fighter
 * ("PRONTO!", "Premi per entrare"...).
 */

export const CARD_WIDTH = 180;
export const CARD_HEIGHT = 300;
const READY_COLOUR = 0x00ff00;

/** What a card shows: nobody yet, or a fighter and how far along its player is. */
export type CardState =
    | { kind: 'empty'; text: string }
    | { kind: 'fighter'; character: string; ready: boolean; choosing: boolean; text?: string; textColour?: string };

export class PlayerCard {
    readonly container: Phaser.GameObjects.Container;
    private readonly scene: Phaser.Scene;
    private readonly colour: number;
    private readonly card: Phaser.GameObjects.Graphics;
    private readonly label: Phaser.GameObjects.Text;
    private readonly stateText: Phaser.GameObjects.Text;
    private readonly nameText: Phaser.GameObjects.Text;
    private readonly arrows: Phaser.GameObjects.Text[];
    private readonly sprite: Phaser.GameObjects.Sprite;
    private readonly shadow: Phaser.GameObjects.Ellipse;
    private readonly gradientMask: Phaser.GameObjects.Graphics;

    constructor(scene: Phaser.Scene, x: number, y: number, label: string, colour: number) {
        this.scene = scene;
        this.colour = colour;
        const colourHex = '#' + colour.toString(16).padStart(6, '0');
        ensureIdleAnimations(scene);
        this.container = scene.add.container(x, y);

        // A soft gradient in the player's colour, clipped to the card's rounded corners
        const gradient = scene.add.graphics();
        gradient.fillGradientStyle(colour, colour, 0x000000, 0x000000, 0.2, 0.2, 0.2, 0.2);
        gradient.fillRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT);
        this.gradientMask = scene.make.graphics({});
        this.gradientMask.fillStyle(0xffffff).fillRoundedRect(x - CARD_WIDTH / 2, y - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 16);
        gradient.setMask(this.gradientMask.createGeometryMask());

        this.shadow = scene.add.ellipse(0, 10, 80, 20, 0x000000, 0.5).setVisible(false);
        this.card = scene.add.graphics();
        this.label = scene.add.text(0, 75, label, { fontSize: '20px', fontStyle: 'bold', fontFamily: '"Pixeloid Sans"', color: colourHex }).setOrigin(0.5);
        this.nameText = scene.add.text(0, 105, '', { fontSize: '22px', color: '#ffffff', fontFamily: '"Pixeloid Sans"', fontStyle: 'bold' }).setOrigin(0.5);
        this.arrows = [-70, 70].map((ax, i) => scene.add.text(ax, 0, i === 0 ? '◀' : '▶', {
            fontSize: '28px', fontFamily: '"Pixeloid Sans"', color: colourHex,
        }).setOrigin(0.5).setVisible(false));
        this.sprite = scene.add.sprite(0, -45, 'fok', 'fok_idle_000').setVisible(false);
        this.stateText = scene.add.text(0, -45, '', { fontSize: '22px', color: '#888888', fontFamily: '"Pixeloid Sans"', align: 'center' }).setOrigin(0.5);

        this.container.add([gradient, this.shadow, this.card, this.label, this.nameText, ...this.arrows, this.sprite, this.stateText]);
        this.show({ kind: 'empty', text: '' });
    }

    show(state: CardState): void {
        const card = this.card.clear();
        if (state.kind === 'empty') {
            card.lineStyle(2, 0x333333).fillStyle(0x000000, 0.2);
            drawCard(card);
            this.setState(state.text, '#555555', 20);
            this.nameText.setVisible(false);
            this.sprite.setVisible(false);
            this.shadow.setVisible(false);
            this.arrows.forEach(a => a.setVisible(false));
            return;
        }

        card.lineStyle(3, state.ready ? READY_COLOUR : this.colour).fillStyle(0x000000, 0.4);
        drawCard(card);
        this.sprite.setVisible(true);
        this.shadow.setVisible(true);
        const idle = `${state.character}_idle`;
        if (this.sprite.anims.currentAnim?.key !== idle) {
            this.sprite.setTexture(state.character);
            if (this.scene.anims.exists(idle)) this.sprite.play(idle, true);
        }
        this.nameText.setText(nameOf(state.character)).setVisible(true);
        this.arrows.forEach(a => a.setVisible(state.choosing && !state.ready));

        if (state.ready) {
            this.setState(state.text ?? 'PRONTO!', '#00ff00', 36, '#004400');
        } else {
            this.setState(state.text ?? '', state.textColour ?? '#ffff00', 20);
        }
    }

    setLabel(text: string): void {
        this.label.setText(text);
    }

    setVisible(visible: boolean): void {
        this.container.setVisible(visible);
    }

    destroy(): void {
        this.container.destroy(true);
        this.gradientMask.destroy();
    }

    private setState(text: string, colour: string, size: number, background = ''): void {
        this.stateText.setText(text).setColor(colour).setFontSize(size).setBackgroundColor(background);
    }
}

function drawCard(g: Phaser.GameObjects.Graphics): void {
    g.fillRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 16);
    g.strokeRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 16);
}

/** `fok` → `Fok`. */
export function nameOf(character: string): string {
    return character.charAt(0).toUpperCase() + character.slice(1);
}

/** Every fighter's idle animation, for the cards; made once per game. */
function ensureIdleAnimations(scene: Phaser.Scene): void {
    for (const [character, config] of Object.entries(charConfigs)) {
        const key = `${character}_idle`;
        if (scene.anims.exists(key) || !config.idle) continue;
        const frames = Array.from({ length: config.idle.count }, (_, f) => ({ key: character, frame: `${config.idle!.prefix}${String(f).padStart(3, '0')}` }));
        scene.anims.create({ key, frames, frameRate: 10, repeat: -1 });
    }
}

/** X positions for `count` cards centred across the screen, the offline lobby's spacing. */
export function cardPositions(width: number, count: number): number[] {
    const spacing = count > 4 ? 220 : count <= 2 ? 260 : 200;
    const start = width / 2 - ((count - 1) * spacing) / 2;
    return Array.from({ length: count }, (_, i) => start + i * spacing);
}
