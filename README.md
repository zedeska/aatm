# AATM - Amazing Automatic Torrent Maker

## Description

AATM est une application de bureau puissante et moderne conçue pour automatiser le flux de travail des uploaders. Elle simplifie drastiquement le processus allant de l'analyse d'un fichier vidéo à sa publication sur le tracker **La-Cale**.

L'application combine une interface fluide (Svelte 5) avec la performance de Go pour gérer l'analyse de médias, la génération de métadonnées, la création de torrents et l'upload via API.

## 🚀 Fonctionnalités Principales

*   **Explorateur de Fichiers Intelligent**
    *   Navigation rapide dans vos disques.
    *   Suivi visuel des fichiers déjà traités (base de données locale).
    *   Filtrage (Afficher/Masquer les fichiers traités).
    *   Bouton "Re-process" pour relancer un upload.

*   **Analyse de Médias Avancée**
    *   Détection automatique via **MediaInfo** et expression régulières.
    *   Extraction précise : Résolution (4K/1080p...), Codecs (x264, HEVC...), Langues Audio & Sous-titres, Source (Web-DL, Bluray...), HDR, etc.
    *   Badge de langues automatiques (FR, EN, VOSTFR...).

*   **Intégration TMDB**
    *   Recherche automatique du média (Film ou Série).
    *   Récupération des posters et infos (Année, Titre original).

*   **Génération de Contenu**
    *   Création automatique de fichiers **.nfo** propres et complets.
    *   Génération de présentations HTML stylisées pour la description du tracker.
    *   Création de fichiers **.torrent** (support multi-trackers et flag "Privé").

*   **Double Upload Automatisé**
    *   **Vers La-Cale** : Upload direct via l'API interne (Session/Cookie) + Métadonnées via l'API externe.
    *   **Vers qBittorrent** : Injection immédiate du torrent dans votre client local pour le seed.
    *   **Sécurité** : Si l'upload vers La-Cale échoue, le torrent est automatiquement retiré de qBittorrent (Rollback) pour éviter les orphelins.

*   **Mode "Full Auto"** ⚡
    *   Une fois le type de média sélectionné, l'application choisit le premier résultat TMDB et exécute toutes les étapes (NFO, Torrent, Upload) sans intervention humaine.

## 🛠️ Prérequis pour le Développement

Si vous souhaitez modifier ou compiler l'application vous-même, voici les outils nécessaires :

### 1. Langages & Runtime
*   **Go (Golang)** : Version 1.21 ou supérieure. [Télécharger Go](https://go.dev/dl/)
*   **Node.js** : Version 18+ recommandée (avec npm). [Télécharger Node.js](https://nodejs.org/)

### 2. Outil de Build (Wails)
Installez la CLI Wails :
```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### 3. Dépendances Système (Windows)
Pour compiler sur Windows, vous avez besoin d'un compilateur C (GCC) pour le support CGO.
*   **Compilateur C** : Nous recommandons [TDM-GCC](https://jmeubank.github.io/tdm-gcc/). Lors de l'installation, choisissez "Create" et laissez les options par défaut.
*   **WebView2** : Normalement pré-installé sur Windows 10 et 11. Si ce n'est pas le cas, l'installeur "Evergreen Bootstrapper" est requis.
*   **MediaInfo CLI** : Indispensable pour l'analyse. L'outil `mediainfo` (CLI) doit être installé et accessible dans le **PATH** du système.

*(Note pour Linux : Sur Debian/Ubuntu, installez `libgtk-3-dev`, `libwebkit2gtk-4.0-dev` et `mediainfo`)*

## 📦 Installation et Compilation

### 1. Cloner le projet
```bash
git clone <votre-repo-aatm>
cd aatm
```

### 2. Installer les dépendances Frontend
Le dossier `frontend` contient l'interface Svelte.
```bash
cd frontend
npm install
cd ..
```

### 3. Lancer en mode Développement
Cette commande lance l'application et un serveur de développement (Vite) avec rechargement à chaud (Hot Reload).
```bash
wails dev
```

### 4. Compiler pour la Production
Pour créer un binaire exécutable optimisé (situé dans `build/bin/`) :
```bash
wails build
```

## ⚙️ Configuration

Une fois l'application lancée, cliquez sur **Settings** dans la barre latérale pour configurer vos accès. Ces réglages sont persistants (sauvegardés dans une base SQLite locale).

### La-Cale
*   **Passkey** : Votre clé API (trouvable dans votre profil La-Cale). Utilisée pour récupérer la liste des catégories et tags.
*   **Email & Password** : Vos identifiants de connexion. Utilisés pour obtenir une session d'upload authentifiée.

### Torrent / qBittorrent
*   **Torrent Trackers** : Liste des URLs d'annonce (une par ligne).
*   **Private Torrent** : Cochez cette case pour les trackers privés (désactive DHT/PEX).
*   **qBittorrent Configuration** : URL (ex: `http://localhost:8080`), utilisateur et mot de passe pour connecter AATM à votre client torrent.

### Automation
*   **Full Automatic Mode** : Activez cette option pour sauter les étapes de vérification et tout uploader d'un coup après la sélection du type.

## 📝 Utilisation

1.  **Browse** : Naviguez jusqu'au dossier contenant vos fichiers vidéos.
2.  **Select** : Cliquez sur le bouton violet **Process** à côté d'un fichier ou d'un dossier.
3.  **Type** : Choisissez le type de contenu :
    *   *Movie* : Pour un film (fichier unique ou dossier).
    *   *Single Episode* : Pour un épisode seul.
    *   *Season Pack* : Pour une saison complète (si vous avez sélectionné un dossier).
4.  **Review (si manuel)** :
    *   Vérifiez le résultat TMDB trouvé.
    *   Vérifiez le nom du torrent généré.
    *   Prévisualisez le NFO.
5.  **Complete** : Cliquez sur "Complete & Mark Done".

---

*Développé avec ❤️ utilisant [Wails](https://wails.io) et [Svelte](https://svelte.dev).*
