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
-   **Navigation**: Simplified sidebar/navbar with main menu items. Settings-related pages (email settings, user management, bulk import, system settings) are accessed through the main Settings page (`/settings`) via cards.

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
-   **Auto-incrementing Numbers**:
    -   Each candidate automatically receives a unique `candidateNumber` (starting from 1)
    -   Each client automatically receives a unique `clientNumber` (starting from 1)
-   Dynamic `candidate_statuses` stored in the database, allowing admin customization and system-defined protected statuses.
    -   8 system statuses (isSystem=true, cannot be deleted but can be edited): available (זמין), pending (ממתין), sent_to_employer (נשלח למעסיק), in_interview (בתהליך ראיון), hired (התקבל לעבודה), rejected (נדחה), rejected_by_employer (נפסל), not_relevant (לא רלוונטי)
    -   Management UI: `/system-settings` → "סטטוסי מועמדים" tab with inline editing table
        -   Editable table with columns: status name, color, preview, actions
        -   Click "ערוך" to enter inline edit mode for any status
        -   Live preview of name and color changes while editing
        -   Save/cancel buttons for each edit operation
        -   8 available colors: green, blue, yellow, orange, red, purple, pink, gray
    -   API: GET/POST/PUT/DELETE `/api/candidate-statuses`
    -   Email imports automatically assign status "ממתין" (pending) to new candidates
-   **Contact Person Management**:
    -   Contact persons are managed at the **client level**, not job level
    -   Each client can have up to 20 contact persons stored in `contactPersons` JSONB field
    -   Each contact person has: unique ID (nanoid), name (optional), title/role (optional), email (required), mobile (optional)
    -   Jobs reference contact persons via `selectedContactPersonIds` array (stores IDs for stability)
-   **Jobs Management Fields**:
    -   `selectedContactPersonIds`: Array of contact person IDs selected from the client's contact persons (minimum 1 required)
    -   `isUrgent`: Boolean flag for urgent jobs (displayed at top of lists with green highlight)
    -   `autoSendToClient`: Boolean flag for automatic candidate sending. When enabled:
        -   **New candidates**: Any candidate assigned to this job (via email, import, manual addition) is automatically sent to all selected contact persons
        -   **Existing candidates**: When toggling autoSendToClient from false to true, all existing candidates for this job are immediately sent to all selected contact persons
        -   Automatic emails include candidate details and CV attachment
        -   Candidate status updated to "נשלח למעסיק" and event logged in history

## Key Features & Implementations
-   **Advanced CV Data Extraction**: Supports various document formats (PDF, DOCX, DOC, images) with format-aware text extraction, OCR (Tesseract.js for Hebrew/English/Arabic), Hebrew-aware name extraction, international phone number parsing, and enhanced email extraction.
-   **Bulk CV Import**: Super admin feature for sequential processing of large volumes (up to 20,000) CV files with guaranteed stability. Processes files one at a time in batches of 10, with duplicate detection by mobile phone number only. Database timeout increased to 10 minutes to handle OCR operations. System prioritizes stability over speed - will never crash even with heavy OCR workloads.
-   **User Management**: Admin-only user creation, role assignment, and automated welcome emails.
-   **Duplicate Send Prevention**: A 30-day warning system to prevent sending the same candidate to an employer multiple times.
-   **Bulk Candidate Operations**: Super admin functionality for multi-selecting and performing bulk deletions of candidates with parallel processing.
-   **Recently Updated Candidates Page**: Tracks candidates with recent status changes (rejected or sent to employers), offering filtering by status, job, and date range.
-   **Dashboard Statistics**: "Hired This Month" count based on `candidates` table with monthly reset, and a "Revenue" card, currently hardcoded pending future payment integration.
-   **WhatsApp Message Templates**: Database-driven message template system accessible from `/settings`
    -   Templates stored in `message_templates` table with fields: id, name, content, icon
    -   Full CRUD operations: Create, Read, Update, Delete via UI
    -   Templates use `{שם המועמד}` placeholder for automatic name replacement
    -   4 default templates: זימון לראיון עבודה, אין מענה בנייד, בקשת עדכון פרטים, הודעת תודה
    -   Templates accessible from candidate detail page (`/candidates/:id`) and interview review page (`/interviews/:jobId`)
    -   API endpoints: GET/POST/PUT/DELETE `/api/message-templates`
    -   Fallback to hardcoded templates if database is empty
-   **Calendar & Reminders System**: Full-featured calendar with reminders and interview events management accessible from `/calendar`
    -   **Full day coverage**: Calendar displays all 24 hours (0-23) instead of limited business hours
    -   **Reminder creation and editing**: Create new reminders or edit existing ones via inline edit button
    -   **Candidate linking**: Reminders can be linked to candidates with clickable names for quick navigation
    -   **Creator tracking**: Each reminder displays the name of the user who created it (createdByUser field)
    -   **Priority levels**: Low, medium, and high priority indicators
    -   **Status management**: Mark reminders as completed or pending
    -   **Due reminder alerts**: Popup notifications for due reminders with snooze functionality
    -   ReminderWithDetails type includes: candidate, job, client, and createdByUser relations
    -   Backend returns full user details for reminder creators in all queries
    -   API endpoints: GET/POST/PUT/DELETE `/api/reminders`
-   **Candidate Event History with User Tracking**: Full audit trail of all candidate interactions
    -   **candidateEvents** table includes `createdBy` field linking to users table
    -   **getCandidateEvents** API returns creator details (firstName, lastName, username) via join with users table
    -   **Frontend display**: Event history shows creator name prominently in blue text: "נוצר על ידי: [שם היוצר]"
    -   **Backend integration**: All event creation points automatically include createdBy from authenticated user
    -   Events tracked: created, profile_updated, status_change, whatsapp_message, note_added, job_referral, sent_to_employer, and more
-   **Optimized Candidate Table**: Streamlined table view without horizontal scrolling
    -   **Columns displayed**: שם המועמד (sticky right), עיר, נייד, סטטוס, מס' מועמד, פעולות (sticky left)
    -   **Removed columns**: עדכון, משרה אחרונה, מקור גיוס, דוא״ל, הפניה אחרונה, שינוי סטטוס
    -   **Design principle**: Essential information only, full details available in candidate detail page
-   **Candidate Detail Page**: Comprehensive profile with inline editing
    -   **Layout**: 68% CV display, 32% editable details sidebar
    -   **All fields editable**: Direct inline editing without scrolling
    -   **Single save button**: "שמור הכל" button at top of details panel
    -   **Event history**: Expandable panel showing all interactions with creator names
-   **WhatsApp Web Integration**: Full WhatsApp integration embedded within the CRM (no external windows)
    -   **Connection**: Click on Linkjob logo in sidebar to open WhatsApp connection dialog with QR code scanning
    -   **Backend**: Baileys (@whiskeysockets/baileys) library for WhatsApp Web protocol
    -   **Database**: 3 tables - whatsapp_sessions (connection state), whatsapp_chats (conversation list), whatsapp_messages (message history)
    -   **Initialization Logic** (Fixed October 2025):
        -   Checks only `isConnected` status, not socket existence - prevents stale sockets from blocking new QR generation
        -   `currentQR` variable stores latest QR code for reliable retrieval
        -   QR cleared on successful connection or logout
        -   Auth directory (`whatsapp_auth/`) must be clean for first-time setup to avoid 401 errors
    -   **Singleton Pattern**: Global lock mechanism at routes level prevents concurrent WhatsApp connections
        -   `safeWhatsAppInit()` function with request queuing system
        -   Prevents "Stream Errored (conflict)" issues caused by multiple simultaneous connections
        -   All initialization requests wait in queue if another is in progress
    -   **Floating Button**: Draggable WhatsApp button in bottom-left corner with unread message counter
    -   **Chat Panel**: Side panel with chat list and conversation view, polls for new messages every 5 seconds
    -   **Chat Sync**: Intelligent fallback system for syncing chats from WhatsApp
        -   Primary: Natural sync via `chats.set` and `chats.upsert` events
        -   Fallback: Manual fetch from WhatsApp if no chats detected after 5 seconds
        -   Fetches group chats via `groupFetchAllParticipating()` API
    -   **Message Sending**: From candidate detail page - select template, edit message, send via WhatsApp API
    -   **Status Updates**: Automatically updates candidate status to "נשלחה הודעת ווצאפ" after sending
    -   **Event Logging**: All WhatsApp interactions automatically logged in candidate event history
    -   **Chat Linking**: Chats automatically linked to candidates based on phone number
    -   **Message History**: WhatsApp history tab in candidate detail page shows full conversation
    -   **Notifications**: Toast notifications for incoming messages with auto-refresh
    -   **CV Import**: Automatic detection of PDF/DOCX attachments with user confirmation dialog
    -   **Phone Formatting**: Supports +972, 972, and 05X formats with automatic normalization
    -   **Reconnection Logic**: Smart reconnection system
        -   Detects conflict errors and prevents reconnection loops
        -   Only reconnects on genuine disconnections (not logouts or conflicts)
        -   Logs connection status and conflict detection for debugging
    -   **Error Handling**: "Slower but never crash" principle - comprehensive error handling throughout
    -   **API Endpoints**: 9 endpoints for initialize, logout, send, get chats, get messages, mark read, send by number
    -   **Stability Priority**: System prioritizes stability over speed, will never crash even with connection issues

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

## WhatsApp Integration
-   `@whiskeysockets/baileys` (WhatsApp Web protocol)
-   `qrcode` (QR code generation)
-   `winston` (logging)