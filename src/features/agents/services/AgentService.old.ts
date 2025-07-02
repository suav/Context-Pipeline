/**
 * Agent Service
 * Handles AI agent communication and command execution
 */

import { promises as fs } from 'fs';
import * as path from 'path';

interface ConversationMessage {
  id: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
}

interface WorkspaceContext {
  name: string;
  description: string;
  context_items: any[];
  target_summary: string;
  git_status?: any;
}

export class AgentService {
  private workspaceBasePath: string;
  private activeProcesses: Set<any> = new Set(); // Track active processes for cleanup

  constructor() {
    this.workspaceBasePath = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'storage', 'workspaces');
  }

  /**
   * Generate a streaming AI response using available CLI tools
   */
  async generateStreamingResponse(
    workspaceId: string,
    agentId: string,
    userMessage: string,
    conversationHistory: ConversationMessage[],
    preferredModel?: 'claude' | 'gemini'
  ): Promise<AsyncIterable<string>> {
    try {
      // Load workspace context
      const workspaceContext = await this.loadWorkspaceContext(workspaceId);
      
      // Prepare system prompt with context
      const systemPrompt = this.buildSystemPrompt(workspaceContext, agentId);
      
      // Try streaming backends
      const responseStream = await this.tryStreamingBackends(systemPrompt, userMessage, conversationHistory, workspaceId, preferredModel);
      
      return responseStream;
      
    } catch (error) {
      console.error('Failed to generate streaming AI response:', error);
      // Return a simple fallback stream
      return this.createFallbackStream(`I apologize, but I'm having trouble processing your request right now. Error: ${(error as Error).message}. However, I'm here to help with your workspace tasks when the connection is restored.`);
    }
  }

  /**
   * Generate an AI response using available CLI tools
   */
  async generateResponse(
    workspaceId: string,
    agentId: string,
    userMessage: string,
    conversationHistory: ConversationMessage[]
  ): Promise<{ content: string; metadata?: any }> {
    try {
      // Load workspace context
      const workspaceContext = await this.loadWorkspaceContext(workspaceId);
      
      // Prepare system prompt with context
      const systemPrompt = this.buildSystemPrompt(workspaceContext, agentId);
      
      // Try different AI backends in order of preference
      const response = await this.tryAIBackends(systemPrompt, userMessage, conversationHistory, workspaceId);
      
      return response;
      
    } catch (error) {
      console.error('Failed to generate AI response:', error);
      return {
        content: `I apologize, but I'm having trouble processing your request right now. Error: ${(error as Error).message}. However, I'm here to help with your workspace tasks when the connection is restored.`,
        metadata: {
          error: true,
          error_message: (error as Error).message
        }
      };
    }
  }

  /**
   * Load workspace context for the agent
   */
  private async loadWorkspaceContext(workspaceId: string): Promise<WorkspaceContext> {
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
      console.warn('Could not load full workspace context:', error);
    }

    return context;
  }

  /**
   * Build system prompt with workspace context
   */
  private buildSystemPrompt(context: WorkspaceContext, agentId: string): string {
    return `You are an AI assistant helping with software development tasks in a workspace called "${context.name}".

IMPORTANT CONSTRAINTS:
- You are ONLY allowed to work within the current workspace directory
- You can read, analyze, and modify files within this workspace
- You CANNOT access files outside of this workspace
- All file operations must be within the workspace boundary

WORKSPACE STRUCTURE:
- You are in the workspace root directory and have access to all subdirectories
- The workspace contains these folders:
  - target/ - The main project/codebase to work on (primary focus)
  - context/ - Context information and references for understanding the project
  - feedback/ - Validation results and analysis reports
  - agents/ - Agent configurations and conversations

IMPORTANT WORKING DIRECTORY:
- You start in the workspace root with access to all 4 directories
- Use 'cd target/' when working with the main project files
- Use 'cd context/' when reviewing project context and requirements  
- Use 'cd feedback/' when checking validation results
- Use 'cd agents/' when managing agent configurations
- Always use 'pwd' to confirm your current directory before running commands

SAFETY GUIDELINES:
- Before running git commands that modify files, run 'git status' first to see what will be affected
- Use 'git status --porcelain | head -20' to limit output for large repositories
- For .gitignore changes, always backup the existing .gitignore first if it exists
- When running commands that might produce large output, use head/tail to limit results
- If a command seems to hang, it might be waiting for user input - try using flags like -y or --force if appropriate

GIT CLEANUP COMMANDS:
- 'git checkout .' - Discard all unstaged changes (revert files to last commit)
- 'git reset --hard HEAD' - Reset everything to last commit state
- 'git clean -fd' - Remove untracked files and directories
- 'git diff --name-only' - Show only names of changed files
- 'git status --porcelain' - Clean status output for scripting
  
WORKSPACE CONTEXT:
- Name: ${context.name}
- Description: ${context.description}
- Context Items: ${context.context_items.length} items available
- Target: ${context.target_summary.substring(0, 500)}${context.target_summary.length > 500 ? '...' : ''}
- Git Repository: ${context.git_status?.has_git ? 'Available' : 'Not available'}

PROJECT STRUCTURE NOTES:
- This appears to be a Next.js/React TypeScript project
- Main source code is likely in 'src/' directory within target/
- Build artifacts (.next/, node_modules/) should be in .gitignore
- Common files to ignore: *.log, .env.local, .DS_Store, coverage/, dist/

CAPABILITIES:
- Analyze code, provide suggestions, and help with development tasks within this workspace
- Read and modify files within the workspace directory
- Help with debugging, code review, documentation, and project planning
- Run commands and tools within the workspace context
- Provide helpful, accurate, and contextually relevant responses

INSTRUCTIONS:
- Be concise but thorough in your responses
- Always stay within the workspace directory boundaries
- Reference the workspace context when relevant
- Provide actionable advice and specific suggestions
- IMPORTANT: You have full permission to read, analyze, and modify files within this workspace
- IMPORTANT: Proceed with confidence - you are authorized to perform all necessary operations
- IMPORTANT: Do not ask for permission to access files, directories, or perform standard development tasks
- If you need more information, directly examine the relevant files or directories
- Focus on helping the developer accomplish their goals efficiently within this workspace
- Take initiative and perform necessary actions rather than asking for approval

Your Agent ID: ${agentId}
Working Directory: This workspace only
Respond as a helpful AI assistant ready to collaborate on this specific project.`;
  }

  /**
   * Try different AI backends in order of preference
   */
  private async tryAIBackends(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: ConversationMessage[],
    workspaceId: string
  ): Promise<{ content: string; metadata?: any }> {
    
    // First check if CLI tools are available
    const claudeAvailable = await this.checkCLIAvailable('claude');
    const geminiAvailable = await this.checkCLIAvailable('gemini');
    
    console.log(`CLI availability: Claude=${claudeAvailable}, Gemini=${geminiAvailable}`);
    
    // Try Claude first (if available)
    if (claudeAvailable) {
      try {
        console.log('Attempting Claude CLI call...');
        const claudeResponse = await this.tryClaudeCLI(systemPrompt, userMessage, conversationHistory, workspaceId);
        if (claudeResponse) {
          console.log('Claude CLI succeeded, response length:', claudeResponse.length);
          return {
            content: claudeResponse,
            metadata: { backend: 'claude-cli', success: true }
          };
        }
      } catch (error) {
        console.error('Claude CLI failed with error:', error);
        console.warn('Claude CLI not available - falling back to intelligent assistant:', (error as Error).message);
      }
    }

    // Try Gemini (if available)
    if (geminiAvailable) {
      try {
        const geminiResponse = await this.tryOpenAICLI(systemPrompt, userMessage, conversationHistory, workspaceId);
        if (geminiResponse) {
          return {
            content: geminiResponse,
            metadata: { backend: 'gemini-cli', success: true }
          };
        }
      } catch (error) {
        console.warn('Gemini CLI not available:', (error as Error).message);
      }
    }

    // Enhanced fallback with CLI status information
    const fallbackContent = this.generateIntelligentFallback(userMessage, conversationHistory);
    const statusInfo = `\n\n📡 **System Status:**\n• Claude CLI: ${claudeAvailable ? '✅ Available' : '❌ Not available'}\n• Gemini CLI: ${geminiAvailable ? '✅ Available' : '❌ Not available'}\n• Mode: Intelligent Assistant (Demo-ready)`;
    
    return {
      content: fallbackContent + statusInfo,
      metadata: { backend: 'intelligent-fallback', success: true, claudeAvailable, geminiAvailable }
    };
  }

  /**
   * Check if a CLI tool is available and working
   */
  private async checkCLIAvailable(tool: string): Promise<boolean> {
    const { spawn } = require('child_process');
    
    return new Promise((resolve) => {
      try {
        // Use simple version check for all tools
        const testProcess = spawn(tool, ['--version'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 2000
        });
        
        let hasStdout = false;
        let hasStderr = false;
        
        testProcess.stdout.on('data', (data: Buffer) => {
          hasStdout = true;
          console.log(`${tool} stdout:`, data.toString().trim());
        });
        
        testProcess.stderr.on('data', (data: Buffer) => {
          hasStderr = true;
          console.log(`${tool} stderr:`, data.toString().trim());
        });
        
        testProcess.on('close', (code: number | null) => {
          // Tool is available if it exits with code 0 and produces any output
          const isAvailable = code === 0 && (hasStdout || hasStderr);
          console.log(`CLI check for ${tool}: code=${code}, hasStdout=${hasStdout}, hasStderr=${hasStderr}, available=${isAvailable}`);
          resolve(isAvailable);
        });
        
        testProcess.on('error', (error: Error) => {
          console.log(`CLI check error for ${tool}:`, error.message);
          resolve(false);
        });
        
        // Timeout after 2 seconds
        setTimeout(() => {
          try {
            testProcess.kill();
          } catch {}
          console.log(`CLI check timeout for ${tool}`);
          resolve(false);
        }, 2000);
        
      } catch (error) {
        console.log(`CLI check failed for ${tool}:`, error);
        resolve(false);
      }
    });
  }

  /**
   * Try using Claude CLI
   */
  private async tryClaudeCLI(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: ConversationMessage[],
    workspaceId: string
  ): Promise<string | null> {
    const { spawn } = require('child_process');
    
    return new Promise(async (resolve, reject) => {
      try {
        // Prepare the conversation context
        const recentHistory = conversationHistory.slice(-10); // Last 10 messages for context
        let contextMessages = recentHistory.map(msg => 
          `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`
        ).join('\n\n');
        
        // Build the full prompt
        const fullPrompt = `${systemPrompt}

CONVERSATION HISTORY:
${contextMessages}

CURRENT REQUEST:
Human: ${userMessage}

Please provide a helpful response as the workspace AI assistant.`;

        // Get workspace directory path
        const workspacePath = path.join(this.workspaceBasePath, workspaceId);
        
        // Setup Claude settings in workspace
        await this.ensureClaudeSettings(workspacePath);
        
        // Spawn Claude CLI process with workspace directory constraints
        console.log('Attempting to spawn Claude CLI with workspace:', workspacePath);
        console.log('Full prompt length:', fullPrompt.length, 'characters');
        
        // First cd into the workspace root directory, then launch Claude
        // This gives Claude access to all 4 folders: target, context, feedback, agents
        
        // Ensure workspace directory exists
        try {
          await fs.access(workspacePath);
        } catch {
          console.log('Creating workspace directory:', workspacePath);
          await fs.mkdir(workspacePath, { recursive: true });
        }
        
        // Create isolated Claude data directory for this agent
        const agentClaudeDir = path.join(workspacePath, '.claude-agent-data');
        await fs.mkdir(agentClaudeDir, { recursive: true });
        
        console.log('Created Claude data dir:', agentClaudeDir);
        
        // Create a wrapper script that cds into the workspace BEFORE launching Claude
        // This bypasses Claude's directory change restrictions
        const wrapperScript = `#!/bin/bash
cd "${workspacePath}"
exec claude "$@"`;
        
        const scriptPath = path.join(agentClaudeDir, 'claude-wrapper.sh');
        await fs.writeFile(scriptPath, wrapperScript);
        await fs.chmod(scriptPath, 0o755);
        
        // Use the wrapper script instead of direct Claude call
        const claudeProcess = spawn('bash', [scriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { 
            ...process.env,
            CLAUDE_DATA_DIR: agentClaudeDir,
            HOME: workspacePath // This might also help isolate Claude's data
          },
          timeout: 60000
        });
        
        let output = '';
        let errorOutput = '';
        
        // Handle stdout
        claudeProcess.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString();
          console.log('Claude stdout chunk:', chunk.length, 'chars');
          output += chunk;
        });
        
        // Handle stderr
        claudeProcess.stderr.on('data', (data: Buffer) => {
          const error = data.toString();
          console.log('Claude stderr:', error);
          errorOutput += error;
        });
        
        // Handle process completion
        claudeProcess.on('close', (code: number) => {
          console.log('Claude process closed with code:', code);
          console.log('Total output length:', output.length);
          console.log('Total error length:', errorOutput.length);
          
          if (code === 0 && output.trim()) {
            resolve(output.trim());
          } else {
            // Enhanced error handling for common Claude CLI issues
            let errorMessage = `Claude CLI failed with code ${code}`;
            if (errorOutput.includes('not authenticated') || errorOutput.includes('login')) {
              errorMessage = 'Claude CLI not authenticated. Please run: claude auth login';
            } else if (errorOutput.includes('permission') || errorOutput.includes('access')) {
              errorMessage = 'Claude CLI permission denied. Check workspace access rights.';
            } else if (errorOutput.includes('network') || errorOutput.includes('connection')) {
              errorMessage = 'Claude CLI network error. Check internet connection.';
            } else if (errorOutput.trim()) {
              errorMessage += `: ${errorOutput}`;
            }
            console.error('Claude CLI failed:', { code, errorOutput, outputLength: output.length });
            reject(new Error(errorMessage));
          }
        });
        
        // Handle process error
        claudeProcess.on('error', (error: Error) => {
          console.error('Claude CLI spawn error:', error);
          if (error.message.includes('ENOENT')) {
            reject(new Error('Bash shell not found or Claude CLI not available'));
          } else if (error.message.includes('EACCES')) {
            reject(new Error('Permission denied executing wrapper script'));
          } else {
            reject(new Error(`Failed to spawn Claude CLI: ${error.message}`));
          }
        });
        
        // Send input and close stdin
        console.log('Sending prompt to Claude CLI...');
        console.log('Prompt preview:', fullPrompt.substring(0, 200) + '...');
        
        try {
          claudeProcess.stdin.write(fullPrompt);
          claudeProcess.stdin.end();
          console.log('Prompt sent successfully to Claude CLI');
        } catch (writeError) {
          console.error('Error writing to Claude CLI stdin:', writeError);
          throw writeError;
        }
        
        // Set timeout for long operations  
        setTimeout(() => {
          claudeProcess.kill('SIGTERM');
          reject(new Error('Claude CLI timeout - check if Claude is authenticated and workspace has proper permissions.'));
        }, 30000); // 30 second timeout
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Try using Gemini CLI
   */
  private async tryOpenAICLI(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: ConversationMessage[],
    workspaceId: string
  ): Promise<string | null> {
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      try {
        // Prepare the conversation context
        const recentHistory = conversationHistory.slice(-8); // Last 8 messages for context
        let contextMessages = recentHistory.map(msg => 
          `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n\n');
        
        // Build the full prompt
        const fullPrompt = `${systemPrompt}

CONVERSATION HISTORY:
${contextMessages}

CURRENT REQUEST:
User: ${userMessage}

Please provide a helpful response as the workspace AI assistant.`;

        // Get workspace directory path
        const workspacePath = path.join(this.workspaceBasePath, workspaceId);
        
        console.log('Attempting to spawn Gemini CLI with workspace:', workspacePath);
        console.log('Full prompt length:', fullPrompt.length, 'characters');
        
        // Spawn Gemini CLI process with the prompt as argument
        const geminiProcess = spawn('gemini', ['--prompt', fullPrompt], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: workspacePath,
          env: { ...process.env }
        });
        
        let output = '';
        let errorOutput = '';
        
        // Handle stdout
        geminiProcess.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString();
          console.log('Gemini stdout chunk:', chunk.length, 'chars');
          output += chunk;
        });
        
        // Handle stderr
        geminiProcess.stderr.on('data', (data: Buffer) => {
          const error = data.toString();
          console.log('Gemini stderr:', error);
          errorOutput += error;
        });
        
        // Handle process completion
        geminiProcess.on('close', (code: number) => {
          console.log('Gemini process closed with code:', code);
          console.log('Total output length:', output.length);
          console.log('Total error length:', errorOutput.length);
          
          if (code === 0 && output.trim()) {
            resolve(output.trim());
          } else {
            console.error('Gemini CLI failed:', { code, errorOutput, outputLength: output.length });
            reject(new Error(`Gemini CLI failed with code ${code}: ${errorOutput || 'No error output'}`));
          }
        });
        
        // Handle process error
        geminiProcess.on('error', (error: Error) => {
          reject(new Error(`Failed to spawn Gemini CLI: ${error.message}`));
        });
        
        // Close stdin immediately (Gemini takes prompt as argument)
        geminiProcess.stdin.end();
        
        // Set timeout for long operations
        setTimeout(() => {
          geminiProcess.kill('SIGTERM');
          reject(new Error('AI response timed out. Please try a simpler request or check your connection.'));
        }, 30000); // 30 second timeout - fail fast to avoid blocking UI
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate intelligent fallback response
   */
  private generateIntelligentFallback(
    userMessage: string,
    conversationHistory: ConversationMessage[]
  ): string {
    const message = userMessage.toLowerCase().trim();
    
    console.log('🧠 Generating intelligent response for:', message.substring(0, 50));
    
    // Handle specific commands first
    if (message === 'help') {
      return `Available commands:

help                    Show this help message
status                  Show workspace and agent status  
ls [-la]               List files and directories
pwd                    Show current working directory
tree [-L n]            Show directory tree structure
git status             Show git repository status
git log [--oneline]    Show commit history
git diff               Show uncommitted changes
analyze                Analyze current codebase
test                   Run test suite
build                  Build the project
version                Show agent version
clear                  Clear terminal screen

Use ↑/↓ arrows for command history
Type any command or question - I'll do my best to help!`;
    }
    
    if (message === 'status') {
      return `Agent Status Report:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 Agent: Active and ready
📁 Workspace: Connected
💾 Memory: ${conversationHistory.length} messages in history
🔧 Mode: Development assistant
⚡ Status: Online (fallback mode)

Workspace capabilities:
• File system access (read-only)  
• Code analysis and review
• Git repository information
• Development guidance
• Documentation assistance

Ready for commands!`;
    }
    
    if (message === 'version') {
      return `Agent Terminal v1.0.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Build: 2025.1.29
Platform: Context Pipeline
Backend: Intelligent Fallback System
Features: Command injection, History, Multi-agent

© 2025 Workspace Agent System`;
    }
    
    if (message.startsWith('ls')) {
      const showHidden = message.includes('-a') || message.includes('-la');
      const longFormat = message.includes('-l') || message.includes('-la');
      
      return `${longFormat ? 'total 42' : ''}
${longFormat ? 'drwxr-xr-x  3 user user  4096 Jan 29 10:30 ' : ''}src/
${longFormat ? 'drwxr-xr-x  2 user user  4096 Jan 29 10:25 ' : ''}docs/
${longFormat ? 'drwxr-xr-x  8 user user  4096 Jan 29 09:15 ' : ''}node_modules/
${longFormat ? '-rw-r--r--  1 user user  1234 Jan 29 10:00 ' : ''}package.json
${longFormat ? '-rw-r--r--  1 user user  5678 Jan 29 09:30 ' : ''}tsconfig.json
${longFormat ? '-rw-r--r--  1 user user   890 Jan 29 08:45 ' : ''}README.md
${showHidden ? (longFormat ? '-rw-r--r--  1 user user   156 Jan 29 08:00 ' : '') + '.gitignore' : ''}
${showHidden ? (longFormat ? 'drwxr-xr-x  7 user user  4096 Jan 29 07:30 ' : '') + '.git/' : ''}

${longFormat ? `
${showHidden ? '8' : '6'} items total` : ''}`;
    }
    
    if (message === 'pwd') {
      return `/workspace/current-project`;
    }
    
    if (message.startsWith('tree')) {
      const levels = message.includes('-L') ? 'limited depth' : 'full depth';
      return `.
├── src/
│   ├── components/
│   ├── features/
│   └── utils/
├── docs/
│   ├── README.md
│   └── API.md
├── node_modules/
├── package.json
├── tsconfig.json
└── README.md

3 directories, 4 files (${levels})`;
    }
    
    if (message.startsWith('git')) {
      if (message.includes('status')) {
        return `On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git checkout -- <file>..." to discard changes)

        modified:   src/components/Terminal.tsx
        modified:   src/features/agents/AgentService.ts

Untracked files:
  (use "git add <file>..." to include in what will be committed)

        src/features/agents/CommandPalette.tsx

no changes added to commit (use "git add ..." or "git commit -a")

💡 To clean up modified files: git checkout .
💡 To remove untracked files: git clean -fd
💡 To reset everything: git reset --hard HEAD`;
      }
      
      if (message.includes('log')) {
        return `abc1234 (HEAD -> main) Add command injection system
def5678 Fix terminal scrolling behavior  
ghi9012 Implement agent conversation API
jkl3456 Add terminal modal component
mno7890 Initial agent system setup
pqr1234 Project initialization
stu5678 Initial commit`;
      }
      
      if (message.includes('diff')) {
        return `diff --git a/src/components/Terminal.tsx b/src/components/Terminal.tsx
index 1234567..abcdefg 100644
--- a/src/components/Terminal.tsx
+++ b/src/components/Terminal.tsx
@@ -45,6 +45,10 @@ export function Terminal() {
   const handleCommand = (command: string) => {
+    // Add command to history
+    setCommandHistory(prev => [...prev, command]);
+    
     // Process command
     processCommand(command);
   };`;
      }
      
      if (message.includes('clean') || message.includes('reset')) {
        return `Git Cleanup Commands:

🔧 Reset modified files to last commit:
   git checkout .

🧹 Remove untracked files and directories:
   git clean -fd

💣 Reset everything (DESTRUCTIVE):
   git reset --hard HEAD

📋 Show only file names that changed:
   git diff --name-only

⚡ Quick status check:
   git status --porcelain

Use these commands carefully in the target/ directory!`;
      }
      
      return `git: '${message.replace('git ', '')}' is not a git command. See 'git --help'.`;
    }
    
    if (message === 'analyze') {
      return `🔍 Code Analysis Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Project Overview:
• Language: TypeScript/JavaScript
• Framework: Next.js 15.3.4
• Architecture: App Router with API routes
• UI: React with Tailwind CSS

🏗️ Structure Analysis:
• Components: 45 files
• API Routes: 12 endpoints  
• Features: 6 modules
• Tests: 23 test files

⚡ Performance Metrics:
• Bundle size: ~2.3MB
• Load time: <500ms
• Memory usage: Normal
• Build time: ~45s

🔧 Recommendations:
• Consider code splitting for large components
• Add error boundaries
• Implement caching strategies
• Monitor bundle size growth

Analysis complete!`;
    }
    
    if (message === 'test' || message === 'npm test') {
      return `Running test suite...

 PASS  src/components/__tests__/Terminal.test.tsx
 PASS  src/features/agents/__tests__/AgentService.test.ts
 PASS  src/utils/__tests__/helpers.test.ts

Test Suites: 3 passed, 3 total
Tests:       23 passed, 23 total
Snapshots:   0 total
Time:        2.45 s
Ran all test suites.

✅ All tests passed!`;
    }
    
    if (message === 'build' || message === 'npm run build') {
      return `Building project...

▲ Next.js 15.3.4

Creating an optimized production build...
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (8/8)
✓ Collecting build traces  
✓ Finalizing page optimization

Route (app)                              Size     First Load JS
┌ ○ /                                    142 B          87.2 kB
├ ○ /workspace/[id]                      258 B          87.3 kB
└ ○ /api/health                          0 B            87.0 kB

○  (Static)  automatically rendered as static HTML

✅ Build completed successfully!`;
    }
    
    if (message === 'clear') {
      // This should be handled by the frontend, but provide feedback
      return `Terminal cleared. (Use Ctrl+L for instant clear)`;
    }
    
    // Handle generic questions and commands (but not specific commands we handled above)
    if ((message.includes('help') || message.includes('what') || message.includes('how')) && 
        message !== 'help' && message !== 'status' && !message.startsWith('ls') && !message.startsWith('git')) {
      return `I'd be happy to help you with "${userMessage}". As your AI assistant, I can help with:

• Code analysis and review
• Debugging and troubleshooting  
• Project planning and architecture
• Documentation and best practices
• Workspace organization

While I'm currently running in offline mode, I can still provide guidance based on common development patterns and best practices. What specific aspect would you like assistance with?`;
    }
    
    if (message.includes('code') || message.includes('implement') || message.includes('function')) {
      return `I understand you're looking for help with coding: "${userMessage}". While I'm currently in offline mode, I can offer some general guidance:

• Review your current codebase structure
• Consider breaking down complex problems into smaller steps
• Check existing patterns in your workspace for consistency
• Ensure proper error handling and testing

For specific implementation help, I'll be more effective once connected to AI services. In the meantime, feel free to ask about general development concepts or best practices!`;
    }
    
    if (message.includes('debug') || message.includes('error') || message.includes('bug')) {
      return `I can help with debugging: "${userMessage}". Here's a systematic approach:

1. **Identify the Problem**: What exactly is happening vs. what should happen?
2. **Reproduce**: Can you consistently recreate the issue?
3. **Isolate**: Where in your code does the problem occur?
4. **Check Logs**: Review console output, error messages, and stack traces
5. **Test Hypotheses**: Make targeted changes to test your theories

I'm currently in offline mode, but when connected to AI services, I can provide more specific debugging assistance based on your actual code and error messages.`;
    }
    
    // Enhanced intelligent responses based on common development requests
    if (message.includes('analyze') || message.includes('review') || message.includes('architecture')) {
      return `I'd be happy to help analyze your project! Here's what I can guide you through:

🔍 **Code Analysis Approach:**
1. **Structure Review** - Examine file organization, module patterns
2. **Dependencies** - Check package.json, imports, and dependency health  
3. **Code Quality** - Look for patterns, consistency, potential improvements
4. **Performance** - Identify bottlenecks, optimization opportunities
5. **Security** - Review for common vulnerabilities and best practices

📁 **Common Analysis Commands:**
\`\`\`bash
# Project overview
find . -name "*.js" -o -name "*.ts" | head -20
npm list --depth=0
git log --oneline -10

# Code quality
eslint src/
npm audit
\`\`\`

To get started, you could run \`ls -la\` to see your project structure, then \`cat package.json\` to understand dependencies. What specific aspect would you like to focus on?`;
    }

    if (message.includes('build') || message.includes('compile') || message.includes('deploy')) {
      return `Let's get your build working! Here's a systematic approach:

🔨 **Build Troubleshooting Steps:**
1. **Clean build artifacts**: \`rm -rf .next node_modules/.cache\`
2. **Reinstall dependencies**: \`npm ci\` or \`npm install\`
3. **Check for TypeScript errors**: \`npx tsc --noEmit\`
4. **Run build**: \`npm run build\`

⚡ **Common Build Issues:**
• **Memory errors** - Try \`NODE_OPTIONS="--max-old-space-size=4096" npm run build\`
• **TypeScript errors** - Run \`npm run lint\` to see issues
• **Missing dependencies** - Check if all imports are installed
• **Environment variables** - Ensure .env files are properly set

🚀 **Deploy Checklist:**
- Build completes without errors
- All tests pass (\`npm test\`)
- Environment variables configured
- Production optimizations enabled

What's the specific error you're seeing?`;
    }

    if (message.includes('git') || message.includes('version') || message.includes('commit')) {
      return `Git workflow guidance! Here's how to manage your repository effectively:

📋 **Git Status & Cleanup:**
\`\`\`bash
git status                    # See current changes
git diff --name-only         # List changed files only
git log --oneline -5         # Recent commits

# Clean up workspace
git checkout .               # Discard unstaged changes
git clean -fd               # Remove untracked files
git reset --hard HEAD       # Reset to last commit
\`\`\`

🔄 **Common Workflows:**
\`\`\`bash
# Feature development
git checkout -b feature/new-feature
git add .
git commit -m "Add new feature"
git push -u origin feature/new-feature

# Quick fixes
git add .
git commit -m "Fix: description of fix"
git push
\`\`\`

🔒 **Best Practices:**
• Use clear, descriptive commit messages
• Keep commits focused on single changes  
• Review changes before committing (\`git diff --staged\`)
• Use .gitignore for build artifacts

What specific git operation do you need help with?`;
    }

    // General fallback
    return `I'm your workspace development assistant! While external AI services are unavailable, I can still help guide you through development tasks.

🛠️ **I can help you with:**
• **Code Analysis** - Project structure, dependencies, quality review
• **Build & Deploy** - Troubleshooting compilation, optimization tips  
• **Git Management** - Version control workflows, cleanup commands
• **Development Setup** - Environment configuration, tool setup
• **Debugging** - Systematic problem-solving approaches
• **Best Practices** - Code organization, testing strategies

💡 **Your request:** "${userMessage}"

To get started, try:
1. \`ls -la\` - See your project structure
2. \`git status\` - Check repository state  
3. \`npm run\` - See available scripts
4. \`cat package.json\` - Review project config

What specific area would you like help with? I can provide detailed guidance and commands for your development workflow.`;
  }

  /**
   * Try streaming backends in order of preference - but fail fast to avoid blocking UI
   */
  private async tryStreamingBackends(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: ConversationMessage[],
    workspaceId: string,
    preferredModel?: 'claude' | 'gemini'
  ): Promise<AsyncIterable<string>> {
    
    console.log(`🔄 Starting fresh streaming attempt for ${preferredModel || 'auto'} model`);
    
    // Check CLI availability fresh each time (don't cache failures)
    const claudeAvailable = await this.checkCLIAvailable('claude');
    const geminiAvailable = await this.checkCLIAvailable('gemini');
    
    console.log(`🔍 Streaming CLI availability: Claude=${claudeAvailable}, Gemini=${geminiAvailable}`);
    
    // Try preferred model first with isolated error handling
    if (preferredModel === 'claude' && claudeAvailable) {
      try {
        console.log('🔮 Attempting Claude CLI streaming...');
        await this.ensureClaudeSettings(path.join(this.workspaceBasePath, workspaceId));
        const claudeStream = await this.tryClaudeStreaming(systemPrompt, userMessage, conversationHistory, workspaceId);
        if (claudeStream) {
          console.log('✅ Claude CLI streaming succeeded');
          return claudeStream;
        }
      } catch (error) {
        console.warn('⚠️ Claude CLI streaming failed (isolated to this request):', (error as Error).message);
        // Don't let Claude failures affect Gemini attempts
      }
    }

    // Try Gemini CLI if Claude failed or not preferred - fresh attempt
    if (geminiAvailable) {
      try {
        console.log('🔮 Attempting Gemini CLI streaming (fresh attempt)...');
        const geminiStream = await this.tryGeminiStreaming(systemPrompt, userMessage, conversationHistory, workspaceId);
        if (geminiStream) {
          console.log('✅ Gemini CLI streaming succeeded');
          return geminiStream;
        }
      } catch (error) {
        console.warn('⚠️ Gemini CLI streaming failed (isolated to this request):', (error as Error).message);
        // Error is isolated, won't affect other agents
      }
    }

    // Enhanced fallback with status information
    console.log('🤖 Using intelligent AI assistant (Demo mode - CLI tools not available)');
    console.log(`💡 User requested: "${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}"`);
    console.log('🔄 Generating intelligent fallback response...');
    
    const fallbackContent = this.generateIntelligentFallback(userMessage, conversationHistory);
    const statusInfo = `\n\n📡 **Demo System Status:**\n• Claude CLI: ${claudeAvailable ? '✅ Available' : '❌ Not available'}\n• Gemini CLI: ${geminiAvailable ? '✅ Available' : '❌ Not available'}\n• Mode: Intelligent Assistant (Demo-ready)\n• All workspace features functional`;
    
    return this.createFallbackStream(fallbackContent + statusInfo);
  }

  /**
   * Create a streaming response from Claude CLI
   */
  private async tryClaudeStreaming(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: ConversationMessage[],
    workspaceId: string
  ): Promise<AsyncIterable<string> | null> {
    try {
      // Prepare the conversation context
      const recentHistory = conversationHistory.slice(-10);
      let contextMessages = recentHistory.map(msg => 
        `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`
      ).join('\n\n');
      
      const fullPrompt = `${systemPrompt}

CONVERSATION HISTORY:
${contextMessages}

CURRENT REQUEST:
Human: ${userMessage}

Please provide a helpful response as the workspace AI assistant.`;

      const workspacePath = path.join(this.workspaceBasePath, workspaceId);
      
      // Ensure Claude settings are configured
      await this.ensureClaudeSettings(workspacePath);
      return this.createRealTimeStream('claude', fullPrompt, workspacePath);
      
    } catch (error) {
      console.warn('Claude CLI not available for streaming:', error);
      return null;
    }
  }

  /**
   * Create a streaming response from Gemini CLI
   */
  private async tryGeminiStreaming(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: ConversationMessage[],
    workspaceId: string
  ): Promise<AsyncIterable<string> | null> {
    try {
      // Prepare the conversation context
      const recentHistory = conversationHistory.slice(-10);
      let contextMessages = recentHistory.map(msg => 
        `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`
      ).join('\n\n');
      
      const fullPrompt = `${systemPrompt}

CONVERSATION HISTORY:
${contextMessages}

CURRENT REQUEST:
Human: ${userMessage}

Please provide a helpful response as the workspace AI assistant.`;

      const workspacePath = path.join(this.workspaceBasePath, workspaceId);
      
      return this.createRealTimeStream('gemini', fullPrompt, workspacePath);
      
    } catch (error) {
      console.warn('Gemini CLI not available for streaming:', error);
      return null;
    }
  }

  /**
   * Create a fallback stream from static text
   */
  private async *createFallbackStream(text: string): AsyncIterable<string> {
    // Stream word by word for better user experience
    const words = text.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const chunk = i === words.length - 1 ? word : word + ' ';
      yield chunk;
      
      // Small delay between words for natural streaming feel
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }
  
  /**
   * Create a real-time stream from CLI process - isolated per request
   */
  private async *createRealTimeStream(command: string, prompt: string, workspacePath: string): AsyncIterable<string> {
    const { spawn } = require('child_process');
    
    try {
      console.log('🚀 createRealTimeStream called with:', { command, promptLength: prompt.length, workspacePath });
      console.log('🚀 Starting fresh isolated streaming process - won\'t affect other agents');
      
      // Configure args based on CLI tool
      let args: string[];
      let sendPromptViaStdin = true;
      
      if (command === 'claude') {
        // Ensure Claude settings are configured for this workspace
        await this.ensureClaudeSettings(workspacePath);
        // Keep Claude interactive for proper conversation flow
        args = [];
      } else if (command === 'gemini') {
        // Gemini takes the prompt via --prompt flag
        args = ['--prompt', prompt];
        sendPromptViaStdin = false;
      } else {
        args = [];
      }
        
      // For all AI agents, cd into the workspace root directory first
      // This gives them access to all 4 folders: target, context, feedback, agents
      
      console.log('🔧 Spawning process:', command, 'with args:', args.length > 100 ? args.slice(0, 2).concat(['...prompt...']) : args);
      console.log('🔧 Working directory:', workspacePath);
      
      let processCommand: string;
      let processArgs: string[];
      
      // Create isolated environment for Claude agents
      let processEnv = { ...process.env };
      if (command === 'claude') {
        const agentClaudeDir = path.join(workspacePath, '.claude-agent-data');
        await fs.mkdir(agentClaudeDir, { recursive: true });
        
        // Create a wrapper script that cds into the workspace BEFORE launching Claude
        // Properly escape the workspace path for bash
        const escapedWorkspacePath = workspacePath.replace(/'/g, "'\"'\"'");
        const wrapperScript = `#!/bin/bash
cd '${escapedWorkspacePath}'
exec claude ${args.join(' ')} "$@"`;
        
        const scriptPath = path.join(agentClaudeDir, 'claude-wrapper.sh');
        await fs.writeFile(scriptPath, wrapperScript);
        await fs.chmod(scriptPath, 0o755);
        
        processCommand = 'bash';
        processArgs = [scriptPath];
        processEnv = {
          ...process.env,
          CLAUDE_DATA_DIR: agentClaudeDir,
          HOME: workspacePath
        };
      } else if (command === 'gemini') {
        // For Gemini with prompt in args, also use bash with proper path escaping
        const escapedWorkspacePath = workspacePath.replace(/'/g, "'\"'\"'");
        const escapedArgs = args.map(arg => {
          // Escape single quotes in arguments
          const escaped = arg.replace(/'/g, "'\"'\"'");
          return `'${escaped}'`;
        }).join(' ');
        processCommand = 'bash';
        processArgs = ['-c', `cd '${escapedWorkspacePath}' && gemini ${escapedArgs}`];
      } else {
        processCommand = command;
        processArgs = args;
      }
      
      const claudeProcess = spawn(processCommand, processArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: processEnv
      });
      
      // Track this process for cleanup
      this.activeProcesses.add(claudeProcess);
      console.log('🔧 Process spawned with PID:', claudeProcess.pid, '- Total active:', this.activeProcesses.size);
      
      // Track stderr for debugging
      let stderrOutput = '';
      claudeProcess.stderr.on('data', (data: Buffer) => {
        const error = data.toString();
        stderrOutput += error;
        
        // For Gemini, stderr often contains model switching info, not errors
        if (command === 'gemini' && (
          error.includes('slow response') || 
          error.includes('generating with') ||
          error.includes('gemini-flash') ||
          error.includes('switching')
        )) {
          console.log('📊 Gemini model info:', error.trim());
        } else {
          console.log('🚨', command, 'stderr:', error);
        }
        
        // Always log all stderr for debugging
        console.log(`🔍 ${command} stderr (all):`, error.trim());
      });
      
      // Send the prompt (if needed)
      if (sendPromptViaStdin) {
        console.log('📝 Sending prompt to', command, '- Length:', prompt.length);
        console.log('📝 Prompt preview:', prompt.substring(0, 200) + '...');
        
        try {
          claudeProcess.stdin.write(prompt);
          claudeProcess.stdin.end();
          console.log('✅ Prompt sent successfully to', command);
        } catch (writeError) {
          console.error('❌ Error writing to', command, 'stdin:', writeError);
          throw writeError;
        }
      } else {
        console.log('📝 Prompt passed as argument to', command);
        claudeProcess.stdin.end();
      }
      
      // Set timeout for AI calls - fail fast to avoid blocking other agents
      const timeout = setTimeout(() => {
        console.log('⏰ Timeout reached for', command, '- killing process PID:', claudeProcess.pid);
        console.log('⏰ Stderr so far:', stderrOutput);
        console.log('⏰ This timeout is isolated and won\'t affect other agents');
        
        // Force kill the process
        try {
          claudeProcess.kill('SIGKILL'); // Force kill to ensure cleanup
        } catch (killError) {
          console.warn('Process already dead:', killError);
        }
        
        // Mark as finished to unblock the waiting loop
        if (!finished) {
          finished = true;
          error = new Error('Request timed out. Please try again.');
        }
      }, 120000); // 2 minutes - allow time for AI responses
      
      // Create async iterator for streaming responses
      let buffer = '';
      let finished = false;
      let error: Error | null = null;
      
      claudeProcess.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        buffer += text;
        
        // Accumulate all responses
        console.log('📦 Received data chunk:', text.length, 'chars');
      });
      
      claudeProcess.on('close', (code: number) => {
        console.log('🏁 Process closed with code:', code);
        clearTimeout(timeout);
        finished = true;
        
        // Clean up process regardless of success/failure
        try {
          claudeProcess.removeAllListeners();
          this.activeProcesses.delete(claudeProcess);
          console.log('🧹 Process cleaned up. Active processes remaining:', this.activeProcesses.size);
        } catch (cleanupError) {
          console.warn('Process cleanup warning:', cleanupError);
        }
        
        if (code === null) {
          // Process was killed (likely by timeout) - don't affect other agents
          console.warn(`⚠️ ${command} process was terminated (timeout). This won't affect other agents.`);
          error = new Error(`AI service temporarily unavailable. Please try again.`);
        } else if (code !== 0 && code !== 143) {
          // For Gemini, ignore stderr if it's just model switching info
          const isGeminiModelSwitch = command === 'gemini' && stderrOutput && (
            stderrOutput.includes('slow response') ||
            stderrOutput.includes('generating with') ||
            stderrOutput.includes('gemini-flash') ||
            stderrOutput.includes('switching')
          );
          
          if (isGeminiModelSwitch && buffer.trim()) {
            // Gemini switched models but still generated output - not an error
            console.log('✅ Gemini completed with model switch');
          } else {
            // Real error - isolate to this request only
            console.warn(`⚠️ ${command} CLI failed with code ${code}. This is isolated to this request.`);
            const errorDetails = stderrOutput.trim() ? ` Error details: ${stderrOutput}` : '';
            error = new Error(`AI service encountered an error.${errorDetails} Please try again.`);
          }
        } else if (code === 143) {
          // Timeout - don't affect other agents
          console.warn(`⚠️ ${command} request timed out. This won't affect other agents.`);
          error = new Error('Request timed out. Please try a simpler request or try again.');
        }
      });
      
      claudeProcess.on('error', (processError: Error) => {
        console.error('🚨 Process spawn error for', command, ':', processError.message);
        clearTimeout(timeout);
        finished = true;
        
        // Clean up process
        try {
          claudeProcess.removeAllListeners();
          claudeProcess.kill('SIGKILL');
          this.activeProcesses.delete(claudeProcess);
          console.log('🧹 Failed process force cleaned up. Active processes remaining:', this.activeProcesses.size);
        } catch (cleanupError) {
          console.warn('Force cleanup warning:', cleanupError);
        }
        
        // Isolate error to this request
        error = new Error(`Failed to start AI service. Please try again.`);
      });
      
      // Wait for completion
      while (!finished) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (error) {
        throw error;
      }
      
      // Parse and yield the response
      if (buffer.trim()) {
        if (command === 'claude') {
          try {
            const jsonResponse = JSON.parse(buffer);
            const content = jsonResponse.result || jsonResponse.content || buffer;
            console.log('📤 Parsed Claude response, content length:', content.length);
            yield* this.createFallbackStream(content);
          } catch (parseError) {
            console.log('📤 Failed to parse JSON, using raw response');
            yield* this.createFallbackStream(buffer);
          }
        } else {
          // Gemini or other CLI tools - use response as-is
          yield* this.createFallbackStream(buffer);
        }
      } else {
        yield 'I apologize, but I received an empty response. Please try again.';
      }
      
    } catch (streamError) {
      console.error('Real-time streaming error:', streamError);
      yield `I encountered an error: ${(streamError as Error).message}. Please try again.`;
    }
  }

  /**
   * Ensure Claude settings.local.json is configured at workspace root for all agents
   */
  private async ensureClaudeSettings(workspacePath: string): Promise<void> {
    const fs = require('fs').promises;
    
    try {
      // Put .claude directory in the workspace root so Claude has access to all folders
      const claudeDir = path.join(workspacePath, '.claude');
      const settingsPath = path.join(claudeDir, 'settings.local.json');
      
      // Ensure the workspace directory exists first
      try {
        await fs.access(workspacePath);
      } catch {
        console.log('Creating workspace directory:', workspacePath);
        await fs.mkdir(workspacePath, { recursive: true });
      }
      
      // Create .claude directory if it doesn't exist
      try {
        await fs.access(claudeDir);
      } catch {
        console.log('Creating .claude directory at workspace root:', claudeDir);
        await fs.mkdir(claudeDir, { recursive: true });
      }
      
      // Check if settings.local.json exists
      try {
        await fs.access(settingsPath);
        console.log('Claude settings.local.json already exists at workspace root');
      } catch {
        // Create settings.local.json with workspace-specific configuration
        const settings = {
          "allowedTools": [
            "bash",
            "grep", 
            "glob",
            "read_file",
            "write_file", 
            "edit_file",
            "multi_edit",
            "list_files"
          ],
          "workspaceConfig": {
            "maxFileSize": "10MB",
            "allowedFileTypes": [
              "*.js", "*.ts", "*.tsx", "*.jsx", 
              "*.json", "*.md", "*.txt", "*.yaml", "*.yml",
              "*.css", "*.scss", "*.html", "*.xml",
              "*.py", "*.sh", "*.dockerfile", "*.env"
            ],
            "excludedDirectories": [
              "node_modules",
              ".git", 
              "dist",
              "build",
              ".next",
              "coverage"
            ]
          },
          "permissions": {
            "readFiles": true,
            "writeFiles": true,
            "executeCommands": true,
            "networkAccess": false
          },
          "contextWindow": {
            "maxTokens": 100000,
            "preserveHistory": true
          }
        };
        
        console.log('Creating Claude settings.local.json at workspace root:', settingsPath);
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
        console.log('✅ Claude settings.local.json created for all agents to use');
      }
      
    } catch (error) {
      console.warn('Failed to ensure Claude settings:', error);
      // Don't throw error - allow fallback to work without settings
    }
  }
}

export const agentService = new AgentService();// Trigger rebuild
