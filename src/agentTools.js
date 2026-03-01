export const AGENT_TOOLS = [
  {
    name: 'read_file',
    description: 'Lire le contenu d\'un fichier du projet',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Chemin absolu du fichier' } },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Écrire ou modifier un fichier',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Chemin absolu du fichier' },
        content: { type: 'string', description: 'Contenu complet du fichier' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'create_file',
    description: 'Créer un nouveau fichier',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Chemin absolu' },
        content: { type: 'string', description: 'Contenu initial' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'create_folder',
    description: 'Créer un dossier',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Chemin absolu du dossier' } },
      required: ['path']
    }
  },
  {
    name: 'delete_path',
    description: 'Supprimer un fichier ou un dossier (si possible via corbeille projet)',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Chemin absolu' } },
      required: ['path']
    }
  },
  {
    name: 'move_path',
    description: 'Déplacer ou renommer un fichier/dossier',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Chemin source (absolu)' },
        to: { type: 'string', description: 'Chemin destination (absolu)' }
      },
      required: ['from', 'to']
    }
  },
  {
    name: 'copy_file',
    description: 'Copier un fichier (pas un dossier)',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Chemin source (absolu)' },
        to: { type: 'string', description: 'Chemin destination (absolu)' }
      },
      required: ['from', 'to']
    }
  },
  {
    name: 'trash_path',
    description: 'Déplacer un fichier/dossier vers la corbeille du projet',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Chemin absolu' } },
      required: ['path']
    }
  },
  {
    name: 'restore_path',
    description: 'Restaurer un fichier/dossier depuis la corbeille du projet',
    input_schema: {
      type: 'object',
      properties: {
        trashedPath: { type: 'string', description: 'Chemin dans .monide-trash (absolu)' },
        originalPath: { type: 'string', description: 'Chemin original (absolu)' }
      },
      required: ['trashedPath', 'originalPath']
    }
  },
  {
    name: 'list_files',
    description: 'Lister les fichiers d\'un dossier',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Chemin du dossier' } },
      required: ['path']
    }
  },
  {
    name: 'run_command',
    description: 'Exécuter une commande terminal',
    input_schema: {
      type: 'object',
      properties: { command: { type: 'string', description: 'Commande à exécuter' } },
      required: ['command']
    }
  },
  {
    name: 'git_status',
    description: 'Afficher git status',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'git_add',
    description: 'Git add (par défaut: tout)',
    input_schema: {
      type: 'object',
      properties: { pathspec: { type: 'string', description: 'Ex: . ou un fichier. Défaut: .' } },
      required: []
    }
  },
  {
    name: 'git_commit',
    description: 'Git commit',
    input_schema: {
      type: 'object',
      properties: { message: { type: 'string', description: 'Message de commit' } },
      required: ['message']
    }
  },
  {
    name: 'git_push',
    description: 'Git push',
    input_schema: {
      type: 'object',
      properties: { remote: { type: 'string', description: 'Remote (défaut: origin)' }, branch: { type: 'string', description: 'Branche (optionnel)' } },
      required: []
    }
  }
];
