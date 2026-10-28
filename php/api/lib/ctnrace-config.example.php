<?php
// Modèle du fichier de configuration secret des fonctions PHP (ne jamais le mettre sur GitHub une fois rempli).
// 1. Copier ce fichier sous le nom ctnrace-config.php
// 2. Le placer AU-DESSUS du dossier public du site (par exemple à côté de public_html : /home/compte/ctnrace-config.php),
//    ou à défaut dans le dossier api/lib du site (fermé aux visiteurs)
// 3. Remplir les valeurs. Les variables d'environnement de l'hébergeur, si elles existent, passent avant ce fichier.
return [
    // Clé de compte de service Firebase : chemin du fichier .json téléchargé depuis Firebase (relatif à ce fichier),
    // ou son contenu entier (de { à })
    'FIREBASE_SERVICE_ACCOUNT' => 'firebase-service-account.json',
    // Clé secrète FedaPay : sk_sandbox_… pour les essais, sk_live_… pour les vrais paiements
    'FEDAPAY_SECRET_KEY' => 'sk_sandbox_...',
    // Identifiants de l'interface admin (facultatif : sans eux, ceux par défaut)
    // 'ADMIN_USER' => 'admin_1',
    // 'ADMIN_PASSWORD' => 'un mot de passe long',
];
