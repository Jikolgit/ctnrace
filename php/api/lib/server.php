<?php
// Outils communs des fonctions serveur PHP (version PHP des fonctions Vercel du dossier api/ : même comportement).
// Aucune bibliothèque externe : appels directs aux API de Google (Firebase : jetons, Firestore) et de FedaPay, avec
// les extensions curl et openssl de PHP (présentes sur presque tous les hébergements). Code compatible PHP 7.4 ou
// plus, mais n'utiliser qu'une version de PHP à jour (failles PHP2Shell d'octobre 2026 : voir docs/hebergement-php.md).
// Ce dossier (api/lib) est fermé aux visiteurs (.htaccess) : il ne contient que des fonctions.
//
// Réglages secrets (jamais dans le dépôt) : variables d'environnement de l'hébergeur si possible, sinon le fichier
// ctnrace-config.php (modèle : ctnrace-config.example.php), placé AU-DESSUS du dossier public du site (ex. à côté
// de public_html), ou à défaut dans ce dossier api/lib :
//   FIREBASE_SERVICE_ACCOUNT  clé de compte de service Firebase : son contenu JSON, ou le chemin du fichier .json
//   FEDAPAY_SECRET_KEY        clé secrète FedaPay (sk_sandbox_… pour les essais, sk_live_… pour les vrais paiements)
//   ADMIN_USER, ADMIN_PASSWORD  identifiants de l'interface admin (facultatifs : voir admin.php)

const SECURETOKEN_CERTS = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';

// Erreur de configuration : message affichable (aucune valeur secrète dedans)
class SetupError extends Exception
{
}

// Erreur d'une API extérieure (Google, FedaPay) : code HTTP et message
class ApiError extends Exception
{
}

// ---------------------------------------------------------------------------------------------------------------
// Configuration

function config_paths(): array
{
    return [dirname(__DIR__, 3) . '/ctnrace-config.php', __DIR__ . '/ctnrace-config.php'];
}

// Valeur d'un réglage : variable d'environnement, sinon fichier ctnrace-config.php ; null si absente
function config_value(string $name): ?string
{
    $env = getenv($name);
    if ($env !== false && $env !== '') return $env;
    static $file = null;
    if ($file === null) {
        $file = ['values' => [], 'dir' => null];
        foreach (config_paths() as $path) {
            if (is_file($path)) {
                $values = require $path;
                if (is_array($values)) $file = ['values' => $values, 'dir' => dirname($path)];
                break;
            }
        }
    }
    $value = $file['values'][$name] ?? null;
    if ($value === null || $value === '') return null;
    // Chemin relatif d'un fichier (clé Firebase) : par rapport au fichier de configuration
    if ($name === 'FIREBASE_SERVICE_ACCOUNT' && $file['dir'] && $value[0] !== '{' && $value[0] !== '/') {
        $value = $file['dir'] . '/' . $value;
    }
    return (string) $value;
}

// Données partagées avec le jeu (packs de Fric, réglages par défaut), écrites par tools/buildPhp.mjs à partir de
// src/fric.js et src/gameSettings.js : une seule source pour les prix et les réglages
function shared_data(): array
{
    static $data = null;
    if ($data === null) {
        $data = json_decode((string) @file_get_contents(__DIR__ . '/shared.json'), true);
        if (!is_array($data)) throw new SetupError('fichier api/lib/shared.json absent (refaire npm run build:php)');
    }
    return $data;
}

// Clé de compte de service Firebase : { project_id, client_email, private_key }
function service_account(): array
{
    static $account = null;
    if ($account !== null) return $account;
    $raw = trim((string) config_value('FIREBASE_SERVICE_ACCOUNT'));
    if ($raw === '') throw new SetupError('FIREBASE_SERVICE_ACCOUNT absent (ctnrace-config.php)');
    if ($raw[0] !== '{') {
        if (!is_file($raw)) throw new SetupError('fichier de la clé Firebase introuvable (FIREBASE_SERVICE_ACCOUNT)');
        $raw = trim((string) file_get_contents($raw));
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        // Clé privée collée avec de vrais retours à la ligne au lieu de « \n »
        $fixed = preg_replace_callback('/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----\s*/', function ($m) {
            return str_replace(["\r\n", "\n"], '\\n', $m[0]);
        }, $raw);
        $data = json_decode((string) $fixed, true);
    }
    if (!is_array($data)) throw new SetupError("FIREBASE_SERVICE_ACCOUNT n'est pas un JSON valide (copier tout le fichier, de { à })");
    if (empty($data['private_key']) || empty($data['client_email']) || empty($data['project_id'])) {
        throw new SetupError('FIREBASE_SERVICE_ACCOUNT incomplet (private_key, client_email ou project_id manquant)');
    }
    $data['private_key'] = str_replace('\\n', "\n", $data['private_key']);
    return $account = $data;
}

// Message à renvoyer pour une erreur : clair pour une erreur de configuration, générique sinon
function error_message(Throwable $error, string $fallback): string
{
    return $error instanceof SetupError ? 'Configuration : ' . $error->getMessage() : $fallback;
}

// ---------------------------------------------------------------------------------------------------------------
// Requêtes HTTP et réponses

// Requête HTTP ; body : tableau (envoyé en JSON) ou chaîne (envoyée telle quelle). Renvoie [code, réponse décodée]
function http_request(string $method, string $url, array $headers = [], $body = null): array
{
    // Tests hors ligne : réponses simulées (jamais défini sur le site)
    if (isset($GLOBALS['CTNRACE_HTTP_MOCK'])) return ($GLOBALS['CTNRACE_HTTP_MOCK'])($method, $url, $headers, $body);
    if (!function_exists('curl_init')) throw new SetupError("l'extension PHP curl n'est pas activée");
    $curl = curl_init($url);
    if (is_array($body)) {
        $body = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $headers[] = 'Content-Type: application/json';
    }
    curl_setopt_array($curl, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 20,
    ]);
    if ($body !== null) curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
    $text = curl_exec($curl);
    if ($text === false) {
        $message = curl_error($curl);
        curl_close($curl);
        throw new ApiError("réseau : $message");
    }
    $code = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);
    $data = json_decode($text, true);
    return [$code, is_array($data) ? $data : []];
}

// Réponse JSON, puis fin du script
function send_json(int $code, array $body): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Corps JSON de la demande (tableau vide s'il n'y en a pas)
function request_body(): array
{
    $data = json_decode((string) file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

function require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) send_json(405, ['error' => 'Méthode non permise']);
}

// ---------------------------------------------------------------------------------------------------------------
// Jetons (JWT RS256)

function base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string
{
    return (string) base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
}

// Fichier de cache dans le dossier temporaire du serveur : jetons d'accès, certificats de Google
function cache_get(string $name)
{
    $path = sys_get_temp_dir() . '/ctnrace-' . $name . '.json';
    $data = json_decode((string) @file_get_contents($path), true);
    return is_array($data) && ($data['expires'] ?? 0) > time() ? $data['value'] : null;
}

function cache_set(string $name, $value, int $seconds): void
{
    @file_put_contents(sys_get_temp_dir() . '/ctnrace-' . $name . '.json', json_encode(['value' => $value, 'expires' => time() + $seconds]));
}

// Jeton d'accès Google du compte de service (accès à Firestore), gardé ~50 min
function google_access_token(): string
{
    $account = service_account();
    $cacheName = 'token-' . md5($account['client_email']);
    $cached = cache_get($cacheName);
    if ($cached) return $cached;
    $now = time();
    $header = base64url_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $claims = base64url_encode(json_encode([
        'iss' => $account['client_email'],
        'scope' => FIRESTORE_SCOPE,
        'aud' => GOOGLE_TOKEN_URL,
        'iat' => $now,
        'exp' => $now + 3600,
    ]));
    $key = openssl_pkey_get_private($account['private_key']);
    if (!$key) throw new SetupError('clé privée Firebase illisible (private_key)');
    if (!openssl_sign("$header.$claims", $signature, $key, OPENSSL_ALGO_SHA256)) {
        throw new SetupError('signature impossible avec la clé privée Firebase');
    }
    $assertion = "$header.$claims." . base64url_encode($signature);
    [$code, $data] = http_request('POST', GOOGLE_TOKEN_URL, ['Content-Type: application/x-www-form-urlencoded'], http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $assertion,
    ]));
    if ($code !== 200 || empty($data['access_token'])) {
        throw new SetupError('Google refuse la clé de compte de service (' . ($data['error_description'] ?? $data['error'] ?? "erreur $code") . ')');
    }
    cache_set($cacheName, $data['access_token'], 3000);
    return $data['access_token'];
}

// Joueur qui appelle : jeton Firebase envoyé par le jeu (en-tête Authorization: Bearer …) vérifié avec les
// certificats publics de Google ; renvoie son uid, ou null
function player_id(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($header === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) if (strtolower($name) === 'authorization') $header = $value;
    }
    if (!preg_match('/^Bearer (.+)$/', $header, $match)) return null;
    return verify_id_token($match[1], service_account()['project_id']);
}

// Jeton d'identité Firebase valide pour ce projet : uid du joueur, sinon null. certs : certificats (tests)
function verify_id_token(string $token, string $project, ?array $certs = null): ?string
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    $header = json_decode(base64url_decode($parts[0]), true);
    $claims = json_decode(base64url_decode($parts[1]), true);
    if (!is_array($header) || !is_array($claims) || ($header['alg'] ?? '') !== 'RS256') return null;
    $certs = $certs ?? google_certificates();
    $cert = $certs[$header['kid'] ?? ''] ?? null;
    if (!$cert) return null;
    $key = openssl_pkey_get_public($cert);
    if (!$key || openssl_verify("$parts[0].$parts[1]", base64url_decode($parts[2]), $key, OPENSSL_ALGO_SHA256) !== 1) return null;
    $now = time();
    $valid = ($claims['aud'] ?? '') === $project
        && ($claims['iss'] ?? '') === "https://securetoken.google.com/$project"
        && ($claims['exp'] ?? 0) > $now
        && ($claims['iat'] ?? $now + 1) <= $now + 300
        && is_string($claims['sub'] ?? null) && $claims['sub'] !== '';
    return $valid ? $claims['sub'] : null;
}

// Certificats publics de Google pour les jetons Firebase (gardés 1 h)
function google_certificates(): array
{
    $cached = cache_get('certs');
    if ($cached) return $cached;
    [$code, $data] = http_request('GET', SECURETOKEN_CERTS);
    if ($code !== 200 || !$data) throw new ApiError("certificats de Google indisponibles ($code)");
    cache_set('certs', $data, 3600);
    return $data;
}

// ---------------------------------------------------------------------------------------------------------------
// Firestore (API REST) : documents lus et écrits en tableaux PHP ordinaires

function firestore_root(): string
{
    return 'projects/' . service_account()['project_id'] . '/databases/(default)/documents';
}

function firestore_url(string $path = ''): string
{
    return 'https://firestore.googleapis.com/v1/' . firestore_root() . ($path === '' ? '' : '/' . $path);
}

function firestore_request(string $method, string $url, $body = null): array
{
    [$code, $data] = http_request($method, $url, ['Authorization: Bearer ' . google_access_token()], $body);
    if ($code === 404) return [404, []];
    if ($code < 200 || $code >= 300) throw new ApiError('Firestore : ' . ($data['error']['message'] ?? "erreur $code"));
    return [$code, $data];
}

// Valeur PHP → valeur Firestore
function firestore_value($value)
{
    if ($value === null) return ['nullValue' => null];
    if (is_bool($value)) return ['booleanValue' => $value];
    if (is_int($value)) return ['integerValue' => (string) $value];
    if (is_float($value)) return ['doubleValue' => $value];
    if (is_string($value)) return ['stringValue' => $value];
    if ($value instanceof DateTimeInterface) return ['timestampValue' => $value->format('Y-m-d\TH:i:s.v\Z')];
    if (is_array($value)) {
        if ($value === [] || array_keys($value) === range(0, count($value) - 1)) {
            return ['arrayValue' => ['values' => array_map('firestore_value', $value)]];
        }
        return ['mapValue' => ['fields' => firestore_fields($value)]];
    }
    return ['stringValue' => (string) $value];
}

function firestore_fields(array $data)
{
    $fields = [];
    foreach ($data as $key => $value) $fields[$key] = firestore_value($value);
    return $fields ?: new stdClass(); // {} en JSON (et non [])
}

// Valeur Firestore → valeur PHP
function php_value(array $value)
{
    if (array_key_exists('nullValue', $value)) return null;
    if (isset($value['booleanValue'])) return (bool) $value['booleanValue'];
    if (isset($value['integerValue'])) return (int) $value['integerValue'];
    if (isset($value['doubleValue'])) return (float) $value['doubleValue'];
    if (isset($value['stringValue'])) return $value['stringValue'];
    if (isset($value['timestampValue'])) return $value['timestampValue'];
    if (isset($value['arrayValue'])) return array_map('php_value', $value['arrayValue']['values'] ?? []);
    if (isset($value['mapValue'])) return php_fields($value['mapValue']['fields'] ?? []);
    return null;
}

function php_fields(array $fields): array
{
    $data = [];
    foreach ($fields as $key => $value) $data[$key] = php_value($value);
    return $data;
}

// Document (ex. 'config/game') : tableau de ses champs, ou null s'il n'existe pas
function firestore_get(string $path, ?string $transaction = null): ?array
{
    $url = firestore_url($path) . ($transaction ? '?transaction=' . rawurlencode($transaction) : '');
    [$code, $data] = firestore_request('GET', $url);
    return $code === 404 ? null : php_fields($data['fields'] ?? []);
}

// Remplace tout le document
function firestore_set(string $path, array $data): void
{
    firestore_request('PATCH', firestore_url($path), ['fields' => firestore_fields($data)]);
}

// Change seulement les champs donnés (crée le document s'il n'existe pas)
function firestore_merge(string $path, array $data): void
{
    $mask = implode('&', array_map(function ($key) {
        return 'updateMask.fieldPaths=' . rawurlencode($key);
    }, array_keys($data)));
    firestore_request('PATCH', firestore_url($path) . '?' . $mask, ['fields' => firestore_fields($data)]);
}

// ---------------------------------------------------------------------------------------------------------------
// Réglages du jeu (interface admin) : même vérification que cleanSettings (src/gameSettings.js)

function clean_settings($input): array
{
    $shared = shared_data();
    $clean = $shared['defaults'];
    if (!is_array($input)) return $clean;
    $isInt = function ($value, $min, $max) {
        return is_int($value) && $value >= $min && $value <= $max;
    };
    foreach ($shared['settings'] as $setting) {
        $key = $setting['key'];
        if (!array_key_exists($key, $input)) continue;
        $value = $input[$key];
        if ($setting['type'] === 'boolean' && is_bool($value)) $clean[$key] = $value;
        if ($setting['type'] === 'hour') {
            if ($value === null) $clean[$key] = null;
            elseif ((is_int($value) || is_float($value)) && $value >= 0 && $value < 24) $clean[$key] = round($value * 60) / 60;
        }
        if ($setting['type'] === 'missions') {
            $missions = [];
            foreach ($shared['defaults'][$key] as $i => $defaults) {
                $mission = is_array($value) && isset($value[$i]) && is_array($value[$i]) ? $value[$i] : [];
                $missions[] = [
                    'enabled' => is_bool($mission['enabled'] ?? null) ? $mission['enabled'] : $defaults['enabled'],
                    'deliveries' => $isInt($mission['deliveries'] ?? null, 1, $shared['maxDeliveries']) ? $mission['deliveries'] : $defaults['deliveries'],
                    'reward' => $isInt($mission['reward'] ?? null, 0, $shared['maxReward']) ? $mission['reward'] : $defaults['reward'],
                    'fuelPrice' => $isInt($mission['fuelPrice'] ?? null, 0, $shared['maxReward']) ? $mission['fuelPrice'] : $defaults['fuelPrice'],
                    'loaded' => is_bool($mission['loaded'] ?? null) ? $mission['loaded'] : $defaults['loaded'],
                ];
            }
            $clean[$key] = $missions;
        }
    }
    return $clean;
}

// ---------------------------------------------------------------------------------------------------------------
// FedaPay (API REST, comme le SDK officiel : même adresse, même en-tête Authorization)

function fedapay_key(): string
{
    $key = trim((string) config_value('FEDAPAY_SECRET_KEY'));
    if (!preg_match('/^sk_(sandbox|live)_/', $key)) {
        throw new SetupError('FEDAPAY_SECRET_KEY absente ou invalide (doit commencer par sk_sandbox_ ou sk_live_)');
    }
    return $key;
}

function fedapay_request(string $method, string $path, ?array $body = null): array
{
    $key = fedapay_key();
    $base = strpos($key, 'sk_live_') === 0 ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';
    [$code, $data] = http_request($method, $base . $path, ['Authorization: Bearer ' . $key, 'X-Source: ctnRacer PHP'], $body);
    if ($code < 200 || $code >= 300) throw new ApiError('FedaPay : ' . ($data['message'] ?? "erreur $code"));
    return $data;
}

// Transaction dans une réponse de FedaPay (clé « v1/transaction »)
function fedapay_transaction(array $data): array
{
    $transaction = $data['v1/transaction'] ?? $data['transaction'] ?? null;
    if (!is_array($transaction) || !isset($transaction['id'])) throw new ApiError('FedaPay : réponse inattendue');
    return $transaction;
}

// Paiement approuvé chez FedaPay → Fric ajoutés au joueur, une seule fois par transaction (fiche payments/{id},
// créée par create-payment avec le joueur et le pack). On ne croit pas ce qu'envoie le navigateur ou le webhook :
// l'état est redemandé à FedaPay. Écriture dans une transaction Firestore (jamais deux crédits).
function credit_if_approved(string $transactionId): array
{
    $paymentPath = 'payments/' . $transactionId;
    if (firestore_get($paymentPath) === null) return ['status' => 'unknown', 'credited' => false]; // pas créée par le jeu
    $transaction = fedapay_transaction(fedapay_request('GET', '/transactions/' . rawurlencode($transactionId)));
    $status = (string) ($transaction['status'] ?? 'unknown');
    if ($status !== 'approved') {
        firestore_merge($paymentPath, ['status' => $status, 'updatedAt' => new DateTimeImmutable('now', new DateTimeZone('UTC'))]);
        return ['status' => $status, 'credited' => false];
    }
    [, $begin] = firestore_request('POST', firestore_url() . ':beginTransaction', ['options' => ['readWrite' => new stdClass()]]);
    $tx = $begin['transaction'] ?? null;
    if (!$tx) throw new ApiError('Firestore : transaction impossible');
    $payment = firestore_get($paymentPath, $tx);
    $commit = function (array $writes) use ($tx) {
        firestore_request('POST', firestore_url() . ':commit', ['writes' => $writes, 'transaction' => $tx]);
    };
    if (!empty($payment['credited'])) {
        $commit([]);
        return ['status' => $status, 'credited' => true, 'fric' => $payment['fric']]; // déjà créditée
    }
    if ((int) ($transaction['amount'] ?? -1) !== (int) ($payment['price'] ?? -2)) {
        $commit([]);
        return ['status' => $status, 'credited' => false]; // montant inattendu : rien
    }
    $now = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
    $root = firestore_root();
    $commit([
        [
            // fric du joueur augmenté (document créé s'il n'existe pas)
            'update' => ['name' => "$root/players/" . $payment['uid'], 'fields' => new stdClass()],
            'updateMask' => ['fieldPaths' => []],
            'updateTransforms' => [['fieldPath' => 'fric', 'increment' => ['integerValue' => (string) (int) $payment['fric']]]],
        ],
        [
            'update' => ['name' => "$root/$paymentPath", 'fields' => firestore_fields(['status' => $status, 'credited' => true])],
            'updateMask' => ['fieldPaths' => ['status', 'credited']],
            'updateTransforms' => [['fieldPath' => 'creditedAt', 'setToServerValue' => 'REQUEST_TIME']],
        ],
    ]);
    return ['status' => $status, 'credited' => true, 'fric' => $payment['fric']];
}
