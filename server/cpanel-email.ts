import Imap from 'imap';
import { simpleParser } from 'mailparser';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';

const execPromise = promisify(exec);

// Extract text from uploaded CV file (PDF, DOC, or image with OCR)
async function extractTextFromCVFile(filename: string): Promise<string> {
  const filePath = path.join(process.cwd(), 'uploads', filename);
  const ext = path.extname(filename).toLowerCase();
  
  try {
    if (ext === '.pdf') {
      console.log(`📄 מחלץ טקסט מ-PDF: ${filename}`);
      const { stdout } = await execPromise(`pdftotext "${filePath}" -`);
      return stdout;
    } else if (ext === '.doc' || ext === '.docx') {
      console.log(`📝 מחלץ טקסט מ-DOC: ${filename}`);
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } else if (['.jpg', '.jpeg', '.png', '.tiff', '.bmp'].includes(ext)) {
      console.log(`🖼️ מחלץ טקסט מתמונה עם OCR: ${filename}`);
      const { data: { text } } = await Tesseract.recognize(filePath, 'heb+eng');
      return text;
    }
    return '';
  } catch (error) {
    console.error(`❌ שגיאה בחילוץ טקסט מקובץ ${filename}:`, error);
    return '';
  }
}

// Parse CV text to extract structured data
function parseCVData(cvText: string): {
  firstName: string;
  lastName: string;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  profession: string | null;
} {
  const result = {
    firstName: '',
    lastName: '',
    email: null as string | null,
    mobile: null as string | null,
    phone: null as string | null,
    profession: null as string | null
  };

  // Extract email - IMPROVED REGEX with multiple patterns
  const emailPatterns = [
    // Standard email format - most common
    /\b[a-zA-Z0-9][a-zA-Z0-9._-]*@[a-zA-Z0-9][a-zA-Z0-9._-]*\.[a-zA-Z]{2,}\b/gi,
    // Email with Hebrew context
    /(?:מייל|דוא"ל|email|e-mail)[\s:]+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/gi,
    // Email in parentheses or brackets
    /[\(\[]([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})[\)\]]/gi
  ];

  for (const pattern of emailPatterns) {
    const matches = Array.from(cvText.matchAll(pattern));
    for (const match of matches) {
      const email = (match[1] || match[0]).trim().toLowerCase();
      // Validate it looks like a real email
      if (email && email.includes('@') && email.includes('.') && email.length > 5) {
        result.email = email;
        break;
      }
    }
    if (result.email) break;
  }

  // Extract Israeli mobile phone (05X-XXX-XXXX or 05XXXXXXXX)
  const mobilePatterns = [
    /\b05[0-9][-\s]?[0-9]{3}[-\s]?[0-9]{4}\b/g,
    /(?:נייד|סלולרי|mobile|cell)[\s:]+([0-9]{10})/gi
  ];
  
  for (const pattern of mobilePatterns) {
    const mobileMatch = cvText.match(pattern);
    if (mobileMatch) {
      result.mobile = mobileMatch[0].replace(/[-\s]/g, '');
      break;
    }
  }

  // Extract landline phone (0[2-4,8-9]-XXX-XXXX)
  const phoneMatch = cvText.match(/\b0[2-4,8-9][-\s]?[0-9]{3}[-\s]?[0-9]{4}\b/);
  if (phoneMatch) {
    result.phone = phoneMatch[0].replace(/[-\s]/g, '');
  }

  // Extract name - look for patterns
  const namePatterns = [
    /(?:שם|name|שם מלא|full name)[\s:]+([א-תa-zA-Z]+)\s+([א-תa-zA-Z]+)/i,
    /^([א-תa-zA-Z]+)\s+([א-תa-zA-Z]+)/m
  ];

  for (const pattern of namePatterns) {
    const nameMatch = cvText.match(pattern);
    if (nameMatch && nameMatch[1] && nameMatch[2]) {
      result.firstName = nameMatch[1].trim();
      result.lastName = nameMatch[2].trim();
      break;
    }
  }

  // Extract profession
  const professionPatterns = [
    /(?:תפקיד|משרה|profession|position|title|מקצוע)[\s:]+([^\n]+)/i,
    /(?:מפתח|developer|מהנדס|engineer|מתכנת|programmer|מנהל|manager)[\s]+([^\n]+)/i
  ];

  for (const pattern of professionPatterns) {
    const profMatch = cvText.match(pattern);
    if (profMatch && profMatch[1]) {
      result.profession = profMatch[1].trim().substring(0, 100);
      break;
    }
  }

  return result;
}

// Process parsed email attachments
async function processParsedEmailAttachments(parsed: any): Promise<void> {
  const { storage } = await import('./storage');
  
  for (const attachment of parsed.attachments) {
    const filename = attachment.filename || '';
    const isCV = filename.toLowerCase().includes('cv') || 
                filename.toLowerCase().includes('resume') ||
                filename.toLowerCase().includes('קורות') ||
                filename.endsWith('.pdf') ||
                filename.endsWith('.doc') ||
                filename.endsWith('.docx') ||
                filename.endsWith('.jpg') ||
                filename.endsWith('.jpeg') ||
                filename.endsWith('.png') ||
                filename.endsWith('.tiff') ||
                filename.endsWith('.bmp') ||
                attachment.contentType?.startsWith('image/');
    
    if (isCV && attachment.content) {
      console.log(`💼 מעבד קובץ CV: ${filename}`);
      
      // Save the CV file
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const timestamp = Date.now();
      // Only remove filesystem-unsafe characters, keep Hebrew and other Unicode characters
      const cleanFilename = filename.replace(/[\/\\:*?"<>|]/g, '_');
      const savedPath = path.join(uploadsDir, `${timestamp}_${cleanFilename}`);
      
      // Write the file
      fs.writeFileSync(savedPath, attachment.content);
      console.log(`💾 קובץ CV נשמר: ${savedPath}`);
      
      // Extract text from CV file
      console.log(`🔍 מחלץ נתונים מקובץ CV...`);
      let cvText = '';
      let extractedData = {
        firstName: '',
        lastName: '',
        email: null as string | null,
        mobile: null as string | null,
        phone: null as string | null,
        profession: null as string | null
      };
      
      try {
        cvText = await extractTextFromCVFile(`${timestamp}_${cleanFilename}`);
        console.log(`📄 חולץ ${cvText.length} תווים מהקובץ`);
        
        if (cvText && cvText.length > 0) {
          extractedData = parseCVData(cvText);
          console.log(`✅ נתונים שחולצו מהCV:`, {
            name: extractedData.firstName && extractedData.lastName ? 
              `${extractedData.firstName} ${extractedData.lastName}` : 'לא נמצא',
            email: extractedData.email || 'לא נמצא',
            mobile: extractedData.mobile || 'לא נמצא',
            profession: extractedData.profession || 'לא נמצא'
          });
        } else {
          console.log(`⚠️ לא הצלחנו לחלץ טקסט מהקובץ`);
        }
      } catch (extractError) {
        console.error(`❌ שגיאה בחילוץ נתונים מהCV:`, extractError);
      }
      
      // Extract sender email as fallback for recruitment source
      const fromText = parsed.from?.text || '';
      let senderEmail: string | null = null;
      const emailMatch = fromText.match(/<([^>]+)>/);
      if (emailMatch) {
        senderEmail = emailMatch[1];
      } else if (fromText.includes('@')) {
        senderEmail = fromText;
      }
      
      // Extract domain from sender email for recruitment source
      const senderDomain = senderEmail ? senderEmail.split('@')[1] : null;
      const recruitmentSourceText = senderDomain ? senderDomain : 'מייל נכנס ללא דומיין';
      
      // Use extracted data from CV, fallback to empty if not found
      // NOTE: We use extracted email from CV, NOT sender's email
      const newCandidate = await storage.createCandidate({
        firstName: extractedData.firstName || '', 
        lastName: extractedData.lastName || '',
        email: extractedData.email, // Use CV email, not sender email
        city: '', // Leave empty - not extracted yet
        mobile: extractedData.mobile || '',
        phone: extractedData.phone || '',
        profession: extractedData.profession || '',
        status: 'פעיל',
        recruitmentSource: recruitmentSourceText,
        notes: `מועמד שנוסף אוטומטית מהמייל. נושא המייל: "${parsed.subject || 'ללא נושא'}"${senderEmail ? `\nנשלח מ: ${senderEmail}` : ''}`,
        cvPath: `${timestamp}_${cleanFilename}`,
        cvContent: cvText // Save extracted text for search
      });
      console.log(`👤 נוצר מועמד חדש: מס' ${newCandidate.candidateNumber}${extractedData.firstName ? ` (${extractedData.firstName} ${extractedData.lastName})` : ''}`);
      
      // Add creation event
      await storage.addCandidateEvent({
        candidateId: newCandidate.id,
        eventType: 'candidate_created',
        description: `מועמד נוצר אוטומטית ממייל נכנס. מס' מועמד: ${newCandidate.candidateNumber}${senderEmail ? `, מייל: ${senderEmail}` : ', ללא מייל'}`,
        metadata: {
          source: 'email_import',
          emailSubject: parsed.subject || 'ללא נושא',
          cvFileName: cleanFilename,
          senderEmail: senderEmail || 'לא זוהה',
          timestamp: new Date().toISOString()
        }
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
            status: 'submitted',
            notes: `הגיש מועמדות אוטומטית באמצעות מייל לקוד משרה: ${jobCode}`
          });
          console.log(`🎯 נוצרה הגשת מועמדות אוטומטית למשרה: ${matchingJob.title}`);
        } else {
          console.log(`⚠️ לא נמצאה משרה עם קוד: ${jobCode}`);
        }
      }
    }
  }
}

// Process CV attachment from email (DEPRECATED - kept for reference)
async function processCVEmailAttachment(imap: any, seqno: number, headers: any, body: string): Promise<void> {
  console.log('🔍 מעבד קובץ CV מהמייל...');
  
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
        bodies: '',
        struct: true,
        envelope: true
      });

      let processingPromise: Promise<void> | null = null;

      f.on('message', (msg: any) => {
        console.log(`✉️ התקבלה הודעה מהשרת למייל ${seqno}`);
        msg.on('body', (stream: any) => {
          const chunks: Buffer[] = [];
          
          stream.on('data', (chunk: any) => {
            // Keep as Buffer - do NOT convert to string
            chunks.push(chunk);
          });
          
          stream.once('end', () => {
            // Create a processing promise that we'll await in the 'end' event
            processingPromise = (async () => {
              try {
                // Combine all chunks into a single Buffer
                const fullEmailBuffer = Buffer.concat(chunks);
                console.log(`📊 גודל המייל: ${fullEmailBuffer.length} בתים, ${chunks.length} chunks`);
                
                // Parse the full email with mailparser to extract attachments
                const parsed = await simpleParser(fullEmailBuffer);
                console.log(`📧 המייל פוענח - יש ${parsed.attachments?.length || 0} קבצים מצורפים`);
                
                if (!parsed.attachments || parsed.attachments.length === 0) {
                  console.log('⚠️ לא נמצאו קבצים מצורפים במייל');
                  console.log(`📋 נושא: ${parsed.subject}`);
                  console.log(`📮 מאת: ${parsed.from?.text}`);
                }
                
                // Look for CV attachments
                if (parsed.attachments && parsed.attachments.length > 0) {
                  console.log(`📎 נמצאו ${parsed.attachments.length} קבצים מצורפים`);
                  
                  for (const attachment of parsed.attachments) {
                    const filename = attachment.filename || '';
                    const isCV = filename.toLowerCase().includes('cv') || 
                                filename.toLowerCase().includes('resume') ||
                                filename.toLowerCase().includes('קורות') ||
                                filename.endsWith('.pdf') ||
                                filename.endsWith('.doc') ||
                                filename.endsWith('.docx') ||
                                filename.endsWith('.jpg') ||
                                filename.endsWith('.jpeg') ||
                                filename.endsWith('.png') ||
                                filename.endsWith('.tiff') ||
                                filename.endsWith('.bmp') ||
                                attachment.contentType?.startsWith('image/');
                    
                    if (isCV && attachment.content) {
                      console.log(`💼 מעבד קובץ CV: ${filename}`);
                      
                      // Save the CV file
                      const uploadsDir = path.join(process.cwd(), 'uploads');
                      if (!fs.existsSync(uploadsDir)) {
                        fs.mkdirSync(uploadsDir, { recursive: true });
                      }
                      
                      const timestamp = Date.now();
                      const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
                      const savedPath = path.join(uploadsDir, `${timestamp}_${cleanFilename}`);
                      
                      // Write the file
                      fs.writeFileSync(savedPath, attachment.content);
                      console.log(`💾 קובץ CV נשמר: ${savedPath}`);
                      
                      // Extract email address from sender
                      const fromEmail = headers.from[0];
                      let emailAddress = '';
                      const emailMatch = fromEmail.match(/<([^>]+)>/);
                      if (emailMatch) {
                        emailAddress = emailMatch[1];
                      } else {
                        emailAddress = fromEmail;
                      }
                      
                      // Extract email address only - no fake data, leave null if empty
                      const senderEmail = emailAddress && emailAddress.trim() !== '' ? emailAddress.trim() : null;
                      
                      // Check if candidate already exists (only if we have a valid email)
                      const { storage } = await import('./storage');
                      const existingCandidates = await storage.getCandidates();
                      const candidateExists = senderEmail ? existingCandidates.candidates.some((c: any) => c.email === senderEmail) : false;
                      
                      if (!candidateExists) {
                        // Create new candidate with minimal data - no fake information
                        // Extract domain from sender email for recruitment source
                        const senderDomain = senderEmail ? senderEmail.split('@')[1] : null;
                        const recruitmentSourceText = senderDomain ? senderDomain : 'מייל נכנס ללא דומיין';
                        
                        const newCandidate = await storage.createCandidate({
          firstName: '', // Leave empty - will be filled manually
          lastName: '', // Leave empty - will be filled manually  
          email: senderEmail, // Will be null if no valid email found
          city: '', // Leave empty
          mobile: '', // Leave empty
          profession: '', // Leave empty
          status: 'פעיל',
          recruitmentSource: recruitmentSourceText,
          notes: `מועמד שנוסף אוטומטית מהמייל. נושא המייל: "${parsed.subject || 'ללא נושא'}"`,
          cvPath: `${timestamp}-${cleanFilename.toLowerCase().replace(/[^a-z0-9.-]/g, '')}`
        });
                        console.log(`👤 נוצר מועמד חדש: מס' ${newCandidate.candidateNumber} (${newCandidate.email || 'ללא מייל'})`);
                        
                        // Add creation event
                        await storage.addCandidateEvent({
                          candidateId: newCandidate.id,
                          eventType: 'candidate_created',
                          description: `מועמד נוצר אוטומטית ממייל נכנס. מס' מועמד: ${newCandidate.candidateNumber}${senderEmail ? `, מייל: ${senderEmail}` : ', ללא מייל'}`,
                          metadata: {
                            source: 'email_import',
                            emailSubject: parsed.subject || 'ללא נושא',
                            cvFileName: cleanFilename,
                            senderEmail: senderEmail || 'לא זוהה',
                            timestamp: new Date().toISOString()
                          }
                        });
                        
                        // Check if there's a job code in the subject for automatic application
                        const jobCodeMatch = parsed.subject?.match(/(\d{4,})/);
                        if (jobCodeMatch) {
                          const jobCode = jobCodeMatch[1];
                          const jobs = await storage.getJobs();
                          const matchingJob = jobs.jobs.find((j: any) => j.id === jobCode || j.title.includes(jobCode));
                          
                          if (matchingJob) {
                            // Create automatic job application
                            await storage.createJobApplication({
                              candidateId: newCandidate.id,
                              jobId: matchingJob.id,
                              status: 'submitted',
                              notes: `הגיש מועמדות אוטומטית באמצעות מייל לקוד משרה: ${jobCode}`
                            });
                            console.log(`🎯 נוצרה הגשת מועמדות אוטומטית למשרה: ${matchingJob.title}`);
                          }
                        }
                      } else {
                        console.log(`ℹ️ מועמד כבר קיים במערכת: ${emailAddress}`);
                      }
                    }
                  }
                } else {
                  console.log('📧 המייל לא מכיל קבצים מצורפים');
                }
              } catch (parseError) {
                console.error('❌ שגיאה בפענוח המייל:', parseError);
                throw parseError;
              }
            })();
          });
        });
      });
      
      // Wait for the fetch to complete AND for processing to finish
      f.once('end', async () => {
        try {
          if (processingPromise) {
            await processingPromise;
          }
          safeResolve();
        } catch (err) {
          safeReject(err);
        }
      });
      
      f.once('error', (err: any) => {
        console.error('❌ שגיאה בקבלת המייל המלא:', err.message);
        safeReject(err);
      });
    
    } catch (error) {
      console.error('❌ שגיאה בעיבוד קובץ CV מהמייל:', error);
      safeReject(error);
    }
  });
}

// Extract name from email address
function extractNameFromEmail(email: string): string {
  const localPart = email.split('@')[0];
  
  // Replace common separators with spaces
  let name = localPart.replace(/[._-]/g, ' ');
  
  // Capitalize first letter of each word
  name = name.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return name || 'מועמד חדש';
}

export async function checkCpanelEmails() {
  console.log('📧 בודק מיילים חדשים בcPanel...');
  
  const config = {
    user: 'cv@h-group.org.il',
    password: 'CV@mail2025',
    host: 'mail.h-group.org.il',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  };

  return new Promise<void>((resolve) => {
    const imap = new Imap(config);
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log('⏱️ פג זמן חיבור cPanel');
        imap.end();
        resolve();
      }
    }, 30000);

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          console.error('❌ שגיאה בפתיחת תיבת דואר:', err.message);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            imap.end();
            resolve();
          }
          return;
        }

        console.log(`📧 בוחן ${box.messages.total} מיילים סה"כ, לא נקראו: ${box.messages.unseen}`);
        
        if (box.messages.unseen === 0) {
          console.log('ℹ️ אין מיילים חדשים');
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            imap.end();
            resolve();
          }
          return;
        }

        console.log(`🆕 נמצאו ${box.messages.unseen} מיילים חדשים`);

        imap.search(['UNSEEN'], (err, results) => {
          if (err) {
            console.error('❌ שגיאה בחיפוש מיילים:', err.message);
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              imap.end();
              resolve();
            }
            return;
          }

          if (!results || results.length === 0) {
            console.log('ℹ️ אין מיילים חדשים');
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              imap.end();
              resolve();
            }
            return;
          }

          const lastN = results.slice(-10);
          console.log(`📧 מעבד ${lastN.length} מיילים אחרונים לא נקראו`);
          
          const f = imap.fetch(lastN, {
            bodies: '',
            struct: true,
            markSeen: true
          });

          let processedCount = 0;
          const totalEmails = lastN.length;
          const processingPromises: Promise<void>[] = [];

          f.on('message', (msg, seqno) => {
            console.log(`📨 מעבד מייל ${seqno}`);
            const chunks: Buffer[] = [];

            msg.on('body', (stream) => {
              console.log(`📨 התחיל לקרוא גוף המייל...`);
              stream.on('data', (chunk) => {
                chunks.push(chunk);
                console.log(`📦 התקבל chunk בגודל ${chunk.length} בתים (סה"כ ${chunks.length} chunks)`);
              });

              stream.once('end', () => {
                console.log(`✅ גוף המייל התקבל בשלמות - ${chunks.length} chunks`);
                // Body is fully received, will process in msg.once('end')
              });
            });

            msg.once('end', () => {
              processedCount++;
              console.log(`✅ מייל ${seqno} נקרא (${processedCount}/${totalEmails})`);
              
              // Process the email buffer directly
              const processingPromise = (async () => {
                try {
                  console.log('🔍 מעבד קובץ CV מהמייל...');
                  
                  // Combine all chunks into a single Buffer
                  const fullEmailBuffer = Buffer.concat(chunks);
                  console.log(`📊 גודל המייל: ${fullEmailBuffer.length} בתים, ${chunks.length} chunks`);
                  
                  // Parse the full email with mailparser to extract attachments
                  const parsed = await simpleParser(fullEmailBuffer);
                  console.log(`📧 המייל פוענח - יש ${parsed.attachments?.length || 0} קבצים מצורפים`);
                  console.log(`📮 מאת: ${parsed.from?.text}`);
                  console.log(`📋 נושא: ${parsed.subject}`);
                  
                  if (!parsed.attachments || parsed.attachments.length === 0) {
                    console.log('⚠️ לא נמצאו קבצים מצורפים במייל');
                    return;
                  }
                  
                  console.log(`📎 נמצאו ${parsed.attachments.length} קבצים מצורפים`);
                  
                  // Process attachments
                  await processParsedEmailAttachments(parsed);
                  console.log(`✅ מייל ${seqno} עובד לגמרי`);
                } catch (cvError) {
                  console.error('❌ שגיאה בעיבוד המייל:', cvError);
                }
              })();
              
              processingPromises.push(processingPromise);
            });
          });

          f.once('end', async () => {
            console.log(`⏳ ממתין לסיום עיבוד ${processingPromises.length} מיילים...`);
            
            // Wait for ALL processing to complete before closing connection
            try {
              await Promise.all(processingPromises);
              console.log('✅ כל המיילים עובדו בהצלחה');
            } catch (err) {
              console.error('❌ שגיאה בעיבוד מיילים:', err);
            }
            
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              imap.end();
              resolve();
            }
          });

          f.once('error', (err) => {
            console.error('❌ שגיאה בקבלת מיילים:', err.message);
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              imap.end();
              resolve();
            }
          });
        });
      });
    });

    imap.once('error', (err: any) => {
      console.error('❌ שגיאת חיבור cPanel:', err.message);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    imap.once('end', () => {
      console.log('📧 חיבור cPanel נסגר');
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    imap.connect();
  });
}

export function startCpanelEmailMonitoring() {
  console.log('🚀 מפעיל מעקב מיילים cPanel');
  
  // Check immediately
  checkCpanelEmails().catch(console.error);
  
  // Then check every 5 minutes
  setInterval(() => {
    checkCpanelEmails().catch(console.error);
  }, 5 * 60 * 1000);
}
