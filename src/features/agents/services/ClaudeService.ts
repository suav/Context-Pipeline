import { promises as fs } from 'fs';
import * as path from 'path';
import { BaseAIService, AIResponse } from './BaseAIService';
export class ClaudeService extends BaseAIService {
  getServiceName(): string {
    return 'Claude';
  }
  async checkAvailability(): Promise<boolean> {
    console.log(`[Claude] TEMP: Forcing Claude to be available for testing`);
    return true; // Force Claude to be available for testing
  }
  private async ensureClaudeSettings(workspacePath: string): Promise<void> {
    const agentClaudeDir = path.join(workspacePath, '.claude-agent-data');
    await fs.mkdir(agentClaudeDir, { recursive: true });
    // Create Claude settings file for this workspace
    const settingsPath = path.join(agentClaudeDir, 'settings.json');
    const settings = {
      "workingDirectory": workspacePath,
      "isolatedMode": true,
      "maxTokens": 4000,
      "temperature": 0.7
    };
    try {
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
      console.log(`[Claude] Settings configured for workspace:`, workspacePath);
    } catch (error) {
      console.warn(`[Claude] Failed to write settings:`, error);
    }
  }
  async processMessage(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: any[],
    workspaceId: string
  ): Promise<AIResponse> {
    console.log(`[Claude] Processing message for workspace: ${workspaceId}`);
    try {
      const workspacePath = path.join(this.workspaceBasePath, workspaceId);
      await this.ensureClaudeSettings(workspacePath);
      // Build conversation context
      const conversationContext = conversationHistory
        .slice(-10) // Keep last 10 messages for context
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n\n');
      
      // Claude will read CLAUDE.md directly, so we only need to pass the user message
      // and conversation history, not the system prompt
      const prompt = conversationHistory.length > 0 
        ? `CONVERSATION HISTORY:\n${conversationContext}\n\nUSER: ${userMessage}\n\nASSISTANT:`
        : userMessage;
      
      // Write prompt to temporary file to avoid command line length limits
      const tempPromptFile = path.join(workspacePath, '.claude-temp-prompt.txt');
      await fs.writeFile(tempPromptFile, prompt);
      console.log(`[Claude] Spawning Claude CLI process`);
      // Run Claude from workspace root so it can access CLAUDE.md and .claude/settings.json
      // Claude will still be able to access target/ subdirectory
      
      const { process: childProcess, cleanup } = await this.spawnProcess('claude', ['--print', '--output-format', 'stream-json', '--verbose'], {
        cwd: workspacePath, // Run Claude from workspace root to access permission files
        env: {
          ...process.env,
          CLAUDE_DATA_DIR: path.join(workspacePath, '.claude-agent-data'),
          CLAUDE_WORKSPACE_ROOT: workspacePath, // Tell Claude the actual workspace root
          HOME: process.env.HOME
        },
        timeout: 300000 // 5 minutes for complex analysis
      });
      // Send prompt via stdin
      childProcess.stdin?.write(prompt);
      childProcess.stdin?.end();
      return new Promise((resolve, reject) => {
        let response = '';
        let hasError = false;
        childProcess.stdout?.on('data', (data: Buffer) => {
          const chunk = data.toString();
          console.log(`[Claude] JSON chunk received:`, chunk.substring(0, 200) + '...');
          // Parse JSON stream format
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.trim()) {
              try {
                const jsonData = JSON.parse(line);
                if (jsonData.type === 'assistant' && jsonData.message?.content) {
                  // Extract text from Claude's response format
                  for (const contentItem of jsonData.message.content) {
                    if (contentItem.type === 'text' && contentItem.text) {
                      response += contentItem.text;
                    }
                  }
                } else if (jsonData.type === 'result' && jsonData.result) {
                  // Also capture final result if available
                  response += jsonData.result;
                }
              } catch (e) {
                // Not JSON, might be plain text - add it anyway
                response += line;
              }
            }
          }
        });
        childProcess.stderr?.on('data', (data: Buffer) => {
          const stderrData = data.toString();
          console.log(`[Claude] Stderr info:`, stderrData);
          // Only treat actual errors as errors, not verbose output
          if (stderrData.toLowerCase().includes('error:') ||
              stderrData.toLowerCase().includes('failed:') ||
              stderrData.toLowerCase().includes('authentication')) {
            hasError = true;
            console.warn(`[Claude] Actual error detected:`, stderrData);
          }
        });
        childProcess.on('close', async (code) => {
          cleanup();
          // Clean up temporary file
          try {
            await fs.unlink(tempPromptFile);
          } catch (e) {
            // Ignore cleanup errors
          }
          console.log(`[Claude] Process closed with code:`, code);
          if (hasError || code !== 0) {
            reject(new Error(`Claude CLI failed with code ${code}`));
            return;
          }
          if (response.trim()) {
            resolve({
              content: response.trim(),
              metadata: { backend: 'claude-cli', success: true, workspaceId }
            });
          } else {
            reject(new Error('Claude returned empty response'));
          }
        });
        childProcess.on('error', (error) => {
          cleanup();
          console.error(`[Claude] Process error:`, error);
          reject(error);
        });
      });
    } catch (error) {
      console.error(`[Claude] Message processing failed:`, error);
      throw error;
    }
  }
  async createStream(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: any[],
    workspaceId: string,
    sessionId?: string
  ): Promise<AsyncIterable<string>> {
    console.log(`[Claude] Creating stream for workspace: ${workspaceId}, session: ${sessionId || 'new'}`);
    try {
      const workspacePath = path.join(this.workspaceBasePath, workspaceId);
      await this.ensureClaudeSettings(workspacePath);
      
      // If we have a session ID, we'll resume that session instead of passing history
      if (sessionId) {
        console.log(`[Claude] Resuming existing session: ${sessionId}`);
        return this.createRealClaudeStream(workspacePath, userMessage, sessionId);
      } else {
        // For new sessions, provide initial context
        console.log(`[Claude] Creating new session with system prompt`);
        // Don't include system prompt in the message - Claude will read CLAUDE.md directly
        return this.createRealClaudeStream(workspacePath, userMessage);
      }
    } catch (error) {
      console.warn(`[Claude] Streaming failed, using fallback:`, error);
      const fallback = this.generateIntelligentFallback(userMessage, conversationHistory);
      return this.createFallbackStream(fallback);
    }
  }
  private async* createRealClaudeStream(workspacePath: string, prompt: string, sessionId?: string): AsyncIterable<string> {
    console.log(`[Claude] Starting real-time stream${sessionId ? ` (resuming session: ${sessionId})` : ' (new session)'}`);
    
    // Build Claude CLI arguments
    const claudeArgs = ['--print', '--output-format', 'stream-json', '--verbose'];
    if (sessionId) {
      claudeArgs.push('--resume', sessionId);
    }
    
    // Run Claude from workspace root so it can access CLAUDE.md and .claude/settings.json
    
    const { process: childProcess, cleanup } = await this.spawnProcess('claude', claudeArgs, {
      cwd: workspacePath, // Run Claude from workspace root to access permission files
      env: {
        ...process.env,
        CLAUDE_DATA_DIR: path.join(workspacePath, '.claude-agent-data'),
        CLAUDE_WORKSPACE_ROOT: workspacePath, // Tell Claude the actual workspace root
        HOME: process.env.HOME
      },
      timeout: 300000 // 5 minutes for complex analysis
    });
    
    // For resumed sessions, just send the user message
    // For new sessions, send the full prompt with system context
    childProcess.stdin?.write(prompt);
    childProcess.stdin?.end();
    let buffer = '';
    let sessionInfo: any = null;
    let totalUsage: any = null;
    // Set up data handlers before yielding
    const processData = (data: Buffer) => {
      const chunk = data.toString();
      buffer += chunk;
      // Process complete JSON lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      const results: string[] = [];
      for (const line of lines) {
        if (line.trim()) {
          try {
            const jsonData = JSON.parse(line);
            // Capture system initialization info
            if (jsonData.type === 'system' && jsonData.subtype === 'init') {
              sessionInfo = jsonData;
              // Yield system info as metadata
              results.push(`<<<CLAUDE_METADATA:SYSTEM:${JSON.stringify({
                model: jsonData.model,
                session_id: jsonData.session_id,
                tools: jsonData.tools,
                cwd: jsonData.cwd
              })}>>>`);
            }
            // Process assistant messages
            else if (jsonData.type === 'assistant' && jsonData.message) {
              const message = jsonData.message;
              // Yield usage info if available
              if (message.usage) {
                results.push(`<<<CLAUDE_METADATA:USAGE:${JSON.stringify(message.usage)}>>>`);
              }
              // Extract content
              if (message.content) {
                for (const contentItem of message.content) {
                  if (contentItem.type === 'text' && contentItem.text) {
                    results.push(contentItem.text);
                  } else if (contentItem.type === 'tool_use') {
                    // Capture comprehensive tool use information
                    const toolUse = {
                      id: contentItem.id,
                      name: contentItem.name,
                      input: contentItem.input,
                      timestamp: new Date().toISOString(),
                      // Extract key operation details based on tool type
                      operation_summary: generateToolSummary(contentItem.name, contentItem.input)
                    };
                    results.push(`<<<CLAUDE_METADATA:TOOL_USE:${JSON.stringify(toolUse)}>>>`);
                    // Also yield a human-readable tool use notification
                    results.push(`\n🔧 **Tool Used: ${contentItem.name}**\n${generateToolDescription(contentItem.name, contentItem.input)}\n`);
                  }
                }
              }
              // Check stop reason
              if (message.stop_reason) {
                results.push(`<<<CLAUDE_METADATA:STOP:${JSON.stringify({
                  reason: message.stop_reason,
                  sequence: message.stop_sequence
                })}>>>`);
              }
            }
            // Process tool results (from user messages with tool results)
            else if (jsonData.type === 'user' && jsonData.message?.content) {
              for (const contentItem of jsonData.message.content) {
                if (contentItem.type === 'tool_result') {
                  const toolResult = {
                    tool_use_id: contentItem.tool_use_id,
                    is_error: contentItem.is_error || false,
                    content: contentItem.content,
                    timestamp: new Date().toISOString(),
                    content_preview: generateResultPreview(contentItem.content)
                  };
                  results.push(`<<<CLAUDE_METADATA:TOOL_RESULT:${JSON.stringify(toolResult)}>>>`);
                  // Only show human-readable tool result notifications for actual tool outputs, not analysis
                  // Check if this is a short tool result vs a long Claude analysis response
                  const contentStr = typeof contentItem.content === 'string' ? contentItem.content : JSON.stringify(contentItem.content);
                  const isAnalysisResponse = contentStr.length > 500 || 
                                           contentStr.includes('Based on my analysis') || 
                                           contentStr.includes('Looking at') ||
                                           contentStr.includes('After reviewing') ||
                                           contentStr.includes('I can see that');
                  
                  if (!isAnalysisResponse) {
                    // Only show tool result notifications for actual tool outputs
                    if (contentItem.is_error) {
                      results.push(`\n❌ **Tool Error**: ${contentItem.content}\n`);
                    } else {
                      results.push(`\n✅ **Tool Result**: ${generateResultPreview(contentItem.content)}\n`);
                    }
                  }
                  // If it's an analysis response, it should be treated as regular content, not a tool result display
                }
              }
            }
            // Process final result
            else if (jsonData.type === 'result') {
              totalUsage = jsonData.usage;
              results.push(`<<<CLAUDE_METADATA:RESULT:${JSON.stringify({
                success: jsonData.subtype === 'success',
                duration_ms: jsonData.duration_ms,
                duration_api_ms: jsonData.duration_api_ms,
                num_turns: jsonData.num_turns,
                total_cost_usd: jsonData.total_cost_usd,
                usage: jsonData.usage
              })}>>>`);
            }
            // Process thinking/status updates
            else if (jsonData.type === 'thinking') {
              results.push(`<<<CLAUDE_METADATA:THINKING:${JSON.stringify({
                content: jsonData.content
              })}>>>`);
            }
          } catch (e) {
            // Not JSON, might be plain text from verbose output or Claude's direct response
            if (!line.startsWith('[') && !line.includes('INFO:') && line.trim()) {
              // Check if this looks like a Claude analysis response that got mislabeled
              if (line.includes('Based on my analysis') || 
                  line.includes('Looking at') || 
                  line.includes('After reviewing') ||
                  line.includes('I can see that')) {
                console.log('🔍 Detected Claude analysis response outside JSON structure:', line.substring(0, 100));
              }
              results.push(line);
            }
          }
        }
      }
      return results.length > 0 ? results : null;
    };
    try {
      yield* (async function* () {
        for await (const data of childProcess.stdout!) {
          const results = processData(data);
          if (results) {
            for (const result of results) {
              yield result;
            }
          }
        }
      })();
    } catch (error) {
      console.error(`[Claude] Stream error:`, error);
      yield `Error in stream: ${error}`;
    } finally {
      cleanup();
    }
  }
}
function generateToolSummary(toolName: string, input: any): string {
  switch (toolName) {
    case 'Read':
      return `Reading file: ${input.file_path}`;
    case 'Write':
      return `Writing to file: ${input.file_path}`;
    case 'Edit':
      return `Editing file: ${input.file_path}`;
    case 'MultiEdit':
      return `Making ${input.edits?.length || 0} edits to: ${input.file_path}`;
    case 'Bash':
      return `Running command: ${input.command}`;
    case 'LS':
      return `Listing directory: ${input.path || 'current directory'}`;
    case 'Glob':
      return `Finding files matching: ${input.pattern}`;
    case 'Grep':
      return `Searching for pattern: ${input.pattern}`;
    case 'Task':
      return `Delegating task: ${input.description || 'subtask'}`;
    case 'WebFetch':
      return `Fetching URL: ${input.url}`;
    case 'WebSearch':
      return `Searching web: ${input.query}`;
    case 'TodoRead':
      return 'Reading todo list';
    case 'TodoWrite':
      return `Updating todo list with ${input.todos?.length || 0} items`;
    case 'NotebookRead':
      return `Reading notebook: ${input.notebook_path}`;
    case 'NotebookEdit':
      return `Editing notebook: ${input.notebook_path}`;
    default:
      return `Using ${toolName}`;
  }
}
function generateToolDescription(toolName: string, input: any): string {
  switch (toolName) {
    case 'Read':
      return `📖 Reading file: \`${input.file_path}\`${input.limit ? ` (${input.limit} lines)` : ''}`;
    case 'Write':
      return `✏️  Writing to file: \`${input.file_path}\` (${input.content?.length || 0} characters)`;
    case 'Edit':
      return `🔧 Editing file: \`${input.file_path}\`\n   Replacing: "${(input.old_string || '').substring(0, 50)}${input.old_string?.length > 50 ? '...' : ''}"\n   With: "${(input.new_string || '').substring(0, 50)}${input.new_string?.length > 50 ? '...' : ''}"`;
    case 'MultiEdit':
      return `🔧 Making ${input.edits?.length || 0} edits to: \`${input.file_path}\``;
    case 'Bash':
      return `💻 Running: \`${input.command}\`${input.timeout ? ` (timeout: ${input.timeout}ms)` : ''}`;
    case 'LS':
      return `📁 Listing contents of: \`${input.path || '.'}\``;
    case 'Glob':
      return `🔍 Finding files matching pattern: \`${input.pattern}\`${input.path ? ` in \`${input.path}\`` : ''}`;
    case 'Grep':
      return `🔎 Searching for pattern: \`${input.pattern}\`${input.include ? ` in files: \`${input.include}\`` : ''}`;
    case 'Task':
      return `🎯 Delegating subtask: "${input.description || 'task'}"`;
    case 'WebFetch':
      return `🌐 Fetching: \`${input.url}\`\n   Query: "${input.prompt}"`;
    case 'WebSearch':
      return `🔍 Web search: "${input.query}"`;
    case 'TodoRead':
      return `📋 Reading current todo list`;
    case 'TodoWrite':
      return `📝 Updating todo list with ${input.todos?.length || 0} items`;
    case 'NotebookRead':
      return `📓 Reading notebook: \`${input.notebook_path}\``;
    case 'NotebookEdit':
      return `📝 Editing notebook: \`${input.notebook_path}\``;
    default:
      return `🛠️  Using tool: ${toolName}`;
  }
}
function generateResultPreview(content: any): string {
  if (!content) return 'No output';
  
  // Handle JSON content that might contain Claude responses
  if (typeof content === 'object' || (typeof content === 'string' && content.trim().startsWith('{'))) {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      // If this is Claude's JSON response format with text content, extract just the text
      if (parsed.type === 'text' && parsed.text) {
        const textContent = parsed.text;
        // If it's a long analysis, just show it's an analysis
        if (textContent.length > 200 || 
            textContent.includes('Based on my analysis') || 
            textContent.includes('Looking at') ||
            textContent.includes('After reviewing')) {
          return 'Claude analysis response (see full text above)';
        }
        return textContent.substring(0, 150) + (textContent.length > 150 ? '...' : '');
      }
    } catch (e) {
      // Not JSON, continue with string processing
    }
  }
  
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  
  // Handle different types of content
  if (contentStr.includes('error') || contentStr.includes('Error')) {
    return `Error: ${contentStr.substring(0, 100)}${contentStr.length > 100 ? '...' : ''}`;
  }
  if (contentStr.includes('✓') || contentStr.includes('success')) {
    return `Success: ${contentStr.substring(0, 100)}${contentStr.length > 100 ? '...' : ''}`;
  }
  // For file listings or directory contents
  if (contentStr.includes('- /') || contentStr.includes('drwx') || contentStr.includes('total ')) {
    const lines = contentStr.split('\n');
    const fileCount = lines.filter(line => line.trim() && !line.includes('total ')).length;
    return `Directory listing: ${fileCount} items found`;
  }
  // For command outputs
  if (contentStr.includes('$') || contentStr.includes('>')) {
    return `Command output: ${contentStr.substring(0, 100)}${contentStr.length > 100 ? '...' : ''}`;
  }
  // Default preview
  const preview = contentStr.substring(0, 150);
  return `${preview}${contentStr.length > 150 ? '...' : ''}`;
}