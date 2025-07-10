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
    name: 'Git Repository',
    fields: ['token', 'repo_url', 'ssh_key_path', 'user_name', 'user_email'],
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

interface EditFormData {
  credentialId: string;
  service: string;
  fields: Record<string, string>;
}

export function CredentialsManager({ isOpen, onClose }: CredentialsManagerProps) {
  const { currentTheme } = useTheme();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedService, setSelectedService] = useState<keyof typeof SERVICE_CONFIGS>('jira');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [testingCredential, setTestingCredential] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCredential, setEditingCredential] = useState<EditFormData | null>(null);

  // Load credentials when modal opens
  React.useEffect(() => {
    if (isOpen) {
      loadCredentials();
    }
  }, [isOpen]);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/credentials');
      const data = await response.json();
      
      if (data.success) {
        setCredentials(data.credentials);
      } else {
        setError(data.error || 'Failed to load credentials');
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
      setError('Failed to load credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleEditCredential = (credential: Credential) => {
    // Extract the unmasked values by setting up the form for editing
    const editData: EditFormData = {
      credentialId: credential.id,
      service: credential.service,
      fields: { ...credential.fields }
    };
    setEditingCredential(editData);
    setShowAddForm(false);
  };

  const handleUpdateCredential = async () => {
    if (!editingCredential) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/credentials', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingCredential.credentialId,
          fields: editingCredential.fields
        }),
      });

      const data = await response.json();

      if (data.success) {
        await loadCredentials();
        setEditingCredential(null);
        alert(`✅ Credential updated successfully!\n\nUpdated .env.local file.`);
      } else {
        setError(data.error || 'Failed to update credential');
      }
    } catch (error) {
      console.error('Failed to update credential:', error);
      setError('Failed to update credential');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  const handleAddCredential = async () => {
    try {
      setLoading(true);
      setError(null);

      const config = SERVICE_CONFIGS[selectedService];
      const newCredential = {
        name: formData.name || `${config.name} Account`,
        service: selectedService,
        status: 'active',
        fields: { ...formData }
      };

      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newCredential),
      });

      const data = await response.json();

      if (data.success) {
        await loadCredentials(); // Reload the list
        setShowAddForm(false);
        setFormData({});
        alert(`✅ Credential "${newCredential.name}" added successfully!\n\nUpdated .env.local file.`);
      } else {
        setError(data.error || 'Failed to create credential');
      }
    } catch (error) {
      console.error('Failed to create credential:', error);
      setError('Failed to create credential');
    } finally {
      setLoading(false);
    }
  };
  const handleTestCredential = async (credentialId: string) => {
    try {
      setTestingCredential(credentialId);
      
      const response = await fetch('/api/credentials/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credentialId }),
      });

      const data = await response.json();
      const credential = credentials.find(c => c.id === credentialId);

      if (data.success && data.test_result.success) {
        alert(`✅ Connection test successful for "${credential?.name}"!\n\n${data.test_result.message}`);
        await loadCredentials(); // Reload to get updated status
      } else {
        const errorMessage = data.test_result?.message || data.error || 'Connection test failed';
        alert(`❌ Connection test failed for "${credential?.name}".\n\n${errorMessage}`);
      }
    } catch (error) {
      console.error('Failed to test credential:', error);
      const credential = credentials.find(c => c.id === credentialId);
      alert(`❌ Connection test failed for "${credential?.name}".\n\nNetwork error occurred.`);
    } finally {
      setTestingCredential(null);
    }
  };
  const handleDeleteCredential = async (credentialId: string) => {
    const credential = credentials.find(c => c.id === credentialId);
    if (!window.confirm(`Delete "${credential?.name}"?\n\nThis will comment out the credentials in .env.local file.`)) {
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(`/api/credentials?id=${credentialId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await loadCredentials(); // Reload the list
        alert(`✅ Credential "${credential?.name}" removed successfully.\n\nThe credentials have been commented out in .env.local file.`);
      } else {
        setError(data.error || 'Failed to delete credential');
      }
    } catch (error) {
      console.error('Failed to delete credential:', error);
      setError('Failed to delete credential');
    } finally {
      setLoading(false);
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
            {/* Error Display */}
            {error && (
              <div
                className="mb-4 p-3 rounded-lg border-l-4"
                style={{
                  backgroundColor: 'var(--color-error-background)',
                  borderColor: 'var(--color-error)',
                  color: 'var(--color-error)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span>⚠️</span>
                  <span className="font-medium">Error:</span>
                  <span>{error}</span>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto text-lg hover:opacity-70"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {loading && (
              <div
                className="mb-4 p-3 rounded-lg border text-center"
                style={{
                  backgroundColor: 'var(--color-surface-elevated)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin text-lg">⏳</div>
                  <span>Loading...</span>
                </div>
              </div>
            )}
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
                  onClick={async () => {
                    if (credentials.length === 0) {
                      alert('No credentials to test');
                      return;
                    }
                    
                    let successCount = 0;
                    let errorCount = 0;
                    
                    for (const credential of credentials) {
                      try {
                        setTestingCredential(credential.id);
                        const response = await fetch('/api/credentials/test', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ credentialId: credential.id }),
                        });
                        const data = await response.json();
                        
                        if (data.success && data.test_result.success) {
                          successCount++;
                        } else {
                          errorCount++;
                        }
                      } catch (error) {
                        errorCount++;
                      }
                    }
                    
                    setTestingCredential(null);
                    await loadCredentials();
                    alert(`🔄 All credentials tested!\n\n${successCount} successful, ${errorCount} failed.`);
                  }}
                  disabled={loading || credentials.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border font-medium text-sm transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  🧪 Test All
                </button>
                <button
                  onClick={() => {
                    // Open setup wizard
                    const event = new CustomEvent('open-setup-wizard');
                    window.dispatchEvent(event);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border font-medium text-sm transition-colors"
                  style={{
                    backgroundColor: 'var(--color-accent-background)',
                    borderColor: 'var(--color-accent)',
                    color: 'var(--color-accent)',
                  }}
                >
                  🛠️ Setup Wizard
                </button>
              </div>
              <div
                className="text-sm"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {credentials.length} credentials configured
              </div>
            </div>
            {/* Edit Credential Form */}
            {editingCredential && (
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
                  Edit Credential
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {SERVICE_CONFIGS[editingCredential.service as keyof typeof SERVICE_CONFIGS].fields.map((field) => (
                    <div key={field}>
                      <label
                        className="block text-sm font-medium mb-2 capitalize"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {field.replace('_', ' ')}
                      </label>
                      <input
                        type={field.includes('password') || field.includes('token') ? 'password' : 'text'}
                        value={editingCredential.fields[field] || ''}
                        onChange={(e) => setEditingCredential({
                          ...editingCredential,
                          fields: { ...editingCredential.fields, [field]: e.target.value }
                        })}
                        placeholder={field === 'repo_url' ? 'git@github.com:user/repo.git' : 
                                   field === 'ssh_key_path' ? '/home/user/.ssh/id_rsa (optional)' :
                                   field === 'user_name' ? 'Git username (optional)' :
                                   field === 'user_email' ? 'Git email (optional)' :
                                   `Enter ${field.replace('_', ' ')}`}
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
                
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateCredential}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--color-success)',
                      color: 'var(--color-text-inverse)',
                    }}
                  >
                    {loading ? '⏳ Updating...' : '💾 Update Credential'}
                  </button>
                  <button
                    onClick={() => setEditingCredential(null)}
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
                        placeholder={field === 'url' ? SERVICE_CONFIGS[selectedService].placeholder : 
                                   field === 'repo_url' ? 'git@github.com:user/repo.git' : 
                                   field === 'ssh_key_path' ? '/home/user/.ssh/id_rsa (optional)' :
                                   field === 'user_name' ? 'Git username (optional)' :
                                   field === 'user_email' ? 'Git email (optional)' :
                                   `Enter ${field.replace('_', ' ')}`}
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
                    disabled={loading}
                    className="px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--color-success)',
                      color: 'var(--color-text-inverse)',
                    }}
                  >
                    {loading ? '⏳ Saving...' : '💾 Save Credential'}
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
                        onClick={() => handleEditCredential(credential)}
                        disabled={loading}
                        className="px-3 py-1 rounded text-sm border transition-colors disabled:opacity-50"
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
                        disabled={loading}
                        className="px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
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