import { z } from "zod";
import { McpToolDefinition } from "./index.js";

const listEnrollmentsSchema = z.object({
  id_user: z.string().optional().describe("Filter enrollments by user ID"),
  id_course: z.string().optional().describe("Filter enrollments by course ID"),
  status: z.string().trim().optional().describe("Filter by enrollment status (e.g., subscribed, in_progress, completed)"),
  page: z.number().int().min(0).default(0).describe("Zero-based page offset (default: 0)"),
  page_size: z.number().int().min(1).max(200).default(20).describe("Max records per page (default: 20, max: 200)"),
  response_format: z.enum(['json', 'markdown']).default('json').describe("Response format: 'json' (default) returns raw API data, 'markdown' returns a concise formatted summary."),
});

const getEnrollmentDetailsSchema = z.object({
  id_course: z.string().describe("The course ID"),
  id_user: z.string().describe("The user ID"),
  response_format: z.enum(['json', 'markdown']).default('json').describe("Response format: 'json' (default) returns raw API data, 'markdown' returns a concise formatted summary."),
});

const getUserProgressSchema = z.object({
  id_user: z.string().describe("User ID to get progress for"),
  status: z.string().optional().describe("Filter by enrollment status: subscribed, in_progress, completed"),
  page: z.number().int().min(0).default(0).describe("Zero-based page offset (default: 0)"),
  page_size: z.number().int().min(1).max(200).default(20).describe("Max records per page (default: 20, max: 200)"),
  response_format: z.enum(['json', 'markdown']).default('json').describe("Response format: 'json' (default) returns raw API data, 'markdown' returns a concise formatted summary."),
});

const enrollUserSchema = z.object({
  course_id: z.string().describe("Course ID to enroll the user in"),
  user_id: z.string().describe("User ID to enroll"),
  requestBody: z.object({
    level: z.number().optional().describe("Enrollment level (integer)"),
    date_begin_validity: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    date_expire_validity: z.string().optional().describe("Expiry date (YYYY-MM-DD)"),
  }).optional().describe("Optional enrollment options"),
});

const unenrollUserSchema = z.object({
  id_course: z.string().describe("Course ID to unenroll from"),
  id_user: z.string().describe("User ID to unenroll"),
});

export const enrollmentsToolsMap: Map<string, McpToolDefinition> = new Map([
  ["list_enrollments", {
    name: "list_enrollments",
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
  ["get_enrollment_details", {
    name: "get_enrollment_details",
    description: `Purpose: Retrieves detailed information about a specific enrollment for a given course and user.

Returns: Full enrollment object including completion percentage, dates, status, score, and subscription info.

Usage Guidance:
  - Use when you have both a course ID and user ID and need full enrollment details.
  - Use list_enrollments first to find enrollments by user or course.`,
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
  }],
  ["get_user_progress", {
    name: "get_user_progress",
    description: `Purpose: Retrieves all enrollments for a specific user, providing a progress summary across courses.

Returns: Collection of enrollments for the user with status, completion data, and pagination info.

Usage Guidance:
  - Use to get an overview of a user's learning progress across all courses.
  - Requires id_user to identify the learner.
  - Optionally filter by status (subscribed, in_progress, completed) to focus on specific progress states.
  - Use get_enrollment_details for full details on a specific course enrollment.
  - Supports pagination via page and page_size parameters.`,
    inputSchema: z.toJSONSchema(getUserProgressSchema),
    zodSchema: getUserProgressSchema,
    method: "get",
    pathTemplate: "learn/v1/enrollments",
    executionParameters: [
      { "name": "id_user", "in": "query" },
      { "name": "status", "in": "query" },
      { "name": "page", "in": "query" },
      { "name": "page_size", "in": "query" },
    ],
    requestBodyContentType: undefined,
    securityRequirements: [{ "bearerAuth": [] }],
    annotations: {
      title: "Get User Progress",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    }
  }],
  ["enroll_user", {
    name: "enroll_user",
    description: `Purpose: Enrolls a single user into a specific course on the Docebo learning platform.

Returns: Enrollment confirmation with details of the created enrollment.

Usage Guidance:
  - Use to enroll a user into a course by providing course_id and user_id.
  - Optionally set enrollment level, start date, and expiry date via requestBody.
  - Use list_courses to find the course_id and list_users to find the user_id.
  - Use get_enrollment_details to verify enrollment after creation.`,
    inputSchema: z.toJSONSchema(enrollUserSchema),
    zodSchema: enrollUserSchema,
    method: "post",
    pathTemplate: "learn/v1/enrollments/{course_id}/{user_id}",
    executionParameters: [
      { "name": "course_id", "in": "path" },
      { "name": "user_id", "in": "path" },
    ],
    requestBodyContentType: "application/json",
    securityRequirements: [{ "bearerAuth": [] }],
    annotations: {
      title: "Enroll User",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    }
  }],
  ["unenroll_user", {
    name: "unenroll_user",
    description: `Purpose: Removes a user's enrollment from a specific course on the Docebo learning platform.

Returns: Confirmation of the enrollment removal.

Usage Guidance:
  - Use to unenroll a user from a course by providing id_course and id_user.
  - This action is destructive and cannot be undone — the user's progress in the course will be lost.
  - Use get_enrollment_details first to verify the enrollment exists.`,
    inputSchema: z.toJSONSchema(unenrollUserSchema),
    zodSchema: unenrollUserSchema,
    method: "delete",
    pathTemplate: "learn/v1/enrollments/{id_course}/{id_user}",
    executionParameters: [
      { "name": "id_course", "in": "path" },
      { "name": "id_user", "in": "path" },
    ],
    requestBodyContentType: undefined,
    securityRequirements: [{ "bearerAuth": [] }],
    annotations: {
      title: "Unenroll User",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    }
  }]
]);
