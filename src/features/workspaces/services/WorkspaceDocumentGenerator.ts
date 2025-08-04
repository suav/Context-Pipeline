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
      console.log(`🔐 Generating Claude Code permissions for workspace ${workspaceId}`);
      const workspacePath = context?.workspacePath || this.getWorkspacePath(workspaceId);
      
      // Create .claude directory
      const claudeDir = path.join(workspacePath, '.claude');
      await fs.mkdir(claudeDir, { recursive: true });
      
      // Create Claude Code format settings.json
      const settingsPath = path.join(claudeDir, 'settings.json');
      const claudeSettings = this.generateClaudeCodeSettings(workspaceId, context);
      
      await fs.writeFile(settingsPath, JSON.stringify(claudeSettings, null, 2));
      console.log(`✅ Claude Code settings.json generated at ${settingsPath}`);
      
      // Also generate legacy permissions.json for backwards compatibility
      const legacyPermissionsPath = path.join(workspacePath, 'permissions.json');
      const permissions = await this.determineWorkspacePermissions(workspaceId, context);
      const config = await this.configManager.loadConfig();
      const template = config.documents.templates.permissionsTemplate;
      const permissionsContent = await this.processTemplate(template, {
        WORKSPACE_ID: workspaceId,
        PERMISSIONS_JSON: JSON.stringify(permissions, null, 2),
        TIMESTAMP: new Date().toISOString()
      });
      
      await fs.writeFile(legacyPermissionsPath, permissionsContent);
      console.log(`✅ Legacy permissions.json generated at ${legacyPermissionsPath}`);
    } catch (error) {
      console.error('❌ Failed to generate permissions:', error);
      throw error;
    }
  }
  static async generateCommands(workspaceId: string, context?: WorkspaceContext): Promise<void> {
    try {
      console.log(`⚡ Generating commands for workspace ${workspaceId}`);
      const config = await this.configManager.loadConfig();
      const workspacePath = context?.workspacePath || this.getWorkspacePath(workspaceId);
      const commandsPath = path.join(workspacePath, 'commands.json');
      
      // Get workspace-specific commands
      const workspaceCommands = await this.getWorkspaceCommands(workspaceId, context);
      
      // Generate legacy commands.json for backwards compatibility
      const template = config.documents.templates.commandsTemplate;
      const commandsContent = await this.processTemplate(template, {
        WORKSPACE_ID: workspaceId,
        COMMANDS_JSON: JSON.stringify(workspaceCommands, null, 2),
        HOTKEYS_JSON: JSON.stringify(config.commands.hotKeys, null, 2),
        TIMESTAMP: new Date().toISOString()
      });
      await fs.writeFile(commandsPath, commandsContent);
      console.log(`✅ commands.json generated successfully at ${commandsPath}`);
      
      // Generate Claude Code format commands in .claude/commands/*.md
      await this.generateClaudeCodeCommands(workspaceId, workspaceCommands);
      
    } catch (error) {
      console.error('❌ Failed to generate commands:', error);
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
    // PRIORITY 1: Check for user-specific permissions from top-level settings
    try {
      const userSettingsPath = path.join(process.cwd(), '.claude', 'settings.local.json');
      const userSettings = JSON.parse(await fs.readFile(userSettingsPath, 'utf8'));
      
      if (userSettings.workspacePermissions) {
        console.log(`🔐 Using user-specific workspace permissions for ${workspaceId}`);
        return userSettings.workspacePermissions;
      }
      
      // If user has Claude permissions, derive workspace permissions from them
      if (userSettings.permissions?.allow) {
        console.log(`🔐 Deriving workspace permissions from user Claude settings for ${workspaceId}`);
        return this.deriveWorkspacePermissionsFromClaudeSettings(userSettings.permissions);
      }
    } catch (error) {
      console.log(`⚠️ Could not load user settings, falling back to templates: ${error.message}`);
    }
    
    // PRIORITY 2: Use role-based templates from global config
    const config = await this.configManager.loadConfig();
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
      console.log(`🔐 Using template permissions (${roleTemplate}) for ${workspaceId}`);
      return this.convertPermissionSetToWorkspacePermissions(templatePermissions);
    }
    
    // PRIORITY 3: Fallback to hardcoded defaults
    console.log(`🔐 Using default permissions for ${workspaceId}`);
    return this.getDefaultPermissions();
  }
  private static deriveWorkspacePermissionsFromClaudeSettings(claudePermissions: any): WorkspacePermissions {
    const allowedCommands = claudePermissions.allow || [];
    
    // Parse Claude permissions to extract workspace permissions
    const bashCommands = allowedCommands
      .filter((perm: string) => perm.startsWith('Bash('))
      .map((perm: string) => perm.replace(/^Bash\(/, '').replace(/\)$/, '').replace(/:.*$/, ''));
    
    const gitCommands = bashCommands
      .filter((cmd: string) => cmd.startsWith('git '))
      .map((cmd: string) => cmd.replace('git ', ''));
    
    return {
      fileSystem: {
        read: ['**/*'], // Allow reading all files
        write: ['target/**', 'feedback/**', 'agents/**'], // Standard workspace areas
        execute: bashCommands.includes('chmod') ? ['target/**'] : []
      },
      git: {
        allowedOperations: ['diff', 'status', 'log', 'show', 'blame', ...gitCommands] as any[],
        protectedBranches: ['main', 'master', 'production'],
        requiresApproval: gitCommands.includes('push') ? [] : ['push']
      },
      external: {
        allowedHosts: ['api.github.com', 'api.openai.com', 'api.anthropic.com'],
        apiKeys: {}
      },
      commands: {
        allowed: bashCommands,
        requiresApproval: bashCommands.includes('rm') ? [] : ['rm', 'sudo'],
        forbidden: claudePermissions.deny || []
      },
      systemAccess: {
        canInstallPackages: bashCommands.some((cmd: string) => cmd.includes('install')),
        canModifyEnvironment: bashCommands.includes('export') || bashCommands.includes('chmod'),
        canAccessNetwork: bashCommands.includes('curl') || bashCommands.includes('wget'),
        maxResourceUsage: {
          memory: 2048,
          cpu: 80,
          disk: 5120
        }
      }
    };
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

  private static generateClaudeCodeSettings(workspaceId: string, context?: WorkspaceContext): any {
    // Generate Claude Code format settings with THREE-TIER permissions:
    // 1. BASE SECURITY (always enforced - workspace isolation & security)
    // 2. UI INTEGRATION (always enforced - limited UI state access for development workflow)
    // 3. CONFIGURABLE (user-customizable - workflow and role-based permissions)
    
    const projectType = context?.projectType || 'development';
    
    // Get default permissions to extract configurable tool permissions
    const defaultPermissions = this.getDefaultPermissions();
    
    const settings = {
      // Claude Code permissions format - this is the correct format
      permissions: {
        allow: [] as string[],
        deny: [] as string[]
      },
      
      // Additional metadata for our system
      metadata: {
        workspaceId,
        projectType,
        generated: new Date().toISOString(),
        description: 'Three-tier Claude Code permissions: Base Security + UI Integration + Configurable Workflow',
        permissionTiers: {
          baseSecurity: 'Always enforced - workspace isolation, filesystem security, dangerous operation blocking',
          uiIntegration: 'Always enforced - limited UI state access for development workflow (file open state, agent requests)',
          configurable: 'User customizable - workflow permissions, role-based access, project-specific tools'
        }
      }
    };

    // TIER 1: BASE SECURITY PERMISSIONS (Always enforced - cannot be overridden)
    const baseAllowList = this.getBaseSecurityPermissions();
    
    // TIER 2: CONFIGURABLE WORKFLOW PERMISSIONS (User customizable)
    const configurableAllowList = this.getConfigurablePermissions(projectType, defaultPermissions);
    
    // Combine both tiers
    const allowList: string[] = [...baseAllowList, ...configurableAllowList];

    // Core file operations - WORKSPACE ISOLATED ONLY
    allowList.push(
      // ONLY allow reading files within workspace directories
      'Read(context/**)',     // Context files
      'Read(target/**)',      // Target code files  
      'Read(feedback/**)',    // Feedback files
      'Read(agents/**)',      // Agent data
      'Read(*.md)',           // Documentation files in workspace root
      'Read(*.json)',         // Config files in workspace root
      'Read(*.yml)',          // YAML configs in workspace root
      'Read(*.yaml)',         // YAML configs in workspace root
      'Read(*.txt)',          // Text files in workspace root
      'Read(.gitignore)',     // Git ignore in workspace root
      'Read(CLAUDE.md)',      // Claude instructions
      'Read(README.md)',      // Readme in workspace root
      'Read(package.json)',   // Package info in workspace root
      'Read(tsconfig.json)',  // TypeScript config in workspace root
      'Read(commands.json)',  // Commands in workspace root
      'Read(permissions.json)' // Permissions in workspace root
    );

    // Claude Code specific tools - WORKSPACE ISOLATED ONLY
    allowList.push(
      // LS - only allow listing workspace directories
      'LS(.)',                // Current directory (workspace root)
      'LS(context)',          // Context directory
      'LS(context/**)',       // Context subdirectories
      'LS(target)',           // Target directory
      'LS(target/**)',        // Target subdirectories
      'LS(feedback)',         // Feedback directory
      'LS(feedback/**)',      // Feedback subdirectories
      'LS(agents)',           // Agents directory
      'LS(agents/**)',        // Agents subdirectories
      
      // Glob - only allow patterns within workspace
      'Glob(*.md)',           // Markdown files in root
      'Glob(*.json)',         // JSON files in root
      'Glob(context/**)',     // All context files
      'Glob(target/**)',      // All target files
      'Glob(feedback/**)',    // All feedback files
      'Glob(agents/**)',      // All agent files
      'Glob(target/**/*.ts)', // TypeScript in target
      'Glob(target/**/*.tsx)', // TypeScript React in target
      'Glob(target/**/*.js)', // JavaScript in target
      'Glob(target/**/*.jsx)', // JavaScript React in target
      'Glob(target/**/*.css)', // CSS in target
      'Glob(target/**/*.html)', // HTML in target
      'Glob(target/**/*.py)', // Python in target
      
      // Grep - only allow searching within workspace
      'Grep(*, context/**)',  // Search in context files
      'Grep(*, target/**)',   // Search in target files
      'Grep(*, feedback/**)', // Search in feedback files
      'Grep(*, agents/**)',   // Search in agent files
      'Grep(*, *.md)',        // Search in root markdown
      'Grep(*, *.json)',      // Search in root JSON
      
      // Safe tools
      'Task(*)',              // Task delegation tool
      'TodoRead',             // Todo list reading
      'TodoWrite',            // Todo list writing
      'WebFetch(*)',          // Web content fetching
      'WebSearch(*)',         // Web search tool
      'exit_plan_mode'        // Exit plan mode tool
    );

    // Edit permissions based on workspace type
    if (projectType === 'development' || projectType === 'general') {
      allowList.push(
        'Edit(target/**)',      // Can edit target code
        'Edit(feedback/**)',    // Can edit feedback
        'Edit(agents/**)',      // Can edit agent data
        'Edit(*.md)',           // Can edit documentation
        'Edit(CHANGELOG.md)',   // Can edit changelog
        'Edit(TODO.md)',        // Can edit todos
        'MultiEdit(target/**)', // Can make multiple edits to target files
        'Write(target/**)',     // Can write new target files
        'Write(feedback/**)',   // Can write new feedback files
        'Write(*.md)'           // Can write new documentation
      );
    } else if (projectType === 'review') {
      allowList.push(
        'Edit(feedback/**)',    // Can only edit feedback
        'Edit(agents/**)',      // Can edit agent data
        'Write(feedback/**)',   // Can write new feedback
        'MultiEdit(feedback/**)'// Can make multiple edits to feedback
      );
    } else if (projectType === 'analysis') {
      allowList.push(
        'Edit(feedback/**)',    // Can edit analysis results
        'Edit(agents/**)',      // Can edit agent data
        'Edit(analysis/**)',    // Can create analysis files
        'Write(analysis/**)',   // Can write new analysis files
        'Write(feedback/**)',   // Can write new feedback files
        'MultiEdit(analysis/**)'// Can make multiple edits to analysis
      );
    }

    // Add WORKSPACE-RESTRICTED bash commands
    if (defaultPermissions.commands.allowed.length > 0) {
      // Essential file and directory operations - WORKSPACE ONLY
      allowList.push(
        'Bash(ls)',             // List current dir (workspace root)
        'Bash(ls .)',           // List current dir explicitly
        'Bash(ls context)',     // List context directory
        'Bash(ls target)',      // List target directory
        'Bash(ls feedback)',    // List feedback directory
        'Bash(ls agents)',      // List agents directory
        'Bash(pwd)',            // Show current directory
        'Bash(tree .)',         // Tree view of workspace
        'Bash(tree context)',   // Tree view of context
        'Bash(tree target)',    // Tree view of target
        'Bash(tree feedback)',  // Tree view of feedback
        'Bash(tree agents)'     // Tree view of agents
      );

      // File viewing - WORKSPACE FILES ONLY
      allowList.push(
        'Bash(cat *.md)',       // Read markdown in root
        'Bash(cat *.json)',     // Read JSON in root
        'Bash(cat context/*)',  // Read context files
        'Bash(cat target/*)',   // Read target files
        'Bash(cat feedback/*)', // Read feedback files
        'Bash(cat agents/*)',   // Read agent files
        'Bash(head context/*)', // Head context files
        'Bash(head target/*)',  // Head target files
        'Bash(head feedback/*)', // Head feedback files
        'Bash(tail context/*)', // Tail context files
        'Bash(tail target/*)',  // Tail target files
        'Bash(tail feedback/*)', // Tail feedback files
        'Bash(file context/*)', // File type context files
        'Bash(file target/*)',  // File type target files
        'Bash(stat context/*)', // Stat context files
        'Bash(stat target/*)'   // Stat target files
      );

      // Search operations - WORKSPACE ONLY
      allowList.push(
        'Bash(find . -name *)',     // Find in workspace only
        'Bash(find context -name *)', // Find in context
        'Bash(find target -name *)',  // Find in target
        'Bash(find feedback -name *)', // Find in feedback
        'Bash(grep * context/*)',    // Grep context files
        'Bash(grep * target/*)',     // Grep target files
        'Bash(grep * feedback/*)',   // Grep feedback files
        'Bash(grep * *.md)',         // Grep root markdown
        'Bash(grep * *.json)'        // Grep root JSON
      );

      // Text processing - WORKSPACE FILES ONLY
      allowList.push(
        'Bash(wc context/*)',    // Word count context files
        'Bash(wc target/*)',     // Word count target files
        'Bash(wc feedback/*)',   // Word count feedback files
        'Bash(sort context/*)',  // Sort context files
        'Bash(sort target/*)',   // Sort target files
        'Bash(diff target/* target/*)', // Diff target files
        'Bash(diff context/* context/*)', // Diff context files
        'Bash(cmp target/* target/*)'     // Compare target files
      );

      // System information
      allowList.push(
        'Bash(ps)',
        'Bash(ps *)',
        'Bash(top)',
        'Bash(htop)',
        'Bash(whoami)',
        'Bash(id)',
        'Bash(date)',
        'Bash(cal)',
        'Bash(history)',
        'Bash(uname *)',
        'Bash(hostname)',
        'Bash(du *)',
        'Bash(df *)'
      );

      // Safe git operations
      allowList.push(
        'Bash(git status)',
        'Bash(git log *)',
        'Bash(git show *)',
        'Bash(git diff *)',
        'Bash(git blame *)',
        'Bash(git branch *)',
        'Bash(git remote *)',
        'Bash(git config *)'
      );

      // Development tools (read-only)
      allowList.push(
        'Bash(npm ls *)',
        'Bash(npm info *)',
        'Bash(npm view *)',
        'Bash(node --version)',
        'Bash(npm --version)',
        'Bash(python --version)',
        'Bash(python3 --version)',
        'Bash(pip list *)',
        'Bash(pip show *)'
      );

      // Output commands
      allowList.push(
        'Bash(echo *)',
        'Bash(printf *)'
      );
    }

    // Add the allow list to settings
    settings.permissions.allow = allowList;

    // Build combined deny list (base security + configurable)
    const baseDenyList = this.getBaseSecurityDenyList();
    const configurableDenyList = this.getConfigurableDenyList(defaultPermissions);
    const denyList = [...baseDenyList, ...configurableDenyList];
    
    settings.permissions.deny = denyList;

    return settings;
  }

  private static async generateClaudeCodeCommands(workspaceId: string, commands: UserCommand[]): Promise<void> {
    try {
      const workspacePath = this.getWorkspacePath(workspaceId);
      const commandsDir = path.join(workspacePath, '.claude', 'commands');
      
      // Create .claude/commands directory
      await fs.mkdir(commandsDir, { recursive: true });
      
      console.log(`📝 Generating Claude Code format commands in .claude/commands/`);
      
      // Generate markdown file for each command
      for (const command of commands) {
        const fileName = `${command.keyword}.md`;
        const filePath = path.join(commandsDir, fileName);
        
        // Convert our command format to Claude Code format
        let content = command.base_prompt;
        
        // Add context adaptations if they exist
        if (command.context_adaptations && Object.keys(command.context_adaptations).length > 0) {
          content += '\n\n## Context Adaptations\n';
          for (const [key, value] of Object.entries(command.context_adaptations)) {
            content += `\n**${key}**: ${value}`;
          }
        }
        
        // Add metadata as comments
        content += '\n\n<!-- Command Metadata\n';
        content += `Category: ${command.category}\n`;
        content += `Estimated Duration: ${command.estimated_duration}\n`;
        content += `Requires Approval: ${command.requires_approval ? 'Yes' : 'No'}\n`;
        if (command.follow_up_commands && command.follow_up_commands.length > 0) {
          content += `Follow-up Commands: ${command.follow_up_commands.join(', ')}\n`;
        }
        content += '-->\n';
        
        await fs.writeFile(filePath, content);
      }
      
      // Create a project commands index
      const indexPath = path.join(commandsDir, 'README.md');
      const indexContent = `# Workspace Commands

## Available Commands

${commands.map(cmd => `- **/${cmd.keyword}** - ${cmd.name}`).join('\n')}

## Usage

Type \`/\` in the Claude Code terminal to see available commands.

## Custom Arguments

Some commands support arguments using the \`$ARGUMENTS\` placeholder.

Example: \`/debug Error in user authentication\`
`;
      
      await fs.writeFile(indexPath, indexContent);
      console.log(`✅ Generated ${commands.length} Claude Code format commands`);
      
    } catch (error) {
      console.error('❌ Failed to generate Claude Code commands:', error);
      // Don't throw - this is optional functionality
    }
  }

  private static async processTemplate(template: string, variables: Record<string, string>): Promise<string> {
    let content = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      content = content.replace(new RegExp(placeholder, 'g'), value);
    }
    return content;
  }

  // ============================================================================
  // THREE-TIER PERMISSION SYSTEM
  // ============================================================================

  /**
   * TIER 1: BASE SECURITY PERMISSIONS
   * These are ALWAYS enforced and cannot be overridden by users.
   * They ensure workspace isolation and prevent security breaches.
   * Includes UI integration permissions for development workflow.
   */
  private static getBaseSecurityPermissions(): string[] {
    return [
      // CORE FILE OPERATIONS - Workspace isolated only
      'Read(context/**)',     // Context files
      'Read(target/**)',      // Target code files  
      'Read(feedback/**)',    // Feedback files
      'Read(agents/**)',      // Agent data
      'Read(*.md)',           // Documentation files in workspace root
      'Read(*.json)',         // Config files in workspace root
      'Read(*.yml)',          // YAML configs in workspace root
      'Read(*.yaml)',         // YAML configs in workspace root
      'Read(*.txt)',          // Text files in workspace root
      'Read(.gitignore)',     // Git ignore in workspace root
      'Read(CLAUDE.md)',      // Claude instructions
      'Read(README.md)',      // Readme in workspace root
      'Read(package.json)',   // Package info in workspace root
      'Read(tsconfig.json)',  // TypeScript config in workspace root
      'Read(commands.json)',  // Commands in workspace root
      'Read(permissions.json)', // Permissions in workspace root

      // ESSENTIAL TOOLS - Workspace isolated only
      'LS(.)',                // Current directory (workspace root)
      'LS(context)',          // Context directory
      'LS(context/**)',       // Context subdirectories
      'LS(target)',           // Target directory
      'LS(target/**)',        // Target subdirectories
      'LS(feedback)',         // Feedback directory
      'LS(feedback/**)',      // Feedback subdirectories
      'LS(agents)',           // Agents directory
      'LS(agents/**)',        // Agents subdirectories

      // PATTERN MATCHING - Workspace isolated only
      'Glob(*.md)',           // Markdown files in root
      'Glob(*.json)',         // JSON files in root
      'Glob(context/**)',     // All context files
      'Glob(target/**)',      // All target files
      'Glob(feedback/**)',    // All feedback files
      'Glob(agents/**)',      // All agent files

      // CONTENT SEARCH - Workspace isolated only
      'Grep(*, context/**)',  // Search in context files
      'Grep(*, target/**)',   // Search in target files
      'Grep(*, feedback/**)', // Search in feedback files
      'Grep(*, agents/**)',   // Search in agent files
      'Grep(*, *.md)',        // Search in root markdown
      'Grep(*, *.json)',      // Search in root JSON

      // SAFE TOOLS - Always allowed
      'Task(*)',              // Task delegation tool
      'TodoRead',             // Todo list reading
      'TodoWrite',            // Todo list writing
      'WebFetch(*)',          // Web content fetching
      'WebSearch(*)',         // Web search tool
      'exit_plan_mode',       // Exit plan mode tool

      // UI INTEGRATION - Limited workspace UI access for development workflow
      'Read(.editor-state.json)',      // Read current editor state (which file is open)
      'Read(.workspace-ui-state.json)', // Read UI state information
      'Write(.agent-requests.json)',   // Agent can request file to be opened for user
      'Edit(.agent-requests.json)',    // Agent can modify file open requests

      // ESSENTIAL BASH - Safe workspace operations only
      'Bash(pwd)',            // Show current directory
      'Bash(whoami)',         // Show current user
      'Bash(date)',           // Show current date
      'Bash(echo *)',         // Output commands
      'Bash(printf *)'        // Output commands
    ];
  }

  /**
   * TIER 2: CONFIGURABLE WORKFLOW PERMISSIONS
   * These can be customized by users based on project type and needs.
   * They enable different workflows while maintaining base security.
   */
  private static getConfigurablePermissions(projectType: string, defaultPermissions: any): string[] {
    const configurable: string[] = [];

    // File type specific read permissions
    configurable.push(
      'Glob(target/**/*.ts)',  // TypeScript in target
      'Glob(target/**/*.tsx)', // TypeScript React in target
      'Glob(target/**/*.js)',  // JavaScript in target
      'Glob(target/**/*.jsx)', // JavaScript React in target
      'Glob(target/**/*.css)', // CSS in target
      'Glob(target/**/*.html)', // HTML in target
      'Glob(target/**/*.py)',  // Python in target
    );

    // Edit permissions based on workspace type (CONFIGURABLE)
    if (projectType === 'development' || projectType === 'general') {
      configurable.push(
        'Edit(target/**)',      // Can edit target code
        'Edit(feedback/**)',    // Can edit feedback
        'Edit(agents/**)',      // Can edit agent data
        'Edit(*.md)',           // Can edit documentation
        'Edit(CHANGELOG.md)',   // Can edit changelog
        'Edit(TODO.md)',        // Can edit todos
        'MultiEdit(target/**)', // Can make multiple edits to target files
        'Write(target/**)',     // Can write new target files
        'Write(feedback/**)',   // Can write new feedback files
        'Write(*.md)'           // Can write new documentation
      );
    } else if (projectType === 'review') {
      configurable.push(
        'Edit(feedback/**)',    // Can only edit feedback
        'Edit(agents/**)',      // Can edit agent data
        'Write(feedback/**)',   // Can write new feedback
        'MultiEdit(feedback/**)' // Can make multiple edits to feedback
      );
    } else if (projectType === 'analysis') {
      configurable.push(
        'Edit(feedback/**)',    // Can edit analysis results
        'Edit(agents/**)',      // Can edit agent data
        'Edit(analysis/**)',    // Can create analysis files
        'Write(analysis/**)',   // Can write new analysis files
        'Write(feedback/**)',   // Can write new feedback files
        'MultiEdit(analysis/**)' // Can make multiple edits to analysis
      );
    }

    // Enhanced bash commands (CONFIGURABLE based on permissions)
    if (defaultPermissions.commands.allowed.length > 0) {
      // File operations
      configurable.push(
        'Bash(ls)',             // List current dir
        'Bash(ls .)',           // List current dir explicitly
        'Bash(ls context)',     // List context directory
        'Bash(ls target)',      // List target directory
        'Bash(ls feedback)',    // List feedback directory
        'Bash(ls agents)',      // List agents directory
        'Bash(tree .)',         // Tree view of workspace
        'Bash(tree context)',   // Tree view of context
        'Bash(tree target)',    // Tree view of target
        'Bash(tree feedback)',  // Tree view of feedback
        'Bash(tree agents)'     // Tree view of agents
      );

      // File content operations
      configurable.push(
        'Bash(cat *.md)',       // Read markdown in root
        'Bash(cat *.json)',     // Read JSON in root
        'Bash(cat context/*)',  // Read context files
        'Bash(cat target/*)',   // Read target files
        'Bash(cat feedback/*)', // Read feedback files
        'Bash(cat agents/*)',   // Read agent files
        'Bash(head context/*)', // Head context files
        'Bash(head target/*)',  // Head target files
        'Bash(head feedback/*)', // Head feedback files
        'Bash(tail context/*)', // Tail context files
        'Bash(tail target/*)',  // Tail target files
        'Bash(tail feedback/*)', // Tail feedback files
        'Bash(file context/*)', // File type context files
        'Bash(file target/*)',  // File type target files
        'Bash(stat context/*)', // Stat context files
        'Bash(stat target/*)'   // Stat target files
      );

      // Search operations
      configurable.push(
        'Bash(find . -name *)',     // Find in workspace only
        'Bash(find context -name *)', // Find in context
        'Bash(find target -name *)',  // Find in target
        'Bash(find feedback -name *)', // Find in feedback
        'Bash(grep * context/*)',    // Grep context files
        'Bash(grep * target/*)',     // Grep target files
        'Bash(grep * feedback/*)',   // Grep feedback files
        'Bash(grep * *.md)',         // Grep root markdown
        'Bash(grep * *.json)'        // Grep root JSON
      );

      // Text processing
      configurable.push(
        'Bash(wc context/*)',    // Word count context files
        'Bash(wc target/*)',     // Word count target files
        'Bash(wc feedback/*)',   // Word count feedback files
        'Bash(sort context/*)',  // Sort context files
        'Bash(sort target/*)',   // Sort target files
        'Bash(diff target/* target/*)', // Diff target files
        'Bash(diff context/* context/*)', // Diff context files
        'Bash(cmp target/* target/*)'     // Compare target files
      );

      // System information (CONFIGURABLE - users might want to disable)
      configurable.push(
        'Bash(ps)',
        'Bash(ps *)',
        'Bash(top)',
        'Bash(htop)',
        'Bash(id)',
        'Bash(cal)',
        'Bash(history)',
        'Bash(uname *)',
        'Bash(hostname)',
        'Bash(du *)',
        'Bash(df *)'
      );

      // Git operations (CONFIGURABLE - based on project needs)
      configurable.push(
        'Bash(git status)',
        'Bash(git diff *)',
        'Bash(git log *)',
        'Bash(git show *)',
        'Bash(git blame *)',
        'Bash(git add *)',
        'Bash(git commit *)',
        'Bash(git stash *)',
        'Bash(git branch *)',
        'Bash(git remote *)',
        'Bash(git config *)'
      );

      // Development tools (CONFIGURABLE - project specific)
      configurable.push(
        'Bash(npm ls *)',
        'Bash(npm info *)',
        'Bash(npm view *)',
        'Bash(node --version)',
        'Bash(npm --version)',
        'Bash(python --version)',
        'Bash(python3 --version)',
        'Bash(pip list *)',
        'Bash(pip show *)'
      );
    }

    return configurable;
  }

  /**
   * BASE SECURITY DENY LIST
   * These restrictions are ALWAYS enforced - they cannot be overridden.
   */
  private static getBaseSecurityDenyList(): string[] {
    return [
      // CRITICAL: Block access to parent directories and system paths
      'Read(../**)',          // Block parent directory access
      'Read(../../**)',       // Block grandparent access
      'Read(../../../**)',    // Block great-grandparent access
      'Read(/home/**)',       // Block home directory access
      'Read(/root/**)',       // Block root directory access
      'Read(/etc/**)',        // Block system config access
      'Read(/var/**)',        // Block var directory access
      'Read(/usr/**)',        // Block usr directory access
      'Read(/sys/**)',        // Block sys directory access
      'Read(/proc/**)',       // Block proc directory access
      'Read(/dev/**)',        // Block device access
      'Read(/tmp/**)',        // Block tmp access
      'LS(..)',               // Block parent directory listing
      'LS(../..)',            // Block grandparent listing
      'LS(/home)',            // Block home listing
      'LS(/root)',            // Block root listing
      'LS(/etc)',             // Block etc listing
      'LS(/var)',             // Block var listing
      'LS(/usr)',             // Block usr listing
      'Glob(../**)',          // Block parent glob patterns
      'Glob(/home/**)',       // Block home glob patterns
      'Glob(/root/**)',       // Block root glob patterns
      'Glob(/etc/**)',        // Block etc glob patterns
      'Grep(*, ../**)',       // Block parent grep
      'Grep(*, /home/**)',    // Block home grep
      'Grep(*, /root/**)',    // Block root grep
      'Grep(*, /etc/**)',     // Block etc grep
      
      // Block access to main Context Pipeline source
      'Read(**/src/**)',      // Block source code access
      'Read(**/node_modules/**)', // Block node_modules access
      'Read(**/.git/**)',     // Block git internals access
      'Read(**/Context-Pipeline/**)', // Block main project access
      'LS(**/src)',           // Block source listing
      'LS(**/node_modules)',  // Block node_modules listing
      'LS(**/.git)',          // Block git listing
      'Glob(**/src/**)',      // Block source glob
      'Glob(**/node_modules/**)', // Block node_modules glob
      'Glob(**/.git/**)',     // Block git glob
      'Grep(*, **/src/**)',   // Block source grep
      'Grep(*, **/node_modules/**)', // Block node_modules grep
      'Grep(*, **/.git/**)',  // Block git grep
      
      // Bash command restrictions for filesystem isolation
      'Bash(cd ..)',          // Block parent directory change
      'Bash(cd ../..)',       // Block grandparent change
      'Bash(cd /home)',       // Block home change
      'Bash(cd /root)',       // Block root change
      'Bash(cd /etc)',        // Block etc change
      'Bash(cd /var)',        // Block var change
      'Bash(cd /usr)',        // Block usr change
      'Bash(ls ..)',          // Block parent listing
      'Bash(ls ../..)',       // Block grandparent listing
      'Bash(ls /home)',       // Block home listing
      'Bash(ls /root)',       // Block root listing
      'Bash(ls /etc)',        // Block etc listing
      'Bash(find /home *)',   // Block home find
      'Bash(find /root *)',   // Block root find
      'Bash(find /etc *)',    // Block etc find
      'Bash(find .. *)',      // Block parent find
      'Bash(grep * ../**)',   // Block parent grep
      'Bash(grep * /home/**)', // Block home grep
      'Bash(grep * /root/**)', // Block root grep
      'Bash(cat ../**)',      // Block parent cat
      'Bash(cat /home/**)',   // Block home cat
      'Bash(cat /root/**)',   // Block root cat
      'Bash(cat /etc/**)',    // Block etc cat
      
      // CRITICAL: Dangerous operations (always forbidden)
      'Bash(rm *)',           // Block file deletion
      'Bash(rmdir *)',        // Block directory deletion
      'Bash(sudo *)',         // Block sudo access
      'Bash(su *)',           // Block user switching
      'Bash(passwd *)',       // Block password changes
      'Bash(shutdown *)',     // Block system shutdown
      'Bash(reboot *)',       // Block system reboot
      'Bash(chmod *)',        // Block permission changes
      'Bash(chown *)',        // Block ownership changes
    ];
  }

  /**
   * CONFIGURABLE DENY LIST
   * These can be customized based on project needs and security policies.
   */
  private static getConfigurableDenyList(defaultPermissions: any): string[] {
    const configurable: string[] = [
      // Sensitive file operations (configurable)
      'Edit(.env*)',
      'Edit(*.key)',
      'Edit(*.pem)',
      'Edit(node_modules/**)',
      'Edit(.git/**)',
    ];

    // Network operations (configurable based on project needs)
    if (!defaultPermissions.systemAccess?.canAccessNetwork) {
      configurable.push(
        'Bash(curl *)',
        'Bash(wget *)',
        'Bash(ssh *)',
        'Bash(scp *)',
        'Bash(rsync *)'
      );
    }

    return configurable;
  }
}
export default WorkspaceDocumentGenerator;