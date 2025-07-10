import { UserCommand } from './CommandManager';

export class CommandClientService {
  private static instance: CommandClientService;

  private constructor() {}

  static getInstance(): CommandClientService {
    if (!CommandClientService.instance) {
      CommandClientService.instance = new CommandClientService();
    }
    return CommandClientService.instance;
  }

  async getAllCommands(): Promise<UserCommand[]> {
    try {
      const response = await fetch('/api/commands');
      if (!response.ok) {
        throw new Error('Failed to fetch commands');
      }
      const data = await response.json();
      return data.commands || [];
    } catch (error) {
      console.error('Failed to get commands:', error);
      throw error;
    }
  }

  async getCommand(id: string): Promise<UserCommand | null> {
    try {
      const response = await fetch(`/api/commands/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch command');
      }
      const data = await response.json();
      return data.command;
    } catch (error) {
      console.error('Failed to get command:', error);
      throw error;
    }
  }

  async saveCommand(command: UserCommand): Promise<void> {
    try {
      const response = await fetch('/api/commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save command');
      }
    } catch (error) {
      console.error('Failed to save command:', error);
      throw error;
    }
  }

  async deleteCommand(id: string): Promise<void> {
    try {
      const response = await fetch(`/api/commands/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete command');
      }
    } catch (error) {
      console.error('Failed to delete command:', error);
      throw error;
    }
  }

  async getCommandsByMode(mode: 'startup' | 'reply'): Promise<UserCommand[]> {
    try {
      const response = await fetch(`/api/commands?mode=${mode}`);
      if (!response.ok) {
        throw new Error('Failed to fetch commands');
      }
      const data = await response.json();
      return data.commands || [];
    } catch (error) {
      console.error('Failed to get commands by mode:', error);
      throw error;
    }
  }

  async getCommandsByCategory(category: string): Promise<UserCommand[]> {
    try {
      const response = await fetch(`/api/commands?category=${category}`);
      if (!response.ok) {
        throw new Error('Failed to fetch commands');
      }
      const data = await response.json();
      return data.commands || [];
    } catch (error) {
      console.error('Failed to get commands by category:', error);
      throw error;
    }
  }

  async getCommandsByRole(role: string): Promise<UserCommand[]> {
    try {
      const response = await fetch(`/api/commands?role=${role}`);
      if (!response.ok) {
        throw new Error('Failed to fetch commands');
      }
      const data = await response.json();
      return data.commands || [];
    } catch (error) {
      console.error('Failed to get commands by role:', error);
      throw error;
    }
  }

  async getRoleTemplates(): Promise<any> {
    try {
      const response = await fetch('/api/commands/role-templates');
      if (!response.ok) {
        throw new Error('Failed to fetch role templates');
      }
      const data = await response.json();
      return data.templates || {};
    } catch (error) {
      console.error('Failed to get role templates:', error);
      throw error;
    }
  }

  async migrateCommands(): Promise<void> {
    try {
      const response = await fetch('/api/commands', {
        method: 'PATCH',
      });
      
      if (!response.ok) {
        throw new Error('Failed to migrate commands');
      }
    } catch (error) {
      console.error('Failed to migrate commands:', error);
      throw error;
    }
  }
}

export default CommandClientService;