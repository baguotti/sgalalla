---
name: fighting-game-state-machine
description: Best practices for implementing Finite State Machines (FSM) in fighting games, specifically for Phaser 3.
license: MIT
metadata:
  version: "1.0.0"
  author: ant-generated
---

# Fighting Game State Machine (FSM)

A robust way to manage complex character states (Idle, Run, Jump, Attack, Hitstun) without "spaghetti code."

## Core Pattern: State Interface

Each state should be a class or object implementing a common interface.

```typescript
interface IState {
    enter(fighter: Fighter): void;
    update(fighter: Fighter, time: number, delta: number): void;
    exit(fighter: Fighter): void;
}
```

## State Management

The `StateMachine` class holds the current state and handles transitions.

```typescript
class StateMachine {
    private currentState: IState | null = null;
    private states: Map<string, IState> = new Map();

    changeState(name: string, fighter: Fighter) {
        if (this.currentState) this.currentState.exit(fighter);
        this.currentState = this.states.get(name)!;
        this.currentState.enter(fighter);
    }

    update(fighter: Fighter, time: number, delta: number) {
        if (this.currentState) this.currentState.update(fighter, time, delta);
    }
}
```

## Fighting Game Specifics

### 1. Hierarchical States (Sub-states)
- **Combat State**: Parent state for all attacks.
- **Air State**: Parent for Jump, Fall, AirAttack.

### 2. Lockout / Cancel Windows
- **Startup**: Input ignored (or buffered).
- **Active**: Hitbox enabled.
- **Recovery**: Vulnerable.
- **Cancel**: Can transition to strictly *defined* next states (e.g., Attack -> Special, but NOT Attack -> Walk).

### 3. Hitstun State
A critical state entered when damaged.
- disable all inputs.
- play "hurt" animation.
- duration determined by the attacker's "Hit Advantage" (Frame Data).

## Example: Attack State

```typescript
class LightAttack implements IState {
    enter(f: Fighter) {
        f.playAnim('light_attack');
        f.velocity.x = 0; // Stop movement
        f.hitbox.activate(5, 12); // Active frames 5-12
    }
    update(f: Fighter) {
        if (f.animComplete) {
            f.fsm.changeState('Idle');
        }
    }
}
```
