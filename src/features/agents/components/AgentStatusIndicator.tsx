/**
 * Agent Status Indicator Component
 * Shows agent count and status on workspace cards
 */
'use client';
import { useState, useEffect } from 'react';
// Feature flag - set to false to disable agents
const AGENTS_ENABLED = true;
interface AgentStatusIndicatorProps {
  workspaceId: string;
  onClick: () => void;
  className?: string;
}
interface AgentStatus {
  total: number;
  active: number;
  idle: number;
  error: number;
}
export function AgentStatusIndicator({ workspaceId, onClick, className = '' }: AgentStatusIndicatorProps) {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({ total: 0, active: 0, idle: 0, error: 0 });
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (AGENTS_ENABLED) {
      loadAgentStatus();
      // Poll for status updates every 30 seconds
      const interval = setInterval(loadAgentStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [workspaceId]);
  const loadAgentStatus = async () => {
    if (!AGENTS_ENABLED) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/agents/status`);
      if (response.ok) {
        const data = await response.json();
        setAgentStatus(data.status || { total: 0, active: 0, idle: 0, error: 0 });
      }
    } catch (error) {
      console.error('Failed to load agent status:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleClick = () => {
    if (!AGENTS_ENABLED) {
      // Still allow clicking to show the overlay with "coming soon" message
    }
    onClick();
  };
  // Show a preview of what the indicator will look like
  const displayStatus = AGENTS_ENABLED ? agentStatus : { total: 0, active: 0, idle: 0, error: 0 };
  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all ${
        displayStatus.total > 0
          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      } ${className}`}
      title={AGENTS_ENABLED
        ? `${displayStatus.total} agents (${displayStatus.active} active, ${displayStatus.idle} idle, ${displayStatus.error} error)`
        : 'Agent system coming soon'
      }
    >
      <span className="text-lg">🤖</span>
      <span className="text-sm font-medium">{displayStatus.total}</span>
      {/* Active indicator */}
      {AGENTS_ENABLED && displayStatus.active > 0 && (
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
      )}
      {/* Error indicator */}
      {AGENTS_ENABLED && displayStatus.error > 0 && (
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
      )}
      {/* Loading indicator */}
      {loading && (
        <div className="w-2 h-2 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      )}
      {/* Coming soon indicator */}
      {!AGENTS_ENABLED && (
        <div className="text-xs text-gray-500">🚧</div>
      )}
    </button>
  );
}