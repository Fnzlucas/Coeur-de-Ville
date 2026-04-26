import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ville = 'villeneuve', status, sort = 'votes' } = req.query;

    let query = supabase
      .from('citizen_ideas')
      .select('*')
      .eq('ville', ville)
      .in('status', ['approved', 'in_progress', 'done']);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Tri
    if (sort === 'recent') {
      query = query.order('validated_at', { ascending: false });
    } else {
      // Par défaut : tri par score (votes_up - votes_down)
      query = query.order('votes_up', { ascending: false });
    }

    const { data, error } = await query.limit(50);
    if (error) throw error;

    return res.status(200).json({ ideas: data });
  } catch (err) {
    console.error('Get ideas error:', err);
    return res.status(500).json({ error: err.message });
  }
}
