import { registerPrompt } from "./index.js";

registerPrompt({
  name: "course-enrollment-report",
  description: "Guided workflow for generating a course enrollment report. Lists courses and retrieves enrollment details.",
  arguments: [
    {
      name: "course_name",
      description: "Optional course name to filter by. If omitted, all courses are included.",
      required: false,
    },
  ],
  getMessages: (args) => {
    const courseFilter = args.course_name
      ? `Focus on courses matching "${args.course_name}".`
      : "Include all available courses.";

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Generate a course enrollment report for the Docebo learning platform.

${courseFilter}

Steps:
1. Use the "list-all-courses" tool to retrieve available courses.
2. For each relevant course, use the "get-a-course" tool to get detailed enrollment information.
3. Summarize the results in a table with columns: Course Name, Course ID, Enrollment Count, Course Type, and Status.

Present the report in a clear, structured format.`,
        },
      },
    ];
  },
});
