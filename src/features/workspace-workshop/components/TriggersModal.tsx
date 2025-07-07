/**
 * Triggers Modal Component
 * 
 * Modal for managing dynamic context triggers
 */

'use client';

interface TriggersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TriggersModal({ isOpen, onClose }: TriggersModalProps) {
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
            ⚡ Dynamic Context Triggers
          </h2>
          <button 
            onClick={onClose}
            className="text-xl"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Trigger Management
          </h3>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Dynamic context trigger functionality will be implemented here.
            This will include trigger creation, condition setup, workspace templates, and automation rules.
          </p>
        </div>
      </div>
    </div>
  );
}