// Reference: javascript_database integration blueprint
import { 
  candidates, 
  whatsappMessages,
  type Candidate,
  type InsertCandidate,
  type WhatsappMessage,
  type InsertWhatsappMessage
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Candidate operations
  getCandidate(id: string): Promise<Candidate | undefined>;
  getCandidateByPhone(phone: string): Promise<Candidate | undefined>;
  getAllCandidates(): Promise<Candidate[]>;
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  updateCandidate(id: string, candidate: Partial<InsertCandidate>): Promise<Candidate | undefined>;
  deleteCandidate(id: string): Promise<boolean>;
  
  // WhatsApp message operations
  createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;
  getWhatsappMessagesByCandidate(candidateId: string): Promise<WhatsappMessage[]>;
  getAllWhatsappMessages(): Promise<WhatsappMessage[]>;
  updateWhatsappMessageStatus(
    id: string, 
    status: string, 
    deliveredAt?: Date,
    errorMessage?: string
  ): Promise<WhatsappMessage | undefined>;
}

export class DatabaseStorage implements IStorage {
  public db = db;
  public schema = { candidates, whatsappMessages };

  // Candidate operations
  async getCandidate(id: string): Promise<Candidate | undefined> {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.id, id));
    return candidate || undefined;
  }

  async getCandidateByPhone(phone: string): Promise<Candidate | undefined> {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.phone, phone));
    return candidate || undefined;
  }

  async getAllCandidates(): Promise<Candidate[]> {
    return await db.select().from(candidates).orderBy(desc(candidates.createdAt));
  }

  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    const [candidate] = await db
      .insert(candidates)
      .values(insertCandidate)
      .returning();
    return candidate;
  }

  async updateCandidate(id: string, updates: Partial<InsertCandidate>): Promise<Candidate | undefined> {
    const [candidate] = await db
      .update(candidates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(candidates.id, id))
      .returning();
    return candidate || undefined;
  }

  async deleteCandidate(id: string): Promise<boolean> {
    const result = await db.delete(candidates).where(eq(candidates.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // WhatsApp message operations
  async createWhatsappMessage(insertMessage: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const [message] = await db
      .insert(whatsappMessages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async getWhatsappMessagesByCandidate(candidateId: string): Promise<WhatsappMessage[]> {
    return await db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.candidateId, candidateId))
      .orderBy(desc(whatsappMessages.sentAt));
  }

  async getAllWhatsappMessages(): Promise<WhatsappMessage[]> {
    return await db
      .select()
      .from(whatsappMessages)
      .orderBy(desc(whatsappMessages.sentAt));
  }

  async updateWhatsappMessageStatus(
    id: string,
    status: string,
    deliveredAt?: Date,
    errorMessage?: string
  ): Promise<WhatsappMessage | undefined> {
    const updates: any = { status };
    if (deliveredAt) updates.deliveredAt = deliveredAt;
    if (errorMessage) updates.errorMessage = errorMessage;

    const [message] = await db
      .update(whatsappMessages)
      .set(updates)
      .where(eq(whatsappMessages.id, id))
      .returning();
    return message || undefined;
  }
}

export const storage = new DatabaseStorage();
