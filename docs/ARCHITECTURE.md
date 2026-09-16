# EduFlow AI Architecture

## Product

EduFlow AI is a multi-tenant school ERP SaaS. A platform account can contain organizations, and organizations can operate one or more schools/campuses.

## Core domains

1. Organization and school management
2. Admissions
3. Student information
4. Academics and curriculum
5. Timetable
6. Attendance
7. Exams and assessment
8. Fees and finance
9. Staff and HR
10. Parent management
11. Teacher portal
12. Student portal
13. Communication
14. Transport
15. Library
16. Hostel
17. Inventory and assets
18. Analytics

## AI architecture

The Master AI Orchestrator routes requests to specialized domain agents. Agents can only act through registered tools. Every tool execution passes through authorization, validation, business rules, execution, and audit logging.

AI must never receive unrestricted database credentials or directly mutate tables.

## Authorization

Access is evaluated from authenticated identity, organization/school membership, role, and explicit permission. Tenant boundaries are enforced in PostgreSQL with Row Level Security as the final database boundary.

## Critical rule

Financial, identity, destructive, bulk, and external-communication actions require explicit permission and appropriate approval workflows.

## Delivery strategy

Build in vertical slices: secure data foundation -> authentication/RBAC -> student/academic core -> attendance/exams/fees -> AI tools -> portals -> integrations -> analytics -> deployment and commercial packaging.
