# SSH Key Management for Multiple Repositories

The Context Pipeline credentials system now supports specifying different SSH keys for different Git repositories.

## Setup

### Single Repository (Default SSH Key)
```env
# Use default SSH key (~/.ssh/id_rsa)
REPO_URL=git@github.com:user/repo.git
```

### Multiple Repositories with Specific SSH Keys
```env
# Primary repository
REPO_URL=git@github.com:user/primary-repo.git
SSH_KEY_PATH=/home/user/.ssh/id_rsa_primary

# Additional repositories can be added through the UI
# Example repository configurations:
# REPO_URL_2=git@github.com:user/secondary-repo.git
# SSH_KEY_PATH_2=/home/user/.ssh/id_rsa_secondary
```

## Usage Through UI

1. **Open Credentials Manager** - Click the settings/credentials button
2. **Add New Git Repository**:
   - Select "Git Repository" service
   - Enter repository URL: `git@github.com:user/repo.git`
   - Enter SSH key path: `/home/user/.ssh/id_rsa_specific` (optional)
   - If no SSH key path is provided, the default SSH key will be used

3. **Edit Existing Repository**:
   - Click "Edit" on any Git credential
   - Modify the SSH key path field
   - Leave blank to use default SSH key

## SSH Key Path Examples

```bash
# Default SSH key (no path needed)
~/.ssh/id_rsa

# Specific keys for different repositories
/home/user/.ssh/id_rsa_work
/home/user/.ssh/id_rsa_personal
/home/user/.ssh/id_ed25519_github
~/.ssh/keys/specific_project_key
```

## Best Practices

1. **Key Permissions**: Ensure SSH keys have correct permissions (`chmod 600`)
2. **SSH Config**: Consider using `~/.ssh/config` for complex setups
3. **Key Management**: Use descriptive names for multiple keys
4. **Security**: Never commit private keys to repositories

## SSH Config Alternative

For complex multi-key setups, you can also use SSH config:

```bash
# ~/.ssh/config
Host github-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa_work

Host github-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa_personal
```

Then use URLs like:
- `git@github-work:company/repo.git`
- `git@github-personal:user/repo.git`