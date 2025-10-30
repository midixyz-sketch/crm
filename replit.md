# Overview

This Recruitment Management System (RMS) is a full-stack web application designed for recruitment agencies. Its primary purpose is to streamline talent acquisition by managing candidates, clients, jobs, applications, and tasks. Key capabilities include robust authentication, advanced CV data extraction, real-time data management, and comprehensive WhatsApp integration. The project aims to provide an efficient and scalable platform to enhance productivity in recruitment operations.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX
-   Frontend built with **React 18** (TypeScript, Vite, Wouter, TanStack Query).
-   UI uses **shadcn/ui** and **Tailwind CSS**, with full RTL support for Hebrew.
-   Navigation includes a sidebar/navbar, with settings on a dedicated page.
-   WhatsApp chat interface is a full-screen overlay with RTL layout.

## Technical Implementations
-   **Backend**: **Express.js** (TypeScript) with a RESTful API, modular structure, and Multer for file uploads.
-   **Authentication & Authorization**: Local authentication using Passport.js and bcrypt with session-based PostgreSQL storage. Features a multi-layered Role-Based Access Control (RBAC) system. Admin-controlled user creation.
-   **Database**: **PostgreSQL** with **Drizzle ORM**. Core entities include Users, Candidates, Clients, Jobs, Applications, Tasks. Features automatic unique numbering for candidates/clients, dynamic candidate statuses, and contact person management for clients.
-   **Advanced CV Data Extraction**: Supports multiple formats (PDF, DOCX, images) with OCR for Hebrew/English/Arabic, and intelligent data extraction.
-   **Bulk CV Import**: Super admin feature for stable, sequential processing of CVs with duplicate detection.
-   **User Management**: Admin-only user creation and role assignment with automated welcome emails.
-   **WhatsApp Integration**: Embedded functionality via `@whiskeysockets/baileys`. Each user has their own independent WhatsApp connection and session. Features include QR code connection, full chat page with RTL support, rich media support, message delivery statuses, and emoji picker.
-   **Calendar & Reminders**: Full-featured system for managing reminders and interviews with candidate linking, user tracking, priority levels, and alerts.
-   **Candidate Event History**: Comprehensive audit trail of all candidate interactions with user tracking.
-   **In-Browser File Preview**: Integrated `FileViewer` component for PDF (PDF.js), Word documents (Mammoth.js HTML conversion), and images, displayed in a modal without automatic downloads.
-   **Job Interviews Page UI**: Optimized for RTL Hebrew, features a 4-button layout for candidate evaluation, and integrated calendar scheduling for interviews with reminder creation and clickable links.
-   **External Recruiters Module**: Role-based system (`external_recruiter`) with restricted permissions and job assignment functionality. Supports optional approval workflow for candidates and automatic emailing to employers. All actions are logged, and access is strictly controlled.
-   **Reports & Analytics Module**: Permission-protected module with three sections: Candidates by Time/Source (line chart), Recruiter Activity Tracking (table), and Individual Recruiter Performance (bar charts).

## Feature Specifications
-   **Form Handling**: React Hook Form with Zod for validation.
-   **Duplicate Send Prevention**: 30-day warning system for sending candidates to employers.
-   **Bulk Candidate Operations**: Super admin function for deleting multiple candidates.
-   **Dashboard Statistics**: Displays "Hired This Month" and "Revenue."
-   **WhatsApp Message Templates**: Database-driven templates with CRUD operations and placeholders.
-   **Optimized Candidate Table**: Streamlined view focusing on essential information.
-   **Candidate Detail Page**: Comprehensive profile with inline editing, CV display, and expandable event history.
-   **Recently Updated Candidates Page**: Tracks candidates with "sent_to_employer" and "rejected" statuses, displaying recruiter who performed the status change, clear status labels, and filtering options.

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