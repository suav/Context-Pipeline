/**
 * Credential Selector Service
 * Handles credential selection for import workflows
 */

interface Credential {
  id: string;
  name: string;
  service: 'jira' | 'github' | 'gitlab' | 'email' | 'slack' | 'custom';
  status: 'active' | 'inactive' | 'error';
  lastUsed?: string;
  fields: Record<string, string>;
}

interface CredentialGroup {
  service: string;
  credentials: Credential[];
  active: Credential[];
  defaultCredential?: Credential;
}

export class CredentialSelector {
  private static instance: CredentialSelector;
  private credentials: Credential[] = [];
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): CredentialSelector {
    if (!CredentialSelector.instance) {
      CredentialSelector.instance = new CredentialSelector();
    }
    return CredentialSelector.instance;
  }

  /**
   * Get all credentials, with caching
   */
  async getCredentials(forceRefresh = false): Promise<Credential[]> {
    const now = Date.now();
    
    if (!forceRefresh && this.credentials.length > 0 && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.credentials;
    }

    try {
      const response = await fetch('/api/credentials');
      const data = await response.json();
      
      if (data.success) {
        this.credentials = data.credentials;
        this.lastFetch = now;
        return this.credentials;
      } else {
        throw new Error(data.error || 'Failed to load credentials');
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
      throw error;
    }
  }

  /**
   * Get credentials for a specific service
   */
  async getCredentialsForService(service: string): Promise<Credential[]> {
    const allCredentials = await this.getCredentials();
    return allCredentials.filter(cred => cred.service === service);
  }

  /**
   * Get active credentials for a service
   */
  async getActiveCredentialsForService(service: string): Promise<Credential[]> {
    const serviceCredentials = await this.getCredentialsForService(service);
    return serviceCredentials.filter(cred => cred.status === 'active');
  }

  /**
   * Get default credential for a service (most recently used active one)
   */
  async getDefaultCredentialForService(service: string): Promise<Credential | null> {
    const activeCredentials = await this.getActiveCredentialsForService(service);
    
    if (activeCredentials.length === 0) {
      return null;
    }

    // Sort by last used date (most recent first)
    activeCredentials.sort((a, b) => {
      const dateA = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
      const dateB = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
      return dateB - dateA;
    });

    return activeCredentials[0];
  }

  /**
   * Get grouped credentials by service
   */
  async getGroupedCredentials(): Promise<CredentialGroup[]> {
    const allCredentials = await this.getCredentials();
    const services = [...new Set(allCredentials.map(cred => cred.service))];
    
    const groups: CredentialGroup[] = [];
    
    for (const service of services) {
      const serviceCredentials = allCredentials.filter(cred => cred.service === service);
      const activeCredentials = serviceCredentials.filter(cred => cred.status === 'active');
      const defaultCredential = await this.getDefaultCredentialForService(service);
      
      groups.push({
        service,
        credentials: serviceCredentials,
        active: activeCredentials,
        defaultCredential: defaultCredential || undefined
      });
    }
    
    return groups;
  }

  /**
   * Get credential by ID
   */
  async getCredentialById(id: string): Promise<Credential | null> {
    const allCredentials = await this.getCredentials();
    return allCredentials.find(cred => cred.id === id) || null;
  }

  /**
   * Check if any credentials exist for a service
   */
  async hasCredentialsForService(service: string): Promise<boolean> {
    const serviceCredentials = await this.getCredentialsForService(service);
    return serviceCredentials.length > 0;
  }

  /**
   * Check if any active credentials exist for a service
   */
  async hasActiveCredentialsForService(service: string): Promise<boolean> {
    const activeCredentials = await this.getActiveCredentialsForService(service);
    return activeCredentials.length > 0;
  }

  /**
   * Get credential field values (for use in API calls)
   */
  getCredentialFields(credential: Credential): Record<string, string> {
    return credential.fields;
  }

  /**
   * Format credential for display
   */
  formatCredentialForDisplay(credential: Credential): string {
    const service = credential.service.toUpperCase();
    const status = credential.status === 'active' ? '✅' : 
                   credential.status === 'error' ? '❌' : '⏸️';
    
    return `${status} ${credential.name} (${service})`;
  }

  /**
   * Clear cache (useful when credentials are updated)
   */
  clearCache(): void {
    this.credentials = [];
    this.lastFetch = 0;
  }

  /**
   * Validate credential for service requirements
   */
  validateCredentialForService(credential: Credential, requiredFields: string[]): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    const fields = credential.fields;
    
    for (const field of requiredFields) {
      if (!fields[field] || fields[field].trim() === '') {
        missing.push(field);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Get service requirements
   */
  getServiceRequirements(service: string): string[] {
    const requirements: Record<string, string[]> = {
      jira: ['url', 'email', 'api_token'],
      github: ['token'], // For token-based auth
      git: ['repo_url'], // For SSH-based auth (ssh_key_path is optional)
      gitlab: ['token'],
      email: ['host', 'email', 'password'],
      slack: ['token'],
      custom: ['url']
    };
    
    return requirements[service] || [];
  }
}