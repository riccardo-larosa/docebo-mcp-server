import { z } from "zod";
import { McpToolDefinition } from "./index.js";

const listUsersSchema = z.object({
  search_text: z.string().optional().describe("Search users by name or email"),
  page: z.number().int().min(0).default(0).describe("Zero-based page offset (default: 0)"),
  page_size: z.number().int().min(1).max(200).default(20).describe("Max records per page (default: 20, max: 200)"),
  response_format: z.enum(['json', 'markdown']).default('json').describe("Response format: 'json' (default) returns raw API data, 'markdown' returns a concise formatted summary."),
});

const getUserSchema = z.object({
  user_id: z.string().describe("The unique user ID"),
  response_format: z.enum(['json', 'markdown']).default('json').describe("Response format: 'json' (default) returns raw API data, 'markdown' returns a concise formatted summary."),
});

export const usersToolsMap: Map<string, McpToolDefinition> = new Map([
  ["list_users", {
    name: "list_users",
    description: `Purpose: Searches and lists platform users from the Docebo learning platform.

Returns: Collection of users with profile data (name, email, role, department) and pagination info.

Usage Guidance:
  - Use to find users by name or email.
  - Use to list team members or browse the user directory.
  - Returns user IDs needed for enrollment queries with list_enrollments.
  - Supports pagination via page and page_size parameters.`,
    inputSchema: z.toJSONSchema(listUsersSchema),
    zodSchema: listUsersSchema,
    method: "get",
    pathTemplate: "manage/v1/user",
    executionParameters: [
      { "name": "search_text", "in": "query" },
      { "name": "page", "in": "query" },
      { "name": "page_size", "in": "query" },
    ],
    requestBodyContentType: undefined,
    securityRequirements: [{ "bearerAuth": [] }],
    annotations: {
      title: "List Users",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    }
  }],
  ["get_user", {
    name: "get_user",
    description: `Purpose: Retrieves detailed user profile information by user ID.

Returns: Full user profile including name, email, role, department, branch, and status.

Usage Guidance:
  - Use when you have a user_id from list_users.
  - Use list_users first to find a user by name or email.`,
    inputSchema: z.toJSONSchema(getUserSchema),
    zodSchema: getUserSchema,
    method: "get",
    pathTemplate: "manage/v1/user/{user_id}",
    executionParameters: [{ "name": "user_id", "in": "path" }],
    requestBodyContentType: undefined,
    securityRequirements: [{ "bearerAuth": [] }],
    annotations: {
      title: "Get User Details",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    }
  }]
]);
