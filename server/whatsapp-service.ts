import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  WAMessage,
  proto,
  Browsers,
  BaileysEventMap,
  downloadMediaMessage
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
  private initializationPromise: Promise<void> | null = null;
  private isInitializing: boolean = false;
  private currentQR: string | null = null;

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
    // If initialization is in progress, wait for it
    if (this.isInitializing) {
      logger.info('WhatsApp initialization already in progress, waiting for completion...');
      if (this.initializationPromise) {
        await this.initializationPromise;
      }
      return;
    }

    // If already connected, skip  
    if (this.state.isConnected) {
      logger.info('WhatsApp already connected, skipping initialization');
      return;
    }

    this.isInitializing = true;
    this.initializationPromise = this._initializeInternal(userId);
    
    try {
      await this.initializationPromise;
    } catch (error) {
      logger.error(`Failed to initialize WhatsApp: ${error}`);
      throw error;
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }

  private async _initializeInternal(userId: string): Promise<void> {
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

      // Create Baileys-compatible logger (stub with all required methods)
      const baileysLogger = {
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
        child: () => baileysLogger,
        level: 'silent'
      };

      // Create socket
      const socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger as any),
        },
        printQRInTerminal: true,
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: true,
        logger: baileysLogger as any,
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
            this.currentQR = qrImage;
            logger.info(`QR Code generated for user ${userId}`);
            // Emit with userId to prevent cross-user leakage
            whatsappEvents.emit('qr', { userId, qrCode: qrImage });

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
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          // Check if it's a conflict error
          const isConflict = lastDisconnect?.error?.message?.includes('conflict');
          
          logger.info(`Connection closed. Status: ${statusCode}, Reconnecting: ${shouldReconnect}, Conflict: ${isConflict}`);

          this.state.isConnected = false;
          this.state.qrCode = null;
          this.state.socket = null;
          // Emit with userId to prevent cross-user leakage
          whatsappEvents.emit('disconnected', { userId });

          // Update session in DB - use sessionId and userId to ensure we update the right session
          // This works whether existingSession was found or a new session was created
          await db.update(whatsappSessions)
            .set({ 
              isActive: false, 
              lastDisconnected: new Date(),
              updatedAt: new Date() 
            })
            .where(eq(whatsappSessions.sessionId, sessionId));

          // Don't reconnect on conflict - it means another instance is running
          if (shouldReconnect && !isConflict) {
            logger.info('Scheduling reconnection in 3 seconds...');
            setTimeout(() => this.initialize(userId), 3000);
          } else if (isConflict) {
            logger.warn('Connection closed due to conflict - another instance may be running. Not reconnecting.');
          }
        } else if (connection === 'open') {
          logger.info(`WhatsApp connection opened for user ${userId}`);
          this.state.isConnected = true;
          this.state.qrCode = null;
          this.currentQR = null;
          this.state.phoneNumber = socket.user?.id.split(':')[0] || null;
          // Emit with userId to prevent cross-user leakage
          whatsappEvents.emit('connected', { userId, phoneNumber: this.state.phoneNumber });

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

          let currentSession;
          if (existingSession) {
            await db.update(whatsappSessions)
              .set(sessionData)
              .where(eq(whatsappSessions.id, existingSession.id));
            currentSession = existingSession;
          } else {
            const [newSession] = await db.insert(whatsappSessions).values(sessionData).returning();
            currentSession = newSession;
          }

          // Don't delete chats on every connection - let natural sync handle updates
          logger.info('✅ WhatsApp connected - waiting for chats.set event to sync chats');
        }
      });

      // Handle credentials update
      socket.ev.on('creds.update', saveCreds);

      // Handle incoming messages
      socket.ev.on('messages.upsert', async ({ messages, type }) => {
        logger.info(`📨 messages.upsert: Received ${messages.length} messages, type: ${type}`);
        if (type === 'notify') {
          for (const message of messages) {
            logger.info(`Processing message from ${message.key.remoteJid}`);
            await this.handleIncomingMessage(message);
          }
        }
      });

      // Handle chats sync - Import existing chats when connected
      socket.ev.on('chats.set', async ({ chats }) => {
        try {
          logger.info(`📥 chats.set: Received ${chats.length} chats from WhatsApp`);
          
          // Log details about chat types
          const groupChats = chats.filter(c => c.id.endsWith('@g.us'));
          const individualChats = chats.filter(c => c.id.endsWith('@s.whatsapp.net'));
          logger.info(`📊 Chat breakdown: ${groupChats.length} groups, ${individualChats.length} individual chats`);
          
          const session = await db.query.whatsappSessions.findFirst({
            where: eq(whatsappSessions.sessionId, this.state.sessionId!)
          });

          if (!session) {
            logger.error('No session found for chat sync');
            return;
          }

          for (const chat of chats) {
            try {
              const remoteJid = chat.id;
              const name = chat.name || remoteJid.split('@')[0];
              const phoneNumber = remoteJid.split('@')[0];
              
              // Check if we have a candidate with this phone number
              const candidate = await db.query.candidates.findFirst({
                where: eq(candidates.mobile, phoneNumber)
              });

              // Check if chat already exists (filter by sessionId to avoid conflicts with old sessions)
              const existingChat = await db.query.whatsappChats.findFirst({
                where: (whatsappChats, { and, eq }) => and(
                  eq(whatsappChats.remoteJid, remoteJid),
                  eq(whatsappChats.sessionId, session.id)
                )
              });

              const lastMessageAt = chat.conversationTimestamp 
                ? new Date(Number(chat.conversationTimestamp) * 1000)
                : new Date();

              if (existingChat) {
                await db.update(whatsappChats)
                  .set({
                    name,
                    lastMessageAt,
                    unreadCount: chat.unreadCount || 0,
                    updatedAt: new Date()
                  })
                  .where(eq(whatsappChats.id, existingChat.id));
                
                // Update profile picture if not set
                if (!existingChat.profilePicUrl) {
                  this.updateChatProfilePicture(remoteJid).catch(err => 
                    logger.error(`Failed to fetch profile pic for ${remoteJid}: ${err}`)
                  );
                }
              } else {
                await db.insert(whatsappChats).values({
                  sessionId: session.id,
                  candidateId: candidate?.id || null,
                  remoteJid,
                  name,
                  isGroup: remoteJid.endsWith('@g.us'),
                  lastMessageAt,
                  lastMessagePreview: '',
                  unreadCount: chat.unreadCount || 0,
                });
                
                // Fetch profile picture in background
                this.updateChatProfilePicture(remoteJid).catch(err => 
                  logger.error(`Failed to fetch profile pic for ${remoteJid}: ${err}`)
                );
              }
            } catch (err) {
              logger.error(`Error syncing chat ${chat.id}: ${err}`);
            }
          }

          logger.info(`Successfully synced ${chats.length} chats`);
        } catch (error) {
          logger.error(`Error in chats.set handler: ${error}`);
        }
      });

      // Handle messaging history sync - Critical for importing ALL chats including individual ones
      socket.ev.on('messaging-history.set', async ({ chats, contacts, messages, isLatest }) => {
        try {
          logger.info(`📚 messaging-history.set: Received ${chats.length} chats, ${contacts.length} contacts, ${messages.length} messages (isLatest: ${isLatest})`);
          
          // Log chat types
          const groupChats = chats.filter((c: any) => c.id.endsWith('@g.us'));
          const individualChats = chats.filter((c: any) => c.id.endsWith('@s.whatsapp.net'));
          logger.info(`📊 History breakdown: ${groupChats.length} groups, ${individualChats.length} individual chats`);
          
          await this.handleHistorySync({ chats, contacts, messages, isLatest });
        } catch (error) {
          logger.error(`Error in messaging-history.set handler: ${error}`);
        }
      });

      // Handle individual chat updates
      socket.ev.on('chats.upsert', async (chats) => {
        try {
          const session = await db.query.whatsappSessions.findFirst({
            where: eq(whatsappSessions.sessionId, this.state.sessionId!)
          });

          if (!session) return;

          for (const chat of chats) {
            const remoteJid = chat.id;
            const name = chat.name || remoteJid.split('@')[0];
            const phoneNumber = remoteJid.split('@')[0];
            
            const candidate = await db.query.candidates.findFirst({
              where: eq(candidates.mobile, phoneNumber)
            });

            const existingChat = await db.query.whatsappChats.findFirst({
              where: (whatsappChats, { and, eq }) => and(
                eq(whatsappChats.remoteJid, remoteJid),
                eq(whatsappChats.sessionId, session.id)
              )
            });

            const lastMessageAt = chat.conversationTimestamp 
              ? new Date(Number(chat.conversationTimestamp) * 1000)
              : new Date();

            if (existingChat) {
              await db.update(whatsappChats)
                .set({
                  name,
                  lastMessageAt,
                  unreadCount: chat.unreadCount || 0,
                  updatedAt: new Date()
                })
                .where(eq(whatsappChats.id, existingChat.id));
              
              // Update profile picture if not set
              if (!existingChat.profilePicUrl) {
                this.updateChatProfilePicture(remoteJid).catch(err => 
                  logger.error(`Failed to fetch profile pic for ${remoteJid}: ${err}`)
                );
              }
            } else {
              await db.insert(whatsappChats).values({
                sessionId: session.id,
                candidateId: candidate?.id || null,
                remoteJid,
                name,
                isGroup: remoteJid.endsWith('@g.us'),
                lastMessageAt,
                lastMessagePreview: '',
                unreadCount: chat.unreadCount || 0,
              });
              
              // Fetch profile picture in background
              this.updateChatProfilePicture(remoteJid).catch(err => 
                logger.error(`Failed to fetch profile pic for ${remoteJid}: ${err}`)
              );
            }
          }
        } catch (error) {
          logger.error(`Error in chats.upsert handler: ${error}`);
        }
      });

      logger.info('WhatsApp service initialized successfully');
    } catch (error) {
      logger.error(`WhatsApp initialization error: ${error}`);
      throw error;
    }
  }

  /**
   * Download and save media from WhatsApp message
   */
  private async downloadAndSaveMedia(message: WAMessage): Promise<string | null> {
    try {
      const buffer = await downloadMediaMessage(
        message,
        'buffer',
        {},
        {
          logger: logger as any,
          reuploadRequest: this.state.socket!.updateMediaMessage
        }
      );

      if (!buffer) return null;

      // Create unique filename
      const timestamp = Date.now();
      const msg = message.message!;
      let extension = 'bin';
      
      if (msg.imageMessage) {
        extension = msg.imageMessage.mimetype?.split('/')[1] || 'jpg';
      } else if (msg.documentMessage) {
        const originalName = msg.documentMessage.fileName || '';
        const parts = originalName.split('.');
        if (parts.length > 1) {
          extension = parts[parts.length - 1];
        } else {
          extension = msg.documentMessage.mimetype?.split('/')[1] || 'pdf';
        }
      } else if (msg.videoMessage) {
        extension = msg.videoMessage.mimetype?.split('/')[1] || 'mp4';
      } else if (msg.audioMessage) {
        extension = msg.audioMessage.mimetype?.split('/')[1] || 'mp3';
      } else if (msg.stickerMessage) {
        extension = 'webp';
      }

      const filename = `whatsapp_${timestamp}.${extension}`;
      const filepath = path.join('uploads', 'whatsapp-media', filename);
      
      // Ensure directory exists
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Save file
      fs.writeFileSync(filepath, buffer);
      
      // Return relative URL
      return `/uploads/whatsapp-media/${filename}`;
    } catch (error) {
      logger.error(`Failed to download media: ${error}`);
      return null;
    }
  }

  /**
   * Sanitize string for PostgreSQL - removes invalid UTF-8 characters
   * Preserves empty strings and valid emojis, removes only unpaired surrogates
   */
  private sanitizeForDB(text: string | null | undefined): string | null {
    if (text === null || text === undefined) return null;
    if (text === '') return ''; // Preserve empty strings
    
    try {
      // Convert to code points array, filter out unpaired surrogates, then reconstruct
      const codePoints = Array.from(text);
      const sanitized = codePoints
        .filter((char) => {
          const code = char.codePointAt(0);
          if (code === undefined) return false;
          // Keep everything except unpaired surrogates (which are invalid in UTF-8)
          // Valid emoji use paired surrogates and will have code > 0xFFFF
          return code <= 0xD7FF || code >= 0xE000; // Skip surrogate range
        })
        .join('');
      
      // Normalize to canonical form for consistent storage
      return sanitized.normalize('NFC');
    } catch (error) {
      logger.warn(`Failed to sanitize text "${text?.substring(0, 50)}...", error: ${error}`);
      // Fallback: try simple replacement of null bytes which PostgreSQL doesn't like
      return text.replace(/\0/g, '');
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
        // Download image
        mediaUrl = await this.downloadAndSaveMedia(message);
      } else if (msg.documentMessage) {
        messageType = 'document';
        fileName = msg.documentMessage.fileName || null;
        caption = msg.documentMessage.caption || null;
        mimeType = msg.documentMessage.mimetype || null;
        fileSize = Number(msg.documentMessage.fileLength) || null;
        // Download document
        mediaUrl = await this.downloadAndSaveMedia(message);
      } else if (msg.audioMessage) {
        messageType = 'audio';
        mimeType = msg.audioMessage.mimetype || null;
        fileSize = Number(msg.audioMessage.fileLength) || null;
        // Download audio
        mediaUrl = await this.downloadAndSaveMedia(message);
      } else if (msg.videoMessage) {
        messageType = 'video';
        caption = msg.videoMessage.caption || null;
        mimeType = msg.videoMessage.mimetype || null;
        fileSize = Number(msg.videoMessage.fileLength) || null;
        // Download video
        mediaUrl = await this.downloadAndSaveMedia(message);
      } else if (msg.stickerMessage) {
        messageType = 'sticker';
        mimeType = msg.stickerMessage.mimetype || null;
        // Download sticker
        mediaUrl = await this.downloadAndSaveMedia(message);
      }

      // Get best available name for this contact
      const phoneNumber = remoteJid.split('@')[0];
      const senderName = await this.getBestContactName(remoteJid, message.pushName);
      
      // Check if we have a candidate with this phone number
      const candidate = await db.query.candidates.findFirst({
        where: eq(candidates.mobile, phoneNumber)
      });

      // Get current session
      const session = await db.query.whatsappSessions.findFirst({
        where: eq(whatsappSessions.sessionId, this.state.sessionId!)
      });

      // Save message to database with sanitized text fields
      await db.insert(whatsappMessages).values({
        messageId,
        sessionId: session?.id || null,
        candidateId: candidate?.id || null,
        fromMe,
        remoteJid,
        senderName: this.sanitizeForDB(senderName),
        messageType,
        messageText: this.sanitizeForDB(messageText),
        mediaUrl,
        fileName: this.sanitizeForDB(fileName),
        mimeType,
        fileSize,
        caption: this.sanitizeForDB(caption),
        timestamp,
        deliveryStatus: fromMe ? 'sent' : 'delivered', // Outgoing starts as 'sent', incoming is 'delivered'
        isRead: fromMe ? false : false,
      });

      // Update or create chat (must filter by sessionId to avoid updating old session chats)
      const existingChat = await db.query.whatsappChats.findFirst({
        where: (whatsappChats, { and, eq }) => and(
          eq(whatsappChats.remoteJid, remoteJid),
          eq(whatsappChats.sessionId, session?.id || null)
        )
      });

      if (existingChat) {
        // Update name if we have a better one (from pushName or candidate)
        const updateData: any = {
          lastMessageAt: timestamp,
          lastMessagePreview: messageText || caption || `[${messageType}]`,
          unreadCount: fromMe ? 0 : (existingChat.unreadCount || 0) + 1,
          updatedAt: new Date()
        };
        
        // If chat has no name, or if we have a better name from senderName
        if (!existingChat.name || (senderName && senderName !== existingChat.name && !senderName.match(/^\d+$/))) {
          updateData.name = senderName;
          logger.info(`📝 Updating chat name from "${existingChat.name}" to "${senderName}"`);
        }
        
        await db.update(whatsappChats)
          .set(updateData)
          .where(eq(whatsappChats.id, existingChat.id));
        
        // Update profile picture if not set
        if (!existingChat.profilePicUrl) {
          this.updateChatProfilePicture(remoteJid).catch(err => 
            logger.error(`Failed to fetch profile pic for ${remoteJid}: ${err}`)
          );
        }
      } else {
        // Get best name for new chat
        const chatName = await this.getBestContactName(remoteJid, message.pushName);
        
        await db.insert(whatsappChats).values({
          sessionId: session?.id || null,
          candidateId: candidate?.id || null,
          remoteJid,
          name: chatName,
          isGroup: remoteJid.endsWith('@g.us'),
          lastMessageAt: timestamp,
          lastMessagePreview: messageText || caption || `[${messageType}]`,
          unreadCount: fromMe ? 0 : 1,
        });
        
        // Fetch profile picture in background
        this.updateChatProfilePicture(remoteJid).catch(err => 
          logger.error(`Failed to fetch profile pic for ${remoteJid}: ${err}`)
        );
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
   * Get best available name for a contact
   * Priority: 1. Candidate name from DB, 2. Contact name/notify from WhatsApp, 3. pushName, 4. Phone number
   */
  private async getBestContactName(remoteJid: string, pushName?: string, contact?: any): Promise<string> {
    try {
      const phoneNumber = remoteJid.split('@')[0];
      
      // Try to get name from candidate database
      const candidate = await db.query.candidates.findFirst({
        where: eq(candidates.mobile, phoneNumber)
      });
      
      if (candidate && (candidate.firstName || candidate.lastName)) {
        const fullName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ');
        if (fullName.trim()) {
          logger.info(`📛 Using candidate name for ${phoneNumber}: ${fullName}`);
          return fullName;
        }
      }
      
      // Try contact name from WhatsApp
      if (contact?.name) {
        logger.info(`📛 Using contact name for ${phoneNumber}: ${contact.name}`);
        return contact.name;
      }
      
      // Try notify field from WhatsApp
      if (contact?.notify) {
        logger.info(`📛 Using notify name for ${phoneNumber}: ${contact.notify}`);
        return contact.notify;
      }
      
      // Try verifiedName from WhatsApp Business
      if (contact?.verifiedName) {
        logger.info(`📛 Using verified name for ${phoneNumber}: ${contact.verifiedName}`);
        return contact.verifiedName;
      }
      
      // Try pushName from message
      if (pushName) {
        logger.info(`📛 Using pushName for ${phoneNumber}: ${pushName}`);
        return pushName;
      }
      
      // Fallback to phone number
      logger.info(`📛 No name found for ${phoneNumber}, using phone number`);
      return phoneNumber;
    } catch (error) {
      logger.error(`Error getting contact name: ${error}`);
      return remoteJid.split('@')[0];
    }
  }

  /**
   * Handle messaging history sync - imports ALL chats including individual ones
   */
  private async handleHistorySync({ chats, contacts, messages, isLatest }: any): Promise<void> {
    try {
      logger.info(`🔄 Processing history sync - ${messages.length} messages from ${chats.length} chats`);
      
      // Get current session
      const session = await db.query.whatsappSessions.findFirst({
        where: eq(whatsappSessions.sessionId, this.state.sessionId!)
      });

      if (!session) {
        logger.error('No session found for history sync');
        return;
      }

      let savedChats = 0;
      let savedMessages = 0;

      // Process all chats from history
      for (const chat of chats) {
        try {
          const remoteJid = chat.id;
          const isGroup = remoteJid.endsWith('@g.us');
          const isIndividual = remoteJid.endsWith('@s.whatsapp.net');
          
          if (!isGroup && !isIndividual) continue;

          // Get contact name from contacts list
          const contact = contacts.find((c: any) => c.id === remoteJid);
          const phoneNumber = remoteJid.split('@')[0];
          
          // For groups, use chat name if available
          let chatName: string;
          if (isGroup) {
            chatName = chat.name || `קבוצה ${phoneNumber}`;
          } else {
            // For individual chats, use best available name
            chatName = await this.getBestContactName(remoteJid, undefined, contact);
          }

          // Check if chat already exists (filter by sessionId to avoid conflicts with old sessions)
          const existingChat = await db.query.whatsappChats.findFirst({
            where: (whatsappChats, { and, eq }) => and(
              eq(whatsappChats.remoteJid, remoteJid),
              eq(whatsappChats.sessionId, session.id)
            )
          });

          // Check if we have a candidate with this phone number
          const candidate = await db.query.candidates.findFirst({
            where: eq(candidates.mobile, phoneNumber)
          });

          const lastMessageAt = chat.conversationTimestamp 
            ? new Date(Number(chat.conversationTimestamp) * 1000)
            : new Date();

          if (existingChat) {
            // Update existing chat
            await db.update(whatsappChats)
              .set({
                name: chatName,
                lastMessageAt,
                unreadCount: chat.unreadCount || 0,
                updatedAt: new Date()
              })
              .where(eq(whatsappChats.id, existingChat.id));
          } else {
            // Create new chat
            await db.insert(whatsappChats).values({
              sessionId: session.id,
              candidateId: candidate?.id || null,
              remoteJid,
              name: chatName,
              isGroup,
              lastMessageAt,
              lastMessagePreview: '',
              unreadCount: chat.unreadCount || 0,
            });
            
            savedChats++;
          }

          // Fetch profile picture in background (don't await)
          this.updateChatProfilePicture(remoteJid).catch(err => 
            logger.error(`Failed to fetch profile pic for ${remoteJid}: ${err}`)
          );
        } catch (error) {
          logger.error(`Error syncing chat ${chat.id}: ${error}`);
        }
      }

      // Process messages from history
      for (const msg of messages) {
        try {
          // Skip if not a text message
          if (!msg.message?.conversation && !msg.message?.extendedTextMessage?.text) continue;

          const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
          const remoteJid = msg.key.remoteJid;
          
          if (!remoteJid) continue;
          
          const isGroup = remoteJid.includes('@g.us');
          const isIndividual = remoteJid.includes('@s.whatsapp.net');
          
          if (!isGroup && !isIndividual) continue;

          const phoneNumber = remoteJid.split('@')[0];
          const direction = msg.key.fromMe ? true : false;
          const timestamp = new Date((msg.messageTimestamp as number) * 1000);

          // Find candidate
          const candidate = await db.query.candidates.findFirst({
            where: eq(candidates.mobile, phoneNumber)
          });

          // Check if message already exists (to avoid duplicates)
          const existingMessage = await db.query.whatsappMessages.findFirst({
            where: (whatsappMessages, { and, eq }) => and(
              eq(whatsappMessages.remoteJid, remoteJid),
              eq(whatsappMessages.timestamp, timestamp)
            )
          });

          if (!existingMessage) {
            await db.insert(whatsappMessages).values({
              messageId: msg.key.id || `hist_${Date.now()}`,
              sessionId: session.id,
              candidateId: candidate?.id || null,
              fromMe: direction,
              remoteJid,
              senderName: this.sanitizeForDB(msg.pushName || phoneNumber),
              messageType: 'text',
              messageText: this.sanitizeForDB(messageText),
              timestamp,
              isRead: direction,
            });
            
            savedMessages++;
          }
        } catch (error) {
          logger.warn(`Could not save message from history: ${error}`);
        }
      }

      logger.info(`✅ History sync complete - saved ${savedChats} new chats, ${savedMessages} messages (isLatest: ${isLatest})`);
    } catch (error) {
      logger.error(`Error in handleHistorySync: ${error}`);
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
        messageText: this.sanitizeForDB(text),
        timestamp: new Date(),
        deliveryStatus: 'sent', // Start with 'sent', will update to 'delivered' when we get receipt
        isRead: false,
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
   * Get profile picture URL for a contact
   */
  async getProfilePicture(jid: string): Promise<string | null> {
    try {
      if (!this.state.socket || !this.state.isConnected) {
        throw new Error('WhatsApp not connected');
      }

      const profilePicUrl = await this.state.socket.profilePictureUrl(jid, 'image');
      return profilePicUrl || null;
    } catch (error) {
      logger.error(`Error getting profile picture for ${jid}: ${error}`);
      return null;
    }
  }

  /**
   * Update chat with profile picture - async helper
   */
  private async updateChatProfilePicture(remoteJid: string): Promise<void> {
    try {
      // Add delay to ensure socket is fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Double-check connection before fetching
      if (!this.state.socket || !this.state.isConnected) {
        logger.warn(`Skipping profile picture for ${remoteJid} - not connected`);
        return;
      }
      
      // Fetch profile picture in background
      const profilePicUrl = await this.getProfilePicture(remoteJid);
      
      if (profilePicUrl) {
        // Update chat with profile picture
        await db.update(whatsappChats)
          .set({ profilePicUrl, updatedAt: new Date() })
          .where(eq(whatsappChats.remoteJid, remoteJid));
        
        logger.info(`✅ Updated profile picture for ${remoteJid}`);
      } else {
        logger.info(`ℹ️ No profile picture available for ${remoteJid}`);
      }
    } catch (error) {
      // Don't throw - just log the error so chat operations continue
      logger.error(`❌ Failed to update profile picture for ${remoteJid}: ${error}`);
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.state.isConnected,
      qrCode: this.currentQR, // Use currentQR instead of state.qrCode
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
      this.currentQR = null;
      logger.info('Logged out from WhatsApp');
    } catch (error) {
      logger.error(`Error logging out: ${error}`);
      throw error;
    }
  }

  /**
   * Get current QR code (for frontend to display)
   */
  getCurrentQR(): string | null {
    return this.currentQR;
  }
}

// Multi-user WhatsApp Service Manager
class WhatsAppServiceManager {
  private services: Map<string, WhatsAppService> = new Map();

  /**
   * Get or create WhatsApp service instance for a specific user
   */
  getServiceForUser(userId: string): WhatsAppService {
    if (!this.services.has(userId)) {
      logger.info(`Creating new WhatsApp service instance for user ${userId}`);
      this.services.set(userId, new WhatsAppService());
    }
    return this.services.get(userId)!;
  }

  /**
   * Remove WhatsApp service instance for a user (on logout)
   */
  async removeServiceForUser(userId: string): Promise<void> {
    const service = this.services.get(userId);
    if (service) {
      try {
        await service.logout();
      } catch (error) {
        logger.error(`Error logging out user ${userId}: ${error}`);
      }
      this.services.delete(userId);
      logger.info(`Removed WhatsApp service for user ${userId}`);
    }
  }

  /**
   * Get all active user IDs with WhatsApp connections
   */
  getActiveUsers(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get status for all users (for admin dashboard)
   */
  getAllStatuses(): Map<string, any> {
    const statuses = new Map();
    this.services.forEach((service, userId) => {
      statuses.set(userId, service.getStatus());
    });
    return statuses;
  }
}

// Export the multi-user service manager
export const whatsappServiceManager = new WhatsAppServiceManager();

// For backward compatibility during migration - will be removed
export const whatsappService = whatsappServiceManager.getServiceForUser('default');
