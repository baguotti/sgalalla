import Phaser from 'phaser';
import { MainMenuScene } from './scenes/MainMenuScene';
import { LobbyScene } from './scenes/LobbyScene';
import { GameScene } from './scenes/GameScene';
import { OnlineTestScene } from './scenes/OnlineTestScene';
import './style.css';

// =====================================================
// ONLINE TEST MODE CONFIGURATION
// Set to true to bypass lobby and go directly to networked game
// Set to false for normal menu flow
// =====================================================
const BYPASS_LOBBY_FOR_ONLINE_TEST = true;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  dom: {
    createContainer: true
  },
  // Changed: Start directly with GameScene when testing, bypassing MainMenuScene
  scene: BYPASS_LOBBY_FOR_ONLINE_TEST
    ? [GameScene, MainMenuScene, LobbyScene, OnlineTestScene]
    : [MainMenuScene, LobbyScene, GameScene, OnlineTestScene],
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

const game = new Phaser.Game(config);

// If bypassing, inject online mode data immediately
if (BYPASS_LOBBY_FOR_ONLINE_TEST) {
  game.events.once('ready', () => {
    console.log('[TEST MODE] Bypassing Lobby - Connecting directly to Online 1v1');
    // The GameScene will be started with online:true flag via init data
    const gameScene = game.scene.getScene('GameScene') as any;
    if (gameScene) {
      // Relaunch with proper data
      game.scene.stop('GameScene');
      game.scene.start('GameScene', {
        online: true,
        inputType: 'KEYBOARD',
        gamepadIndex: null,
        // NO playerData - let network handle it
        playerData: []
      });
    }
  });
}
