/**
 * Credential Selector Component
 * Dropdown for selecting credentials during import workflows
 */

'use client';
import React, { useState, useEffect } from 'react';
import { CredentialSelector as CredentialSelectorService } from '../services/CredentialSelector';

interface Credential {
  id: string;
  name: string;
  service: 'jira' | 'github' | 'gitlab' | 'email' | 'slack' | 'custom';
  status: 'active' | 'inactive' | 'error';
  lastUsed?: string;
  fields: Record<string, string>;
}

interface CredentialSelectorProps {
  service: string;
  selectedCredentialId?: string;
  onCredentialSelect: (credentialId: string | null) => void;
  onCredentialsLoad?: (credentials: Credential[]) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  showAddButton?: boolean;
  onAddCredential?: () => void;
}

export function CredentialSelector({
  service,
  selectedCredentialId,
  onCredentialSelect,
  onCredentialsLoad,
  disabled = false,
  required = false,
  placeholder,
  showAddButton = true,
  onAddCredential
}: CredentialSelectorProps) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCredentials();
  }, [service]);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const credentialService = CredentialSelectorService.getInstance();
      const serviceCredentials = await credentialService.getCredentialsForService(service);
      
      setCredentials(serviceCredentials);
      
      // Auto-select default credential if none selected
      if (!selectedCredentialId && serviceCredentials.length > 0) {
        const defaultCredential = await credentialService.getDefaultCredentialForService(service);
        if (defaultCredential) {
          onCredentialSelect(defaultCredential.id);
        }
      }
      
      // Notify parent of loaded credentials
      if (onCredentialsLoad) {
        onCredentialsLoad(serviceCredentials);
      }
      
    } catch (err) {
      console.error('Failed to load credentials:', err);
      setError(err instanceof Error ? err.message : 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '✅';
      case 'error': return '❌';
      case 'inactive': return '⏸️';
      default: return '❓';
    }
  };

  const formatCredentialDisplay = (credential: Credential) => {
    const statusIcon = getStatusIcon(credential.status);
    return `${statusIcon} ${credential.name}`;
  };

  const defaultPlaceholder = credentials.length === 0 
    ? `No ${service.toUpperCase()} credentials available`
    : `Select ${service.toUpperCase()} credential`;

  return (
    <div className="credential-selector">
      <div className="flex items-center gap-2">
        <select
          value={selectedCredentialId || ''}
          onChange={(e) => onCredentialSelect(e.target.value || null)}
          disabled={disabled || loading || credentials.length === 0}
          required={required}
          className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 outline-none disabled:opacity-50"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          <option value="">
            {loading ? 'Loading credentials...' : placeholder || defaultPlaceholder}
          </option>
          {credentials.map(credential => (
            <option key={credential.id} value={credential.id}>
              {formatCredentialDisplay(credential)}
            </option>
          ))}
        </select>
        
        {showAddButton && (
          <button
            onClick={() => {
              if (onAddCredential) {
                onAddCredential();
              } else {
                // Default behavior - open credentials manager
                const event = new CustomEvent('open-credentials-manager');
                window.dispatchEvent(event);
              }
            }}
            disabled={disabled}
            className="px-3 py-2 border rounded-lg transition-colors disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-primary)',
              borderColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
            }}
            title={`Add ${service.toUpperCase()} credential`}
          >
            ➕
          </button>
        )}
      </div>
      
      {error && (
        <div className="mt-2 text-sm" style={{ color: 'var(--color-error)' }}>
          <span>⚠️ {error}</span>
          <button
            onClick={loadCredentials}
            className="ml-2 text-xs underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}
      
      {!loading && credentials.length === 0 && (
        <div className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <span>No {service.toUpperCase()} credentials configured.</span>
          {showAddButton && (
            <button
              onClick={() => {
                if (onAddCredential) {
                  onAddCredential();
                } else {
                  const event = new CustomEvent('open-credentials-manager');
                  window.dispatchEvent(event);
                }
              }}
              className="ml-2 text-xs underline hover:no-underline"
              style={{ color: 'var(--color-primary)' }}
            >
              Add one now
            </button>
          )}
        </div>
      )}
      
      {selectedCredentialId && credentials.length > 0 && (
        <div className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {(() => {
            const selected = credentials.find(c => c.id === selectedCredentialId);
            if (!selected) return null;
            
            const lastUsed = selected.lastUsed 
              ? new Date(selected.lastUsed).toLocaleDateString()
              : 'Never used';
            
            return `Last used: ${lastUsed}`;
          })()}
        </div>
      )}
    </div>
  );
}