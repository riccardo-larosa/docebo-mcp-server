/**
 * Tool annotations that hint at the tool's behavior.
 * Helps the LLM reason about safety and side effects.
 */
export interface McpToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/**
 * Interface for MCP Tool Definition
 */
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  zodSchema?: import('zod').ZodTypeAny;
  method: string;
  pathTemplate: string;
  executionParameters: { name: string, in: string }[];
  requestBodyContentType?: string;
  securityRequirements: any[];
  annotations?: McpToolAnnotations;
}

export { BaseTool } from './baseTool.js';
