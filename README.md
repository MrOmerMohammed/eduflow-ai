# EduFlow AI

Intelligent, multi-tenant School ERP SaaS with an AI orchestration layer.

## Architecture

- Frontend: Next.js + TypeScript
- Backend/API: TypeScript service layer
- Database: Supabase PostgreSQL
- Auth: Supabase Auth
- Storage: Supabase Storage
- AI: provider-agnostic orchestration and tool registry
- Security: RBAC + tenant isolation + RLS + audit logging

## Current status

Infrastructure and database foundation are being built incrementally. Secrets are never committed to this repository.

## Repository structure

- `docs/` product and architecture documentation
- `supabase/` database migrations and SQL
- `apps/web/` web application
- `apps/api/` backend/API layer
- `packages/` shared contracts and utilities
