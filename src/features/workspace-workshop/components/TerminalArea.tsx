/**
 * Terminal Area Component
 *
 * Multi-tab terminal interface (33-50% height)
 * Features: Agent chat, system terminal, git interface
 */
'use client';
import { useState, useEffect, Suspense, lazy } from 'react';
// Lazy load existing terminal components
const LazyChatInterface = lazy(() => import('@/features/agents/components/terminal/ChatInterface').then(m => ({ default: m.ChatInterface })));
interface Agent {
  id: string;
  name: string;
  color: string;
  status: 'active' | 'idle' | 'offline';
}
interface TerminalAreaProps {
  workspaceId: string;
  agents: Agent[];
  activeAgent: string;
  onAgentSelect: (agentId: string) => void;
}
export function TerminalArea({ 
  workspaceId, 
  agents, 
  activeAgent, 
  onAgentSelect
}: TerminalAreaProps) {
  const [activeTab, setActiveTab] = useState<string>(activeAgent);
  // Update local tab when activeAgent changes
  useEffect(() => {
    setActiveTab(activeAgent);
  }, [activeAgent]);
  const currentAgent = agents.find(agent => agent.id === activeTab);
  return (
    <div className="h-full w-full flex flex-col">
      {/* Terminal Content - Header removed, toggle buttons now in FileTabs */}
      <div className="flex-1 w-full overflow-hidden">
        {agents.some(agent => agent.id === activeTab) && currentAgent && (
          <Suspense fallback={
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--color-primary)' }} />
                <p style={{ color: 'var(--color-text-secondary)' }}>Loading agent terminal...</p>
              </div>
            </div>
          }>
            <LazyChatInterface
              agentId={currentAgent.id}
              workspaceId={workspaceId}
              agentName={currentAgent.name}
              agentTitle="Claude Agent"
              agentColor={currentAgent.color}
            />
          </Suspense>
        )}
        {activeTab === 'system' && (
          <SystemTerminal />
        )}
        {activeTab === 'git' && (
          <GitInterface workspaceId={workspaceId} />
        )}
      </div>
    </div>
  );
}
// System Terminal Component
function SystemTerminal() {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([
    '$ pwd',
    '/workspace',
    '$ ls -la',
    'total 24',
    'drwxr-xr-x  6 user user  192 Jan  1 12:00 .',
    'drwxr-xr-x  3 user user   96 Jan  1 12:00 ..',
    '-rw-r--r--  1 user user 1234 Jan  1 12:00 package.json',
    'drwxr-xr-x  4 user user  128 Jan  1 12:00 src',
    '$ ',
  ]);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      setHistory(prev => [...prev, `$ ${command}`, 'Command execution not implemented yet', '$ ']);
      setCommand('');
    }
  };
  return (
    <div
      className="h-full p-4 font-mono text-sm"
      style={{
        backgroundColor: '#000000',
        color: '#00ff00',
      }}
    >
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto mb-4">
          {history.map((line, index) => (
            <div key={index} className="whitespace-pre-wrap">
              {line}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <span>$</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            style={{ color: '#00ff00' }}
            placeholder="Enter system command..."
            autoFocus
          />
        </form>
      </div>
    </div>
  );
}
// Git Interface Component
function GitInterface({ workspaceId }: { workspaceId: string }) {
  const [gitData, setGitData] = useState({
    branch: 'main',
    status: {
      modified: ['src/components/Dashboard.tsx', 'README.md'],
      untracked: ['new-feature.ts'],
      staged: [],
    },
    commits: [
      { hash: 'abc123', message: 'Add dashboard component', author: 'Agent', time: '2m ago' },
      { hash: 'def456', message: 'Update API endpoints', author: 'Developer', time: '1h ago' },
      { hash: 'ghi789', message: 'Initial commit', author: 'Developer', time: '1d ago' },
    ],
  });
  return (
    <div
      className="h-full p-4 overflow-y-auto"
      style={{
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-text-primary)',
      }}
    >
      <div className="space-y-4">
        {/* Current Branch */}
        <div>
          <h3 className="text-sm font-medium mb-2">Current Branch</h3>
          <div className="flex items-center gap-2 text-sm">
            <span>🌿</span>
            <span>{gitData.branch}</span>
          </div>
        </div>
        {/* Status */}
        <div>
          <h3 className="text-sm font-medium mb-2">Working Directory Status</h3>
          <div className="space-y-1 text-sm">
            {gitData.status.modified.length > 0 && (
              <div>
                <div className="font-medium text-orange-500">Modified files:</div>
                {gitData.status.modified.map(file => (
                  <div key={file} className="ml-4 flex items-center gap-2">
                    <span className="text-orange-500">M</span>
                    <span>{file}</span>
                  </div>
                ))}
              </div>
            )}
            {gitData.status.untracked.length > 0 && (
              <div>
                <div className="font-medium text-red-500">Untracked files:</div>
                {gitData.status.untracked.map(file => (
                  <div key={file} className="ml-4 flex items-center gap-2">
                    <span className="text-red-500">?</span>
                    <span>{file}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              className="px-3 py-1 text-xs rounded"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)',
              }}
            >
              Stage All
            </button>
            <button
              className="px-3 py-1 text-xs rounded"
              style={{
                backgroundColor: 'var(--color-surface-elevated)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Commit
            </button>
          </div>
        </div>
        {/* Recent Commits */}
        <div>
          <h3 className="text-sm font-medium mb-2">Recent Commits</h3>
          <div className="space-y-2">
            {gitData.commits.map(commit => (
              <div
                key={commit.hash}
                className="p-2 rounded text-sm"
                style={{ backgroundColor: 'var(--color-surface-elevated)' }}
              >
                <div className="font-medium">{commit.message}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {commit.hash} • {commit.author} • {commit.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}