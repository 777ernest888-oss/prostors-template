export default {
  async fetch(request, env) {
    // Принимаем только POST-запросы
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Верификация секретного токена от Telegram
    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!env.TELEGRAM_SECRET || secret !== env.TELEGRAM_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Читаем тело запроса
    let body;
    try {
      body = await request.text();
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    // Пересылаем в Google Apps Script
    try {
      const response = await fetch(env.GAS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      });

      // Возвращаем ответ от функции обратно в Telegram
      const result = await response.text();
      return new Response(result, {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('Proxy error:', err);
      return new Response('Bad Gateway', { status: 502 });
    }
  },
};
