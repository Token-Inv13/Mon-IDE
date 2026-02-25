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
  }
];
