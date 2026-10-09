import express from 'express';
import { createServer as createViteServer } from 'vite';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8024);

const demo = [].map(([issue, numbers, date]) => ({ issue, numbers: numbers.split(' ').map(Number), date }));

function normalize(payload) {
  const rows = payload?.value?.list || payload?.data?.list || payload?.data || [];
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const raw = row.lotteryDrawResult || row.openCode || row.number || row.result || '';
    const numbers = String(raw).match(/\d/g)?.slice(0, 5).map(Number) || [];
    return {
      issue: String(row.lotteryDrawNum || row.issue || row.expect || row.period || ''),
      numbers,
      date: String(row.lotteryDrawTime || row.date || row.openTime || '').slice(0, 10)
    };
  }).filter((row) => row.issue && row.numbers.length === 5);
}

app.get('/api/results', async (req, res) => {
  const requestedLimit = Number(req.query.limit);
  const limit = [30, 50, 100, 200].includes(requestedLimit) ? requestedLimit : 30;
  const contextPeriods = Number(req.query.context) === 3 ? 3 : 0;
  const fetchLimit = limit + contextPeriods;
  const headers = { 'user-agent': 'Mozilla/5.0', accept: 'application/json', referer: 'https://www.sporttery.cn/' };

  try {
    const pageSize = Math.min(fetchLimit, 100);
    const pages = Math.ceil(fetchLimit / pageSize);
    const officialRows = [];
    for (let pageNo = 1; pageNo <= pages; pageNo += 1) {
      const url = `https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=350133&provinceId=0&pageSize=${pageSize}&isVerify=1&pageNo=${pageNo}`;
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(7000) });
      if (!response.ok) break;
      const pageRows = normalize(await response.json());
      if (!pageRows.length) break;
      officialRows.push(...pageRows);
    }
    const uniqueRows = [...new Map(officialRows.map((row) => [row.issue, row])).values()];
    if (uniqueRows.length) {
      return res.json({ source: 'live', updatedAt: new Date().toISOString(), rows: uniqueRows.slice(0, fetchLimit) });
    }
  } catch { /* try the secondary public source */ }

  try {
    const response = await fetch('https://api.pearktrue.cn/api/lottery/?type=pl5', {
      headers,
      signal: AbortSignal.timeout(7000)
    });
    if (response.ok) {
      const rows = normalize(await response.json());
      if (rows.length) return res.json({ source: 'live', updatedAt: new Date().toISOString(), rows: rows.slice(0, fetchLimit) });
    }
  } catch { /* use local fallback */ }
  res.json({ source: 'fallback', updatedAt: new Date().toISOString(), rows: demo.slice(0, fetchLimit) });
});

if (process.argv.includes('--production') && existsSync(path.join(root, 'dist'))) {
  app.use(express.static(path.join(root, 'dist')));
  app.use((_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
} else {
  const vite = await createViteServer({ root, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(port, () => console.log(`排列五开奖簿: http://localhost:${port}`));
