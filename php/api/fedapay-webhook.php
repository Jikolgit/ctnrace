<?php
// POST /api/fedapay-webhook : FedaPay prévient le serveur quand une transaction change d'état (transaction.approved,
// transaction.canceled…). Version PHP de api/fedapay-webhook.js. On ne croit pas le contenu reçu : on redemande
// l'état de la transaction à FedaPay avec la clé secrète, puis on crédite les Fric si elle est approuvée (une fois).
require __DIR__ . '/lib/server.php';

require_method('POST');
try {
    $event = request_body();
    $id = $event['entity']['id'] ?? $event['data']['object']['id'] ?? $event['object_id'] ?? null;
    if ($id === null || !preg_match('/^\d+$/', (string) $id)) send_json(200, ['ignored' => true]); // pas une transaction
    send_json(200, credit_if_approved((string) $id));
} catch (Throwable $error) {
    error_log('fedapay-webhook : ' . $error->getMessage());
    send_json(500, ['error' => error_message($error, 'Traitement impossible')]); // FedaPay réessaiera
}
