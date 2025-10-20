# Overview

This Recruitment Management System (RMS) is a full-stack web application designed for recruitment agencies. It manages candidates, clients, jobs, applications, and tasks, offering a comprehensive solution for recruitment workflows. The system features a modern React frontend with shadcn/ui and an Express.js backend with PostgreSQL and Drizzle ORM. Key capabilities include authentication, file uploads with advanced CV extraction, real-time data management, and full Hebrew language support. The business vision is to provide an efficient and scalable platform for recruitment operations, enhancing productivity and streamlining talent acquisition.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
-   **React 18** with TypeScript, **Vite** for tooling.
-   **Wouter** for routing, **TanStack Query** for server state.
-   **React Hook Form** with Zod for forms.
-   **shadcn/ui** and **Tailwind CSS** for UI, supporting RTL for Hebrew.

## Backend
-   **Express.js** with TypeScript, following a RESTful API design.
-   Modular structure with middleware for authentication and processing.
-   File upload handling via Multer.

## Authentication & Authorization
-   **Local authentication** using Passport.js and bcrypt, with session-based PostgreSQL storage.
-   **Role-Based Access Control (RBAC)** with three layers: role-based, direct grants, and direct revocations.
-   Fine-grained permissions for UI components and features, managed via an admin interface.
-   Self-registration is disabled; user creation is admin-controlled.

## Database
-   **PostgreSQL** with **Drizzle ORM** for type-safe operations.
-   Schema-first approach with core entities like Users, Candidates, Clients, Jobs, Applications, and Tasks.
-   Dynamic `candidate_statuses` stored in the database, allowing admin customization and system-defined protected statuses.
    -   8 system statuses (isSystem=true, cannot be deleted): available (זמין), pending (ממתין), sent_to_employer (נשלח למעסיק), in_interview (בתהליך ראיון), hired (התקבל לעבודה), rejected (נדחה), rejected_by_employer (נפסל), not_relevant (לא רלוונטי)
    -   Management UI: `/system-settings` → "סטטוסי מועמדים" tab
    -   API: GET/POST/PUT/DELETE `/api/candidate-statuses`

## Key Features & Implementations
-   **Advanced CV Data Extraction**: Supports various document formats (PDF, DOCX, DOC, images) with format-aware text extraction, OCR (Tesseract.js for Hebrew/English/Arabic), Hebrew-aware name extraction, international phone number parsing, and enhanced email extraction.
-   **Bulk CV Import**: Super admin feature for sequential processing of large volumes (up to 20,000) CV files with guaranteed stability. Processes files one at a time in batches of 10, with duplicate detection by mobile phone number only. Database timeout increased to 10 minutes to handle OCR operations. System prioritizes stability over speed - will never crash even with heavy OCR workloads.
-   **User Management**: Admin-only user creation, role assignment, and automated welcome emails.
-   **Duplicate Send Prevention**: A 30-day warning system to prevent sending the same candidate to an employer multiple times.
-   **Bulk Candidate Operations**: Super admin functionality for multi-selecting and performing bulk deletions of candidates with parallel processing.
-   **Recently Updated Candidates Page**: Tracks candidates with recent status changes (rejected or sent to employers), offering filtering by status, job, and date range.
-   **Dashboard Statistics**: "Hired This Month" count based on `candidates` table with monthly reset, and a "Revenue" card, currently hardcoded pending future payment integration.

# External Dependencies

## Database & ORM
-   `@neondatabase/serverless` (PostgreSQL connection)
-   `drizzle-orm`

## Web Framework & UI
-   `express`
-   `react`
-   `@tanstack/react-query`
-   `@radix-ui/*`
-   `tailwindcss`
-   `lucide-react` (icons)

## Authentication & Security
-   `passport`
-   `openid-client`
-   `express-session`
-   `connect-pg-simple`

## Form Handling & Validation
-   `react-hook-form`
-   `zod`

## Utilities
-   `date-fns`
-   `multer` (file uploads)
-   `clsx`
-   `cmdk`