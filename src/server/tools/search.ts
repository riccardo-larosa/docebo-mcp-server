import { z } from "zod";
import { McpToolDefinition } from "./index.js";

const globalSearchSchema = z.object({
  criteria: z.string().trim().min(1).describe("Search string to query Docebo content (e.g. 'compliance training')"),
  page: z.number().int().min(0).default(0).describe("Zero-based page offset (default: 0)"),
  page_size: z.number().int().min(1).max(200).default(20).describe("Max records per page (default: 20, max: 200)"),
  response_format: z.enum(['json', 'markdown']).default('json').describe("Response format: 'json' (default) returns raw API data, 'markdown' returns a concise formatted summary."),
});

export const searchToolsMap: Map<string, McpToolDefinition> = new Map([
  ["global_search", {
    name: "global_search",
    description: `Purpose: Searches all Docebo content using the global search API.

Returns: Search results across courses, learning plans, documents, and other content types.

Usage Guidance:
  - Use for quick keyword searches across all content types.
  - Provide a search term in the 'criteria' parameter.
  - For AI-powered semantic search, use harmony_search instead.
  - Supports pagination via page and page_size parameters.`,
    inputSchema: z.toJSONSchema(globalSearchSchema),
    zodSchema: globalSearchSchema,
    method: "get",
    pathTemplate: "manage/v1/globalsearch/search",
    executionParameters: [
      { "name": "criteria", "in": "query" },
      { "name": "page", "in": "query" },
      { "name": "page_size", "in": "query" },
    ],
    requestBodyContentType: undefined,
    securityRequirements: [{ "bearerAuth": [] }],
    annotations: {
      title: "Global Search",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    }
  }]
]);
