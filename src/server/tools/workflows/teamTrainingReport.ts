import { z } from 'zod';
import { BaseTool } from '../baseTool.js';
import { DoceboApiClient } from '../doceboApi.js';

const MAX_USERS = 50;

const schema = z.object({
  search_text: z.string().optional().describe('Filter team members by name or email'),
  course_name: z.string().optional().describe('Filter by course/training name (substring match)'),
  status: z.string().optional().describe('Filter enrollments by status (e.g. completed, in_progress, subscribed)'),
});

export class TeamTrainingReportTool extends BaseTool {
  name = 'get_team_training_report';
  description = `Purpose: Generates a team training report — all users and their course enrollments with progress — in a single call.

Returns: Flat rows (user name, course, status, completion %, score) plus summary stats (total users, completion rate).

Usage Guidance:
  - Call with no arguments to get a full team report.
  - Use search_text to filter to specific team members.
  - Use course_name to focus on a specific training (e.g. "Compliance").
  - Use status to filter by enrollment status.
  - Replaces calling list_users + list_enrollments per user separately.
  - Capped at ${MAX_USERS} users to keep response size manageable.`;
  zodSchema = schema;
  annotations = {
    title: 'Team Training Report',
    readOnlyHint: true as const,
    destructiveHint: false as const,
    idempotentHint: true as const,
    openWorldHint: true as const,
  };

  async process(input: z.infer<typeof schema>, bearerToken?: string, apiBaseUrl?: string): Promise<unknown> {
    if (!bearerToken) throw new Error('Missing authentication token');
    if (!apiBaseUrl) throw new Error('Missing API base URL');

    const api = new DoceboApiClient(bearerToken, apiBaseUrl);

    // Fetch users
    const userParams: Record<string, any> = { page: 0, page_size: MAX_USERS };
    if (input.search_text) userParams.search_text = input.search_text;
    const userResponse = await api.get<any>('manage/v1/user', userParams);
    const users = userResponse?.data?.items ?? [];

    // Fetch enrollments for each user
    const rows: any[] = [];
    for (const user of users) {
      const enrollResponse = await api.get<any>('learn/v1/enrollments', {
        id_user: String(user.user_id),
        page: 0,
        page_size: 200,
      });
      const enrollments = enrollResponse?.data?.items ?? [];

      for (const e of enrollments) {
        // Filter by course name (case-insensitive substring)
        if (input.course_name) {
          const courseName = (e.course_name ?? e.name ?? '').toLowerCase();
          if (!courseName.includes(input.course_name.toLowerCase())) continue;
        }
        // Filter by status
        if (input.status && e.status !== input.status) continue;

        rows.push({
          user_id: user.user_id,
          user_name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username,
          email: user.email,
          id_course: e.id_course,
          course_name: e.course_name ?? e.name,
          status: e.status,
          completion_percentage: e.completion_percentage ?? e.completion,
          score: e.score,
        });
      }
    }

    const completed = rows.filter(r => r.status === 'completed').length;

    return {
      rows,
      summary: {
        total_users: users.length,
        total_enrollments: rows.length,
        completed,
        completion_rate: rows.length > 0 ? `${Math.round((completed / rows.length) * 100)}%` : 'N/A',
      },
    };
  }
}
