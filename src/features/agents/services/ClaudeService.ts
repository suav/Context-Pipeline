/**
 * Claude Service - Handles Claude-specific AI interactions
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { BaseAIService, AIResponse } from './BaseAIService';

export class ClaudeService extends BaseAIService {
  
  getServiceName(): string {
    return 'Claude';
  }

  /**
   * Check if Claude CLI is available and working
   */
  async checkAvailability(): Promise<boolean> {
    console.log(`[Claude] TEMP: Forcing Claude to be available for testing`);
    return true; // Force Claude to be available for testing
  }

  /**
   * Ensure Claude settings are configured for workspace isolation
   */
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

  /**
   * Process a single message with Claude
   */
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

      const fullPrompt = `${systemPrompt}

CONVERSATION HISTORY:
${conversationContext}

USER: ${userMessage}

ASSISTANT:`;

      // Write prompt to temporary file to avoid command line length limits
      const tempPromptFile = path.join(workspacePath, '.claude-temp-prompt.txt');
      await fs.writeFile(tempPromptFile, fullPrompt);

      console.log(`[Claude] Spawning Claude CLI process`);
      const { process: childProcess, cleanup } = await this.spawnProcess('claude', ['--print', '--output-format', 'stream-json', '--verbose'], {
        cwd: workspacePath,
        env: {
          ...process.env,
          CLAUDE_DATA_DIR: path.join(workspacePath, '.claude-agent-data'),
          HOME: process.env.HOME
        },
        timeout: 300000 // 5 minutes for complex analysis
      });

      // Send prompt via stdin
      childProcess.stdin?.write(fullPrompt);
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

  /**
   * Create streaming response from Claude
   */
  async createStream(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: any[],
    workspaceId: string
  ): Promise<AsyncIterable<string>> {
    console.log(`[Claude] Creating stream for workspace: ${workspaceId}`);

    try {
      const workspacePath = path.join(this.workspaceBasePath, workspaceId);
      await this.ensureClaudeSettings(workspacePath);

      // Build conversation context
      const conversationContext = conversationHistory
        .slice(-10)
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n\n');

      const fullPrompt = `${systemPrompt}\n\nCONVERSATION HISTORY:\n${conversationContext}\n\nUSER: ${userMessage}\n\nASSISTANT:`;

      console.log(`[Claude] Creating real stream for workspace: ${workspaceId}`);
      
      // Return an async generator that streams Claude responses in real-time
      return this.createRealClaudeStream(workspacePath, fullPrompt);
      
    } catch (error) {
      console.warn(`[Claude] Streaming failed, using fallback:`, error);
      const fallback = this.generateIntelligentFallback(userMessage, conversationHistory);
      return this.createFallbackStream(fallback);
    }
  }

  /**
   * Create real-time streaming from Claude CLI
   */
  private async* createRealClaudeStream(workspacePath: string, fullPrompt: string): AsyncIterable<string> {
    const tempPromptFile = path.join(workspacePath, '.claude-temp-prompt.txt');
    await fs.writeFile(tempPromptFile, fullPrompt);

    console.log(`[Claude] Starting real-time stream`);
    const { process: childProcess, cleanup } = await this.spawnProcess('claude', ['--print', '--output-format', 'stream-json', '--verbose'], {
      cwd: workspacePath,
      env: {
        ...process.env,
        CLAUDE_DATA_DIR: path.join(workspacePath, '.claude-agent-data'),
        HOME: process.env.HOME
      },
      timeout: 300000 // 5 minutes for complex analysis
    });

    childProcess.stdin?.write(fullPrompt);
    childProcess.stdin?.end();

    let buffer = '';
    let streamEnded = false;

    // Set up data handlers before yielding
    const processData = (data: Buffer) => {
      const chunk = data.toString();
      buffer += chunk;
      
      // Process complete JSON lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const jsonData = JSON.parse(line);
            if (jsonData.type === 'assistant' && jsonData.message?.content) {
              // Extract text content and yield immediately
              for (const contentItem of jsonData.message.content) {
                if (contentItem.type === 'text' && contentItem.text) {
                  return contentItem.text;
                }
              }
            }
          } catch (e) {
            // Not JSON, might be plain text
            return line;
          }
        }
      }
      return null;
    };

    try {
      yield* (async function* () {
        for await (const data of childProcess.stdout!) {
          const text = processData(data);
          if (text) {
            yield text;
          }
        }
      })();
    } catch (error) {
      console.error(`[Claude] Stream error:`, error);
      yield `Error in stream: ${error}`;
    } finally {
      cleanup();
      try {
        await fs.unlink(tempPromptFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}