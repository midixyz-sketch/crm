import makeWASocket, { 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion,
  DisconnectReason,
  WASocket,
  ConnectionState,
  WAMessage,
  proto
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import logger from '../../utils/logger';
import { notificationService } from '../notifications';
import path from 'path';
import { db } from '../../db';
import { candidates, whatsappMessages } from '../../../shared/schema';
import { eq } from 'drizzle-orm';

const SESSION_PATH = path.join(process.cwd(), 'auth_info');
const MAX_RECONNECT_ATTEMPTS = parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '5');
const RECONNECT_INTERVAL = 5000; // 5 seconds

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface MessageQueue {
  phone: string;
  lastSent: number;
}

class WhatsAppService {
  private sock: WASocket | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private reconnectAttempts: number = 0;
  private messageQueue: Map<string, number> = new Map();
  private isInitializing: boolean = false;
  private currentQR: string | null = null;

  getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  isConnected(): boolean {
    return this.connectionStatus === 'connected' && this.sock !== null;
  }

  async connect(): Promise<void> {
    if (this.isInitializing) {
      logger.warn('WhatsApp connection already initializing, skipping...');
      return;
    }

    try {
      this.isInitializing = true;
      this.connectionStatus = 'connecting';
      
      logger.info('Initializing WhatsApp connection...');
      
      const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        printQRInTerminal: true,
        auth: state,
        defaultQueryTimeoutMs: undefined,
        keepAliveIntervalMs: 30000,
        syncFullHistory: true,
        getMessage: async (key) => {
          // Return undefined to let Baileys handle message retrieval
          return undefined as any;
        },
        logger: {
          level: 'silent',
          fatal: () => {},
          error: () => {},
          warn: () => {},
          info: () => {},
          debug: () => {},
          trace: () => {},
          child: () => ({
            level: 'silent',
            fatal: () => {},
            error: () => {},
            warn: () => {},
            info: () => {},
            debug: () => {},
            trace: () => {},
          }),
        } as any,
      });

      this.sock.ev.on("creds.update", saveCreds);

      this.sock.ev.on("connection.update", async (update) => {
        await this.handleConnectionUpdate(update);
      });

      this.sock.ev.on("messages.upsert", async (m) => {
        logger.info(`📬 messages.upsert event received, type: ${m.type}, messages count: ${m.messages.length}`);
        await this.handleIncomingMessages(m);
      });

      // Listen for history sync
      this.sock.ev.on("messaging-history.set", async ({ chats, contacts, messages, isLatest }) => {
        logger.info(`📚 History sync received - chats: ${chats.length}, contacts: ${contacts.length}, messages: ${messages.length}, isLatest: ${isLatest}`);
        await this.handleHistorySync({ chats, contacts, messages, isLatest });
      });

      logger.info('WhatsApp event listeners registered');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp connection:', error);
      this.connectionStatus = 'disconnected';
      this.isInitializing = false;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  private async handleConnectionUpdate(update: Partial<ConnectionState>) {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      this.currentQR = qr;
      logger.info('📱 QR Code generated - please scan with WhatsApp');
      console.log('\n\n📱 Scan the QR code above with your WhatsApp app\n\n');
    }
    
    if (connection === "open") {
      logger.info('✅ WhatsApp connected successfully!');
      this.connectionStatus = 'connected';
      this.currentQR = null; // Clear QR code after successful connection
      
      // Cache reconnect attempts before resetting to check if we should send restoration notification
      const hadReconnectAttempts = this.reconnectAttempts > 0;
      this.reconnectAttempts = 0;
      
      if (hadReconnectAttempts) {
        await notificationService.sendConnectionRestored();
      }

      // Sync chat types to identify groups
      setTimeout(async () => {
        try {
          logger.info('🔄 Syncing chat types...');
          const result = await this.syncChatTypes();
          logger.info(`✅ Chat types synced: ${result.updated} updated, ${result.groups} groups, ${result.individuals} individuals`);
        } catch (error) {
          logger.warn('Failed to sync chat types:', error);
        }
      }, 5000); // Wait 5 seconds after connection
    } else if (connection === "close") {
      this.connectionStatus = 'disconnected';
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      logger.warn(`❌ WhatsApp connection closed. Status code: ${statusCode}`);
      
      if (statusCode === DisconnectReason.loggedOut) {
        logger.error('🔐 WhatsApp logged out - QR code re-authentication required');
        await notificationService.sendReauthenticationRequired();
        
        // Clear auth state and reconnect to generate new QR
        logger.info('🔄 Clearing old authentication state and reconnecting...');
        try {
          const fs = await import('fs');
          const authPath = path.join(process.cwd(), 'auth_info');
          if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
            logger.info('✅ Old authentication state cleared');
          }
          
          // Reset reconnect attempts and try to connect again
          this.reconnectAttempts = 0;
          this.currentQR = null;
          
          // Wait a bit then reconnect
          setTimeout(async () => {
            try {
              await this.connect();
            } catch (error) {
              logger.error('Failed to reconnect after logout:', error);
            }
          }, 2000);
        } catch (error) {
          logger.error('Failed to clear auth state:', error);
        }
      } else if (shouldReconnect && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++;
        this.connectionStatus = 'reconnecting';
        
        logger.info(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        
        setTimeout(async () => {
          try {
            await this.connect();
          } catch (error) {
            logger.error('Reconnection attempt failed:', error);
          }
        }, RECONNECT_INTERVAL);
      } else if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        logger.error('❌ Max reconnection attempts reached');
        await notificationService.sendConnectionFailureAlert(
          `Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`
        );
      }
    }
  }

  private async handleIncomingMessages(m: { messages: WAMessage[]; type: string }) {
    try {
      for (const msg of m.messages) {
        // Extract message text from various message types
        let messageText = '';
        
        if (msg.message?.conversation) {
          messageText = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
          messageText = msg.message.extendedTextMessage.text;
        } else if (msg.message?.buttonsResponseMessage?.selectedButtonId) {
          // Handle button response (when user clicks interactive button)
          messageText = msg.message.buttonsResponseMessage.selectedButtonId;
        } else if (msg.message?.templateButtonReplyMessage?.selectedId) {
          // Handle template button response (alternative button format)
          messageText = msg.message.templateButtonReplyMessage.selectedId;
        }
        
        // Skip if no text extracted
        if (!messageText) continue;
        const remoteJid = msg.key.remoteJid;
        
        if (!remoteJid) continue;
        
        // Support both individual chats and groups
        const isGroup = remoteJid.includes('@g.us');
        const isIndividual = remoteJid.includes('@s.whatsapp.net');
        
        if (!isGroup && !isIndividual) continue;

        // Skip outgoing messages - they are already saved via API
        if (msg.key.fromMe) {
          logger.info(`⏭️ Skipping outgoing message (already saved via API)`);
          continue;
        }

        // Extract phone number or group ID - keep full JID for groups
        const phone = isGroup 
          ? remoteJid  // Keep full JID with @g.us for groups
          : remoteJid.replace('@s.whatsapp.net', '');
        const chatType = isGroup ? 'group' : 'individual';
        const direction = 'incoming';
        
        logger.info(`📥 ${direction} message from ${phone}: ${messageText.substring(0, 50)}...`);

        // Find or create candidate with this phone number
        let candidate = await db.query.candidates.findFirst({
          where: (candidates, { eq }) => eq(candidates.phone, phone)
        });

        if (!candidate) {
          // For groups, try to fetch the real group name from WhatsApp
          let candidateName: string;
          if (isGroup && this.sock) {
            try {
              const groupMetadata = await this.sock.groupMetadata(remoteJid);
              candidateName = groupMetadata.subject || `קבוצה ${phone.replace('@g.us', '')}`;
              logger.info(`📛 Fetched group name: ${candidateName}`);
            } catch (error) {
              logger.warn(`Failed to fetch group metadata for ${phone}, using default name`);
              candidateName = `קבוצה ${phone.replace('@g.us', '')}`;
            }
          } else {
            candidateName = `WhatsApp ${phone}`;
          }
          
          // Create new candidate
          const [newCandidate] = await db.insert(candidates).values({
            name: candidateName,
            phone: phone,
            email: null,
            status: 'new',
            chatType: chatType,
            notes: 'נוצר אוטומטית מהודעת WhatsApp'
          }).returning();
          
          candidate = newCandidate;
          logger.info(`✅ Created new candidate for ${phone}`);
        } else if (candidate.chatType !== chatType) {
          // Update existing candidate if chat type changed (e.g., discovered it's a group)
          await db.update(candidates)
            .set({ chatType: chatType })
            .where(eq(candidates.id, candidate.id));
          candidate.chatType = chatType;
          logger.info(`✅ Updated candidate ${phone} chat type to ${chatType}`);
        }

        // Save incoming message
        await db.insert(whatsappMessages).values({
          candidateId: candidate.id,
          phone: phone,
          message: messageText,
          status: 'delivered',
          direction,
          sentAt: new Date((msg.messageTimestamp as number) * 1000)
        });

        logger.info(`✅ Saved ${direction} message from ${phone}`);
      }
    } catch (error) {
      logger.error('Error handling incoming messages:', error);
    }
  }

  private async handleHistorySync({ chats, contacts, messages, isLatest }: any) {
    try {
      logger.info(`🔄 Processing history sync - ${messages.length} messages from ${chats.length} chats`);
      
      let savedMessages = 0;
      let createdCandidates = 0;

      for (const msg of messages) {
        // Skip if not a text message
        if (!msg.message?.conversation && !msg.message?.extendedTextMessage?.text) continue;

        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const remoteJid = msg.key.remoteJid;
        
        if (!remoteJid) continue;
        
        // Support both individual chats and groups
        const isGroup = remoteJid.includes('@g.us');
        const isIndividual = remoteJid.includes('@s.whatsapp.net');
        
        if (!isGroup && !isIndividual) continue;

        // Extract phone number or group ID - keep full JID for groups
        const phone = isGroup 
          ? remoteJid  // Keep full JID with @g.us for groups
          : remoteJid.replace('@s.whatsapp.net', '');
        const chatType = isGroup ? 'group' : 'individual';
        const direction = msg.key.fromMe ? 'outgoing' : 'incoming';

        try {
          // Find or create candidate
          let candidate = await db.query.candidates.findFirst({
            where: (candidates, { eq }) => eq(candidates.phone, phone)
          });

          if (!candidate) {
            // Try to get contact name from contacts list
            const contact = contacts.find((c: any) => c.id === remoteJid);
            const defaultName = isGroup ? `קבוצה ${phone.replace('@g.us', '')}` : `WhatsApp ${phone}`;
            const contactName = contact?.name || contact?.notify || defaultName;

            const [newCandidate] = await db.insert(candidates).values({
              name: contactName,
              phone: phone,
              email: null,
              status: 'new',
              chatType: chatType,
              notes: 'נוצר אוטומטית מהיסטוריית WhatsApp'
            }).returning();
            
            candidate = newCandidate;
            createdCandidates++;
          } else if (candidate.chatType !== chatType) {
            // Update existing candidate if chat type changed (e.g., discovered it's a group)
            await db.update(candidates)
              .set({ chatType: chatType })
              .where(eq(candidates.id, candidate.id));
            candidate.chatType = chatType;
            logger.info(`✅ Updated candidate ${phone} chat type to ${chatType}`);
          }

          // Check if message already exists (to avoid duplicates)
          const existingMessage = await db.query.whatsappMessages.findFirst({
            where: (whatsappMessages, { and, eq }) => and(
              eq(whatsappMessages.candidateId, candidate.id),
              eq(whatsappMessages.sentAt, new Date((msg.messageTimestamp as number) * 1000))
            )
          });

          if (!existingMessage) {
            await db.insert(whatsappMessages).values({
              candidateId: candidate.id,
              phone: phone,
              message: messageText,
              status: 'delivered',
              direction,
              sentAt: new Date((msg.messageTimestamp as number) * 1000)
            });
            
            savedMessages++;
          }
        } catch (error) {
          logger.warn(`Could not save message for ${phone}:`, error);
        }
      }

      logger.info(`✅ History sync complete - saved ${savedMessages} messages, created ${createdCandidates} candidates (isLatest: ${isLatest})`);
    } catch (error) {
      logger.error('Error handling history sync:', error);
    }
  }

  formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    phone = phone.replace(/\D/g, '');
    
    // Israeli phone number formatting
    if (phone.startsWith('0')) {
      // Replace leading 0 with 972
      phone = '972' + phone.substring(1);
    } else if (!phone.startsWith('972')) {
      // Add 972 if not present
      phone = '972' + phone;
    }
    
    return phone;
  }

  async sendMessage(phone: string, message: string): Promise<{ success: boolean; phone: string; error?: string }> {
    if (!this.isConnected()) {
      throw new Error('WhatsApp is not connected. Please wait for connection or re-authenticate.');
    }

    // Format phone number
    const formattedPhone = this.formatPhoneNumber(phone);
    
    // Check rate limiting
    const lastSent = this.messageQueue.get(formattedPhone);
    if (lastSent && Date.now() - lastSent < 3000) {
      throw new Error('Please wait 3 seconds between messages to the same number');
    }

    try {
      // Always send as regular text message (buttons don't work in Baileys 2024)
      await this.sock!.sendMessage(`${formattedPhone}@s.whatsapp.net`, { text: message });
      
      this.messageQueue.set(formattedPhone, Date.now());
      logger.info(`✅ Message sent to ${formattedPhone}`);
      
      return { success: true, phone: formattedPhone };
    } catch (error: any) {
      logger.error(`❌ Failed to send message to ${formattedPhone}:`, error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.sock) {
      logger.info('Disconnecting WhatsApp...');
      await this.sock.logout();
      this.sock = null;
      this.connectionStatus = 'disconnected';
      this.reconnectAttempts = 0;
      logger.info('WhatsApp disconnected successfully');
    }
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  async syncChatTypes(): Promise<{ updated: number; groups: number; individuals: number; created: number }> {
    if (!this.sock) {
      throw new Error('WhatsApp not connected');
    }

    try {
      // Get all groups from WhatsApp
      const chats = await this.sock.groupFetchAllParticipating();
      
      logger.info(`🔍 Found ${Object.keys(chats).length} groups in WhatsApp`);
      
      let updated = 0;
      let created = 0;
      let groups = 0;
      let individuals = 0;

      // Process all groups
      for (const [jid, chat] of Object.entries(chats)) {
        const phone = jid; // Keep full JID with @g.us
        const groupName = (chat as any).subject || jid.split('@')[0];
        
        logger.info(`Processing group: ${groupName} (${jid})`);
        
        // Find or create candidate for this group
        let candidate = await db.query.candidates.findFirst({
          where: (candidates, { eq }) => eq(candidates.phone, phone)
        });

        if (!candidate) {
          // Create new candidate for this group
          const [newCandidate] = await db.insert(candidates)
            .values({
              phone,
              name: groupName,
              chatType: 'group',
              status: 'active',
            })
            .returning();
          
          created++;
          groups++;
          logger.info(`✅ Created new group: ${groupName}`);
        } else if (candidate.chatType !== 'group') {
          // Update existing candidate to group type
          await db.update(candidates)
            .set({ chatType: 'group', name: groupName })
            .where(eq(candidates.id, candidate.id));
          updated++;
          groups++;
          logger.info(`✅ Updated ${phone} to group`);
        } else {
          // Just count existing groups
          groups++;
        }
      }

      // Count individuals
      const allCandidates = await db.query.candidates.findMany();
      individuals = allCandidates.filter(c => c.chatType === 'individual').length;

      logger.info(`✅ Chat types synced: ${created} created, ${updated} updated, ${groups} groups, ${individuals} individuals`);
      
      return { updated, created, groups, individuals };
    } catch (error) {
      logger.error('Error syncing chat types:', error);
      throw error;
    }
  }

  getCurrentQR(): string | null {
    return this.currentQR;
  }

  async getProfilePicture(phone: string): Promise<string | null> {
    if (!this.sock || !this.isConnected()) {
      return null;
    }

    try {
      // Format phone number for WhatsApp (add @s.whatsapp.net if not present)
      const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
      
      // Get profile picture URL
      const profilePicUrl = await this.sock.profilePictureUrl(jid, 'image');
      
      return profilePicUrl || null;
    } catch (error: any) {
      return null;
    }
  }

}

export const whatsappService = new WhatsAppService();
