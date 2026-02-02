import { Schema, type, MapSchema } from "@colyseus/schema";

export class Player extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") vx: number = 0;
    @type("number") vy: number = 0;
    @type("string") id: string = "";
    @type("boolean") connected: boolean = true;

    // Status Flags
    @type("boolean") isGrounded: boolean = false;
    @type("boolean") isJumping: boolean = false;
    @type("boolean") isDodging: boolean = false;
    @type("boolean") isAttacking: boolean = false;
    @type("boolean") isHitStunned: boolean = false;
    @type("boolean") isWallSliding: boolean = false;
    @type("boolean") isTouchingWall: boolean = false;
    @type("number") facingDirection: number = 1;
    @type("boolean") isRunning: boolean = false;
    @type("boolean") isFastFalling: boolean = false;
    @type("number") wallDirection: number = 0;
    @type("number") jumpsRemaining: number = 2;
    @type("number") airActionCounter: number = 0;
    @type("number") attackTimer: number = 0;
    @type("boolean") isRecovering: boolean = false;
    @type("number") recoveryTimer: number = 0;
    @type("number") dodgeTimer: number = 0;
    @type("number") dodgeCooldownTimer: number = 0;
    @type("boolean") wallTouchesExhausted: boolean = false;
    @type("number") health: number = 0;
    @type("boolean") wasJumpHeld: boolean = false;
    @type("boolean") recoveryAvailable: boolean = true;

    // Lobby Status
    @type("boolean") isReady: boolean = false;
    @type("string") character: string = "fok";
    @type("number") slotIndex: number = -1;
    @type("number") lastProcessedInput: number = 0;
}

export class GameState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
}
