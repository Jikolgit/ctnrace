<?php
// POST /api/admin { user, password, settings? } : interface admin (/admin). Version PHP de api/admin.js.
// Sans settings : vérifie seulement les identifiants et renvoie les réglages actuels (connexion).
// Avec settings : les vérifie (clean_settings) et les enregistre dans Firestore (config/game) pour tous les joueurs.
//
// Identifiants : ADMIN_USER et ADMIN_PASSWORD (variables d'environnement ou ctnrace-config.php) s'ils existent,
// sinon ceux choisis par l'utilisateur (le mot de passe n'est gardé ici que sous forme d'empreinte SHA-256). Une
// erreur d'identifiants attend FAIL_DELAY avant de répondre, pour ralentir les essais en série.
require __DIR__ . '/lib/server.php';

const DEFAULT_USER = 'admin_1';
const DEFAULT_PASSWORD_SHA256 = '3d1e557b540ac045b3b327994a351f08a443f9216f9b2b8d3a0f42b58671ac83';
const FAIL_DELAY = 1; // s

function valid_credentials(string $user, string $password): bool
{
    $expectedUser = config_value('ADMIN_USER') ?? DEFAULT_USER;
    $expectedPassword = config_value('ADMIN_PASSWORD');
    $expectedHash = $expectedPassword !== null ? hash('sha256', $expectedPassword) : DEFAULT_PASSWORD_SHA256;
    // Toujours les deux comparaisons, à durée constante
    $userOk = hash_equals(hash('sha256', $expectedUser), hash('sha256', $user));
    $passwordOk = hash_equals($expectedHash, hash('sha256', $password));
    return $userOk && $passwordOk;
}

require_method('POST');
$body = request_body();
if (!valid_credentials((string) ($body['user'] ?? ''), (string) ($body['password'] ?? ''))) {
    sleep(FAIL_DELAY);
    send_json(401, ['error' => 'Identifiants incorrects']);
}
try {
    if (isset($body['settings'])) {
        $settings = clean_settings($body['settings']);
        firestore_set('config/game', $settings + ['updatedAt' => new DateTimeImmutable('now', new DateTimeZone('UTC'))]);
        send_json(200, ['saved' => true, 'settings' => $settings]);
    }
    send_json(200, ['settings' => clean_settings(firestore_get('config/game'))]);
} catch (Throwable $error) {
    error_log('admin : ' . $error->getMessage());
    send_json(500, ['error' => error_message($error, 'Enregistrement impossible')]);
}
