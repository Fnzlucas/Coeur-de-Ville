import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers['x-admin-token'];
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { ville = 'villeneuve' } = req.query;

    // Compteurs en parallèle
    const [
      subsRes,
      notifsRes,
      ideasRes,
      recentNotifs
    ] = await Promise.all([
      supabase.from('push_subscriptions').select('*', { count: 'exact', head: true }).eq('ville', ville),
      supabase.from('notifications_sent').select('*', { count: 'exact', head: true }).eq('ville', ville),
      supabase.from('citizen_ideas').select('*').eq('ville', ville),
      supabase.from('notifications_sent').select('*').eq('ville', ville).order('sent_at', { ascending: false }).limit(5)
    ]);

    const ideas = ideasRes.data || [];
    const ideasPending = ideas.filter(i => i.status === 'pending').length;
    const ideasApproved = ideas.filter(i => ['approved','in_progress','done'].includes(i.status)).length;
    const ideasDone = ideas.filter(i => i.status === 'done').length;
    const ideasVotes = ideas.reduce((s, i) => s + (i.votes_up || 0) + (i.votes_down || 0), 0);

    // Notifs ce mois
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);
    const notifsThisMonth = (recentNotifs.data || []).filter(n => new Date(n.sent_at) >= startOfMonth).length;

    // Engagement moyen (basé sur les notifs)
    const allNotifs = recentNotifs.data || [];
    const avgEngagement = allNotifs.length > 0
      ? Math.round(
          allNotifs.reduce((s, n) => {
            const recipients = n.recipients_count || 0;
            const delivered = n.delivered_count || 0;
            return s + (recipients > 0 ? (delivered / recipients) * 100 : 0);
          }, 0) / allNotifs.length
        )
      : 0;

    // Activité récente (5 dernières notifs + dernières idées)
    const activity = [];
    (recentNotifs.data || []).slice(0, 3).forEach(n => {
      activity.push({
        icon: 'campaign',
        text: `Notification diffusée : <strong>${escapeHtml(n.title)}</strong>`,
        meta: `${n.delivered_count || 0} reçus · ${timeAgo(n.sent_at)}`,
        ts: new Date(n.sent_at).getTime()
      });
    });
    ideas.slice(0, 3).forEach(i => {
      const label = i.status === 'pending' ? 'Nouvelle idée à modérer' : `Idée ${i.status}`;
      activity.push({
        icon: 'lightbulb',
        text: `${label} : <strong>${escapeHtml(i.title)}</strong>`,
        meta: `${i.author_name || 'Anonyme'} · ${timeAgo(i.created_at)}`,
        ts: new Date(i.created_at).getTime()
      });
    });
    activity.sort((a, b) => b.ts - a.ts);

    return res.status(200).json({
      ville,
      stats: {
        abonnes: subsRes.count || 0,
        notifs_total: notifsRes.count || 0,
        notifs_this_month: notifsThisMonth,
        ideas_pending: ideasPending,
        ideas_approved: ideasApproved,
        ideas_done: ideasDone,
        ideas_votes: ideasVotes,
        engagement: avgEngagement,
        commerces: 0,    // pas encore en base
        parcours: 0,     // pas encore en base
        events: 0,       // pas encore en base
        users_mairie: 0  // pas encore en base
      },
      activity: activity.slice(0, 6)
    });
  } catch (err) {
    console.error('Ville stats error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function timeAgo(ts) {
  if (!ts) return 'inconnu';
  const d = new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff/3600)} h`;
  return `il y a ${Math.floor(diff/86400)} j`;
}
