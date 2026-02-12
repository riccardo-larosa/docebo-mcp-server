import { registerPrompt } from "./index.js";

registerPrompt({
  name: "team-training-status",
  description: "Guided workflow for managers to check team training completion status. Lists team members and their enrollment progress.",
  arguments: [
    {
      name: "training_name",
      description: "Optional training or course name to filter by. If omitted, all trainings are included.",
      required: false,
    },
    {
      name: "team_member",
      description: "Optional team member name or email to filter by. If omitted, all team members are included.",
      required: false,
    },
  ],
  getMessages: (args) => {
    const trainingFilter = args.training_name
      ? `Focus on training/courses matching "${args.training_name}".`
      : "Include all assigned trainings.";

    const memberFilter = args.team_member
      ? `Focus on the team member matching "${args.team_member}".`
      : "Include all team members.";

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Check team training completion status on the Docebo learning platform.

${memberFilter}
${trainingFilter}

Steps:
1. Use the "list-users" tool to find team members${args.team_member ? ` (search for "${args.team_member}")` : ""}.
2. For each user found, use the "list-enrollments" tool with their id_user to retrieve their enrollments.
3. ${args.training_name ? `Use the "list-all-courses" tool to find courses matching "${args.training_name}" and cross-reference with enrollments.` : 'Optionally use the "list-all-courses" tool to enrich course names and details.'}
4. Summarize the results in a table with columns: Team Member, Course, Status, Completion %, Due Date.

Present the report in a clear, structured format. Highlight any overdue or at-risk enrollments.`,
        },
      },
    ];
  },
});
