import Phaser from 'phaser';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { SettingsScene } from './scenes/SettingsScene';
import { LobbyScene } from './scenes/LobbyScene';
import { GameScene } from './scenes/GameScene';
import { OnlineGameScene } from './scenes/OnlineGameScene';
import { DialogueScene } from './scenes/DialogueScene';
import { CampaignTitleScene } from './scenes/CampaignTitleScene';
import { CreditsScene } from './scenes/CreditsScene';
import { SaveFileScene } from './scenes/SaveFileScene';
import './style.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  parent: 'game-container',
  backgroundColor: '#000000ff',
  // FPS capping for cross-device sync (120Hz displays capped to 60Hz)
  fps: {
    target: 60,
    forceSetTimeOut: true
  },
  dom: {
    createContainer: true
  },
  scene: [PreloadScene, MainMenuScene, LobbyScene, GameScene, OnlineGameScene, SettingsScene, DialogueScene, CampaignTitleScene, CreditsScene, SaveFileScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 2 },
      debug: false
    }
  },
  input: {
    gamepad: true
  }
};
import { VideoManager } from './managers/VideoManager';

new Phaser.Game(config);

// Initialize CRT overlay from saved preferences
VideoManager.getInstance().applySettings();
