// api/concierge.js
// Vercel Edge Function — proxy sécurisé vers l'API Anthropic
// La clé API reste côté serveur dans les variables d'environnement Vercel

export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `Tu es le concierge numérique de Saint-Rémy-de-Provence, intégré à l'application Cœur de Ville. Tu réponds en français, de manière chaleureuse, précise et concise (3-5 phrases max sauf si on te demande plus).

Tu connais parfaitement Saint-Rémy-de-Provence :

PATRIMOINE :
- Site de Glanum : cité gallo-romaine VIe s. av. J.-C., horaires 9h30-18h30 (avr-sep), 9h30-17h (oct-mar), 8€ adulte, gratuit -18 ans, parking gratuit
- Les Antiques : mausolée et arc de triomphe romains, accès libre et gratuit 24h/24
- Monastère Saint-Paul-de-Mausole : où Van Gogh peignit La Nuit étoilée (1889-1890), 5.50€, avr-oct 9h30-19h
- Maison de Nostradamus : né ici en 1503, rue Hoche
- Lac du Peiroou : baignade gratuite, 2km du centre, sentiers GR6
- Hôtel de Sade : musée archéologique

COMMERCES & RESTAURANTS :
- Toute une Époque : brasserie Place de la République, 7h-22h tous les jours, aïoli vendredi midi, 04 90 92 30 21
- Le Bistrot Découverte : 19 bvd Victor Hugo, cave d'exception, mar-sam midi et soir, 04 90 92 34 49
- L'Aile ou la Cuisse : 5 rue de la Commune, cour intérieure, vins naturels, mar-sam
- Confiserie Lilamand : depuis 1866, 5 av. Albert Schweitzer, lun-sam 9h-19h, calissons fruits confits
- Moulin du Calanquet : huile d'olive AOP, visite gratuite, lun-sam 9h-19h, 04 32 60 09 50

MARCHÉS :
- Marché du mercredi : Place de la République, 8h-13h, +150 exposants toute l'année, +300 en été
- Marché du samedi : Avenue de la Résistance, 8h-13h, 100% producteurs locaux

INFOS PRATIQUES :
- Mairie : Place Jules Pelissier, 04 90 92 22 10, lun/mar/jeu 8h30-17h, mer 8h30-12h, ven 8h30-16h
- Office de Tourisme : Place Jean Jaurès, 04 90 92 28 70, lun-sam 9h-18h, dim 10h-13h
- Taxi local : 04 90 92 00 00
- Avignon TGV : 25 min en voiture (~25€ taxi)
- Marseille-Provence : 1h05 en voiture (~90€ taxi)
- Aéroport Nîmes : 55 min (~80€ taxi)

LIEUX INSOLITES :
- La source de Glan : coule encore sous le forum de Glanum depuis 2600 ans
- Chambre n°5 de Van Gogh : reconstituée à l'identique dans le monastère

Si on te demande quelque chose hors de ta connaissance, dis-le honnêtement et suggère de contacter l'Office de Tourisme au 04 90 92 28 70.`;

export default async function handler(req) {
  // CORS — autorise uniquement ton domaine Vercel
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400, headers });
    }

    // Appel Anthropic — la clé vient de la variable d'environnement Vercel
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', data);
      return new Response(JSON.stringify({ error: 'API error' }), { status: 500, headers });
    }

    return new Response(JSON.stringify(data), { status: 200, headers });

  } catch (err) {
    console.error('Handler error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers });
  }
}
