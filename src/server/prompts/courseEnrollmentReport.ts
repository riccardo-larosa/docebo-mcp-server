import { registerPrompt } from "./index.js";

registerPrompt({
  name: "course-enrollment-report",
  description: "Guided workflow for generating a course enrollment report for a specific set of users. Requires user IDs to scope the report.",
  arguments: [
    {
      name: "user_ids",
      description: "Comma-separated list of Docebo user IDs to include in the report. Required.",
      required: true,
    },
    {
      name: "course_name",
      description: "Optional course name to filter by. If omitted, all courses are included.",
      required: false,
    },
  ],
  getMessages: (args) => {
    if (!args.user_ids) {
      throw new Error("Missing required argument: user_ids");
    }

    const userIds = args.user_ids.split(",").map((id: string) => id.trim());

    const courseFilter = args.course_name
      ? `Focus on courses matching "${args.course_name}".`
      : "Include all available courses.";

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Generate a course enrollment report for the following ${userIds.length} user(s) on the Docebo learning platform.

User IDs: ${userIds.join(", ")}

${courseFilter}

IMPORTANT: Only report on the specified users. Never generate enrollment reports for all users.

Steps:
1. For each user ID, use the "get-user-progress" tool with id_user to retrieve their enrollments.
2. If a course_name filter was specified, use "list-all-courses" with search_text to find matching course IDs, then only include enrollments for those courses.
3. For any enrollment of interest, use "get-enrollment-details" to get completion and score details.
4. Summarize the results in a table with columns: User Name, Course Name, Course ID, Status, Completion %, Score, and Enrollment Date.

Present the report in a clear, structured format.`,
        },
      },
    ];
  },
});
