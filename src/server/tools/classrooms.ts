import { z } from "zod";
import { McpToolDefinition } from "./index.js";

const listClassroomsSchema = z.object({
  page_size: z.string().optional().describe("The maximum number of records per page for this response."),
  page: z.string().optional().describe("The current offset by number of pages. Offset is zero-based."),
});

const getClassroomSchema = z.object({
  id: z.string().describe("The unique identifier for a classroom."),
});

export const classroomsToolsMap: Map<string, McpToolDefinition> = new Map([
  ["list-all-classrooms", {
    name: "list-all-classrooms",
    description: `Purpose: Retrieves a paginated list of all classrooms (ILT sessions) from the Docebo learning platform.

Returns: Collection of classrooms with metadata and pagination info.

Usage Guidance:
  - Use for browsing and exploring available classrooms.
  - Use get-a-classroom when you need full details for a specific classroom.
  - Supports pagination via page and page_size parameters.`,
    inputSchema: z.toJSONSchema(listClassroomsSchema),
    zodSchema: listClassroomsSchema,
    method: "get",
    pathTemplate: "learn/v1/classroom",
    executionParameters: [{ "name": "filter", "in": "query" }, { "name": "page", "in": "query" }, { "name": "page_size", "in": "query" }],
    requestBodyContentType: undefined,
    securityRequirements: [{ "bearerAuth": [] }],
    annotations: {
      title: "List Classrooms",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    }
  }],
  ["get-a-classroom", {
    name: "get-a-classroom",
    description: `Purpose: Retrieves detailed information about a single classroom by its ID.

Returns: Full classroom object including settings, schedule, and capacity details.

Usage Guidance:
  - Use when you already have a classroom ID and need its full details.
  - Use list-all-classrooms first if you need to find a classroom by name or browse available classrooms.`,
    inputSchema: z.toJSONSchema(getClassroomSchema),
    zodSchema: getClassroomSchema,
    method: "get",
    pathTemplate: "learn/v1/classroom/{id}",
    executionParameters: [{ "name": "id", "in": "path" }],
    requestBodyContentType: undefined,
    securityRequirements: [{ "bearerAuth": [] }],
    annotations: {
      title: "Get Classroom Details",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    }
  }]
])
