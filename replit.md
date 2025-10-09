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
- **Replit OAuth** integration for seamless authentication
- **Passport.js** with OpenID Connect strategy
- **Session-based authentication** with PostgreSQL session storage
- **User profile management** with automatic user creation/update

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
  - **PDF**: `pdf-parse` library for accurate text extraction with layout preservation
  - **DOCX**: Mammoth library for clean text extraction from Word documents
  - **Images**: Tesseract.js OCR with Hebrew, English, and Arabic language support
  - Fallback strategies for corrupted or complex files
  
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
- **Super admin exclusive feature** for uploading multiple CV files simultaneously
- **Multi-file processing**: Support for up to 50 files per batch
- **Automatic candidate creation**: Extracts data and creates candidate profiles automatically
- **Duplicate detection**: Identifies existing candidates by email/phone to prevent duplicates
- **Progress tracking**: Real-time UI feedback during import process
- **Detailed results**: Shows success/failure status for each file with error messages
- **Security**: Frontend and backend permission checks ensure only super admins can access
- **Route**: `/candidates/bulk-import` (protected route)
- **API Endpoint**: `POST /api/candidates/bulk-import` with multipart/form-data
- **Navigation**: Menu item visible only to super admin users

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