import Phaser from 'phaser';

export interface DialogueLine {
    speaker: string;
    text: string;
    side: 'left' | 'right';
    animation?: string; // Optional: sprite/animation to show (e.g. "idle", "taunt", "hurt")
}

export class DialogueScene extends Phaser.Scene {
    private dialogueBox!: Phaser.GameObjects.Graphics;
    private textElement!: Phaser.GameObjects.Text;
    private nameElement!: Phaser.GameObjects.Text;
    private lines: DialogueLine[] = [];
    private currentLineIndex: number = 0;
    private onDialogueComplete: (() => void) | null = null;

    private leftCharacterKey: string = 'fok';
    private rightCharacterKey: string = 'sgu';

    private leftPortrait!: Phaser.GameObjects.Sprite;
    private rightPortrait!: Phaser.GameObjects.Sprite;

    private isTyping: boolean = false;
    private typewriterTimer?: Phaser.Time.TimerEvent;
    private textMask!: Phaser.GameObjects.Graphics;

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

        // Dialogue Box Dimensions
        const boxWidth = width * 0.8;
        const boxHeight = 240; // Increased height
        const boxX = (width - boxWidth) / 2;
        const boxY = height - boxHeight - 50; // 50px from bottom

        // Dialogue Box (Bottom)
        this.dialogueBox = this.add.graphics();
        this.dialogueBox.fillStyle(0x1a1a1a, 0.95);
        this.dialogueBox.fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 16);
        this.dialogueBox.lineStyle(4, 0x444444);
        this.dialogueBox.strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 16);
        this.dialogueBox.setDepth(15);

        // Anchor coordinates inside the box
        const textRightAnchor = boxX + boxWidth - 40;

        // Speaker Name text (Keep on right)
        this.nameElement = this.add.text(textRightAnchor, boxY + 20, '', {
            fontFamily: '"Pixeloid Sans"',
            fontSize: '36px',
            fontStyle: 'bold',
            color: '#ffffff', // Changed to white
            stroke: '#000000',
            strokeThickness: 4,
            align: 'right'
        }).setOrigin(1, 0).setDepth(20);

        // Text Element (Right aligned)
        this.textElement = this.add.text(textRightAnchor, boxY + 80, '', {
            fontFamily: '"Pixeloid Sans"',
            fontSize: '48px',
            color: '#ffffff',
            wordWrap: { width: boxWidth - 80 },
            align: 'right'
        }).setOrigin(1, 0).setDepth(20);

        // Create an invisible mask for the typewriter reveal
        this.textMask = this.make.graphics();
        this.textElement.setMask(this.textMask.createGeometryMask());

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
        // Dialogue box top edge = height - 240 (box height) - 50 (margin) = height - 290
        // Icons at scale 2 = 256*2 = 512px display. Half = 256px.
        // Portrait Y so bottom aligns with dialogue top: (height - 290) - 256
        const portraitY = height - 290 - 256;

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

        // --- Typewriter Effect via Masking ---
        if (this.typewriterTimer) this.typewriterTimer.remove();

        // Show FULL text immediately so it takes its final right-aligned position
        this.textElement.setText(line.text);

        // Reset mask to empty (hide everything)
        this.textMask.clear();
        this.isTyping = true;

        const boxWidth = this.scale.width * 0.8;
        const boxHeight = 240;
        const boxX = (this.scale.width - boxWidth) / 2;
        const boxY = this.scale.height - boxHeight - 50;

        let charIndex = 0;
        this.typewriterTimer = this.time.addEvent({
            delay: 15, // Fast typewriter
            callback: () => {
                charIndex++;

                // Redraw mask to reveal more of the area
                // We reveal the entire box width but grow the mask height or X
                // For a simpler "appears letter by letter" without sliding:
                // We keep the mask covering the full height but grow from left to right
                this.textMask.clear();
                this.textMask.fillStyle(0xffffff);

                // Because it is right-aligned, the text block might be shorter than the box.
                // We just reveal the whole box width proportionally to char count.
                const revealPercent = charIndex / line.text.length;
                this.textMask.fillRect(boxX, boxY, boxWidth * revealPercent, boxHeight);

                if (charIndex >= line.text.length) {
                    this.isTyping = false;
                    this.textMask.clear();
                    this.textMask.fillRect(boxX, boxY, boxWidth, boxHeight); // Fully reveal
                    if (this.typewriterTimer) this.typewriterTimer.remove();
                }
            },
            repeat: line.text.length - 1
        });

        // Always emit animation — default to 'idle' when no animation is specified
        this.events.emit('dialogue_animation', line.side, line.animation || 'idle');

        if (this.leftPortrait) {
            this.leftPortrait.setTint(0xffffff);
            this.leftPortrait.stop();
            this.leftPortrait.setFrame(this.getIconFrame(this.leftCharacterKey));
        }

        if (this.rightPortrait) {
            this.rightPortrait.setTint(0xffffff);
            this.rightPortrait.stop();
            this.rightPortrait.setFrame(this.getIconFrame(this.rightCharacterKey));
        }
    }

    private advanceDialogue() {
        if (this.isTyping) {
            // Skip typing - show full text immediately
            if (this.typewriterTimer) this.typewriterTimer.remove();
            this.isTyping = false;

            // Clear mask to show everything
            const boxWidth = this.scale.width * 0.8;
            const boxX = (this.scale.width - boxWidth) / 2;
            const boxY = this.scale.height - 240 - 50;
            this.textMask.clear();
            this.textMask.fillStyle(0xffffff);
            this.textMask.fillRect(boxX, boxY, boxWidth, 240);
        } else {
            this.currentLineIndex++;
            this.showCurrentLine();
        }
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
