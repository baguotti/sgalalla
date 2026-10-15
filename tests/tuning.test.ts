/**
 * The Studio Lab's live tuning: changes show in the simulation's settings,
 * come back as a short list of differences, and reset leaves nothing behind
 * (every match outside the Lab relies on it, online most of all).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AttackRegistry } from '../shared/AttackData.ts';
import { KNOCKBACK_DIRECTIONS } from '../shared/Combat.ts';
import { PhysicsConfig } from '../shared/PhysicsConfig.ts';
import { effects } from '../src/config/EffectConfig.ts';
import {
    applyTuning, isDefaultTuning, resetTuning, setEffect, setMoveValue, setPhysics, tuningChanges,
} from '../src/lab/Tuning.ts';

test('changes show in the settings and come back as differences only', () => {
    resetTuning();
    setPhysics('JUMP_FORCE', -1200);
    setMoveValue('light_side_grounded', 'damage', 9);
    setMoveValue('light_side_grounded', 'shouldStallInAir', true);
    setEffect('KO_SHAKE', 0.02);
    assert.equal(PhysicsConfig.JUMP_FORCE, -1200);
    assert.equal(AttackRegistry.light_side_grounded.damage, 9);
    assert.deepEqual(tuningChanges(), {
        physics: { JUMP_FORCE: -1200 },
        moves: { light_side_grounded: { damage: 9, shouldStallInAir: true } },
        effects: { KO_SHAKE: 0.02 },
    });
    resetTuning();
});

test('reset puts every value back, new knockback angles included', () => {
    resetTuning();
    const physics = { ...PhysicsConfig };
    const move = { ...AttackRegistry.heavy_side_aerial };
    const angles = Object.keys(KNOCKBACK_DIRECTIONS).length;
    setPhysics('GRAVITY', 1);
    setPhysics('RECOVERY_KNOCKBACK_ANGLE', 33);
    setMoveValue('heavy_side_aerial', 'knockbackAngle', 61);
    setMoveValue('heavy_side_aerial', 'shouldStallInAir', true);
    assert.ok(61 in KNOCKBACK_DIRECTIONS && 33 in KNOCKBACK_DIRECTIONS, 'a new angle gets a direction');

    resetTuning();
    assert.deepEqual({ ...PhysicsConfig }, physics);
    assert.deepEqual({ ...AttackRegistry.heavy_side_aerial }, move);
    assert.equal(Object.keys(KNOCKBACK_DIRECTIONS).length, angles);
    assert.equal(isDefaultTuning(), true);
});

test('applying pasted settings skips unknown names and wrong types', () => {
    const applied = applyTuning({
        physics: { GRAVITY: 2500, NOT_A_SETTING: 1, MAX_JUMPS: 'three' },
        moves: { light_up_aerial: { damage: 7, colour: 3 }, no_such_move: { damage: 1 } },
        effects: { SPARK_SIZE: 1.5 },
    });
    assert.equal(applied, 3);
    assert.equal(PhysicsConfig.GRAVITY, 2500);
    assert.equal(AttackRegistry.light_up_aerial.damage, 7);
    assert.equal(effects.SPARK_SIZE, 1.5);

    // Applying starts from the defaults: what isn't listed goes back
    applyTuning({ physics: { MAX_JUMPS: 4 } });
    assert.deepEqual(tuningChanges(), { physics: { MAX_JUMPS: 4 } });
    resetTuning();
});

test('the FEEL mode shows every setting, or leaves it out on purpose', async () => {
    const { COMBAT_GROUPS, EFFECT_GROUPS, HIDDEN_PHYSICS, MOVEMENT_GROUPS } = await import('../src/lab/FeelCatalog.ts');
    const { DEFAULT_EFFECTS } = await import('../src/config/EffectConfig.ts');
    const shown = [...MOVEMENT_GROUPS, ...COMBAT_GROUPS].flatMap(g => g.settings.map(s => s.key));
    assert.equal(new Set(shown).size, shown.length, 'no setting twice');
    const missing = Object.keys(PhysicsConfig).filter(key => !shown.includes(key as never) && !HIDDEN_PHYSICS.includes(key as never));
    assert.deepEqual(missing, []);
    const effectKeys = EFFECT_GROUPS.flatMap(g => g.settings.map(s => s.key));
    assert.deepEqual([...effectKeys].sort(), Object.keys(DEFAULT_EFFECTS).sort());
});
