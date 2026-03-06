import Phaser from 'phaser';

export interface DialogueLine {
    speaker: string;
    text: string;
    side: 'left' | 'right';
    animation?: string; // Optional: sprite/animation to show (e.g. "idle", "taunt", "hurt")
    choices?: { text: string; action: () => void }[]; // Optional YES/NO choices
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

    // Choices UI
    private choicesContainer?: Phaser.GameObjects.Container;
    private choiceButtons: Phaser.GameObjects.Text[] = [];
    private selectedChoiceIndex: number = 0;
    private isShowingChoices: boolean = false;
    private sceneActive: boolean = false; // Guard against post-stop callbacks

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

        // Reset all choice state from previous launches
        this.isTyping = false;
        this.isShowingChoices = false;
        this.choiceButtons = [];
        this.selectedChoiceIndex = 0;
        this.choicesContainer = undefined;
        this.sceneActive = true;
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
        this.dialogueBox.fillStyle(0x1a1a1a, 0.75); // Lowered by ~20% (was 0.95)
        this.dialogueBox.fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 16);
        this.dialogueBox.lineStyle(4, 0x444444);
        this.dialogueBox.strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 16);
        this.dialogueBox.setDepth(15);

        // Anchor coordinates inside the box
        const textRightAnchor = boxX + boxWidth - 40;

        // Speaker Name text (Positioned dynamically per speaker)
        this.nameElement = this.add.text(0, 0, '', {
            fontFamily: '"Pixeloid Sans"',
            fontSize: '32px', // Larger for floating visibility
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8, // Thicker stroke for floating text
            align: 'center'
        }).setOrigin(0.5, 1).setDepth(20);

        // Text Element (Right aligned)
        this.textElement = this.add.text(textRightAnchor, boxY + 40, '', {
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
        this.input.keyboard?.on('keydown-SPACE', () => this.handleConfirm(), this);
        this.input.keyboard?.on('keydown-ENTER', () => this.handleConfirm(), this);

        // Choice navigation
        this.input.keyboard?.on('keydown-LEFT', () => this.navigateChoice(-1), this);
        this.input.keyboard?.on('keydown-RIGHT', () => this.navigateChoice(1), this);
        this.input.keyboard?.on('keydown-A', () => this.navigateChoice(-1), this);
        this.input.keyboard?.on('keydown-D', () => this.navigateChoice(1), this);

        // Map Gamepad
        if (this.input.gamepad) {
            this.input.gamepad.on('down', (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
                // Assuming button 0 (A) advances text/confirms
                if (button.index === 0) {
                    this.handleConfirm();
                }
                // D-pad navigation
                if (button.index === 14) this.navigateChoice(-1); // Left
                if (button.index === 15) this.navigateChoice(1);  // Right
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

        // Left Portrait: only create if texture exists
        try {
            if (this.textures.exists(this.leftCharacterKey)) {
                this.leftPortrait = this.add.sprite(boxLeft + 256, portraitY, this.leftCharacterKey, this.getIconFrame(this.leftCharacterKey))
                    .setScale(2)
                    .setDepth(10);
            }
        } catch (e) {
            console.warn('DialogueScene: Could not create left portrait', e);
        }

        // Right Portrait: only create if texture exists
        try {
            if (this.textures.exists(this.rightCharacterKey)) {
                this.rightPortrait = this.add.sprite(boxRight - 256, portraitY, this.rightCharacterKey, this.getIconFrame(this.rightCharacterKey))
                    .setScale(2)
                    .setFlipX(true)
                    .setDepth(10);
            }
        } catch (e) {
            console.warn('DialogueScene: Could not create right portrait', e);
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

        // Position name above the active portrait
        const activePortrait = line.side === 'left' ? this.leftPortrait : this.rightPortrait;
        if (activePortrait) {
            // Align to bottom center of the sprite
            // Since origin is (0.5, 1), the text bottom will sit exactly on this point
            // We use the bottom of the portrait (portraitY + displayHeight/2)
            // And maybe a tiny 5px lift to not touch the box edge
            this.nameElement.setPosition(activePortrait.x, activePortrait.y + (activePortrait.displayHeight / 2) - 5);
        }

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

                    if (line.choices && line.choices.length > 0) {
                        this.showChoices(line.choices);
                    }
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

    private handleConfirm() {
        if (!this.sceneActive) return;
        if (this.isShowingChoices) {
            this.confirmChoice();
        } else {
            this.advanceDialogue();
        }
    }

    private advanceDialogue() {
        // Prevent advancing normally if choices are on screen
        if (this.isShowingChoices) return;

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

            const line = this.lines[this.currentLineIndex];
            if (line.choices && line.choices.length > 0) {
                this.showChoices(line.choices);
            }
        } else {
            this.currentLineIndex++;
            this.showCurrentLine();
        }
    }

    private showChoices(choices: { text: string; action: () => void }[]) {
        if (this.isShowingChoices) return;
        this.isShowingChoices = true;
        this.selectedChoiceIndex = 0;

        if (this.choicesContainer) {
            this.choicesContainer.destroy();
        }

        const boxWidth = this.scale.width * 0.8;
        const boxX = (this.scale.width - boxWidth) / 2;
        const boxY = this.scale.height - 240 - 50;

        this.choicesContainer = this.add.container(boxX + boxWidth - 40, boxY + 160);
        this.choicesContainer.setDepth(20);
        this.choiceButtons = [];

        let currentX = 0;
        // Build right-to-left layout for right-aligned UI
        for (let i = choices.length - 1; i >= 0; i--) {
            const choice = choices[i];
            const btn = this.add.text(currentX, 0, choice.text, {
                fontFamily: '"Pixeloid Sans"',
                fontSize: '36px',
                color: '#888888', // Unselected
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(1, 0.5);

            // Interactive bounds
            btn.setInteractive();
            btn.on('pointerdown', () => {
                this.selectedChoiceIndex = i;
                this.updateChoiceSelection();
                this.confirmChoice();
            });
            btn.on('pointerover', () => {
                this.selectedChoiceIndex = i;
                this.updateChoiceSelection();
            });

            this.choiceButtons.unshift(btn); // Put at start to maintain matching index
            this.choicesContainer.add(btn);
            currentX -= btn.width + 60; // Space between buttons
        }

        this.updateChoiceSelection();
    }

    private navigateChoice(dir: number) {
        if (!this.sceneActive || !this.isShowingChoices || this.choiceButtons.length === 0) return;
        this.selectedChoiceIndex += dir;
        
        if (this.selectedChoiceIndex < 0) this.selectedChoiceIndex = this.choiceButtons.length - 1;
        if (this.selectedChoiceIndex >= this.choiceButtons.length) this.selectedChoiceIndex = 0;
        
        this.updateChoiceSelection();
    }

    private updateChoiceSelection() {
        if (!this.sceneActive) return;
        this.choiceButtons.forEach((btn, idx) => {
            if (!btn || !btn.active) return; // Guard against destroyed objects
            if (idx === this.selectedChoiceIndex) {
                btn.setColor('#ffff00'); // Highlight yellow
                btn.setScale(1.1);
            } else {
                btn.setColor('#888888');
                btn.setScale(1.0);
            }
        });
    }

    private confirmChoice() {
        if (!this.sceneActive || !this.isShowingChoices) return;
        
        const line = this.lines[this.currentLineIndex];
        if (line.choices && line.choices[this.selectedChoiceIndex]) {
            // Mark scene as inactive BEFORE executing action to prevent any further callbacks
            this.sceneActive = false;
            this.isShowingChoices = false;
            this.choiceButtons = [];

            // Execute the action
            const action = line.choices[this.selectedChoiceIndex].action;
            // Close dialog first, then execute action
            this.finishDialogue();
            action();
        }
    }

    private finishDialogue() {
        this.sceneActive = false;
        this.isShowingChoices = false;
        this.choiceButtons = [];

        if (this.onDialogueComplete) {
            this.onDialogueComplete();
            this.onDialogueComplete = null;
        }

        // Emit event so GameScene can listen for dialogue completion
        this.events.emit('dialogue_complete');

        // Stop the scene completely and restore focus to GameScene underneath
        this.scene.stop();
    }

    // Stick navigation state
    private stickMovedX: Map<number, boolean> = new Map();

    override update() {
        // Poll gamepad sticks for menu navigation since events only fire on button down
        if (this.isShowingChoices && this.input.gamepad) {
            const pads = this.input.gamepad.gamepads;
            for (let i = 0; i < pads.length; i++) {
                const pad = pads[i];
                if (!pad) continue;

                // Simple stick deadzone check
                const xAxis = pad.axes[0] ? pad.axes[0].getValue() : 0;
                const moved = this.stickMovedX.get(pad.index) || false;
                
                // Track stick release to allow single steps
                if (!moved) {
                    if (xAxis < -0.5) {
                        this.navigateChoice(-1);
                        this.stickMovedX.set(pad.index, true);
                    } else if (xAxis > 0.5) {
                        this.navigateChoice(1);
                        this.stickMovedX.set(pad.index, true);
                    }
                } else if (Math.abs(xAxis) < 0.2) {
                    this.stickMovedX.set(pad.index, false);
                }
            }
        }
    }
}
