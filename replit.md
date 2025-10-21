# Overview

This Recruitment Management System (RMS) is a full-stack web application for recruitment agencies. It manages candidates, clients, jobs, applications, and tasks, aiming to streamline talent acquisition. Key features include robust authentication, advanced CV data extraction, real-time data management, and comprehensive WhatsApp integration. The project's vision is to provide an efficient and scalable platform to enhance productivity in recruitment operations.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
-   **React 18** with TypeScript, **Vite**, **Wouter** for routing, and **TanStack Query** for server state.
-   **shadcn/ui** and **Tailwind CSS** for UI, with full RTL support for Hebrew.
-   **React Hook Form** with Zod for form management.
-   Navigation uses a sidebar/navbar, with settings accessed via a dedicated page.

## Backend
-   **Express.js** with TypeScript, implementing a RESTful API.
-   Modular structure with middleware for authentication and processing.
-   Multer for file uploads.

## Authentication & Authorization
-   **Local authentication** using Passport.js and bcrypt with session-based PostgreSQL storage.
-   **Role-Based Access Control (RBAC)** with three layers: role-based, direct grants, and direct revocations.
-   Admin-controlled user creation; self-registration is disabled.

## Database
-   **PostgreSQL** with **Drizzle ORM** for type-safe operations.
-   Core entities: Users, Candidates, Clients, Jobs, Applications, Tasks.
-   Automatic unique numbering for candidates and clients.
-   Dynamic `candidate_statuses` managed via UI, including 8 system-defined protected statuses.
-   Contact persons are managed at the client level (up to 20 per client in JSONB), referenced by jobs.
-   Job management includes `isUrgent` flag and `autoSendToClient` for automated candidate emails.

## Key Features & Implementations
-   **Advanced CV Data Extraction**: Supports multiple formats (PDF, DOCX, images) with OCR for Hebrew/English/Arabic, and intelligent extraction of names, phone numbers, and emails.
-   **Bulk CV Import**: Super admin feature for stable, sequential processing of large volumes of CVs with duplicate detection.
-   **User Management**: Admin-only user creation and role assignment with automated welcome emails.
-   **Duplicate Send Prevention**: 30-day warning system for sending candidates to employers.
-   **Bulk Candidate Operations**: Super admin function for deleting multiple candidates.
-   **Recently Updated Candidates Page**: Tracks status changes with filtering options.
-   **Dashboard Statistics**: Displays "Hired This Month" and a "Revenue" card.
-   **WhatsApp Message Templates**: Database-driven templates with CRUD operations via UI, supporting placeholders and accessible from candidate detail pages.
-   **Calendar & Reminders System**: Full-featured calendar for managing reminders and interviews, including candidate linking, creator tracking, priority levels, status management, and due reminder alerts.
-   **Candidate Event History with User Tracking**: Comprehensive audit trail of all candidate interactions, displaying the creating user for each event.
-   **Optimized Candidate Table**: Streamlined table view focusing on essential information to avoid horizontal scrolling.
-   **Candidate Detail Page**: Comprehensive profile with inline editing, CV display, and an expandable event history panel.
-   **WhatsApp Web Integration**: Embedded WhatsApp functionality within the CRM via `@whiskeysockets/baileys`.
    -   Features include QR code connection, full chat page with individual/group/archived tabs, profile pictures, pin/unpin chats, tagging, search/filters, message bubbles, real-time updates, and full RTL support.
    -   **RTL Layout**: Chat list positioned on the right side, active chat on the left side (proper Hebrew RTL layout using flexbox without flex-row-reverse).
    -   **Full-Screen Chat Interface**: Full-screen overlay (z-40) with prominent minimize button (64x64px, green, top-center) positioned below main navbar.
    -   **Chat Header**: Displays avatar, contact name, WhatsApp number, and three action buttons (Pin-amber, Tags-blue, Archive-slate) when chat is selected.
    -   Includes a singleton pattern for stable connections, a floating button with unread counts, and intelligent chat synchronization.
    -   Message sending from candidate pages, automatic status updates, event logging, and chat linking based on phone numbers.
    -   Supports auto-detection of CV attachments and phone number normalization.
    -   Robust reconnection logic and comprehensive error handling prioritize stability.
    -   Interface positioned with padding-top to avoid navbar overlap, ensuring all UI elements are visible.

# External Dependencies

## Database & ORM
-   `@neondatabase/serverless`
-   `drizzle-orm`

## Web Framework & UI
-   `express`
-   `react`
-   `@tanstack/react-query`
-   `@radix-ui/*`
-   `tailwindcss`
-   `lucide-react`

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
-   `multer`
-   `clsx`
-   `cmdk`

## WhatsApp Integration
-   `@whiskeysockets/baileys`
-   `qrcode`
-   `winston`