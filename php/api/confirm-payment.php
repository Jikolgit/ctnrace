<?php
// POST /api/confirm-payment { id } (jeton Firebase du joueur dans Authorization). Version PHP de
// api/confirm-payment.js : appelé par le jeu au retour de la page de paiement ; vérifie la transaction auprès de
// FedaPay et crédite les Fric si elle est approuvée (même travail que le webhook, au cas où il arrive après le joueur).
require __DIR__ . '/lib/server.php';

require_method('POST');
try {
    $uid = player_id();
    if (!$uid) send_json(401, ['error' => 'Joueur non connecté']);
    $id = (string) (request_body()['id'] ?? '');
    if (!preg_match('/^\d+$/', $id)) send_json(400, ['error' => 'Transaction inconnue']);
    $payment = firestore_get('payments/' . $id);
    if ($payment === null || ($payment['uid'] ?? null) !== $uid) send_json(404, ['error' => 'Transaction inconnue']);
    send_json(200, credit_if_approved($id));
} catch (Throwable $error) {
    error_log('confirm-payment : ' . $error->getMessage());
    send_json(500, ['error' => error_message($error, 'Vérification impossible')]);
}
