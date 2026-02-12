import { z } from "zod";
import { McpToolDefinition } from "./index.js";

const listEnrollmentsSchema = z.object({
  id_user: z.string().optional().describe("Filter enrollments by user ID"),
  id_course: z.string().optional().describe("Filter enrollments by course ID"),
  status: z.string().optional().describe("Filter by enrollment status (e.g., subscribed, in_progress, completed)"),
  page: z.string().optional().describe("Zero-based page offset"),
  page_size: z.string().optional().describe("Max records per page"),
});

const getEnrollmentDetailsSchema = z.object({
  id_course: z.string().describe("The course ID"),
  id_user: z.string().describe("The user ID"),
});

export const enrollmentsToolsMap: Map<string, McpToolDefinition> = new Map([
  ["list-enrollments", {
    name: "list-enrollments",
    description: `Purpose: Retrieves a paginated list of course enrollments from the Docebo learning platform.

Returns: Collection of enrollments with user, course, status, and completion data, plus pagination info.

Usage Guidance:
  - Use to check who is enrolled in what, and their progress.
  - Filter by id_user to see a specific user's enrollments.
  - Filter by id_course to see all enrollees for a specific course.
  - Filter by status to find completed, in-progress, or subscribed enrollments.
  - Supports pagination via page and page_size parameters.`,
    inputSchema: z.toJSONSchema(listEnrollmentsSchema),
    zodSchema: listEnrollmentsSchema,
    method: "get",
    pathTemplate: "learn/v1/enrollments",
    executionParameters: [
      { "name": "id_user", "in": "query" },
      { "name": "id_course", "in": "query" },
      { "name": "status", "in": "query" },
      { "name": "page", "in": "query" },
      { "name": "page_size", "in": "query" },
    ],
    requestBodyContentType: undefined,
    securityRequirements: [{ "bearerAuth": [] }],
    annotations: {
      title: "List Enrollments",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    }
  }],
  ["get-enrollment-details", {
    name: "get-enrollment-details",
    description: `Purpose: Retrieves detailed information about a specific enrollment for a given course and user.

Returns: Full enrollment object including completion percentage, dates, status, score, and subscription info.

Usage Guidance:
  - Use when you have both a course ID and user ID and need full enrollment details.
  - Use list-enrollments first to find enrollments by user or course.`,
    inputSchema: z.toJSONSchema(getEnrollmentDetailsSchema),
    zodSchema: getEnrollmentDetailsSchema,
    method: "get",
    pathTemplate: "learn/v1/enrollments/{id_course}/{id_user}",
    executionParameters: [
      { "name": "id_course", "in": "path" },
      { "name": "id_user", "in": "path" },
    ],
    requestBodyContentType: undefined,
    securityRequirements: [{ "bearerAuth": [] }],
    annotations: {
      title: "Get Enrollment Details",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    }
  }]
]);
