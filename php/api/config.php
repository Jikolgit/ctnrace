<?php
// GET /api/config : réglages du jeu choisis dans l'interface admin (document Firestore config/game), lus par le jeu
// au lancement (src/settings.js). Public, en lecture seule ; rien de secret dedans. Version PHP de api/config.js.
require __DIR__ . '/lib/server.php';

require_method('GET');
try {
    send_json(200, clean_settings(firestore_get('config/game')));
} catch (Throwable $error) {
    error_log('config : ' . $error->getMessage());
    send_json(500, ['error' => 'Réglages indisponibles']); // le jeu garde ses réglages par défaut
}
