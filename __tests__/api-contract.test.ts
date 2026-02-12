/**
 * API Contract / Smoke Tests
 *
 * These tests make real HTTP calls to the Docebo API and verify response shapes.
 * They skip automatically when credentials are not available.
 *
 * Run with: API_BASE_URL=https://your-instance.docebosaas.com npm run test:contract
 */
import { describe, it, expect, beforeAll } from 'vitest';
import axios, { AxiosInstance } from 'axios';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// --- Credential loading ---------------------------------------------------

interface TokenCache {
  access_token: string;
  expires_at: number;
}

function loadCredentials(): { baseURL: string; token: string } | null {
  const baseURL = process.env.API_BASE_URL;
  if (!baseURL) return null;

  try {
    const tokensPath = join(homedir(), '.docebo-mcp', 'tokens.json');
    const raw = readFileSync(tokensPath, 'utf-8');
    const cache: TokenCache = JSON.parse(raw);

    if (!cache.access_token) return null;

    // Warn (but don't skip) if the token looks expired – the API will reject
    // it and the test will fail with a clear 401 anyway.
    if (cache.expires_at && Date.now() / 1000 > cache.expires_at) {
      console.warn('⚠ Token in ~/.docebo-mcp/tokens.json appears expired');
    }

    return { baseURL, token: cache.access_token };
  } catch {
    return null;
  }
}

const creds = loadCredentials();

// --- Conditional suite ----------------------------------------------------

const describeContract = creds ? describe : describe.skip;

describeContract('API Contract Tests', () => {
  let api: AxiosInstance;

  beforeAll(() => {
    api = axios.create({
      baseURL: creds!.baseURL,
      headers: { Authorization: `Bearer ${creds!.token}` },
      // Don't throw on non-2xx so we can assert status explicitly
      validateStatus: () => true,
    });
  });

  // ── Courses ──────────────────────────────────────────────────────────

  describe('Courses', () => {
    let firstCourseId: number | undefined;

    it('GET learn/v1/courses?page_size=1 → items with id_course, name', async () => {
      const res = await api.get('learn/v1/courses', {
        params: { page_size: 1 },
      });

      expect(res.status).toBe(200);
      expect(res.data.data).toHaveProperty('items');
      expect(Array.isArray(res.data.data.items)).toBe(true);

      if (res.data.data.items.length > 0) {
        const course = res.data.data.items[0];
        expect(course).toHaveProperty('id_course');
        expect(course).toHaveProperty('name');
        firstCourseId = course.id_course;
      }
    });

    it('GET learn/v1/courses?search_text=… → has items array', async () => {
      const res = await api.get('learn/v1/courses', {
        params: { search_text: 'a', page_size: 1 },
      });

      expect(res.status).toBe(200);
      expect(res.data.data).toHaveProperty('items');
      expect(Array.isArray(res.data.data.items)).toBe(true);
    });

    it('GET learn/v1/courses/{id_course} → has name, type', async () => {
      if (!firstCourseId) {
        console.warn('⚠ Skipping get-course: no course found in list');
        return;
      }

      const res = await api.get(`learn/v1/courses/${firstCourseId}`);

      expect(res.status).toBe(200);
      expect(res.data.data).toHaveProperty('name');
      // Note: single-course endpoint returns "type", not "course_type" (list uses "course_type")
      expect(res.data.data).toHaveProperty('type');
    });
  });

  // ── Users ────────────────────────────────────────────────────────────

  describe('Users', () => {
    let firstUserId: number | undefined;

    it('GET manage/v1/user?page_size=1 → items with user_id, username', async () => {
      const res = await api.get('manage/v1/user', {
        params: { page_size: 1 },
      });

      expect(res.status).toBe(200);
      expect(res.data.data).toHaveProperty('items');
      expect(Array.isArray(res.data.data.items)).toBe(true);

      if (res.data.data.items.length > 0) {
        const user = res.data.data.items[0];
        expect(user).toHaveProperty('user_id');
        expect(user).toHaveProperty('username');
        firstUserId = user.user_id;
      }
    });

    it('GET manage/v1/user/{user_id} → has data', async () => {
      if (!firstUserId) {
        console.warn('⚠ Skipping get-user: no user found in list');
        return;
      }

      const res = await api.get(`manage/v1/user/${firstUserId}`);

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('data');
    });
  });

  // ── Enrollments ──────────────────────────────────────────────────────

  describe('Enrollments', () => {
    let enrollmentUserId: number | undefined;
    let enrollmentCourseId: number | undefined;

    it('GET learn/v1/enrollments?page_size=1 → items with user_id, status', async () => {
      const res = await api.get('learn/v1/enrollments', {
        params: { page_size: 1 },
      });

      expect(res.status).toBe(200);
      expect(res.data.data).toHaveProperty('items');
      expect(Array.isArray(res.data.data.items)).toBe(true);

      if (res.data.data.items.length > 0) {
        const enrollment = res.data.data.items[0];
        expect(enrollment).toHaveProperty('user_id');
        expect(enrollment).toHaveProperty('status');
        enrollmentUserId = enrollment.user_id;
        // Note: enrollment list items use "id" for the course, not "id_course"
        enrollmentCourseId = enrollment.id;
      }
    });

    it('GET learn/v1/enrollments?id_user=…&page_size=1 → items for a user (get-user-progress)', async () => {
      if (!enrollmentUserId) {
        console.warn('⚠ Skipping get-user-progress: no enrollment found in list');
        return;
      }

      const res = await api.get('learn/v1/enrollments', {
        params: { id_user: enrollmentUserId, page_size: 1 },
      });

      expect(res.status).toBe(200);
      expect(res.data.data).toHaveProperty('items');
      expect(Array.isArray(res.data.data.items)).toBe(true);

      if (res.data.data.items.length > 0) {
        const item = res.data.data.items[0];
        expect(item).toHaveProperty('user_id');
        expect(item).toHaveProperty('status');
      }
    });

    it('GET learn/v1/enrollments/{id_course}/{id_user} → has data.records', async () => {
      if (!enrollmentUserId || !enrollmentCourseId) {
        console.warn('⚠ Skipping get-enrollment-details: no enrollment found in list');
        return;
      }

      const res = await api.get(
        `learn/v1/enrollments/${enrollmentCourseId}/${enrollmentUserId}`,
      );

      expect(res.status).toBe(200);
      expect(res.data.data).toHaveProperty('records');
    });
  });

});
