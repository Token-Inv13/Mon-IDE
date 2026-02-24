import React, { useState } from 'react';

const ACTIONS = [
  {
    category: '🔍 Audit',
    color: '#f59e0b',
    actions: [
      {
        label: 'Audit qualité',
        icon: '✅',
        prompt: `Fais un audit complet de qualité de ce fichier. Analyse :
1. La lisibilité et la clarté du code
2. Les bonnes pratiques respectées ou non
3. La structure et l'organisation
4. Les noms de variables et fonctions
5. La complexité cyclomatique
Donne une note /10 et liste les améliorations prioritaires.`
      },
      {
        label: 'Audit sécurité',
        icon: '🔒',
        prompt: `Fais un audit de sécurité complet de ce fichier. Cherche :
1. Les injections possibles (SQL, XSS, etc.)
2. Les données sensibles exposées
3. Les failles d'authentification
4. Les dépendances vulnérables
5. Les mauvaises pratiques de sécurité
Classe les problèmes par criticité (Critique / Élevé / Moyen / Faible).`
      },
      {
        label: 'Audit performance',
        icon: '⚡',
        prompt: `Fais un audit de performance de ce fichier. Analyse :
1. Les algorithmes inefficaces (complexité O(n²) etc.)
2. Les appels inutiles ou redondants
3. Les fuites mémoire potentielles
4. Les optimisations possibles
5. Le lazy loading et le caching
Propose des solutions concrètes avec le code corrigé.`
      },
      {
        label: 'Audit complet',
        icon: '🎯',
        prompt: `Fais un audit COMPLET de ce fichier sur tous les aspects :
**Qualité** : lisibilité, bonnes pratiques, structure
**Sécurité** : failles, données exposées, vulnérabilités  
**Performance** : algorithmes, mémoire, optimisations
**Maintenabilité** : couplage, tests, documentation

Donne un rapport structuré avec une note globale /10 et un plan d'action priorisé.`
      },
    ]
  },
  {
    category: '🚀 Déploiement',
    color: '#10b981',
    actions: [
      {
        label: 'Init Git',
        icon: '📦',
        prompt: `Je veux initialiser Git sur ce projet. Génère les commandes exactes pour :
1. Initialiser le repo Git
2. Créer un .gitignore adapté au projet
3. Faire le premier commit
4. Créer une branche main
Explique chaque commande et donne-les dans l'ordre à exécuter dans le terminal.`
      },
      {
        label: 'Deploy Vercel',
        icon: '▲',
        prompt: `Je veux déployer ce projet sur Vercel. Guide-moi étape par étape :
1. Les prérequis nécessaires
2. L'installation de Vercel CLI
3. La configuration du projet (vercel.json si nécessaire)
4. Les commandes de déploiement
5. Les variables d'environnement à configurer
Adapte les instructions au type de projet détecté.`
      },
      {
        label: 'Deploy Netlify',
        icon: '🌐',
        prompt: `Je veux déployer ce projet sur Netlify. Guide-moi étape par étape :
1. Les prérequis nécessaires
2. La configuration netlify.toml
3. Les commandes de build
4. Le déploiement via CLI ou Git
5. Les variables d'environnement
Adapte les instructions au type de projet détecté.`
      },
      {
        label: 'Docker',
        icon: '🐳',
        prompt: `Crée un Dockerfile et docker-compose.yml optimisés pour ce projet.
Inclus :
1. Le Dockerfile multi-stage pour optimiser la taille
2. Le docker-compose.yml avec les services nécessaires
3. Le .dockerignore approprié
4. Les commandes pour build et run
5. Les bonnes pratiques de sécurité Docker`
      },
    ]
  },
  {
    category: '📚 Documentation',
    color: '#6366f1',
    actions: [
      {
        label: 'Générer README',
        icon: '📝',
        prompt: `Génère un README.md professionnel et complet pour ce projet. Inclus :
1. Le titre et la description du projet
2. Les badges (version, license, etc.)
3. Les fonctionnalités principales
4. Les prérequis et l'installation
5. Les exemples d'utilisation
6. La structure du projet
7. Comment contribuer
8. La license
Rends-le attractif avec des emojis et une bonne mise en forme Markdown.`
      },
      {
        label: 'Commenter le code',
        icon: '💬',
        prompt: `Ajoute des commentaires clairs et utiles à ce code. 
- Commente chaque fonction avec JSDoc (paramètres, retour, description)
- Explique les blocs complexes
- Ajoute des commentaires de section
- Garde les commentaires en français
- Ne commente pas l'évident, explique le POURQUOI
Retourne le fichier complet avec les commentaires ajoutés entre balises <file></file>.`
      },
      {
        label: 'Générer tests',
        icon: '🧪',
        prompt: `Génère des tests unitaires complets pour ce fichier.
Utilise Jest et inclus :
1. Les tests de cas normaux
2. Les tests de cas limites (edge cases)
3. Les tests d'erreurs
4. Les mocks nécessaires
5. Une couverture de code maximale
Organise les tests avec describe/it et des noms clairs en français.`
      },
      {
        label: 'Changelog',
        icon: '📋',
        prompt: `Génère un CHANGELOG.md professionnel pour ce projet au format Keep a Changelog.
Analyse le code et crée :
1. La structure standard (Unreleased, versions)
2. Les catégories (Added, Changed, Fixed, Removed)
3. Une version initiale 1.0.0 basée sur les fonctionnalités détectées
Utilise le format Markdown standard.`
      },
    ]
  },
  {
    category: '⚡ Nouveau Projet',
    color: '#ec4899',
    actions: [
      {
        label: 'App React',
        icon: '⚛️',
        prompt: `Crée la structure complète d'une application React moderne. Génère :
1. La structure de dossiers recommandée
2. Les fichiers de base (App.js, index.js, etc.)
3. La configuration (package.json, .env.example)
4. Un composant exemple avec hooks
5. Le CSS de base
6. Les commandes pour démarrer
Utilise les meilleures pratiques React 2024.`
      },
      {
        label: 'API Node.js',
        icon: '🟩',
        prompt: `Crée la structure complète d'une API REST Node.js/Express. Génère :
1. La structure MVC (routes, controllers, models)
2. Le serveur Express configuré
3. La gestion des erreurs
4. La validation des données
5. La configuration (package.json, .env.example)
6. Un exemple de route CRUD complet
Utilise les meilleures pratiques 2024.`
      },
      {
        label: 'Script Python',
        icon: '🐍',
        prompt: `Crée la structure d'un projet Python professionnel. Génère :
1. La structure de dossiers
2. Le requirements.txt
3. Le fichier principal avec argparse
4. La gestion des logs
5. Le fichier de configuration
6. Les tests de base avec pytest
Utilise les meilleures pratiques Python.`
      },
      {
        label: 'Landing Page',
        icon: '🎨',
        prompt: `Crée une landing page HTML/CSS/JS complète et moderne. Génère :
1. Un design moderne avec CSS variables
2. Une navigation responsive
3. Une section hero avec CTA
4. Une section features
5. Une section tarifs
6. Un footer complet
7. Les animations CSS
Rends-la professionnelle et prête à déployer.`
      },
    ]
  }
];

export default function ActionPanel({ onAction, isVisible, onToggle }) {
  const [expandedCategory, setExpandedCategory] = useState('🔍 Audit');

  if (!isVisible) return null;

  return (
    <div style={{
      width: 200,
      background: '#1e1e2e',
      borderRight: '1px solid #333',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid #333',
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#252535'
      }}>
        <span>⚡ Actions</span>
        <button onClick={onToggle} style={{
          background: 'none', border: 'none', color: '#666',
          cursor: 'pointer', fontSize: 14, padding: 0
        }}>✕</button>
      </div>

      {/* Categories */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {ACTIONS.map((category) => (
          <div key={category.category}>
            {/* Category header */}
            <div
              onClick={() => setExpandedCategory(
                expandedCategory === category.category ? null : category.category
              )}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 'bold',
                color: category.color,
                background: expandedCategory === category.category ? '#252535' : 'transparent',
                borderBottom: '1px solid #2a2a3a',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                userSelect: 'none'
              }}
            >
              <span>{category.category}</span>
              <span style={{ color: '#555', fontSize: 10 }}>
                {expandedCategory === category.category ? '▼' : '▶'}
              </span>
            </div>

            {/* Action buttons */}
            {expandedCategory === category.category && (
              <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {category.actions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => onAction(action.prompt, action.label)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: `1px solid ${category.color}33`,
                      background: `${category.color}11`,
                      color: '#ddd',
                      cursor: 'pointer',
                      fontSize: 12,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = `${category.color}22`;
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = `${category.color}11`;
                      e.currentTarget.style.color = '#ddd';
                    }}
                  >
                    <span>{action.icon}</span>
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid #333',
        color: '#555',
        fontSize: 10,
        textAlign: 'center'
      }}>
        Cliquer envoie l'action à Claude
      </div>
    </div>
  );
}