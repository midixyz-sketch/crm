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
-   **Recently Updated Candidates Page** (Updated October 2025): Tracks status changes with comprehensive filtering options. Displays recruiter who performed the status change (not the candidate creator), clear status labels ("נשלח למעסיק", "נפסל בראיון", "תואם ראיון נוסף"), and filters for status, job, recruiter, and date range. Includes dedicated API endpoint `/api/candidates/status-updaters` for efficient recruiter list retrieval.
-   **Dashboard Statistics**: Displays "Hired This Month" and a "Revenue" card.
-   **WhatsApp Message Templates**: Database-driven templates with CRUD operations via UI, supporting placeholders and accessible from candidate detail pages.
-   **Calendar & Reminders System**: Full-featured calendar for managing reminders and interviews, including candidate linking, creator tracking, priority levels, status management, and due reminder alerts.
-   **Candidate Event History with User Tracking**: Comprehensive audit trail of all candidate interactions, displaying the creating user for each event.
-   **Optimized Candidate Table**: Streamlined table view focusing on essential information to avoid horizontal scrolling.
-   **Candidate Detail Page**: Comprehensive profile with inline editing, CV display, and an expandable event history panel.
-   **In-Browser File Preview** (October 2025): Integrated file viewer supporting PDF (PDF.js with zoom/navigation), Word documents (Mammoth.js HTML conversion), and images. Files display in modal dialog without triggering automatic downloads. Job interviews and candidate detail pages use `/api/candidates/:id/cv` endpoint for viewing, with separate explicit download buttons.
-   **Job Interviews Page UI** (Updated October 2025): Candidate evaluation buttons optimized for RTL Hebrew - removed emoji clutter, proper icon alignment (ml-2 for RTL), whitespace-nowrap to prevent text overflow, centered content for clean appearance.
-   **WhatsApp Web Integration**: Embedded WhatsApp functionality within the CRM via `@whiskeysockets/baileys`.
    -   **PERSONAL PER-USER WHATSAPP**: Each user has their own independent WhatsApp connection. Users must scan QR code from their personal device.
    -   **Multi-User Architecture** (October 2025):
        -   `WhatsAppServiceManager` singleton manages Map of `WhatsAppService` instances keyed by userId
        -   Each user gets separate session directory: `whatsapp_auth/session_${userId}`
        -   **API Isolation**: All endpoints use `getUserWhatsAppService(userId)` with `isAuthenticated` middleware to ensure users only access their own WhatsApp
        -   **Event Isolation**: WhatsApp events emit with userId payload (`{userId, qrCode/phoneNumber}`) to prevent cross-user data leakage
        -   **Session Persistence**: Database updates use `sessionId` to correctly handle new session creation during QR flow
        -   **Auto-Initialization**: Server startup initializes WhatsApp for all users with active sessions (via `whatsapp_user_sessions` table)
        -   **Security**: No SSE/EventSource consumers currently exist; future implementations must filter events by userId
    -   Features include QR code connection, full chat page with individual/group/archived tabs, profile pictures, pin/unpin chats, tagging, search/filters, message bubbles, real-time updates, and full RTL support.
    -   **RTL Layout**: Chat list positioned on the right side, active chat on the left side (proper Hebrew RTL layout using flexbox without flex-row-reverse).
    -   **Full-Screen Chat Interface**: Full-screen overlay (z-40) with prominent minimize button (64x64px, green, top-center) positioned below main navbar.
    -   **Chat Header**: Displays avatar, contact name, WhatsApp number, and three action buttons (Pin-amber, Tags-blue, Archive-slate) when chat is selected.
    -   **Message Delivery Status**: WhatsApp-style delivery indicators - single check (sent), double gray check (delivered), double blue check (read).
    -   **Rich Media Support**: Automatic download and display of images, documents, videos, audio messages, and stickers with preview, playback, and download capabilities.
    -   **Emoji Picker**: Full emoji selector with search functionality for easy emoji insertion in messages.
    -   Each user's WhatsApp data stored separately in database with userId foreign key. Auto-initialization on server start for all users with active sessions.
    -   Message sending from candidate pages, automatic status updates, event logging, and chat linking based on phone numbers.
    -   Supports auto-detection of CV attachments and phone number normalization.
    -   Robust reconnection logic and comprehensive error handling prioritize stability.
    -   Interface positioned with padding-top to avoid navbar overlap, ensuring all UI elements are visible.

## External Recruiters Module (COMPLETE - UI + Backend)
-   **Role-Based System**: `external_recruiter` role with restricted permissions.
-   **Job Assignments**: Admins assign specific jobs to external recruiters via `job_assignments` table with optional commission per job.
-   **Limited Access**: External recruiters can only upload new candidates to assigned jobs, cannot view client names or candidate history.
-   **Approval Workflow**: 
    -   Optional `requiresApproval` flag per user
    -   When `requiresApproval=true`: candidates get "pending_approval" status, await admin review
    -   When `requiresApproval=false`: candidates get "sent_to_employer" status immediately AND are **automatically emailed to employer** (like autoSendToClient feature)
    -   **CRITICAL**: External recruiter candidates **DO NOT** create job_applications - they bypass interviews page entirely and go straight to employer or approval (enforced in server/routes.ts lines 1429+)
    -   **Status Tracking**: `lastStatusUpdate` field (added October 2025) automatically updates when candidate status changes, ensuring approved candidates appear in "Recently Updated" page
    -   **Auto-Send to Employer** (October 2025): When external recruiter with `requiresApproval=false` uploads candidate to job, system automatically sends candidate to all selected contact persons via email (server/routes.ts lines 1361-1427)
-   **Activity Logging**: All external recruiter actions tracked in `external_activity_log` table.
-   **Security**: API routes enforce user can only view own assignments; job assignment lists filtered by `isActive=true` and user ID.
-   **Permissions**: 
    -   `allowedJobIds` array dynamically populated from job assignments
    -   Cannot access dashboard, candidates list, clients, calendar, emails, settings, or analytics
    -   Automatically sets recruitment source to recruiter's name
    -   No visibility into candidate event history
-   **UI Pages**:
    -   `/external-recruiters` - Admin management page for assigning jobs to recruiters, viewing assignments, setting commissions
    -   `/my-jobs` - Recruiter work page showing assigned jobs with commission, upload candidate functionality
    -   `/pending-approvals` - Admin page for approving/rejecting candidates from recruiters with requiresApproval flag; approved candidates receive "sent_to_employer" status, `lastStatusUpdate` is refreshed, and they appear in "Recently Updated" page
    -   Dynamic sidebar navigation: shows different menus based on user role (admin sees management pages, recruiter sees only "My Jobs")
-   **Workflow Isolation**: External recruiter candidates skip interviews page - only regular staff uploads go to `/interviews/:jobId` for review
-   **Implementation Details** (October 2025):
    -   `storage.updateCandidate()` automatically sets `lastStatusUpdate = new Date()` whenever status field is updated
    -   Candidates table includes `lastStatusUpdate` timestamp field (default NOW())
    -   "Recently Updated" page sorts by `lastStatusUpdate DESC` instead of `createdAt`

## Reports & Analytics Module (October 2025)
-   **Permission-Protected**: Access controlled by `view_reports` permission on both client (PermissionWrapper) and server (requirePermission middleware)
-   **Three Analytics Sections**:
    -   **Candidates by Time/Source**: Line chart showing candidate growth over time with filters for date range and recruitment source
    -   **Recruiter Activity Tracking**: Table showing all recruiter actions (upload, approve, reject) with date/action filters
    -   **Individual Recruiter Performance**: Bar charts displaying daily candidate uploads per recruiter with 7/30-day views
-   **API Endpoints** (all protected with requirePermission):
    -   `/api/reports/candidates-by-time` - Aggregates candidates by date and recruitment source
    -   `/api/reports/recruiter-activity` - Fetches external recruiter activity logs with filters
    -   `/api/reports/recruiter-activity/:userId` - Daily performance metrics for specific recruiter
-   **Cache Invalidation**: Pending approvals page properly invalidates both `/api/candidates` and `/api/candidates/enriched` for consistent UI refresh

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