import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { idea_id, fingerprint, vote } = req.body;

    if (!idea_id || !fingerprint || ![1, -1, 0].includes(vote)) {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }

    // Récupère le vote précédent
    const { data: existingVote } = await supabase
      .from('idea_votes')
      .select('*')
      .eq('idea_id', idea_id)
      .eq('user_fingerprint', fingerprint)
      .single();

    const oldVote = existingVote?.vote || 0;

    if (vote === 0) {
      // Annulation du vote
      await supabase
        .from('idea_votes')
        .delete()
        .eq('idea_id', idea_id)
        .eq('user_fingerprint', fingerprint);
    } else {
      // Insert ou update du vote
      await supabase
        .from('idea_votes')
        .upsert({
          idea_id,
          user_fingerprint: fingerprint,
          vote
        }, { onConflict: 'idea_id,user_fingerprint' });
    }

    // Met à jour les compteurs sur citizen_ideas
    const { data: idea } = await supabase
      .from('citizen_ideas')
      .select('votes_up, votes_down')
      .eq('id', idea_id)
      .single();

    let upDelta = 0, downDelta = 0;
    if (oldVote === 1) upDelta -= 1;
    if (oldVote === -1) downDelta -= 1;
    if (vote === 1) upDelta += 1;
    if (vote === -1) downDelta += 1;

    await supabase
      .from('citizen_ideas')
      .update({
        votes_up: Math.max(0, (idea.votes_up || 0) + upDelta),
        votes_down: Math.max(0, (idea.votes_down || 0) + downDelta)
      })
      .eq('id', idea_id);

    const { data: updated } = await supabase
      .from('citizen_ideas')
      .select('votes_up, votes_down')
      .eq('id', idea_id)
      .single();

    return res.status(200).json({
      success: true,
      votes_up: updated.votes_up,
      votes_down: updated.votes_down,
      score: updated.votes_up - updated.votes_down
    });
  } catch (err) {
    console.error('Vote error:', err);
    return res.status(500).json({ error: err.message });
  }
}
