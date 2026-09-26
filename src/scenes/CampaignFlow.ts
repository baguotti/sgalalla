import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import type { MatchHUD } from '../ui/PlayerHUD';
import { AudioManager } from '../managers/AudioManager';
import { CampaignManager, type OpponentConfig } from '../managers/CampaignManager';
import { isStageKey, type StageKey } from '../stages/StageBackgrounds';
import { placeFighter, respawnFighter, type MatchState } from '../../shared/GameSim';
import type { DialogueLine } from './DialogueScene';
import type { GameSceneData, PlayerSlot } from './GameScene';

/** What the campaign needs from the match it runs in. */
export interface CampaignMatch {
    readonly match: MatchState;
    readonly players: readonly Player[];
    readonly hud: MatchHUD;
    /** Holds the match still, or lets it run again. */
    setCutscene(on: boolean): void;
}

/** A first encounter starts with the stage and the opponent half drained of colour. */
const DRAINED = -0.5;
/** The colour comes back a share per life the opponent loses, over this long. */
const COLOUR_RETURN_MS = 3000;
const OPPONENT_LIVES = 3;
/** Where the fighters stand during cutscenes, on the main platform facing each other. */
const CUTSCENE_MARKS = [{ playerId: 0, x: 860, facing: 1 }, { playerId: 1, x: 1060, facing: -1 }];
const CUTSCENE_FLOOR_Y = 750;

/**
 * A campaign fight inside GameScene: the opponent, the colour coming back as
 * they lose lives, the cutscenes, and where the player goes when it ends.
 * GameScene makes one in campaign mode and calls it at each step of the match.
 */
export class CampaignFlow {
    private readonly scene: Phaser.Scene;
    private readonly campaign = CampaignManager.getInstance();
    /** A practice rematch against an island's opponent: no cutscenes, no colour drain. */
    private readonly isPractice: boolean;
    private readonly islandIndex: number;
    private readonly opponent: OpponentConfig | null;
    /** The player's slot, carried to the map and into rematches. */
    private readonly player: PlayerSlot | undefined;
    private readonly playerCharacter: string;
    private host!: CampaignMatch;
    private readonly drained: Phaser.FX.ColorMatrix[] = [];
    /** 0 drained, 1 full colour. */
    private colour = 0;
    private midFightPlayed = false;

    constructor(scene: Phaser.Scene, data: GameSceneData, player: PlayerSlot | undefined) {
        this.scene = scene;
        this.isPractice = data.isTraining ?? false;
        this.islandIndex = data.trainingOpponentIndex ?? 0;
        this.player = player;
        this.playerCharacter = player?.character || 'fok';
        this.campaign.ensureActive(this.playerCharacter, data.slotIndex ?? this.campaign.getActiveSlotIndex());
        this.opponent = this.isPractice ? this.campaign.ladder[this.islandIndex] ?? null : this.campaign.getCurrentOpponent();
    }

    /** The player against the opponent, who stands still: the campaign's opponents don't fight back yet. */
    fighters(player: PlayerSlot): PlayerSlot[] | null {
        if (!this.opponent) return null;
        return [player, {
            playerId: 1,
            joined: true,
            ready: true,
            input: { type: 'KEYBOARD', gamepadIndex: null },
            character: this.opponent.character,
            isAI: true,
            isTrainingDummy: true,
        }];
    }

    /** The opponent's island, or null to keep the stage asked for. */
    get stage(): StageKey | null {
        return this.opponent && isStageKey(this.opponent.stage) ? this.opponent.stage : null;
    }

    /** Name tag and HUD colour: off-white for the player, white for the opponent. */
    indicatorColor(playerId: number): number {
        return playerId === 0 ? 0xf0f0f0 : 0xffffff;
    }

    /** On a first encounter, `objects` start half drained of colour. */
    drain(objects: readonly (Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | null)[]): void {
        if (this.isPractice) return;
        for (const object of objects) {
            const fx = object?.postFX?.addColorMatrix();
            if (!fx) continue;
            fx.saturate(DRAINED);
            this.drained.push(fx);
        }
    }

    /** The match is set up: a first encounter opens with the opponent's lines. */
    start(host: CampaignMatch): void {
        this.host = host;
        if (this.isPractice || !this.opponent) return;
        const dialogue = this.opponent.dialogueBefore;
        const opponent = this.opponent.character;
        this.holdFighters();
        // Once the loading screen has faded
        this.scene.time.delayedCall(600, () => {
            this.host.hud.setVisible(false);
            this.playDialogue(dialogue, opponent, () => this.endCutscene());
        });
    }

    /** The opponent doesn't flash when hit. */
    flashesOnHit(playerId: number): boolean {
        return playerId !== 1;
    }

    /** A fighter was knocked out: the colour comes back, and the opponent's last life gets a word first. */
    onKnockOut(index: number): void {
        const player = this.host.players[index];
        const fighter = this.host.match.fighters[index];
        if (player.playerId !== 1) return;

        if (this.drained.length > 0) this.restoreColour((OPPONENT_LIVES - fighter.lives) / OPPONENT_LIVES);

        const opponent = this.opponent;
        if (this.isPractice || this.midFightPlayed || fighter.lives !== 1 || !opponent || opponent.dialogueMidFight.length === 0) return;
        this.midFightPlayed = true;
        const camera = this.scene.cameras.main;
        camera.fadeOut(1000, 0, 0, 0);
        camera.once('camerafadeoutcomplete', () => {
            // Back on stage while the screen is black, then the lines
            respawnFighter(this.host.match, index);
            this.holdFighters();
            this.host.hud.setVisible(false);
            this.playDialogue(opponent.dialogueMidFight, opponent.character, () => this.endCutscene());
            camera.fadeIn(1000, 0, 0, 0);
        });
    }

    /** The match is over: on to the next island, or a black screen asking to go again. */
    onMatchOver(winnerId: number): void {
        if (!this.isPractice && winnerId === 0) {
            this.campaign.advanceLadder();
            this.defeatCutscene();
            return;
        }
        if (winnerId >= 0) AudioManager.getInstance().playSFX('sfx_knockout', { volume: 0.8 });
        this.scene.cameras.main.fade(1500, 0, 0, 0, false, (_camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
            if (progress < 1) return;
            if (this.isPractice) this.askPracticeAgain(winnerId === 0);
            else this.askRetry();
        });
    }

    /** The pause menu's "back to the map". */
    backToMap(islandIndex = this.islandIndex): void {
        this.scene.scene.start('CampaignMapScene', {
            playerData: [this.player],
            mode: 'campaign',
            slotIndex: this.campaign.getActiveSlotIndex(),
            targetIslandIndex: islandIndex,
        });
    }

    private restoreColour(target: number): void {
        this.scene.tweens.addCounter({
            from: this.colour * 100,
            to: target * 100,
            duration: COLOUR_RETURN_MS,
            onUpdate: tween => {
                this.colour = (tween.getValue() ?? 0) / 100;
                const saturation = DRAINED * (1 - this.colour);
                for (const fx of this.drained) {
                    fx.reset();
                    fx.saturate(saturation);
                }
            },
        });
    }

    /** The opponent is beaten: no victory screen, their parting lines, then on to the map. */
    private defeatCutscene(): void {
        // advanceLadder() has already moved on: the beaten opponent is the previous level's
        const opponent = this.campaign.ladder[this.campaign.getCurrentLevel() - 1];
        const camera = this.scene.cameras.main;
        camera.fadeOut(1000, 0, 0, 0);
        camera.once('camerafadeoutcomplete', () => {
            camera.stopFollow();
            camera.resetFX();
            camera.setZoom(1);
            camera.centerOn(960, 540);
            this.holdFighters();
            this.host.hud.setVisible(false);
            camera.fadeIn(1000, 0, 0, 0);

            if (opponent && opponent.dialogueAfterWin.length > 0) {
                this.playDialogue(opponent.dialogueAfterWin, opponent.character, () => this.leaveBeatenIsland());
            } else {
                this.leaveBeatenIsland();
            }
        });
    }

    /** A long fade, then the map on the island just beaten, or the credits after the last. */
    private leaveBeatenIsland(): void {
        const camera = this.scene.cameras.main;
        camera.fadeOut(2000, 0, 0, 0);
        camera.once('camerafadeoutcomplete', () => {
            // The save file is kept either way
            if (this.campaign.getCurrentOpponent()) this.backToMap(Math.max(0, this.campaign.getCurrentLevel() - 1));
            else this.scene.scene.start('CreditsScene');
        });
    }

    /** After a practice rematch: the opponent's verdict and "train more?". */
    private askPracticeAgain(won: boolean): void {
        const opponent = this.opponent;
        const lines = (won ? opponent?.dialogueTrainingWin : opponent?.dialogueTrainingLose) ?? [];
        const text = (lines[0]?.text ?? (won ? 'Well done!' : 'You should train more.')) + ' Want to train more?';
        this.ask({ speaker: lines[0]?.speaker ?? this.opponentCharacter, text, side: 'right', animation: 'idle' }, true);
    }

    /** After losing a campaign fight: the opponent's lines and "try again?". */
    private askRetry(): void {
        const line = this.opponent?.dialogueCampaignLose[0]
            ?? { speaker: this.opponentCharacter, text: 'You lost. Want to try again?', side: 'right', animation: 'idle' };
        this.ask(line, false);
    }

    /** A YES/NO question on a black screen: YES fights again, NO goes back to the map. */
    private ask(line: DialogueLine, practice: boolean): void {
        const choices = [
            {
                text: 'YES', action: () => this.scene.scene.restart({
                    playerData: this.player ? [this.player] : undefined,
                    mode: 'campaign',
                    slotIndex: this.campaign.getActiveSlotIndex(),
                    isTraining: practice,
                    trainingOpponentIndex: practice ? this.islandIndex : undefined,
                } satisfies GameSceneData),
            },
            { text: 'NO', action: () => this.backToMap() },
        ];
        this.stopDialogue();
        this.scene.scene.launch('DialogueScene', {
            leftCharacter: this.playerCharacter,
            rightCharacter: this.opponentCharacter,
            dialogueData: [{ ...line, animation: line.animation || 'idle', choices }],
            blackBackground: true,
        });
    }

    /** Holds the match and stands the two fighters on their marks. */
    private holdFighters(): void {
        this.host.setCutscene(true);
        for (const mark of CUTSCENE_MARKS) {
            const player = this.host.players.find(p => p.playerId === mark.playerId);
            if (!player) continue;
            placeFighter(this.host.match, player.fighterIndex, mark.x, CUTSCENE_FLOOR_Y, mark.facing);
            player.setPose('idle');
        }
    }

    private endCutscene(): void {
        this.host.players.forEach(p => p.setPose(null));
        this.host.setCutscene(false);
        this.host.hud.setVisible(true);
    }

    /** Plays `dialogue` over the match; the fighters strike the poses its lines ask for. */
    private playDialogue(dialogue: DialogueLine[], opponentCharacter: string, onComplete: () => void): void {
        this.stopDialogue();
        // Listen before launching: DialogueScene.create() already emits the first line's pose
        const dialogueScene = this.scene.scene.get('DialogueScene');
        dialogueScene.events.on('dialogue_animation', (side: 'left' | 'right', animation: string) => {
            const playerId = side === 'left' ? 0 : 1;
            this.host.players.find(p => p.playerId === playerId)?.setPose(animation);
        });
        dialogueScene.events.once('dialogue_complete', () => {
            dialogueScene.events.off('dialogue_animation');
            onComplete();
        });
        this.scene.scene.launch('DialogueScene', { dialogueData: dialogue, leftCharacter: this.playerCharacter, rightCharacter: opponentCharacter });
    }

    private stopDialogue(): void {
        if (this.scene.scene.isActive('DialogueScene') || this.scene.scene.isSleeping('DialogueScene')) {
            this.scene.scene.stop('DialogueScene');
        }
    }

    private get opponentCharacter(): string {
        return this.opponent?.character || 'sgu';
    }
}
