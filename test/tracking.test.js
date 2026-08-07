import assert from 'node:assert/strict';
import test from 'node:test';
import { getLatestContext, getTrackingContext } from '../src/tracking.js';

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
