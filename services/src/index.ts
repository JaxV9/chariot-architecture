/**
 * @file index.ts
 * @description REST API entry point for the CHARIOT services layer. Runs Express, consumes Directory Services, and triggers the MQTT subscription.
 */

import express from "express";
import { getDirectoryService, getSubscriber } from "@chariot/communication";

const app = express();
const port = process.env.PORT || 3000;

// Retrieve singleton instances of Directory Services and Message Bus Subscriber
const directoryService = getDirectoryService();
const subscriber = getSubscriber();

// Enable JSON body parser
app.use(express.json());

// Custom request logger middleware with ANSI colors
app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        let color = "\x1b[32m"; // Green for 2xx
        if (res.statusCode >= 400 && res.statusCode < 500) {
            color = "\x1b[33m"; // Yellow for 4xx
        } else if (res.statusCode >= 500) {
            color = "\x1b[31m"; // Red for 5xx
        }
        console.log(
            `\x1b[36m[SERVICES API]\x1b[0m ${req.method} ${req.originalUrl} - Status: ${color}${res.statusCode}\x1b[0m (${duration}ms)`
        );
    });
    next();
});

// Optional simple static token-based security check for MVP Zero Trust
const API_TOKEN = process.env.CHARIOT_API_TOKEN || "chariot-test-token";

const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string;
    
    let providedToken: string | undefined;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
        providedToken = authHeader.substring(7);
    } else if (queryToken) {
        providedToken = queryToken;
    }
    
    if (API_TOKEN && providedToken !== API_TOKEN) {
        console.warn(`\x1b[33m[SERVICES API] [UNAUTHORIZED] Access denied for ${req.method} ${req.originalUrl}\x1b[0m`);
        res.status(401).json({ 
            error: "Unauthorized", 
            message: "A valid static API token is required. Use 'Authorization: Bearer <token>' header or '?token=<token>' query parameter." 
        });
        return;
    }
    next();
};

/**
 * GET /health
 * Public endpoint to verify that the service is running.
 */
app.get("/health", (req, res) => {
    res.json({
        status: "UP",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        service: "chariot-services-layer"
    });
});

// Secure all zone endpoints using the Zero Trust MVP authentication middleware
app.use("/zones", authMiddleware);

/**
 * GET /zones
 * Returns the list of all known zone identifiers.
 */
app.get("/zones", (req, res) => {
    try {
        const zones = directoryService.getAllZones();
        res.json(zones);
    } catch (err: any) {
        console.error(`[SERVICES API] Error fetching zones:`, err);
        res.status(500).json({ error: "Internal Server Error", message: err.message });
    }
});

/**
 * GET /zones/:id
 * Returns the latest virtual profile for the specified zone.
 */
app.get("/zones/:id", (req, res) => {
    try {
        const { id } = req.params;
        const profile = directoryService.getZoneLatest(id);
        
        if (!profile) {
            res.status(404).json({ error: "Not Found", message: `Zone '${id}' not found in Directory Services.` });
            return;
        }
        res.json(profile);
    } catch (err: any) {
        console.error(`[SERVICES API] Error fetching zone profile:`, err);
        res.status(500).json({ error: "Internal Server Error", message: err.message });
    }
});

/**
 * GET /zones/:id/history
 * Returns the rolling history (up to 10 entries) for the specified zone.
 */
app.get("/zones/:id/history", (req, res) => {
    try {
        const { id } = req.params;
        const zones = directoryService.getAllZones();
        
        // Return 404 if the zone is unknown
        if (!zones.includes(id)) {
            res.status(404).json({ error: "Not Found", message: `Zone '${id}' not found in Directory Services.` });
            return;
        }
        
        const history = directoryService.getZoneHistory(id);
        res.json(history);
    } catch (err: any) {
        console.error(`[SERVICES API] Error fetching zone history:`, err);
        res.status(500).json({ error: "Internal Server Error", message: err.message });
    }
});

// Global error boundary middleware to catch unhandled Express routing exceptions
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`\x1b[31m[SERVICES API] [CRITICAL ROUTE ERROR] ${err.stack || err}\x1b[0m`);
    res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
});

// Start the Express server and internally trigger the MQTT Message Bus subscriber
app.listen(port, async () => {
    console.log(`\n\x1b[32;1m===============================================================\x1b[0m`);
    console.log(`\x1b[32;1m         CHARIOT SERVICES LAYER RUNNING ON PORT ${port}          \x1b[0m`);
    console.log(`\x1b[32;1m===============================================================\x1b[0m\n`);

    try {
        // Connect the MQTT subscriber to start feeding the in-memory DirectoryService
        await subscriber.connect();
        console.log("\x1b[36m[SERVICES] Internal communication subscriber successfully connected to MQTT broker.\x1b[0m");
    } catch (error) {
        console.error("\x1b[31m[SERVICES] Failed to start internal communication subscriber:\x1b[0m", error);
    }
});
