import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { title, body, category, author_name, ville = 'villeneuve' } = req.body;

    if (!title || !body || !category) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }

    if (title.length > 80 || body.length > 500) {
      return res.status(400).json({ error: 'Texte trop long' });
    }

    const { data, error } = await supabase
      .from('citizen_ideas')
      .insert({
        title: title.trim(),
        body: body.trim(),
        category,
        author_name: author_name?.trim() || null,
        ville,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('Submit idea error:', err);
    return res.status(500).json({ error: err.message });
  }
}
