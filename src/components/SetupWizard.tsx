/**
 * Setup Wizard Component
 * Guides users through initial setup including .env creation and credential configuration
 */

'use client';
import React, { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme-context';

interface SetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface SetupState {
  hasEnvFile: boolean;
  hasMasterKey: boolean;
  hasJira: boolean;
  hasGitHub: boolean;
  hasGitLab: boolean;
  hasGemini: boolean;
  hasClaude: boolean;
}

interface SetupForm {
  jira?: {
    url: string;
    email: string;
    api_token: string;
  };
  github?: {
    token: string;
  };
  gitlab?: {
    url?: string;
    token: string;
  };
  gemini?: {
    api_key: string;
  };
  claude?: {
    api_key: string;
  };
}

export function SetupWizard({ isOpen, onClose, onComplete }: SetupWizardProps) {
  const { currentTheme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [setupState, setSetupState] = useState<SetupState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<SetupForm>({});
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  const steps = [
    'Welcome',
    'Check Setup',
    'Select Services',
    'Configure Services', 
    'Create Environment',
    'Complete'
  ];

  const serviceConfigs = {
    jira: {
      name: 'JIRA',
      icon: '🎫',
      description: 'Import tickets and issues',
      fields: [
        { key: 'url', label: 'JIRA URL', placeholder: 'company.atlassian.net', type: 'text' },
        { key: 'email', label: 'Email', placeholder: 'your@email.com', type: 'email' },
        { key: 'api_token', label: 'API Token', placeholder: 'Your JIRA API token', type: 'password' }
      ]
    },
    github: {
      name: 'GitHub',
      icon: '🐙',
      description: 'Import repositories and code',
      fields: [
        { key: 'token', label: 'Personal Access Token', placeholder: 'ghp_xxxxxxxxxxxx', type: 'password' }
      ]
    },
    gitlab: {
      name: 'GitLab',
      icon: '🦊',
      description: 'Import repositories and merge requests',
      fields: [
        { key: 'url', label: 'GitLab URL (optional)', placeholder: 'gitlab.com', type: 'text' },
        { key: 'token', label: 'Access Token', placeholder: 'Your GitLab token', type: 'password' }
      ]
    },
    gemini: {
      name: 'Google Gemini',
      icon: '🤖',
      description: 'AI agent integration',
      fields: [
        { key: 'api_key', label: 'API Key', placeholder: 'Your Gemini API key', type: 'password' }
      ]
    },
    claude: {
      name: 'Anthropic Claude',
      icon: '🧠',
      description: 'AI agent integration',
      fields: [
        { key: 'api_key', label: 'API Key', placeholder: 'Your Claude API key', type: 'password' }
      ]
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkSetupStatus();
    }
  }, [isOpen]);

  const checkSetupStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/setup/env');
      const data = await response.json();
      
      if (data.success) {
        setSetupState(data.configured);
        if (!data.needsSetup) {
          setCurrentStep(steps.length - 1); // Skip to complete step
        }
      } else {
        setError(data.error || 'Failed to check setup status');
      }
    } catch (error) {
      console.error('Setup check failed:', error);
      setError('Failed to check setup status');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceToggle = (service: string) => {
    const newSelected = new Set(selectedServices);
    if (selectedServices.has(service)) {
      newSelected.delete(service);
      // Clear form data for this service
      const newFormData = { ...formData };
      delete newFormData[service as keyof SetupForm];
      setFormData(newFormData);
    } else {
      newSelected.add(service);
    }
    setSelectedServices(newSelected);
  };

  const handleFieldChange = (service: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [service]: {
        ...prev[service as keyof SetupForm],
        [field]: value
      }
    }));
  };

  const validateCurrentStep = (): boolean => {
    if (currentStep === 3) { // Configure Services step
      for (const service of selectedServices) {
        const config = serviceConfigs[service as keyof typeof serviceConfigs];
        const serviceData = formData[service as keyof SetupForm] as any;
        
        for (const field of config.fields) {
          if (field.key !== 'url' && (!serviceData || !serviceData[field.key]?.trim())) {
            return false;
          }
        }
      }
    }
    return true;
  };

  const createEnvironment = async () => {
    try {
      setLoading(true);
      setError(null);

      const setupRequest = {
        credentials: Object.fromEntries(
          Array.from(selectedServices).map(service => [service, formData[service as keyof SetupForm]])
        ),
        settings: {
          node_env: 'development',
          port: '3001'
        }
      };

      const response = await fetch('/api/setup/env', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(setupRequest),
      });

      const data = await response.json();

      if (data.success) {
        setCurrentStep(currentStep + 1);
        if (onComplete) {
          onComplete();
        }
      } else {
        setError(data.error || 'Failed to create environment');
      }
    } catch (error) {
      console.error('Environment creation failed:', error);
      setError('Failed to create environment');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 4) { // Create Environment step
      createEnvironment();
    } else if (validateCurrentStep()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep(Math.max(0, currentStep - 1));
  };

  if (!isOpen) return null;

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Welcome
        return (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🚀</div>
            <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Welcome to Context Pipeline!
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              This setup wizard will help you configure your environment and credentials 
              to get started quickly with AI-assisted development workflows.
            </p>
            <div className="text-sm space-y-2" style={{ color: 'var(--color-text-muted)' }}>
              <p>✅ Set up your .env file automatically</p>
              <p>🔐 Configure secure credential storage</p>
              <p>🔌 Connect to your development tools</p>
              <p>🤖 Enable AI agent integration</p>
            </div>
          </div>
        );

      case 1: // Check Setup
        return (
          <div className="py-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Current Setup Status
            </h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin text-4xl mb-4">⏳</div>
                <p style={{ color: 'var(--color-text-secondary)' }}>Checking current setup...</p>
              </div>
            ) : setupState ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <span>{setupState.hasEnvFile ? '✅' : '❌'}</span>
                    <span className="text-sm">Environment file (.env)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{setupState.hasMasterKey ? '✅' : '❌'}</span>
                    <span className="text-sm">Security encryption</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{setupState.hasJira ? '✅' : '❌'}</span>
                    <span className="text-sm">JIRA credentials</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{setupState.hasGitHub ? '✅' : '❌'}</span>
                    <span className="text-sm">GitHub credentials</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{setupState.hasGemini ? '✅' : '❌'}</span>
                    <span className="text-sm">Gemini AI</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{setupState.hasClaude ? '✅' : '❌'}</span>
                    <span className="text-sm">Claude AI</span>
                  </div>
                </div>
                <div 
                  className="mt-4 p-3 rounded border-l-4"
                  style={{
                    backgroundColor: setupState.hasEnvFile && setupState.hasMasterKey 
                      ? 'var(--color-success-background)' 
                      : 'var(--color-warning-background)',
                    borderColor: setupState.hasEnvFile && setupState.hasMasterKey 
                      ? 'var(--color-success)' 
                      : 'var(--color-warning)',
                  }}
                >
                  <p className="text-sm font-medium">
                    {setupState.hasEnvFile && setupState.hasMasterKey 
                      ? '🎉 Environment is already configured! You can add more services or skip setup.'
                      : '⚠️ Environment needs configuration. Let\'s set it up!'}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        );

      case 2: // Select Services
        return (
          <div className="py-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Select Services to Configure
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              Choose which services you'd like to set up. You can always add more later.
            </p>
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(serviceConfigs).map(([key, config]) => (
                <label
                  key={key}
                  className="flex items-center p-4 border rounded-lg cursor-pointer transition-all hover:shadow-sm"
                  style={{
                    backgroundColor: selectedServices.has(key) 
                      ? 'var(--color-primary-background)' 
                      : 'var(--color-surface)',
                    borderColor: selectedServices.has(key) 
                      ? 'var(--color-primary)' 
                      : 'var(--color-border)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedServices.has(key)}
                    onChange={() => handleServiceToggle(key)}
                    className="mr-3"
                  />
                  <span className="text-2xl mr-3">{config.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      {config.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {config.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );

      case 3: // Configure Services
        return (
          <div className="py-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Configure Selected Services
            </h3>
            {selectedServices.size === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🤷‍♂️</div>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  No services selected. Go back to select some services to configure.
                </p>
              </div>
            ) : (
              <div className="space-y-6 max-h-96 overflow-y-auto">
                {Array.from(selectedServices).map(service => {
                  const config = serviceConfigs[service as keyof typeof serviceConfigs];
                  const serviceData = formData[service as keyof SetupForm] as any || {};
                  
                  return (
                    <div key={service} className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">{config.icon}</span>
                        <h4 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {config.name}
                        </h4>
                      </div>
                      <div className="space-y-3">
                        {config.fields.map(field => (
                          <div key={field.key}>
                            <label 
                              className="block text-xs font-medium mb-1"
                              style={{ color: 'var(--color-text-secondary)' }}
                            >
                              {field.label} {field.key !== 'url' && <span className="text-red-500">*</span>}
                            </label>
                            <input
                              type={field.type}
                              value={serviceData[field.key] || ''}
                              onChange={(e) => handleFieldChange(service, field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className="w-full px-3 py-2 border rounded focus:ring-2 outline-none text-sm"
                              style={{
                                backgroundColor: 'var(--color-surface)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text-primary)',
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 4: // Create Environment
        return (
          <div className="py-6">
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Create Environment
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              Ready to create your .env file and set up credential storage.
            </p>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded border">
                <h4 className="font-medium text-sm mb-2">Configuration Summary:</h4>
                <ul className="text-xs space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                  <li>• Environment file (.env) will be created</li>
                  <li>• Secure master key will be generated</li>
                  <li>• {selectedServices.size} service(s) will be configured</li>
                  <li>• Credentials will be encrypted and stored securely</li>
                </ul>
              </div>
              
              {selectedServices.size > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Services to configure:</h4>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(selectedServices).map(service => {
                      const config = serviceConfigs[service as keyof typeof serviceConfigs];
                      return (
                        <span 
                          key={service}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                          style={{ 
                            backgroundColor: 'var(--color-primary-background)',
                            color: 'var(--color-primary)'
                          }}
                        >
                          {config.icon} {config.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 5: // Complete
        return (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Setup Complete!
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              Your environment has been configured successfully. You're ready to start using Context Pipeline!
            </p>
            <div className="text-sm space-y-2" style={{ color: 'var(--color-text-muted)' }}>
              <p>✅ Environment file created</p>
              <p>🔐 Credentials stored securely</p>
              <p>🚀 Ready to create workspaces and deploy agents</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        className="relative w-full max-w-2xl h-5/6 rounded-lg shadow-xl flex flex-col"
        style={{
          backgroundColor: 'var(--color-surface-elevated)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              🛠️ Setup Wizard
            </h2>
            <div className="flex items-center gap-2 mt-2">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index <= currentStep ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                />
              ))}
              <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
                {currentStep + 1} of {steps.length}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xl"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div
              className="mb-4 p-3 rounded border-l-4"
              style={{
                backgroundColor: 'var(--color-error-background)',
                borderColor: 'var(--color-error)',
              }}
            >
              <p className="text-sm" style={{ color: 'var(--color-error)' }}>
                ⚠️ {error}
              </p>
            </div>
          )}
          
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={prevStep}
            disabled={currentStep === 0 || loading}
            className="px-4 py-2 rounded transition-colors disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            ← Previous
          </button>
          
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {steps[currentStep]}
          </div>
          
          <button
            onClick={currentStep === steps.length - 1 ? onClose : nextStep}
            disabled={loading || !validateCurrentStep()}
            className="px-4 py-2 rounded transition-colors disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
            }}
          >
            {loading ? '⏳ Working...' : 
             currentStep === steps.length - 1 ? 'Finish' : 
             currentStep === 4 ? 'Create Environment' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}