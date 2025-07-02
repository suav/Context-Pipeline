/**
 * Agent Service - Orchestrates AI services (Claude, Gemini)
 * Simplified and modular approach
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { ClaudeService } from './ClaudeService';
import { GeminiService } from './GeminiService';
import { BaseAIService } from './BaseAIService';

interface ConversationMessage {
  id: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
}

export class AgentService {
  private workspaceBasePath: string;
  private claudeService: ClaudeService;
  private geminiService: GeminiService;
  private serviceAvailability: Map<string, boolean> = new Map();

  constructor() {
    this.workspaceBasePath = process.env.WORKSPACE_DIR || path.join(process.cwd(), 'storage', 'workspaces');
    this.claudeService = new ClaudeService(this.workspaceBasePath);
    this.geminiService = new GeminiService(this.workspaceBasePath);
  }

  /**
   * Check availability of all AI services
   */
  async checkServiceAvailability(): Promise<{ claude: boolean; gemini: boolean }> {
    console.log('🔍 Checking AI service availability...');
    
    console.log('🔍 About to check Claude...');
    const claudeAvailable = await this.claudeService.checkAvailability();
    console.log(`🔍 Claude check result: ${claudeAvailable}`);
    
    console.log('🔍 About to check Gemini...');
    const geminiAvailable = await this.geminiService.checkAvailability();
    console.log(`🔍 Gemini check result: ${geminiAvailable}`);

    this.serviceAvailability.set('claude', claudeAvailable);
    this.serviceAvailability.set('gemini', geminiAvailable);

    console.log(`✅ Service availability: Claude=${claudeAvailable}, Gemini=${geminiAvailable}`);
    
    return { claude: claudeAvailable, gemini: geminiAvailable };
  }

  /**
   * Get the appropriate AI service based on preference and availability
   */
  private async getAIService(preferredModel?: 'claude' | 'gemini'): Promise<BaseAIService | null> {
    // Always refresh availability check (don't cache failures)
    await this.checkServiceAvailability();

    // Try preferred model first
    if (preferredModel === 'claude' && this.serviceAvailability.get('claude')) {
      console.log('🔮 Using Claude service (preferred)');
      return this.claudeService;
    }
    
    if (preferredModel === 'gemini' && this.serviceAvailability.get('gemini')) {
      console.log('💎 Using Gemini service (preferred)');
      return this.geminiService;
    }

    // Fallback to any available service
    if (this.serviceAvailability.get('claude')) {
      console.log('🔮 Using Claude service (fallback)');
      return this.claudeService;
    }
    
    if (this.serviceAvailability.get('gemini')) {
      console.log('💎 Using Gemini service (fallback)');
      return this.geminiService;
    }

    console.warn('⚠️ No AI services available');
    return null;
  }

  /**
   * Generate a streaming AI response
   */
  async generateStreamingResponse(
    workspaceId: string,
    agentId: string,
    userMessage: string,
    conversationHistory: ConversationMessage[],
    preferredModel?: 'claude' | 'gemini'
  ): Promise<AsyncIterable<string>> {
    console.log(`🚀 Generating streaming response for ${preferredModel || 'any'} in workspace ${workspaceId}`);
    
    try {
      const aiService = await this.getAIService(preferredModel);
      
      if (!aiService) {
        // Return fallback stream
        return this.createNoServiceFallbackStream(userMessage, conversationHistory);
      }

      // Load workspace context
      const workspaceContext = await aiService.loadWorkspaceContext(workspaceId);
      const systemPrompt = aiService.buildSystemPrompt(workspaceContext, agentId);

      return await aiService.createStream(systemPrompt, userMessage, conversationHistory, workspaceId);

    } catch (error) {
      console.error(`❌ Streaming response failed:`, error);
      return this.createErrorFallbackStream(error as Error, userMessage);
    }
  }

  /**
   * Generate a single AI response (non-streaming)
   */
  async generateResponse(
    workspaceId: string,
    agentId: string,
    userMessage: string,
    conversationHistory: ConversationMessage[],
    preferredModel?: 'claude' | 'gemini'
  ): Promise<{ content: string; metadata?: any }> {
    console.log(`🎯 Generating single response for ${preferredModel || 'any'} in workspace ${workspaceId}`);
    
    try {
      const aiService = await this.getAIService(preferredModel);
      
      if (!aiService) {
        return {
          content: this.generateNoServiceFallback(userMessage, conversationHistory),
          metadata: { backend: 'no-service-fallback', success: false }
        };
      }

      // Load workspace context
      const workspaceContext = await aiService.loadWorkspaceContext(workspaceId);
      const systemPrompt = aiService.buildSystemPrompt(workspaceContext, agentId);

      return await aiService.processMessage(systemPrompt, userMessage, conversationHistory, workspaceId);

    } catch (error) {
      console.error(`❌ Single response failed:`, error);
      return {
        content: `I encountered an error: ${(error as Error).message}. Please try again.`,
        metadata: { backend: 'error-fallback', success: false, error: (error as Error).message }
      };
    }
  }

  /**
   * Save conversation message to workspace
   */
  async saveConversationMessage(
    workspaceId: string,
    agentId: string,
    message: ConversationMessage
  ): Promise<void> {
    try {
      const conversationPath = path.join(
        this.workspaceBasePath,
        workspaceId,
        'agents',
        agentId,
        'conversation.json'
      );

      // Ensure directory exists
      await fs.mkdir(path.dirname(conversationPath), { recursive: true });

      // Load existing conversation
      let conversation: ConversationMessage[] = [];
      try {
        const existingData = await fs.readFile(conversationPath, 'utf-8');
        conversation = JSON.parse(existingData);
      } catch {
        // File doesn't exist yet, start with empty array
      }

      // Add new message
      conversation.push(message);

      // Keep only last 50 messages to avoid huge files
      if (conversation.length > 50) {
        conversation = conversation.slice(-50);
      }

      // Save back to file
      await fs.writeFile(conversationPath, JSON.stringify(conversation, null, 2));
      
    } catch (error) {
      console.error(`Failed to save conversation message:`, error);
    }
  }

  /**
   * Load conversation history from workspace
   */
  async loadConversationHistory(workspaceId: string, agentId: string): Promise<ConversationMessage[]> {
    try {
      const conversationPath = path.join(
        this.workspaceBasePath,
        workspaceId,
        'agents',
        agentId,
        'conversation.json'
      );

      const data = await fs.readFile(conversationPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return []; // Return empty array if file doesn't exist
    }
  }

  /**
   * Fallback streams for when services are unavailable
   */
  private async* createNoServiceFallbackStream(userMessage: string, conversationHistory: ConversationMessage[]): AsyncIterable<string> {
    const message = `I understand you're asking: "${userMessage}"

Unfortunately, neither Claude nor Gemini CLI services are currently available. This could be due to:
• CLI tools not installed or configured
• Authentication issues
• Network connectivity problems

You can:
1. Check if claude or gemini CLI tools are installed
2. Verify authentication (claude auth or gemini auth)
3. Try again in a moment

How else can I assist you with your development work?`;

    const words = message.split(' ');
    for (let i = 0; i < words.length; i++) {
      yield words[i] + (i < words.length - 1 ? ' ' : '');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  private async* createErrorFallbackStream(error: Error, userMessage: string): AsyncIterable<string> {
    const message = `I encountered an error while processing your request: "${userMessage}"

Error: ${error.message}

Please try again, or let me know if you need help with something else.`;

    const words = message.split(' ');
    for (let i = 0; i < words.length; i++) {
      yield words[i] + (i < words.length - 1 ? ' ' : '');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  private generateNoServiceFallback(userMessage: string, conversationHistory: ConversationMessage[]): string {
    return `I understand you're asking: "${userMessage}"

Unfortunately, neither Claude nor Gemini CLI services are currently available. Please check:
• CLI tools installation and authentication
• Network connectivity
• Try again in a moment

How else can I assist you?`;
  }

  /**
   * Cleanup all services
   */
  cleanup(): void {
    console.log('🧹 Cleaning up AgentService...');
    this.claudeService.cleanup();
    this.geminiService.cleanup();
  }
}

// Export singleton instance for API routes
export const agentService = new AgentService();