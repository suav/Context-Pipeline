import { promises as fs } from 'fs';
import * as path from 'path';
import { BaseAIService, AIResponse } from './BaseAIService';
export class GeminiService extends BaseAIService {
  getServiceName(): string {
    return 'Gemini';
  }
  async checkAvailability(): Promise<boolean> {
    try {
      console.log(`[Gemini] Checking availability with --version...`);
      return new Promise((resolve) => {
        const { spawn } = require('child_process');
        const child = spawn('gemini', ['--version'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 5000
        });
        let hasOutput = false;
        child.stdout?.on('data', (data: Buffer) => {
          const output = data.toString().trim();
          console.log(`[Gemini] Version output:`, output);
          if (output.match(/\d+\.\d+/) || output.includes('gemini')) {
            hasOutput = true;
          }
        });
        child.stderr?.on('data', (data: Buffer) => {
          const output = data.toString().trim();
          console.log(`[Gemini] Version stderr:`, output);
        });
        child.on('close', (code) => {
          console.log(`[Gemini] Version check exit code:`, code);
          // For Gemini, we consider it available if the CLI exists (even with quota errors)
          resolve(hasOutput || code === 0);
        });
        child.on('error', (error) => {
          console.log(`[Gemini] Availability check spawn error:`, error.message);
          resolve(false);
        });
        // Fallback timeout
        setTimeout(() => {
          child.kill();
          console.log(`[Gemini] Version check timeout, assuming unavailable`);
          resolve(false);
        }, 3000);
      });
    } catch (error) {
      console.warn(`[Gemini] Availability check failed:`, error);
      return false;
    }
  }
  async processMessage(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: any[],
    workspaceId: string
  ): Promise<AIResponse> {
    console.log(`[Gemini] Processing message for workspace: ${workspaceId}`);
    try {
      const workspacePath = path.join(this.workspaceBasePath, workspaceId);
      // Build conversation context
      const conversationContext = conversationHistory
        .slice(-8) // Keep last 8 messages for context (Gemini might have different limits)
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n\n');
      const fullPrompt = `${systemPrompt}
CONVERSATION HISTORY:
${conversationContext}
USER: ${userMessage}`;
      // Write prompt to temporary file to avoid command line length limits
      const tempPromptFile = path.join(workspacePath, '.gemini-temp-prompt.txt');
      await fs.writeFile(tempPromptFile, fullPrompt);
      console.log(`[Gemini] Spawning Gemini CLI process`);
      const { process: childProcess, cleanup } = await this.spawnProcess('gemini', [], {
        cwd: workspacePath,
        env: {
          ...process.env,
          // Gemini might need specific environment variables
        },
        timeout: 120000 // 2 minutes
      });
      // Send prompt via stdin
      childProcess.stdin?.write(fullPrompt);
      childProcess.stdin?.end();
      return new Promise((resolve, reject) => {
        let response = '';
        let hasError = false;
        let modelSwitchDetected = false;
        childProcess.stdout?.on('data', (data: Buffer) => {
          const chunk = data.toString();
          response += chunk;
          // Detect model switching messages (these are informational, not errors)
          if (chunk.includes('slow response times') ||
              chunk.includes('generating with gemini-flash') ||
              chunk.includes('switching to')) {
            console.log(`[Gemini] Model switch detected:`, chunk.trim());
            modelSwitchDetected = true;
          } else {
            console.log(`[Gemini] Response chunk received:`, chunk.substring(0, 100) + '...');
          }
        });
        childProcess.stderr?.on('data', (data: Buffer) => {
          const error = data.toString();
          console.warn(`[Gemini] Stderr:`, error);
          // Don't treat model switching as errors
          if (!error.includes('slow response times') &&
              !error.includes('generating with') &&
              (error.includes('error') || error.includes('failed'))) {
            hasError = true;
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
          console.log(`[Gemini] Process closed with code:`, code);
          // Handle Gemini's specific exit patterns
          if (hasError || (code !== 0 && code !== null)) {
            reject(new Error(`Gemini CLI failed with code ${code}`));
            return;
          }
          if (response.trim()) {
            // Clean up model switching messages from the response
            const cleanedResponse = response
              .split('\n')
              .filter(line =>
                !line.includes('slow response times') &&
                !line.includes('generating with gemini-flash') &&
                !line.includes('switching to')
              )
              .join('\n')
              .trim();
            resolve({
              content: cleanedResponse || response.trim(),
              metadata: {
                backend: 'gemini-cli',
                success: true,
                workspaceId,
                modelSwitchDetected
              }
            });
          } else {
            reject(new Error('Gemini returned empty response'));
          }
        });
        childProcess.on('error', (error) => {
          cleanup();
          console.error(`[Gemini] Process error:`, error);
          reject(error);
        });
      });
    } catch (error) {
      console.error(`[Gemini] Message processing failed:`, error);
      throw error;
    }
  }
  async createStream(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: any[],
    workspaceId: string
  ): Promise<AsyncIterable<string>> {
    console.log(`[Gemini] Creating stream for workspace: ${workspaceId}`);
    try {
      // For now, use non-streaming and simulate streaming
      const response = await this.processMessage(systemPrompt, userMessage, conversationHistory, workspaceId);
      return this.createFallbackStream(response.content);
    } catch (error) {
      console.warn(`[Gemini] Streaming failed, using fallback:`, error);
      const fallback = this.generateIntelligentFallback(userMessage, conversationHistory);
      return this.createFallbackStream(fallback);
    }
  }
}