import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AttackRegistry } from '../shared/AttackData.ts';
import { KNOCKBACK_DIRECTIONS, RECOVERY_KNOCKBACK_ANGLE } from '../shared/Combat.ts';

test('every knockback angle has its exact direction in the table', () => {
    const angles = new Set([...Object.values(AttackRegistry).map(a => a.knockbackAngle), RECOVERY_KNOCKBACK_ANGLE]);
    for (const angle of angles) {
        const radians = (angle * Math.PI) / 180;
        assert.deepEqual(KNOCKBACK_DIRECTIONS[angle], [Math.cos(radians), Math.sin(radians)], `knockback angle ${angle}`);
    }
});
