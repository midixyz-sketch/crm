import Imap from "imap";
import nodemailer from "nodemailer";
import { storage, extractTextFromCVFile } from "./storage";
import { insertCandidateSchema } from "../shared/schema";
import fs from "fs";
import path from "path";
import { simpleParser } from "mailparser";
import libphonenumber from 'google-libphonenumber';

// cPanel Email Configuration - Multiple attempts for different cPanel setups
const CPANEL_CONFIGS = [
  {
    name: "cPanel SSL (465/993)",
    imap: {
      user: "dolev@h-group.org.il",
      password: "hpm_7HqToCSs[H7,",
      host: "mail.h-group.org.il",
      port: 993,
      tls: true,
      authTimeout: 10000,
      connTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false },
    },
    smtp: {
      host: "mail.h-group.org.il",
      port: 465,
      secure: true,
      auth: {
        user: "dolev@h-group.org.il",
        pass: "hpm_7HqToCSs[H7,",
      },
      tls: { rejectUnauthorized: false },
    },
  },
  {
    name: "cPanel Standard (143/587)",
    imap: {
      user: "dolev@h-group.org.il",
      password: "hpm_7HqToCSs[H7,",
      host: "mail.h-group.org.il",
      port: 143,
      tls: false,
      authTimeout: 8000,
      connTimeout: 8000,
      tlsOptions: { rejectUnauthorized: false },
    },
    smtp: {
      host: "mail.h-group.org.il",
      port: 587,
      secure: false,
      auth: {
        user: "dolev@h-group.org.il",
        pass: "hpm_7HqToCSs[H7,",
      },
      tls: { rejectUnauthorized: false },
    },
  },
  {
    name: "Alternative Host",
    imap: {
      user: "dolev@h-group.org.il",
      password: "hpm_7HqToCSs[H7,",
      host: "h-group.org.il",
      port: 143,
      tls: false,
      authTimeout: 6000,
      connTimeout: 6000,
      tlsOptions: { rejectUnauthorized: false },
    },
    smtp: {
      host: "h-group.org.il",
      port: 587,
      secure: false,
      auth: {
        user: "dolev@h-group.org.il",
        pass: "hmp_7HqToCSs[H7,",
      },
      tls: { rejectUnauthorized: false },
    },
  },
];

// Test cPanel IMAP connection
export async function testCpanelImap(): Promise<boolean> {
  console.log("🔄 בדיקת חיבור cPanel IMAP...");

  return new Promise(async (resolve) => {
    // Load IMAP settings from database
    const { storage } = await import("./storage");
    const imapHost = await storage.getSystemSetting("INCOMING_EMAIL_HOST");
    const imapPort = await storage.getSystemSetting("INCOMING_EMAIL_PORT");
    const imapSecure = await storage.getSystemSetting("INCOMING_EMAIL_SECURE");
    const imapUser = await storage.getSystemSetting("INCOMING_EMAIL_USER");
    const imapPass = await storage.getSystemSetting("INCOMING_EMAIL_PASS");

    const imapConfig = {
      user: imapUser?.value || "dolev@h-group.org.il",
      password: imapPass?.value || "",
      host: imapHost?.value || "mail.h-group.org.il",
      port: parseInt(imapPort?.value || "993"),
      tls: imapSecure?.value === "true",
      authTimeout: 30000,
      connTimeout: 30000,
      socketTimeout: 30000,
      tlsOptions: {
        rejectUnauthorized: false,
        ciphers: "ALL",
      },
    };

    const imap = new Imap(imapConfig);
    let resolved = false;

    // Extended timeout for cPanel servers
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log("❌ Timeout בחיבור cPanel IMAP");
        resolve(false);
      }
    }, 20000);

    imap.once("ready", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.log("✅ חיבור cPanel IMAP הצליח!");

        // Test opening inbox
        imap.openBox("INBOX", false, (err, box) => {
          if (err) {
            console.error("❌ שגיאה בפתיחת תיבת דואר:", err.message);
          } else {
            console.log(`📧 נמצאו ${box.messages.total} מיילים בתיבת הדואר`);
          }
          imap.end();
          resolve(true);
        });
      }
    });

    imap.once("error", (err: any) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.error("❌ שגיאת cPanel IMAP:", err.message);
        resolve(false);
      }
    });

    imap.once("end", () => {
      console.log("📫 חיבור cPanel IMAP נסגר");
    });

    try {
      imap.connect();
    } catch (error: any) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.error("❌ שגיאה ביצירת חיבור cPanel:", error.message);
        resolve(false);
      }
    }
  });
}

// Test cPanel SMTP connection
export async function testCpanelSmtp(): Promise<boolean> {
  console.log("🔄 בדיקת חיבור cPanel SMTP...");

  try {
    // Load SMTP settings from database
    const { storage } = await import("./storage");
    const smtpHost = await storage.getSystemSetting("OUTGOING_EMAIL_HOST");
    const smtpPort = await storage.getSystemSetting("OUTGOING_EMAIL_PORT");
    const smtpSecure = await storage.getSystemSetting("OUTGOING_EMAIL_SECURE");
    const smtpUser = await storage.getSystemSetting("OUTGOING_EMAIL_USER");
    const smtpPass = await storage.getSystemSetting("OUTGOING_EMAIL_PASS");

    const smtpConfig = {
      host: smtpHost?.value || "mail.h-group.org.il",
      port: parseInt(smtpPort?.value || "465"),
      secure: smtpSecure?.value === "true",
      auth: {
        user: smtpUser?.value || "cv@h-group.org.il",
        pass: smtpPass?.value || "",
      },
      tls: { rejectUnauthorized: false },
    };

    const transporter = nodemailer.createTransport(smtpConfig);

    // Verify connection
    await transporter.verify();
    console.log("✅ חיבור cPanel SMTP הצליח!");
    return true;
  } catch (error: any) {
    console.error("❌ שגיאת cPanel SMTP:", error.message);
    return false;
  }
}

// Check for new emails in cPanel
export async function checkCpanelEmails(): Promise<void> {
  console.log("📧 בודק מיילים חדשים בcPanel...");

  return new Promise(async (resolve) => {
    // Load IMAP settings from database
    const { storage } = await import("./storage");
    const imapHost = await storage.getSystemSetting("INCOMING_EMAIL_HOST");
    const imapPort = await storage.getSystemSetting("INCOMING_EMAIL_PORT");
    const imapSecure = await storage.getSystemSetting("INCOMING_EMAIL_SECURE");
    const imapUser = await storage.getSystemSetting("INCOMING_EMAIL_USER");
    const imapPass = await storage.getSystemSetting("INCOMING_EMAIL_PASS");

    const imapConfig = {
      user: imapUser?.value || "dolev@h-group.org.il",
      password: imapPass?.value || "",
      host: imapHost?.value || "mail.h-group.org.il",
      port: parseInt(imapPort?.value || "993"),
      tls: imapSecure?.value === "true",
      authTimeout: 60000,
      connTimeout: 60000,
      keepalive: {
        interval: 10000,
        idleInterval: 300000,
        forceNoop: true,
      },
      tlsOptions: {
        rejectUnauthorized: false,
      },
    };

    const imap = new Imap(imapConfig);
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log("❌ Timeout בבדיקת מיילים");
        resolve();
      }
    }, 120000); // 2 minutes timeout for processing attachments

    imap.once("ready", () => {
      console.log("✅ מחובר לשרת cPanel");

      imap.openBox("INBOX", false, (err, box) => {
        if (err) {
          console.error("❌ שגיאה בפתיחת תיבת דואר:", err.message);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            imap.end();
            resolve();
          }
          return;
        }

        console.log(
          `📧 בוחן ${box.messages.total} מיילים סה"כ, לא נקראו: ${box.messages.unseen || 0}`,
        );

        if (box.messages.total === 0) {
          console.log("ℹ️ אין מיילים בתיבה");
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            imap.end();
            resolve();
          }
          return;
        }

        // First, let's see the last few emails to debug
        const lastEmailsCount = Math.min(3, box.messages.total);
        const startSeq = Math.max(1, box.messages.total - lastEmailsCount + 1);
        const debugFetch = imap.seq.fetch(`${startSeq}:${box.messages.total}`, {
          bodies: "HEADER.FIELDS (FROM DATE SUBJECT)",
        });

        debugFetch.on("message", (msg, seqno) => {
          msg.on("body", (stream) => {
            let buffer = "";
            stream.on("data", (chunk) => (buffer += chunk.toString()));
            stream.once("end", () => {
              const headers = Imap.parseHeader(buffer);
              console.log(
                `📧 מייל #${seqno}: מאת ${headers.from?.[0] || "לא ידוע"}, תאריך: ${headers.date?.[0] || "לא ידוע"}`,
              );
            });
          });
        });

        debugFetch.once("end", () => {
          // Search for emails from the last 24 hours (regardless of UNSEEN status)
          // This ensures we process emails even if they were read
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const dateStr = yesterday.toISOString().split('T')[0].replace(/-/g, '-'); // Format: DD-MMM-YYYY
          
          // Format date for IMAP: DD-Mon-YYYY (e.g., "19-Oct-2025")
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const day = yesterday.getDate();
          const month = months[yesterday.getMonth()];
          const year = yesterday.getFullYear();
          const imapDateStr = `${day}-${month}-${year}`;
          
          console.log(`🔍 מחפש מיילים מ-${imapDateStr} ואילך (כולל מיילים שכבר נקראו)`);
          
          // Search for emails since yesterday - IMAP needs the date as a separate element in a nested array
          imap.search([['SINCE', yesterday]], (err, results) => {
            if (err) {
              console.error("❌ שגיאה בחיפוש מיילים:", err.message);
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                imap.end();
                resolve();
              }
              return;
            }

            if (!results || results.length === 0) {
              console.log("ℹ️ אין מיילים חדשים");
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                imap.end();
                resolve();
              }
            } else {
              console.log(`🆕 נמצאו ${results.length} מיילים חדשים`);

              // Collect all processing promises
              const processingPromises: Promise<void>[] = [];

              // Process each new email
              const f = imap.fetch(results, {
                bodies: "", // Get full raw email with attachments
                markSeen: true, // Mark as seen after processing
              });

              let processedCount = 0;
              const totalEmails = results.length;

              f.on("message", (msg, seqno) => {
                console.log(`📨 מעבד מייל ${seqno}`);

                const chunks: Buffer[] = []; // Keep as Buffer to preserve attachments

                msg.on("body", (stream, info) => {
                  console.log(`📨 התחיל לקרוא גוף המייל...`);
                  stream.on("data", (chunk) => {
                    // Keep as Buffer - do NOT convert to string
                    chunks.push(chunk);
                    console.log(
                      `📦 התקבל chunk בגודל ${chunk.length} בתים (סה"כ ${chunks.length} chunks)`,
                    );
                  });
                  stream.once("end", () => {
                    console.log(
                      `✅ גוף המייל התקבל בשלמות - ${chunks.length} chunks`,
                    );
                    // Body is fully received, will process in msg.once('end')
                  });
                });

                msg.once("end", () => {
                  processedCount++;
                  console.log(
                    `✅ מייל ${seqno} נקרא (${processedCount}/${totalEmails})`,
                  );

                  // Process the email buffer directly
                  const processingPromise = (async () => {
                    try {
                      console.log("🔍 מעבד קובץ CV מהמייל...");

                      // Combine all chunks into a single Buffer
                      const fullEmailBuffer = Buffer.concat(chunks);
                      console.log(
                        `📊 גודל המייל: ${fullEmailBuffer.length} בתים, ${chunks.length} chunks`,
                      );

                      // Parse the full email with mailparser to extract attachments
                      const parsed = await simpleParser(fullEmailBuffer);
                      console.log(
                        `📧 המייל פוענח - יש ${parsed.attachments?.length || 0} קבצים מצורפים`,
                      );
                      console.log(`📮 מאת: ${parsed.from?.text}`);
                      console.log(`📋 נושא: ${parsed.subject}`);

                      if (
                        !parsed.attachments ||
                        parsed.attachments.length === 0
                      ) {
                        console.log("⚠️ לא נמצאו קבצים מצורפים במייל");
                        return;
                      }

                      console.log(
                        `📎 נמצאו ${parsed.attachments.length} קבצים מצורפים`,
                      );

                      // Process attachments
                      await processParsedEmailAttachments(parsed);
                      console.log(`✅ מייל ${seqno} עובד לגמרי`);
                    } catch (cvError) {
                      console.error("❌ שגיאה בעיבוד המייל:", cvError);
                    }
                  })();

                  processingPromises.push(processingPromise);
                });
              });

              f.once("end", async () => {
                console.log(
                  `⏳ ממתין לסיום עיבוד ${processingPromises.length} מיילים...`,
                );

                // Wait for ALL processing to complete before closing connection
                try {
                  await Promise.all(processingPromises);
                  console.log("✅ כל המיילים עובדו בהצלחה");
                } catch (err) {
                  console.error("❌ שגיאה בעיבוד מיילים:", err);
                }

                if (!resolved) {
                  resolved = true;
                  clearTimeout(timeout);
                  imap.end();
                  resolve();
                }
              });

              f.once("error", (err) => {
                console.error("❌ שגיאה בקבלת מיילים:", err.message);
                if (!resolved) {
                  resolved = true;
                  clearTimeout(timeout);
                  imap.end();
                  resolve();
                }
              });
            }
          });
        });
      });
    });

    imap.once("error", (err: any) => {
      console.error("❌ שגיאת חיבור cPanel:", err.message);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    imap.once("end", () => {
      console.log("📫 חיבור cPanel נסגר");
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    try {
      imap.connect();
    } catch (error: any) {
      console.error("❌ שגיאה ביצירת חיבור:", error.message);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve();
      }
    }
  });
}

// Send email using cPanel SMTP
export async function sendCpanelEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
): Promise<boolean> {
  console.log(`📤 שולח מייל דרך cPanel ל-${to}`);

  try {
    // Load SMTP settings from database
    const { storage } = await import("./storage");
    const smtpHost = await storage.getSystemSetting("OUTGOING_EMAIL_HOST");
    const smtpPort = await storage.getSystemSetting("OUTGOING_EMAIL_PORT");
    const smtpSecure = await storage.getSystemSetting("OUTGOING_EMAIL_SECURE");
    const smtpUser = await storage.getSystemSetting("OUTGOING_EMAIL_USER");
    const smtpPass = await storage.getSystemSetting("OUTGOING_EMAIL_PASS");

    const smtpConfig = {
      host: smtpHost?.value || "mail.h-group.org.il",
      port: parseInt(smtpPort?.value || "465"),
      secure: smtpSecure?.value === "true",
      auth: {
        user: smtpUser?.value || "cv@h-group.org.il",
        pass: smtpPass?.value || "",
      },
      tls: { rejectUnauthorized: false },
    };

    const transporter = nodemailer.createTransport(smtpConfig);

    const mailOptions = {
      from: smtpUser?.value || "dolev@h-group.org.il",
      to,
      subject,
      text,
      html: html || text,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("✅ מייל נשלח בהצלחה דרך cPanel:", result.messageId);
    return true;
  } catch (error: any) {
    console.error("❌ שגיאה בשליחת מייל דרך cPanel:", error.message);
    return false;
  }
}

// Start monitoring emails from cPanel
export function startCpanelEmailMonitoring() {
  console.log("🚀 מפעיל מעקב מיילים cPanel");

  // Check emails immediately
  checkCpanelEmails();

  // Then check every 60 seconds
  setInterval(() => {
    checkCpanelEmails().catch((err) => {
      console.error("❌ שגיאה במעקב מיילים cPanel:", err);
    });
  }, 60000);
}

// Test all cPanel email functionality - simplified to avoid Replit connection limits
export async function testAllCpanelEmail(): Promise<void> {
  console.log("🧪 בדיקה מלאה של מערכת cPanel...");

  // Only test IMAP to avoid connection limits - SMTP will be tested when actually sending
  const imapSuccess = await testCpanelImap();

  if (imapSuccess) {
    console.log("✅ מערכת cPanel IMAP מוכנה לעבודה!");
    startCpanelEmailMonitoring();
  } else {
    console.log("❌ בעיית חיבור cPanel IMAP - אולי מגבלת רשת זמנית");
    // Still try to start monitoring - maybe it will work later
    setTimeout(() => {
      console.log("🔄 ניסיון חוזר להפעלת מעקב מיילים...");
      startCpanelEmailMonitoring();
    }, 30000); // Try again in 30 seconds
  }
}

// Export function to reload cPanel configuration
export async function reloadCpanelConfig() {
  console.log("🔄 רענון הגדרות cPanel...");

  try {
    // Reload cPanel configurations from database
    const { storage } = await import("./storage");

    // Use INCOMING_EMAIL settings for IMAP (correct settings)
    const imapHost = await storage.getSystemSetting("INCOMING_EMAIL_HOST");
    const imapPort = await storage.getSystemSetting("INCOMING_EMAIL_PORT");
    const imapSecure = await storage.getSystemSetting("INCOMING_EMAIL_SECURE");
    const imapUser = await storage.getSystemSetting("INCOMING_EMAIL_USER");
    const imapPass = await storage.getSystemSetting("INCOMING_EMAIL_PASS");

    // Use OUTGOING_EMAIL settings for SMTP
    const smtpHost = await storage.getSystemSetting("OUTGOING_EMAIL_HOST");
    const smtpPort = await storage.getSystemSetting("OUTGOING_EMAIL_PORT");
    const smtpSecure = await storage.getSystemSetting("OUTGOING_EMAIL_SECURE");
    const smtpUser = await storage.getSystemSetting("OUTGOING_EMAIL_USER");
    const smtpPass = await storage.getSystemSetting("OUTGOING_EMAIL_PASS");

    if (imapHost?.value && imapUser?.value && imapPass?.value) {
      // Update CPANEL_CONFIGS with correct INCOMING/OUTGOING settings
      CPANEL_CONFIGS[0] = {
        name: "cPanel Database Config",
        smtp: {
          host: smtpHost?.value || "mail.h-group.org.il",
          port: parseInt(smtpPort?.value || "465"),
          secure: smtpSecure?.value === "true",
          auth: {
            user: smtpUser?.value || "cv@h-group.org.il",
            pass: smtpPass?.value || "",
          },
          tls: { rejectUnauthorized: false },
        },
        imap: {
          user: imapUser.value,
          password: imapPass.value,
          host: imapHost.value,
          port: parseInt(imapPort?.value || "993"),
          tls: imapSecure?.value === "true",
          authTimeout: 60000,
          connTimeout: 60000,
          tlsOptions: {
            rejectUnauthorized: false,
          },
        },
      };
      console.log("✅ הגדרות cPanel עודכנו עם הפרטים הנכונים");
      console.log(
        `📧 IMAP: ${imapUser.value}@${imapHost.value}:${imapPort?.value || "993"} (SSL: ${imapSecure?.value})`,
      );

      // Test the new configuration
      await testAllCpanelEmail();

      return true;
    } else {
      console.warn("⚠️ חסרים פרטי cPanel בבסיס הנתונים");
      return false;
    }
  } catch (error) {
    console.error("❌ שגיאה ברענון הגדרות cPanel:", error);
    return false;
  }
}

// Parse candidate data from CV text
// Common Hebrew first and last names for validation
const HEBREW_FIRST_NAMES = new Set([
  'אבי', 'אבישי', 'אדם', 'אהרון', 'אוהד', 'אור', 'אורי', 'אושר', 'איתי', 'איתן', 'אלי', 'אליה', 'אלעד', 'אמיר', 'אסף', 'אריאל', 'ארז', 'בועז', 'ברק', 'גיא', 'גל', 'גלעד', 'דוד', 'דולב', 'דור', 'דני', 'הדר', 'יאיר', 'יובל', 'יוגב', 'יוחאי', 'יוסי', 'יונתן', 'יותם', 'ירון', 'לירון', 'מאור', 'מיכאל', 'משה', 'נדב', 'ניר', 'נתן', 'עדי', 'עומר', 'עידן', 'עמית', 'ערן', 'רועי', 'רון', 'רונן', 'שי', 'שחר', 'תום', 'תומר',
  'אביבה', 'אביגיל', 'אדר', 'אהובה', 'אורלי', 'אורנה', 'איילת', 'אילנה', 'אלונה', 'ענבל', 'בר', 'ברכה', 'גלי', 'דנה', 'דפנה', 'הדר', 'הילה', 'ורד', 'חן', 'טל', 'יעל', 'כרמל', 'לאה', 'ליאור', 'לימור', 'מיכל', 'מירב', 'נועה', 'נטע', 'ניצן', 'סיגל', 'עדי', 'עדן', 'ענת', 'רונית', 'רחל', 'רינת', 'שיר', 'שירה', 'שרה', 'תמר'
]);

const HEBREW_LAST_NAMES = new Set([
  'כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'חן', 'אבוקסיס', 'פרידמן', 'אוחיון', 'דוד', 'אזולאי', 'אברהם', 'שמש', 'ששון', 'מלכה', 'אלבז', 'בן דוד', 'עמר', 'טל', 'בר', 'גבאי', 'מור', 'עזרא', 'אשכנזי', 'ברק', 'שלום', 'דהן', 'בנימין', 'מנשה', 'יוסף', 'חיים', 'שמואל', 'אהרון', 'יעקב', 'שטרית', 'בוסקילה', 'חדד', 'משה', 'עובדיה', 'ניסים', 'שושני', 'בוחבוט', 'שטרן', 'רוזנברג', 'גולדשטיין', 'גרינברג', 'קפלן', 'שניידר', 'לנדאו', 'ברנשטיין'
]);

// Exported wrapper function for bulk import
export function extractCandidateDataFromText(cvText: string, filename?: string): {
  name?: string;
  email?: string;
  mobile?: string;
  profession?: string;
} {
  const result = parseCVData(cvText);
  return {
    name: result.firstName && result.lastName ? `${result.firstName} ${result.lastName}` : undefined,
    email: result.email || undefined,
    mobile: result.mobile || undefined,
    profession: result.profession || undefined
  };
}

function parseCVData(cvText: string): {
  firstName: string;
  lastName: string;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  profession: string | null;
} {
  const result = {
    firstName: "",
    lastName: "",
    email: null as string | null,
    mobile: null as string | null,
    phone: null as string | null,
    profession: null as string | null,
  };

  if (!cvText || cvText.trim().length === 0) {
    return result;
  }

  // Normalize text - remove extra spaces, fix RTL issues
  const normalizedText = cvText
    .replace(/\s+/g, ' ')
    .replace(/[\u200E\u200F]/g, '') // Remove RTL/LTR marks
    .trim();

  // Extract email with improved pattern
  const emailPattern = /\b[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}\b/gi;
  const emailMatches = normalizedText.match(emailPattern);
  if (emailMatches && emailMatches.length > 0) {
    // Filter out common false positives and get the first valid email
    const validEmails = emailMatches.filter(email => 
      !email.toLowerCase().includes('example') && 
      !email.toLowerCase().includes('test') &&
      email.includes('.')
    );
    if (validEmails.length > 0) {
      result.email = validEmails[0].trim();
    }
  }

  // Extract phone numbers using google-libphonenumber for accuracy
  let phoneUtil, PhoneNumberFormat;
  try {
    phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
    PhoneNumberFormat = libphonenumber.PhoneNumberFormat;
  } catch (e) {
    console.warn('⚠️ libphonenumber לא זמין, משתמש בחילוץ בסיסי');
    phoneUtil = null;
    PhoneNumberFormat = null;
  }
  const extractedPhones: string[] = [];
  
  // Multiple patterns for Israeli and international phones
  // Prioritize Israeli mobile (05X) over landlines
  const phonePatterns = [
    /\+?972[-\s]?0?5\d{1}[-\s]?\d{3}[-\s]?\d{4}/g,  // Israeli mobile with country code
    /05\d{1}[-\s]?\d{3}[-\s]?\d{4}/g,  // Israeli mobile local (05X-XXX-XXXX)
    /\+?972[-\s]?0?[2-9]\d{1}[-\s]?\d{3}[-\s]?\d{4}/g,  // Other Israeli phones
    /0[2-9]\d{1}[-\s]?\d{3}[-\s]?\d{4}/g,  // Israeli local
    /\+?\d{1,4}[-\s]?\(?\d{1,4}\)?[-\s]?\d{1,4}[-\s]?\d{1,9}/g  // Generic international
  ];

  for (const pattern of phonePatterns) {
    const matches = normalizedText.match(pattern);
    if (matches) {
      for (const match of matches) {
        try {
          const cleanNumber = match.replace(/[-\s()]/g, '');
          
          // Try libphonenumber if available
          if (phoneUtil && PhoneNumberFormat) {
            try {
              let parsedNumber;
              try {
                parsedNumber = phoneUtil.parse(cleanNumber, 'IL');
              } catch {
                // Try without country code
                parsedNumber = phoneUtil.parse(cleanNumber, '');
              }
              
              if (phoneUtil.isValidNumber(parsedNumber)) {
                const formatted = phoneUtil.format(parsedNumber, PhoneNumberFormat.E164);
                if (!extractedPhones.includes(formatted)) {
                  extractedPhones.push(formatted);
                }
                continue; // Successfully parsed, skip to next
              }
            } catch (e) {
              // libphonenumber failed, fall through to basic validation
            }
          }
          
          // Basic validation fallback
          if (cleanNumber.length >= 9 && cleanNumber.length <= 15 && /^\d+$/.test(cleanNumber)) {
            if (!extractedPhones.includes(cleanNumber)) {
              extractedPhones.push(cleanNumber);
            }
          }
        } catch (e) {
          console.warn('⚠️ שגיאה בחילוץ מספר טלפון:', e);
        }
      }
    }
  }

  if (extractedPhones.length > 0) {
    result.mobile = extractedPhones[0];
    if (extractedPhones.length > 1) {
      result.phone = extractedPhones[1];
    }
  }

  // Extract name with improved Hebrew support
  const lines = normalizedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Try multiple extraction strategies
  const nameExtractionStrategies = [
    // Strategy 1: Look for name label patterns (Hebrew and English)
    () => {
      const labelPatterns = [
        /(?:שם מלא|שם|name|full name|الاسم)[\s:]+([א-תa-zA-Z]+)\s+([א-תa-zA-Z]+)/i,
        /(?:שם פרטי|first name|الاسم الأول)[\s:]+([א-תa-zA-Z]+)[\s\S]*?(?:שם משפחה|last name|اسم العائلة)[\s:]+([א-תa-zA-Z]+)/i,
      ];
      
      for (const pattern of labelPatterns) {
        const match = normalizedText.match(pattern);
        if (match && match[1] && match[2]) {
          return { firstName: match[1].trim(), lastName: match[2].trim() };
        }
      }
      return null;
    },
    
    // Strategy 2: Look for two Hebrew words that match known names
    () => {
      const hebrewWordPairs = normalizedText.match(/([א-ת]+)\s+([א-ת]+)/g);
      if (hebrewWordPairs) {
        for (const pair of hebrewWordPairs) {
          const [first, last] = pair.split(/\s+/);
          if (HEBREW_FIRST_NAMES.has(first) || HEBREW_LAST_NAMES.has(last)) {
            return { firstName: first, lastName: last };
          }
        }
      }
      return null;
    },
    
    // Strategy 3: First line with two Hebrew words (common CV format)
    () => {
      for (const line of lines) {
        // Skip lines that look like headers or labels
        if (line.includes(':') || line.includes('קורות') || line.includes('CV') || line.includes('RESUME')) {
          continue;
        }
        
        const match = line.match(/^([א-ת]+)\s+([א-ת]+)$/);
        if (match && match[1] && match[2]) {
          // Check if words are reasonable length (2-15 chars)
          if (match[1].length >= 2 && match[1].length <= 15 && 
              match[2].length >= 2 && match[2].length <= 15) {
            return { firstName: match[1].trim(), lastName: match[2].trim() };
          }
        }
      }
      return null;
    },
    
    // Strategy 4: English name patterns (both Title Case and UPPERCASE)
    () => {
      // Try all caps first (RAVID LEVI format)
      const upperCasePattern = /^([A-Z]{2,15})\s+([A-Z]{2,15})$/m;
      for (const line of lines) {
        if (line.includes(':') || line.includes('CURRICULUM') || line.includes('VITAE')) {
          continue;
        }
        const match = line.match(upperCasePattern);
        if (match && match[1] && match[2]) {
          // Check it's not a header like "PROFESSIONAL EXPERIENCE"
          const commonHeaders = ['PERSONAL', 'PROFESSIONAL', 'WORK', 'EDUCATION', 'SKILLS', 'EXPERIENCE', 'CONTACT', 'SUMMARY', 'OBJECTIVE'];
          if (!commonHeaders.includes(match[1]) && !commonHeaders.includes(match[2])) {
            return { firstName: match[1].trim(), lastName: match[2].trim() };
          }
        }
      }
      
      // Then try Title Case (Ravid Levi format)
      const titleCasePattern = /^([A-Z][a-z]+)\s+([A-Z][a-z]+)$/m;
      for (const line of lines) {
        if (line.includes(':') || line.includes('CV') || line.includes('RESUME')) {
          continue;
        }
        const match = line.match(titleCasePattern);
        if (match && match[1] && match[2]) {
          return { firstName: match[1].trim(), lastName: match[2].trim() };
        }
      }
      return null;
    },
    
    // Strategy 5: Any two consecutive words (2-4 chars each, Hebrew or English)
    () => {
      const anyNamePattern = /\b([א-תa-zA-Z]{2,15})\s+([א-תa-zA-Z]{2,15})\b/;
      const match = normalizedText.match(anyNamePattern);
      if (match && match[1] && match[2]) {
        // Avoid common words
        const commonWords = ['קורות', 'חיים', 'resume', 'curriculum', 'vitae', 'personal', 'details', 'information'];
        const first = match[1].toLowerCase();
        const last = match[2].toLowerCase();
        if (!commonWords.includes(first) && !commonWords.includes(last)) {
          return { firstName: match[1].trim(), lastName: match[2].trim() };
        }
      }
      return null;
    }
  ];

  // Try each strategy until we find a name
  for (const strategy of nameExtractionStrategies) {
    const nameResult = strategy();
    if (nameResult) {
      result.firstName = nameResult.firstName;
      result.lastName = nameResult.lastName;
      console.log(`✅ שם חולץ בהצלחה: ${result.firstName} ${result.lastName}`);
      break;
    }
  }

  // Extract profession with improved patterns (avoid PDF garbage)
  const professionPatterns = [
    /(?:תפקיד|משרה|profession|position|title|מקצוע|job title|الوظيفة)[\s:]+([^\n<>{}]+)/i,
    /(?:מפתח|developer|מהנדס|engineer|מתכנת|programmer|מנהל|manager|מעצב|designer)[\s]+([^\n<>{}]{0,50})/i,
  ];

  for (const pattern of professionPatterns) {
    const profMatch = normalizedText.match(pattern);
    if (profMatch && profMatch[1]) {
      const profession = profMatch[1].trim();
      // Make sure it's not PDF garbage (no binary markers or XML-like tags)
      if (!profession.includes('>>') && 
          !profession.includes('endobj') && 
          !profession.includes('<</') &&
          !profession.includes('/Type/') &&
          profession.length < 100) {
        result.profession = profession.substring(0, 100);
        break;
      }
    }
  }

  console.log(`📊 נתוני CV שחולצו:`, {
    name: `${result.firstName} ${result.lastName}`,
    email: result.email,
    phones: [result.mobile, result.phone].filter(Boolean),
    profession: result.profession
  });

  return result;
}

// Process parsed email attachments
async function processParsedEmailAttachments(parsed: any): Promise<void> {
  const { storage } = await import("./storage");

  for (const attachment of parsed.attachments) {
    const filename = attachment.filename || "";
    const isCV =
      filename.toLowerCase().includes("cv") ||
      filename.toLowerCase().includes("resume") ||
      filename.toLowerCase().includes("קורות") ||
      filename.endsWith(".pdf") ||
      filename.endsWith(".doc") ||
      filename.endsWith(".docx") ||
      filename.endsWith(".jpg") ||
      filename.endsWith(".jpeg") ||
      filename.endsWith(".png") ||
      filename.endsWith(".tiff") ||
      filename.endsWith(".bmp") ||
      attachment.contentType?.startsWith("image/");

    if (isCV && attachment.content) {
      console.log(`💼 מעבד קובץ CV: ${filename}`);

      // Save the CV file
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const timestamp = Date.now();
      // Only remove filesystem-unsafe characters, keep Hebrew and other Unicode characters
      const cleanFilename = filename.replace(/[\/\\:*?"<>|]/g, "_");
      const savedPath = path.join(uploadsDir, `${timestamp}_${cleanFilename}`);

      // Write the file
      fs.writeFileSync(savedPath, attachment.content);
      console.log(`💾 קובץ CV נשמר: ${savedPath}`);

      // Extract text from CV file
      console.log(`🔍 מחלץ נתונים מקובץ CV...`);
      let cvText = "";
      let extractedData = {
        firstName: "",
        lastName: "",
        email: null as string | null,
        mobile: null as string | null,
        phone: null as string | null,
        profession: null as string | null,
      };

      try {
        cvText = await extractTextFromCVFile(`${timestamp}_${cleanFilename}`);
        console.log(`📄 חולץ ${cvText.length} תווים מהקובץ`);

        if (cvText && cvText.length > 0) {
          extractedData = parseCVData(cvText);
          console.log(`✅ נתונים שחולצו מהCV:`, {
            name:
              extractedData.firstName && extractedData.lastName
                ? `${extractedData.firstName} ${extractedData.lastName}`
                : "לא נמצא",
            email: extractedData.email || "לא נמצא",
            mobile: extractedData.mobile || "לא נמצא",
            profession: extractedData.profession || "לא נמצא",
          });
        } else {
          console.log(`⚠️ לא הצלחנו לחלץ טקסט מהקובץ`);
        }
      } catch (extractError) {
        console.error(`❌ שגיאה בחילוץ נתונים מהCV:`, extractError);
      }

      // Extract sender email as fallback for recruitment source
      const fromText = parsed.from?.text || "";
      let senderEmail: string | null = null;
      const emailMatch = fromText.match(/<([^>]+)>/);
      if (emailMatch) {
        senderEmail = emailMatch[1];
      } else if (fromText.includes("@")) {
        senderEmail = fromText;
      }

      // Extract domain from sender email for recruitment source
      const senderDomain = senderEmail ? senderEmail.split("@")[1] : null;
      const recruitmentSourceText = senderDomain
        ? senderDomain
        : "מייל נכנס ללא דומיין";

      // Use extracted data from CV, fallback to empty if not found
      // NOTE: We use extracted email from CV, NOT sender's email
      const newCandidate = await storage.createCandidate({
        firstName: extractedData.firstName || "",
        lastName: extractedData.lastName || "",
        email: extractedData.email, // Use CV email, not sender email
        city: "", // Leave empty - not extracted yet
        mobile: extractedData.mobile || "",
        phone: extractedData.phone || "",
        profession: extractedData.profession || "",
        status: "פעיל",
        recruitmentSource: recruitmentSourceText,
        notes: `מועמד שנוסף אוטומטית מהמייל. נושא המייל: "${parsed.subject || "ללא נושא"}"${senderEmail ? `\nנשלח מ: ${senderEmail}` : ""}`,
        cvPath: `${timestamp}_${cleanFilename}`,
        cvContent: cvText, // Save extracted text for search
      });
      console.log(
        `👤 נוצר מועמד חדש: מס' ${newCandidate.candidateNumber}${extractedData.firstName ? ` (${extractedData.firstName} ${extractedData.lastName})` : ""}`,
      );

      // Add creation event
      await storage.addCandidateEvent({
        candidateId: newCandidate.id,
        eventType: "candidate_created",
        description: `מועמד נוצר אוטומטית ממייל נכנס. מס' מועמד: ${newCandidate.candidateNumber}${senderEmail ? `, מייל: ${senderEmail}` : ", ללא מייל"}`,
        metadata: {
          source: "email_import",
          emailSubject: parsed.subject || "ללא נושא",
          cvFileName: cleanFilename,
          senderEmail: senderEmail || "לא זוהה",
          timestamp: new Date().toISOString(),
        },
      });

      // Check if there's a job code in the subject for automatic application
      const jobCodeMatch = parsed.subject?.match(/(\d{4,})/);
      if (jobCodeMatch) {
        const jobCode = jobCodeMatch[1];
        const jobs = await storage.getJobs();
        // Match by jobCode field, not by id or title
        const matchingJob = jobs.jobs.find((j: any) => j.jobCode === jobCode);

        if (matchingJob) {
          // Create automatic job application
          await storage.createJobApplication({
            candidateId: newCandidate.id,
            jobId: matchingJob.id,
            status: "submitted",
            notes: `הגיש מועמדות אוטומטית באמצעות מייל לקוד משרה: ${jobCode}`,
          });
          console.log(
            `🎯 נוצרה הגשת מועמדות אוטומטית למשרה: ${matchingJob.title}`,
          );
        } else {
          console.log(`⚠️ לא נמצאה משרה עם קוד: ${jobCode}`);
        }
      }
    }
  }
}

// Process CV attachment from email (DEPRECATED - kept for reference)
async function processCVEmailAttachment(
  imap: any,
  seqno: number,
  headers: any,
  body: string,
): Promise<void> {
  console.log("🔍 מעבד קובץ CV מהמייל...");

  return new Promise((resolve, reject) => {
    let resolved = false;
    const safeResolve = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    const safeReject = (err: any) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    };

    try {
      console.log(`🔎 מנסה לקרוא מייל מספר ${seqno} עם fetch...`);

      // Get the full email message with attachments
      const f = imap.fetch(seqno, {
        bodies: "",
        struct: true,
        envelope: true,
      });

      let processingPromise: Promise<void> | null = null;

      f.on("message", (msg: any) => {
        console.log(`✉️ התקבלה הודעה מהשרת למייל ${seqno}`);
        msg.on("body", (stream: any) => {
          const chunks: Buffer[] = [];

          stream.on("data", (chunk: any) => {
            // Keep as Buffer - do NOT convert to string
            chunks.push(chunk);
          });

          stream.once("end", () => {
            // Create a processing promise that we'll await in the 'end' event
            processingPromise = (async () => {
              try {
                // Combine all chunks into a single Buffer
                const fullEmailBuffer = Buffer.concat(chunks);
                console.log(
                  `📊 גודל המייל: ${fullEmailBuffer.length} בתים, ${chunks.length} chunks`,
                );

                // Parse the full email with mailparser to extract attachments
                const parsed = await simpleParser(fullEmailBuffer);
                console.log(
                  `📧 המייל פוענח - יש ${parsed.attachments?.length || 0} קבצים מצורפים`,
                );

                if (!parsed.attachments || parsed.attachments.length === 0) {
                  console.log("⚠️ לא נמצאו קבצים מצורפים במייל");
                  console.log(`📋 נושא: ${parsed.subject}`);
                  console.log(`📮 מאת: ${parsed.from?.text}`);
                }

                // Look for CV attachments
                if (parsed.attachments && parsed.attachments.length > 0) {
                  console.log(
                    `📎 נמצאו ${parsed.attachments.length} קבצים מצורפים`,
                  );

                  for (const attachment of parsed.attachments) {
                    const filename = attachment.filename || "";
                    const isCV =
                      filename.toLowerCase().includes("cv") ||
                      filename.toLowerCase().includes("resume") ||
                      filename.toLowerCase().includes("קורות") ||
                      filename.endsWith(".pdf") ||
                      filename.endsWith(".doc") ||
                      filename.endsWith(".docx") ||
                      filename.endsWith(".jpg") ||
                      filename.endsWith(".jpeg") ||
                      filename.endsWith(".png") ||
                      filename.endsWith(".tiff") ||
                      filename.endsWith(".bmp") ||
                      attachment.contentType?.startsWith("image/");

                    if (isCV && attachment.content) {
                      console.log(`💼 מעבד קובץ CV: ${filename}`);

                      // Save the CV file
                      const uploadsDir = path.join(process.cwd(), "uploads");
                      if (!fs.existsSync(uploadsDir)) {
                        fs.mkdirSync(uploadsDir, { recursive: true });
                      }

                      const timestamp = Date.now();
                      const cleanFilename = filename.replace(
                        /[^a-zA-Z0-9.-]/g,
                        "_",
                      );
                      const savedPath = path.join(
                        uploadsDir,
                        `${timestamp}_${cleanFilename}`,
                      );

                      // Write the file
                      fs.writeFileSync(savedPath, attachment.content);
                      console.log(`💾 קובץ CV נשמר: ${savedPath}`);

                      // Extract email address from sender
                      const fromEmail = headers.from[0];
                      let emailAddress = "";
                      const emailMatch = fromEmail.match(/<([^>]+)>/);
                      if (emailMatch) {
                        emailAddress = emailMatch[1];
                      } else {
                        emailAddress = fromEmail;
                      }

                      // Extract email address only - no fake data, leave null if empty
                      const senderEmail =
                        emailAddress && emailAddress.trim() !== ""
                          ? emailAddress.trim()
                          : null;

                      // Check if candidate already exists (only if we have a valid email)
                      const existingCandidates = await storage.getCandidates();
                      const candidateExists = senderEmail
                        ? existingCandidates.candidates.some(
                            (c: any) => c.email === senderEmail,
                          )
                        : false;

                      if (!candidateExists) {
                        // Create new candidate with minimal data - no fake information
                        // Extract domain from sender email for recruitment source
                        const senderDomain = senderEmail
                          ? senderEmail.split("@")[1]
                          : null;
                        const recruitmentSourceText = senderDomain
                          ? senderDomain
                          : "מייל נכנס ללא דומיין";

                        const newCandidate = await storage.createCandidate({
                          firstName: "", // Leave empty - will be filled manually
                          lastName: "", // Leave empty - will be filled manually
                          email: senderEmail, // Will be null if no valid email found
                          city: "", // Leave empty
                          mobile: "", // Leave empty
                          profession: "", // Leave empty
                          status: "פעיל",
                          recruitmentSource: recruitmentSourceText,
                          notes: `מועמד שנוסף אוטומטית מהמייל. נושא המייל: "${parsed.subject || "ללא נושא"}"`,
                          cvPath: `${timestamp}-${cleanFilename.toLowerCase().replace(/[^a-z0-9.-]/g, "")}`,
                        });
                        console.log(
                          `👤 נוצר מועמד חדש: מס' ${newCandidate.candidateNumber} (${newCandidate.email || "ללא מייל"})`,
                        );

                        // Add creation event
                        await storage.addCandidateEvent({
                          candidateId: newCandidate.id,
                          eventType: "candidate_created",
                          description: `מועמד נוצר אוטומטית ממייל נכנס. מס' מועמד: ${newCandidate.candidateNumber}${senderEmail ? `, מייל: ${senderEmail}` : ", ללא מייל"}`,
                          metadata: {
                            source: "email_import",
                            emailSubject: parsed.subject || "ללא נושא",
                            cvFileName: cleanFilename,
                            senderEmail: senderEmail || "לא זוהה",
                            timestamp: new Date().toISOString(),
                          },
                        });

                        // Check if there's a job code in the subject for automatic application
                        const jobCodeMatch = parsed.subject?.match(/(\d{4,})/);
                        if (jobCodeMatch) {
                          const jobCode = jobCodeMatch[1];
                          const jobs = await storage.getJobs();
                          const matchingJob = jobs.jobs.find(
                            (j: any) =>
                              j.id === jobCode || j.title.includes(jobCode),
                          );

                          if (matchingJob) {
                            // Create automatic job application
                            await storage.createJobApplication({
                              candidateId: newCandidate.id,
                              jobId: matchingJob.id,
                              status: "submitted",
                              notes: `הגיש מועמדות אוטומטית באמצעות מייל לקוד משרה: ${jobCode}`,
                            });
                            console.log(
                              `🎯 נוצרה הגשת מועמדות אוטומטית למשרה: ${matchingJob.title}`,
                            );
                          }
                        }
                      } else {
                        console.log(
                          `ℹ️ מועמד כבר קיים במערכת: ${emailAddress}`,
                        );
                      }
                    }
                  }
                } else {
                  console.log("📧 המייל לא מכיל קבצים מצורפים");
                }
              } catch (parseError) {
                console.error("❌ שגיאה בפענוח המייל:", parseError);
                throw parseError;
              }
            })();
          });
        });
      });

      // Wait for the fetch to complete AND for processing to finish
      f.once("end", async () => {
        try {
          if (processingPromise) {
            await processingPromise;
          }
          safeResolve();
        } catch (err) {
          safeReject(err);
        }
      });

      f.once("error", (err: any) => {
        console.error("❌ שגיאה בקבלת המייל המלא:", err.message);
        safeReject(err);
      });
    } catch (error) {
      console.error("❌ שגיאה בעיבוד קובץ CV מהמייל:", error);
      safeReject(error);
    }
  });
}

// Extract name from email address
function extractNameFromEmail(email: string): string {
  const localPart = email.split("@")[0];

  // Replace common separators with spaces
  let name = localPart.replace(/[._-]/g, " ");

  // Capitalize first letter of each word
  name = name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return name || "מועמד חדש";
}
