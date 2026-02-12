import { registerPrompt } from "./index.js";

registerPrompt({
  name: "learner-progress",
  description: "Guided workflow for checking learner progress via classroom sessions.",
  arguments: [
    {
      name: "classroom_name",
      description: "Optional classroom name to filter by. If omitted, all classrooms are included.",
      required: false,
    },
  ],
  getMessages: (args) => {
    const classroomFilter = args.classroom_name
      ? `Focus on classrooms matching "${args.classroom_name}".`
      : "Include all available classrooms.";

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Check learner progress across classroom sessions on the Docebo learning platform.

${classroomFilter}

Steps:
1. Use the "list-all-classrooms" tool to retrieve available classroom sessions.
2. For each relevant classroom, use the "get-a-classroom" tool to get detailed session and attendance information.
3. Summarize the results in a table with columns: Classroom Name, Classroom ID, Schedule, Capacity, and Attendance Status.

Present the report in a clear, structured format.`,
        },
      },
    ];
  },
});
