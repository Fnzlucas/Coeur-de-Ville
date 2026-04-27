// ════════════════════════════════════════════════════════════════
// CŒUR DE VILLE — Module Auth client
// À inclure sur toutes les pages qui ont besoin de l'auth
// Usage: <script src="/cdv-auth.js"></script>
// puis: window.CDV.user(), window.CDV.signIn(), etc.
// ════════════════════════════════════════════════════════════════

(function() {
  const SUPABASE_URL = 'https://bopeecfejyrezrigdhex.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvcGVlY2ZlanlyZXpyaWdkaGV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMTQxNTYsImV4cCI6MjA5Mjc5MDE1Nn0.F5AB9XfuXmLlnPUrYNxF1ArOwaaAP-A2iEcc6qRCNiE';

  // Charge le SDK Supabase JS si pas déjà fait
  let _supabaseClient = null;
  let _ready = false;
  let _readyCallbacks = [];

  function _whenReady(cb) {
    if (_ready) cb();
    else _readyCallbacks.push(cb);
  }

  function _initSupabase() {
    if (window.supabase && window.supabase.createClient) {
      console.log('[CDV] Supabase SDK détecté, init du client');
      _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: 'cdv-auth-token'
        }
      });
      _ready = true;
      console.log('[CDV] Client Supabase prêt, ' + _readyCallbacks.length + ' callbacks en attente');
      _readyCallbacks.forEach(cb => cb());
      _readyCallbacks = [];
    } else {
      console.log('[CDV] Chargement du SDK Supabase depuis CDN...');
      // Charge le SDK depuis CDN
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.onload = function() {
        console.log('[CDV] SDK Supabase téléchargé');
        _initSupabase();
      };
      script.onerror = () => {
        console.error('[CDV] Échec chargement Supabase SDK');
      };
      document.head.appendChild(script);
    }
  }

  // Lance l'init dès que le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initSupabase);
  } else {
    _initSupabase();
  }

  // ════════════════════════════════════════════════════════════════
  // API PUBLIQUE
  // ════════════════════════════════════════════════════════════════
  window.CDV = window.CDV || {};

  // Récupère l'utilisateur courant (avec son profil étendu)
  window.CDV.getUser = async function() {
    return new Promise((resolve) => {
      _whenReady(async () => {
        try {
          const { data: { user } } = await _supabaseClient.auth.getUser();
          if (!user) return resolve(null);

          // Récupère le profil étendu
          const { data: profile } = await _supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          resolve({
            id: user.id,
            email: user.email,
            phone: user.phone,
            first_name: profile?.first_name || '',
            last_name: profile?.last_name || '',
            qr_code: profile?.qr_code || '',
            default_ville: profile?.default_ville || 'villeneuve',
            avatar_url: profile?.avatar_url || ''
          });
        } catch (err) {
          console.error('[CDV] getUser error:', err);
          resolve(null);
        }
      });
    });
  };

  // Connexion email + mot de passe
  window.CDV.signIn = async function(email, password) {
    return new Promise((resolve, reject) => {
      _whenReady(async () => {
        try {
          const { data, error } = await _supabaseClient.auth.signInWithPassword({ email, password });
          if (error) throw error;
          resolve(data.user);
        } catch (err) {
          reject(err);
        }
      });
    });
  };

  // Inscription email + mot de passe
  window.CDV.signUp = async function(email, password, firstName, lastName, phone) {
    return new Promise((resolve, reject) => {
      _whenReady(async () => {
        try {
          const { data, error } = await _supabaseClient.auth.signUp({
            email,
            password,
            options: {
              data: {
                first_name: firstName,
                last_name: lastName
              }
            }
          });
          if (error) throw error;
          resolve(data.user);
        } catch (err) {
          reject(err);
        }
      });
    });
  };

  // Déconnexion
  window.CDV.signOut = async function() {
    return new Promise((resolve) => {
      _whenReady(async () => {
        await _supabaseClient.auth.signOut();
        resolve();
      });
    });
  };

  // Récupère les points de fidélité de l'utilisateur courant pour une ville
  window.CDV.getLoyaltyPoints = async function(villeSlug = 'villeneuve') {
    return new Promise((resolve) => {
      _whenReady(async () => {
        try {
          const { data: { user } } = await _supabaseClient.auth.getUser();
          if (!user) return resolve(null);

          const { data, error } = await _supabaseClient
            .from('loyalty_points')
            .select('*')
            .eq('user_id', user.id)
            .eq('ville_slug', villeSlug)
            .maybeSingle();

          if (error) throw error;
          resolve(data || { points: 0, total_earned: 0, total_spent: 0, ville_slug: villeSlug });
        } catch (err) {
          console.error('[CDV] getLoyaltyPoints error:', err);
          resolve(null);
        }
      });
    });
  };

  // Récupère l'historique des transactions de l'utilisateur
  window.CDV.getTransactions = async function(villeSlug = 'villeneuve', limit = 20) {
    return new Promise((resolve) => {
      _whenReady(async () => {
        try {
          const { data: { user } } = await _supabaseClient.auth.getUser();
          if (!user) return resolve([]);

          const { data, error } = await _supabaseClient
            .from('loyalty_transactions')
            .select('*, merchants(business_name, logo_url)')
            .eq('user_id', user.id)
            .eq('ville_slug', villeSlug)
            .order('created_at', { ascending: false })
            .limit(limit);

          if (error) throw error;
          resolve(data || []);
        } catch (err) {
          console.error('[CDV] getTransactions error:', err);
          resolve([]);
        }
      });
    });
  };

  // Met à jour le profil utilisateur
  window.CDV.updateProfile = async function(updates) {
    return new Promise((resolve, reject) => {
      _whenReady(async () => {
        try {
          const { data: { user } } = await _supabaseClient.auth.getUser();
          if (!user) throw new Error('Non connecté');
          const { error } = await _supabaseClient
            .from('user_profiles')
            .update(updates)
            .eq('id', user.id);
          if (error) throw error;
          resolve(true);
        } catch (err) {
          reject(err);
        }
      });
    });
  };

  // Demande la réinitialisation de mot de passe
  window.CDV.resetPassword = async function(email) {
    return new Promise((resolve, reject) => {
      _whenReady(async () => {
        try {
          const { error } = await _supabaseClient.auth.resetPasswordForEmail(email);
          if (error) throw error;
          resolve(true);
        } catch (err) {
          reject(err);
        }
      });
    });
  };

  // Accès direct au client Supabase pour les cas avancés
  window.CDV.supabase = function() {
    return _supabaseClient;
  };
})();
