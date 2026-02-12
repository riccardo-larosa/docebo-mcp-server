import { z } from "zod";
import { McpToolDefinition } from "./index.js";

const listEnrollmentsSchema = z.object({
  user_id: z.string().optional().describe("Filter enrollments by user ID"),
  course_id: z.string().optional().describe("Filter enrollments by course ID"),
  status: z.string().optional().describe("Filter by enrollment status (e.g., subscribed, in_progress, completed)"),
  page: z.string().optional().describe("Zero-based page offset"),
  page_size: z.string().optional().describe("Max records per page"),
});

const getEnrollmentDetailsSchema = z.object({
  enrollment_id: z.string().describe("The unique enrollment ID"),
});

export const enrollmentsToolsMap: Map<string, McpToolDefinition> = new Map([
  ["list-enrollments", {
    name: "list-enrollments",
    description: `Purpose: Retrieves a paginated list of course enrollments from the Docebo learning platform.

Returns: Collection of enrollments with user, course, status, and completion data, plus pagination info.

Usage Guidance:
  - Use to check who is enrolled in what, and their progress.
  - Filter by user_id to see a specific user's enrollments.
  - Filter by course_id to see all enrollees for a specific course.
  - Filter by status to find completed, in-progress, or subscribed enrollments.
  - Supports pagination via page and page_size parameters.`,
    inputSchema: z.toJSONSchema(listEnrollmentsSchema),
    zodSchema: listEnrollmentsSchema,
    method: "get",
    pathTemplate: "learn/v1/enrollments",
    executionParameters: [
      { "name": "user_id", "in": "query" },
      { "name": "course_id", "in": "query" },
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
    description: `Purpose: Retrieves detailed information about a single enrollment by its ID.

Returns: Full enrollment object including completion percentage, dates, status, and course/user references.

Usage Guidance:
  - Use when you have a specific enrollment_id from list-enrollments.
  - Use list-enrollments first to find enrollments by user or course.`,
    inputSchema: z.toJSONSchema(getEnrollmentDetailsSchema),
    zodSchema: getEnrollmentDetailsSchema,
    method: "get",
    pathTemplate: "learn/v1/enrollments/{enrollment_id}",
    executionParameters: [{ "name": "enrollment_id", "in": "path" }],
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
