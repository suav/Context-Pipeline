import { promises as fs } from 'fs';
import path from 'path';
import GlobalConfigManager, { GlobalConfig, PermissionSet } from '@/lib/global-config';
import { WorkspacePermissions, PermissionInjectionContext } from '@/features/agents/types/permissions';
import { COMMAND_LIBRARY, Command } from '@/features/agents/data/commandLibrary';
import CommandManager, { UserCommand } from '@/features/agents/services/CommandManager';
export interface WorkspaceContext {
  workspaceId: string;
  workspacePath: string;
  description?: string;
  projectType?: string;
  contextFiles?: string[];
  gitInfo?: {
    branch?: string;
    commits?: string[];
    status?: string;
  };
  jiraTickets?: any[];
  customInstructions?: string[];
}
export class WorkspaceDocumentGenerator {
  private static configManager = GlobalConfigManager.getInstance();
  static async generateClaudeMd(workspaceId: string, context?: WorkspaceContext): Promise<void> {
    try {
      console.log(`📄 Generating CLAUDE.md for workspace ${workspaceId}`);
      const config = await this.configManager.loadConfig();
      const workspacePath = context?.workspacePath || this.getWorkspacePath(workspaceId);
      const claudeMdPath = path.join(workspacePath, 'CLAUDE.md');
      // Load workspace metadata
      const workspaceData = await this.loadWorkspaceData(workspaceId);
      const permissions = await this.loadWorkspacePermissions(workspaceId);
      const commands = await this.loadWorkspaceCommands(workspaceId);
      // Generate content from template
      const template = config.documents.templates.claudeMdTemplate;
      const claudeContent = await this.processTemplate(template, {
        WORKSPACE_DESCRIPTION: workspaceData.description || 'Development workspace',
        CURRENT_TASK: workspaceData.currentTask || 'Not specified',
        PERMISSIONS_SUMMARY: this.formatPermissionsForClaudemd(permissions),
        COMMANDS_LIST: this.formatCommandsForClaudemd(commands),
        CONTEXT_FILES: await this.getContextFilesList(workspaceId),
        CODING_STANDARDS: config.documents.codingStandards || 'Follow standard best practices',
        WORKSPACE_ID: workspaceId,
        TIMESTAMP: new Date().toISOString()
      });
      await fs.writeFile(claudeMdPath, claudeContent);
      console.log(`✅ CLAUDE.md generated successfully at ${claudeMdPath}`);
    } catch (error) {
      console.error('❌ Failed to generate CLAUDE.md:', error);
      throw error;
    }
  }
  static async generatePermissions(workspaceId: string, context?: WorkspaceContext): Promise<void> {
    try {
      console.log(`🔐 Generating permissions.json for workspace ${workspaceId}`);
      const config = await this.configManager.loadConfig();
      const workspacePath = context?.workspacePath || this.getWorkspacePath(workspaceId);
      const permissionsPath = path.join(workspacePath, 'permissions.json');
      // Determine appropriate permissions based on workspace type
      const permissions = await this.determineWorkspacePermissions(workspaceId, context);
      const template = config.documents.templates.permissionsTemplate;
      const permissionsContent = await this.processTemplate(template, {
        WORKSPACE_ID: workspaceId,
        PERMISSIONS_JSON: JSON.stringify(permissions, null, 2),
        TIMESTAMP: new Date().toISOString()
      });
      await fs.writeFile(permissionsPath, permissionsContent);
      console.log(`✅ permissions.json generated successfully at ${permissionsPath}`);
    } catch (error) {
      console.error('❌ Failed to generate permissions.json:', error);
      throw error;
    }
  }
  static async generateCommands(workspaceId: string, context?: WorkspaceContext): Promise<void> {
    try {
      console.log(`⚡ Generating commands.json for workspace ${workspaceId}`);
      const config = await this.configManager.loadConfig();
      const workspacePath = context?.workspacePath || this.getWorkspacePath(workspaceId);
      const commandsPath = path.join(workspacePath, 'commands.json');
      // Get workspace-specific commands
      const workspaceCommands = await this.getWorkspaceCommands(workspaceId, context);
      const template = config.documents.templates.commandsTemplate;
      const commandsContent = await this.processTemplate(template, {
        WORKSPACE_ID: workspaceId,
        COMMANDS_JSON: JSON.stringify(workspaceCommands, null, 2),
        HOTKEYS_JSON: JSON.stringify(config.commands.hotKeys, null, 2),
        TIMESTAMP: new Date().toISOString()
      });
      await fs.writeFile(commandsPath, commandsContent);
      console.log(`✅ commands.json generated successfully at ${commandsPath}`);
    } catch (error) {
      console.error('❌ Failed to generate commands.json:', error);
      throw error;
    }
  }
  static async validateDocuments(workspaceId: string): Promise<boolean> {
    try {
      console.log(`🔍 Validating documents for workspace ${workspaceId}`);
      const workspacePath = this.getWorkspacePath(workspaceId);
      const requiredFiles = ['CLAUDE.md', 'permissions.json', 'commands.json'];
      const validationResults = await Promise.all(
        requiredFiles.map(async (fileName) => {
          const filePath = path.join(workspacePath, fileName);
          try {
            await fs.access(filePath);
            const stats = await fs.stat(filePath);
            const isRecent = (Date.now() - stats.mtime.getTime()) < 24 * 60 * 60 * 1000; // 24 hours
            return { file: fileName, exists: true, recent: isRecent };
          } catch (error) {
            return { file: fileName, exists: false, recent: false };
          }
        })
      );
      const allValid = validationResults.every(result => result.exists);
      const allRecent = validationResults.every(result => result.recent);
      console.log(`📋 Validation results:`, validationResults);
      if (!allValid) {
        console.warn('⚠️  Some required documents are missing');
        return false;
      }
      if (!allRecent) {
        console.warn('⚠️  Some documents are outdated');
      }
      return true;
    } catch (error) {
      console.error('❌ Document validation failed:', error);
      return false;
    }
  }
  static async workspaceHasPermissions(workspaceId: string): Promise<boolean> {
    try {
      const workspacePath = this.getWorkspacePath(workspaceId);
      const permissionsPath = path.join(workspacePath, 'permissions.json');
      await fs.access(permissionsPath);
      return true;
    } catch (error) {
      return false;
    }
  }
  static async loadWorkspacePermissions(workspaceId: string): Promise<WorkspacePermissions> {
    try {
      const workspacePath = this.getWorkspacePath(workspaceId);
      const permissionsPath = path.join(workspacePath, 'permissions.json');
      const permissionsData = await fs.readFile(permissionsPath, 'utf8');
      const permissionsFile = JSON.parse(permissionsData);
      return permissionsFile.permissions || this.getDefaultPermissions();
    } catch (error) {
      console.warn('⚠️  Failed to load workspace permissions, using defaults:', error);
      return this.getDefaultPermissions();
    }
  }
  static formatPermissionsForAgent(permissions: WorkspacePermissions): string {
    const sections = [
      `## File System Access`,
      `- **Read Access**: ${permissions.fileSystem.read.join(', ')}`,
      `- **Write Access**: ${permissions.fileSystem.write.join(', ')}`,
      `- **Execute Access**: ${permissions.fileSystem.execute.join(', ')}`,
      ``,
      `## Git Operations`,
      `- **Allowed**: ${permissions.git.allowedOperations.join(', ')}`,
      `- **Protected Branches**: ${permissions.git.protectedBranches.join(', ')}`,
      `- **Requires Approval**: ${permissions.git.requiresApproval.join(', ')}`,
      ``,
      `## Commands`,
      `- **Allowed**: ${permissions.commands.allowed.join(', ')}`,
      `- **Requires Approval**: ${permissions.commands.requiresApproval.join(', ')}`,
      `- **Forbidden**: ${permissions.commands.forbidden.join(', ')}`,
      ``,
      `## System Access`,
      `- **Package Installation**: ${permissions.systemAccess.canInstallPackages ? 'Allowed' : 'Denied'}`,
      `- **Environment Modification**: ${permissions.systemAccess.canModifyEnvironment ? 'Allowed' : 'Denied'}`,
      `- **Network Access**: ${permissions.systemAccess.canAccessNetwork ? 'Allowed' : 'Denied'}`,
      ``,
      `⚠️  **Important**: These permissions are strictly enforced. Any operation outside these boundaries will be blocked.`
    ];
    return sections.join('\n');
  }
  private static getWorkspacePath(workspaceId: string): string {
    return path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
  }
  private static async loadWorkspaceData(workspaceId: string): Promise<any> {
    try {
      const workspacePath = this.getWorkspacePath(workspaceId);
      const workspaceJsonPath = path.join(workspacePath, 'workspace.json');
      const workspaceData = await fs.readFile(workspaceJsonPath, 'utf8');
      return JSON.parse(workspaceData);
    } catch (error) {
      console.warn('⚠️  Failed to load workspace.json, using defaults');
      return {
        description: 'Development workspace',
        currentTask: 'Not specified',
        projectType: 'general'
      };
    }
  }
  private static async loadWorkspaceCommands(workspaceId: string): Promise<UserCommand[]> {
    try {
      const commandManager = CommandManager.getInstance();
      await commandManager.initializeStorage();
      return await commandManager.getAllCommands();
    } catch (error) {
      console.warn('Failed to load commands from CommandManager, falling back to legacy:', error);
      // Fallback to legacy approach if CommandManager fails
      try {
        const workspacePath = this.getWorkspacePath(workspaceId);
        const commandsPath = path.join(workspacePath, 'commands.json');
        const commandsData = await fs.readFile(commandsPath, 'utf8');
        const commandsFile = JSON.parse(commandsData);
        return commandsFile.commands || [];
      } catch (fallbackError) {
        return [];
      }
    }
  }
  private static async determineWorkspacePermissions(workspaceId: string, context?: WorkspaceContext): Promise<WorkspacePermissions> {
    const config = await this.configManager.loadConfig();
    // Determine role based on workspace type or context
    let roleTemplate = 'developer'; // default
    if (context?.projectType) {
      switch (context.projectType) {
        case 'review':
          roleTemplate = 'reviewer';
          break;
        case 'analysis':
          roleTemplate = 'analyst';
          break;
        default:
          roleTemplate = 'developer';
      }
    }
    const templatePermissions = config.permissions.templates[roleTemplate];
    if (templatePermissions) {
      return this.convertPermissionSetToWorkspacePermissions(templatePermissions);
    }
    return this.getDefaultPermissions();
  }
  private static convertPermissionSetToWorkspacePermissions(permissionSet: PermissionSet): WorkspacePermissions {
    return {
      fileSystem: permissionSet.fileSystem,
      git: permissionSet.git,
      external: permissionSet.external,
      commands: permissionSet.commands,
      systemAccess: permissionSet.systemAccess
    };
  }
  private static getDefaultPermissions(): WorkspacePermissions {
    return {
      fileSystem: {
        read: ['context/**', 'target/**', 'feedback/**'],
        write: ['target/**', 'feedback/**'],
        execute: ['target/**']
      },
      git: {
        allowedOperations: ['diff', 'status', 'log', 'show', 'blame', 'add', 'commit'],
        protectedBranches: ['main', 'master', 'production'],
        requiresApproval: ['push', 'branch', 'checkout']
      },
      external: {
        allowedHosts: ['api.github.com', 'api.openai.com'],
        apiKeys: {}
      },
      commands: {
        allowed: ['ls', 'cat', 'head', 'tail', 'grep', 'find', 'git', 'npm', 'node'],
        requiresApproval: ['rm', 'rmdir', 'mv', 'cp', 'chmod', 'chown'],
        forbidden: ['sudo', 'su', 'passwd', 'shutdown', 'reboot']
      },
      systemAccess: {
        canInstallPackages: false,
        canModifyEnvironment: false,
        canAccessNetwork: true,
        maxResourceUsage: {
          memory: 512,
          cpu: 50,
          disk: 100
        }
      }
    };
  }
  private static async getWorkspaceCommands(workspaceId: string, context?: WorkspaceContext): Promise<UserCommand[]> {
    try {
      // Get commands from CommandManager
      const commands = await this.loadWorkspaceCommands(workspaceId);
      return commands;
    } catch (error) {
      console.warn('⚠️  Failed to load commands from CommandManager:', error);
      // Fallback to legacy approach
      try {
        const config = await this.configManager.loadConfig();
        const commands = [...Object.values(COMMAND_LIBRARY.commands)];
        const globalCommands = Object.values(config.commands.globalCommands);
        commands.push(...globalCommands);
        return commands;
      } catch (fallbackError) {
        console.warn('⚠️  All command loading methods failed:', fallbackError);
        return [];
      }
    }
  }
  private static async getContextFilesList(workspaceId: string): Promise<string> {
    try {
      const workspacePath = this.getWorkspacePath(workspaceId);
      const contextPath = path.join(workspacePath, 'context');
      const files = await fs.readdir(contextPath, { recursive: true });
      return files.map(file => `- ${file}`).join('\n');
    } catch (error) {
      return '- No context files found';
    }
  }
  private static formatPermissionsForClaudemd(permissions: WorkspacePermissions): string {
    return `You have the following permissions in this workspace:
- **File System**: Read ${permissions.fileSystem.read.join(', ')}, Write ${permissions.fileSystem.write.join(', ')}
- **Git**: ${permissions.git.allowedOperations.join(', ')}
- **Commands**: ${permissions.commands.allowed.join(', ')}
- **System**: ${permissions.systemAccess.canInstallPackages ? 'Package installation allowed' : 'No package installation'}`;
  }
  private static formatCommandsForClaudemd(commands: UserCommand[]): string {
    if (commands.length === 0) {
      return '- No custom commands available';
    }
    
    const startupCommands = commands.filter(cmd => ['investigate', 'analyze', 'plan', 'setup'].includes(cmd.id));
    const replyCommands = commands.filter(cmd => ['implement', 'debug', 'review', 'test', 'explain', 'continue'].includes(cmd.id));
    const customCommands = commands.filter(cmd => !cmd.is_default);
    
    let formattedCommands = '';
    
    if (startupCommands.length > 0) {
      formattedCommands += '\n### Startup Commands\n';
      formattedCommands += startupCommands.map(cmd => 
        `- **${cmd.name}** (\`${cmd.keyword}\`): ${cmd.base_prompt.split('\n')[0].replace(/^#\s*/, '')}${cmd.requires_approval ? ' ⚠️ *Requires approval*' : ''}`
      ).join('\n');
    }
    
    if (replyCommands.length > 0) {
      formattedCommands += '\n\n### Reply Commands\n';
      formattedCommands += replyCommands.map(cmd => 
        `- **${cmd.name}** (\`${cmd.keyword}\`): ${cmd.base_prompt.split('\n')[0].replace(/^#\s*/, '')}${cmd.requires_approval ? ' ⚠️ *Requires approval*' : ''}`
      ).join('\n');
    }
    
    if (customCommands.length > 0) {
      formattedCommands += '\n\n### Custom Commands\n';
      formattedCommands += customCommands.map(cmd => 
        `- **${cmd.name}** (\`${cmd.keyword}\`): ${cmd.base_prompt.split('\n')[0].replace(/^#\s*/, '')}${cmd.requires_approval ? ' ⚠️ *Requires approval*' : ''}`
      ).join('\n');
    }
    
    return formattedCommands;
  }
  private static async processTemplate(template: string, variables: Record<string, string>): Promise<string> {
    let content = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      content = content.replace(new RegExp(placeholder, 'g'), value);
    }
    return content;
  }
}
export default WorkspaceDocumentGenerator;