# Overview

This is a comprehensive Recruitment Management System (RMS) built as a full-stack web application. The system manages candidates, clients, jobs, applications, and tasks for recruitment agencies. It features a modern React frontend with shadcn/ui components and an Express.js backend with PostgreSQL database integration using Drizzle ORM. The application supports Hebrew language interface and includes authentication, file uploads, and real-time data management capabilities.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React 18** with TypeScript for type safety and modern development
- **Vite** for fast development server and optimized builds
- **Wouter** for lightweight client-side routing
- **TanStack Query (React Query)** for server state management and caching
- **React Hook Form** with Zod validation for form handling
- **shadcn/ui** component library built on Radix UI primitives
- **Tailwind CSS** for styling with CSS variables for theming
- **Right-to-Left (RTL)** layout support for Hebrew interface

## Backend Architecture
- **Express.js** server with TypeScript
- **RESTful API** design with proper HTTP status codes and error handling
- **Modular route structure** separating concerns by resource type
- **Storage abstraction layer** for database operations
- **Middleware-based architecture** for authentication and request processing
- **File upload handling** with Multer for resume management

## Authentication System
- **Local authentication** with Passport.js and bcrypt password hashing
- **Session-based authentication** with PostgreSQL session storage
- **Default admin user** created on first run (email: admin@localhost, password: admin123)
- **Self-registration disabled** - Only admin/super admin can create new users via user management interface
- **User profile management** with role-based access control

## Authorization and Permissions System
- **Three-layer permission architecture**:
  1. **Role-based permissions**: Default permissions inherited from user roles (admin, recruiter, viewer, etc.)
  2. **Direct permission grants**: Specific permissions granted to individual users (override role defaults)
  3. **Direct permission revocations**: Specific permissions explicitly denied to users (highest priority)
- **Permission precedence**: Direct deny > Direct grant > Role grant
- **Detailed permission system**: Fine-grained access control for pages, menus, and components
- **Dynamic user permissions**: Admins can grant/revoke specific permissions to users via UI
- **Security features**:
  - Admin-only permission management
  - Self-modification prevention
  - Permission name validation against allowlist
  - Unique constraint on user-permission pairs
  - UPSERT semantics for idempotent operations
  - Audit logging with grantor tracking

## Database Design
- **PostgreSQL** as the primary database
- **Drizzle ORM** for type-safe database operations
- **Schema-first approach** with shared type definitions
- **Relational data model** with proper foreign key constraints
- **Migration system** for database versioning

### Core Entities:
- **Users**: Authentication and profile management
- **User Roles**: Many-to-many relationship mapping users to roles
- **User Permissions**: Direct permission grants and revocations for individual users with audit trail
- **Roles**: Predefined role definitions (admin, recruiter, viewer, etc.)
- **Role Permissions**: Many-to-many relationship mapping roles to permissions
- **Permissions**: System-wide permission definitions for fine-grained access control
- **Candidates**: Comprehensive candidate profiles with resume storage
- **Clients**: Company and contact management
- **Jobs**: Job postings with client relationships
- **Job Applications**: Candidate-job matching with status tracking
- **Tasks**: Task management for recruitment workflows
- **Sessions**: Secure session storage

## File Management & CV Extraction System
- **Resume upload** support for PDF, DOC/DOCX, and image formats (JPG, PNG, GIF, BMP, TIFF, WebP)
- **File validation** with size and type restrictions
- **Local file storage** with organized directory structure
- **File metadata** tracking in database
- **Email integration** with cPanel IMAP for automatic candidate creation from cv@h-group.org.il

### Advanced CV Data Extraction (October 2025 Improvements)
- **Format-aware text extraction**:
  - **PDF with text**: `pdf-parse` library for accurate text extraction with layout preservation
  - **PDF scanned** (no text): Automatic conversion to images + Tesseract OCR
  - **DOCX**: Mammoth library for clean text extraction from Word documents
  - **DOC, RTF, ODT**: Textract universal extractor for legacy formats
  - **Images**: Tesseract.js OCR with Hebrew, English, and Arabic language support
  - **Multi-stage fallback pipeline**: PDF text → PDF-to-image OCR → Textract universal
  
- **Hebrew-aware name extraction** with 5-strategy multi-pass system:
  1. Label-based patterns (שם מלא, שם, name, etc.)
  2. Hebrew name dictionary matching (100+ common Israeli first/last names)
  3. First-line Hebrew name detection
  4. English name patterns (capitalized names)
  5. Generic two-word fallback with common word filtering
  
- **International phone number parsing**:
  - Google libphonenumber library for accurate validation
  - E.164 format standardization
  - Israeli (+972) and international number support
  - Multiple regex patterns with fallback extraction
  
- **Enhanced email extraction**:
  - Improved regex patterns for accuracy
  - False positive filtering (test/example emails)
  - Domain validation
  
- **Text normalization**:
  - RTL/LTR mark removal
  - Whitespace normalization
  - Multi-line text handling

### Bulk CV Import Feature (October 2025)
- **Super admin exclusive feature** for uploading unlimited CV files simultaneously
- **Batch processing architecture**: Processes files in batches of 1000 to prevent system overload
- **Parallel processing**: Files within each batch are processed simultaneously with `Promise.all` for 5-10x speed improvement
- **Unlimited file support**: Can handle 20,000+ files by processing them in chunks
- **Automatic candidate creation**: Extracts data and creates candidate profiles automatically
- **Duplicate detection**: Identifies existing candidates by email/phone to prevent duplicates
- **Progress tracking**: Real-time UI feedback during import process with batch progress
- **Detailed results**: Shows success/failure status for each file with error messages
- **Security**: Frontend and backend permission checks ensure only super admins can access
- **Route**: `/candidates/bulk-import` (protected route)
- **API Endpoint**: `POST /api/candidates/bulk-import` with multipart/form-data (supports up to 20,000 files)
- **Navigation**: Menu item visible only to super admin users
- **Performance optimization**: Memory-efficient processing with parallel execution prevents timeouts and crashes

## User Management (October 2025)
- **Admin-controlled user creation** - Self-registration is disabled
- **User Management Interface** at `/user-management` (admin/super admin only)
- **Automatic password generation** and email delivery for new users
- **Role assignment required** when creating new users
- **Welcome email** with login credentials sent to new users automatically
- **API Endpoint**: `POST /api/users` (requires admin or super admin role)

## Duplicate Send Prevention (October 2025)
- **30-day duplicate warning system** - Prevents accidental sending of multiple candidates to same employer
- **Pre-send validation** - Checks if other candidates were sent to employer within last 30 days
- **Warning dialog** - Shows list of previously sent candidates with names and send dates
- **User confirmation required** - Employee can review and choose to proceed or cancel send
- **API Endpoint**: `GET /api/check-recent-employer-sends/:clientId` - Returns recent sends history
- **Smart detection** - Queries emails table with joins to candidates and jobs for accurate tracking
- **Warning message format**: "⚠️ למעסיק [שם החברה] נשלחו מועמדים ב-30 הימים האחרונים: [רשימת שמות]"
- **Integration**: Automatically triggers before candidate send in referral workflow

## Bulk Candidate Operations (October 2025)
- **Super Admin exclusive feature**: Only super admin users can perform bulk operations
- **Multi-select functionality**: Checkboxes for selecting multiple candidates in candidates page
- **Select all**: Checkbox in table header to select/deselect all visible candidates
- **Bulk delete**: Delete multiple candidates simultaneously with confirmation dialog
- **Permission-based**: Only super admin can see checkboxes and perform bulk deletion
- **Parallel processing**: Deletes all selected candidates simultaneously using `Promise.all`
- **UI feedback**: Shows count of selected candidates and delete button appears when candidates are selected
- **API Endpoint**: `POST /api/candidates/bulk-delete` with `candidateIds` array in request body (super admin only)
- **Success tracking**: Returns detailed results showing successful and failed deletions
- **Cache invalidation**: Automatically refreshes candidate lists after bulk operations

## Recently Updated Candidates Page (October 2025)
- **Activity tracking page** showing candidates with recent status changes (rejected or sent to employers)
- **Comprehensive display**: Shows job name, company name, user name (who handled the referral), candidate name, and last update timestamp
- **Permission-based access**: `view_recently_updated` permission (granted to admin, restricted_admin, and user roles)
- **Route**: `/candidates/recently-updated` with navigation menu item featuring RefreshCw icon
- **API Endpoint**: `GET /api/candidates/recently-updated` returns enriched candidate data with job and company info
- **Advanced filtering system**:
  - **Status filter**: Filter by "נשלח למעסיק" (sent to employer) or "נפסל ע"י מעסיק" (rejected by employer)
  - **Job filter**: Filter by specific job position
  - **Date range filter**: Filter by date range (from date, to date)
  - **Clear filters button**: Reset all filters with one click
  - **Auto-pagination reset**: Page automatically resets to 0 when filters change to prevent empty results
- **Status detection**: Filters candidates with `rejected_by_employer` or `sent_to_employer` status
- **User tracking**: Displays `lastReferralUserName` (user who handled the referral) with fallback to `creatorUsername`
- **Sorted by date**: Shows most recent updates first for easy activity monitoring
- **Navigation**: Accessible via main menu for all users with appropriate permissions

## Dashboard Stats - Hired This Month (October 2025)
- **Placement tracking** renamed from "השמות החודש" to "התקבלו לעבודה החודש"
- **Current month counting**: Tracks candidates with status='hired' updated from start of current month (not last 30 days)
- **Data source change**: Now counts from `candidates` table instead of `jobApplications` table
- **Monthly reset**: Count resets automatically at the start of each month
- **Implementation**: Uses `candidates.status = 'hired' AND candidates.updatedAt >= start_of_month` query
- **Display**: Third statistics card in dashboard showing monthly hired candidates count

# External Dependencies

## Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL connection for Neon database hosting
- **drizzle-orm**: Type-safe SQL query builder and ORM
- **express**: Web application framework
- **react**: UI library
- **@tanstack/react-query**: Server state management

## UI and Styling
- **@radix-ui/***: Comprehensive set of UI primitives for accessible components
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

## Authentication and Security
- **passport**: Authentication middleware
- **openid-client**: OAuth/OpenID Connect implementation
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store

## Form Handling and Validation
- **react-hook-form**: Form state management
- **@hookform/resolvers**: Form validation resolvers
- **zod**: Schema validation library

## Development and Build Tools
- **vite**: Build tool and development server
- **typescript**: Static type checking
- **tsx**: TypeScript execution engine
- **esbuild**: JavaScript bundler for production builds

## Utility Libraries
- **date-fns**: Date manipulation and formatting
- **multer**: File upload middleware
- **clsx**: Conditional className utility
- **cmdk**: Command menu component

The system is designed for deployment on Replit with environment-based configuration for database connections and authentication settings.