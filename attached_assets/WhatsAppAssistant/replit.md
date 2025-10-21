# WhatsApp-Integrated CRM System

## Overview

This project is a WhatsApp-integrated CRM system designed to manage candidate/contact information and facilitate direct communication via WhatsApp. It features persistent WhatsApp connections, message history tracking, chat tagging and pinning, and a user interface inspired by modern productivity applications like Linear, Notion, and Slack. The system provides a streamlined WhatsApp messaging interface for recruitment and customer relationship management.

## User Preferences

Preferred communication style: Simple, everyday language (Hebrew).

## Recent Updates

### Fixed Group Name Display Issue (October 20, 2025)
- **Problem**: Some groups displayed as long numbers instead of group names (e.g., "קבוצה 120363050260147628")
- **Root Cause**: When incoming messages arrived from groups before auto-sync completed, the message handler:
  - Saved group phone without @g.us suffix (e.g., "120363050260147628" instead of "120363050260147628@g.us")
  - Created candidates with generic names like "קבוצה [number]" instead of fetching real group names
  - Led to duplicate candidates for the same group
- **Solution Implemented**:
  - Updated `handleIncomingMessages()` to keep full JID with @g.us for groups
  - Added group metadata fetching to retrieve real group names when new group messages arrive
  - Updated `handleHistorySync()` with same fix for consistency
  - Cleaned up 2 duplicate group candidates and merged their messages into correct ones
- **Result**: All groups now display with correct names and consistent phone format (with @g.us)

### Chat Categorization System with Auto-Group Discovery (October 20, 2025)
- **Implementation**: Added comprehensive chat categorization with three types: individual chats, groups, and archived
- **Database Schema**: 
  - Added `chatType` field (individual, group, archived) with default "individual"
  - Added `previousChatType` field to preserve original type when archiving
- **Auto-Group Discovery**: 
  - Automatic group detection via WhatsApp API (`groupFetchAllParticipating`)
  - Groups automatically created in database even without messages
  - Runs automatically 5 seconds after WhatsApp connection
  - Manual sync endpoint: `/api/whatsapp/sync-chat-types`
  - Groups stored with full JID (e.g., 120363398075556558@g.us)
  - Group names fetched from WhatsApp metadata
- **Tab UI**: 
  - Three-tab interface for filtering: צ'אטים (Individual), קבוצות (Groups), ארכיון (Archived)
  - Uses Shadcn Tabs component with icons (User, Users, Archive)
  - Grid layout with equal-width tabs
  - Groups display even without messages
- **Archive Functionality**:
  - Archive button in chat header (slate-500 when active, green-500 when archived)
  - Preserves original chat type (individual/group) when archiving
  - Restores to correct type when unarchiving
  - Toast notifications in Hebrew for archive/unarchive actions
- **Smart Restoration**: When unarchiving, chat returns to its original tab (groups return to groups, individuals to individuals)
- **Integration**: Works seamlessly with existing search, tag filtering, and pinning features

### Simplified to WhatsApp Web Interface Only (October 9, 2025)
- **Major Simplification**: Removed all unnecessary pages - only WhatsApp Web interface remains
- **Single Route**: Route `/` now displays:
  - QR code for WhatsApp connection (if not connected)
  - Full WhatsApp Web chat interface (if connected)
- **Removed Pages**: home, candidates, messages, qr-code, navbar - all deleted
- **Clean UX**: Simple flow - scan QR → start chatting, no navigation needed

### Avatar Fallback Removed (October 20, 2025)
- **Change**: Removed initials display from avatar fallback
- **Previous Behavior**: When no profile picture existed, displayed first 2 letters of contact name
- **New Behavior**: When no profile picture exists, shows empty/blank avatar circle
- **Implementation**: Removed `getInitials()` helper function and emptied `<AvatarFallback>` content
- **Locations**: Both chat list and chat header now show blank avatars when profile picture unavailable

### Enhanced Pin and Tags Buttons (October 10, 2025)
- **Chat List Buttons** (smaller, positioned at bottom):
  - **Size**: 20px × 20px (40% smaller than header buttons)
  - **Icons**: 11px (40% smaller than header icons)
  - **Position**: bottom-2 (at the bottom of each chat row)
- **Chat Header Buttons** (larger, original size):
  - **Size**: 33px × 33px
  - **Icons**: 19px
- **Bold and Vibrant Colors** (highly prominent):
  - **Pin Button (when pinned)**: bg-amber-400 with white text (dark: bg-amber-600 with white text) - bright gold/orange
  - **Pin Button (when unpinned)**: bg-amber-200 with amber-800 text (dark: bg-amber-800 with amber-200 text)
  - **Tags Button**: bg-blue-500 with white text (dark: bg-blue-600 with white text) - vibrant blue
- **High Contrast**: White text on vibrant backgrounds for maximum visibility
- **Enhanced Tooltips**: More descriptive Hebrew tooltips
  - Pin: "נעץ שיחה למעלה" (pin to top) / "בטל נעיצת שיחה" (unpin)
  - Tags: "נהל תגיות למיון ושיוך" (manage tags for sorting)
- **Full Dark Mode Support**: All color variants include proper dark mode alternatives
- **Chat List Background**: Changed to white (bg-background) in light mode, with subtle gray (dark:bg-muted/30) in dark mode for visual contrast
- **WhatsApp Connection Guard**: 
  - Chats page now checks WhatsApp connection status
  - If not connected, displays message with link to QR code page
  - Prevents showing empty chat list when WhatsApp is disconnected

### Complete Removal of Questionnaire Feature (October 9, 2025)
- **Reason**: Questionnaire feature was not working properly and is no longer relevant to the project
- **Changes**:
  - Removed all questionnaire-related UI pages (questionnaires.tsx, questionnaire-detail.tsx, questionnaire-fill.tsx)
  - Removed questionnaire API endpoints from routes.ts
  - Removed questionnaire bot service (questionnaire-bot.ts)
  - Removed questionnaire database tables (questionnaires, questions, questionnaire_responses, questionnaire_sessions)
  - Removed all questionnaire references from chats page (send questionnaire button and dialog)
  - Updated database schema and ran db:push to clean up database
- **Result**: System now focuses on core WhatsApp messaging and contact management functionality

### Chat Header Pin and Tags Buttons (October 9, 2025)
- **Implementation**: Added pin and tags management buttons to the chat header (when a chat is selected)
- **UI Components**:
  - Pin button with tooltip ("נעץ שיחה"/"בטל נעיצה") - variant changes to "secondary" when pinned
  - Tags button with tooltip ("נהל תגיות") - opens tags management dialog
  - Both buttons sized h-7 w-7 with w-4 h-4 icons for consistency
  - data-testid attributes: "button-pin-header" and "button-tags-header"
- **Integration**: Reuses existing handleTogglePin and openTagsDialog functions for consistent behavior

### Search and Tag Filtering System (October 9, 2025)
- **Implementation**: Added comprehensive search and tag filtering functionality to chats page
- **UI Features**:
  - Search input to filter chats by candidate name, phone number, **or tag content**
  - Tag filter badges showing all unique tags from all candidates
  - Active filter badge uses variant="default", inactive uses variant="outline"
  - Displays count: "{filteredChatGroups.length} מתוך {chatGroups.length} שיחות"
- **Filter Logic**:
  - Search filters by candidate name (case-insensitive), phone number, **or partial text within tags**
  - Tag filter shows only chats/candidates with the selected tag
  - Both filters work together with AND logic
  - "הכל" (All) badge clears tag filter to show all results
- **Performance**: Used `useMemo` to compute unique tags with Hebrew sorting (`localeCompare`)
- **Testing**: E2E tests passed successfully for all search and filter functionality

### Chat Tagging and Pinning System (October 9, 2025)
- **Implementation**: Added comprehensive tagging and pinning functionality to chat interface
- **Database Schema**: Added `tags` (text array, default empty) and `isPinned` (boolean, default false) to candidates table
- **UI Features**:
  - Pin/unpin button for each chat - pinned chats automatically sorted to top of list
  - Tag management dialog for adding/removing tags per candidate
  - Tags displayed as badges in chat list
  - Pin icon indicator shown for pinned candidates
- **UX Enhancements**:
  - Enlarged buttons (h-7 w-7) and icons (w-4 h-4) for better visibility and accessibility
  - Added tooltips with Hebrew labels: "נעץ שיחה"/"בטל נעיצה"
  - "נהל תגיות" tooltip for tags button
  - Pin button changes to secondary variant when pinned for clearer visual feedback
  - All tooltips positioned at bottom for consistent UX
- **Sorting Logic**: Pinned chats appear first, then sorted by last message timestamp
- **Mutations**: Using existing PATCH /api/candidates/:id endpoint with proper cache invalidation

### Critical Security Fix - Complete Authentication System (October 8, 2025)
- **Issue**: Entire system was open - anyone could access all data, send WhatsApp messages, manage candidates
- **Solution**: Implemented full session-based authentication with bcrypt password hashing
- All API endpoints protected with `isAuthenticated` middleware (except `/api/login`)
- Frontend protected with `AuthGuard` component and `useAuth` hook
- Default credentials: `admin` / `admin123`

## System Architecture

### Frontend Architecture

The frontend uses React 18+ with TypeScript, Vite for bundling, and Wouter for routing. UI components are built with Shadcn/ui (based on Radix UI) and styled using Tailwind CSS, supporting RTL languages and light/dark themes. TanStack Query manages server state. Design incorporates WhatsApp green for messaging and blue for CRM actions, with semantic colors and an elevation system.

Key UI page:
- **Main Interface (`/`)**: Single-page WhatsApp Web-style interface
  - Shows QR code for connection when WhatsApp is not connected
  - Shows full WhatsApp Web chat interface when connected
  - Includes search, filtering, tagging and pinning capabilities
  - Dual-panel layout with chat list and message view

### Backend Architecture

The backend is built with Node.js and Express.js, using TypeScript. It integrates with Baileys for WhatsApp Web API connectivity, handling multi-file authentication, automatic reconnection, and message queuing. API endpoints are RESTful, providing CRUD operations for candidates, message sending, and status monitoring. Logging is handled by Winston, and email notifications are optional.

### Data Storage Solutions

PostgreSQL (via Neon serverless) is used as the primary database, with Drizzle ORM for type-safe queries. The schema includes tables for `users`, `candidates`, and `whatsapp_messages`, with appropriate foreign key relationships and cascading deletes.

### Authentication and Authorization

The system features a complete session-based authentication system. All API endpoints are protected with `isAuthenticated` middleware. Sessions are stored in a PostgreSQL `sessions` table. A default admin user is created on first startup. Frontend routes are protected by an `AuthGuard` component, redirecting unauthenticated users to the `/login` page.

### Feature Specifications

- **WhatsApp Connection**: Persistent connection with automatic QR code generation and reconnection.
- **Automatic Contact Creation**: New candidates are automatically created upon receiving messages from unknown numbers.
- **Real-time Messaging**: Send and receive WhatsApp messages directly from the CRM.
- **Security**: Full authentication and authorization for all API endpoints, session management, and bcrypt password hashing.

## External Dependencies

### Core Services

-   **WhatsApp Web API**: Integrated via the Baileys library for all WhatsApp messaging functionality.
-   **Neon PostgreSQL**: Serverless database solution for all persistent data storage.
-   **SMTP Server** (optional): For email notifications (e.g., system alerts).

### Third-Party Libraries

-   **UI Components**: Radix UI (primitives), Shadcn/ui.
-   **Styling**: Tailwind CSS, `class-variance-authority`, `clsx`.
-   **Forms & Validation**: React Hook Form with Zod.
-   **Date Handling**: `date-fns`.
-   **Logging**: Winston.
-   **Email**: Nodemailer.
-   **Database ORM**: Drizzle ORM.
-   **WhatsApp Library**: `@whiskeysockets/baileys`.
-   **Authentication**: `connect-pg-simple` (for session storage).

### Environment Variables

-   `DATABASE_URL`
-   `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `ADMIN_EMAIL` (optional)
-   `MAX_RECONNECT_ATTEMPTS`
-   `LOG_LEVEL`
-   `NODE_ENV`