export class Vector2 {
    public x: number;
    public y: number;

    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    set(x: number, y: number): this {
        this.x = x;
        this.y = y;
        return this;
    }

    add(v: Vector2): this {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    scale(value: number): this {
        this.x *= value;
        this.y *= value;
        return this;
    }

    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
}
