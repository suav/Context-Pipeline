/**
 * Agent Storage Manager
 * Handles persistence and retrieval of agent configurations and state
 */

import fs from 'fs/promises';
import path from 'path';
import { Agent, AgentRegistry } from '../types';

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

  // Utility Methods
  private generateAgentId(): string {
    return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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