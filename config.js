// ═══════════════════════════════════════════════════════════
// CONFIG.JS — À MODIFIER POUR CHAQUE NOUVELLE VILLE
// Seul ce fichier + data/pois.js changent d'une ville à l'autre
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  // Identité de la ville
  ville:      "Villeneuve-lès-Avignon",
  region:     "Gard · Occitanie",
  siecle:     "XIVe siècle",

  // Centre de la carte au démarrage
  lat:        43.9635,
  lng:        4.7960,
  zoom:       15,

  // Couleur principale de la ville (utilisée sur les filtres actifs, accents)
  couleurPrimaire: "#1a73e8",

  // Titre de l'app dans le navigateur
  titre: "Cœur de Ville — Villeneuve-lès-Avignon",

  // Bannière mode histoire AR
  epochBanner: "⚔️  Villeneuve · XIVe siècle",

  // Rayon max AR (en mètres)
  arRayonMax: 2000,

  // Rayon radar (en mètres)
  radarRayonMax: 1000,
};
