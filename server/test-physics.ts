import { PlayerState } from '@shared/entities/PlayerState';
import { PhysicsConfig } from '@shared/physics/PhysicsConfig';

console.log('Starting Physics Test...');

const player = new PlayerState(100, 100);
console.log(`Initial Pos: ${player.x}, ${player.y}`);

// Simulate 1 second of falling
const delta = 16.6; // 60fps
for (let i = 0; i < 60; i++) {
    player.update(delta);
}

console.log(`After 1s (Falling): ${player.x}, ${player.y}`);
console.log(`Velocity Y: ${player.velocity.y}`);

if (player.y > 100) {
    console.log('Gravity Works: Player fell down.');
} else {
    console.error('Gravity Fail: Player did not fall.');
}

console.log('Physics Test Complete.');
