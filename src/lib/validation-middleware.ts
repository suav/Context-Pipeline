import { NextRequest, NextResponse } from 'next/server';
import { sanitize, securityConfig } from './security-config';
export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'email' | 'workspaceId' | 'filename';
  required?: boolean;
  maxLength?: number;
  pattern?: RegExp;
}
export class ValidationError extends Error {
  constructor(field: string, message: string) {
    super(`Validation error for field '${field}': ${message}`);
    this.name = 'ValidationError';
  }
}
export function validateInput(data: any, rules: ValidationRule[]): any {
  const validated: any = {};
  for (const rule of rules) {
    const value = data[rule.field];
    // Check required fields
    if (rule.required && (value === undefined || value === null || value === '')) {
      throw new ValidationError(rule.field, 'Field is required');
    }
    // Skip validation for optional empty fields
    if (!rule.required && (value === undefined || value === null || value === '')) {
      continue;
    }
    // Type validation
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new ValidationError(rule.field, 'Must be a string');
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          throw new ValidationError(rule.field, `Must be no longer than ${rule.maxLength} characters`);
        }
        if (value.length > securityConfig.validation.maxStringLength) {
          throw new ValidationError(rule.field, 'String too long');
        }
        validated[rule.field] = sanitize.html(value);
        break;
      case 'number':
        const numValue = Number(value);
        if (isNaN(numValue)) {
          throw new ValidationError(rule.field, 'Must be a number');
        }
        validated[rule.field] = numValue;
        break;
      case 'email':
        if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          throw new ValidationError(rule.field, 'Must be a valid email address');
        }
        validated[rule.field] = value.toLowerCase();
        break;
      case 'workspaceId':
        validated[rule.field] = sanitize.workspaceId(value);
        break;
      case 'filename':
        validated[rule.field] = sanitize.filename(value);
        break;
      default:
        validated[rule.field] = value;
    }
    // Pattern validation
    if (rule.pattern && !rule.pattern.test(validated[rule.field])) {
      throw new ValidationError(rule.field, 'Invalid format');
    }
  }
  return validated;
}
export function withValidation(rules: ValidationRule[]) {
  return function(handler: (req: NextRequest, validatedData: any) => Promise<NextResponse>) {
    return async function(req: NextRequest): Promise<NextResponse> {
      try {
        let data: any = {};
        // Parse request data
        if (req.method === 'POST' || req.method === 'PUT') {
          const contentType = req.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            data = await req.json();
          } else if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await req.formData();
            data = Object.fromEntries(formData.entries());
          }
        }
        // Add URL parameters
        const url = new URL(req.url);
        for (const [key, value] of url.searchParams.entries()) {
          data[key] = value;
        }
        // Validate input
        const validatedData = validateInput(data, rules);
        // Call the handler with validated data
        return await handler(req, validatedData);
      } catch (error) {
        if (error instanceof ValidationError) {
          return NextResponse.json(
            { error: 'Validation failed', details: error.message },
            { status: 400 }
          );
        }
        console.error('Validation middleware error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    };
  };
}
// Common validation rules
export const commonRules = {
  workspaceId: { field: 'workspaceId', type: 'workspaceId' as const, required: true },
  agentId: { field: 'agentId', type: 'string' as const, required: true, maxLength: 50 },
  message: { field: 'message', type: 'string' as const, required: true, maxLength: 10000 },
  filename: { field: 'filename', type: 'filename' as const, required: true },
  email: { field: 'email', type: 'email' as const, required: true }
};