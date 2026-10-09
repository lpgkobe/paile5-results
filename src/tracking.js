export function getLatestContext(rows) {
  return {
    collapsedRows: rows.slice(0, 3),
    expandedRows: rows.slice(0, 5)
  };
}

export function getTrackingContext(rows, matchIndex) {
  return {
    collapsedRows: rows.slice(Math.max(0, matchIndex - 1), matchIndex + 2),
    expandedRows: rows.slice(Math.max(0, matchIndex - 3), matchIndex + 4)
  };
}

export function getTailTrackingGroups(rows, periodCount) {
  const recentRows = rows.slice(0, periodCount + 3);
  if (!recentRows.length) return [];

  const latestTail = recentRows[0].numbers.slice(-2).join('-');
  const latestContext = getLatestContext(recentRows);
  const groups = [{
    id: 'latest',
    label: '最新三期',
    rows: latestContext.collapsedRows,
    expandedRows: latestContext.expandedRows,
    matchIssue: null,
    matchIndexes: []
  }];

  recentRows.slice(1, periodCount).forEach((row, offset) => {
    if (row.numbers.slice(-2).join('-') !== latestTail) return;

    const context = getTrackingContext(recentRows, offset + 1);
    groups.push({
      id: `match-${row.issue}`,
      label: `同号命中 · ${row.issue}`,
      rows: context.collapsedRows,
      expandedRows: context.expandedRows,
      matchIssue: row.issue,
      matchIndexes: [3, 4]
    });
  });

  return groups;
}
