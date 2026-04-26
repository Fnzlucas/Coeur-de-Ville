import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_STATUSES = ['pending', 'approved', 'in_progress', 'done', 'rejected'];

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers['x-admin-token'];
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { id, status, mairie_response } = req.body;

    if (!id || !status) {
      return res.status(400).json({ error: 'id et status requis' });
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Status invalide' });
    }

    const update = { status };

    // Si on passe d'autre chose à approved (ou on valide pour la 1ère fois) → on note la date
    if (status === 'approved' || status === 'in_progress' || status === 'done') {
      update.validated_at = new Date().toISOString();
    }

    if (mairie_response !== undefined) {
      update.mairie_response = mairie_response;
      if (mairie_response) {
        update.mairie_response_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from('citizen_ideas')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json({ success: true, idea: data });
  } catch (err) {
    console.error('Admin update idea error:', err);
    return res.status(500).json({ error: err.message });
  }
}
