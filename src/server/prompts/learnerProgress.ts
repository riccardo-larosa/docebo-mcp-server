import { registerPrompt } from "./index.js";

registerPrompt({
  name: "learner-progress",
  description: "Guided workflow for checking a learner's course progress and enrollment status.",
  arguments: [
    {
      name: "user_id",
      description: "The Docebo user ID to check progress for. Required.",
      required: true,
    },
  ],
  getMessages: (args) => {
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Check learner progress for user ID ${args.user_id} on the Docebo learning platform.

Steps:
1. Use the "get_user_progress" tool with id_user="${args.user_id}" to retrieve all enrollments for this user.
2. For any enrollment of interest, use the "get_enrollment_details" tool to get detailed completion and score information.
3. Summarize the results in a table with columns: Course Name, Course ID, Status, Completion %, Score, and Enrollment Date.

Present the report in a clear, structured format.`,
        },
      },
    ];
  },
});
