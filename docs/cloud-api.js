// Adapt the existing UI API to the shared Drive backend.
(() => {
  const originalFetch = window.fetch.bind(window);
  const sessions = new Map();
  window.fetch = async (input, options = {}) => {
    if (typeof input !== 'string' || !input.startsWith('/api/')) return originalFetch(input, options);
    if (!window.RANGE_API_URL) throw Error('公開用の保存先が未設定です。');
    const url = new URL(input, location.origin);
    const data = options.body ? JSON.parse(options.body) : Object.fromEntries(url.searchParams);
    data.action = url.pathname.slice(5);
    data.token = sessions.get(data.campus) || '';
    const response = await originalFetch(window.RANGE_API_URL, {
      method: 'POST', headers: {'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify(data), redirect: 'follow', credentials: 'omit'
    });
    if (!response.ok) throw Error('保存先に接続できませんでした。');
    const result = await response.json();
    if (result.token) { sessions.set(data.campus, result.token); delete result.token; }
    if (result.status === 403) sessions.delete(data.campus);
    if (result.code === 'EXAM_CHANGED') window.CurrentExam?.expire();
    return new Response(JSON.stringify(result), {status:result.status || 200, headers:{'Content-Type':'application/json'}});
  };
})();
