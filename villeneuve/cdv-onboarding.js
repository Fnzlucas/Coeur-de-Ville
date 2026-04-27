// ════════════════════════════════════════════════════════════════
// CŒUR DE VILLE — Module Onboarding
// Gère: sélection langue (1er lancement) + popup invitation compte (1er scroll)
// Usage: <script src="cdv-onboarding.js"></script>
// ════════════════════════════════════════════════════════════════

(function() {
  const LANG_KEY = 'cdv_lang';
  const ONBOARD_KEY = 'cdv_onboarded';
  const SIGNUP_PROMPT_KEY = 'cdv_signup_prompt_shown';
  const SIGNUP_DISMISSED_KEY = 'cdv_signup_dismissed';

  const LANG_NAMES = {
    fr: { name: 'Français', flag: '🇫🇷', greeting: 'Bonjour' },
    en: { name: 'English', flag: '🇬🇧', greeting: 'Hello' },
    es: { name: 'Español', flag: '🇪🇸', greeting: 'Hola' }
  };

  const TRANSLATIONS = {
    fr: {
      welcome_title: 'Bienvenue !',
      welcome_sub: 'Choisissez votre langue pour continuer',
      lang_continue: 'Continuer',
      signup_title: 'Profitez de plus avec un compte',
      signup_sub: 'Créez votre compte gratuit Cœur de Ville pour débloquer les avantages.',
      signup_perk1_title: 'Programme de fidélité',
      signup_perk1_desc: '+10 points par achat chez les commerçants partenaires',
      signup_perk2_title: 'Récompenses exclusives',
      signup_perk2_desc: 'Café offert, réductions, cadeaux à débloquer',
      signup_perk3_title: 'Vie locale personnalisée',
      signup_perk3_desc: 'Favoris, idées citoyennes, événements préférés',
      signup_cta: 'Créer mon compte gratuitement',
      signup_skip: 'Plus tard',
      signup_signin: 'J\'ai déjà un compte'
    },
    en: {
      welcome_title: 'Welcome!',
      welcome_sub: 'Choose your language to continue',
      lang_continue: 'Continue',
      signup_title: 'Get more with an account',
      signup_sub: 'Create your free Cœur de Ville account to unlock benefits.',
      signup_perk1_title: 'Loyalty program',
      signup_perk1_desc: '+10 points per purchase at partner shops',
      signup_perk2_title: 'Exclusive rewards',
      signup_perk2_desc: 'Free coffee, discounts, gifts to unlock',
      signup_perk3_title: 'Personalized local life',
      signup_perk3_desc: 'Favorites, citizen ideas, preferred events',
      signup_cta: 'Create my free account',
      signup_skip: 'Later',
      signup_signin: 'I already have an account'
    },
    es: {
      welcome_title: '¡Bienvenido!',
      welcome_sub: 'Elija su idioma para continuar',
      lang_continue: 'Continuar',
      signup_title: 'Aproveche más con una cuenta',
      signup_sub: 'Cree su cuenta gratuita Cœur de Ville para desbloquear ventajas.',
      signup_perk1_title: 'Programa de fidelidad',
      signup_perk1_desc: '+10 puntos por compra en los comercios asociados',
      signup_perk2_title: 'Recompensas exclusivas',
      signup_perk2_desc: 'Café gratis, descuentos, regalos para desbloquear',
      signup_perk3_title: 'Vida local personalizada',
      signup_perk3_desc: 'Favoritos, ideas ciudadanas, eventos preferidos',
      signup_cta: 'Crear mi cuenta gratuita',
      signup_skip: 'Más tarde',
      signup_signin: 'Ya tengo una cuenta'
    }
  };

  function t(key) {
    const lang = localStorage.getItem(LANG_KEY) || 'fr';
    return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS.fr[key] || key;
  }

  function getCurrentLang() {
    return localStorage.getItem(LANG_KEY) || 'fr';
  }

  function setLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
  }

  // ════════════════════════════════════════════════════
  // SÉLECTEUR DE LANGUE (1er lancement)
  // ════════════════════════════════════════════════════
  function showLangSelector() {
    const css = `
      <style id="cdv-onboarding-style">
        @keyframes cdvFadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes cdvSlideUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
        #cdv-lang-screen{position:fixed;inset:0;z-index:99998;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;animation:cdvFadeIn 0.3s ease;font-family:'Inter',-apple-system,sans-serif;}
        #cdv-lang-screen .cdv-lang-glow{position:absolute;top:-100px;left:50%;transform:translateX(-50%);width:600px;height:400px;background:radial-gradient(ellipse,rgba(255,107,53,0.10) 0%,transparent 70%);pointer-events:none;}
        #cdv-lang-screen .cdv-lang-content{position:relative;z-index:1;max-width:380px;width:100%;text-align:center;animation:cdvSlideUp 0.4s ease;}
        #cdv-lang-screen .cdv-lang-logo{margin-bottom:24px;}
        #cdv-lang-screen .cdv-lang-logo img{height:32px;width:auto;}
        #cdv-lang-screen h1{font-size:26px;font-weight:800;color:#0f1923;letter-spacing:-0.025em;margin-bottom:8px;}
        #cdv-lang-screen p{font-size:14px;color:#5a6068;margin-bottom:30px;}
        #cdv-lang-screen .cdv-lang-list{display:flex;flex-direction:column;gap:10px;margin-bottom:24px;}
        #cdv-lang-screen .cdv-lang-btn{display:flex;align-items:center;gap:14px;padding:16px 18px;background:#fff;border:1.5px solid #e5e8ec;border-radius:12px;font-family:Inter;font-size:15px;font-weight:600;color:#0f1923;cursor:pointer;transition:all 0.15s;text-align:left;}
        #cdv-lang-screen .cdv-lang-btn:hover{border-color:#0f1923;background:#f7f8fa;}
        #cdv-lang-screen .cdv-lang-btn.selected{border-color:#FF6B35;background:#fff7ed;}
        #cdv-lang-screen .cdv-lang-flag{font-size:24px;line-height:1;}
        #cdv-lang-screen .cdv-lang-info{flex:1;}
        #cdv-lang-screen .cdv-lang-name{font-weight:700;font-size:15px;color:#0f1923;}
        #cdv-lang-screen .cdv-lang-greet{font-size:12px;color:#5a6068;margin-top:1px;}
        #cdv-lang-screen .cdv-lang-check{width:22px;height:22px;border-radius:50%;border:2px solid #e5e8ec;display:flex;align-items:center;justify-content:center;color:transparent;flex-shrink:0;transition:all 0.15s;}
        #cdv-lang-screen .cdv-lang-btn.selected .cdv-lang-check{background:#FF6B35;border-color:#FF6B35;color:#fff;}
        #cdv-lang-screen .cdv-lang-check svg{width:13px;height:13px;}
        #cdv-lang-screen .cdv-lang-continue{width:100%;background:#0f1923;color:#fff;border:none;padding:14px;border-radius:11px;font-family:Inter;font-size:15px;font-weight:700;cursor:pointer;letter-spacing:-0.005em;transition:all 0.15s;}
        #cdv-lang-screen .cdv-lang-continue:hover{background:#1a2a3a;}
        #cdv-lang-screen .cdv-lang-continue:disabled{opacity:0.4;cursor:not-allowed;}
      </style>
    `;

    const checkSvg = '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const langButtons = Object.entries(LANG_NAMES).map(([code, info]) => `
      <button class="cdv-lang-btn" data-lang="${code}" onclick="window.CDV_OB.selectLang('${code}')">
        <div class="cdv-lang-flag">${info.flag}</div>
        <div class="cdv-lang-info">
          <div class="cdv-lang-name">${info.name}</div>
          <div class="cdv-lang-greet">${info.greeting}</div>
        </div>
        <div class="cdv-lang-check">${checkSvg}</div>
      </button>
    `).join('');

    const html = `
      ${css}
      <div id="cdv-lang-screen">
        <div class="cdv-lang-glow"></div>
        <div class="cdv-lang-content">
          <div class="cdv-lang-logo">
            <span style="font-size:32px;color:#FF6B35;line-height:1;">❤</span>
          </div>
          <h1>Bienvenue · Welcome · Bienvenido</h1>
          <p>Choisissez votre langue · Choose your language · Elija su idioma</p>
          <div class="cdv-lang-list">${langButtons}</div>
          <button class="cdv-lang-continue" id="cdv-lang-continue-btn" onclick="window.CDV_OB.confirmLang()" disabled>Continuer</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    document.body.style.overflow = 'hidden';
  }

  function selectLang(code) {
    document.querySelectorAll('#cdv-lang-screen .cdv-lang-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.lang === code);
    });
    const btn = document.getElementById('cdv-lang-continue-btn');
    if (btn) {
      btn.disabled = false;
      btn.textContent = TRANSLATIONS[code].lang_continue;
    }
    window.CDV_OB._pendingLang = code;
  }

  function confirmLang() {
    const lang = window.CDV_OB._pendingLang || 'fr';
    setLang(lang);
    localStorage.setItem(ONBOARD_KEY, '1');

    const screen = document.getElementById('cdv-lang-screen');
    const styleEl = document.getElementById('cdv-onboarding-style');
    if (screen) {
      screen.style.transition = 'opacity 0.3s';
      screen.style.opacity = '0';
      setTimeout(() => {
        screen.remove();
        if (styleEl) styleEl.remove();
        document.body.style.overflow = '';
        // Recharger la page pour appliquer les traductions partout
        if (window.CDV_OB.onLangChange) {
          window.CDV_OB.onLangChange(lang);
        }
      }, 300);
    }
  }

  // ════════════════════════════════════════════════════
  // POPUP INVITATION COMPTE (au 1er scroll)
  // ════════════════════════════════════════════════════
  async function showSignupPrompt() {
    // Vérifier si déjà connecté
    if (window.CDV && window.CDV.getUser) {
      const user = await window.CDV.getUser();
      if (user) return; // déjà connecté, rien à faire
    }

    if (localStorage.getItem(SIGNUP_PROMPT_KEY)) return; // déjà montré
    localStorage.setItem(SIGNUP_PROMPT_KEY, '1');

    const css = `
      <style id="cdv-signup-style">
        @keyframes cdvSlideUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
        @keyframes cdvFadeOverlay{from{opacity:0;}to{opacity:1;}}
        #cdv-signup-overlay{position:fixed;inset:0;z-index:99997;background:rgba(15,25,35,0.5);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;padding:0;animation:cdvFadeOverlay 0.25s ease;font-family:'Inter',-apple-system,sans-serif;}
        @media(min-width:600px){#cdv-signup-overlay{align-items:center;padding:20px;}}
        #cdv-signup-sheet{background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:24px 22px 28px;animation:cdvSlideUp 0.35s cubic-bezier(0.32,0.72,0,1);max-height:90vh;overflow-y:auto;}
        @media(min-width:600px){#cdv-signup-sheet{border-radius:20px;}}
        #cdv-signup-sheet .cdv-handle{width:40px;height:4px;background:#e5e8ec;border-radius:4px;margin:0 auto 18px;}
        #cdv-signup-sheet .cdv-icon-wrap{width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#FF6B35,#ea580c);margin:0 auto 18px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(255,107,53,0.25);}
        #cdv-signup-sheet .cdv-icon-wrap span{font-size:32px;color:#fff;}
        #cdv-signup-sheet h2{font-size:22px;font-weight:800;color:#0f1923;letter-spacing:-0.02em;text-align:center;margin-bottom:6px;}
        #cdv-signup-sheet .cdv-sub{font-size:14px;color:#5a6068;text-align:center;margin-bottom:22px;line-height:1.5;}
        #cdv-signup-sheet .cdv-perks{display:flex;flex-direction:column;gap:12px;margin-bottom:24px;}
        #cdv-signup-sheet .cdv-perk{display:flex;gap:13px;align-items:flex-start;}
        #cdv-signup-sheet .cdv-perk-icon{width:36px;height:36px;border-radius:10px;background:#fff7ed;color:#FF6B35;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        #cdv-signup-sheet .cdv-perk-icon span{font-size:18px;}
        #cdv-signup-sheet .cdv-perk-text{flex:1;}
        #cdv-signup-sheet .cdv-perk-title{font-size:14px;font-weight:700;color:#0f1923;margin-bottom:2px;letter-spacing:-0.005em;}
        #cdv-signup-sheet .cdv-perk-desc{font-size:12.5px;color:#5a6068;line-height:1.4;}
        #cdv-signup-sheet .cdv-cta{width:100%;background:#0f1923;color:#fff;border:none;padding:14px;border-radius:12px;font-family:Inter;font-size:15px;font-weight:700;cursor:pointer;letter-spacing:-0.005em;margin-bottom:8px;transition:all 0.15s;}
        #cdv-signup-sheet .cdv-cta:hover{background:#1a2a3a;}
        #cdv-signup-sheet .cdv-secondary{display:flex;justify-content:space-between;align-items:center;gap:10px;padding-top:6px;}
        #cdv-signup-sheet .cdv-link{background:none;border:none;color:#5a6068;font-family:Inter;font-size:13px;font-weight:600;cursor:pointer;padding:8px 12px;border-radius:8px;}
        #cdv-signup-sheet .cdv-link:hover{color:#0f1923;background:#f7f8fa;}
        #cdv-signup-sheet .cdv-link.primary{color:#0f1923;}
      </style>
    `;

    const html = `
      ${css}
      <div id="cdv-signup-overlay" onclick="if(event.target===this)window.CDV_OB.dismissSignup()">
        <div id="cdv-signup-sheet">
          <div class="cdv-handle"></div>
          <div class="cdv-icon-wrap"><span class="material-symbols-outlined">card_membership</span></div>
          <h2>${t('signup_title')}</h2>
          <p class="cdv-sub">${t('signup_sub')}</p>
          <div class="cdv-perks">
            <div class="cdv-perk">
              <div class="cdv-perk-icon"><span class="material-symbols-outlined">stars</span></div>
              <div class="cdv-perk-text">
                <div class="cdv-perk-title">${t('signup_perk1_title')}</div>
                <div class="cdv-perk-desc">${t('signup_perk1_desc')}</div>
              </div>
            </div>
            <div class="cdv-perk">
              <div class="cdv-perk-icon"><span class="material-symbols-outlined">card_giftcard</span></div>
              <div class="cdv-perk-text">
                <div class="cdv-perk-title">${t('signup_perk2_title')}</div>
                <div class="cdv-perk-desc">${t('signup_perk2_desc')}</div>
              </div>
            </div>
            <div class="cdv-perk">
              <div class="cdv-perk-icon"><span class="material-symbols-outlined">favorite</span></div>
              <div class="cdv-perk-text">
                <div class="cdv-perk-title">${t('signup_perk3_title')}</div>
                <div class="cdv-perk-desc">${t('signup_perk3_desc')}</div>
              </div>
            </div>
          </div>
          <button class="cdv-cta" onclick="window.CDV_OB.goSignup()">${t('signup_cta')}</button>
          <div class="cdv-secondary">
            <button class="cdv-link" onclick="window.CDV_OB.dismissSignup()">${t('signup_skip')}</button>
            <button class="cdv-link primary" onclick="window.CDV_OB.goSignin()">${t('signup_signin')}</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  function dismissSignup() {
    const overlay = document.getElementById('cdv-signup-overlay');
    const styleEl = document.getElementById('cdv-signup-style');
    if (overlay) {
      overlay.style.transition = 'opacity 0.25s';
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        if (styleEl) styleEl.remove();
      }, 250);
    }
    localStorage.setItem(SIGNUP_DISMISSED_KEY, '1');
  }

  function goSignup() {
    location.href = 'auth.html?redirect=' + encodeURIComponent(location.pathname.split('/').pop() || 'index.html') + '&mode=signup';
  }

  function goSignin() {
    location.href = 'auth.html?redirect=' + encodeURIComponent(location.pathname.split('/').pop() || 'index.html') + '&mode=signin';
  }

  // ════════════════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════════════════
  function init() {
    // 1. Sélecteur de langue au 1er lancement
    if (!localStorage.getItem(ONBOARD_KEY)) {
      showLangSelector();
      return; // attendre que l'utilisateur choisisse avant de mettre le scroll-listener
    }

    // 2. Popup invitation au 1er scroll (si pas déjà montré, et si pas connecté)
    if (!localStorage.getItem(SIGNUP_PROMPT_KEY)) {
      let triggered = false;
      const onScroll = () => {
        if (triggered) return;
        if (window.scrollY > 100) {
          triggered = true;
          window.removeEventListener('scroll', onScroll);
          // Petit délai pour laisser respirer après le scroll
          setTimeout(showSignupPrompt, 600);
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
    }
  }

  // Lance l'init après que le DOM soit prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ════════════════════════════════════════════════════
  // API PUBLIQUE
  // ════════════════════════════════════════════════════
  window.CDV_OB = {
    selectLang,
    confirmLang,
    dismissSignup,
    goSignup,
    goSignin,
    getCurrentLang,
    setLang,
    t,
    onLangChange: function(lang) {
      // Hook que les pages peuvent override pour réagir au changement de langue
      // Par défaut: recharger la page
      location.reload();
    },
    _pendingLang: null,
    // Pour debug : reset onboarding
    reset: function() {
      localStorage.removeItem(ONBOARD_KEY);
      localStorage.removeItem(LANG_KEY);
      localStorage.removeItem(SIGNUP_PROMPT_KEY);
      localStorage.removeItem(SIGNUP_DISMISSED_KEY);
      location.reload();
    }
  };

  // Helper global t() pour les pages
  window.t = t;
})();
