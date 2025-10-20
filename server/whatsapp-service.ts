import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  WAMessage,
  proto,
  Browsers,
  BaileysEventMap
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { db } from './db';
import {
  whatsappSessions,
  whatsappMessages,
  whatsappChats,
  candidates,
} from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'whatsapp.log' })
  ]
});

// Events for the WhatsApp service
export const whatsappEvents = new EventEmitter();

interface WhatsAppServiceState {
  socket: WASocket | null;
  qrCode: string | null;
  isConnected: boolean;
  phoneNumber: string | null;
  sessionId: string | null;
  userId: string | null;
}

class WhatsAppService {
  private state: WhatsAppServiceState = {
    socket: null,
    qrCode: null,
    isConnected: false,
    phoneNumber: null,
    sessionId: null,
    userId: null,
  };

  private authDir = path.join(process.cwd(), 'whatsapp_auth');

  constructor() {
    // Ensure auth directory exists
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  /**
   * Initialize WhatsApp connection for a user
   */
  async initialize(userId: string): Promise<void> {
    try {
      logger.info(`Initializing WhatsApp for user ${userId}`);
      
      // Check if session exists in DB
      const existingSession = await db.query.whatsappSessions.findFirst({
        where: eq(whatsappSessions.userId, userId),
        orderBy: [desc(whatsappSessions.createdAt)]
      });

      const sessionId = existingSession?.sessionId || `session_${userId}`;
      this.state.sessionId = sessionId;
      this.state.userId = userId;

      // Create session directory
      const sessionDir = path.join(this.authDir, sessionId);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      // Load auth state
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      
      // Get latest Baileys version
      const { version } = await fetchLatestBaileysVersion();

      // Create socket
      const socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger as any),
        },
        printQRInTerminal: true,
        browser: Browsers.macOS('Desktop'),
        getMessage: async (key) => {
          return undefined;
        }
      });

      this.state.socket = socket;

      // Handle connection updates
      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          // Generate QR code
          try {
            const qrImage = await QRCode.toDataURL(qr);
            this.state.qrCode = qrImage;
            logger.info('QR Code generated');
            whatsappEvents.emit('qr', qrImage);

            // Update session in DB
            if (existingSession) {
              await db.update(whatsappSessions)
                .set({ qrCode: qrImage, updatedAt: new Date() })
                .where(eq(whatsappSessions.id, existingSession.id));
            } else {
              await db.insert(whatsappSessions).values({
                sessionId,
                userId,
                qrCode: qrImage,
                isActive: false,
              });
            }
          } catch (err) {
            logger.error(`QR code generation error: ${err}`);
          }
        }

        if (connection === 'close') {
          const shouldReconnect = 
            (lastDisconnect?.error as Boom)?.output?.statusCode !== 
            DisconnectReason.loggedOut;

          logger.info(`Connection closed. Reconnecting: ${shouldReconnect}`);

          this.state.isConnected = false;
          this.state.qrCode = null;
          whatsappEvents.emit('disconnected');

          // Update session in DB
          if (existingSession) {
            await db.update(whatsappSessions)
              .set({ 
                isActive: false, 
                lastDisconnected: new Date(),
                updatedAt: new Date() 
              })
              .where(eq(whatsappSessions.id, existingSession.id));
          }

          if (shouldReconnect) {
            setTimeout(() => this.initialize(userId), 3000);
          }
        } else if (connection === 'open') {
          logger.info('WhatsApp connection opened');
          this.state.isConnected = true;
          this.state.qrCode = null;
          this.state.phoneNumber = socket.user?.id.split(':')[0] || null;
          whatsappEvents.emit('connected', this.state.phoneNumber);

          // Update or create session in DB
          const sessionData = {
            sessionId,
            userId,
            authState: state.creds as any,
            isActive: true,
            lastConnected: new Date(),
            phoneNumber: this.state.phoneNumber,
            qrCode: null,
            updatedAt: new Date()
          };

          if (existingSession) {
            await db.update(whatsappSessions)
              .set(sessionData)
              .where(eq(whatsappSessions.id, existingSession.id));
          } else {
            await db.insert(whatsappSessions).values(sessionData);
          }
        }
      });

      // Handle credentials update
      socket.ev.on('creds.update', saveCreds);

      // Handle incoming messages
      socket.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
          for (const message of messages) {
            await this.handleIncomingMessage(message);
          }
        }
      });

      logger.info('WhatsApp service initialized successfully');
    } catch (error) {
      logger.error(`WhatsApp initialization error: ${error}`);
      throw error;
    }
  }

  /**
   * Handle incoming WhatsApp message
   */
  private async handleIncomingMessage(message: WAMessage): Promise<void> {
    try {
      if (!message.message) return;

      const messageKey = message.key;
      const remoteJid = messageKey.remoteJid!;
      const fromMe = messageKey.fromMe || false;
      const messageId = messageKey.id!;
      const timestamp = message.messageTimestamp 
        ? new Date(Number(message.messageTimestamp) * 1000)
        : new Date();

      // Extract message content
      let messageType = 'text';
      let messageText: string | null = null;
      let mediaUrl: string | null = null;
      let fileName: string | null = null;
      let mimeType: string | null = null;
      let fileSize: number | null = null;
      let caption: string | null = null;

      const msg = message.message;

      if (msg.conversation) {
        messageText = msg.conversation;
      } else if (msg.extendedTextMessage) {
        messageText = msg.extendedTextMessage.text || null;
      } else if (msg.imageMessage) {
        messageType = 'image';
        caption = msg.imageMessage.caption || null;
        mimeType = msg.imageMessage.mimetype || null;
        fileSize = Number(msg.imageMessage.fileLength) || null;
      } else if (msg.documentMessage) {
        messageType = 'document';
        fileName = msg.documentMessage.fileName || null;
        caption = msg.documentMessage.caption || null;
        mimeType = msg.documentMessage.mimetype || null;
        fileSize = Number(msg.documentMessage.fileLength) || null;
      } else if (msg.audioMessage) {
        messageType = 'audio';
        mimeType = msg.audioMessage.mimetype || null;
        fileSize = Number(msg.audioMessage.fileLength) || null;
      } else if (msg.videoMessage) {
        messageType = 'video';
        caption = msg.videoMessage.caption || null;
        mimeType = msg.videoMessage.mimetype || null;
        fileSize = Number(msg.videoMessage.fileLength) || null;
      } else if (msg.stickerMessage) {
        messageType = 'sticker';
        mimeType = msg.stickerMessage.mimetype || null;
      }

      // Get sender name
      const senderName = message.pushName || remoteJid.split('@')[0];

      // Check if we have a candidate with this phone number
      const phoneNumber = remoteJid.split('@')[0];
      const candidate = await db.query.candidates.findFirst({
        where: eq(candidates.mobile, phoneNumber)
      });

      // Get current session
      const session = await db.query.whatsappSessions.findFirst({
        where: eq(whatsappSessions.sessionId, this.state.sessionId!)
      });

      // Save message to database
      await db.insert(whatsappMessages).values({
        messageId,
        sessionId: session?.id || null,
        candidateId: candidate?.id || null,
        fromMe,
        remoteJid,
        senderName,
        messageType,
        messageText,
        mediaUrl,
        fileName,
        mimeType,
        fileSize,
        caption,
        timestamp,
        isRead: fromMe,
      });

      // Update or create chat
      const existingChat = await db.query.whatsappChats.findFirst({
        where: eq(whatsappChats.remoteJid, remoteJid)
      });

      if (existingChat) {
        await db.update(whatsappChats)
          .set({
            lastMessageAt: timestamp,
            lastMessagePreview: messageText || caption || `[${messageType}]`,
            unreadCount: fromMe ? 0 : (existingChat.unreadCount || 0) + 1,
            updatedAt: new Date()
          })
          .where(eq(whatsappChats.id, existingChat.id));
      } else {
        await db.insert(whatsappChats).values({
          sessionId: session?.id || null,
          candidateId: candidate?.id || null,
          remoteJid,
          name: senderName,
          lastMessageAt: timestamp,
          lastMessagePreview: messageText || caption || `[${messageType}]`,
          unreadCount: fromMe ? 0 : 1,
        });
      }

      // Emit event for new message
      whatsappEvents.emit('message', {
        messageId,
        remoteJid,
        senderName,
        messageType,
        messageText,
        fileName,
        fromMe,
        timestamp,
        candidate,
      });

      logger.info(`Message saved: ${messageType} from ${senderName}`);
    } catch (error) {
      logger.error(`Error handling incoming message: ${error}`);
    }
  }

  /**
   * Send a text message
   */
  async sendMessage(to: string, text: string): Promise<boolean> {
    try {
      if (!this.state.socket || !this.state.isConnected) {
        throw new Error('WhatsApp not connected');
      }

      // Format phone number to JID
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

      // Send message
      const result = await this.state.socket.sendMessage(jid, {
        text
      });

      logger.info(`Message sent to ${jid}: ${text}`);

      // Save to database
      const session = await db.query.whatsappSessions.findFirst({
        where: eq(whatsappSessions.sessionId, this.state.sessionId!)
      });

      const candidate = await db.query.candidates.findFirst({
        where: eq(candidates.mobile, to.split('@')[0])
      });

      await db.insert(whatsappMessages).values({
        messageId: result.key.id!,
        sessionId: session?.id || null,
        candidateId: candidate?.id || null,
        fromMe: true,
        remoteJid: jid,
        senderName: 'Me',
        messageType: 'text',
        messageText: text,
        timestamp: new Date(),
        isRead: true,
      });

      return true;
    } catch (error) {
      logger.error(`Error sending message: ${error}`);
      return false;
    }
  }

  /**
   * Send a file
   */
  async sendFile(
    to: string, 
    filePath: string, 
    caption?: string,
    mimetype?: string
  ): Promise<boolean> {
    try {
      if (!this.state.socket || !this.state.isConnected) {
        throw new Error('WhatsApp not connected');
      }

      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

      // Read file
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);

      // Send document
      await this.state.socket.sendMessage(jid, {
        document: fileBuffer,
        fileName,
        caption,
        mimetype: mimetype || 'application/pdf',
      });

      logger.info(`File sent to ${jid}: ${fileName}`);
      return true;
    } catch (error) {
      logger.error(`Error sending file: ${error}`);
      return false;
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.state.isConnected,
      qrCode: this.state.qrCode,
      phoneNumber: this.state.phoneNumber,
      sessionId: this.state.sessionId,
    };
  }

  /**
   * Logout and disconnect
   */
  async logout(): Promise<void> {
    try {
      if (this.state.socket) {
        await this.state.socket.logout();
      }
      this.state = {
        socket: null,
        qrCode: null,
        isConnected: false,
        phoneNumber: null,
        sessionId: null,
        userId: null,
      };
      logger.info('Logged out from WhatsApp');
    } catch (error) {
      logger.error(`Error logging out: ${error}`);
      throw error;
    }
  }
}

// Singleton instance
export const whatsappService = new WhatsAppService();
