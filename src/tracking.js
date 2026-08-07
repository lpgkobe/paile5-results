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
