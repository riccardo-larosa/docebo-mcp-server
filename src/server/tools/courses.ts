import { McpToolDefinition } from "./index.js";


export const coursesToolsMap: Map<string, McpToolDefinition> = new Map([
  ["list-all-courses", {
    name: "list-all-courses",
    description: `Retrieves all courses. 
`,
    inputSchema: { "type": "object", "properties": 
        { "page_size": { "type": "string", "minimum": 0, "maximum": 10000, "format": "int64", "examples": ["10"], "description": "The maximum number of records per page for this response." }, 
          "page": { "type": "string", "minimum": 0, "maximum": 10000, "format": "int64", "examples": ["0"], "description": "The current offset by number of pages. Offset is zero-based." } 
        } },
    method: "get",
    pathTemplate: "learn/v1/courses",
    executionParameters: [ { "name": "page", "in": "query" }, { "name": "page_size", "in": "query" }],
    requestBodyContentType: undefined,
    securityRequirements: [{ "bearerAuth": [] }]
  }],
  ["get-a-course", {
    name: "get-a-course",
    description: `Get a Course`,
    inputSchema: { "type": "object", "properties": { "course_id": { "type": "string", "description": "The unique identifier for a course." } }, "required": ["course_id"] },
    method: "get",
    pathTemplate: "learn/v1/courses/{course_id}",
    executionParameters: [{ "name": "course_id", "in": "path" }],
    requestBodyContentType: undefined,
    securityRequirements: [{ "bearerAuth": [] }]
  }]
])

