import nodemailer from 'nodemailer';
import logger from '../utils/logger';

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  adminEmail: string;
}

class NotificationService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;

  initialize() {
    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!host || !port || !user || !pass || !adminEmail) {
      logger.warn('Email configuration not complete. Email notifications will be disabled.');
      return;
    }

    this.config = {
      host,
      port: parseInt(port),
      user,
      pass,
      adminEmail,
    };

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.port === 465,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    });

    logger.info('Email notification service initialized');
  }

  async sendConnectionFailureAlert(reason: string) {
    if (!this.transporter || !this.config) {
      logger.warn('Email not configured, skipping notification');
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.config.user,
        to: this.config.adminEmail,
        subject: '⚠️ WhatsApp Connection Failed',
        html: `
          <h2>WhatsApp Connection Alert</h2>
          <p>The WhatsApp connection has failed and requires attention.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <hr>
          <p>Please check the server logs and restart the WhatsApp service if needed.</p>
        `,
      });

      logger.info('Connection failure email sent to admin');
    } catch (error) {
      logger.error('Failed to send email notification:', error);
    }
  }

  async sendReauthenticationRequired() {
    if (!this.transporter || !this.config) {
      logger.warn('Email not configured, skipping notification');
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.config.user,
        to: this.config.adminEmail,
        subject: '🔐 WhatsApp Re-authentication Required',
        html: `
          <h2>WhatsApp Re-authentication Required</h2>
          <p>The WhatsApp session has expired and needs to be re-authenticated.</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <hr>
          <p><strong>Action Required:</strong></p>
          <ol>
            <li>Access the server console</li>
            <li>Scan the QR code with your WhatsApp app</li>
            <li>The system will automatically reconnect</li>
          </ol>
          <p><em>Note: You may need to delete the auth_info directory before scanning the QR code.</em></p>
        `,
      });

      logger.info('Re-authentication email sent to admin');
    } catch (error) {
      logger.error('Failed to send email notification:', error);
    }
  }

  async sendConnectionRestored() {
    if (!this.transporter || !this.config) {
      logger.warn('Email not configured, skipping notification');
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.config.user,
        to: this.config.adminEmail,
        subject: '✅ WhatsApp Connection Restored',
        html: `
          <h2>WhatsApp Connection Restored</h2>
          <p>The WhatsApp connection has been successfully restored.</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <hr>
          <p>The system is now ready to send and receive messages.</p>
        `,
      });

      logger.info('Connection restored email sent to admin');
    } catch (error) {
      logger.error('Failed to send email notification:', error);
    }
  }
}

export const notificationService = new NotificationService();
