import { z } from 'zod';
import { BaseTool } from '../baseTool.js';
import { DoceboApiClient } from '../doceboApi.js';

const schema = z.object({
  user_search: z.string().describe('Name or email to find the user'),
  course_search: z.string().describe('Course name to find the course'),
  level: z.number().optional().describe('Enrollment level (default: learner)'),
});

export class EnrollUserByNameTool extends BaseTool {
  name = 'enroll_user_by_name';
  description = `Purpose: Enrolls a user in a course by searching for both by name — no IDs needed.

Returns: Enrollment confirmation with user and course details, or a list of candidates if the search is ambiguous.

Usage Guidance:
  - Provide a name/email for the user and a name for the course.
  - If exactly one user and one course match, enrollment proceeds automatically.
  - If multiple matches are found, the tool returns candidates so you can ask the user to clarify.
  - Replaces the need to call list_users + list_courses + enroll_user separately.`;
  zodSchema = schema;
  annotations = {
    title: 'Enroll User by Name',
    readOnlyHint: false as const,
    destructiveHint: false as const,
    idempotentHint: false as const,
    openWorldHint: false as const,
  };

  async process(input: z.infer<typeof schema>, bearerToken?: string, apiBaseUrl?: string): Promise<unknown> {
    if (!bearerToken) throw new Error('Missing authentication token');
    if (!apiBaseUrl) throw new Error('Missing API base URL');

    const api = new DoceboApiClient(bearerToken, apiBaseUrl);

    // Search for user
    const userResponse = await api.get<any>('manage/v1/user', {
      search_text: input.user_search,
      page: 0,
      page_size: 10,
    });
    const users = userResponse?.data?.items ?? [];

    if (users.length === 0) {
      throw new Error(`No users found matching "${input.user_search}". Try a different name or email.`);
    }

    if (users.length > 1) {
      const candidates = users.map((u: any) => ({
        user_id: u.user_id,
        name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.username,
        email: u.email,
      }));
      throw new Error(`Multiple users match "${input.user_search}". Please clarify:\n${JSON.stringify(candidates, null, 2)}`);
    }

    const user = users[0];

    // Search for course
    const courseResponse = await api.get<any>('learn/v1/courses', {
      search_text: input.course_search,
      page: 0,
      page_size: 10,
    });
    const courses = courseResponse?.data?.items ?? [];

    if (courses.length === 0) {
      throw new Error(`No courses found matching "${input.course_search}". Try a different course name.`);
    }

    if (courses.length > 1) {
      const candidates = courses.map((c: any) => ({
        id_course: c.id_course,
        name: c.name,
        status: c.status,
      }));
      throw new Error(`Multiple courses match "${input.course_search}". Please clarify:\n${JSON.stringify(candidates, null, 2)}`);
    }

    const course = courses[0];

    // Enroll
    const body = input.level !== undefined ? { level: input.level } : undefined;
    await api.post(`learn/v1/enrollments/${course.id_course}/${user.user_id}`, body);

    return {
      enrolled: true,
      user: {
        user_id: user.user_id,
        name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username,
        email: user.email,
      },
      course: {
        id_course: course.id_course,
        name: course.name,
      },
    };
  }
}
