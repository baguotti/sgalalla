import Phaser from 'phaser';

export interface DialogueLine {
    speaker: string;
    text: string;
    side: 'left' | 'right';
}

export class DialogueScene extends Phaser.Scene {
    private dialogueBox!: Phaser.GameObjects.Rectangle;
    private textElement!: Phaser.GameObjects.Text;
    private nameElement!: Phaser.GameObjects.Text;
    private lines: DialogueLine[] = [];
    private currentLineIndex: number = 0;
    private onDialogueComplete: (() => void) | null = null;

    private leftCharacterKey: string = 'fok';
    private rightCharacterKey: string = 'sgu';

    private leftPortrait!: Phaser.GameObjects.Sprite;
    private rightPortrait!: Phaser.GameObjects.Sprite;

    constructor() {
        super('DialogueScene');
    }

    init(data: any) {
        if (data.leftCharacter) this.leftCharacterKey = data.leftCharacter.toLowerCase();
        if (data.rightCharacter) this.rightCharacterKey = data.rightCharacter.toLowerCase();
        // Store dialogue data to auto-play in create()
        if (data.dialogueData && Array.isArray(data.dialogueData)) {
            this.lines = data.dialogueData;
        } else {
            this.lines = [];
        }
        this.currentLineIndex = 0;
    }

    create() {
        const { width, height } = this.scale;

        // Dark semi-transparent background for focus
        this.add.rectangle(0, 0, width, height, 0x000000, 0.4).setOrigin(0);

        // Dialogue Box (Bottom)
        this.dialogueBox = this.add.rectangle(width / 2, height - 100, width * 0.8, 150, 0x222222, 0.9)
            .setStrokeStyle(4, 0xffffff)
            .setDepth(15);

        // This makes sure it's not marked as unused by the linter
        this.dialogueBox.setVisible(true);

        // Speaker Name text
        this.nameElement = this.add.text(width / 2 - (width * 0.4) + 20, height - 170, '', {
            fontFamily: '"Pixeloid Sans"',
            fontSize: '20px',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.nameElement.setDepth(20);

        // Text Element
        this.textElement = this.add.text(width / 2 - (width * 0.4) + 20, height - 140, '', {
            fontFamily: '"Pixeloid Sans"',
            fontSize: '24px',
            color: '#ffffff',
            wordWrap: { width: width * 0.8 - 40 }
        }).setDepth(20);

        // Setup input to advance dialogue
        this.input.keyboard?.on('keydown-SPACE', () => this.advanceDialogue(), this);
        this.input.keyboard?.on('keydown-ENTER', () => this.advanceDialogue(), this);

        // Map Gamepad A to advance
        if (this.input.gamepad) {
            this.input.gamepad.on('down', (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
                // Assuming button 0 (A) advances text
                if (button.index === 0) {
                    this.advanceDialogue();
                }
            });
        }

        // Add Portraits
        this.createPortraits(width, height);

        // Auto-start dialogue if lines were passed via init
        if (this.lines.length > 0) {
            this.showCurrentLine();
        }
    }

    private getIconFrame(characterKey: string): string {
        const key = characterKey.toLowerCase();
        if (['fok', 'sgu', 'sga', 'nock', 'greg', 'pe'].includes(key)) {
            return `00_${key}_icon`;
        }
        return `${characterKey}_Idle_000.png`;
    }

    private createPortraits(width: number, height: number) {
        // Dialogue box top edge = height - 100 (center) - 75 (half height) = height - 175
        // Icons at scale 2 = 256*2 = 512px display. Half = 256px.
        // Portrait Y so bottom aligns with dialogue top: (height - 175) - 256 = height - 431
        const portraitY = height - 175 - 256;

        // Box edges at 80% width: 0.1 * width and 0.9 * width
        const boxLeft = width * 0.1;
        const boxRight = width * 0.9;

        // Left Portrait: align left edge with boxLeft
        this.leftPortrait = this.add.sprite(boxLeft + 256, portraitY, this.leftCharacterKey, this.getIconFrame(this.leftCharacterKey))
            .setScale(2)
            .setDepth(10); // Behind dialogueBox (15)

        // Right Portrait: align right edge with boxRight
        this.rightPortrait = this.add.sprite(boxRight - 256, portraitY, this.rightCharacterKey, this.getIconFrame(this.rightCharacterKey))
            .setScale(2)
            .setFlipX(true) // Enemy faces left
            .setDepth(10); // Behind dialogueBox (15)
    }

    public playDialogue(lines: DialogueLine[]): Promise<void> {
        this.lines = lines;
        this.currentLineIndex = 0;

        return new Promise<void>((resolve) => {
            this.onDialogueComplete = resolve;
            this.showCurrentLine();
        });
    }

    private showCurrentLine() {
        if (this.currentLineIndex >= this.lines.length) {
            this.finishDialogue();
            return;
        }

        const line = this.lines[this.currentLineIndex];
        this.nameElement.setText(line.speaker);
        this.textElement.setText(line.text);

        // Highlight active speaker, dim the other
        const isLeftSpeaking = line.side === 'left';

        if (this.leftPortrait) {
            this.leftPortrait.setTint(isLeftSpeaking ? 0xffffff : 0x555555);
        }
        if (this.rightPortrait) {
            this.rightPortrait.setTint(isLeftSpeaking ? 0x555555 : 0xffffff);
        }
    }

    private advanceDialogue() {
        this.currentLineIndex++;
        this.showCurrentLine();
    }

    private finishDialogue() {
        if (this.onDialogueComplete) {
            this.onDialogueComplete();
            this.onDialogueComplete = null;
        }

        // Emit event so GameScene can listen for dialogue completion
        this.events.emit('dialogue_complete');

        // Stop the scene completely and restore focus to GameScene underneath
        this.scene.stop();
    }
}
