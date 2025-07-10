import fs from 'fs/promises';
import path from 'path';
import {
  AgentCheckpoint,
  CheckpointIndex,
  CheckpointSummary,
  CheckpointSearchQuery,
  CheckpointSearchResult,
  CheckpointValidation,
  validateAgentCheckpoint
} from '../types/checkpoints';
export class CheckpointStorage {
  private static readonly STORAGE_BASE = 'storage/checkpoints';
  private static readonly INDEX_FILE = 'checkpoint-index.json';
  private static readonly METADATA_FILE = 'checkpoint-metadata.json';
  static async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.STORAGE_BASE, { recursive: true });
      await fs.mkdir(path.join(this.STORAGE_BASE, 'data'), { recursive: true });
      await fs.mkdir(path.join(this.STORAGE_BASE, 'summaries'), { recursive: true });
      await fs.mkdir(path.join(this.STORAGE_BASE, 'analytics'), { recursive: true });
      // Create index file if it doesn't exist
      const indexPath = path.join(this.STORAGE_BASE, this.INDEX_FILE);
      try {
        await fs.access(indexPath);
      } catch {
        const emptyIndex: CheckpointIndex = {
          last_updated: new Date().toISOString(),
          checkpoints: {},
          search_metadata: {
            tag_frequency: {},
            context_type_frequency: {},
            expertise_areas: []
          }
        };
        await fs.writeFile(indexPath, JSON.stringify(emptyIndex, null, 2));
      }
    } catch (error) {
      throw new Error(`Failed to initialize checkpoint storage: ${error}`);
    }
  }
  static async saveCheckpoint(checkpoint: AgentCheckpoint): Promise<string> {
    // Validate checkpoint before saving
    const validation = validateAgentCheckpoint(checkpoint);
    if (!validation.is_valid) {
      throw new Error(`Invalid checkpoint: ${validation.errors.join(', ')}`);
    }
    try {
      await this.initialize();
      // Save full checkpoint data
      const dataPath = path.join(this.STORAGE_BASE, 'data', `${checkpoint.id}.json`);
      await fs.writeFile(dataPath, JSON.stringify(checkpoint, null, 2));
      // Save checkpoint summary
      const summary: CheckpointSummary = {
        id: checkpoint.id,
        title: checkpoint.title,
        description: checkpoint.description,
        tags: checkpoint.tags,
        workspace_context_types: checkpoint.context_types,
        expertise_areas: checkpoint.expertise_areas,
        performance_score: checkpoint.performance_metrics.success_rate,
        usage_count: checkpoint.usage_count,
        last_used: checkpoint.last_used,
        conversation_preview: this.generateConversationPreview(checkpoint),
        knowledge_areas: checkpoint.expertise_areas,
        created_by: checkpoint.created_by,
        created_at: checkpoint.created_at
      };
      const summaryPath = path.join(this.STORAGE_BASE, 'summaries', `${checkpoint.id}.json`);
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
      // Update index
      await this.updateIndex(checkpoint);
      return checkpoint.id;
    } catch (error) {
      throw new Error(`Failed to save checkpoint: ${error}`);
    }
  }
  static async loadCheckpoint(checkpointId: string): Promise<AgentCheckpoint> {
    try {
      const dataPath = path.join(this.STORAGE_BASE, 'data', `${checkpointId}.json`);
      const data = await fs.readFile(dataPath, 'utf-8');
      const checkpoint = JSON.parse(data) as AgentCheckpoint;
      // Update usage tracking
      checkpoint.usage_count += 1;
      checkpoint.last_used = new Date().toISOString();
      // Save updated checkpoint
      await fs.writeFile(dataPath, JSON.stringify(checkpoint, null, 2));
      await this.updateIndex(checkpoint);
      return checkpoint;
    } catch (error) {
      throw new Error(`Failed to load checkpoint ${checkpointId}: ${error}`);
    }
  }
  static async searchCheckpoints(query: CheckpointSearchQuery): Promise<CheckpointSearchResult> {
    const startTime = Date.now();
    try {
      await this.initialize();
      const summaries = await this.loadAllSummaries();
      // Filter checkpoints based on query
      let filteredCheckpoints = summaries;
      // Text search
      if (query.query && query.query.trim()) {
        const searchTerms = query.query.toLowerCase().split(' ');
        filteredCheckpoints = filteredCheckpoints.filter(checkpoint => {
          const searchText = `${checkpoint.title} ${checkpoint.description} ${checkpoint.tags.join(' ')} ${checkpoint.expertise_areas.join(' ')}`.toLowerCase();
          return searchTerms.every(term => searchText.includes(term));
        });
      }
      // Apply filters
      if (query.filters.context_types.length > 0) {
        filteredCheckpoints = filteredCheckpoints.filter(checkpoint =>
          query.filters.context_types.some(type => checkpoint.workspace_context_types.includes(type))
        );
      }
      if (query.filters.expertise_areas.length > 0) {
        filteredCheckpoints = filteredCheckpoints.filter(checkpoint =>
          query.filters.expertise_areas.some(area => checkpoint.expertise_areas.includes(area))
        );
      }
      if (query.filters.tags.length > 0) {
        filteredCheckpoints = filteredCheckpoints.filter(checkpoint =>
          query.filters.tags.some(tag => checkpoint.tags.includes(tag))
        );
      }
      if (query.filters.performance_threshold > 0) {
        filteredCheckpoints = filteredCheckpoints.filter(checkpoint =>
          checkpoint.performance_score >= query.filters.performance_threshold
        );
      }
      if (query.filters.recently_used) {
        const recentThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        filteredCheckpoints = filteredCheckpoints.filter(checkpoint =>
          checkpoint.last_used && new Date(checkpoint.last_used) > recentThreshold
        );
      }
      // Sort results
      filteredCheckpoints.sort((a, b) => {
        switch (query.sort_by) {
          case 'performance':
            return b.performance_score - a.performance_score;
          case 'usage':
            return b.usage_count - a.usage_count;
          case 'recent':
            return new Date(b.last_used || b.created_at).getTime() - new Date(a.last_used || a.created_at).getTime();
          case 'created':
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          default: // relevance
            return b.performance_score - a.performance_score;
        }
      });
      // Apply pagination
      const total = filteredCheckpoints.length;
      const results = filteredCheckpoints.slice(query.offset, query.offset + query.limit);
      // Generate suggestions
      const allTags = [...new Set(summaries.flatMap(c => c.tags))];
      const allExpertise = [...new Set(summaries.flatMap(c => c.expertise_areas))];
      const searchTime = Date.now() - startTime;
      return {
        checkpoints: results,
        total_count: total,
        search_time_ms: searchTime,
        suggested_tags: allTags.slice(0, 10),
        related_expertise: allExpertise.slice(0, 10)
      };
    } catch (error) {
      throw new Error(`Failed to search checkpoints: ${error}`);
    }
  }
  static async getAllCheckpointSummaries(): Promise<CheckpointSummary[]> {
    try {
      await this.initialize();
      return await this.loadAllSummaries();
    } catch (error) {
      throw new Error(`Failed to get checkpoint summaries: ${error}`);
    }
  }
  static async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    try {
      const dataPath = path.join(this.STORAGE_BASE, 'data', `${checkpointId}.json`);
      const summaryPath = path.join(this.STORAGE_BASE, 'summaries', `${checkpointId}.json`);
      const analyticsPath = path.join(this.STORAGE_BASE, 'analytics', `${checkpointId}.json`);
      // Delete files
      await fs.unlink(dataPath);
      await fs.unlink(summaryPath);
      // Delete analytics file if it exists
      try {
        await fs.unlink(analyticsPath);
      } catch {
        // Analytics file might not exist, that's okay
      }
      // Update index
      await this.removeFromIndex(checkpointId);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete checkpoint ${checkpointId}: ${error}`);
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
      await this.initialize();
      const summaries = await this.loadAllSummaries();
      const dataDir = path.join(this.STORAGE_BASE, 'data');
      const files = await fs.readdir(dataDir);
      let totalSize = 0;
      for (const file of files) {
        const stats = await fs.stat(path.join(dataDir, file));
        totalSize += stats.size;
      }
      const tagCount: Record<string, number> = {};
      const expertiseCount: Record<string, number> = {};
      summaries.forEach(summary => {
        summary.tags.forEach(tag => {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
        summary.expertise_areas.forEach(area => {
          expertiseCount[area] = (expertiseCount[area] || 0) + 1;
        });
      });
      const mostUsedTags = Object.entries(tagCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([tag]) => tag);
      const mostCommonExpertise = Object.entries(expertiseCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([expertise]) => expertise);
      return {
        total_checkpoints: summaries.length,
        total_size_bytes: totalSize,
        average_size_bytes: totalSize / Math.max(summaries.length, 1),
        most_used_tags: mostUsedTags,
        most_common_expertise: mostCommonExpertise
      };
    } catch (error) {
      throw new Error(`Failed to get storage stats: ${error}`);
    }
  }
  // Private helper methods
  private static async loadAllSummaries(): Promise<CheckpointSummary[]> {
    try {
      const summariesDir = path.join(this.STORAGE_BASE, 'summaries');
      const files = await fs.readdir(summariesDir);
      const summaries: CheckpointSummary[] = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(summariesDir, file), 'utf-8');
          summaries.push(JSON.parse(content));
        }
      }
      return summaries;
    } catch (error) {
      throw new Error(`Failed to load checkpoint summaries: ${error}`);
    }
  }
  private static async updateIndex(checkpoint: AgentCheckpoint): Promise<void> {
    try {
      const indexPath = path.join(this.STORAGE_BASE, this.INDEX_FILE);
      let index: CheckpointIndex;
      try {
        const indexData = await fs.readFile(indexPath, 'utf-8');
        index = JSON.parse(indexData);
      } catch {
        index = {
          last_updated: new Date().toISOString(),
          checkpoints: {},
          search_metadata: {
            tag_frequency: {},
            context_type_frequency: {},
            expertise_areas: []
          }
        };
      }
      // Update checkpoint entry
      index.checkpoints[checkpoint.id] = {
        title: checkpoint.title,
        description: checkpoint.description,
        tags: checkpoint.tags,
        workspace_context_types: checkpoint.context_types,
        agent_expertise: checkpoint.expertise_areas,
        performance_score: checkpoint.performance_metrics.success_rate,
        usage_count: checkpoint.usage_count,
        created_by: checkpoint.created_by,
        created_at: checkpoint.created_at,
        last_used: checkpoint.last_used
      };
      // Update metadata
      checkpoint.tags.forEach(tag => {
        index.search_metadata.tag_frequency[tag] = (index.search_metadata.tag_frequency[tag] || 0) + 1;
      });
      checkpoint.context_types.forEach(type => {
        index.search_metadata.context_type_frequency[type] = (index.search_metadata.context_type_frequency[type] || 0) + 1;
      });
      // Update expertise areas
      const expertiseSet = new Set(index.search_metadata.expertise_areas);
      checkpoint.expertise_areas.forEach(area => expertiseSet.add(area));
      index.search_metadata.expertise_areas = Array.from(expertiseSet);
      index.last_updated = new Date().toISOString();
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    } catch (error) {
      throw new Error(`Failed to update index: ${error}`);
    }
  }
  private static async removeFromIndex(checkpointId: string): Promise<void> {
    try {
      const indexPath = path.join(this.STORAGE_BASE, this.INDEX_FILE);
      const indexData = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexData) as CheckpointIndex;
      delete index.checkpoints[checkpointId];
      index.last_updated = new Date().toISOString();
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    } catch (error) {
      throw new Error(`Failed to remove from index: ${error}`);
    }
  }
  private static generateConversationPreview(checkpoint: AgentCheckpoint): string {
    if (!checkpoint.full_conversation_state.messages || checkpoint.full_conversation_state.messages.length === 0) {
      return 'No conversation preview available';
    }
    const lastMessage = checkpoint.full_conversation_state.messages[checkpoint.full_conversation_state.messages.length - 1];
    const preview = lastMessage.content.substring(0, 150);
    return preview.length < lastMessage.content.length ? preview + '...' : preview;
  }
}