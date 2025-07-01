/**
 * Terminal Modal Component
 * Main terminal interface for agent conversations
 */

'use client';

import { useState, useEffect } from 'react';
import { ChatInterface } from './ChatInterface';
import { CommandPalette } from '../CommandPalette';
import { CommandInjector } from '../CommandInjector';

// Feature flag - set to false to disable agents
const AGENTS_ENABLED = true;

interface TerminalModalProps {
  isOpen: boolean;
  workspaceId: string;
  selectedAgentId?: string;
  onClose: () => void;
}

interface AgentTab {
  agentId: string;
  name: string;
  title?: string;
  color: string;
  status: 'active' | 'idle' | 'error' | 'loading';
  unreadCount: number;
  isCloseable: boolean;
  model?: 'claude' | 'gemini';
}

export function TerminalModal({ isOpen, workspaceId, selectedAgentId, onClose }: TerminalModalProps) {
  const [agentTabs, setAgentTabs] = useState<AgentTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(selectedAgentId || null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showCommandInjector, setShowCommandInjector] = useState(false);
  const [showAgentCreator, setShowAgentCreator] = useState(false);
  const [agentTitle, setAgentTitle] = useState('');
  const [selectedModel, setSelectedModel] = useState<'claude' | 'gemini'>('claude');

  useEffect(() => {
    if (isOpen && AGENTS_ENABLED) {
      loadAgentTabs();
    }
  }, [isOpen, workspaceId]);

  useEffect(() => {
    if (selectedAgentId) {
      setActiveTabId(selectedAgentId);
    }
  }, [selectedAgentId]);

  const loadAgentTabs = async () => {
    if (!AGENTS_ENABLED) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/agents`);
      if (response.ok) {
        const data = await response.json();
        const tabs: AgentTab[] = (data.agents || []).map((agent: any) => ({
          agentId: agent.id,
          name: agent.name,
          title: agent.title,
          color: agent.color,
          status: agent.status,
          unreadCount: 0, // TODO: Implement unread message counting
          isCloseable: true,
          model: agent.preferred_model || 'claude'
        }));
        setAgentTabs(tabs);
        
        if (tabs.length > 0 && !activeTabId) {
          setActiveTabId(tabs[0].agentId);
        }
      }
    } catch (error) {
      console.error('Failed to load agent tabs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabSelect = (agentId: string) => {
    setActiveTabId(agentId);
  };

  const handleTabClose = (agentId: string) => {
    if (!AGENTS_ENABLED) return;
    
    const updatedTabs = agentTabs.filter(tab => tab.agentId !== agentId);
    setAgentTabs(updatedTabs);
    
    if (activeTabId === agentId) {
      setActiveTabId(updatedTabs.length > 0 ? updatedTabs[0].agentId : null);
    }
  };

  const handleNewAgent = () => {
    if (!AGENTS_ENABLED) {
      alert('🚧 Agent system coming soon!');
      return;
    }
    
    // Show agent creator dialog
    setAgentTitle('');
    setSelectedModel('claude');
    setShowAgentCreator(true);
  };

  const handleCommandSelect = async (command: string) => {
    console.log('Creating agent with startup command:', command);
    setShowCommandInjector(false);
    
    try {
      // Create the agent
      const agentName = agentTitle.trim() || `Agent ${Date.now().toString().slice(-4)}`;
      const response = await fetch(`/api/workspaces/${workspaceId}/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: agentName,
          title: agentTitle.trim() || undefined,
          preferredModel: selectedModel
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newAgentId = data.agent.id;
        
        // Reload agent tabs
        await loadAgentTabs();
        
        // Switch to the new agent tab
        setActiveTabId(newAgentId);
        
        // Inject the startup command after a delay
        setTimeout(() => {
          const event = new CustomEvent('injectCommand', {
            detail: { 
              command, 
              autoSend: true,
              targetAgentId: newAgentId
            }
          });
          window.dispatchEvent(event);
        }, 1500);
      } else {
        const errorData = await response.text();
        let errorMessage = errorData;
        try {
          const errorJson = JSON.parse(errorData);
          errorMessage = errorJson.error || errorData;
        } catch {}
        
        if (errorMessage.includes('Maximum of')) {
          alert(`${errorMessage}\n\nPlease close an existing agent tab before creating a new one.`);
        } else {
          alert(`Failed to create agent: ${errorMessage}`);
        }
      }
    } catch (error) {
      console.error('Error creating agent:', error);
      alert('Failed to create agent');
    }
  };

  const handleClose = () => {
    onClose();
  };

  const handleAgentNameUpdate = (agentId: string, newName: string) => {
    setAgentTabs(prev => prev.map(tab => 
      tab.agentId === agentId 
        ? { ...tab, name: newName }
        : tab
    ));
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;
      
      // Escape to close
      if (event.key === 'Escape') {
        handleClose();
      }
      
      // Ctrl+T for new agent
      if (event.ctrlKey && event.key === 't') {
        event.preventDefault();
        handleNewAgent();
      }
      
      // Ctrl+W to close active tab
      if (event.ctrlKey && event.key === 'w' && activeTabId) {
        event.preventDefault();
        handleTabClose(activeTabId);
      }
      
      // Ctrl+P for command palette
      if (event.ctrlKey && event.key === 'p') {
        event.preventDefault();
        setShowCommandPalette(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTabId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={handleClose}
      />
      
      {/* Modal - Terminal Style */}
      <div className="relative terminal-modal rounded shadow-2xl w-[90vw] h-[80vh] max-h-[800px] flex flex-col">
        {/* Header - Terminal Style */}
        <div className="flex items-center justify-between px-4 py-2 terminal-container border-b">
          <div className="flex items-center gap-2">
            <span className="terminal-text font-mono text-sm">AGENT_TERMINAL</span>
            <span className="terminal-prompt font-mono text-xs">v1.0</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs terminal-prompt font-mono">workspace:{workspaceId.substring(0, 12)}</span>
            <button
              onClick={handleClose}
              className="terminal-text hover:text-red-400 transition-colors font-mono"
            >
              [X]
            </button>
          </div>
        </div>

        {/* Tab Bar - Terminal Style - Fixed at top */}
        <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 border-b terminal-container">
          {agentTabs.map((tab, index) => (
            <div
              key={tab.agentId}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors font-mono text-xs min-h-[48px] ${
                activeTabId === tab.agentId
                  ? 'bg-gray-700 text-green-400 border border-gray-600'
                  : 'bg-gray-900 hover:bg-gray-700 text-gray-400 border border-gray-700'
              }`}
              onClick={() => handleTabSelect(tab.agentId)}
            >
              <span className="text-gray-500">{index + 1}:</span>
              <div className="flex-1 min-w-0">
                <div className="max-w-[120px] truncate font-medium">
                  {tab.name}
                  {tab.title && <span className="text-blue-400 ml-1">({tab.title})</span>}
                </div>
                <div className="text-[10px] text-gray-500 ml-1">
                  {tab.model === 'claude' ? '🧠 Claude' : '💎 Gemini'}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  tab.status === 'active' ? 'bg-green-400 animate-pulse' :
                  tab.status === 'error' ? 'bg-red-400' :
                  'bg-gray-600'
                }`} />
                {tab.unreadCount > 0 && (
                  <span className="text-yellow-400">({tab.unreadCount})</span>
                )}
                {tab.isCloseable && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTabClose(tab.agentId);
                    }}
                    className="text-gray-500 hover:text-red-400 ml-1"
                  >
                    x
                  </button>
                )}
              </div>
            </div>
          ))}
          
          <button
            onClick={handleNewAgent}
            className="flex items-center gap-1 px-3 py-1 text-xs font-mono text-gray-500 hover:text-green-400 hover:bg-gray-700 border border-gray-700 transition-colors"
            title="New Agent (Ctrl+T)"
          >
            <span>[+]</span>
            {!AGENTS_ENABLED && <span className="text-xs">🚧</span>}
          </button>
        </div>

        {/* Content Area - Flexible container */}
        <div className="flex-1 flex flex-col min-h-0">
          {!AGENTS_ENABLED ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🚧</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Agent System Coming Soon</h3>
                <p className="text-gray-600 mb-4">
                  The intelligent agent system is under development and will be available soon!
                </p>
                <div className="text-sm text-gray-500">
                  <p>Features in development:</p>
                  <ul className="mt-2 space-y-1">
                    <li>• Persistent AI agent conversations</li>
                    <li>• Context-aware command execution</li>
                    <li>• Expert agent checkpoints</li>
                    <li>• Multi-agent collaboration</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Loading agents...</p>
              </div>
            </div>
          ) : agentTabs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-4">🤖</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Agents Available</h3>
                <p className="text-gray-600 mb-4">Deploy your first agent to get started</p>
                <button
                  onClick={handleNewAgent}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Deploy New Agent
                </button>
              </div>
            </div>
          ) : activeTabId ? (
            <ChatInterface
              agentId={activeTabId}
              workspaceId={workspaceId}
              agentName={agentTabs.find(tab => tab.agentId === activeTabId)?.name || 'Agent'}
              agentTitle={agentTabs.find(tab => tab.agentId === activeTabId)?.title}
              agentColor={agentTabs.find(tab => tab.agentId === activeTabId)?.color || '#3B82F6'}
              onAgentNameUpdate={(newName) => handleAgentNameUpdate(activeTabId, newName)}
            />
          ) : null}
        </div>

        {/* Footer with keyboard shortcuts - Terminal Style */}
        <div className="px-4 py-1 border-t border-gray-700 bg-gray-800">
          <div className="text-xs text-gray-500 font-mono flex justify-center gap-4">
            <span>^T: New Agent</span>
            <span>^W: Close Tab</span>
            <span>^L: Clear</span>
            <span>^P: Commands</span>
            <span>ESC: Exit</span>
          </div>
        </div>
      </div>

      {/* Command Palette */}
      {showCommandPalette && (
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
        />
      )}

      {/* Agent Creator Dialog - Always show name/model box */}
      {showAgentCreator && (
        <div className="absolute inset-0 z-60 flex items-center justify-center command-popup">
          <div 
            className="absolute inset-0 bg-black bg-opacity-75"
            onClick={() => setShowAgentCreator(false)}
          />
          <div className="relative terminal-container rounded shadow-2xl p-4 max-w-sm w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold terminal-text font-mono">DEPLOY_NEW_AGENT</h2>
              <button
                onClick={() => setShowAgentCreator(false)}
                className="terminal-text hover:text-red-400 font-mono"
              >
                [X]
              </button>
            </div>
            <div className="space-y-3 name-model-box" style={{display: 'block', visibility: 'visible', opacity: 1}}>
              <div>
                <label className="block text-xs font-medium terminal-text mb-1 font-mono">
                  &gt; AGENT_NAME:
                </label>
                <input
                  type="text"
                  value={agentTitle}
                  onChange={(e) => setAgentTitle(e.target.value)}
                  placeholder="Code_Assistant | Doc_Writer..."
                  className="terminal-input w-full px-2 py-1 text-xs font-mono"
                  maxLength={30}
                />
                <p className="text-xs terminal-text mt-0.5 font-mono opacity-70">
                  // Leave empty for auto-generated
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium terminal-text mb-1 font-mono">
                  &gt; AI_MODEL:
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as 'claude' | 'gemini')}
                  className="terminal-input w-full px-2 py-1 text-xs font-mono"
                >
                  <option value="claude">CLAUDE_3.5_SONNET</option>
                  <option value="gemini">GEMINI_PRO</option>
                </select>
                <p className="text-xs terminal-text mt-0.5 font-mono opacity-70">
                  // Model locked for agent lifetime
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setShowAgentCreator(false);
                    setShowCommandInjector(true);
                  }}
                  className="flex-1 terminal-input hover:bg-green-800 px-3 py-1 text-xs font-medium font-mono border-green-400"
                >
                  [DEPLOY] &gt;&gt;
                </button>
                <button
                  onClick={() => setShowAgentCreator(false)}
                  className="px-3 py-1 terminal-text hover:text-red-400 text-xs font-mono"
                >
                  [ABORT]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Command Injector for New Agent - Terminal Style */}
      {showCommandInjector && (
        <div className="absolute inset-0 z-60 flex items-center justify-center command-container">
          <div 
            className="absolute inset-0 bg-black bg-opacity-75"
            onClick={() => setShowCommandInjector(false)}
          />
          <div className="relative terminal-container rounded shadow-2xl p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold terminal-text font-mono">COMMAND_INJECTION_MODE</h2>
              <button
                onClick={() => setShowCommandInjector(false)}
                className="terminal-text hover:text-red-400 font-mono"
              >
                [X]
              </button>
            </div>
            <CommandInjector
              mode="startup"
              workspaceContext={{
                has_jira: true,
                has_git: true,
                has_files: true,
                has_email: false
              }}
              onCommandSelect={handleCommandSelect}
              className="mb-0 terminal-container"
            />
            <div className="mt-4 text-center">
              <button
                onClick={() => handleCommandSelect('help')}
                className="text-sm terminal-text hover:text-green-400 font-mono"
              >
                &gt; or execute 'help' command_
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}