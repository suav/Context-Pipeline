import {
  AgentCheckpoint,
  CheckpointCreationRequest,
  CheckpointSearchQuery,
  CheckpointSearchResult,
  CheckpointSummary,
  CheckpointMetrics,
  CheckpointAnalyticsSummary,
  WorkspaceContextSnapshot,
  validateAgentCheckpoint
} from '../types/checkpoints';
import { Agent } from '../types/index';
import { ConversationThread } from '../types/conversation';
import { CheckpointStorage } from '../storage/CheckpointStorage';
import { AgentService } from './AgentService';
import { AgentStorageManager } from '../storage/AgentStorageManager';
import { v4 as uuidv4 } from 'uuid';
export class CheckpointManager {
  static async saveCheckpoint(
    agentId: string,
    conversationId: string,
    request: CheckpointCreationRequest
  ): Promise<string> {
    try {
      // Get agent information
      const agent = await AgentService.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      // Get conversation history
      const conversation = await AgentService.getConversationHistory(agent.workspace_id, agentId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      // Get workspace context
      const workspaceContext = request.context_snapshot_override ||
        await this.captureWorkspaceContext(agent.workspace_id);
      // Calculate performance metrics
      const performanceMetrics = await this.calculatePerformanceMetrics(agent, conversation);
      // Generate checkpoint ID
      const checkpointId = uuidv4();
      // Extract expertise areas from conversation
      const expertiseAreas = this.extractExpertiseAreas(conversation, request.expertise_summary);
      // Extract context types from workspace
      const contextTypes = this.extractContextTypes(workspaceContext);
      // Create analytics summary
      const analyticsSummary: CheckpointAnalyticsSummary = {
        total_sessions: 1,
        successful_restorations: 0,
        average_continuation_length: 0,
        user_feedback_score: 0,
        most_common_use_cases: [],
        effectiveness_rating: performanceMetrics.success_rate * 5 // Convert to 5-point scale
      };
      // Create the checkpoint
      const checkpoint: AgentCheckpoint = {
        id: checkpointId,
        title: request.title,
        description: request.description,
        agentType: agent.preferred_model,
        conversation_id: conversationId,
        workspace_context: workspaceContext,
        expertise_summary: request.expertise_summary,
        performance_metrics: performanceMetrics,
        tags: request.tags,
        created_at: new Date().toISOString(),
        usage_count: 0,
        // Extended data
        agent_id: agentId,
        workspace_id: agent.workspace_id,
        created_by: 'system',
        // State preservation
        full_conversation_state: {
          messages: conversation.messages,
          total_tokens: conversation.total_tokens_used,
          command_history: conversation.commands_executed,
          knowledge_areas: expertiseAreas,
          learned_patterns: this.extractLearnedPatterns(conversation),
          conversation_summary: this.generateConversationSummary(conversation)
        },
        agent_configuration: {
          model: agent.model,
          permissions: agent.permissions,
          specialized_commands: agent.allowed_commands,
          context_understanding: this.assessContextUnderstanding(conversation, workspaceContext),
          performance_metrics: agent.metrics
        },
        // Enhanced metadata
        expertise_areas: expertiseAreas,
        context_types: contextTypes,
        success_indicators: this.extractSuccessIndicators(conversation),
        // Analytics
        analytics_summary: analyticsSummary
      };
      // Validate checkpoint
      const validation = validateAgentCheckpoint(checkpoint);
      if (!validation.is_valid) {
        throw new Error(`Invalid checkpoint: ${validation.errors.join(', ')}`);
      }
      // Save checkpoint
      const savedId = await CheckpointStorage.saveCheckpoint(checkpoint);
      // Update agent storage manager
      const storageManager = new AgentStorageManager();
      await storageManager.markAgentCheckpointed(agent.workspace_id, agentId, savedId);
      await storageManager.saveCheckpointMetadata(agent.workspace_id, agentId, checkpoint);
      return savedId;
    } catch (error) {
      throw new Error(`Failed to save checkpoint: ${error}`);
    }
  }
  static async loadCheckpoint(checkpointId: string): Promise<AgentCheckpoint> {
    try {
      return await CheckpointStorage.loadCheckpoint(checkpointId);
    } catch (error) {
      throw new Error(`Failed to load checkpoint ${checkpointId}: ${error}`);
    }
  }
  static async searchCheckpoints(query: CheckpointSearchQuery): Promise<CheckpointSearchResult> {
    try {
      return await CheckpointStorage.searchCheckpoints(query);
    } catch (error) {
      throw new Error(`Failed to search checkpoints: ${error}`);
    }
  }
  static async getRecommendedCheckpoints(
    workspaceContext: WorkspaceContextSnapshot,
    limit: number = 10
  ): Promise<AgentCheckpoint[]> {
    try {
      // Extract context characteristics
      const contextTypes = this.extractContextTypes(workspaceContext);
      const contextDescription = workspaceContext.context_description.toLowerCase();
      // Build search query
      const searchQuery: CheckpointSearchQuery = {
        query: contextDescription,
        filters: {
          context_types: contextTypes,
          expertise_areas: [],
          performance_threshold: 0.7, // Only recommend high-performing checkpoints
          recently_used: false,
          my_checkpoints: false,
          tags: [],
          created_date_range: undefined
        },
        sort_by: 'performance',
        limit,
        offset: 0
      };
      const results = await this.searchCheckpoints(searchQuery);
      // Load full checkpoint data for recommendations
      const recommendations: AgentCheckpoint[] = [];
      for (const summary of results.checkpoints) {
        try {
          const checkpoint = await this.loadCheckpoint(summary.id);
          recommendations.push(checkpoint);
        } catch (error) {
          console.warn(`Failed to load recommended checkpoint ${summary.id}:`, error);
        }
      }
      return recommendations;
    } catch (error) {
      throw new Error(`Failed to get recommended checkpoints: ${error}`);
    }
  }
  static async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    try {
      // Load checkpoint to get agent and workspace info
      const checkpoint = await CheckpointStorage.loadCheckpoint(checkpointId);
      // Delete from storage
      const success = await CheckpointStorage.deleteCheckpoint(checkpointId);
      if (success) {
        // Update agent storage manager
        const storageManager = new AgentStorageManager();
        await storageManager.removeCheckpointMetadata(
          checkpoint.workspace_id,
          checkpoint.agent_id,
          checkpointId
        );
      }
      return success;
    } catch (error) {
      throw new Error(`Failed to delete checkpoint ${checkpointId}: ${error}`);
    }
  }
  static async getAllCheckpointSummaries(): Promise<CheckpointSummary[]> {
    try {
      return await CheckpointStorage.getAllCheckpointSummaries();
    } catch (error) {
      throw new Error(`Failed to get checkpoint summaries: ${error}`);
    }
  }
  static async getStorageStats(): Promise<{
    total_checkpoints: number;
    total_size_bytes: number;
    average_size_bytes: number;
    most_used_tags: string[];
    most_common_expertise: string[];
  }> {
    try {
      return await CheckpointStorage.getStorageStats();
    } catch (error) {
      throw new Error(`Failed to get storage stats: ${error}`);
    }
  }
  static async updateCheckpointAnalytics(
    checkpointId: string,
    sessionLength: number,
    userFeedback?: number
  ): Promise<void> {
    try {
      const checkpoint = await this.loadCheckpoint(checkpointId);
      // Update analytics
      checkpoint.analytics_summary.total_sessions += 1;
      checkpoint.analytics_summary.successful_restorations += 1;
      checkpoint.analytics_summary.average_continuation_length =
        (checkpoint.analytics_summary.average_continuation_length * (checkpoint.analytics_summary.total_sessions - 1) + sessionLength) /
        checkpoint.analytics_summary.total_sessions;
      if (userFeedback !== undefined) {
        checkpoint.analytics_summary.user_feedback_score =
          (checkpoint.analytics_summary.user_feedback_score * (checkpoint.analytics_summary.total_sessions - 1) + userFeedback) /
          checkpoint.analytics_summary.total_sessions;
      }
      // Recalculate effectiveness rating
      checkpoint.analytics_summary.effectiveness_rating =
        (checkpoint.performance_metrics.success_rate * 0.4 +
         checkpoint.analytics_summary.user_feedback_score / 5 * 0.6) * 5;
      await CheckpointStorage.saveCheckpoint(checkpoint);
    } catch (error) {
      throw new Error(`Failed to update checkpoint analytics: ${error}`);
    }
  }
  // Private helper methods
  private static async captureWorkspaceContext(workspaceId: string): Promise<WorkspaceContextSnapshot> {
    // This would typically involve reading the workspace structure, git state, etc.
    return {
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
      context_description: 'Workspace context snapshot'
    };
  }
  private static async calculatePerformanceMetrics(
    agent: Agent,
    conversation: ConversationThread
  ): Promise<CheckpointMetrics> {
    // Calculate metrics based on agent and conversation data
    const totalCommands = conversation.commands_executed.length;
    const successfulCommands = conversation.commands_executed.filter(cmd => cmd.success).length;
    const avgResponseTime = conversation.commands_executed.reduce((sum, cmd) => sum + cmd.execution_time_ms, 0) / totalCommands || 0;
    return {
      success_rate: totalCommands > 0 ? successfulCommands / totalCommands : 1.0,
      avg_response_time: avgResponseTime,
      user_satisfaction: 4.0,
      task_completion_rate: 0.85,
      // Extended metrics
      commands_executed: totalCommands,
      errors_encountered: totalCommands - successfulCommands,
      tokens_processed: conversation.total_tokens_used,
      context_understanding_score: agent.metrics.performance_scores.context_understanding,
      knowledge_retention_score: 0.8,
      adaptation_efficiency: 0.75
    };
  }
  private static extractExpertiseAreas(
    conversation: ConversationThread,
    expertiseSummary: string
  ): string[] {
    const areas: string[] = [];
    // Extract from expertise summary
    const summaryWords = expertiseSummary.toLowerCase().split(/\s+/);
    const expertiseKeywords = ['react', 'typescript', 'nodejs', 'api', 'database', 'git', 'testing', 'deployment'];
    expertiseKeywords.forEach(keyword => {
      if (summaryWords.includes(keyword)) {
        areas.push(keyword);
      }
    });
    // Extract from commands used
    const commandTypes = conversation.commands_executed.map(cmd => cmd.command_id);
    const uniqueCommands = [...new Set(commandTypes)];
    if (uniqueCommands.includes('git')) areas.push('version-control');
    if (uniqueCommands.includes('npm') || uniqueCommands.includes('yarn')) areas.push('package-management');
    if (uniqueCommands.includes('test')) areas.push('testing');
    return [...new Set(areas)];
  }
  private static extractContextTypes(context: WorkspaceContextSnapshot): string[] {
    const types: string[] = [];
    context.workspace_structure.context_items.forEach(item => {
      if (!types.includes(item.type)) {
        types.push(item.type);
      }
    });
    return types;
  }
  private static extractLearnedPatterns(conversation: ConversationThread): string[] {
    const patterns: string[] = [];
    // Analyze conversation for repeated patterns
    const messages = conversation.messages;
    const userQuestions = messages.filter(msg => msg.role === 'user');
    const assistantResponses = messages.filter(msg => msg.role === 'assistant');
    // Look for common question patterns
    if (userQuestions.some(msg => msg.content.toLowerCase().includes('error'))) {
      patterns.push('error-debugging');
    }
    if (assistantResponses.some(msg => msg.content.toLowerCase().includes('test'))) {
      patterns.push('test-driven-development');
    }
    if (conversation.commands_executed.some(cmd => cmd.command_id === 'git')) {
      patterns.push('git-workflow');
    }
    return patterns;
  }
  private static generateConversationSummary(conversation: ConversationThread): string {
    const messageCount = conversation.messages.length;
    const commandCount = conversation.commands_executed.length;
    const successRate = commandCount > 0 ?
      conversation.commands_executed.filter(cmd => cmd.success).length / commandCount : 0;
    return `Conversation with ${messageCount} messages, ${commandCount} commands executed (${Math.round(successRate * 100)}% success rate)`;
  }
  private static assessContextUnderstanding(
    conversation: ConversationThread,
    context: WorkspaceContextSnapshot
  ): Record<string, number> {
    const understanding: Record<string, number> = {};
    // Assess understanding of different context types
    context.workspace_structure.context_items.forEach(item => {
      understanding[item.type] = 0.8;
    });
    return understanding;
  }
  private static extractSuccessIndicators(conversation: ConversationThread): string[] {
    const indicators: string[] = [];
    const messages = conversation.messages;
    const lastMessages = messages.slice(-5); // Look at last 5 messages
    // Look for success indicators in recent messages
    lastMessages.forEach(msg => {
      if (msg.role === 'assistant' && msg.content.toLowerCase().includes('success')) {
        indicators.push('task-completion');
      }
      if (msg.role === 'user' && msg.content.toLowerCase().includes('thank')) {
        indicators.push('user-satisfaction');
      }
    });
    // Check command success rate
    const recentCommands = conversation.commands_executed.slice(-10);
    const recentSuccessRate = recentCommands.length > 0 ?
      recentCommands.filter(cmd => cmd.success).length / recentCommands.length : 0;
    if (recentSuccessRate > 0.8) {
      indicators.push('high-command-success');
    }
    return indicators;
  }
}