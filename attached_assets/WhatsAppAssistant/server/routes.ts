import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { whatsappService } from "./services/whatsapp/whatsapp";
import { notificationService } from "./services/notifications";
import logger from "./utils/logger";
import { 
  insertCandidateSchema, 
  insertWhatsappMessageSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize services
  notificationService.initialize();
  
  // Start WhatsApp connection on server startup
  whatsappService.connect().catch((error) => {
    logger.error('Failed to start WhatsApp connection on startup:', error);
  });

  // ==================== WhatsApp Routes ====================
  
  // Get WhatsApp connection status
  app.get("/api/whatsapp/status", (req, res) => {
    try {
      const status = whatsappService.getStatus();
      const reconnectAttempts = whatsappService.getReconnectAttempts();
      
      res.json({
        status,
        connected: whatsappService.isConnected(),
        reconnectAttempts,
      });
    } catch (error: any) {
      logger.error('Error getting WhatsApp status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get WhatsApp QR code
  app.get("/api/whatsapp/qr",  (req, res) => {
    try {
      const qr = whatsappService.getCurrentQR();
      
      if (!qr) {
        return res.status(404).json({ 
          error: "No QR code available. WhatsApp may already be connected or not initialized yet." 
        });
      }
      
      res.json({ qr });
    } catch (error: any) {
      logger.error('Error getting QR code:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Sync chat types (identify and update groups)
  app.post("/api/whatsapp/sync-chat-types", async (req, res) => {
    try {
      if (!whatsappService.isConnected()) {
        return res.status(503).json({ 
          error: "WhatsApp is not connected" 
        });
      }

      const result = await whatsappService.syncChatTypes();
      res.json(result);
    } catch (error: any) {
      logger.error('Error syncing chat types:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get WhatsApp profile picture
  app.get("/api/whatsapp/profile-picture/:phone",  async (req, res) => {
    try {
      const { phone } = req.params;
      
      if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      
      const profilePicUrl = await whatsappService.getProfilePicture(phone);
      
      if (!profilePicUrl) {
        return res.json({ profilePicUrl: null });
      }
      
      res.json({ profilePicUrl });
    } catch (error: any) {
      logger.error('Error getting profile picture:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send WhatsApp message
  app.post("/api/whatsapp/send",  async (req, res) => {
    try {
      const { candidateId, phone, message } = req.body;

      // Validate input
      if (!phone || !message) {
        return res.status(400).json({ 
          error: "Phone and message are required" 
        });
      }

      // Normalize phone number ONCE at the beginning for all operations
      const normalizedPhone = whatsappService.formatPhoneNumber(phone);

      // Validate candidateId if provided
      if (candidateId) {
        const candidate = await storage.getCandidate(candidateId);
        if (!candidate) {
          return res.status(404).json({ 
            error: "Candidate not found" 
          });
        }
      }

      // Check if WhatsApp is connected
      if (!whatsappService.isConnected()) {
        return res.status(503).json({ 
          error: "WhatsApp is not connected",
          status: whatsappService.getStatus()
        });
      }

      // Create pending message record in database with normalized phone
      let messageRecord;
      if (candidateId) {
        messageRecord = await storage.createWhatsappMessage({
          candidateId,
          phone: normalizedPhone,
          message,
          status: 'pending',
          direction: 'outgoing',
        });
      }

      // Send message via WhatsApp using normalized phone
      try {
        const result = await whatsappService.sendMessage(normalizedPhone, message);
        
        // Update message status to sent
        if (messageRecord) {
          await storage.updateWhatsappMessageStatus(
            messageRecord.id,
            'sent',
            new Date()
          );
        }

        res.json({ 
          success: true, 
          phone: result.phone,
          messageId: messageRecord?.id 
        });
      } catch (sendError: any) {
        // Update message status to failed
        if (messageRecord) {
          await storage.updateWhatsappMessageStatus(
            messageRecord.id,
            'failed',
            undefined,
            sendError.message
          );
        }
        throw sendError;
      }
    } catch (error: any) {
      logger.error('Error sending WhatsApp message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Disconnect from WhatsApp
  app.post("/api/whatsapp/disconnect",  async (req, res) => {
    try {
      await whatsappService.disconnect();
      res.json({ success: true, message: 'WhatsApp disconnected successfully' });
    } catch (error: any) {
      logger.error('Error disconnecting WhatsApp:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reconnect to WhatsApp
  app.post("/api/whatsapp/connect",  async (req, res) => {
    try {
      await whatsappService.connect();
      res.json({ success: true, message: 'WhatsApp connection initiated' });
    } catch (error: any) {
      logger.error('Error connecting WhatsApp:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Message History Routes ====================

  // Get all messages
  app.get("/api/messages",  async (req, res) => {
    try {
      const messages = await storage.getAllWhatsappMessages();
      res.json(messages);
    } catch (error: any) {
      logger.error('Error getting messages:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get messages for a specific candidate
  app.get("/api/messages/candidate/:candidateId",  async (req, res) => {
    try {
      const { candidateId } = req.params;
      const messages = await storage.getWhatsappMessagesByCandidate(candidateId);
      res.json(messages);
    } catch (error: any) {
      logger.error('Error getting candidate messages:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== Candidate Routes ====================

  // Get all candidates
  app.get("/api/candidates",  async (req, res) => {
    try {
      const candidates = await storage.getAllCandidates();
      res.json(candidates);
    } catch (error: any) {
      logger.error('Error getting candidates:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get candidate by ID
  app.get("/api/candidates/:id",  async (req, res) => {
    try {
      const { id } = req.params;
      const candidate = await storage.getCandidate(id);
      
      if (!candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }
      
      res.json(candidate);
    } catch (error: any) {
      logger.error('Error getting candidate:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create new candidate
  app.post("/api/candidates",  async (req, res) => {
    try {
      const validatedData = insertCandidateSchema.parse(req.body);
      const candidate = await storage.createCandidate(validatedData);
      res.status(201).json(candidate);
    } catch (error: any) {
      logger.error('Error creating candidate:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Update candidate
  app.patch("/api/candidates/:id",  async (req, res) => {
    try {
      const { id } = req.params;
      const candidate = await storage.updateCandidate(id, req.body);
      
      if (!candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }
      
      res.json(candidate);
    } catch (error: any) {
      logger.error('Error updating candidate:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Delete candidate
  app.delete("/api/candidates/:id",  async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCandidate(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Candidate not found" });
      }
      
      res.json({ success: true, message: "Candidate deleted successfully" });
    } catch (error: any) {
      logger.error('Error deleting candidate:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
