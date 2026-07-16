// Funzione serverless Vercel — proxy sicuro verso Google Cloud Vision.
// La chiave API resta qui (variabile d'ambiente sul server) e non è mai esposta al browser.
//
// Configurazione richiesta su Vercel: Project Settings → Environment Variables →
// aggiungi GOOGLE_VISION_API_KEY con il valore della tua chiave API di Google Cloud.

// Legge manualmente il corpo grezzo della richiesta come stringa, per non dipendere
// dal parsing automatico del body (che in alcuni setup non scatta).
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo non consentito, usa POST' });
    return;
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GOOGLE_VISION_API_KEY non configurata sul server (Vercel → Settings → Environment Variables)' });
    return;
  }

  // Leggo il corpo della richiesta "a mano" invece di fare affidamento sul parsing
  // automatico di req.body: in alcuni setup (funzione fuori da un progetto Next.js)
  // non viene popolato automaticamente e req.body risulta sempre undefined.
  let body = req.body;
  if (!body || typeof body === 'string') {
    try {
      const raw = typeof body === 'string' ? body : await readRawBody(req);
      body = raw ? JSON.parse(raw) : {};
    } catch (err) {
      res.status(400).json({ error: 'Corpo della richiesta non leggibile come JSON: ' + err.message });
      return;
    }
  }

  const { imageBase64 } = body || {};
  if (!imageBase64) {
    res.status(400).json({ error: 'imageBase64 mancante nel corpo della richiesta' });
    return;
  }

  try {
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBase64 },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              imageContext: { languageHints: ['it', 'en'] },
            },
          ],
        }),
      }
    );

    const data = await visionRes.json();
    const first = data?.responses?.[0];

    if (first?.error) {
      res.status(502).json({ error: 'Google Vision: ' + first.error.message });
      return;
    }

    const text = first?.fullTextAnnotation?.text || '';
    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: 'Errore chiamando Google Vision: ' + err.message });
  }
}
