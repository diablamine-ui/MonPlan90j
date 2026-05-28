// ═══════════════════════════════════════════════════════
// Route API sécurisée MonPlan90 — Gemini Flash
// La clé API ne touche JAMAIS le frontend
// ═══════════════════════════════════════════════════════

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Clé API non configurée sur le serveur' });

  const { prompt, maxTokens = 2000, type = 'plan' } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Prompt manquant' });

  const isJSON = type !== 'coach';
  
  const systemInstruction = isJSON
    ? `Tu es un générateur de JSON strict. RÈGLE ABSOLUE : ta réponse commence IMMÉDIATEMENT par { et se termine par }. Zéro texte avant. Zéro backtick. Zéro explication. Uniquement du JSON valide et complet.`
    : `Tu es un coach comportemental expert. Tu réponds directement, en 3-4 phrases maximum. Direct, humain, stratégique. Jamais de "crois en toi" ou encouragements génériques. Toujours une action concrète en fin de réponse.`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const callGemini = async (attempt = 1) => {
    try {
      const body = {
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{
          role: 'user',
          parts: [{ text: isJSON ? prompt + '\n\nRAPPEL : commence par { immédiatement, sans aucun texte avant.' : prompt }]
        }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: type === 'coach' ? 0.8 : 0.7,
          ...(isJSON && { responseMimeType: 'application/json' }),
        },
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = err.error?.message || `Erreur Gemini ${response.status}`;
        if (response.status === 429 && attempt < 3) {
          await sleep(2000 * attempt);
          return callGemini(attempt + 1);
        }
        throw new Error(msg);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!text) throw new Error('Réponse vide de Gemini');

      // Coach — retourner le texte directement
      if (type === 'coach') {
        return res.status(200).json({ result: text.trim() });
      }

      // JSON — parser et valider
      const parsed = parseJSON(text);
      if (parsed) return res.status(200).json({ result: parsed });

      if (attempt < 3) {
        await sleep(1500 * attempt);
        return callGemini(attempt + 1);
      }

      return res.status(500).json({
        error: 'JSON invalide après 3 tentatives',
        preview: text.slice(0, 300)
      });

    } catch (e) {
      if (attempt < 3) {
        await sleep(1500 * attempt);
        return callGemini(attempt + 1);
      }
      return res.status(500).json({ error: e.message });
    }
  };

  return callGemini();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function parseJSON(str) {
  // Nettoyage
  let s = str.trim();
  if (s.startsWith('```')) s = s.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
  
  // Trouver le début du JSON
  const start = s.indexOf('{');
  if (start > 0) s = s.slice(start);
  
  // Tentative 1 — parse direct
  try { return JSON.parse(s); } catch {}
  
  // Tentative 2 — compléter les accolades manquantes
  try {
    let opens = 0, closes = 0;
    for (const c of s) { if (c === '{') opens++; if (c === '}') closes++; }
    let fixed = s;
    while (opens > closes) { fixed += '}'; closes++; }
    return JSON.parse(fixed);
  } catch {}
  
  // Tentative 3 — nettoyer les caractères problématiques
  try {
    const cleaned = s
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    return JSON.parse(cleaned);
  } catch {}
  
  return null;
}
