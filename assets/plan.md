# 🤖 Workshop — Étendre Claude Code : Skills, Hooks, Subagents & MCP

> **Durée totale : 2 heures**
> **Niveau : Intermédiaire**
> **Prérequis : Claude Code installé, notions de base en terminal**

---

## 📋 Table des matières

1. [Introduction](#introduction) — 15 min
2. [Partie 1 — Hooks](#partie-1--hooks) — 35 min
3. [Partie 2 — Skills](#partie-2--skills) — 25 min
4. [Partie 3 — Subagents](#partie-3--subagents) — 30 min
5. [Partie 4 — Rappel MCP](#partie-4--rappel-mcp) — 5 min
6. [Conclusion & Ouverture](#conclusion--ouverture) — 10 min

---

## Introduction

**⏱ Durée : 15 minutes**

### Présentation des speakers

> *(Remplacer par vos informations)*

- **Nom** — Titre / Rôle
- **Entreprise** — Ce qu'on fait, notre stack, pourquoi on utilise Claude Code

### Pourquoi ce workshop ?

Claude Code est bien plus qu'un assistant de code. C'est un **agent extensible** que vous pouvez configurer précisément pour votre workflow. Ce workshop vous donne les clés pour en faire un vrai membre de votre équipe.

Aujourd'hui on va couvrir **4 mécanismes d'extension** :

| Mécanisme | Ce que ça fait | Quand l'utiliser |
|---|---|---|
| **Hooks** | Actions automatiques à des points précis du cycle de vie | Règles déterministes, formatage, sécurité |
| **Skills** | Instructions réutilisables packagées en dossiers | Expertise métier, workflows répétables |
| **Subagents** | Agents spécialisés avec leur propre contexte | Délégation, parallélisation, isolation |
| **MCP** | Connexion à des outils et APIs externes | Intégrations (GitHub, Notion, DB…) |

### Installation de l'environnement

Avant de commencer, vérifiez que vous avez :

```bash
# 1. Claude Code installé et à jour
claude --version   # Doit afficher v1.x+

# 2. Node.js 22+ (requis pour MCP)
node --version     # Doit afficher v22.x+

# 3. jq installé (utile pour les hooks)
jq --version

# 4. Un projet de test
mkdir workshop-claude-code && cd workshop-claude-code
git init
```

---

## Partie 1 — Hooks

**⏱ Durée : 35 minutes** *(partie majeure)*

> 📚 **Source Anthropic** : [Claude Code in Action](https://anthropic.skilljar.com/claude-code-in-action)

---

### 🎓 Théorie (15 min)

#### Qu'est-ce qu'un hook ?

Les hooks sont des **commandes shell définies par l'utilisateur** qui s'exécutent à des points précis du cycle de vie de Claude Code. Contrairement à une instruction dans le prompt, un hook s'exécute **toujours**, quoi que décide le modèle.

> 💡 **Analogie** : pensez aux hooks Git (`pre-commit`, `post-push`) — sauf qu'ici, c'est pour votre agent IA.

#### La différence fondamentale

```
Prompt / Instructions  →  Claude PEUT décider de le faire
Hook                   →  Claude VA le faire, systématiquement
```

C'est ce qui rend les hooks indispensables pour la **gouvernance**, la **sécurité** et l'**automatisation fiable**.

#### Les événements du cycle de vie

Claude Code expose des **événements de lifecycle** auxquels vous pouvez attacher vos hooks :

| Événement | Quand il se déclenche | Peut bloquer ? |
|---|---|---|
| `SessionStart` | Démarrage / reprise de session | ❌ |
| `UserPromptSubmit` | Avant que le prompt atteigne Claude | ✅ |
| `PreToolUse` | Avant l'exécution d'un outil (Bash, Write…) | ✅ |
| `PostToolUse` | Après l'exécution d'un outil | ❌ (peut donner du feedback) |
| `Notification` | Quand Claude envoie une notification | ❌ |
| `Stop` | Quand Claude a fini de répondre | ✅ (peut forcer à continuer) |
| `SubagentStop` | Quand un subagent se termine | ✅ |
| `PreCompact` | Avant la compaction du contexte | ❌ |

#### Les 4 types de handlers

```
command  → Script shell (le plus courant, ~90% des cas)
http     → Requête HTTP POST vers un endpoint
prompt   → Évaluation par un modèle Claude (Haiku par défaut)
agent    → Spawn d'un subagent avec accès aux outils
```

**Trade-off** : `command` s'exécute en millisecondes, un `agent` peut prendre 30-60 secondes.

#### Le mécanisme d'exit code

Vos hooks communiquent avec Claude via des codes de sortie :

```bash
exit 0   # Action autorisée, continuer normalement
exit 1   # Erreur non-bloquante (stderr → feedback pour Claude)
exit 2   # BLOQUER l'action (PreToolUse) ou FORCER à continuer (Stop)
```

Tout ce que vous écrivez sur `stderr` est transmis à Claude comme feedback.

#### Structure de configuration

Les hooks vivent dans les fichiers de settings JSON, à plusieurs niveaux :

```
~/.claude/settings.json          → Niveau utilisateur (tous les projets)
.claude/settings.json            → Niveau projet (versionnable en git)
.claude/settings.local.json      → Overrides locaux (non commité)
```

Structure de base :

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "votre-commande-ici"
          }
        ]
      }
    ]
  }
}
```

Le champ `matcher` est une **expression régulière** qui filtre sur le nom de l'outil.

---

### 🛠 Pratique (20 min)

#### Exercice 1 — Hook de formatage automatique (5 min)

Objectif : formater automatiquement les fichiers JavaScript/TypeScript après chaque modification.

**Étape 1** : Créez ou éditez `.claude/settings.json` dans votre projet :

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "FILE=$(echo \"$CLAUDE_TOOL_INPUT\" | jq -r '.file_path // .path // empty'); if echo \"$FILE\" | grep -qE '\\.(js|ts|jsx|tsx)$'; then npx prettier --write \"$FILE\" 2>/dev/null; fi"
          }
        ]
      }
    ]
  }
}
```

**Test** : Demandez à Claude de créer un fichier JS mal formaté, puis vérifiez qu'il est automatiquement nettoyé.

```
> Crée un fichier test.js avec une fonction qui fait plusieurs choses sur une seule ligne
```

---

#### Exercice 2 — Hook de sécurité (7 min)

Objectif : bloquer les commandes dangereuses avant qu'elles ne s'exécutent.

**Étape 1** : Créez le script `~/.claude/hooks/security-check.sh` :

```bash
#!/bin/bash

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Patterns dangereux
BLOCKED_PATTERNS=(
  "rm -rf /"
  "drop table"
  "DROP TABLE"
  "DELETE FROM.*WHERE.*1=1"
  "chmod 777"
  "> /dev/sda"
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qi "$pattern"; then
    echo "🚫 BLOQUÉ : commande potentiellement dangereuse détectée : '$pattern'" >&2
    exit 2
  fi
done

exit 0
```

```bash
chmod +x ~/.claude/hooks/security-check.sh
```

**Étape 2** : Ajoutez le hook dans `~/.claude/settings.json` :

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/security-check.sh"
          }
        ]
      }
    ]
  }
}
```

**Test** : Demandez à Claude d'exécuter une commande contenant `rm -rf /tmp/../` ou similaire.

---

#### Exercice 3 — Hook de notification desktop (5 min)

Objectif : recevoir une notification quand Claude a fini une tâche longue.

**macOS** :

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude a terminé sa tâche !\" with title \"Claude Code\"'"
          }
        ]
      }
    ]
  }
}
```

**Linux (avec notify-send)** :

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "notify-send 'Claude Code' 'Tâche terminée !' --icon=dialog-information"
          }
        ]
      }
    ]
  }
}
```

---

#### Exercice 4 — Hook d'injection de contexte au démarrage (3 min)

Objectif : injecter automatiquement du contexte au début de chaque session.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"=== Contexte projet ===\"; echo \"Branche git : $(git branch --show-current 2>/dev/null || echo 'non-git')\"; echo \"Derniers commits :\"; git log --oneline -5 2>/dev/null || echo 'N/A'; echo \"Variables d'env chargées : $(env | grep -c APP_ 2>/dev/null || echo 0)\""
          }
        ]
      }
    ]
  }
}
```

#### Pour aller plus loin

- Utilisez `/hooks` dans Claude Code pour inspecter vos hooks configurés
- Combinez `matcher` et `if` pour des filtres ultra-précis (depuis Claude Code v2.1.85+)
- Les hooks `async` (non-bloquants) sont disponibles pour les logs et notifications qui ne doivent pas ralentir Claude

---

## Partie 2 — Skills

**⏱ Durée : 25 minutes**

> 📚 **Source Anthropic** : [Introduction to Agent Skills](https://anthropic.skilljar.com/introduction-to-agent-skills)
> 🔗 **Repo officiel** : [github.com/anthropics/skills](https://github.com/anthropics/skills)

---

### 🎓 Théorie (10 min)

#### Qu'est-ce qu'une Skill ?

Une Skill est un **dossier d'instructions, de scripts et de ressources** que Claude charge dynamiquement pour améliorer ses performances sur des tâches spécifiques.

> 💡 **Analogie** : comme un guide d'onboarding pour un nouvel employé. Pas besoin de lui expliquer le contexte à chaque fois — il lit le guide et sait quoi faire.

#### Le principe de divulgation progressive (Progressive Disclosure)

C'est le cœur du design des Skills. Claude ne charge que ce dont il a besoin, quand il en a besoin :

```
Niveau 1 : name + description (toujours en mémoire)
    ↓ si pertinent
Niveau 2 : contenu du SKILL.md
    ↓ si nécessaire
Niveau 3 : fichiers de référence, scripts, assets
```

Cela signifie que la quantité de contexte bundlée dans une skill est **effectivement illimitée** — Claude n'en charge que la partie utile.

#### Structure d'une Skill

```
ma-skill/
├── SKILL.md           ← Requis : instructions + métadonnées YAML
├── references/        ← Optionnel : docs détaillées
│   └── api.md
├── scripts/           ← Optionnel : scripts exécutables
│   └── validate.sh
├── assets/            ← Optionnel : ressources
│   └── template.html
└── evals/             ← Recommandé : tests de validation
    └── evals.json
```

#### Le fichier SKILL.md

```markdown
---
name: nom-de-la-skill
description: Ce que fait la skill et QUAND l'utiliser (crucial !)
---

# Nom de la Skill

## Ce que tu dois faire

Instructions détaillées ici...

## Gotchas (erreurs courantes)

- Ne jamais faire X car...
- Toujours vérifier Y avant...
```

> ⚠️ Le champ `description` est **crucial** : c'est ce que Claude lit pour décider d'utiliser la skill. Soyez précis sur les déclencheurs.

#### Où placer vos Skills ?

```
.claude/skills/          → Niveau projet (partagé avec l'équipe via git)
~/.claude/skills/        → Niveau utilisateur (disponible partout)
```

#### Skills pré-construites par Anthropic

Anthropic fournit des skills open-source pour les tâches courantes. Vous pouvez les installer via le plugin marketplace :

```bash
# Dans Claude Code
/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills
```

Skills disponibles : PowerPoint, Excel, Word, PDF, frontend-design, et bien d'autres.

---

### 🛠 Pratique (15 min)

#### Exercice 1 — Créer votre première Skill (8 min)

Objectif : créer une skill de "Code Review" qui enforce vos standards d'équipe.

**Étape 1** : Créez la structure :

```bash
mkdir -p .claude/skills/code-review
touch .claude/skills/code-review/SKILL.md
```

**Étape 2** : Éditez `SKILL.md` :

```markdown
---
name: code-review
description: Effectue une revue de code approfondie selon nos standards d'équipe. Utiliser après avoir écrit ou modifié du code, ou quand l'utilisateur demande une "revue", "review" ou "vérification du code".
---

# Code Review — Standards Équipe

## Checklist obligatoire

Lors de chaque revue, vérifie systématiquement :

### 🔒 Sécurité
- Pas de secrets ou tokens en dur dans le code
- Inputs utilisateur validés et sanitizés
- Pas de SQL dynamique non paramétré
- Dépendances à jour (vérifie avec les CVE connues)

### 📖 Lisibilité
- Fonctions de moins de 30 lignes
- Noms de variables explicites (pas de `x`, `tmp`, `data`)
- Commentaires sur le "pourquoi", pas le "quoi"

### ⚡ Performance
- Pas de N+1 queries en évidence
- Opérations coûteuses mises en cache si pertinent

### 🧪 Tests
- Cas nominaux couverts
- Cas limites identifiés

## Format de sortie

Organise ton feedback ainsi :
1. **Résumé** (1-2 phrases)
2. **🔴 Bloquants** (doivent être corrigés)
3. **🟡 Améliorations** (recommandées)
4. **🟢 Points positifs** (toujours en mentionner au moins un)
```

**Test** :

```
> Peux-tu faire une revue du fichier src/auth.js ?
```

---

#### Exercice 2 — Skill avec fichiers de référence (7 min)

Objectif : créer une skill "commit-message" qui génère des commits conventionnels parfaits.

```bash
mkdir -p .claude/skills/commit-message/references
```

`SKILL.md` :

```markdown
---
name: commit-message
description: Génère des messages de commit selon la convention Conventional Commits. Utiliser quand l'utilisateur veut commiter, faire un commit, ou demande un "git commit".
---

# Générateur de Commit Conventionnel

Génère un message de commit selon le standard Conventional Commits.
Consulte references/conventional-commits.md pour les règles complètes.

## Processus

1. Analyse les changements avec `git diff --staged`
2. Identifie le type de changement (feat, fix, chore, etc.)
3. Rédige le message selon le format

## Format obligatoire

```
<type>(<scope>): <description courte en impératif>

[corps optionnel si changement complexe]

[footer: BREAKING CHANGE: ou Fixes #xxx]
```

## Règles absolues

- Description en minuscules
- Pas de point final
- Maximum 72 caractères pour la première ligne
- En français ou anglais selon la langue du projet
```

`references/conventional-commits.md` :

```markdown
# Conventional Commits — Référence Complète

## Types

| Type | Quand l'utiliser |
|------|-----------------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation uniquement |
| `style` | Formatage (pas de logique) |
| `refactor` | Refactoring sans bug fix ni feature |
| `test` | Ajout/modification de tests |
| `chore` | Maintenance, dépendances, CI |
| `perf` | Amélioration de performance |
| `ci` | Changements CI/CD |

## Exemples concrets

```
feat(auth): add OAuth2 login with Google
fix(cart): prevent negative quantity on item removal
docs(api): update endpoint documentation for v2
chore(deps): update jest to v29.7.0
refactor(user): extract email validation to utility function
```

## Breaking Changes

Ajouter `!` après le type ou un footer `BREAKING CHANGE:` :
```
feat!: redesign authentication API
feat(auth)!: remove legacy token format
```
```

**Test** :

```
> Je viens de modifier l'auth, génère le message de commit
```

---

## Partie 3 — Subagents

**⏱ Durée : 30 minutes** *(partie majeure)*

> 📚 **Source Anthropic** : [Introduction to Subagents](https://anthropic.skilljar.com/introduction-to-subagents)

---

### 🎓 Théorie (13 min)

#### Qu'est-ce qu'un Subagent ?

Un subagent est un **agent Claude séparé** que votre agent principal peut spawner pour déléguer une tâche. Il a :

- Son **propre contexte** (window séparée)
- Ses **propres permissions** d'outils
- Son **propre modèle** (éventuellement différent)
- Son **propre prompt système**

Quand le subagent termine, il renvoie un **résumé** au parent — pas tout son contexte interne.

#### Pourquoi les utiliser ?

```
Problème 1 : Pollution du contexte
→ Solution : Le subagent explore 50 fichiers, le parent reçoit un résumé propre

Problème 2 : Tâches parallèles
→ Solution : 3 subagents travaillent en simultané

Problème 3 : Permissions différenciées
→ Solution : subagent lecture seule pour explorer, subagent écriture pour implémenter

Problème 4 : Coûts
→ Solution : routez les tâches simples vers Haiku, gardez Sonnet/Opus pour le cœur
```

#### Subagents built-in vs custom

**Built-in** (fournis par Anthropic, automatiquement invoqués) :

| Nom | Rôle |
|-----|------|
| `Explore` | Exploration read-only rapide (tourne sur Haiku) |
| `Plan` | Recherche avant planification |
| `General-purpose` | Tâches multi-étapes complexes |
| `Claude Code Guide` | Aide sur Claude Code lui-même |

**Custom** (que vous créez) : votre propre expertise packagée comme agent réutilisable.

#### Anatomie d'un fichier de subagent

```markdown
---
name: security-reviewer
description: Expert en sécurité. Analyse les changements de code pour détecter des vulnérabilités. Invoquer automatiquement avant tout commit touchant l'auth, les paiements ou les données utilisateur.
tools: Read, Grep, Glob
model: sonnet
---

Vous êtes un expert en sécurité applicative senior.

## Votre mission

Analysez le code fourni et identifiez :
- Injections SQL, XSS, command injection
- Problèmes d'authentification et d'autorisation
- Données sensibles exposées (logs, erreurs, réponses)
- Dépendances avec des CVE connues

## Format de sortie

Retournez une liste priorisée :
🔴 CRITIQUE : [description + ligne concernée]
🟡 ATTENTION : [description]
🟢 INFO : [observation]
```

#### Où placer vos subagents ?

```
.claude/agents/          → Niveau projet (partagé, versionnable)
~/.claude/agents/        → Niveau utilisateur (tous vos projets)
```

#### Comment les invoquer ?

```bash
# Invocation automatique (Claude décide selon la description)
> Vérifie la sécurité de ce changement avant de commiter

# Invocation explicite avec @mention
> @security-reviewer, analyse src/auth/

# Lancement d'une session entière en tant que subagent
claude --agent security-reviewer

# Invocation en parallèle (dans le prompt)
> En parallèle : explore l'architecture backend ET review le code frontend
```

#### Quand NE PAS utiliser les subagents

- Tâches courtes et simples (overhead > bénéfice)
- Modifications sur les mêmes fichiers en parallèle (risque de conflit)
- Quand les agents doivent se parler entre eux (→ utilisez Agent Teams à la place)
- Si vous avez déjà trop de subagents définis (dégrade le routing automatique)

---

### 🛠 Pratique (17 min)

#### Exercice 1 — Créer un subagent "Tech Writer" (8 min)

Objectif : un agent spécialisé dans la génération de documentation technique.

**Étape 1** : Créez `.claude/agents/tech-writer.md` :

```markdown
---
name: tech-writer
description: Rédacteur technique spécialisé. Génère et améliore la documentation : README, JSDoc, commentaires de code, guides API. Invoquer quand l'utilisateur veut "documenter", "écrire la doc" ou "créer un README".
tools: Read, Write, Edit, Grep, Glob
model: sonnet
---

Vous êtes un rédacteur technique expert avec 10 ans d'expérience dans la documentation de projets open-source et d'entreprise.

## Votre style

- Clair et concis : une idée par paragraphe
- Exemples concrets systématiquement
- Progressif : du cas simple au cas avancé
- Voix active, temps présent

## Pour les README

Structure obligatoire :
1. Titre + badge de statut + description en 1 ligne
2. Démo rapide (GIF ou code en 5 lignes)
3. Installation (la plus simple possible)
4. Usage — exemples du cas le plus courant
5. Configuration — tableau des options
6. Contributing — courte section
7. License

## Pour les fonctions (JSDoc/docstring)

```
/**
 * [Description en une phrase — commence par un verbe]
 *
 * @param {type} nom - Description du paramètre
 * @returns {type} Ce qui est retourné
 * @throws {ErrorType} Quand est-ce que ça lève une erreur
 *
 * @example
 * // Exemple minimal qui marche
 * const result = maFonction(arg1, arg2);
 */
```

## Règles absolues

- Jamais de "TODO" ou "à compléter" dans le résultat final
- Tester mentalement chaque exemple avant de l'écrire
- Adapter le niveau de détail au public (développeur ? utilisateur final ?)
```

**Test** :

```
> @tech-writer, génère la documentation complète pour le fichier src/api/users.js
```

---

#### Exercice 2 — Subagent parallèle pour analyse de codebase (9 min)

Objectif : lancer plusieurs subagents en parallèle pour analyser différentes parties d'un projet.

**Créez `.claude/agents/code-explorer.md`** (agent read-only, rapide) :

```markdown
---
name: code-explorer
description: Explorateur de code read-only. Analyse et cartographie la structure d'un codebase sans rien modifier. Utiliser pour comprendre l'architecture, trouver des patterns, identifier des dépendances.
tools: Read, Grep, Glob, Bash(find *), Bash(cat *), Bash(wc *)
model: haiku
---

Vous êtes un expert en analyse statique de code.

## Votre mission

Explorer le code sans jamais le modifier. Votre valeur est dans la précision de votre analyse.

## Ce que vous devez toujours produire

1. **Structure** : arborescence des fichiers clés
2. **Points d'entrée** : où commence l'application
3. **Dépendances critiques** : packages les plus importants
4. **Patterns observés** : architecture (MVC, hexagonale, etc.)
5. **Questions ouvertes** : ce qui mérite investigation

## Contraintes

- Ne JAMAIS utiliser Write, Edit ou des commandes Bash modifiant des fichiers
- Rester factuel : pas d'opinion, que de l'observation
- Retourner un résumé structuré de maximum 500 mots
```

**Test — Invocation parallèle** :

```
> En utilisant des subagents en parallèle :
> 1. @code-explorer : explore l'architecture du dossier src/
> 2. @tech-writer : génère un README basé sur ce que tu trouves dans package.json et src/index.js
```

Observez comment Claude orchestre les deux agents et consolide les résultats.

---

#### Exercice bonus — Voir les subagents disponibles

```bash
# Dans Claude Code
/agents

# Ou en ligne de commande
ls ~/.claude/agents/
ls .claude/agents/
```

---

## Partie 4 — Rappel MCP

**⏱ Durée : 5 minutes**

> 📚 **Contenu détaillé** : [→ Voir le repo GitHub du workshop précédent](#lien-a-ajouter)
> 🔗 **Documentation officielle** : [code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp)

---

### Rappel rapide : c'est quoi MCP ?

**MCP (Model Context Protocol)** est un standard ouvert créé par Anthropic qui permet à Claude Code de se connecter à des outils et sources de données externes via un protocole unifié.

> 💡 **Analogie** : MCP est le "USB-C" de l'IA — un seul standard pour brancher n'importe quel outil.

```
Claude Code (client MCP)
        ↕ JSON-RPC
MCP Server (ex: GitHub, Notion, Postgres)
        ↕
API / Base de données / Système de fichiers
```

### Les 3 modes de transport

| Mode | Latence | Usage |
|------|---------|-------|
| `stdio` | ~5 ms | Serveurs locaux (90% des cas) |
| `SSE` | ~45 ms | Serveurs distants / équipe |
| `HTTP streamable` | variable | Nouveau standard (remplace SSE) |

### Commandes essentielles de rappel

```bash
# Ajouter un serveur MCP
claude mcp add github -- npx -y @modelcontextprotocol/server-github

# Lister les serveurs configurés
claude mcp list

# Vérifier dans une session
/mcp
```

### Configuration projet (`.mcp.json`)

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### Ce que ça permet concrètement

```
> Implémente la feature décrite dans le ticket JIRA ENG-4521 et ouvre une PR GitHub
> Analyse les erreurs Sentry de la semaine et résume les problèmes critiques
> Trouve dans notre base PostgreSQL les 10 users les plus actifs ce mois
```

**→ Pour tout le détail : consultez le repo du workshop MCP** *(lien à ajouter)*

---

## Conclusion & Ouverture

**⏱ Durée : 10 minutes**

---

### Ce qu'on a couvert aujourd'hui

| Ce qu'on a appris | Ce que ça vous apporte |
|---|---|
| **Hooks** | Automatisation déterministe, règles non-négociables, sécurité |
| **Skills** | Expertise packagée et réutilisable, cohérence d'équipe |
| **Subagents** | Isolation du contexte, parallélisation, spécialisation |
| **MCP** | Connexion à tout votre écosystème d'outils |

### La combinaison gagnante

Ces 4 mécanismes se complètent :

```
Skill "code-review"
    → invoque le subagent "security-reviewer"
    → un hook PostToolUse formate le code automatiquement
    → un serveur MCP GitHub crée la PR directement
```

### Prochain workshop — Frameworks IA

Maintenant que vous maîtrisez les extensions natives de Claude Code, le prochain workshop explorera les **libraries et frameworks IA** qui décuplent encore la puissance de vos agents :

- **[SuperPower](https://github.com/)** — Orchestration avancée d'agents
- **[BMAD Method](https://github.com/bmadcode/BMAD-METHOD)** — Agile methodology pour les agents IA
- **[Compound Engineering](https://github.com/)** — Patterns de composition d'agents en production

Ces frameworks s'appuient exactement sur ce qu'on a vu aujourd'hui — vous êtes prêts.

---

### 🎓 Passez les certifications Anthropic !

Anthropic propose des cours officiels (gratuits) avec certificats :

| Cours | Lien | Durée estimée |
|-------|------|---------------|
| Introduction to Agent Skills | [skilljar.com](https://anthropic.skilljar.com/introduction-to-agent-skills) | ~1h |
| Introduction to Subagents | [skilljar.com](https://anthropic.skilljar.com/introduction-to-subagents) | ~1h |
| Claude Code in Action (Hooks) | [skilljar.com](https://anthropic.skilljar.com/claude-code-in-action) | ~2h |

Ces certifications valident les compétences abordées dans ce workshop et constituent un excellent complément à la pratique.

---

### Ressources pour aller plus loin

**Documentation officielle**
- [code.claude.com/docs](https://code.claude.com/docs) — Documentation complète Claude Code
- [platform.claude.com/docs](https://platform.claude.com/docs) — API et Agent SDK

**Repos utiles**
- [github.com/anthropics/skills](https://github.com/anthropics/skills) — 17 skills open-source officielles d'Anthropic
- [agentskills.io](https://agentskills.io) — Standard ouvert des Agent Skills

**Communauté**
- [r/ClaudeAI](https://reddit.com/r/ClaudeAI) — Partage d'agents et de configs
- Discord Anthropic — Support et discussions

---

### Questions ?

*Merci d'avoir participé !*

> Slides et code de ce workshop disponibles sur : **[lien à ajouter]**