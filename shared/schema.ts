import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  username: varchar("username").unique(), // שם משתמש לכניסה
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  password: varchar("password"), // For password-based authentication
  passwordResetToken: varchar("password_reset_token"), // טוקן לאיפוס סיסמא
  passwordResetExpires: timestamp("password_reset_expires"), // תפוגת טוקן איפוס
  lastLogin: timestamp("last_login"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enums
export const jobStatusEnum = pgEnum('job_status', ['active', 'paused', 'closed']);
export const applicationStatusEnum = pgEnum('application_status', ['submitted', 'reviewed', 'interview', 'interview_scheduled', 'rejected', 'accepted']);
export const rejectionReasonEnum = pgEnum('rejection_reason', ['lack_of_experience', 'geographic_mismatch', 'salary_demands', 'qualifications_mismatch', 'other']);
export const emailStatusEnum = pgEnum('email_status', ['pending', 'sent', 'failed', 'delivered', 'bounced']);
export const roleTypeEnum = pgEnum('role_type', ['super_admin', 'admin', 'user', 'job_viewer', 'restricted_admin']);

// Roles table
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  type: roleTypeEnum("type").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Permissions table
export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  resource: varchar("resource").notNull(), // כמו 'candidates', 'jobs', 'settings'
  action: varchar("action").notNull(), // כמו 'create', 'read', 'update', 'delete'
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User roles junction table
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  roleId: varchar("role_id").notNull(),
  assignedBy: varchar("assigned_by"), // מי הקצה את התפקיד
  assignedAt: timestamp("assigned_at").defaultNow(),
  // הגבלות גישה נוספות
  allowedJobIds: text("allowed_job_ids"), // רשימת משרות מותרות (JSON array)
  restrictions: jsonb("restrictions"), // הגבלות נוספות
});

// Role permissions junction table
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull(),
  permissionId: varchar("permission_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User permissions - הרשאות ספציפיות ישירות למשתמשים
export const userPermissions = pgTable("user_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  permissionName: varchar("permission_name").notNull(), // שם ההרשאה (כמו 'view_dashboard', 'edit_candidates')
  isGranted: boolean("is_granted").notNull().default(true), // true = ניתנה, false = נשללה
  grantedBy: varchar("granted_by"), // מי נתן/שלל את ההרשאה
  grantedAt: timestamp("granted_at").defaultNow(),
  notes: text("notes"), // הערות על מדוע ניתנה/נשללה ההרשאה
}, (table) => ({
  // Unique constraint - למנוע הרשאות כפולות לאותו משתמש ואותה הרשאה
  uniqueUserPermission: unique().on(table.userId, table.permissionName)
}));

// Message templates table
export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  content: text("content").notNull(),
  icon: varchar("icon").default("💬"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Candidate statuses table
export const candidateStatuses = pgTable("candidate_statuses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(), // כמו 'available', 'employed' - מזהה ייחודי
  name: varchar("name").notNull(), // השם בעברית - 'זמין', 'מועסק'
  color: varchar("color").notNull().default('bg-gray-100 text-gray-800'), // צבע התווית
  isSystem: boolean("is_system").default(false), // האם זה סטטוס מערכת שלא ניתן למחוק
  displayOrder: integer("display_order").default(0), // סדר תצוגה
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Candidates table
export const candidates = pgTable("candidates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateNumber: integer("candidate_number").unique(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email"), // unique constraint only for non-empty values
  mobile: varchar("mobile"), // נייד
  phone: varchar("phone"), // טלפון נ'
  phone2: varchar("phone2"), // טלפון נ' 2
  nationalId: varchar("national_id"), // תעודת זהות
  city: varchar("city"), // עיר
  street: varchar("street"), // רחוב
  houseNumber: varchar("house_number"), // מס' בית
  zipCode: varchar("zip_code"), // מיקוד
  address: text("address"), // כתובת מלאה (נשאר לתאימות לאחור)
  gender: varchar("gender"), // מין
  maritalStatus: varchar("marital_status"), // מצב משפחתי
  birthDate: varchar("birth_date"), // תאריך לידה
  age: integer("age"), // גיל (מחושב מתאריך לידה)
  drivingLicense: varchar("driving_license"), // רישיון נהיגה
  receptionArea: varchar("reception_area"), // איזור קליטה אופטימליות (מוסר)
  profession: varchar("profession"),
  experience: integer("experience"), // years of experience
  achievements: text("achievements"), // הישגים
  recruitmentSource: varchar("recruitment_source"), // מקור גיוס
  source: varchar("source").default('manual'), // מקור הגעה: manual, landing_page, email
  expectedSalary: integer("expected_salary"),
  cvPath: varchar("cv_path"), // file path for uploaded CV
  cvContent: text("cv_content"), // extracted text content from CV for searching
  manualCv: text("manual_cv"), // קורות חיים ידני שנכתב במערכת
  status: text("status").default('pending'),
  rating: integer("rating"), // 1-5 rating
  notes: text("notes"),
  tags: text("tags").array(), // array of tags
  isPinned: boolean("is_pinned").default(false), // נעוץ בראש רשימת הצ'אטים
  chatType: varchar("chat_type").default('individual'), // individual, group, archived
  previousChatType: varchar("previous_chat_type"), // שמירת סוג הצ'אט לפני העברה לארכיון
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Indexes for optimized search performance
  index("candidates_name_idx").on(table.firstName, table.lastName),
  index("candidates_email_idx").on(table.email),
  index("candidates_profession_idx").on(table.profession),
  index("candidates_city_idx").on(table.city),
  index("candidates_status_idx").on(table.status),
  index("candidates_created_at_idx").on(table.createdAt),
  // Full-text search index for CV content
  sql`CREATE INDEX IF NOT EXISTS candidates_cv_content_gin_idx ON candidates USING gin(to_tsvector('english', cv_content))`,
]);

// Clients table
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientNumber: integer("client_number").unique(), // מספר לקוח אוטומטי
  companyName: varchar("company_name").notNull(),
  contactName: varchar("contact_name"), // Legacy field - kept for backward compatibility, now optional
  email: varchar("email"), // אופציונלי - המידע קיים באנשי קשר
  phone: varchar("phone"), // אופציונלי - המידע קיים באנשי קשר
  address: text("address"),
  website: varchar("website"),
  industry: varchar("industry"),
  commissionRate: integer("commission_rate"), // percentage
  paymentTerms: varchar("payment_terms"),
  notes: text("notes"),
  contactPersons: jsonb("contact_persons").$type<Array<{
    id: string; // UUID של איש הקשר
    name?: string;
    title?: string;
    email: string;
    mobile?: string;
  }>>().default([]), // אנשי קשר - עד 20
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Jobs table
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobCode: varchar("job_code", { length: 7 }).unique(), // קוד משרה בן 7 ספרות
  additionalCodes: text("additional_codes").array(), // קודים נוספים (אופציונלי)
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements"),
  location: varchar("location"),
  salaryRange: varchar("salary_range"),
  jobType: varchar("job_type"), // full-time, part-time, contract
  isRemote: boolean("is_remote").default(false),
  status: jobStatusEnum("status").default('active'),
  priority: varchar("priority").default('medium'), // low, medium, high
  deadline: timestamp("deadline"),
  clientId: varchar("client_id").references(() => clients.id),
  positions: integer("positions").default(1),
  // Landing page fields
  landingImage: varchar("landing_image"), // תמונה לדף הנחיתה
  landingImageOriginalName: varchar("landing_image_original_name"), // שם המקורי של התמונה
  benefits: text("benefits"), // הטבות
  companyDescription: text("company_description"), // תיאור החברה
  requiredFields: text("required_fields").array().default(sql`'{}'`), // שדות חובה
  optionalFields: text("optional_fields").array().default(sql`'{}'`), // שדות אופציונליים
  customFields: jsonb("custom_fields"), // שדות מותאמים אישית
  showSalary: boolean("show_salary").default(true), // האם להציג שכר
  showCompanyName: boolean("show_company_name").default(true), // האם להציג שם החברה
  landingPageActive: boolean("landing_page_active").default(true), // האם דף הנחיתה פעיל
  landingViews: integer("landing_views").default(0), // מספר צפיות בדף הנחיתה
  landingApplications: integer("landing_applications").default(0), // מספר הגשות מועמדות מדף הנחיתה
  // Job management fields
  selectedContactPersonIds: text("selected_contact_person_ids").array(), // IDs של אנשי קשר נבחרים מהלקוח
  internalNotes: text("internal_notes"), // הערה פנימית
  isUrgent: boolean("is_urgent").default(false), // משרה דחופה - תופיע בראש הרשימות
  autoSendToClient: boolean("auto_send_to_client").default(false), // שליחה אוטומטית ללקוח ללא סינון
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Indexes for optimized search performance
  index("jobs_job_code_idx").on(table.jobCode),
  index("jobs_title_idx").on(table.title),
  index("jobs_status_idx").on(table.status),
  index("jobs_client_id_idx").on(table.clientId),
  index("jobs_priority_idx").on(table.priority),
  index("jobs_created_at_idx").on(table.createdAt),
]);

// Job Applications (many-to-many between candidates and jobs)
export const jobApplications = pgTable("job_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").references(() => candidates.id),
  jobId: varchar("job_id").references(() => jobs.id),
  status: applicationStatusEnum("status").default('submitted'),
  appliedAt: timestamp("applied_at").defaultNow(),
  interviewDate: timestamp("interview_date"),
  notes: text("notes"),
  clientFeedback: text("client_feedback"),
  reviewerFeedback: text("reviewer_feedback"), // חוות דעת המגייס
  rejectionReason: rejectionReasonEnum("rejection_reason"), // סיבת פסילה
  reviewedAt: timestamp("reviewed_at"), // תאריך הסקירה
  sentToClient: boolean("sent_to_client").default(false), // האם נשלח ללקוח
});

// Tasks table
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  priority: varchar("priority").default('medium'), // low, medium, high
  isCompleted: boolean("is_completed").default(false),
  candidateId: varchar("candidate_id").references(() => candidates.id),
  jobId: varchar("job_id").references(() => jobs.id),
  clientId: varchar("client_id").references(() => clients.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Events table for tracking candidate interactions
export const candidateEvents = pgTable("candidate_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").references(() => candidates.id).notNull(),
  eventType: varchar("event_type").notNull(), // email_application, phone_call, interview, status_change, etc.
  description: text("description").notNull(),
  metadata: jsonb("metadata"), // additional data as JSON
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reminders table
export const reminders = pgTable("reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  reminderDate: timestamp("reminder_date").notNull(),
  priority: varchar("priority").default('medium'), // low, medium, high
  isCompleted: boolean("is_completed").default(false),
  candidateId: varchar("candidate_id").references(() => candidates.id),
  jobId: varchar("job_id").references(() => jobs.id),
  clientId: varchar("client_id").references(() => clients.id),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Interview Events table - for tracking interview schedules and appointments
export const interviewEvents = pgTable("interview_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  eventDate: timestamp("event_date").notNull(),
  eventType: varchar("event_type").notNull(), // interview_phone, interview_face_to_face, callback_reminder, warranty_end, etc.
  status: varchar("status").default('scheduled'), // scheduled, completed, cancelled, rescheduled
  candidateId: varchar("candidate_id").references(() => candidates.id).notNull(),
  jobId: varchar("job_id").references(() => jobs.id),
  clientId: varchar("client_id").references(() => clients.id),
  recruiterId: varchar("recruiter_id").references(() => users.id), // הרכז האחראי
  recruiterName: varchar("recruiter_name"), // שם הרכז
  recruiterColor: varchar("recruiter_color").default('#3B82F6'), // צבע הרכז ביומן
  location: varchar("location"), // מקום הראיון
  notes: text("notes"),
  metadata: jsonb("metadata"), // נתונים נוספים
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const candidatesRelations = relations(candidates, ({ many }) => ({
  applications: many(jobApplications),
  tasks: many(tasks),
  events: many(candidateEvents),
  reminders: many(reminders),
  interviewEvents: many(interviewEvents),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  jobs: many(jobs),
  tasks: many(tasks),
  reminders: many(reminders),
  interviewEvents: many(interviewEvents),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  client: one(clients, {
    fields: [jobs.clientId],
    references: [clients.id],
  }),
  applications: many(jobApplications),
  tasks: many(tasks),
  reminders: many(reminders),
  interviewEvents: many(interviewEvents),
}));

export const jobApplicationsRelations = relations(jobApplications, ({ one }) => ({
  candidate: one(candidates, {
    fields: [jobApplications.candidateId],
    references: [candidates.id],
  }),
  job: one(jobs, {
    fields: [jobApplications.jobId],
    references: [jobs.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  candidate: one(candidates, {
    fields: [tasks.candidateId],
    references: [candidates.id],
  }),
  job: one(jobs, {
    fields: [tasks.jobId],
    references: [jobs.id],
  }),
  client: one(clients, {
    fields: [tasks.clientId],
    references: [clients.id],
  }),
}));

export const candidateEventsRelations = relations(candidateEvents, ({ one }) => ({
  candidate: one(candidates, {
    fields: [candidateEvents.candidateId],
    references: [candidates.id],
  }),
  createdByUser: one(users, {
    fields: [candidateEvents.createdBy],
    references: [users.id],
  }),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  candidate: one(candidates, {
    fields: [reminders.candidateId],
    references: [candidates.id],
  }),
  job: one(jobs, {
    fields: [reminders.jobId],
    references: [jobs.id],
  }),
  client: one(clients, {
    fields: [reminders.clientId],
    references: [clients.id],
  }),
  createdByUser: one(users, {
    fields: [reminders.createdBy],
    references: [users.id],
  }),
}));

export const interviewEventsRelations = relations(interviewEvents, ({ one }) => ({
  candidate: one(candidates, {
    fields: [interviewEvents.candidateId],
    references: [candidates.id],
  }),
  job: one(jobs, {
    fields: [interviewEvents.jobId],
    references: [jobs.id],
  }),
  client: one(clients, {
    fields: [interviewEvents.clientId],
    references: [clients.id],
  }),
  recruiter: one(users, {
    fields: [interviewEvents.recruiterId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [interviewEvents.createdBy],
    references: [users.id],
  }),
}));

// Relations for RBAC system
export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles, { relationName: "user_roles" }),
  assignedRoles: many(userRoles, { relationName: "assigned_roles" }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
  rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
    relationName: "user_roles",
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  assignedByUser: one(users, {
    fields: [userRoles.assignedBy],
    references: [users.id],
    relationName: "assigned_roles",
  }),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

// Insert schemas
export const insertCandidateSchema = createInsertSchema(candidates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Contact person schema for validation
export const contactPersonSchema = z.object({
  id: z.string(), // UUID של איש הקשר
  name: z.string().optional(),
  title: z.string().optional(),
  email: z.string().email("כתובת מייל לא תקינה"),
  mobile: z.string().optional(),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  contactPersons: z.array(contactPersonSchema).max(20, "ניתן להוסיף עד 20 אנשי קשר").optional().default([]),
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobApplicationSchema = createInsertSchema(jobApplications).omit({
  id: true,
  appliedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Email table for tracking sent emails
export const emails = pgTable("emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  from: varchar("from").notNull(),
  to: varchar("to").notNull(),
  cc: varchar("cc"),
  subject: varchar("subject").notNull(),
  body: text("body").notNull(),
  isHtml: boolean("is_html").default(true),
  status: emailStatusEnum("status").default('pending'),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  candidateId: varchar("candidate_id").references(() => candidates.id),
  jobId: varchar("job_id").references(() => jobs.id),
  clientId: varchar("client_id").references(() => clients.id),
  sentBy: varchar("sent_by").references(() => users.id),
  errorMessage: text("error_message"),
  attachments: text("attachments").array(), // array of file paths
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmailSchema = createInsertSchema(emails);
export const insertCandidateEventSchema = createInsertSchema(candidateEvents).omit({
  id: true,
  createdAt: true,
});

// Insert schemas for RBAC
export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  assignedAt: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
});

// Types for RBAC
export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

// Extended user type with roles
export type UserWithRoles = User & {
  userRoles: (UserRole & {
    role: Role & {
      rolePermissions: (RolePermission & {
        permission: Permission;
      })[];
    };
  })[];
};
export const insertReminderSchema = createInsertSchema(reminders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertInterviewEventSchema = createInsertSchema(interviewEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCandidateStatusSchema = createInsertSchema(candidateStatuses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Email = typeof emails.$inferSelect;
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertCandidateStatus = z.infer<typeof insertCandidateStatusSchema>;
export type CandidateStatus = typeof candidateStatuses.$inferSelect;
export type InsertCandidateEvent = z.infer<typeof insertCandidateEventSchema>;
export type CandidateEvent = typeof candidateEvents.$inferSelect;
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof reminders.$inferSelect;
export type ReminderWithDetails = Reminder & { candidate?: Candidate; job?: JobWithClient; client?: Client; createdByUser?: User; };
export type InsertInterviewEvent = z.infer<typeof insertInterviewEventSchema>;
export type InterviewEvent = typeof interviewEvents.$inferSelect;
export type InterviewEventWithDetails = InterviewEvent & { candidate: Candidate; job?: JobWithClient; client?: Client; recruiter?: User; };
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidates.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;
export type JobWithClient = Job & { client: Client };
export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;
export type JobApplication = typeof jobApplications.$inferSelect;
export type JobApplicationWithDetails = JobApplication & { candidate: Candidate; job: JobWithClient };
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type TaskWithDetails = Task & { candidate?: Candidate; job?: JobWithClient; client?: Client };

// Enhanced candidate type with computed enriched data
export type EnrichedCandidate = Candidate & {
  lastJobTitle?: string | null;
  lastAppliedAt?: Date | null;
  lastReferralDate?: Date | null;
  lastReferralClient?: string | null;
  lastStatusChange?: Date | null;
  lastStatusDescription?: string | null;
  creatorUsername?: string | null;
};

// WhatsApp Sessions table - for storing WhatsApp authentication state
export const whatsappSessions = pgTable("whatsapp_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().unique(), // unique identifier for this session
  userId: varchar("user_id").references(() => users.id), // which user owns this WhatsApp connection
  authState: jsonb("auth_state"), // Baileys auth state (creds, keys)
  isActive: boolean("is_active").default(false), // is currently connected
  lastConnected: timestamp("last_connected"),
  lastDisconnected: timestamp("last_disconnected"),
  phoneNumber: varchar("phone_number"), // WhatsApp phone number
  qrCode: text("qr_code"), // current QR code if waiting for scan
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// WhatsApp Messages table - for storing all WhatsApp messages
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().unique(), // WhatsApp's internal message ID
  sessionId: varchar("session_id").references(() => whatsappSessions.id),
  candidateId: varchar("candidate_id").references(() => candidates.id), // linked candidate
  fromMe: boolean("from_me").notNull(), // true if sent by us, false if received
  remoteJid: varchar("remote_jid").notNull(), // WhatsApp JID (phone number)
  senderName: varchar("sender_name"), // Name of the sender
  messageType: varchar("message_type").notNull().default('text'), // text, image, document, audio, video, sticker
  messageText: text("message_text"), // text content
  mediaUrl: varchar("media_url"), // URL to media file if applicable
  fileName: varchar("file_name"), // original file name for documents
  mimeType: varchar("mime_type"), // MIME type for media
  fileSize: integer("file_size"), // file size in bytes
  caption: text("caption"), // caption for media
  timestamp: timestamp("timestamp").notNull(), // when message was sent/received
  isRead: boolean("is_read").default(false), // read status
  metadata: jsonb("metadata"), // additional message data
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("whatsapp_messages_candidate_idx").on(table.candidateId),
  index("whatsapp_messages_remote_jid_idx").on(table.remoteJid),
  index("whatsapp_messages_timestamp_idx").on(table.timestamp),
]);

// WhatsApp Chats table - for tracking active conversations
export const whatsappChats = pgTable("whatsapp_chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => whatsappSessions.id),
  candidateId: varchar("candidate_id").references(() => candidates.id), // linked candidate
  remoteJid: varchar("remote_jid").notNull().unique(), // WhatsApp JID
  name: varchar("name"), // chat name (contact name or group name)
  profilePicUrl: varchar("profile_pic_url"), // profile picture URL
  isGroup: boolean("is_group").default(false), // is this a group chat
  isPinned: boolean("is_pinned").default(false), // is chat pinned
  isArchived: boolean("is_archived").default(false), // is chat archived
  tags: text("tags").array(), // array of tags for filtering and organization
  unreadCount: integer("unread_count").default(0), // number of unread messages
  lastMessageAt: timestamp("last_message_at"), // timestamp of last message
  lastMessagePreview: text("last_message_preview"), // preview of last message
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("whatsapp_chats_candidate_idx").on(table.candidateId),
  index("whatsapp_chats_remote_jid_idx").on(table.remoteJid),
]);

// Relations for WhatsApp tables
export const whatsappSessionsRelations = relations(whatsappSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [whatsappSessions.userId],
    references: [users.id],
  }),
  messages: many(whatsappMessages),
  chats: many(whatsappChats),
}));

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  session: one(whatsappSessions, {
    fields: [whatsappMessages.sessionId],
    references: [whatsappSessions.id],
  }),
  candidate: one(candidates, {
    fields: [whatsappMessages.candidateId],
    references: [candidates.id],
  }),
}));

export const whatsappChatsRelations = relations(whatsappChats, ({ one }) => ({
  session: one(whatsappSessions, {
    fields: [whatsappChats.sessionId],
    references: [whatsappSessions.id],
  }),
  candidate: one(candidates, {
    fields: [whatsappChats.candidateId],
    references: [candidates.id],
  }),
}));

// Insert schemas for WhatsApp
export const insertWhatsappSessionSchema = createInsertSchema(whatsappSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  id: true,
  createdAt: true,
});

export const insertWhatsappChatSchema = createInsertSchema(whatsappChats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for WhatsApp
export type WhatsappSession = typeof whatsappSessions.$inferSelect;
export type InsertWhatsappSession = z.infer<typeof insertWhatsappSessionSchema>;

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;

export type WhatsappChat = typeof whatsappChats.$inferSelect;
export type InsertWhatsappChat = z.infer<typeof insertWhatsappChatSchema>;

export type WhatsappChatWithMessages = WhatsappChat & {
  messages: WhatsappMessage[];
  candidate?: Candidate;
};
