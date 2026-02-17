import { z } from 'zod';
import { BaseTool } from '../baseTool.js';
import { DoceboApiClient } from '../doceboApi.js';

const schema = z.object({});

export class MyProfileTool extends BaseTool {
  name = 'get_my_profile';
  description = `Purpose: Returns the current authenticated user's profile. Use this to discover the caller's user ID, name, email, and role without needing admin permissions.

Returns: User ID, username, first name, last name, email, user level, timezone, and language.

Usage Guidance:
  - No arguments needed — returns the profile of whoever is authenticated.
  - Call this first when you need the current user's ID for other tools (e.g. get_learner_dashboard).
  - This endpoint is accessible to all users, not just admins.`;
  zodSchema = schema;
  annotations = {
    title: 'My Profile',
    readOnlyHint: true as const,
    destructiveHint: false as const,
    idempotentHint: true as const,
    openWorldHint: false as const,
  };

  async process(_input: z.infer<typeof schema>, bearerToken?: string, apiBaseUrl?: string): Promise<unknown> {
    if (!bearerToken) throw new Error('Missing authentication token');
    if (!apiBaseUrl) throw new Error('Missing API base URL');

    const api = new DoceboApiClient(bearerToken, apiBaseUrl);

    const response = await api.get<any>('manage/v1/user/session');
    const user = response?.data ?? response;

    return {
      user_id: user.id,
      username: user.username,
      first_name: user.firstname,
      last_name: user.lastname,
      email: user.email,
      user_level: user.user_level,
      timezone: user.timezone,
      language: user.language,
    };
  }
}
