import { NextRequest, NextResponse } from 'next/server';
import GlobalConfigManager, { GlobalConfig, PermissionSet } from '@/lib/global-config';
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const configManager = GlobalConfigManager.getInstance();
    switch (action) {
      case 'load':
        const config = await configManager.loadConfig();
        return NextResponse.json({
          success: true,
          config,
          message: 'Configuration loaded successfully'
        });
      case 'permissions':
        const templateName = searchParams.get('template');
        const role = searchParams.get('role');
        let permissions: PermissionSet | null = null;
        if (templateName) {
          permissions = configManager.getPermissionTemplate(templateName);
        } else if (role) {
          permissions = configManager.getRolePermissions(role);
        }
        return NextResponse.json({
          success: true,
          permissions,
          message: permissions ? 'Permissions retrieved successfully' : 'Permissions not found'
        });
      case 'validate':
        const permissionsToValidate = searchParams.get('permissions');
        if (!permissionsToValidate) {
          return NextResponse.json({
            success: false,
            message: 'No permissions provided for validation'
          }, { status: 400 });
        }
        try {
          const permissions = JSON.parse(permissionsToValidate);
          const isValid = configManager.validatePermissions(permissions);
          return NextResponse.json({
            success: true,
            isValid,
            message: isValid ? 'Permissions are valid' : 'Permissions are invalid'
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Invalid permissions format'
          }, { status: 400 });
        }
      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action. Available actions: load, permissions, validate'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Config API GET error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const configManager = GlobalConfigManager.getInstance();
    const body = await request.json();
    switch (action) {
      case 'save':
        if (!body.config) {
          return NextResponse.json({
            success: false,
            message: 'Configuration data is required'
          }, { status: 400 });
        }
        await configManager.saveConfig(body.config as GlobalConfig);
        return NextResponse.json({
          success: true,
          message: 'Configuration saved successfully'
        });
      case 'update-permissions':
        const currentConfig = await configManager.loadConfig();
        if (body.template && body.permissions) {
          currentConfig.permissions.templates[body.template] = body.permissions;
        }
        if (body.role && body.permissions) {
          currentConfig.permissions.roleBasedDefaults[body.role] = body.permissions;
        }
        if (body.defaults) {
          currentConfig.permissions.defaults = body.defaults;
        }
        await configManager.saveConfig(currentConfig);
        return NextResponse.json({
          success: true,
          message: 'Permissions updated successfully'
        });
      case 'add-command':
        const config = await configManager.loadConfig();
        if (body.command && body.command.id) {
          config.commands.globalCommands[body.command.id] = body.command;
          await configManager.saveConfig(config);
          return NextResponse.json({
            success: true,
            message: 'Command added successfully'
          });
        }
        return NextResponse.json({
          success: false,
          message: 'Invalid command data'
        }, { status: 400 });
      case 'update-hotkeys':
        const configForHotkeys = await configManager.loadConfig();
        if (body.hotKeys) {
          configForHotkeys.commands.hotKeys = {
            ...configForHotkeys.commands.hotKeys,
            ...body.hotKeys
          };
          await configManager.saveConfig(configForHotkeys);
          return NextResponse.json({
            success: true,
            message: 'Hot keys updated successfully'
          });
        }
        return NextResponse.json({
          success: false,
          message: 'Hot keys data is required'
        }, { status: 400 });
      case 'reset':
        // Create a fresh default configuration
        const freshConfig = await configManager.loadConfig();
        await configManager.saveConfig(freshConfig);
        return NextResponse.json({
          success: true,
          message: 'Configuration reset to defaults'
        });
      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action. Available actions: save, update-permissions, add-command, update-hotkeys, reset'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Config API POST error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const configManager = GlobalConfigManager.getInstance();
    const body = await request.json();
    switch (action) {
      case 'merge-permissions':
        if (!body.permissions) {
          return NextResponse.json({
            success: false,
            message: 'Permissions data is required'
          }, { status: 400 });
        }
        const mergedPermissions = configManager.mergeWithDefaults(body.permissions);
        return NextResponse.json({
          success: true,
          permissions: mergedPermissions,
          message: 'Permissions merged with defaults'
        });
      case 'check-permission':
        if (!body.permissions || !body.operation || !body.target) {
          return NextResponse.json({
            success: false,
            message: 'permissions, operation, and target are required'
          }, { status: 400 });
        }
        const isAllowed = configManager.isPermissionAllowed(
          body.permissions,
          body.operation,
          body.target
        );
        return NextResponse.json({
          success: true,
          isAllowed,
          message: isAllowed ? 'Permission allowed' : 'Permission denied'
        });
      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action. Available actions: merge-permissions, check-permission'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Config API PUT error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const configManager = GlobalConfigManager.getInstance();
    switch (action) {
      case 'remove-template':
        const templateName = searchParams.get('template');
        if (!templateName) {
          return NextResponse.json({
            success: false,
            message: 'Template name is required'
          }, { status: 400 });
        }
        const config = await configManager.loadConfig();
        delete config.permissions.templates[templateName];
        await configManager.saveConfig(config);
        return NextResponse.json({
          success: true,
          message: 'Template removed successfully'
        });
      case 'remove-command':
        const commandId = searchParams.get('command');
        if (!commandId) {
          return NextResponse.json({
            success: false,
            message: 'Command ID is required'
          }, { status: 400 });
        }
        const configForCommand = await configManager.loadConfig();
        delete configForCommand.commands.globalCommands[commandId];
        await configManager.saveConfig(configForCommand);
        return NextResponse.json({
          success: true,
          message: 'Command removed successfully'
        });
      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action. Available actions: remove-template, remove-command'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Config API DELETE error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}