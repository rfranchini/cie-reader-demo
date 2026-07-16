// Funzione serverless Vercel — proxy sicuro verso Google Cloud Vision.
// La chiave API resta qui (variabile d'ambiente sul server) e non è mai esposta al browser.
//
// Configurazione richiesta su Vercel: Project Settings → Environment Variables →
// aggiungi GOOGLE_VISION_API_KEY con il valore della tua chiave API di Google Cloud.

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

  const { imageBase64 } = req.body || {};
  if (!imageBase64) {
    // Se il corpo arriva vuoto quasi sempre è perché l'immagine supera il limite
    // di ~4.5MB per richiesta delle funzioni serverless di Vercel: la richiesta
    // viene scartata dalla piattaforma prima ancora di raggiungere questo codice.
    res.status(400).json({
      error: 'imageBase64 mancante — probabile immagine troppo grande (limite ~4.5MB per richiesta su Vercel)',
    });
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
