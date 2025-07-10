const crypto = require('crypto');
import fs from 'fs/promises';
import path from 'path';
import { Agent, AgentRegistry } from '../types';
import { AgentCheckpoint } from '../types/checkpoints';
export class AgentStorageManager {
  private workspaceBasePath: string;
  private globalStoragePath: string;
  constructor(workspaceBasePath?: string) {
    this.workspaceBasePath = workspaceBasePath || path.join(process.cwd(), 'storage', 'workspaces');
    this.globalStoragePath = path.join(process.cwd(), 'storage', 'agent-system');
  }
  // Agent CRUD Operations
  async createAgent(workspaceId: string, agentData: Omit<Agent, 'id' | 'created_at' | 'updated_at'>): Promise<Agent> {
    const agentId = this.generateAgentId();
    const timestamp = new Date().toISOString();
    const agent: Agent = {
      ...agentData,
      id: agentId,
      created_at: timestamp,
      updated_at: timestamp,
    };
    await this.ensureAgentDirectories(workspaceId, agentId);
    // Save agent configuration
    const agentPath = this.getAgentPath(workspaceId, agentId);
    await this.saveFile(path.join(agentPath, 'config.json'), agent);
    // Save permissions separately for easier access control
    await this.saveFile(path.join(agentPath, 'permissions.json'), agent.permissions);
    // Initialize metrics
    await this.saveFile(path.join(agentPath, 'metrics.json'), agent.metrics);
    // Update agent registry
    await this.updateAgentRegistry(workspaceId, agent, 'create');
    return agent;
  }
  async getAgent(workspaceId: string, agentId: string): Promise<Agent | null> {
    try {
      const agentPath = this.getAgentPath(workspaceId, agentId);
      const configPath = path.join(agentPath, 'config.json');
      const agentData = await this.loadFile<Agent>(configPath);
      return agentData;
    } catch (error) {
      console.error('Failed to load agent:', error);
      return null;
    }
  }
  async updateAgent(workspaceId: string, agentId: string, updates: Partial<Agent>): Promise<Agent | null> {
    const existingAgent = await this.getAgent(workspaceId, agentId);
    if (!existingAgent) {
      return null;
    }
    const updatedAgent: Agent = {
      ...existingAgent,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    const agentPath = this.getAgentPath(workspaceId, agentId);
    // Save updated configuration
    await this.saveFile(path.join(agentPath, 'config.json'), updatedAgent);
    // Update specific files if they changed
    if (updates.permissions) {
      await this.saveFile(path.join(agentPath, 'permissions.json'), updatedAgent.permissions);
    }
    if (updates.metrics) {
      await this.saveFile(path.join(agentPath, 'metrics.json'), updatedAgent.metrics);
    }
    // Update agent registry
    await this.updateAgentRegistry(workspaceId, updatedAgent, 'update');
    return updatedAgent;
  }
  async deleteAgent(workspaceId: string, agentId: string): Promise<boolean> {
    try {
      const agentPath = this.getAgentPath(workspaceId, agentId);
      // Create backup before deletion
      const backupPath = path.join(agentPath, '..', 'backups', `${agentId}-${Date.now()}`);
      await fs.mkdir(backupPath, { recursive: true });
      await this.copyDirectory(agentPath, backupPath);
      // Remove agent directory
      await fs.rm(agentPath, { recursive: true, force: true });
      // Update agent registry
      await this.updateAgentRegistry(workspaceId, { id: agentId } as Agent, 'delete');
      return true;
    } catch (error) {
      console.error('Failed to delete agent:', error);
      return false;
    }
  }
  async listWorkspaceAgents(workspaceId: string): Promise<Agent[]> {
    try {
      const agentsPath = path.join(this.workspaceBasePath, workspaceId, 'agents');
      const entries = await fs.readdir(agentsPath, { withFileTypes: true });
      const agents: Agent[] = [];
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('agent-')) {
          const agentId = entry.name.replace('agent-', '');
          const agent = await this.getAgent(workspaceId, agentId);
          if (agent) {
            agents.push(agent);
          }
        }
      }
      return agents;
    } catch (error) {
      console.error('Failed to list agents:', error);
      return [];
    }
  }
  // Agent Registry Management
  async getAgentRegistry(workspaceId: string): Promise<AgentRegistry> {
    try {
      const registryPath = path.join(this.workspaceBasePath, workspaceId, 'agents', 'agents-registry.json');
      const registry = await this.loadFile<AgentRegistry>(registryPath);
      return registry;
    } catch (error) {
      // Create default registry if it doesn't exist
      const defaultRegistry: AgentRegistry = {
        workspace_id: workspaceId,
        last_updated: new Date().toISOString(),
        active_agents: {},
        agent_history: {
          created: [],
          deleted: [],
          checkpointed: []
        }
      };
      await this.saveAgentRegistry(workspaceId, defaultRegistry);
      return defaultRegistry;
    }
  }
  async saveAgentRegistry(workspaceId: string, registry: AgentRegistry): Promise<void> {
    const registryPath = path.join(this.workspaceBasePath, workspaceId, 'agents', 'agents-registry.json');
    await this.ensureDirectory(path.dirname(registryPath));
    await this.saveFile(registryPath, registry);
  }
  private async updateAgentRegistry(workspaceId: string, agent: Agent, action: 'create' | 'update' | 'delete'): Promise<void> {
    const registry = await this.getAgentRegistry(workspaceId);
    switch (action) {
      case 'create':
        registry.active_agents[agent.id] = {
          name: agent.name,
          status: agent.status,
          last_activity: agent.updated_at,
          conversation_id: agent.conversation_id,
          checkpoint_base: agent.checkpoint_base,
          color: agent.color
        };
        registry.agent_history.created.push(agent.id);
        break;
      case 'update':
        if (registry.active_agents[agent.id]) {
          registry.active_agents[agent.id] = {
            name: agent.name,
            status: agent.status,
            last_activity: agent.updated_at,
            conversation_id: agent.conversation_id,
            checkpoint_base: agent.checkpoint_base,
            color: agent.color
          };
        }
        break;
      case 'delete':
        delete registry.active_agents[agent.id];
        registry.agent_history.deleted.push(agent.id);
        break;
    }
    registry.last_updated = new Date().toISOString();
    await this.saveAgentRegistry(workspaceId, registry);
  }
  // Checkpoint Integration Methods
  async markAgentCheckpointed(workspaceId: string, agentId: string, checkpointId: string): Promise<void> {
    const registry = await this.getAgentRegistry(workspaceId);
    // Add checkpoint to agent history
    if (!registry.agent_history.checkpointed.includes(agentId)) {
      registry.agent_history.checkpointed.push(agentId);
    }
    // Update active agent status
    if (registry.active_agents[agentId]) {
      registry.active_agents[agentId].checkpoint_base = checkpointId;
      registry.active_agents[agentId].last_activity = new Date().toISOString();
    }
    registry.last_updated = new Date().toISOString();
    await this.saveAgentRegistry(workspaceId, registry);
  }
  async saveCheckpointMetadata(workspaceId: string, agentId: string, checkpoint: AgentCheckpoint): Promise<void> {
    try {
      const agentPath = this.getAgentPath(workspaceId, agentId);
      const checkpointsPath = path.join(agentPath, 'checkpoints');
      // Ensure checkpoints directory exists
      await this.ensureDirectory(checkpointsPath);
      // Save checkpoint metadata
      const metadataPath = path.join(checkpointsPath, `${checkpoint.id}-metadata.json`);
      const metadata = {
        id: checkpoint.id,
        title: checkpoint.title,
        description: checkpoint.description,
        created_at: checkpoint.created_at,
        tags: checkpoint.tags,
        expertise_areas: checkpoint.expertise_areas,
        performance_score: checkpoint.performance_metrics.success_rate,
        usage_count: checkpoint.usage_count,
        last_used: checkpoint.last_used
      };
      await this.saveFile(metadataPath, metadata);
      // Update checkpoint index for this agent
      await this.updateAgentCheckpointIndex(workspaceId, agentId, checkpoint);
    } catch (error) {
      console.error('Failed to save checkpoint metadata:', error);
      throw new Error(`Failed to save checkpoint metadata: ${error}`);
    }
  }
  async getAgentCheckpoints(workspaceId: string, agentId: string): Promise<any[]> {
    try {
      const agentPath = this.getAgentPath(workspaceId, agentId);
      const checkpointsPath = path.join(agentPath, 'checkpoints');
      // Check if checkpoints directory exists
      try {
        await fs.access(checkpointsPath);
      } catch {
        return [];
      }
      const files = await fs.readdir(checkpointsPath);
      const metadataFiles = files.filter(file => file.endsWith('-metadata.json'));
      const checkpoints: any[] = [];
      for (const file of metadataFiles) {
        try {
          const metadata = await this.loadFile(path.join(checkpointsPath, file));
          checkpoints.push(metadata);
        } catch (error) {
          console.warn(`Failed to load checkpoint metadata ${file}:`, error);
        }
      }
      // Sort by creation date (newest first)
      return checkpoints.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error) {
      console.error('Failed to get agent checkpoints:', error);
      return [];
    }
  }
  async removeCheckpointMetadata(workspaceId: string, agentId: string, checkpointId: string): Promise<void> {
    try {
      const agentPath = this.getAgentPath(workspaceId, agentId);
      const checkpointsPath = path.join(agentPath, 'checkpoints');
      const metadataPath = path.join(checkpointsPath, `${checkpointId}-metadata.json`);
      // Remove metadata file
      try {
        await fs.unlink(metadataPath);
      } catch {
        // File might not exist, that's okay
      }
      // Update checkpoint index
      await this.removeFromAgentCheckpointIndex(workspaceId, agentId, checkpointId);
    } catch (error) {
      console.error('Failed to remove checkpoint metadata:', error);
    }
  }
  async updateAgentFromCheckpoint(
    workspaceId: string,
    agentId: string,
    checkpoint: AgentCheckpoint
  ): Promise<Agent | null> {
    try {
      const agent = await this.getAgent(workspaceId, agentId);
      if (!agent) {
        return null;
      }
      // Update agent with checkpoint information
      const updates: Partial<Agent> = {
        last_checkpoint: checkpoint.id,
        status: 'active',
        // Restore agent configuration from checkpoint
        permissions: checkpoint.agent_configuration.permissions,
        allowed_commands: checkpoint.agent_configuration.specialized_commands,
        metrics: checkpoint.agent_configuration.performance_metrics
      };
      return await this.updateAgent(workspaceId, agentId, updates);
    } catch (error) {
      console.error('Failed to update agent from checkpoint:', error);
      return null;
    }
  }
  // Private checkpoint helper methods
  private async updateAgentCheckpointIndex(
    workspaceId: string,
    agentId: string,
    checkpoint: AgentCheckpoint
  ): Promise<void> {
    try {
      const agentPath = this.getAgentPath(workspaceId, agentId);
      const indexPath = path.join(agentPath, 'checkpoints', 'index.json');
      let index: any = {};
      try {
        index = await this.loadFile(indexPath);
      } catch {
        index = {
          agent_id: agentId,
          workspace_id: workspaceId,
          last_updated: new Date().toISOString(),
          checkpoints: {},
          summary: {
            total_checkpoints: 0,
            latest_checkpoint: null,
            most_used_tags: [],
            expertise_areas: []
          }
        };
      }
      // Add checkpoint to index
      index.checkpoints[checkpoint.id] = {
        id: checkpoint.id,
        title: checkpoint.title,
        created_at: checkpoint.created_at,
        tags: checkpoint.tags,
        expertise_areas: checkpoint.expertise_areas,
        usage_count: checkpoint.usage_count,
        performance_score: checkpoint.performance_metrics.success_rate
      };
      // Update summary
      index.summary.total_checkpoints = Object.keys(index.checkpoints).length;
      index.summary.latest_checkpoint = checkpoint.id;
      // Update tag frequency
      const tagFreq: Record<string, number> = {};
      const expertiseAreas = new Set<string>();
      Object.values(index.checkpoints).forEach((cp: any) => {
        cp.tags.forEach((tag: string) => {
          tagFreq[tag] = (tagFreq[tag] || 0) + 1;
        });
        cp.expertise_areas.forEach((area: string) => expertiseAreas.add(area));
      });
      index.summary.most_used_tags = Object.entries(tagFreq)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([tag]) => tag);
      index.summary.expertise_areas = Array.from(expertiseAreas);
      index.last_updated = new Date().toISOString();
      await this.saveFile(indexPath, index);
    } catch (error) {
      console.error('Failed to update agent checkpoint index:', error);
    }
  }
  private async removeFromAgentCheckpointIndex(
    workspaceId: string,
    agentId: string,
    checkpointId: string
  ): Promise<void> {
    try {
      const agentPath = this.getAgentPath(workspaceId, agentId);
      const indexPath = path.join(agentPath, 'checkpoints', 'index.json');
      const index = await this.loadFile(indexPath);
      // Remove checkpoint from index
      delete index.checkpoints[checkpointId];
      // Update summary
      index.summary.total_checkpoints = Object.keys(index.checkpoints).length;
      // Update latest checkpoint
      const checkpoints = Object.values(index.checkpoints) as any[];
      if (checkpoints.length > 0) {
        const latest = checkpoints.reduce((prev, current) =>
          new Date(current.created_at) > new Date(prev.created_at) ? current : prev
        );
        index.summary.latest_checkpoint = latest.id;
      } else {
        index.summary.latest_checkpoint = null;
      }
      index.last_updated = new Date().toISOString();
      await this.saveFile(indexPath, index);
    } catch (error) {
      console.error('Failed to remove from agent checkpoint index:', error);
    }
  }
  // Utility Methods
  private generateAgentId(): string {
    return `agent-${Date.now()}-${crypto.randomBytes(16).toString('hex').toString(36).substr(2, 9)}`;
  }
  private getAgentPath(workspaceId: string, agentId: string): string {
    return path.join(this.workspaceBasePath, workspaceId, 'agents', `agent-${agentId}`);
  }
  private async ensureAgentDirectories(workspaceId: string, agentId: string): Promise<void> {
    const agentPath = this.getAgentPath(workspaceId, agentId);
    await fs.mkdir(agentPath, { recursive: true });
    await fs.mkdir(path.join(agentPath, 'conversations'), { recursive: true });
    await fs.mkdir(path.join(agentPath, 'checkpoints'), { recursive: true });
    await fs.mkdir(path.join(agentPath, 'commands'), { recursive: true });
  }
  private async ensureDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }
  private async saveFile(filePath: string, data: any): Promise<void> {
    await this.ensureDirectory(path.dirname(filePath));
    // Create backup if file exists
    try {
      await fs.access(filePath);
      const backupPath = `${filePath}.backup-${Date.now()}`;
      await fs.copyFile(filePath, backupPath);
    } catch {
      // File doesn't exist, no backup needed
    }
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
  private async loadFile<T>(filePath: string): Promise<T> {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}