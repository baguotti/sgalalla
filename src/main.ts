import Phaser from 'phaser';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { SettingsScene } from './scenes/SettingsScene';
import { LobbyScene } from './scenes/LobbyScene';
import { GameScene } from './scenes/GameScene';
import { DialogueScene } from './scenes/DialogueScene';
import { CampaignTitleScene } from './scenes/CampaignTitleScene';
import { CreditsScene } from './scenes/CreditsScene';
import { SaveFileScene } from './scenes/SaveFileScene';
import { CampaignMapScene } from './scenes/CampaignMapScene';
import { RacingScene } from './scenes/RacingScene';
import './style.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  parent: 'game-container',
  backgroundColor: '#000000ff',
  // 60FPS target with requestAnimationFrame for smooth VSync frame pacing
  fps: {
    target: 60,
    smoothStep: true
  },
  dom: {
    createContainer: true
  },
  scene: [PreloadScene, MainMenuScene, LobbyScene, GameScene, SettingsScene, DialogueScene, CampaignTitleScene, CreditsScene, SaveFileScene, CampaignMapScene, RacingScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    gamepad: true
  }
};
import { VideoManager } from './managers/VideoManager';

new Phaser.Game(config);

// Initialize CRT overlay from saved preferences
VideoManager.getInstance().applySettings();

// Restore fullscreen state on boot (Electron only, no-op on web)
VideoManager.getInstance().syncFullscreenState();
