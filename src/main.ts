import Phaser from 'phaser';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { SettingsScene } from './scenes/SettingsScene';
import { LobbyScene } from './scenes/LobbyScene';
import { GameScene } from './scenes/GameScene';
import { OnlineGameScene } from './scenes/OnlineGameScene';
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
  scene: [PreloadScene, MainMenuScene, SettingsScene, LobbyScene, GameScene, OnlineGameScene],
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

new Phaser.Game(config);
