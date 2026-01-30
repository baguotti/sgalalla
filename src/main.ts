import 'phaser';
import { SpinePlugin } from '@esotericsoftware/spine-phaser';
import { MainMenuScene } from './scenes/MainMenuScene';
import { LocalMultiplayerSetupScene } from './scenes/LocalMultiplayerSetupScene';
import { SettingsScene } from './scenes/SettingsScene';
import { GameScene } from './scenes/GameScene';
import './style.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scene: [MainMenuScene, LocalMultiplayerSetupScene, GameScene, SettingsScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  plugins: {
    scene: [
      { key: 'spine.SpinePlugin', plugin: SpinePlugin, mapping: 'spine' }
    ]
  }
};

new Phaser.Game(config);
