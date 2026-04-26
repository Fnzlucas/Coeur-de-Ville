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
    const { data, error } = await supabase
      .from('citizen_ideas')
      .select('*')
      .eq('ville', ville)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;
    return res.status(200).json({ ideas: data || [] });
  } catch (err) {
    console.error('Admin list ideas error:', err);
    return res.status(500).json({ error: err.message });
  }
}
