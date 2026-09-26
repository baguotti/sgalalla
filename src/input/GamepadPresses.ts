/**
 * Gamepad buttons that went down since the previous frame, on any connected
 * pad. Call poll() once per frame, then ask about the buttons you use: a
 * button held down counts once, not every frame.
 */
export class GamepadPresses {
    private pads: (Gamepad | null)[] = [];
    private readonly held: boolean[][] = [];
    private readonly pressed: boolean[][] = [];

    poll(): void {
        this.pads = navigator.getGamepads();
        for (let p = 0; p < this.pads.length; p++) {
            const pad = this.pads[p];
            const held = this.held[p] ??= [];
            const pressed = this.pressed[p] ??= [];
            if (!pad) {
                held.length = 0;
                pressed.length = 0;
                continue;
            }
            for (let b = 0; b < pad.buttons.length; b++) {
                const down = pad.buttons[b].pressed;
                pressed[b] = down && !held[b];
                held[b] = down;
            }
        }
    }

    /** `button` is an index, or picks the index per pad (confirm is A or B depending on the controller). */
    justPressed(button: number | ((pad: Gamepad) => number)): boolean {
        for (let p = 0; p < this.pads.length; p++) {
            const pad = this.pads[p];
            if (!pad) continue;
            if (this.pressed[p]?.[typeof button === 'number' ? button : button(pad)]) return true;
        }
        return false;
    }
}
