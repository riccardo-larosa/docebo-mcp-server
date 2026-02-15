import { z } from 'zod';
import { BaseTool } from '../baseTool.js';
import { DoceboApiClient } from '../doceboApi.js';

const MAX_USERS = 50;

const schema = z.object({
  manager_id: z.string().describe('The manager user ID whose subordinates to report on'),
  course_name: z.string().optional().describe('Filter by course/training name (substring match)'),
  status: z.string().optional().describe('Filter enrollments by status (e.g. completed, in_progress, subscribed)'),
});

export class TeamTrainingReportTool extends BaseTool {
  name = 'get_team_training_report';
  description = `Purpose: Generates a training report for a manager's team (direct subordinates) with course enrollments and progress — in a single call.

Returns: Flat rows (user name, course, status, completion %, score) plus summary stats (total users, completion rate).

Usage Guidance:
  - Requires manager_id — the user ID of the manager whose team you want to report on.
  - Use get_learner_dashboard or list_users first to find the manager's user_id.
  - Use course_name to focus on a specific training (e.g. "Compliance").
  - Use status to filter by enrollment status.
  - Replaces calling list_users + list_enrollments per user separately.
  - Capped at ${MAX_USERS} subordinates to keep response size manageable.`;
  zodSchema = schema;
  annotations = {
    title: 'Team Training Report',
    readOnlyHint: true as const,
    destructiveHint: false as const,
    idempotentHint: true as const,
    openWorldHint: false as const,
  };

  async process(input: z.infer<typeof schema>, bearerToken?: string, apiBaseUrl?: string): Promise<unknown> {
    if (!bearerToken) throw new Error('Missing authentication token');
    if (!apiBaseUrl) throw new Error('Missing API base URL');

    const api = new DoceboApiClient(bearerToken, apiBaseUrl);

    // Fetch subordinates for this manager
    const subResponse = await api.get<any>(`manage/v1/user/${encodeURIComponent(input.manager_id)}/subordinates`, {
      page: 0,
      page_size: MAX_USERS,
    });
    const users = subResponse?.data?.items ?? [];

    if (users.length === 0) {
      return {
        rows: [],
        summary: {
          total_users: 0,
          total_enrollments: 0,
          completed: 0,
          completion_rate: 'N/A',
          message: `No subordinates found for manager ${input.manager_id}. This user may not be a manager.`,
        },
      };
    }

    // Fetch enrollments for each subordinate
    const rows: any[] = [];
    for (const user of users) {
      const userId = String(user.user_id ?? user.id);
      const enrollResponse = await api.get<any>('learn/v1/enrollments', {
        id_user: userId,
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
          user_id: user.user_id ?? user.id,
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
