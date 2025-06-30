/**
 * Configuration for Context Import Pipeline
 */

export const config = {
    jira: {
        baseUrl: process.env.JIRA_BASE_URL || '',
        username: process.env.JIRA_USERNAME || '',
        apiToken: process.env.JIRA_API_TOKEN || '',
        maxResults: 20,
        defaultFields: 'key,summary,description,status,priority,assignee,created,updated,labels'
    },
    
    git: {
        repoUrl: process.env.REPO_URL || '',
        defaultBranch: process.env.DEFAULT_BRANCH || 'main',
        maxFiles: 10
    },
    
    user: {
        name: process.env.USER_NAME || '',
        email: process.env.USER_EMAIL || ''
    }
};