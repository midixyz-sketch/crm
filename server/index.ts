import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./localAuth";
import { whatsappServiceManager } from "./whatsapp-service";
import { db } from "./db";
import { whatsappSessions } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve uploaded files (including WhatsApp media)
app.use('/uploads', express.static('uploads'));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Setup authentication first
  await setupAuth(app);
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    console.log('✅ Local server running without dependencies on external services');
    
    // Auto-initialize WhatsApp for all users with existing active sessions
    try {
      // Get all active sessions grouped by user (get latest per user)
      const existingSessions = await db.query.whatsappSessions.findMany({
        where: eq(whatsappSessions.isActive, true),
        orderBy: [desc(whatsappSessions.createdAt)]
      });
      
      // Group by userId and initialize each user's WhatsApp
      const userIds = [...new Set(existingSessions.map(s => s.userId).filter(Boolean))];
      
      if (userIds.length > 0) {
        console.log(`🔄 Auto-initializing WhatsApp connection for ${userIds.length} users...`);
        
        for (const userId of userIds) {
          try {
            const service = whatsappServiceManager.getServiceForUser(userId as string);
            await service.initialize(userId as string);
            console.log(`✅ WhatsApp connected for user ${userId}`);
          } catch (error) {
            console.log(`⚠️ Failed to initialize WhatsApp for user ${userId}:`, error);
          }
        }
        
        console.log('✅ All WhatsApp sessions initialized');
      } else {
        console.log('ℹ️ No active sessions to initialize');
      }
    } catch (error) {
      console.log('ℹ️ WhatsApp not auto-initialized:', error);
    }
  });
})();
