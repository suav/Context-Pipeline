import { promises as fs } from 'fs';
import * as path from 'path';
import { ClaudeService } from './ClaudeService';
import { GeminiService } from './GeminiService';
import { BaseAIService } from './BaseAIService';
import { CheckpointManager } from './CheckpointManager';
import {
  AgentCheckpoint,
  CheckpointCreationRequest,
  CheckpointSearchQuery,
  CheckpointSearchResult
} from '../types/checkpoints';
import { Agent } from '../types/index';
import { ConversationThread } from '../types/conversation';
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
      
      // Extract the most recent session ID from conversation history
      let sessionId: string | undefined;
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const message = conversationHistory[i];
        if (message.metadata?.session_id) {
          sessionId = message.metadata.session_id;
          console.log(`🔄 Found previous session ID: ${sessionId}`);
          break;
        }
      }
      
      // Load workspace context
      const workspaceContext = await aiService.loadWorkspaceContext(workspaceId);
      const systemPrompt = aiService.buildSystemPrompt(workspaceContext, agentId);
      
      // Pass session ID to continue existing Claude session or start new one
      return await aiService.createStream(systemPrompt, userMessage, conversationHistory, workspaceId, sessionId);
    } catch (error) {
      console.error(`❌ Streaming response failed:`, error);
      return this.createErrorFallbackStream(error as Error, userMessage);
    }
  }
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
  async createCheckpoint(
    workspaceId: string,
    agentId: string,
    title: string,
    description?: string,
    tags?: string[]
  ): Promise<string> {
    console.log(`📸 Creating checkpoint for agent ${agentId} in workspace ${workspaceId}`);
    try {
      // Load current conversation
      const conversationHistory = await this.loadConversationHistory(workspaceId, agentId);
      if (conversationHistory.length === 0) {
        throw new Error('No conversation history found - cannot create checkpoint');
      }
      // Create conversation thread format
      const conversationThread: ConversationThread = {
        id: `${agentId}-${Date.now()}`,
        agent_id: agentId,
        workspace_id: workspaceId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: conversationHistory,
        context_snapshot: {
          timestamp: new Date().toISOString(),
          workspace_structure: {
            context_items: [],
            target_files: [],
            feedback_files: []
          },
          git_state: {
            branch: 'main',
            commit_hash: '',
            modified_files: [],
            staged_files: []
          },
          context_description: `Checkpoint created for ${title}`
        },
        is_checkpoint: true,
        checkpoint_title: title,
        checkpoint_description: description,
        total_tokens_used: 0,
        commands_executed: [],
        status: 'checkpointed'
      };
      // Generate expertise summary from conversation
      const expertiseSummary = await this.generateExpertiseSummary(conversationHistory);
      // Create checkpoint request
      const checkpointRequest: CheckpointCreationRequest = {
        title,
        description: description || `Checkpoint of ${title}`,
        tags: tags || ['auto-generated'],
        expertise_summary: expertiseSummary,
        include_full_conversation: true,
        analytics_enabled: true
      };
      // Save checkpoint
      const checkpointId = await CheckpointManager.saveCheckpoint(
        agentId,
        conversationThread.id,
        checkpointRequest
      );
      console.log(`✅ Checkpoint created successfully: ${checkpointId}`);
      return checkpointId;
    } catch (error) {
      console.error(`❌ Failed to create checkpoint:`, error);
      throw new Error(`Failed to create checkpoint: ${error}`);
    }
  }
  async restoreFromCheckpoint(
    workspaceId: string,
    agentId: string,
    checkpointId: string
  ): Promise<void> {
    console.log(`🔄 Restoring agent ${agentId} from checkpoint ${checkpointId}`);
    try {
      // Load checkpoint
      const checkpoint = await CheckpointManager.loadCheckpoint(checkpointId);
      if (checkpoint.workspace_id !== workspaceId) {
        throw new Error(`Checkpoint ${checkpointId} is not from workspace ${workspaceId}`);
      }
      // Restore conversation state
      await this.restoreConversationState(workspaceId, agentId, checkpoint);
      // Update checkpoint analytics
      await CheckpointManager.updateCheckpointAnalytics(checkpointId, 0);
      console.log(`✅ Agent restored from checkpoint successfully`);
    } catch (error) {
      console.error(`❌ Failed to restore from checkpoint:`, error);
      throw new Error(`Failed to restore from checkpoint: ${error}`);
    }
  }
  async searchCheckpoints(query: CheckpointSearchQuery): Promise<CheckpointSearchResult> {
    console.log(`🔍 Searching checkpoints with query: ${query.query}`);
    try {
      return await CheckpointManager.searchCheckpoints(query);
    } catch (error) {
      console.error(`❌ Failed to search checkpoints:`, error);
      throw new Error(`Failed to search checkpoints: ${error}`);
    }
  }
  async getRecommendedCheckpoints(workspaceId: string, limit: number = 5): Promise<AgentCheckpoint[]> {
    console.log(`💡 Getting recommended checkpoints for workspace ${workspaceId}`);
    try {
      // Create a basic workspace context snapshot
      const workspaceContext = {
        timestamp: new Date().toISOString(),
        workspace_structure: {
          context_items: [],
          target_files: [],
          feedback_files: []
        },
        git_state: {
          branch: 'main',
          commit_hash: '',
          modified_files: [],
          staged_files: []
        },
        context_description: `Workspace ${workspaceId} context`
      };
      return await CheckpointManager.getRecommendedCheckpoints(workspaceContext, limit);
    } catch (error) {
      console.error(`❌ Failed to get recommended checkpoints:`, error);
      throw new Error(`Failed to get recommended checkpoints: ${error}`);
    }
  }
  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    console.log(`🗑️ Deleting checkpoint ${checkpointId}`);
    try {
      return await CheckpointManager.deleteCheckpoint(checkpointId);
    } catch (error) {
      console.error(`❌ Failed to delete checkpoint:`, error);
      throw new Error(`Failed to delete checkpoint: ${error}`);
    }
  }
  async getCheckpointStats(): Promise<{
    total_checkpoints: number;
    total_size_bytes: number;
    average_size_bytes: number;
    most_used_tags: string[];
    most_common_expertise: string[];
  }> {
    console.log(`📊 Getting checkpoint storage statistics`);
    try {
      return await CheckpointManager.getStorageStats();
    } catch (error) {
      console.error(`❌ Failed to get checkpoint stats:`, error);
      throw new Error(`Failed to get checkpoint stats: ${error}`);
    }
  }
  // Helper method to get agent data (placeholder - needs to be implemented based on actual agent storage)
  async getAgent(agentId: string): Promise<Agent | null> {
    // This is a placeholder implementation
    return {
      id: agentId,
      workspace_id: 'unknown',
      name: 'Agent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active',
      color: '#007bff',
      model: 'claude-3-5-sonnet-20241022',
      preferred_model: 'claude',
      model_config: {},
      permissions: {
        read_context: true,
        read_target: true,
        write_target: true,
        write_feedback: true,
        git_read: true,
        git_stage: true,
        git_commit: true,
        git_push: false,
        bash_execution: true,
        file_operations: ['read', 'write'],
        workspace_boundary: true,
        deletion_approval: true,
        max_commands_per_session: 100,
        command_cooldown_ms: 0
      },
      allowed_commands: ['bash', 'git', 'file'],
      conversation_id: `${agentId}-conversation`,
      metrics: {
        total_messages: 0,
        total_commands_used: 0,
        commands_by_type: {},
        session_duration_ms: 0,
        human_interventions: [],
        performance_scores: {
          task_completion_rate: 0.8,
          error_rate: 0.1,
          context_understanding: 0.9
        }
      }
    };
  }
  // Helper method to get conversation history in thread format
  async getConversationHistory(workspaceId: string, agentId: string): Promise<ConversationThread | null> {
    try {
      const messages = await this.loadConversationHistory(workspaceId, agentId);
      if (messages.length === 0) {
        return null;
      }
      return {
        id: `${agentId}-${Date.now()}`,
        agent_id: agentId,
        workspace_id: workspaceId,
        created_at: messages[0]?.timestamp || new Date().toISOString(),
        updated_at: messages[messages.length - 1]?.timestamp || new Date().toISOString(),
        messages,
        context_snapshot: {
          timestamp: new Date().toISOString(),
          workspace_structure: {
            context_items: [],
            target_files: [],
            feedback_files: []
          },
          git_state: {
            branch: 'main',
            commit_hash: '',
            modified_files: [],
            staged_files: []
          },
          context_description: `Conversation history for agent ${agentId}`
        },
        is_checkpoint: false,
        total_tokens_used: 0,
        commands_executed: [],
        status: 'active'
      };
    } catch (error) {
      console.error(`Failed to get conversation history:`, error);
      return null;
    }
  }
  // Private helper methods
  private async generateExpertiseSummary(conversationHistory: ConversationMessage[]): Promise<string> {
    if (conversationHistory.length === 0) {
      return 'No conversation history available';
    }
    const recentMessages = conversationHistory.slice(-10);
    const topics = new Set<string>();
    recentMessages.forEach(msg => {
      const content = msg.content.toLowerCase();
      // Extract technical topics
      if (content.includes('react') || content.includes('jsx') || content.includes('component')) {
        topics.add('React development');
      }
      if (content.includes('typescript') || content.includes('type') || content.includes('interface')) {
        topics.add('TypeScript');
      }
      if (content.includes('api') || content.includes('endpoint') || content.includes('request')) {
        topics.add('API development');
      }
      if (content.includes('database') || content.includes('sql') || content.includes('query')) {
        topics.add('Database operations');
      }
      if (content.includes('git') || content.includes('commit') || content.includes('branch')) {
        topics.add('Version control');
      }
      if (content.includes('test') || content.includes('jest') || content.includes('spec')) {
        topics.add('Testing');
      }
      if (content.includes('deploy') || content.includes('build') || content.includes('ci/cd')) {
        topics.add('Deployment');
      }
    });
    const topicList = Array.from(topics);
    return topicList.length > 0
      ? `Expert in: ${topicList.join(', ')}`
      : 'General development assistance';
  }
  private async restoreConversationState(
    workspaceId: string,
    agentId: string,
    checkpoint: AgentCheckpoint
  ): Promise<void> {
    try {
      // Restore conversation messages
      const conversationPath = path.join(
        this.workspaceBasePath,
        workspaceId,
        'agents',
        agentId,
        'conversation.json'
      );
      // Ensure directory exists
      await fs.mkdir(path.dirname(conversationPath), { recursive: true });
      // Save checkpoint conversation history
      await fs.writeFile(
        conversationPath,
        JSON.stringify(checkpoint.full_conversation_state.messages, null, 2)
      );
      // Create a restore marker
      const restoreMarkerPath = path.join(
        this.workspaceBasePath,
        workspaceId,
        'agents',
        agentId,
        'checkpoint-restore.json'
      );
      await fs.writeFile(restoreMarkerPath, JSON.stringify({
        restored_from: checkpoint.id,
        restored_at: new Date().toISOString(),
        original_title: checkpoint.title,
        original_description: checkpoint.description
      }, null, 2));
    } catch (error) {
      throw new Error(`Failed to restore conversation state: ${error}`);
    }
  }
  cleanup(): void {
    console.log('🧹 Cleaning up AgentService...');
    this.claudeService.cleanup();
    this.geminiService.cleanup();
  }
}
// Export singleton instance for API routes
export const agentService = new AgentService();