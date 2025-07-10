import { promises as fs } from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import WorkspaceDocumentGenerator from '@/features/workspaces/services/WorkspaceDocumentGenerator';
export interface WorkspaceContext {
  name: string;
  description: string;
  context_items: any[];
  target_summary: string;
  git_status?: { has_git: boolean };
  permissions?: any;
}
export interface AIResponse {
  content: string;
  metadata?: any;
}
export abstract class BaseAIService {
  protected workspaceBasePath: string;
  protected activeProcesses = new Set<ChildProcess>();
  constructor(workspaceBasePath: string) {
    this.workspaceBasePath = workspaceBasePath;
  }
  abstract getServiceName(): string;
  abstract checkAvailability(): Promise<boolean>;
  abstract processMessage(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: any[],
    workspaceId: string
  ): Promise<AIResponse>;
  abstract createStream(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: any[],
    workspaceId: string
  ): Promise<AsyncIterable<string>>;
  public async loadWorkspaceContext(workspaceId: string): Promise<WorkspaceContext> {
    const workspacePath = path.join(this.workspaceBasePath, workspaceId);
    let context: WorkspaceContext = {
      name: workspaceId,
      description: 'Development workspace',
      context_items: [],
      target_summary: 'No target information available'
    };
    try {
      // Load context manifest
      const contextPath = path.join(workspacePath, 'context', 'context-manifest.json');
      const contextData = await fs.readFile(contextPath, 'utf-8');
      const contextManifest = JSON.parse(contextData);
      context.name = contextManifest.name || workspaceId;
      context.description = contextManifest.description || 'Development workspace';
      context.context_items = contextManifest.context_items || [];
      // Load target summary
      try {
        const targetPath = path.join(workspacePath, 'target', 'summary.md');
        context.target_summary = await fs.readFile(targetPath, 'utf-8');
      } catch {
        context.target_summary = 'No target summary available';
      }
      // Load git status if available
      try {
        const gitStatusPath = path.join(workspacePath, 'target', '.git', 'HEAD');
        await fs.access(gitStatusPath);
        context.git_status = { has_git: true };
      } catch {
        context.git_status = { has_git: false };
      }
    } catch (error) {
      console.warn(`[${this.getServiceName()}] Could not load full workspace context:`, error);
    }
    // PERMISSION INJECTION SYSTEM
    try {
      // Check if workspace has permission files, if not generate them
      if (!await WorkspaceDocumentGenerator.workspaceHasPermissions(workspaceId)) {
        console.log(`🔐 Generating workspace permissions for ${workspaceId}`);
        const workspaceContext = {
          workspaceId,
          workspacePath,
          description: context.description,
          projectType: this.detectProjectType(context),
          gitInfo: context.git_status
        };
        await WorkspaceDocumentGenerator.generatePermissions(workspaceId, workspaceContext);
        await WorkspaceDocumentGenerator.generateClaudeMd(workspaceId, workspaceContext);
        await WorkspaceDocumentGenerator.generateCommands(workspaceId, workspaceContext);
        console.log(`✅ Workspace documents generated successfully for ${workspaceId}`);
      }
      // Load workspace permissions for context enhancement
      const permissions = await WorkspaceDocumentGenerator.loadWorkspacePermissions(workspaceId);
      context.permissions = permissions;
    } catch (error) {
      console.warn(`[${this.getServiceName()}] Permission injection failed:`, error);
      // Continue with default context if permission injection fails
    }
    return context;
  }
  public buildSystemPrompt(context: WorkspaceContext, agentId: string): string {
    return `You are an AI assistant helping with software development tasks in a workspace called "${context.name}".
IMPORTANT CONSTRAINTS:
- You are ONLY allowed to work within the current workspace directory
- You have access to 4 main folders: target/ (code), context/ (reference), feedback/ (user feedback), agents/ (agent data)
- NEVER attempt to access files outside the workspace
- Always use relative paths from the workspace root
WORKSPACE CONTEXT:
- Name: ${context.name}
- Description: ${context.description}
- Available Context Items: ${context.context_items.length}
- Git Repository: ${context.git_status?.has_git ? 'Yes' : 'No'}
TARGET SUMMARY:
${context.target_summary}
AVAILABLE CONTEXT:
${context.context_items.map((item, i) => `${i + 1}. ${item.title} (${item.type})`).join('\n')}
Your agent ID is: ${agentId}
You can save agent-specific data in: agents/${agentId}/
Be helpful, accurate, and focused on the development tasks at hand.`;
  }
  protected spawnProcess(
    command: string,
    args: string[],
    options: {
      cwd?: string;
      env?: NodeJS.ProcessEnv;
      timeout?: number;
    } = {}
  ): Promise<{ process: ChildProcess; cleanup: () => void }> {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: options.cwd,
        env: options.env || process.env
      });
      // Track active process
      this.activeProcesses.add(childProcess);
      const cleanup = () => {
        this.activeProcesses.delete(childProcess);
        if (!childProcess.killed) {
          try {
            childProcess.kill('SIGTERM');
            setTimeout(() => {
              if (!childProcess.killed) {
                childProcess.kill('SIGKILL');
              }
            }, 5000);
          } catch (error) {
            console.warn(`[${this.getServiceName()}] Process cleanup error:`, error);
          }
        }
      };
      // Set timeout if specified
      if (options.timeout) {
        setTimeout(() => {
          console.warn(`[${this.getServiceName()}] Process timeout reached`);
          cleanup();
          reject(new Error('Process timeout'));
        }, options.timeout);
      }
      childProcess.on('error', (error) => {
        cleanup();
        reject(error);
      });
      childProcess.on('spawn', () => {
        resolve({ process: childProcess, cleanup });
      });
    });
  }
  protected async* createFallbackStream(content: string): AsyncIterable<string> {
    const words = content.split(' ');
    for (let i = 0; i < words.length; i++) {
      yield words[i] + (i < words.length - 1 ? ' ' : '');
      await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for streaming effect
    }
  }
  protected generateIntelligentFallback(userMessage: string, conversationHistory: any[]): string {
    const recentContext = conversationHistory
      .slice(-3)
      .map(msg => `${msg.role}: ${msg.content.substring(0, 100)}...`)
      .join('\n');
    return `I understand you're asking: "${userMessage}"
Based on our conversation context:
${recentContext}
While I don't have access to the full AI capabilities right now, I can help you with:
• Code analysis and suggestions
• Debugging guidance
• Architecture recommendations
• Best practices
• Documentation review
The AI CLI tools are currently being configured. Please try again in a moment, or let me know how else I can assist with your development work.`;
  }
  private detectProjectType(context: WorkspaceContext): string {
    // Check if it's a review/analysis workspace based on context items
    const hasReviewContext = context.context_items.some(item => 
      item.type === 'code_review' || 
      item.title?.toLowerCase().includes('review') ||
      item.title?.toLowerCase().includes('analysis')
    );
    
    if (hasReviewContext) {
      return 'review';
    }
    
    // Check if it's an analysis workspace based on description
    const isAnalysis = context.description?.toLowerCase().includes('analysis') ||
                      context.description?.toLowerCase().includes('investigate');
    
    if (isAnalysis) {
      return 'analysis';
    }
    
    // Check if it's a development workspace (git repository)
    if (context.git_status?.has_git) {
      return 'development';
    }
    
    // Default to general workspace
    return 'general';
  }

  public cleanup(): void {
    console.log(`[${this.getServiceName()}] Cleaning up ${this.activeProcesses.size} active processes`);
    this.activeProcesses.forEach(process => {
      try {
        if (!process.killed) {
          process.kill('SIGTERM');
        }
      } catch (error) {
        console.warn(`[${this.getServiceName()}] Cleanup error:`, error);
      }
    });
    this.activeProcesses.clear();
  }
}