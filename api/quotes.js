export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { kr, us } = req.query;
  const results = {};

  // 1. 국내 주식 실시간 시세 조회 (Naver API - EUC-KR 디코딩)
  if (kr) {
    const krTickers = kr.split(',').map(t => t.trim()).filter(Boolean);
    if (krTickers.length > 0) {
      try {
        const krPromises = krTickers.map(async (ticker) => {
          try {
            const url = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${ticker}`;
            const response = await fetch(url);
            if (response.ok) {
              const buffer = await response.arrayBuffer();
              const decoder = new TextDecoder('euc-kr');
              const text = decoder.decode(buffer);
              const data = JSON.parse(text);
              const item = data && data.result && data.result.areas && data.result.areas[0] && data.result.areas[0].datas && data.result.areas[0].datas[0];
              if (item) {
                const cur = parseFloat(item.nv);
                const pcv = parseFloat(item.pcv);
                const cr = parseFloat(item.cr) || 0;
                const rf = item.rf;
                results[ticker] = {
                  cur: cur,
                  changePercent: pcv ? ((cur - pcv) / pcv) * 100 : ((rf === '4' || rf === '5') ? -cr : cr)
                };
              }
            }
          } catch (e) {
            console.error(`Failed to fetch KR quote for ${ticker}:`, e);
          }
        });
        await Promise.all(krPromises);
      } catch (e) {
        console.error('Failed to batch fetch KR quotes:', e);
      }
    }
  }

  // 2. 미국 주식 실시간 시세 조회 (Yahoo Finance API)
  if (us) {
    const usTickers = us.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    if (usTickers.length > 0) {
      try {
        const usPromises = usTickers.map(async (ticker) => {
          try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d`;
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            });
            if (response.ok) {
              const data = await response.json();
              const meta = data && data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;
              if (meta) {
                const cur = meta.regularMarketPrice;
                const prev = meta.chartPreviousClose;
                results[ticker] = {
                  cur: cur,
                  changePercent: prev ? ((cur - prev) / prev) * 100 : 0
                };
              }
            }
          } catch (e) {
            console.error(`Failed to fetch US quote for ${ticker}:`, e);
          }
        });
        await Promise.all(usPromises);
      } catch (e) {
        console.error('Failed to batch fetch US quotes:', e);
      }
    }
  }

  return res.status(200).json(results);
}
