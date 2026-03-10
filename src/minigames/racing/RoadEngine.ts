export interface Point {
    world: { x: number; y: number; z: number };
    camera: { x: number; y: number; z: number };
    screen: { x: number; y: number; w: number; scale: number };
}

export interface Segment {
    index: number;
    p1: Point;
    p2: Point;
    curve: number;
    color: { road: number; grass: number; rumble: number; lane?: number };
}

export class RoadEngine {
    private segments: Segment[] = [];
    public trackLength: number = 0;
    
    // Engine Config
    public segmentLength: number = 200;
    public rumbleLength: number = 3;
    public trackWidth: number = 2000;
    public lanes: number = 3;
    public fieldOfView: number = 100;
    public cameraHeight: number = 1000;
    public cameraDepth: number = 0;
    public drawDistance: number = 300;

    constructor() {
        this.cameraDepth = 1 / Math.tan((this.fieldOfView / 2) * Math.PI / 180);
        // Multiply by screen height equivalent to maintain aspect ratio across varying resolutions. 
        // Racer uses Math.tan * length or cameraHeight.
        this.cameraDepth = this.cameraDepth * 1000;
        this.resetRoad();
    }

    public getSegments(): Segment[] {
        return this.segments;
    }

    public getSegment(z: number): Segment {
        z = z % this.trackLength;
        if (z < 0) z += this.trackLength;
        return this.segments[Math.floor(z / this.segmentLength)];
    }

    public resetRoad(): void {
        this.segments = [];
        
        // Define some colors
        const COLORS = {
            LIGHT: { road: 0x6B6B6B, grass: 0x10AA10, rumble: 0x555555, lane: 0xCCCCCC },
            DARK: { road: 0x696969, grass: 0x009A00, rumble: 0xBBBBBB },
            START: { road: 0xFFFFFF, grass: 0xFFFFFF, rumble: 0xFFFFFF },
            FINISH: { road: 0x000000, grass: 0x000000, rumble: 0x000000 }
        };

        const numSegments = 1000;
        for (let n = 0; n < numSegments; n++) {
            
            let color = Math.floor(n / this.rumbleLength) % 2 ? COLORS.DARK : COLORS.LIGHT;
            if (n < 5) color = COLORS.START;
            if (n > numSegments - 5) color = COLORS.FINISH;

            this.segments.push({
                index: n,
                p1: { world: { x: 0, y: this.getHill(n), z: n * this.segmentLength }, camera: { x: 0, y: 0, z: 0 }, screen: { x: 0, y: 0, w: 0, scale: 0 } },
                p2: { world: { x: 0, y: this.getHill(n + 1), z: (n + 1) * this.segmentLength }, camera: { x: 0, y: 0, z: 0 }, screen: { x: 0, y: 0, w: 0, scale: 0 } },
                curve: this.getCurve(n),
                color: color
            });
        }

        this.trackLength = this.segments.length * this.segmentLength;
    }

    private getCurve(n: number): number {
        // S-curve for testing
        if (n > 100 && n < 200) return 3; // Curve right
        if (n > 250 && n < 350) return -3; // Curve left
        if (n > 500 && n < 600) return 4;
        if (n > 700 && n < 800) return -4;
        return 0;
    }

    private getHill(n: number): number {
        if (n > 350 && n < 450) return Math.sin((n - 350) / 100 * Math.PI) * 1500;
        return 0;
    }

    public project(p: Point, cameraX: number, cameraY: number, cameraZ: number, cameraDepth: number, width: number, height: number, roadWidth: number) {
        p.camera.x = (p.world.x || 0) - cameraX;
        p.camera.y = (p.world.y || 0) - cameraY;
        p.camera.z = (p.world.z || 0) - cameraZ;
        
        if (p.camera.z <= 0) return; // Behind camera

        // Project to screen coordinates
        p.screen.scale = cameraDepth / p.camera.z;
        p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
        p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y)); // Remove height / 2 scalar on Y
        p.screen.w = Math.round((p.screen.scale * roadWidth * width / 2));
    }
}
