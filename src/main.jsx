import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays, ChevronDown, ChevronUp, Hash, History, LayoutList, List, Menu, RefreshCw, ScanSearch, Search, Settings2, Target, X } from 'lucide-react';
import './styles.css';
import { getLatestContext, getTrackingContext } from './tracking.js';

const sumOf = (numbers) => numbers.reduce((sum, n) => sum + n, 0);
const parityOf = (numbers) => {
  const odd = numbers.filter((n) => n % 2).length;
  return `${odd}:${numbers.length - odd}`;
};

const densityOptions = [
  { value: 'relaxed', label: '宽松' },
  { value: 'medium', label: '中等' },
  { value: 'compact', label: '密集' }
];
const periodOptions = [30, 50, 100, 200];
const viewOptions = [
  { value: 'history', label: '完整历史', icon: List },
  { value: 'tail-match', label: '末二追踪', icon: ScanSearch },
  { value: 'position-match', label: '同位高重', icon: Target }
];

function ResultRow({ row, newest = false, highlightIndexes = [] }) {
  const isMatch = highlightIndexes.length > 0;
  return <article className={`result-row${newest ? ' newest' : ''}${isMatch ? ' match-row' : ''}`}>
    <div className="issue"><strong>{row.issue}</strong><small>{row.date?.slice(5).replace('-', '/')}</small></div>
    <div className="balls">
      {row.numbers.map((number, index) => <span className={highlightIndexes.includes(index) ? 'matched-number' : ''} key={index}>{number}</span>)}
    </div>
    <strong className="sum">{sumOf(row.numbers)}</strong>
    <span className="parity">{parityOf(row.numbers)}</span>
  </article>;
}

function TrackingGroup({ group, latest, viewMode, isLatest = false, expanded = false, onToggle }) {
  const visibleRows = expanded ? group.expandedRows : group.rows;
  return <section className="match-group">
    <div className="match-group-title">
      <strong>{isLatest && expanded ? '最新五期' : group.label}</strong>
      <span>{isLatest
        ? viewMode === 'tail-match' ? `当前末二 · ${latest?.numbers.slice(-2).join(' ') || '--'}` : '五位逐项比对'
        : viewMode === 'position-match' ? `相同 ${group.score}/5 位` : '前后各一期'}</span>
    </div>
    {visibleRows.map((row, rowIndex) => <ResultRow
      row={row}
      newest={isLatest && rowIndex === 0}
      highlightIndexes={row.issue === group.matchIssue ? group.matchIndexes : []}
      key={`${group.id}-${row.issue}`}
    />)}
    {group.expandedRows.length > group.rows.length && <button
      type="button"
      className="match-group-toggle"
      aria-expanded={expanded}
      onClick={onToggle}
    >
      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      {isLatest
        ? expanded ? '收起至最新 3 期' : '展开至最新 5 期'
        : expanded ? '收起前后期数' : '展开前后各 3 期'}
    </button>}
  </section>;
}

function App() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('loading');
  const [updatedAt, setUpdatedAt] = useState('');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedTrackingGroups, setExpandedTrackingGroups] = useState(() => new Set());
  const [density, setDensity] = useState(() => localStorage.getItem('paile5-density') || 'relaxed');
  const [periodCount, setPeriodCount] = useState(() => Number(localStorage.getItem('paile5-period-count')) || 30);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('paile5-view-mode') || 'history');

  async function load() {
    setStatus('loading');
    try {
      const requestLimit = viewMode === 'history' ? periodCount : 50;
      const response = await fetch(`/api/results?limit=${requestLimit}`);
      if (!response.ok) throw new Error('request failed');
      const data = await response.json();
      setRows(data.rows || []);
      setUpdatedAt(data.updatedAt);
      setStatus(data.source);
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => { load(); }, [periodCount, viewMode]);
  useEffect(() => { localStorage.setItem('paile5-density', density); }, [density]);
  useEffect(() => { localStorage.setItem('paile5-period-count', String(periodCount)); }, [periodCount]);
  useEffect(() => { localStorage.setItem('paile5-view-mode', viewMode); }, [viewMode]);
  useEffect(() => { setExpandedTrackingGroups(new Set()); }, [viewMode, rows[0]?.issue]);
  useEffect(() => {
    document.body.classList.toggle('drawer-open', menuOpen);
    return () => document.body.classList.remove('drawer-open');
  }, [menuOpen]);
  const visibleRows = useMemo(() => rows.filter((row) => row.issue.includes(query.trim())), [rows, query]);
  const latest = rows[0];
  const tailTrackingGroups = useMemo(() => {
    const recentRows = rows.slice(0, 33);
    if (recentRows.length < 3) return [];
    const latestTail = recentRows[0].numbers.slice(-2).join('-');
    const latestContext = getLatestContext(recentRows);
    const groups = [{ id: 'latest', label: '最新三期', rows: latestContext.collapsedRows, expandedRows: latestContext.expandedRows, matchIssue: null, matchIndexes: [] }];
    recentRows.slice(0, 30).forEach((row, index) => {
      const isMatch = row.numbers.slice(-2).join('-') === latestTail;
      if (index >= 3 && isMatch) {
        const context = getTrackingContext(recentRows, index);
        groups.push({
          id: `match-${row.issue}`,
          label: `同号命中 · ${row.issue}`,
          rows: context.collapsedRows,
          expandedRows: context.expandedRows,
          matchIssue: row.issue,
          matchIndexes: [3, 4]
        });
      }
    });
    return groups;
  }, [rows]);
  const positionTrackingGroups = useMemo(() => {
    const recentRows = rows.slice(0, 33);
    if (recentRows.length < 4) return [];
    const latestNumbers = recentRows[0].numbers;
    const candidates = recentRows.slice(3, 30).map((row, offset) => {
      const matchIndexes = row.numbers.reduce((indexes, number, index) => {
        if (number === latestNumbers[index]) indexes.push(index);
        return indexes;
      }, []);
      return { row, index: offset + 3, matchIndexes, score: matchIndexes.length };
    });
    const highestScore = Math.max(...candidates.map((candidate) => candidate.score));
    const latestContext = getLatestContext(recentRows);
    const groups = [{ id: 'latest', label: '最新三期', rows: latestContext.collapsedRows, expandedRows: latestContext.expandedRows, matchIssue: null, matchIndexes: [] }];
    candidates.filter((candidate) => candidate.score === highestScore).forEach((candidate) => {
      const context = getTrackingContext(recentRows, candidate.index);
      groups.push({
        id: `position-${candidate.row.issue}`,
        label: `最高重复 · ${candidate.row.issue}`,
        rows: context.collapsedRows,
        expandedRows: context.expandedRows,
        matchIssue: candidate.row.issue,
        matchIndexes: candidate.matchIndexes,
        score: candidate.score
      });
    });
    return groups;
  }, [rows]);
  const activeTrackingGroups = viewMode === 'position-match' ? positionTrackingGroups : tailTrackingGroups;

  function changePeriodCount(count) {
    if (count === periodCount) {
      setMenuOpen(false);
      return;
    }
    setRows([]);
    setPeriodCount(count);
    setMenuOpen(false);
  }

  function changeViewMode(mode) {
    setViewMode(mode);
    setExpandedTrackingGroups(new Set());
    setQuery('');
    setSearchOpen(false);
    setMenuOpen(false);
  }

  function toggleTrackingGroup(groupId) {
    setExpandedTrackingGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  return <main className="app-shell">
    <header className="topbar">
      <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="打开菜单"><Menu size={23} /></button>
      <div className="brand-mark" aria-hidden="true"><i /><i /><i /></div>
      <div className="brand-copy"><strong>排列五</strong><span>每日开奖簿</span></div>
      <div className="header-actions">
        {viewMode === 'history' && <button className="icon-btn" onClick={() => setSearchOpen(!searchOpen)} aria-label="搜索期号"><Search size={20} /></button>}
        <button className="icon-btn" onClick={load} disabled={status === 'loading'} aria-label="刷新开奖结果"><RefreshCw className={status === 'loading' ? 'spin' : ''} size={20} /></button>
      </div>
    </header>

    <div className={`drawer-layer ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
      <button className="drawer-backdrop" onClick={() => setMenuOpen(false)} aria-label="关闭菜单" tabIndex={menuOpen ? 0 : -1} />
      <aside className="settings-drawer" role="dialog" aria-modal="true" aria-label="页面设置">
        <div className="drawer-header">
          <div><Settings2 size={19} /><strong>页面设置</strong></div>
          <button className="icon-btn" onClick={() => setMenuOpen(false)} aria-label="关闭设置"><X size={20} /></button>
        </div>
        <div className="drawer-body">
          <section className="setting-group">
            <div className="setting-heading">
              <span><ScanSearch size={17} />展示视图</span>
              <small>切换完整列表或不同匹配追踪</small>
            </div>
            <div className="view-control" role="group" aria-label="展示视图">
              {viewOptions.map((option) => {
                const Icon = option.icon;
                return <button
                  type="button"
                  key={option.value}
                  className={viewMode === option.value ? 'active' : ''}
                  aria-pressed={viewMode === option.value}
                  onClick={() => changeViewMode(option.value)}
                ><Icon size={16} />{option.label}</button>;
              })}
            </div>
          </section>
          <section className="setting-group">
            <div className="setting-heading">
              <span><LayoutList size={17} />列表排版</span>
              <small>调整开奖记录的显示密度</small>
            </div>
            <div className="density-control drawer-density" role="group" aria-label="排版紧凑程度">
              {densityOptions.map((option) => <button
                type="button"
                key={option.value}
                className={density === option.value ? 'active' : ''}
                aria-pressed={density === option.value}
                onClick={() => setDensity(option.value)}
              >{option.label}</button>)}
            </div>
          </section>
          <section className="setting-group">
            <div className="setting-heading">
              <span><Hash size={17} />显示期数</span>
              <small>选择需要加载的历史开奖数量</small>
            </div>
            <div className="period-control" role="group" aria-label="显示期数">
              {periodOptions.map((count) => <button
                type="button"
                key={count}
                className={periodCount === count ? 'active' : ''}
                aria-pressed={periodCount === count}
                onClick={() => changePeriodCount(count)}
              >{count}</button>)}
            </div>
          </section>
        </div>
        <p className="drawer-note">更多显示设置将在这里统一管理</p>
      </aside>
    </div>

    <section className="hero">
      <div>
        <p className="eyebrow"><CalendarDays size={14} /> 最新一期 · {latest?.date || '正在获取'}</p>
        <h1>{latest?.issue || '排列五'}</h1>
      </div>
      <div className="latest-balls" aria-label={latest ? `开奖号码 ${latest.numbers.join(' ')}` : '加载中'}>
        {(latest?.numbers || ['-', '-', '-', '-', '-']).map((number, index) => <b key={index}>{number}</b>)}
      </div>
      <div className={`source-state ${status}`}>
        <span />{status === 'live' ? '官方数据已同步' : status === 'fallback' ? '演示数据 · 接口暂不可用' : status === 'error' ? '加载失败，请重试' : '正在同步数据'}
      </div>
    </section>

    {searchOpen && <div className="search-row">
      <Search size={17} /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入期号，如 2025204" />
      {query && <button onClick={() => setQuery('')} aria-label="清空搜索"><X size={17} /></button>}
    </div>}

    <section className={`results-panel density-${density} view-${viewMode}`}>
      <div className="section-title">
        <div>
          {viewMode === 'history' ? <History size={18} /> : viewMode === 'tail-match' ? <ScanSearch size={18} /> : <Target size={18} />}
          <h2>{viewMode === 'history' ? '历史开奖记录' : viewMode === 'tail-match' ? '末二同号追踪' : '同位高重追踪'}</h2>
        </div>
        <div className="result-meta">
          <strong>{status === 'loading' && !rows.length ? '加载中' : viewMode === 'history' ? `共 ${visibleRows.length} 期` : `共 ${Math.max(0, activeTrackingGroups.length - 1)} 组命中`}</strong>
          <small>{updatedAt ? `${new Date(updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 更新` : ''}</small>
        </div>
      </div>
      <div className="table-head"><span>期号</span><span>开奖号码</span><span>和值</span><span>奇偶比</span></div>
      <div className={`result-list${viewMode !== 'history' ? ' tracking-list' : ''}`}>
        {viewMode === 'history' && visibleRows.map((row, rowIndex) => <ResultRow row={row} newest={rowIndex === 0} key={row.issue} />)}
        {viewMode !== 'history' && activeTrackingGroups.map((group, groupIndex) => <TrackingGroup
          group={group}
          latest={latest}
          viewMode={viewMode}
          isLatest={groupIndex === 0}
          expanded={expandedTrackingGroups.has(group.id)}
          onToggle={() => toggleTrackingGroup(group.id)}
          key={group.id}
        />)}
        {viewMode !== 'history' && activeTrackingGroups.length === 1 && status !== 'loading' && <div className="empty"><p>近 30 期暂无可比对结果</p></div>}
        {status === 'error' && <div className="empty"><p>暂时无法获取开奖结果</p><button onClick={load}>重新加载</button></div>}
        {viewMode === 'history' && status !== 'error' && !visibleRows.length && status !== 'loading' && <div className="empty"><p>没有找到对应期号</p></div>}
        {status === 'loading' && !rows.length && Array.from({ length: 7 }).map((_, i) => <div className="skeleton" key={i} />)}
      </div>
    </section>
    <footer>数据仅供查询，请以中国体育彩票官方公告为准</footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
