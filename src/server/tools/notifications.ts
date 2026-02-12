import { z } from "zod";
import { McpToolDefinition } from "./index.js";

const sendTrainingReminderSchema = z.object({
  requestBody: z.object({
    id_user: z.number().describe("Docebo user ID to send the email to"),
    subject: z.string().describe("Email subject line"),
    message: z.string().describe("Email body (HTML allowed)"),
  }).describe("Email details"),
});

const sendLearningPlanNotificationSchema = z.object({
  requestBody: z.object({
    user_id: z.number().describe("User ID to notify"),
    learning_plan_id: z.number().describe("Learning plan ID"),
  }).describe("Notification details"),
});

export const notificationsToolsMap: Map<string, McpToolDefinition> = new Map([
  ["send-training-reminder", {
    name: "send-training-reminder",
    description: `Purpose: Sends a custom training reminder email to a specific user on the Docebo platform.

Returns: Confirmation that the email was sent.

Usage Guidance:
  - Use to send a reminder or custom email to a learner by their user ID.
  - Requires subject and message (HTML is supported in the message body).
  - Use list-users to find the user's ID before sending.
  - This triggers an actual email — use with care.`,
    inputSchema: z.toJSONSchema(sendTrainingReminderSchema),
    zodSchema: sendTrainingReminderSchema,
    method: "post",
    pathTemplate: "manage/v1/user/send_mail",
    executionParameters: [],
    requestBodyContentType: "application/json",
    securityRequirements: [{ "bearerAuth": [] }],
    annotations: {
      title: "Send Training Reminder",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    }
  }],
  ["send-learning-plan-notification", {
    name: "send-learning-plan-notification",
    description: `Purpose: Triggers a platform-configured notification for a user and learning plan combination.

Returns: Confirmation that the notification was triggered.

Usage Guidance:
  - Use to notify a user about a learning plan assignment or update.
  - Requires user_id and learning_plan_id.
  - The notification template is configured on the Docebo platform side.
  - This triggers an actual notification — use with care.`,
    inputSchema: z.toJSONSchema(sendLearningPlanNotificationSchema),
    zodSchema: sendLearningPlanNotificationSchema,
    method: "post",
    pathTemplate: "manage/v1/notifications/external_notification",
    executionParameters: [],
    requestBodyContentType: "application/json",
    securityRequirements: [{ "bearerAuth": [] }],
    annotations: {
      title: "Send Learning Plan Notification",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    }
  }]
]);
