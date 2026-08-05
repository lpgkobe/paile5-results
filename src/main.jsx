import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays, Hash, History, LayoutList, Menu, RefreshCw, Search, Settings2, X } from 'lucide-react';
import './styles.css';

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

function App() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('loading');
  const [updatedAt, setUpdatedAt] = useState('');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [density, setDensity] = useState(() => localStorage.getItem('paile5-density') || 'relaxed');
  const [periodCount, setPeriodCount] = useState(() => Number(localStorage.getItem('paile5-period-count')) || 30);

  async function load() {
    setStatus('loading');
    try {
      const response = await fetch(`/api/results?limit=${periodCount}`);
      if (!response.ok) throw new Error('request failed');
      const data = await response.json();
      setRows(data.rows || []);
      setUpdatedAt(data.updatedAt);
      setStatus(data.source);
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => { load(); }, [periodCount]);
  useEffect(() => { localStorage.setItem('paile5-density', density); }, [density]);
  useEffect(() => { localStorage.setItem('paile5-period-count', String(periodCount)); }, [periodCount]);
  useEffect(() => {
    document.body.classList.toggle('drawer-open', menuOpen);
    return () => document.body.classList.remove('drawer-open');
  }, [menuOpen]);
  const visibleRows = useMemo(() => rows.filter((row) => row.issue.includes(query.trim())), [rows, query]);
  const latest = visibleRows[0];

  function changePeriodCount(count) {
    if (count === periodCount) {
      setMenuOpen(false);
      return;
    }
    setRows([]);
    setPeriodCount(count);
    setMenuOpen(false);
  }

  return <main className="app-shell">
    <header className="topbar">
      <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="打开菜单"><Menu size={23} /></button>
      <div className="brand-mark" aria-hidden="true"><i /><i /><i /></div>
      <div className="brand-copy"><strong>排列五</strong><span>每日开奖簿</span></div>
      <div className="header-actions">
        <button className="icon-btn" onClick={() => setSearchOpen(!searchOpen)} aria-label="搜索期号"><Search size={20} /></button>
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

    <section className={`results-panel density-${density}`}>
      <div className="section-title">
        <div><History size={18} /><h2>历史开奖记录</h2></div>
        <div className="result-meta">
          <strong>{status === 'loading' && !rows.length ? '加载中' : `共 ${visibleRows.length} 期`}</strong>
          <small>{updatedAt ? `${new Date(updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 更新` : ''}</small>
        </div>
      </div>
      <div className="table-head"><span>期号</span><span>开奖号码</span><span>和值</span><span>奇偶比</span></div>
      <div className="result-list">
        {visibleRows.map((row, rowIndex) => <article className={rowIndex === 0 ? 'result-row newest' : 'result-row'} key={row.issue}>
          <div className="issue"><strong>{row.issue}</strong><small>{row.date?.slice(5).replace('-', '/')}</small></div>
          <div className="balls">{row.numbers.map((number, index) => <span key={index}>{number}</span>)}</div>
          <strong className="sum">{sumOf(row.numbers)}</strong>
          <span className="parity">{parityOf(row.numbers)}</span>
        </article>)}
        {status === 'error' && <div className="empty"><p>暂时无法获取开奖结果</p><button onClick={load}>重新加载</button></div>}
        {status !== 'error' && !visibleRows.length && status !== 'loading' && <div className="empty"><p>没有找到对应期号</p></div>}
        {status === 'loading' && !rows.length && Array.from({ length: 7 }).map((_, i) => <div className="skeleton" key={i} />)}
      </div>
    </section>
    <footer>数据仅供查询，请以中国体育彩票官方公告为准</footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
