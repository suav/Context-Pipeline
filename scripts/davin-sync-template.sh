#!/bin/bash
# Davin Development Server Sync Script Template
# This script should be deployed on davinnsv2.davindev.com
# Called when workspace testing deployments are triggered

set -e  # Exit on any error

# Input parameters from deployment trigger
BRANCH_NAME=$1
WORKSPACE_IDS=$2
DEPLOYMENT_ID=$3
COMBINATION_NAME=$4

# Configuration - Update these paths for the actual Davin server
REPO_DIR="/var/www/davin-app"
LOG_FILE="/var/log/workspace-deployments.log"
HEALTH_CHECK_URL="http://localhost:3000/api/health"
BACKUP_DIR="/var/backups/davin-app"
MAX_RETRIES=3
TIMEOUT=300  # 5 minutes

# Notification settings
WEBHOOK_URL="${CONTEXT_PIPELINE_WEBHOOK:-http://localhost:3000/api/deployment/status}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [DAVIN-DEPLOY] [$DEPLOYMENT_ID] $1" | tee -a $LOG_FILE
}

# Error handling function
handle_error() {
    local error_message="$1"
    log "ERROR: $error_message"
    
    # Notify failure
    notify_status "failed" "$error_message"
    
    # Attempt rollback
    log "Attempting rollback to previous version"
    rollback_deployment
    
    exit 1
}

# Notification function
notify_status() {
    local status="$1"
    local message="$2"
    local test_url="$3"
    
    # Notify context pipeline
    if [ -n "$WEBHOOK_URL" ]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"deploymentId\": \"$DEPLOYMENT_ID\",
                \"branch\": \"$BRANCH_NAME\",
                \"status\": \"$status\",
                \"message\": \"$message\",
                \"testUrl\": \"$test_url\",
                \"workspaceIds\": \"$WORKSPACE_IDS\",
                \"timestamp\": \"$(date -Iseconds)\"
            }" \
            --silent --show-error || log "Failed to notify webhook"
    fi
    
    # Notify Slack if configured
    if [ -n "$SLACK_WEBHOOK" ]; then
        local emoji=""
        case $status in
            "deploying") emoji="🚀" ;;
            "completed") emoji="✅" ;;
            "failed") emoji="❌" ;;
            *) emoji="ℹ️" ;;
        esac
        
        curl -X POST "$SLACK_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"$emoji Davin Deployment $status\",
                \"attachments\": [{
                    \"fields\": [
                        {\"title\": \"Branch\", \"value\": \"$BRANCH_NAME\", \"short\": true},
                        {\"title\": \"Workspaces\", \"value\": \"$WORKSPACE_IDS\", \"short\": true},
                        {\"title\": \"Test URL\", \"value\": \"$test_url\", \"short\": false}
                    ]
                }]
            }" \
            --silent || log "Failed to notify Slack"
    fi
}

# Backup current deployment
backup_current_deployment() {
    log "Creating backup of current deployment"
    local backup_name="backup-$(date +%Y%m%d-%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    mkdir -p "$BACKUP_DIR"
    cp -r "$REPO_DIR" "$backup_path"
    
    # Keep only last 5 backups
    cd "$BACKUP_DIR"
    ls -t | tail -n +6 | xargs -r rm -rf
    
    echo "$backup_path" > "$REPO_DIR/.last_backup"
    log "Backup created at $backup_path"
}

# Rollback deployment
rollback_deployment() {
    log "Rolling back deployment"
    
    if [ -f "$REPO_DIR/.last_backup" ]; then
        local backup_path=$(cat "$REPO_DIR/.last_backup")
        if [ -d "$backup_path" ]; then
            log "Restoring from backup: $backup_path"
            rm -rf "$REPO_DIR"
            cp -r "$backup_path" "$REPO_DIR"
            
            # Restart application
            cd "$REPO_DIR"
            npm run build
            pm2 restart davin-app
            
            log "Rollback completed"
            return 0
        fi
    fi
    
    # Fallback: checkout main branch
    log "No backup found, falling back to main branch"
    cd "$REPO_DIR"
    git checkout main
    git pull origin main
    npm run build
    pm2 restart davin-app
    
    log "Fallback to main branch completed"
}

# Health check function
perform_health_check() {
    log "Performing health check"
    
    for i in $(seq 1 $MAX_RETRIES); do
        if curl -f --max-time 30 "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            log "Health check passed on attempt $i"
            return 0
        else
            log "Health check failed on attempt $i"
            if [ $i -eq $MAX_RETRIES ]; then
                return 1
            fi
            sleep 10
        fi
    done
    
    return 1
}

# Main deployment function
main() {
    log "Starting Davin deployment"
    log "Branch: $BRANCH_NAME"
    log "Workspaces: $WORKSPACE_IDS"
    log "Deployment ID: $DEPLOYMENT_ID"
    log "Combination: $COMBINATION_NAME"
    
    # Validate inputs
    if [ -z "$BRANCH_NAME" ] || [ -z "$WORKSPACE_IDS" ] || [ -z "$DEPLOYMENT_ID" ]; then
        handle_error "Missing required parameters"
    fi
    
    # Notify deployment start
    notify_status "deploying" "Starting deployment of workspace combination"
    
    # Create backup
    backup_current_deployment
    
    # Change to repository directory
    cd "$REPO_DIR" || handle_error "Cannot access repository directory: $REPO_DIR"
    
    # Fetch latest changes
    log "Fetching latest changes from repository"
    git fetch origin || handle_error "Failed to fetch from repository"
    
    # Checkout and pull the test branch
    log "Checking out branch: $BRANCH_NAME"
    git checkout "$BRANCH_NAME" || handle_error "Failed to checkout branch: $BRANCH_NAME"
    git pull origin "$BRANCH_NAME" || handle_error "Failed to pull branch: $BRANCH_NAME"
    
    # Install dependencies (if package.json changed)
    if git diff --name-only HEAD~1 HEAD | grep -q package.json; then
        log "Package.json changed, installing dependencies"
        npm ci || handle_error "Failed to install dependencies"
    fi
    
    # Build application
    log "Building application"
    npm run build || handle_error "Failed to build application"
    
    # Stop current application
    log "Stopping current application"
    pm2 stop davin-app || log "Application was not running"
    
    # Start application
    log "Starting new application"
    pm2 start ecosystem.config.js --env development --name davin-app || handle_error "Failed to start application"
    
    # Wait for application to start
    log "Waiting for application to start..."
    sleep 30
    
    # Perform health check
    if ! perform_health_check; then
        handle_error "Health check failed after deployment"
    fi
    
    # Generate test URL
    local test_url="https://test-$(echo $BRANCH_NAME | sed 's/[^a-zA-Z0-9]/-/g').davindev.com"
    
    log "Deployment completed successfully!"
    log "Test URL: $test_url"
    
    # Notify success
    notify_status "completed" "Deployment completed successfully" "$test_url"
    
    # Log deployment metadata
    echo "{
        \"deploymentId\": \"$DEPLOYMENT_ID\",
        \"branch\": \"$BRANCH_NAME\",
        \"workspaceIds\": \"$WORKSPACE_IDS\",
        \"testUrl\": \"$test_url\",
        \"deployedAt\": \"$(date -Iseconds)\",
        \"status\": \"completed\"
    }" > "$REPO_DIR/.deployment_info"
    
    log "Davin deployment completed successfully"
}

# Trap errors
trap 'handle_error "Unexpected error occurred"' ERR

# Run main function
main "$@"