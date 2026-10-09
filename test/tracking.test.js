import assert from 'node:assert/strict';
import test from 'node:test';
import { getLatestContext, getTailTrackingGroups, getTrackingContext } from '../src/tracking.js';

const rows = Array.from({ length: 33 }, (_, index) => ({ issue: String(100 - index) }));

test('expands the latest group from three to five issues', () => {
  const context = getLatestContext(rows);

  assert.deepEqual(context.collapsedRows.map((row) => row.issue), ['100', '99', '98']);
  assert.deepEqual(context.expandedRows.map((row) => row.issue), ['100', '99', '98', '97', '96']);
});

test('keeps one issue on each side when a group is collapsed', () => {
  const context = getTrackingContext(rows, 10);

  assert.deepEqual(context.collapsedRows.map((row) => row.issue), ['91', '90', '89']);
});

test('keeps three issues on each side when a group is expanded', () => {
  const context = getTrackingContext(rows, 10);

  assert.deepEqual(context.expandedRows.map((row) => row.issue), ['93', '92', '91', '90', '89', '88', '87']);
});

test('provides seven rows for the oldest searchable match', () => {
  const context = getTrackingContext(rows, 29);

  assert.equal(context.expandedRows.length, 7);
  assert.deepEqual(context.expandedRows.map((row) => row.issue), ['74', '73', '72', '71', '70', '69', '68']);
});

const tailMatchIndexes = [1, 2, 5, 29, 30, 49, 50, 99, 100, 199, 200];
const tailRows = Array.from({ length: 203 }, (_, index) => ({
  issue: String(1000 - index),
  numbers: [1, 2, 3, ...(index === 0 || tailMatchIndexes.includes(index) ? [8, 9] : [9, 8])]
}));

for (const periodCount of [30, 50, 100, 200]) {
  test(`shows every historical tail match within the selected ${periodCount} issues`, () => {
    const groups = getTailTrackingGroups(tailRows, periodCount);
    const expectedIssues = tailMatchIndexes.filter((index) => index < periodCount).map((index) => tailRows[index].issue);

    assert.equal(groups[0].id, 'latest');
    assert.deepEqual(groups.slice(1).map((group) => group.matchIssue), expectedIssues);
    for (const group of groups.slice(1)) {
      assert.ok(group.rows.some((row) => row.issue === group.matchIssue));
      assert.deepEqual(group.matchIndexes, [3, 4]);
    }
  });

  test(`preserves context for the last match in the selected ${periodCount} issues`, () => {
    const groups = getTailTrackingGroups(tailRows, periodCount);
    const lastGroup = groups.at(-1);

    assert.equal(lastGroup.matchIssue, tailRows[periodCount - 1].issue);
    assert.deepEqual(lastGroup.rows, tailRows.slice(periodCount - 2, periodCount + 1));
    assert.deepEqual(lastGroup.expandedRows, tailRows.slice(periodCount - 4, periodCount + 3));
    assert.equal(groups.some((group) => group.matchIssue === tailRows[periodCount].issue), false);
  });
}

test('keeps a separate block for every match when all selected issues share the latest tail', () => {
  const sameTailRows = tailRows.map((row) => ({ ...row, numbers: [1, 2, 3, 8, 9] }));
  const groups = getTailTrackingGroups(sameTailRows, 200);

  assert.equal(groups.length, 200);
  assert.equal(new Set(groups.map((group) => group.id)).size, 200);
  assert.deepEqual(groups.slice(1).map((group) => group.matchIssue), sameTailRows.slice(1, 200).map((row) => row.issue));
});

test('returns only the latest block when no historical tail matches in the selected range', () => {
  const unmatchedRows = tailRows.map((row, index) => ({ ...row, numbers: index === 0 ? [1, 2, 3, 8, 9] : [1, 2, 3, 9, 8] }));

  assert.deepEqual(getTailTrackingGroups(unmatchedRows, 100).map((group) => group.id), ['latest']);
});

test('handles empty and short histories without losing available matches', () => {
  assert.deepEqual(getTailTrackingGroups([], 200), []);

  const groups = getTailTrackingGroups(tailRows.slice(0, 2), 200);

  assert.deepEqual(groups.map((group) => group.id), ['latest', 'match-999']);
  assert.deepEqual(groups[1].rows, tailRows.slice(0, 2));
  assert.deepEqual(groups[1].expandedRows, tailRows.slice(0, 2));
});
