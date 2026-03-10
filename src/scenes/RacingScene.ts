import { RoadEngine } from '../minigames/racing/RoadEngine';
import { getConfirmButtonIndex } from '../input/JoyConMapper';

export class RacingScene extends Phaser.Scene {
    private engine!: RoadEngine;
    private graphics!: Phaser.GameObjects.Graphics;
    
    // Game State
    private position: number = 0;
    private playerX: number = 0;
    private speed: number = 0;
    private maxSpeed: number = 30000; // units per second
    private accel: number = 10000;
    private breaking: number = -15000;
    private decel: number = -5000;
    private offRoadDecel: number = -15000;
    private offRoadLimit: number = 5000;
    
    // Background and Car
    private debugText!: Phaser.GameObjects.Text;
    
    // Input
    private mapCursorKeys: any;

    constructor() {
        super({ key: 'RacingScene' });
    }

    preload(): void {
        const { width, height } = this.scale;
        
        // Use a simple colored rectangle for the sky
        this.add.rectangle(0, 0, width, height / 2, 0x72D7EE).setOrigin(0, 0);

        // Optional: Preload an atlas or placeholder image for car
        // For now, we will use a generated graphic as placeholder if no sprite exists.
        // We assume 'fok' atlas exists based on previous scene requirements.
    }

    create(): void {
        const { width, height } = this.scale;
        this.engine = new RoadEngine();
        
        this.graphics = this.add.graphics();
        
        this.mapCursorKeys = this.input.keyboard?.createCursorKeys();
        
        // Add sky background
        this.add.rectangle(0,0, width, height, 0x72D7EE).setOrigin(0);

        this.debugText = this.add.text(10, 10, 'DEBUG', { fontSize: '24px', color: '#fff', backgroundColor: '#000' }).setDepth(100);
    }

    update(_time: number, dt: number): void {
        this.handleInput(dt / 1000);
        this.renderRoad();
    }

    private handleInput(dt: number): void {
        let isAccelerating = false;
        let isBraking = false;
        let isLeft = false;
        let isRight = false;

        // Keyboard
        if (this.mapCursorKeys.up.isDown) isAccelerating = true;
        if (this.mapCursorKeys.down.isDown) isBraking = true;
        if (this.mapCursorKeys.left.isDown) isLeft = true;
        if (this.mapCursorKeys.right.isDown) isRight = true;

        // Gamepad logic
        const pads = navigator.getGamepads();
        for (let i = 0; i < pads.length; i++) {
            const pad = pads[i];
            if (!pad) continue;

            const confirmIdx = getConfirmButtonIndex(pad);
            if (pad.buttons[confirmIdx]?.pressed || pad.buttons[7]?.pressed) isAccelerating = true; // A or RT
            if (pad.buttons[6]?.pressed || pad.buttons[0]?.pressed) isBraking = true; // LT or B
            
            if (pad.axes[0] < -0.3 || pad.buttons[14]?.pressed) isLeft = true;
            if (pad.axes[0] > 0.3 || pad.buttons[15]?.pressed) isRight = true;
        }

        // Apply input to speed and steering
        if (isAccelerating) {
            this.speed = Phaser.Math.Clamp(this.speed + this.accel * dt, 0, this.maxSpeed);
        } else if (isBraking) {
            this.speed = Phaser.Math.Clamp(this.speed + this.breaking * dt, 0, this.maxSpeed);
        } else {
            this.speed = Phaser.Math.Clamp(this.speed + this.decel * dt, 0, this.maxSpeed);
        }

        // Apply steering relative to speed
        const speedPercent = this.speed / this.maxSpeed;
        const dx = dt * 2 * speedPercent; 
        
        if (isLeft) this.playerX -= dx;
        if (isRight) this.playerX += dx;

        // Clamp player X to bounds (-2 to 2) road bounds. -1 is left edge, 1 is right edge.
        this.playerX = Phaser.Math.Clamp(this.playerX, -3, 3);

        // Offroad slowdown
        if (this.playerX < -1 || this.playerX > 1) {
            if (this.speed > this.offRoadLimit) {
                this.speed += this.offRoadDecel * dt;
            }
        }

        // Advance position
        this.position = (this.position + this.speed * dt) % this.engine.trackLength;
        
        // Centrifugal force (push player outwards on curves based on speed limit)
        const currentSegment = this.engine.getSegment(this.position);
        this.playerX = this.playerX - (dx * speedPercent * currentSegment.curve * 0.1); // Centrifugal pull
    }

    private renderRoad(): void {
        this.graphics.clear();
        
        const { width, height } = this.scale;
        
        const baseSegment = this.engine.getSegment(this.position);
        const basePercent = (this.position % this.engine.segmentLength) / this.engine.segmentLength;

        let maxy = height;
        
        let x = 0;
        let dx = -(baseSegment.curve * basePercent);
        
        let drewSegments = 0;
        let firstSegmentY = 0;

        for (let n = 0; n < this.engine.drawDistance; n++) {
            const segmentIndex = (baseSegment.index + n) % this.engine.getSegments().length;
            const segment = this.engine.getSegments()[segmentIndex];

            // Loop logic
            const looped = segment.index < baseSegment.index;
            const camZ = this.position - (looped ? this.engine.trackLength : 0);

            // Project P1 (start of segment)
            this.engine.project(
                segment.p1, 
                (this.playerX * this.engine.trackWidth) - x,
                this.engine.cameraHeight + this.engine.getSegments()[(baseSegment.index + n) % this.engine.getSegments().length].p1.world.y,
                camZ,
                this.engine.cameraDepth,
                width, height, this.engine.trackWidth
            );

            // Project P2 (end of segment)
            this.engine.project(
                segment.p2, 
                (this.playerX * this.engine.trackWidth) - x - dx,
                this.engine.cameraHeight + this.engine.getSegments()[(baseSegment.index + n + 1) % this.engine.getSegments().length].p1.world.y,
                camZ,
                this.engine.cameraDepth,
                width, height, this.engine.trackWidth
            );

            x = x + dx;
            dx = dx + segment.curve;

            // Frustum Culling (behind camera, outside viewing area, or reversed projection)
            if (segment.p1.camera.z <= this.engine.cameraDepth || segment.p2.screen.y >= maxy || segment.p2.screen.y >= segment.p1.screen.y) {
                continue;
            }

            maxy = segment.p2.screen.y;

            const color = segment.color;

            // Draw Grass (fills entire horizontal width per segment level)
            this.graphics.fillStyle(color.grass);
            this.graphics.fillRect(0, segment.p2.screen.y, width, segment.p1.screen.y - segment.p2.screen.y);

            // Draw Rumble strips
            this.drawPolygon(this.graphics, 
                width / 2, segment.p1.screen.y, segment.p1.screen.x, segment.p1.screen.w * 1.2,
                width / 2, segment.p2.screen.y, segment.p2.screen.x, segment.p2.screen.w * 1.2,
                color.rumble
            );

            // Draw Road
            this.drawPolygon(this.graphics, 
                width / 2, segment.p1.screen.y, segment.p1.screen.x, segment.p1.screen.w,
                width / 2, segment.p2.screen.y, segment.p2.screen.x, segment.p2.screen.w,
                color.road
            );

            // Draw Lanes
            if (color.lane) {
                const lanew1 = segment.p1.screen.w * 2 / this.engine.lanes;
                const lanew2 = segment.p2.screen.w * 2 / this.engine.lanes;
                const lanex1 = segment.p1.screen.x;
                const lanex2 = segment.p2.screen.x;

                for (let lane = 1; lane < this.engine.lanes; lane++) {
                    const l1 = lanex1 - segment.p1.screen.w + (lanew1 * lane);
                    const l2 = lanex2 - segment.p2.screen.w + (lanew2 * lane);
                    this.drawPolygon(this.graphics, 
                        width / 2, segment.p1.screen.y, l1, lanew1 * 0.05, // 5% width for lane lines
                        width / 2, segment.p2.screen.y, l2, lanew2 * 0.05,
                        color.lane
                    );
                }
            }

            drewSegments++;
            if (drewSegments === 1) firstSegmentY = segment.p1.screen.y;
        }

        this.debugText.setText(
            `Speed: ${Math.floor(this.speed)}\n` +
            `Pos: ${Math.floor(this.position)}\n` +
            `PlayerX: ${this.playerX.toFixed(2)}\n` +
            `Segments Drawn: ${drewSegments}\n` +
            `First Y: ${firstSegmentY}`
        );
    }

    private drawPolygon(graphics: Phaser.GameObjects.Graphics, _x1: number, y1: number, px1: number, w1: number, _x2: number, y2: number, px2: number, w2: number, color: number) {
        graphics.fillStyle(color);
        graphics.beginPath();
        graphics.moveTo(px1 - w1, y1);
        graphics.lineTo(px1 + w1, y1);
        graphics.lineTo(px2 + w2, y2);
        graphics.lineTo(px2 - w2, y2);
        graphics.closePath();
        graphics.fillPath();
    }
}
