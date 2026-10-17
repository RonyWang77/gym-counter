import test from 'node:test';
import assert from 'node:assert/strict';
import { businessDate, businessTime, cardStreak } from '../src/businessTime.ts';

test('Beijing date and clock remain correct across UTC midnight', () => {
  const instant = new Date('2026-09-22T11:54:00Z');
  assert.equal(businessDate(instant), '2026-09-22');
  assert.equal(businessTime(instant), '19:54');
  assert.equal(businessDate(new Date('2026-09-21T16:00:00Z')), '2026-09-22');
});

test('a card-wide streak counts distinct days, even with several users and uses', () => {
  const dates = ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-20', '2026-09-21', '2026-09-22'];
  assert.deepEqual(cardStreak(dates, '2026-09-22', '2026-09-18'), {
    streak: 5, missed: 0, pendingToday: false,
  });
  assert.equal(cardStreak(dates, '2026-09-22', '2026-09-22').streak, 1);
});

test('missed days clear immediately after a new check-in', () => {
  const previous = ['2026-09-14'];
  assert.equal(cardStreak(previous, '2026-09-22', '2026-09-01').missed, 7);
  assert.deepEqual(cardStreak([...previous, '2026-09-22'], '2026-09-22', '2026-09-01'), {
    streak: 1, missed: 0, pendingToday: false,
  });
  assert.equal(cardStreak(['2026-09-21'], '2026-09-22', '2026-09-01').pendingToday, true);
});
