// Mode Livraison : missions numérotées. Terminer une mission débloque la suivante.
// La progression (dernière mission débloquée) est gardée dans le navigateur (localStorage) ; si le
// stockage est indisponible (navigation privée...), seule la mission 1 est ouverte.

export const MISSION_COUNT = 5;
const STORAGE_KEY = 'ctnRacer.unlockedMission';

// Numéro de la dernière mission débloquée (1 au minimum)
export function unlockedMission() {
  try {
    const value = parseInt(localStorage.getItem(STORAGE_KEY), 10);
    return Number.isInteger(value) ? Math.min(Math.max(value, 1), MISSION_COUNT) : 1;
  } catch {
    return 1;
  }
}

// À appeler quand la mission n est terminée : débloque la mission n + 1
export function completeMission(n) {
  if (n + 1 <= unlockedMission() || n >= MISSION_COUNT) return;
  try {
    localStorage.setItem(STORAGE_KEY, String(n + 1));
  } catch {
    // stockage indisponible : la progression n'est pas gardée
  }
}
