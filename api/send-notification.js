import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

webpush.setVapidDetails(
  'mailto:contact@coeur-de-ville.fr',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth simple : token partagé entre admin-mairie.html et cet endpoint
  const authToken = req.headers['x-admin-token'];
  if (authToken !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const {
      title,
      body,
      category = 'Communication',
      icon = 'campaign',
      url = '/',
      ville = 'villeneuve',
      target = 'all',
      sender = 'Mairie'
    } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body required' });
    }

    // Récupère les abonnés selon la cible
    let query = supabase.from('push_subscriptions').select('*').eq('ville', ville);
    if (target === 'locals') query = query.eq('user_type', 'local');
    if (target === 'visitors') query = query.eq('user_type', 'visitor');

    const { data: subs, error } = await query;
    if (error) throw error;

    const payload = JSON.stringify({
      title,
      body,
      icon,
      category,
      url,
      timestamp: Date.now()
    });

    let delivered = 0;
    let failed = 0;
    const invalidEndpoints = [];

    // Envoie à tous les abonnés en parallèle
    await Promise.all(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          payload
        );
        delivered++;
      } catch (err) {
        failed++;
        // Si abonnement invalide (410/404), on le supprime
        if (err.statusCode === 410 || err.statusCode === 404) {
          invalidEndpoints.push(sub.endpoint);
        }
      }
    }));

    // Nettoyage des abonnements invalides
    if (invalidEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', invalidEndpoints);
    }

    // Log dans la base
    await supabase.from('notifications_sent').insert({
      title, body, category, icon, url, ville, target, sender,
      recipients_count: subs.length,
      delivered_count: delivered
    });

    return res.status(200).json({
      success: true,
      total: subs.length,
      delivered,
      failed
    });
  } catch (err) {
    console.error('Send notif error:', err);
    return res.status(500).json({ error: err.message });
  }
}
