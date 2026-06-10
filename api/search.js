export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'Missing code parameter' });
  }

  const cleanCode = code.trim().replace(/[^0-9a-zA-Z]/g, '');

  // 1. 만약 6자리 숫자라면 국내 주식(Naver real-time API)으로 간주하고 처리
  if (/^[0-9]{6}$/.test(cleanCode)) {
    try {
      const url = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${cleanCode}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const item = data && data.result && data.result.areas && data.result.areas[0] && data.result.areas[0].datas && data.result.areas[0].datas[0];
        
        if (item) {
          return res.status(200).json({
            market: 'kr',
            name: item.nm, // 종목명
            ticker: cleanCode,
            cur: parseFloat(item.nv) // 현재가
          });
        }
      }
    } catch (e) {
      console.error('Failed to fetch from Naver:', e);
    }
  }

  // 2. 그 외의 경우 미국 주식(Yahoo Finance API)으로 간주하고 처리
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanCode)}?range=1d&interval=1d`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const r = data && data.chart && data.chart.result && data.chart.result[0];
      if (r && r.meta) {
        return res.status(200).json({
          market: 'us',
          name: cleanCode.toUpperCase(), // 미국 주식명은 일단 티커 대문자로 처리
          ticker: cleanCode.toUpperCase(),
          cur: r.meta.regularMarketPrice // 현재가
        });
      }
    }
  } catch (e) {
    console.error('Failed to fetch from Yahoo:', e);
  }

  return res.status(404).json({ error: 'Stock not found' });
}
