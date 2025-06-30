/**
 * Agent Overlay Component
 * Displays agent management overlay on workspace cards
 */

'use client';

import { useState, useEffect } from 'react';
import { CommandInjector } from './CommandInjector';

// Feature flag - set to false to disable agents
const AGENTS_ENABLED = true;

interface Agent {
  id: string;
  name: string;
  color: string;
  status: 'active' | 'idle' | 'error' | 'loading';
  created_at: string;
  last_activity: string;
}

interface AgentOverlayProps {
  workspaceId: string;
  onClose: () => void;
  onNewAgent: () => void;
  onAgentClick: (agentId: string) => void;
}

export function AgentOverlay({ 
  workspaceId, 
  onClose, 
  onNewAgent, 
  onAgentClick 
}: AgentOverlayProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCommandInjector, setShowCommandInjector] = useState(false);

  useEffect(() => {
    if (AGENTS_ENABLED) {
      loadAgents();
    }
  }, [workspaceId]);

  const loadAgents = async () => {
    if (!AGENTS_ENABLED) return;
    
    console.log('Loading agents for workspace:', workspaceId);
    setLoading(true);
    try {
      const url = `/api/workspaces/${workspaceId}/agents`;
      console.log('Fetching agents from:', url);
      
      const response = await fetch(url);
      
      console.log('Agents response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Agents data received:', data);
        setAgents(data.agents || []);
        console.log('Set agents count:', data.agents?.length || 0);
      } else {
        const errorText = await response.text();
        console.error('Failed to load agents - status:', response.status, 'body:', errorText);
      }
    } catch (error) {
      console.error('Failed to load agents (error):', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewAgent = async () => {
    if (!AGENTS_ENABLED) {
      alert('🚧 Agent system coming soon!');
      return;
    }
    
    setShowCommandInjector(true);
  };

  const handleCommandSelect = async (command: string) => {
    console.log('Creating agent for workspace:', workspaceId);
    console.log('Command:', command);
    
    try {
      // First create the agent
      const requestBody = {
        name: `Agent ${Date.now().toString().slice(-4)}` // Simple name for now
      };
      
      console.log('Request body:', requestBody);
      console.log('Request URL:', `/api/workspaces/${workspaceId}/agents`);
      
      const response = await fetch(`/api/workspaces/${workspaceId}/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log('Agent created successfully:', data);
        const newAgentId = data.agent.id;
        
        // Close the command injector
        setShowCommandInjector(false);
        
        // Open the terminal with the new agent
        console.log('Opening terminal for agent:', newAgentId);
        try {
          onAgentClick(newAgentId);
          console.log('Terminal opened successfully');
        } catch (terminalError) {
          console.error('Failed to open terminal:', terminalError);
          throw terminalError; // Re-throw to trigger catch block
        }
        
        // Inject the startup command after a delay to ensure terminal is ready
        setTimeout(() => {
          console.log('Attempting to inject command:', command, 'for agent:', newAgentId);
          const event = new CustomEvent('injectCommand', {
            detail: { 
              command, 
              autoSend: true,
              targetAgentId: newAgentId
            }
          });
          console.log('Dispatching event:', event);
          window.dispatchEvent(event);
          console.log('Event dispatched successfully');
        }, 2000); // Increased delay to ensure terminal is ready
        
        // Refresh agent list
        console.log('Refreshing agent list');
        try {
          await loadAgents();
          console.log('Agent list refreshed successfully');
        } catch (refreshError) {
          console.warn('Failed to refresh agent list:', refreshError);
          // Don't throw here, just warn
        }
      } else {
        const errorData = await response.text();
        console.error('Agent creation failed:', response.status, errorData);
        
        // Parse error message if it's JSON
        let errorMessage = errorData;
        try {
          const errorJson = JSON.parse(errorData);
          errorMessage = errorJson.error || errorData;
        } catch {
          // If not JSON, use as is
        }
        
        // Show user-friendly error message
        if (errorMessage.includes('Maximum of')) {
          alert(`${errorMessage}\n\nPlease remove an existing agent before creating a new one.`);
        } else {
          alert(`Failed to create agent: ${errorMessage}`);
        }
        setShowCommandInjector(false);
      }
    } catch (error) {
      console.error('Error creating agent (full error):', error);
      console.error('Error stack:', (error as Error).stack);
      alert(`Failed to create agent: ${(error as Error).message}`);
      setShowCommandInjector(false);
    }
  };

  const handleAgentClick = (agentId: string) => {
    if (!AGENTS_ENABLED) {
      alert('🚧 Agent system coming soon!');
      return;
    }
    
    onAgentClick(agentId);
  };

  // Always render when called (visibility managed by parent)

  return (
    <div className="absolute top-full right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-medium text-gray-900">Agent Management</h4>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {!AGENTS_ENABLED && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800">
              <span>🚧</span>
              <span className="text-sm font-medium">Coming Soon</span>
            </div>
            <p className="text-xs text-yellow-700 mt-1">
              Agent system is under development and will be available soon!
            </p>
          </div>
        )}

        {AGENTS_ENABLED && loading ? (
          <div className="text-center py-4 text-gray-500">
            <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            Loading agents...
          </div>
        ) : agents.length > 0 ? (
          <div className="space-y-2 mb-3">
            {agents.map((agent) => (
              <div 
                key={agent.id}
                onClick={() => handleAgentClick(agent.id)}
                className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                style={{
                  background: `linear-gradient(90deg, ${agent.color}20 0%, transparent 100%)`
                }}
              >
                <div 
                  className="w-3 h-8 rounded-full flex-shrink-0"
                  style={{ backgroundColor: agent.color }}
                ></div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{agent.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {agent.status} • {new Date(agent.last_activity).toLocaleDateString()}
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  agent.status === 'active' ? 'bg-green-500' :
                  agent.status === 'error' ? 'bg-red-500' :
                  'bg-gray-400'
                }`}></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 mb-3">
            <div className="text-2xl mb-2">🤖</div>
            <p className="text-sm">No agents deployed yet</p>
          </div>
        )}

        {!showCommandInjector ? (
          <div className="space-y-2">
            <button
              onClick={handleNewAgent}
              className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                AGENTS_ENABLED && agents.length < 4
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
              disabled={agents.length >= 4}
            >
              {!AGENTS_ENABLED ? '🚧 Deploy New Agent (Coming Soon)' :
               agents.length >= 4 ? '🚫 Max Agents Reached (4/4)' :
               '🚀 Deploy with Command'}
            </button>
            {AGENTS_ENABLED && (
              <button
                onClick={() => handleCommandSelect('help')}
                className="w-full py-1 px-3 rounded text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
              >
                Quick Deploy (help command)
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-900">Select Startup Command</span>
              <button
                onClick={() => setShowCommandInjector(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <CommandInjector
              mode="startup"
              workspaceContext={{
                has_jira: true,  // TODO: Get from actual workspace context
                has_git: true,
                has_files: true,
                has_email: false
              }}
              onCommandSelect={handleCommandSelect}
              className="mb-0"
            />
          </div>
        )}

        {AGENTS_ENABLED && agents.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500 text-center">
              Click an agent to open conversation
              {agents.length >= 4 && (
                <div className="text-orange-600 mt-1">
                  (Workspace at max capacity: 4/4 agents)
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}