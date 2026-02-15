import { z, ZodError, type ZodTypeAny } from 'zod';
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { McpToolAnnotations } from './index.js';

/**
 * Abstract base class for MCP tools.
 *
 * Subclass this to create tools with built-in validation, error handling,
 * and standard response formatting.
 */
export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract zodSchema: ZodTypeAny;

  /** Optional MCP tool annotations (readOnlyHint, destructiveHint, etc.) */
  annotations?: McpToolAnnotations;

  /**
   * Process the validated input and return a result.
   * Override this in subclasses to implement the tool's logic.
   */
  abstract process(input: unknown, bearerToken?: string): Promise<unknown>;

  /**
   * Validate args, call process(), and return a formatted CallToolResult.
   */
  async handleRequest(args: Record<string, unknown>, bearerToken?: string): Promise<CallToolResult> {
    try {
      const validated = this.zodSchema.parse(args);
      const result = await this.process(validated, bearerToken);
      return this.formatResponse(result);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const message = `Invalid arguments for tool '${this.name}': ${error.issues.map(e => `${e.path.join('.')} (${e.code}): ${e.message}`).join(', ')}`;
        return this.formatError(message);
      }
      return this.formatError(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Return the MCP Tool definition object for ListTools responses.
   */
  getToolDefinition(): Tool {
    return {
      name: this.name,
      description: this.description,
      inputSchema: z.toJSONSchema(this.zodSchema) as Tool['inputSchema'],
      ...(this.annotations && { annotations: this.annotations }),
    };
  }

  protected formatResponse(result: unknown): CallToolResult {
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    return { content: [{ type: 'text', text }] };
  }

  protected formatError(message: string): CallToolResult {
    return { content: [{ type: 'text', text: message }], isError: true };
  }
}
