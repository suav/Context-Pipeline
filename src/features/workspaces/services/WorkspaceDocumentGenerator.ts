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
    // Generate Claude Code format settings with proper permissions
    const projectType = context?.projectType || 'development';
    
    // Get default permissions to extract tool permissions
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
        description: 'Auto-generated Claude Code permissions for Context Pipeline workspace'
      }
    };

    // Build allow list based on our default permissions
    const allowList: string[] = [];

    // Core file operations - always allowed
    allowList.push(
      'Read',                 // Read tool (no args)
      'Read(*)',              // Read tool (any file)
      'Read(**)',             // Read tool (recursive)
      'Read(context/**)',     // Context files
      'Read(target/**)',      // Target code files  
      'Read(feedback/**)',    // Feedback files
      'Read(agents/**)',      // Agent data
      'Read(*.md)',           // Documentation files
      'Read(*.json)',         // Config files
      'Read(*.yml)',          // YAML configs
      'Read(*.yaml)',         // YAML configs
      'Read(*.txt)',          // Text files
      'Read(*.ts)',           // TypeScript files
      'Read(*.tsx)',          // TypeScript React files
      'Read(*.js)',           // JavaScript files
      'Read(*.jsx)',          // JavaScript React files
      'Read(*.css)',          // CSS files
      'Read(*.html)',         // HTML files
      'Read(*.py)',           // Python files
      'Read(.gitignore)',     // Git ignore
      'Read(package.json)',   // Package info
      'Read(tsconfig.json)'   // TypeScript config
    );

    // Claude Code specific tools - essential for development
    allowList.push(
      'LS',                   // Directory listing tool (no args)
      'LS(*)',                // Directory listing tool (with args)
      'LS(**)',               // Directory listing tool (recursive)
      'Glob',                 // File pattern matching tool (no args)
      'Glob(*)',              // File pattern matching tool (with args)
      'Grep',                 // Content search tool (no args)
      'Grep(*)',              // Content search tool (with args)
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

    // Add safe bash commands - this is the key fix
    if (defaultPermissions.commands.allowed.length > 0) {
      // Essential file and directory operations
      allowList.push(
        'Bash(ls)',
        'Bash(ls *)',
        'Bash(dir)',
        'Bash(pwd)',
        'Bash(cd *)',
        'Bash(tree)',
        'Bash(tree *)'
      );

      // File viewing and content operations
      allowList.push(
        'Bash(cat *)',
        'Bash(head *)',
        'Bash(tail *)',
        'Bash(less *)',
        'Bash(more *)',
        'Bash(file *)',
        'Bash(stat *)'
      );

      // Search and find operations
      allowList.push(
        'Bash(find *)',
        'Bash(grep *)',
        'Bash(locate *)',
        'Bash(which *)',
        'Bash(whereis *)'
      );

      // Text processing
      allowList.push(
        'Bash(wc *)',
        'Bash(sort *)',
        'Bash(uniq *)',
        'Bash(cut *)',
        'Bash(awk *)',
        'Bash(sed *)',
        'Bash(diff *)',
        'Bash(cmp *)'
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

    // Build deny list for dangerous operations
    const denyList: string[] = [
      // Sensitive file operations
      'Edit(.env*)',
      'Edit(*.key)',
      'Edit(*.pem)',
      'Edit(node_modules/**)',
      'Edit(.git/**)',
      
      // Dangerous bash commands
      'Bash(rm *)',
      'Bash(rmdir *)',
      'Bash(sudo *)',
      'Bash(su *)',
      'Bash(passwd *)',
      'Bash(shutdown *)',
      'Bash(reboot *)',
      'Bash(chmod *)',
      'Bash(chown *)',
      
      // Network operations that could be risky
      'Bash(curl *)',
      'Bash(wget *)',
      'Bash(ssh *)',
      'Bash(scp *)',
      'Bash(rsync *)'
    ];

    // Remove network denials if network access is allowed
    if (defaultPermissions.systemAccess.canAccessNetwork) {
      // Keep curl/wget denied but allow other network tools
      const networkDenials = ['Bash(curl *)', 'Bash(wget *)'];
      settings.permissions.deny = denyList.filter(item => 
        networkDenials.includes(item) || !item.includes('ssh') && !item.includes('scp') && !item.includes('rsync')
      );
    } else {
      settings.permissions.deny = denyList;
    }

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
}
export default WorkspaceDocumentGenerator;