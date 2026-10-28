<?php
// POST /api/create-payment { packId } (jeton Firebase du joueur dans Authorization). Version PHP de
// api/create-payment.js : crée le paiement FedaPay du pack choisi et renvoie { url } (page de paiement : Mobile
// Money, carte). Le prix vient des packs du serveur (shared.json, d'après src/fric.js) : le jeu ne choisit pas son prix.
require __DIR__ . '/lib/server.php';

require_method('POST');
try {
    $uid = player_id();
    if (!$uid) send_json(401, ['error' => 'Joueur non connecté']);
    $packId = request_body()['packId'] ?? null;
    $pack = null;
    foreach (shared_data()['fricPacks'] as $candidate) if ($candidate['id'] === $packId) $pack = $candidate;
    if (!$pack) send_json(400, ['error' => 'Pack inconnu']);

    // Après le paiement, FedaPay renvoie le joueur dans le jeu (il y ajoute ?id=…&status=…)
    $host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? '';
    $transaction = fedapay_transaction(fedapay_request('POST', '/transactions', [
        'description' => $pack['fric'] . ' Fric - ctnRacer',
        'amount' => $pack['price'],
        'currency' => ['iso' => 'XOF'],
        'callback_url' => "https://$host/?paiement=fedapay",
        'custom_metadata' => ['uid' => $uid, 'packId' => $pack['id']],
    ]));
    firestore_set('payments/' . $transaction['id'], [
        'uid' => $uid,
        'packId' => $pack['id'],
        'fric' => $pack['fric'],
        'price' => $pack['price'],
        'status' => (string) ($transaction['status'] ?? 'pending'),
        'credited' => false,
        'createdAt' => new DateTimeImmutable('now', new DateTimeZone('UTC')),
    ]);
    $token = fedapay_request('POST', '/transactions/' . rawurlencode((string) $transaction['id']) . '/token');
    send_json(200, ['url' => $token['url'] ?? null, 'id' => $transaction['id']]);
} catch (Throwable $error) {
    error_log('create-payment : ' . $error->getMessage());
    send_json(500, ['error' => error_message($error, 'Création du paiement impossible')]);
}
