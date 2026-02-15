import { z } from "zod";
import { McpToolDefinition } from "./index.js";

const listCoursesSchema = z.object({
  page: z.number().int().min(0).default(0).describe("Zero-based page offset (default: 0)"),
  page_size: z.number().int().min(1).max(200).default(20).describe("Max records per page (default: 20, max: 200)"),
  search_text: z.string().optional().describe("Search courses by name or description."),
  category: z.string().optional().describe("Filter courses by category name."),
  status: z.string().optional().describe("Filter courses by status (e.g., published, under_maintenance)."),
  sort_by: z.string().optional().describe("Sort results by field (e.g., name, date_created)."),
  sort_order: z.string().optional().describe("Sort order: asc or desc."),
  response_format: z.enum(['json', 'markdown']).default('json').describe("Response format: 'json' (default) returns raw API data, 'markdown' returns a concise formatted summary."),
});

const getCourseSchema = z.object({
  course_id: z.string().describe("The unique identifier for a course."),
  response_format: z.enum(['json', 'markdown']).default('json').describe("Response format: 'json' (default) returns raw API data, 'markdown' returns a concise formatted summary."),
});

export const coursesToolsMap: Map<string, McpToolDefinition> = new Map([
  ["list_courses", {
    name: "list_courses",
    description: `Purpose: Retrieves a paginated list of all courses from the Docebo learning platform.

Returns: Collection of courses with metadata (name, type, description, dates, category, enrollment policy) and pagination info.

Usage Guidance:
  - Use for browsing, searching, and exploring available courses.
  - Use search_text to find courses by name or description keywords.
  - Use category and status filters to narrow results.
  - Use get_course when you need full details for a specific course.
  - Supports pagination via page and page_size parameters.`,
    inputSchema: z.toJSONSchema(listCoursesSchema),
    zodSchema: listCoursesSchema,
    method: "get",
    pathTemplate: "learn/v1/courses",
    executionParameters: [
      { "name": "page", "in": "query" },
      { "name": "page_size", "in": "query" },
      { "name": "search_text", "in": "query" },
      { "name": "category", "in": "query" },
      { "name": "status", "in": "query" },
      { "name": "sort_by", "in": "query" },
      { "name": "sort_order", "in": "query" },
    ],
    requestBodyContentType: undefined,
    securityRequirements: [{ "bearerAuth": [] }],
    annotations: {
      title: "List Courses",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    }
  }],
  ["get_course", {
    name: "get_course",
    description: `Purpose: Retrieves detailed information about a single course by its ID.

Returns: Full course object including name, description, type, settings, enrollment details, and category.

Usage Guidance:
  - Use when you already have a course_id and need its full details.
  - Use list_courses first if you need to find a course by name or browse available courses.`,
    inputSchema: z.toJSONSchema(getCourseSchema),
    zodSchema: getCourseSchema,
    method: "get",
    pathTemplate: "learn/v1/courses/{course_id}",
    executionParameters: [{ "name": "course_id", "in": "path" }],
    requestBodyContentType: undefined,
    securityRequirements: [{ "bearerAuth": [] }],
    annotations: {
      title: "Get Course Details",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    }
  }]
])
