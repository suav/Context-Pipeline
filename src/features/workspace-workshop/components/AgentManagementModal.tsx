/**
 * Agent Management Modal Component
 * 
 * Modal with 3 tabs: Commands, Permissions, Checkpoints
 */

'use client';

import { useState } from 'react';

interface AgentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentManagementModal({ isOpen, onClose }: AgentManagementModalProps) {
  const [activeTab, setActiveTab] = useState<'commands' | 'permissions' | 'checkpoints'>('commands');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-4xl h-3/4 rounded-lg shadow-xl"
        style={{
          backgroundColor: 'var(--color-surface-elevated)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            🤖 Manage Agents
          </h2>
          <button 
            onClick={onClose}
            className="text-xl"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ✕
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
          {[
            { key: 'commands', label: '📜 Commands', desc: 'Manage agent commands' },
            { key: 'permissions', label: '🔒 Permissions', desc: 'Configure agent permissions' },
            { key: 'checkpoints', label: '💾 Checkpoints', desc: 'Manage agent checkpoints' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 px-6 py-4 text-left transition-colors ${
                activeTab === tab.key ? 'border-b-2' : ''
              }`}
              style={{
                color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                borderColor: activeTab === tab.key ? 'var(--color-primary)' : 'transparent',
                backgroundColor: activeTab === tab.key ? 'var(--color-surface)' : 'transparent',
              }}
            >
              <div className="font-medium">{tab.label}</div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {tab.desc}
              </div>
            </button>
          ))}
        </div>
        
        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'commands' && <CommandsTab />}
          {activeTab === 'permissions' && <PermissionsTab />}
          {activeTab === 'checkpoints' && <CheckpointsTab />}
        </div>
      </div>
    </div>
  );
}

function CommandsTab() {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
        Agent Commands Library
      </h3>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        Commands management functionality will be implemented here.
        This will include command creation, editing, prioritization, and rewriting.
      </p>
    </div>
  );
}

function PermissionsTab() {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
        Agent Permissions
      </h3>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        Permissions management functionality will be implemented here.
        This will include role templates, custom permissions, and approval settings.
      </p>
    </div>
  );
}

function CheckpointsTab() {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
        Expert Agent Checkpoints
      </h3>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        Checkpoint management functionality will be implemented here.
        This will include checkpoint creation, renaming, deletion, and restoration.
      </p>
    </div>
  );
}