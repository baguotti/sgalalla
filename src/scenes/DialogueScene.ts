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

    constructor() {
        super('DialogueScene');
    }

    create() {
        const { width, height } = this.scale;

        // Dark semi-transparent background for focus
        this.add.rectangle(0, 0, width, height, 0x000000, 0.4).setOrigin(0);

        // Dialogue Box (Bottom)
        this.dialogueBox = this.add.rectangle(width / 2, height - 100, width * 0.8, 150, 0x222222, 0.9)
            .setStrokeStyle(4, 0xffffff);

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
        });

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

        // TODO: Handle portraits if added later
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

        // Stop the scene completely and restore focus to GameScene underneath
        this.scene.stop();
    }
}
