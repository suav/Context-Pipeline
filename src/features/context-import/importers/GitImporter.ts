import { ContextItem, ImportResult } from '@/features/context-import/types';
export class GitImporter {
    constructor(private credentials: any = {}) {
        this.repoUrl = credentials.repoUrl || process.env.REPO_URL || '';
        this.defaultBranch = credentials.defaultBranch || process.env.DEFAULT_BRANCH || 'main';
        // Parse GitHub repo from URL
        if (this.repoUrl.includes('github.com')) {
            const match = this.repoUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
            if (match) {
                this.owner = match[1];
                this.repo = match[2];
                this.baseUrl = 'https://api.github.com';
            }
        }
        if (!this.owner || !this.repo) {
            throw new Error('Could not parse GitHub repository from URL');
        }
    }
    private repoUrl: string;
    private defaultBranch: string;
    private owner: string = '';
    private repo: string = '';
    private baseUrl: string = '';
    async search(searchParams: any = {}): Promise<ImportResult> {
        try {
            const query = this.buildSearchQuery(searchParams);
            console.log('🔍 GitHub Search Query:', query);
            // Handle special "GRAB_REPO" query
            if (query.includes('GRAB_REPO')) {
                return await this.grabEntireRepo();
            }
            // Use GitHub search API
            const url = `${this.baseUrl}/search/code?q=${encodeURIComponent(query)}&sort=indexed&order=desc`;
            console.log('🌐 GitHub URL:', url);
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Context-Import-Pipeline'
                }
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`GitHub API error ${response.status}: ${errorText}`);
            }
            const data = await response.json();
            // Transform GitHub response to context import format
            const contextItems = await Promise.all(
                data.items.slice(0, 10).map((item: any) => this.transformGitFile(item))
            );
            return {
                success: true,
                source: 'git',
                query: query,
                total: data.total_count,
                items: contextItems.filter(item => item), // Filter out null items
                metadata: {
                    repository: `${this.owner}/${this.repo}`,
                    branch: this.defaultBranch,
                    total_files: data.total_count
                }
            };
        } catch (error) {
            console.error('❌ Git Import Error:', error);
            return {
                success: false,
                source: 'git',
                error: (error as Error).message,
                items: [],
                total: 0
            };
        }
    }
    private buildSearchQuery(searchParams: any): string {
        let query = `repo:${this.owner}/${this.repo}`;
        if (typeof searchParams === 'string') {
            return `${query} ${searchParams}`;
        }
        if (searchParams.query) {
            return `${query} ${searchParams.query}`;
        }
        // Build query from parameters
        const conditions: string[] = [query];
        if (searchParams.path) {
            conditions.push(`path:${searchParams.path}`);
        }
        if (searchParams.filename) {
            conditions.push(`filename:${searchParams.filename}`);
        }
        if (searchParams.extension) {
            conditions.push(`extension:${searchParams.extension}`);
        }
        if (searchParams.content) {
            conditions.push(`"${searchParams.content}"`);
        }
        // Default to documentation if no specific query
        if (conditions.length === 1) {
            conditions.push('path:docs OR filename:README OR filename:*.md');
        }
        return conditions.join(' ');
    }
    private async transformGitFile(gitFile: any): Promise<ContextItem | null> {
        try {
            // Get file content
            const contentResponse = await fetch(gitFile.url, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Context-Import-Pipeline'
                }
            });
            if (!contentResponse.ok) {
                console.warn(`Failed to fetch content for ${gitFile.path}`);
                return null;
            }
            const fileData = await contentResponse.json();
            let content = '';
            // Decode base64 content if it's text
            if (fileData.content && fileData.encoding === 'base64') {
                try {
                    content = atob(fileData.content);
                } catch (e) {
                    console.warn(`Failed to decode content for ${gitFile.path}`);
                    content = '[Binary file content]';
                }
            }
            return {
                id: `git-${gitFile.sha.substring(0, 8)}`,
                title: `${gitFile.name} (${gitFile.path})`,
                description: `File from ${this.owner}/${this.repo} repository`,
                content: {
                    path: gitFile.path,
                    name: gitFile.name,
                    content: content.substring(0, 5000), // Limit content size
                    repo: `${this.owner}/${this.repo}`,
                    branch: this.defaultBranch,
                    sha: gitFile.sha,
                    size: fileData.size,
                    html_url: gitFile.html_url,
                    raw_url: fileData.download_url
                },
                metadata: {
                    source: 'git',
                    repo: `${this.owner}/${this.repo}`,
                    branch: this.defaultBranch,
                    path: gitFile.path,
                    sha: gitFile.sha,
                    size: fileData.size,
                    html_url: gitFile.html_url,
                    raw_url: fileData.download_url
                },
                source: 'git',
                type: 'git_repository',
                preview: this.generatePreview(content, gitFile.path),
                tags: this.extractTags(gitFile.path, content),
                added_at: new Date().toISOString(),
                size_bytes: fileData.size || content.length
            };
        } catch (error) {
            console.warn(`Failed to transform git file ${gitFile.path}:`, error);
            return null;
        }
    }
    private generatePreview(content: string, path: string): string {
        if (!content) return `File: ${path}`;
        // Clean up content for preview
        let preview = content
            .replace(/```[\s\S]*?```/g, '[code block]') // Remove code blocks
            .replace(/#{1,6}\s*/g, '') // Remove markdown headers
            .replace(/\n+/g, ' ') // Collapse newlines
            .trim();
        if (preview.length === 0) {
            preview = `Documentation file: ${path}`;
        }
        return preview.substring(0, 200) + (preview.length > 200 ? '...' : '');
    }
    private extractTags(path: string, content: string): string[] {
        const tags = ['git', 'documentation'];
        // Add tags based on file path
        if (path.includes('/docs/')) tags.push('docs');
        if (path.includes('/api/')) tags.push('api');
        if (path.includes('/config/')) tags.push('config');
        if (path.includes('README')) tags.push('readme');
        if (path.includes('CHANGELOG')) tags.push('changelog');
        // Add tags based on file extension
        const ext = path.split('.').pop()?.toLowerCase();
        if (ext) {
            tags.push(`ext-${ext}`);
        }
        // Add tags based on content (simple keyword detection)
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes('api')) tags.push('api-docs');
        if (lowerContent.includes('install')) tags.push('installation');
        if (lowerContent.includes('config')) tags.push('configuration');
        if (lowerContent.includes('troubleshoot')) tags.push('troubleshooting');
        return [...new Set(tags)]; // Remove duplicates
    }
    async testConnection() {
        try {
            const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}`;
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Context-Import-Pipeline'
                }
            });
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }
            const repo = await response.json();
            return {
                success: true,
                repository: {
                    name: repo.full_name,
                    description: repo.description,
                    language: repo.language,
                    stars: repo.stargazers_count,
                    url: repo.html_url
                }
            };
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }
    async grabEntireRepo(): Promise<ImportResult> {
        try {
            console.log('🚀 Grabbing entire repository:', `${this.owner}/${this.repo}`);
            // Create a special context item representing the entire repository
            const repoContextItem: any = {
                id: `repo-${this.owner}-${this.repo}`,
                title: `Repository: ${this.owner}/${this.repo}`,
                description: `Complete repository clone/reference for ${this.owner}/${this.repo}`,
                content: {
                    repo_url: this.repoUrl,
                    clone_url: `https://github.com/${this.owner}/${this.repo}.git`,
                    ssh_url: `git@github.com:${this.owner}/${this.repo}.git`,
                    owner: this.owner,
                    repo: this.repo,
                    branch: this.defaultBranch,
                    grab_type: 'entire_repository'
                },
                metadata: {
                    source: 'git',
                    repo: `${this.owner}/${this.repo}`,
                    branch: this.defaultBranch,
                    clone_url: `https://github.com/${this.owner}/${this.repo}.git`,
                    ssh_url: `git@github.com:${this.owner}/${this.repo}.git`,
                    grab_type: 'entire_repository'
                },
                source: 'git',
                type: 'git_repository',
                preview: `Repository: ${this.owner}/${this.repo} - Complete codebase for context`,
                tags: ['git', 'repository', 'full-clone', 'context'],
                added_at: new Date().toISOString(),
                size_bytes: 0 // Unknown size for full repo
            };
            return {
                success: true,
                source: 'git',
                query: 'GRAB_REPO',
                total: 1,
                items: [repoContextItem],
                metadata: {
                    repository: `${this.owner}/${this.repo}`,
                    branch: this.defaultBranch,
                    grab_type: 'entire_repository'
                }
            };
        } catch (error) {
            console.error('❌ Grab Repo Error:', error);
            return {
                success: false,
                source: 'git',
                error: (error as Error).message,
                items: [],
                total: 0
            };
        }
    }
}