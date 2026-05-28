export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.GROQ_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Clé API non configurée' });

  // Parse body manually - Vercel needs this
  let body = {};
  try {
    if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    } else if (req.body && typeof req.body === 'object') {
      body = req.body;
    } else {
      // Read raw body
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString());
    }
  } catch (e) {
    return res.status(400).json({ error: 'Corps de requête invalide' });
  }

  const { prompt, maxTokens = 2000, type = 'plan' } = body;
  if (!prompt) return res.status(400).json({ error: 'Prompt manquant' });

  const isJSON = type !== 'coach';
  const system = isJSON
    ? "Tu es un générateur de JSON strict. RÈGLE ABSOLUE : ta réponse commence IMMÉDIATEMENT par { et se termine par }. Zéro texte avant. Zéro backtick. Uniquement du JSON valide et complet."
    : "Tu es un coach comportemental expert. 3-4 phrases max. Direct, stratégique. Toujours une action concrète.";

  const call = async (attempt = 1) => {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: isJSON ? prompt + '\n\nRAPPEL : commence par { immédiatement.' : prompt }
          ]
        })
      });

      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error?.message || `Erreur Groq ${r.status}`);
      }

      const data = await r.json();
      const text = data.choices?.[0]?.message?.content || '';
      if (!text) throw new Error('Réponse vide');

      if (type === 'coach') return res.status(200).json({ result: text.trim() });

      const parsed = parseJSON(text);
      if (parsed) return res.status(200).json({ result: parsed });

      if (attempt < 3) { await new Promise(x => setTimeout(x, 1500 * attempt)); return call(attempt + 1); }
      return res.status(500).json({ error: 'JSON invalide', preview: text.slice(0, 200) });

    } catch (e) {
      if (attempt < 3) { await new Promise(x => setTimeout(x, 1500 * attempt)); return call(attempt + 1); }
      return res.status(500).json({ error: e.message });
    }
  };

  return call();
}

function parseJSON(str) {
  let s = str.trim();
  if (s.startsWith('```')) s = s.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
  const start = s.indexOf('{');
  if (start > 0) s = s.slice(start);
  try { return JSON.parse(s); } catch {}
  try {
    let o = 0, c = 0;
    for (const ch of s) { if (ch === '{') o++; if (ch === '}') c++; }
    let f = s; while (o > c) { f += '}'; c++; }
    return JSON.parse(f);
  } catch {}
  try {
    return JSON.parse(s.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'));
  } catch {}
  return null;
}
