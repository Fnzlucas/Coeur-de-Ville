// Cœur de Ville — Push client
// Gère l'inscription/désinscription aux notifications push

window.CDV_PUSH = (function() {
  // ⚠️ À remplacer par ta vraie VAPID public key (déjà incluse ci-dessous)
  const VAPID_PUBLIC_KEY = 'BHWl7NjwRUx2zgrgGeGP2hx3nnedYwqWlaZYUpcBg0uAoSXFBsXom4No7YdfKrp_wDRqCS3RRAZsY4efQVTFsoY';
  const API_BASE = ''; // même domaine

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  function isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function permissionStatus() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission; // 'default', 'granted', 'denied'
  }

  async function registerSW() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      // Le SW est à la racine du sous-domaine villeneuve/
      return await navigator.serviceWorker.register('/villeneuve/sw.js', { scope: '/villeneuve/' });
    } catch (err) {
      console.error('[CDV Push] SW register failed:', err);
      return null;
    }
  }

  async function subscribe(userType = 'visitor') {
    if (!isSupported()) {
      throw new Error('Notifications non supportées par ce navigateur');
    }

    const reg = await registerSW();
    if (!reg) throw new Error('Service Worker indisponible');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permission refusée');
    }

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    // Envoie au backend
    const response = await fetch(API_BASE + '/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        ville: 'villeneuve',
        userType
      })
    });

    if (!response.ok) {
      throw new Error('Erreur d\'inscription serveur');
    }

    localStorage.setItem('cdv_push_subscribed', '1');
    localStorage.setItem('cdv_push_user_type', userType);
    return subscription;
  }

  async function unsubscribe() {
    const reg = await navigator.serviceWorker.getRegistration('/villeneuve/');
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
    }
    localStorage.removeItem('cdv_push_subscribed');
    return true;
  }

  function isSubscribed() {
    return localStorage.getItem('cdv_push_subscribed') === '1';
  }

  return {
    isSupported,
    permissionStatus,
    subscribe,
    unsubscribe,
    isSubscribed
  };
})();
