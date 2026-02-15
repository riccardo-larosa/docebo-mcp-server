import { registerPrompt } from "./index.js";

registerPrompt({
  name: "course-recommendations",
  description: "Personalized course recommendations based on user profile and learning history. Analyzes completed training and available catalog to suggest relevant next courses.",
  arguments: [
    {
      name: "user_name",
      description: "Employee name or email to look up. If omitted, ask the user to identify themselves.",
      required: false,
    },
    {
      name: "interest_area",
      description: "Topic or skill area of interest (e.g., leadership, compliance, data science). If omitted, recommendations are based on role and learning history.",
      required: false,
    },
  ],
  getMessages: (args) => {
    const userLookup = args.user_name
      ? `Look up the employee "${args.user_name}" using the "list_users" tool (search_text parameter). Then use "get_user" with their user_id to get full profile details (role, department, branch).`
      : `Ask the user for their name or email, then use the "list_users" tool to find them. Use "get_user" with their user_id to get full profile details (role, department, branch).`;

    const interestFilter = args.interest_area
      ? `The employee is interested in "${args.interest_area}". Use the "list_courses" tool with search_text="${args.interest_area}" to find courses matching this interest.`
      : "No specific interest area was provided. Base recommendations on the employee's role, department, and gaps in their learning history.";

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Provide personalized course recommendations for an employee on the Docebo learning platform.

${userLookup}

${interestFilter}

Steps:
1. ${args.user_name ? `Use "list_users" to find "${args.user_name}", then "get_user" to retrieve their profile (role, department, branch).` : 'Ask the user to identify themselves, then look them up with "list_users" and "get_user".'}
2. Use "list_enrollments" with the user's id_user to retrieve their completed and in-progress courses.
3. Use "list_courses"${args.interest_area ? ` with search_text="${args.interest_area}"` : ""} to browse the available course catalog. Also try filtering by category or status=published to find relevant offerings.
4. Analyze gaps: compare what the employee has completed vs. what is available and relevant to their role/department/interests.
5. Present the top recommendations in a table with columns: Course Name, Category, Why Recommended, Relevance (High/Medium/Low).

Guidelines:
- Prioritize courses the employee has NOT yet enrolled in.
- Consider the employee's department and role when assessing relevance.
- If the employee has completed foundational courses, recommend advanced or follow-up courses.
- Highlight any mandatory or compliance courses the employee may be missing.
- Provide a brief summary explaining the recommendation rationale before the table.`,
        },
      },
    ];
  },
});
