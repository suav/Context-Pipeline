'use client';

import React, { useState } from 'react';
import { useTheme } from '@/lib/theme-context';

interface Credential {
  id: string;
  name: string;
  service: 'jira' | 'github' | 'gitlab' | 'email' | 'slack' | 'custom';
  status: 'active' | 'inactive' | 'error';
  lastUsed?: string;
  fields: Record<string, string>;
}

const SERVICE_CONFIGS = {
  jira: {
    icon: '🎫',
    name: 'Jira',
    fields: ['url', 'email', 'api_token'],
    placeholder: 'company.atlassian.net'
  },
  github: {
    icon: '🐙',
    name: 'GitHub',
    fields: ['token', 'username'],
    placeholder: 'ghp_xxxxxxxxxxxx'
  },
  gitlab: {
    icon: '🦊',
    name: 'GitLab',
    fields: ['url', 'token', 'username'],
    placeholder: 'gitlab.com'
  },
  email: {
    icon: '📧',
    name: 'Email (IMAP)',
    fields: ['host', 'port', 'email', 'password'],
    placeholder: 'imap.gmail.com'
  },
  slack: {
    icon: '💬',
    name: 'Slack',
    fields: ['token', 'workspace'],
    placeholder: 'xoxb-xxxxxxxxxxxx'
  },
  custom: {
    icon: '🔧',
    name: 'Custom API',
    fields: ['url', 'api_key', 'auth_header'],
    placeholder: 'https://api.example.com'
  }
};

interface CredentialsManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CredentialsManager({ isOpen, onClose }: CredentialsManagerProps) {
  const { currentTheme } = useTheme();
  const [credentials, setCredentials] = useState<Credential[]>([
    {
      id: '1',
      name: 'Main Jira',
      service: 'jira',
      status: 'active',
      lastUsed: '2025-06-30T10:30:00Z',
      fields: { url: 'company.atlassian.net', email: 'user@company.com' }
    },
    {
      id: '2',
      name: 'GitHub Personal',
      service: 'github',
      status: 'active',
      lastUsed: '2025-06-30T09:15:00Z',
      fields: { username: 'myusername' }
    },
    {
      id: '3',
      name: 'Work Email',
      service: 'email',
      status: 'error',
      lastUsed: '2025-06-29T16:45:00Z',
      fields: { host: 'imap.company.com', email: 'work@company.com' }
    }
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedService, setSelectedService] = useState<keyof typeof SERVICE_CONFIGS>('jira');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [testingCredential, setTestingCredential] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddCredential = () => {
    // Test message for adding credential
    const newId = Date.now().toString();
    const config = SERVICE_CONFIGS[selectedService];
    
    const newCredential: Credential = {
      id: newId,
      name: formData.name || `${config.name} Account`,
      service: selectedService,
      status: 'active',
      lastUsed: new Date().toISOString(),
      fields: { ...formData }
    };

    setCredentials([...credentials, newCredential]);
    setShowAddForm(false);
    setFormData({});
    
    // Show test success message
    alert(`✅ Credential "${newCredential.name}" added successfully!\n\nThis would normally be encrypted and stored securely.`);
  };

  const handleTestCredential = async (credentialId: string) => {
    setTestingCredential(credentialId);
    
    // Simulate API test
    setTimeout(() => {
      const credential = credentials.find(c => c.id === credentialId);
      const isSuccess = Math.random() > 0.3; // 70% success rate for demo
      
      if (isSuccess) {
        alert(`✅ Connection test successful for "${credential?.name}"!\n\nAPI responded with valid authentication.`);
        // Update status to active
        setCredentials(prev => prev.map(c => 
          c.id === credentialId ? { ...c, status: 'active' as const } : c
        ));
      } else {
        alert(`❌ Connection test failed for "${credential?.name}".\n\nPlease check your credentials and try again.`);
        // Update status to error
        setCredentials(prev => prev.map(c => 
          c.id === credentialId ? { ...c, status: 'error' as const } : c
        ));
      }
      setTestingCredential(null);
    }, 2000);
  };

  const handleDeleteCredential = (credentialId: string) => {
    const credential = credentials.find(c => c.id === credentialId);
    if (window.confirm(`Delete "${credential?.name}"?\n\nThis action cannot be undone.`)) {
      setCredentials(prev => prev.filter(c => c.id !== credentialId));
      alert(`🗑️ Credential "${credential?.name}" deleted successfully.`);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-overlay)' }}
    >
      <div 
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-lg border shadow-xl m-4"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <h2 
              className="text-xl font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              🔐 Credentials Manager
            </h2>
            <p 
              className="text-sm mt-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Manage API credentials for all your data sources
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="p-6">
            {/* Quick Actions */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-inverse)',
                  }}
                >
                  ➕ Add Credential
                </button>
                <button
                  onClick={() => alert('🔄 All credentials tested!\n\n2 active, 1 error detected.')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border font-medium text-sm transition-colors"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  🧪 Test All
                </button>
              </div>
              
              <div 
                className="text-sm"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {credentials.length} credentials configured
              </div>
            </div>

            {/* Add Credential Form */}
            {showAddForm && (
              <div 
                className="mb-6 p-4 border rounded-lg"
                style={{
                  backgroundColor: 'var(--color-surface-elevated)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <h3 
                  className="font-medium mb-4"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Add New Credential
                </h3>
                
                {/* Service Selection */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
                  {Object.entries(SERVICE_CONFIGS).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedService(key as keyof typeof SERVICE_CONFIGS)}
                      className={`p-3 rounded-lg border text-center text-sm transition-colors ${
                        selectedService === key ? 'ring-2' : ''
                      }`}
                      style={{
                        backgroundColor: selectedService === key 
                          ? 'var(--color-primary)' 
                          : 'var(--color-surface)',
                        color: selectedService === key 
                          ? 'var(--color-text-inverse)' 
                          : 'var(--color-text-primary)',
                        borderColor: 'var(--color-border)',
                        ...(selectedService === key && {
                          ringColor: 'var(--color-primary)',
                        })
                      }}
                    >
                      <div className="text-lg mb-1">{config.icon}</div>
                      <div className="font-medium">{config.name}</div>
                    </button>
                  ))}
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Display Name
                    </label>
                    <input
                      type="text"
                      placeholder={`My ${SERVICE_CONFIGS[selectedService].name} Account`}
                      value={formData.name || ''}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                  </div>
                  
                  {SERVICE_CONFIGS[selectedService].fields.map((field) => (
                    <div key={field}>
                      <label 
                        className="block text-sm font-medium mb-2 capitalize"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {field.replace('_', ' ')}
                        {field.includes('token') || field.includes('password') && (
                          <span 
                            className="text-xs ml-1"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            (encrypted)
                          </span>
                        )}
                      </label>
                      <input
                        type={field.includes('password') || field.includes('token') ? 'password' : 'text'}
                        placeholder={field === 'url' ? SERVICE_CONFIGS[selectedService].placeholder : `Enter ${field.replace('_', ' ')}`}
                        value={formData[field] || ''}
                        onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Form Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleAddCredential}
                    className="px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                    style={{
                      backgroundColor: 'var(--color-success)',
                      color: 'var(--color-text-inverse)',
                    }}
                  >
                    💾 Save Credential
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setFormData({});
                    }}
                    className="px-4 py-2 rounded-lg border font-medium text-sm transition-colors"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Credentials List */}
            <div className="space-y-3">
              {credentials.map((credential) => {
                const config = SERVICE_CONFIGS[credential.service];
                const isValidStatus = credential.status === 'active';
                const isTesting = testingCredential === credential.id;
                
                return (
                  <div 
                    key={credential.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">{config.icon}</div>
                      <div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {credential.name}
                        </div>
                        <div 
                          className="text-sm"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {config.name} • 
                          <span className={`ml-1 ${
                            credential.status === 'active' ? 'text-green-600' :
                            credential.status === 'error' ? 'text-red-600' :
                            'text-gray-500'
                          }`}>
                            {credential.status === 'active' ? '✅ Connected' :
                             credential.status === 'error' ? '❌ Error' :
                             '⏸️ Inactive'}
                          </span>
                          {credential.lastUsed && (
                            <span 
                              className="ml-2"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              Last used: {new Date(credential.lastUsed).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTestCredential(credential.id)}
                        disabled={isTesting}
                        className="px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-text-inverse)',
                        }}
                      >
                        {isTesting ? '⏳ Testing...' : '🧪 Test'}
                      </button>
                      <button
                        onClick={() => alert(`🔧 Edit "${credential.name}"\n\nEdit form would open here with current values pre-filled.`)}
                        className="px-3 py-1 rounded text-sm border transition-colors"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCredential(credential.id)}
                        className="px-3 py-1 rounded text-sm transition-colors"
                        style={{
                          backgroundColor: 'var(--color-error)',
                          color: 'var(--color-text-inverse)',
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {credentials.length === 0 && (
              <div 
                className="text-center py-12"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <div className="text-4xl mb-4">🔐</div>
                <p className="text-lg font-medium mb-2">No credentials configured</p>
                <p className="text-sm">Add your first credential to start importing data from external sources.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}