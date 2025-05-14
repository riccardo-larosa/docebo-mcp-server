import { McpToolDefinition } from "./index.js";


export const classroomsToolsMap: Map<string, McpToolDefinition> = new Map([
  ["list-all-classrooms", {
    name: "list-all-classrooms",
    description: `Retrieves all classrooms. 
`,
    inputSchema: { "type": "object", "properties": 
      { "page_size": { "type": "string", "minimum": 0, "maximum": 10000, "format": "int64", "examples": ["10"], "description": "The maximum number of records per page for this response." }, 
        "page": { "type": "string", "minimum": 0, "maximum": 10000, "format": "int64", "examples": ["0"], "description": "The current offset by number of pages. Offset is zero-based." } 
      } },
    method: "get",
    pathTemplate: "learn/v1/classroom",
    executionParameters: [{ "name": "filter", "in": "query" }, { "name": "page", "in": "query" }, { "name": "page_size", "in": "query" }],
    requestBodyContentType: undefined,
    securityRequirements: [{ "bearerAuth": [] }]
  }],
  ["get-a-classroom", {
    name: "get-a-classroom",
    description: `Get a Classroom`,
    inputSchema: { "type": "object", "properties": { "classroomID": { "type": "string", "description": "The unique identifier for a classroom." } }, "required": ["classroomID"] },
    method: "get",
    pathTemplate: "learn/v1/classroom/{classroomID}",
    executionParameters: [{ "name": "courseID", "in": "path" }],
    requestBodyContentType: undefined,
    securityRequirements: [{ "bearerAuth": [] }]
  }]
])

