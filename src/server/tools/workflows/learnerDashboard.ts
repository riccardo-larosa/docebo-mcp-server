import { z } from 'zod';
import { BaseTool } from '../baseTool.js';
import { DoceboApiClient } from '../doceboApi.js';

const schema = z.object({
  user_id: z.string().describe('The user ID to get the dashboard for'),
});

export class LearnerDashboardTool extends BaseTool {
  name = 'get_learner_dashboard';
  description = `Purpose: Returns a complete learner dashboard — user profile plus all course enrollments with progress details — in a single call.

Returns: User profile (name, email, role, department) and enriched enrollment list (course name, status, completion %, score, dates).

Usage Guidance:
  - Provide the user_id for the learner.
  - Replaces the need to call get_user + get_user_progress + get_enrollment_details separately.
  - Use get_my_profile first to get the current user's ID, or list_users (admin only) if looking up another user.`;
  zodSchema = schema;
  annotations = {
    title: 'Learner Dashboard',
    readOnlyHint: true as const,
    destructiveHint: false as const,
    idempotentHint: true as const,
    openWorldHint: false as const,
  };

  async process(input: z.infer<typeof schema>, bearerToken?: string, apiBaseUrl?: string): Promise<unknown> {
    if (!bearerToken) throw new Error('Missing authentication token');
    if (!apiBaseUrl) throw new Error('Missing API base URL');

    const api = new DoceboApiClient(bearerToken, apiBaseUrl);

    // Fetch user profile
    const userResponse = await api.get<any>(`manage/v1/user/${encodeURIComponent(input.user_id)}`);
    const user = userResponse?.data ?? userResponse;

    // Fetch all enrollments for this user (up to 200)
    const enrollResponse = await api.get<any>('learn/v1/enrollments', {
      id_user: input.user_id,
      page: 0,
      page_size: 200,
    });
    const enrollments = enrollResponse?.data?.items ?? [];

    return {
      user: {
        user_id: user.user_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        department: user.department,
        branch: user.branch_name,
        status: user.status,
      },
      enrollments: enrollments.map((e: any) => ({
        id_course: e.id_course,
        course_name: e.course_name ?? e.name,
        status: e.status,
        completion_percentage: e.completion_percentage ?? e.completion,
        score: e.score,
        date_inscr: e.date_inscr,
        date_complete: e.date_complete,
      })),
      total_enrollments: enrollments.length,
    };
  }
}
