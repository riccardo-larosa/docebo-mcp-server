# Docebo MCP Integration — Internal Use Cases

This document describes the four internal use cases derived from the Docebo MCP Integration Strategy whitepaper. Each use case is designed to be implemented incrementally by adding tool definitions and MCP prompts to the server.

## Overview

| # | Use Case | Primary User | Tools Needed | Status |
|---|----------|-------------|--------------|--------|
| 1 | Personalized Learning Assistant | Managers | enrollments, users, courses | In Progress |
| 2 | Intelligent Course Recommendations | Employees | course search, learning history | In Progress |
| 3 | Automated Onboarding Support | New Hires | learning plans, deadlines | Planned |
| 4 | Data-Driven L&D Insights | L&D Leadership | analytics, completion stats | Planned |

---

## Use Case 1: Personalized Learning Assistant

**Status:** In Progress

### Description

Enables managers to check their team's training completion status through a conversational interface. Instead of navigating the Docebo admin panel, managers can ask the AI assistant questions like "How is my team doing on compliance training?" and get an instant summary.

### User Persona

- **Role:** Team Manager / Department Lead
- **Goal:** Quickly understand team training progress without navigating dashboards
- **Pain Point:** Checking each team member's progress individually is time-consuming

### Workflow Steps

1. Manager asks about team training status (optionally filtering by course or team member)
2. Assistant uses `list-users` to find team members (or a specific member)
3. For each user, assistant calls `list-enrollments` with their `user_id`
4. Optionally uses `list-all-courses` to match courses by name
5. Results are summarized in a table: Team Member, Course, Status, Completion %, Due Date

### Required Tools

| Tool | Purpose | Status |
|------|---------|--------|
| `list-all-courses` | Browse/search courses | Existing |
| `get-a-course` | Get course details | Existing |
| `list-users` | Search/list platform users | New |
| `get-user` | Get user profile details | New |
| `list-enrollments` | List enrollments with filters | New |
| `get-enrollment-details` | Get specific enrollment info | New |

### MCP Prompt

- **`team-training-status`** — Guided workflow for managers to check team training completion status

### Expected Impact

- Reduces time-to-insight from minutes (navigating dashboards) to seconds (one question)
- Enables proactive follow-up on overdue training
- Provides managers a natural language interface to the LMS

---

## Use Case 2: Intelligent Course Recommendations

**Status:** In Progress

### Description

Helps employees discover relevant courses based on their role, department, completed training, and career goals. The assistant analyzes the employee's learning history and available catalog to suggest next steps.

### User Persona

- **Role:** Employee / Individual Contributor
- **Goal:** Find the most relevant courses for professional development
- **Pain Point:** Large course catalog makes it hard to identify what's most relevant

### Workflow Steps

1. Employee asks for course recommendations
2. Assistant retrieves the employee's profile and completed courses
3. Assistant searches the course catalog for relevant offerings
4. Results are presented as personalized recommendations with rationale

### Required Tools

| Tool | Purpose | Status |
|------|---------|--------|
| `list-all-courses` | Search course catalog | Existing |
| `get-a-course` | Get course details | Existing |
| `list-enrollments` | Get user's learning history | Use Case 1 |
| `get-user` | Get user role/department | Use Case 1 |
| Course search/filter | Advanced course filtering | Enhanced (list-all-courses) |

### Expected Impact

- Increases course enrollment rates through personalized suggestions
- Reduces time spent browsing the course catalog
- Improves training relevance and completion rates

---

## Use Case 3: Automated Onboarding Support

**Status:** Planned

### Description

Guides new hires through their onboarding learning plan by proactively surfacing upcoming deadlines, next steps, and required completions. Acts as an onboarding companion that answers questions about what training to do next.

### User Persona

- **Role:** New Hire (first 90 days)
- **Goal:** Complete all required onboarding training on time
- **Pain Point:** Overwhelming number of courses with unclear priority and deadlines

### Workflow Steps

1. New hire asks "What training do I need to complete?"
2. Assistant retrieves their learning plan and enrollment status
3. Assistant prioritizes by deadline and dependencies
4. Presents a checklist with due dates, progress, and next actions

### Required Tools

| Tool | Purpose | Status |
|------|---------|--------|
| `list-enrollments` | Get assigned training | Use Case 1 |
| `get-user` | Get user profile | Use Case 1 |
| Learning plans API | Get structured learning paths | Planned |
| Deadlines/due dates | Track completion deadlines | Planned |

### Expected Impact

- Reduces onboarding training completion time
- Decreases support tickets about "what do I do next?"
- Improves new hire experience and time-to-productivity

---

## Use Case 4: Data-Driven L&D Insights

**Status:** Planned

### Description

Provides L&D leadership with on-demand analytics about training effectiveness, completion rates, and engagement trends. Enables executives to ask high-level questions and get data-backed answers without running manual reports.

### User Persona

- **Role:** L&D Director / VP of Learning
- **Goal:** Understand training program effectiveness and ROI
- **Pain Point:** Generating reports requires multiple dashboard exports and manual analysis

### Workflow Steps

1. L&D leader asks a question like "What's our compliance training completion rate this quarter?"
2. Assistant queries enrollment data, completion statistics, and course analytics
3. Data is aggregated and analyzed
4. Presented as a narrative summary with supporting metrics and trends

### Required Tools

| Tool | Purpose | Status |
|------|---------|--------|
| `list-enrollments` | Enrollment and completion data | Use Case 1 |
| `list-all-courses` | Course metadata | Existing |
| Analytics/reports API | Aggregated statistics | Planned |
| Completion stats API | Completion rate metrics | Planned |

### Expected Impact

- Enables real-time access to L&D metrics
- Reduces report generation time from hours to seconds
- Supports data-driven decisions about training investments
