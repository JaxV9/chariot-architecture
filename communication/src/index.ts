/**
 * @file index.ts
 * @description Main entry point of the CHARIOT communication package. Exports the public API and starts standalone mode when executed directly.
 */

import { fileURLToPath } from "node:url";
import { DirectoryService, VirtualProfile } from "./directory/DirectoryService.js";
import { MessageBusSubscriber } from "./bus/MessageBusSubscriber.js";

export { DirectoryService, VirtualProfile, MessageBusSubscriber };

// Create singleton instances for direct imports (singleton pattern for shared state within the same process)
const directoryServiceInstance = new DirectoryService();
const subscriberInstance = new MessageBusSubscriber(directoryServiceInstance);

export const getDirectoryService = () => directoryServiceInstance;
export const getSubscriber = () => subscriberInstance;

// If executed directly (standalone mode), start the autonomous listener
// ESM-compatible entry-point guard: compare the normalized file path of this module against the CLI argument
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] === __filename;
if (isMain) {
    console.log(`\n\x1b[35;1m===============================================================\x1b[0m`);
    console.log(`\x1b[35;1m        STARTING CHARIOT COMMUNICATION MIDDLEWARE               \x1b[0m`);
    console.log(`\x1b[35;1m===============================================================\x1b[0m\n`);

    subscriberInstance.connect()
        .then(() => {
            console.log("\x1b[36m[COMMUNICATION] Middleware listening for runtime messages...\x1b[0m");
        })
        .catch((error) => {
            console.error("\x1b[31m[COMMUNICATION] Critical failure during middleware startup:\x1b[0m", error);
            process.exit(1);
        });

    // Handle graceful shutdown
    const shutdown = async () => {
        console.log(`\n\x1b[31;1m[COMMUNICATION] Shutdown signal received. Closing...\x1b[0m`);
        try {
            await subscriberInstance.disconnect();
            console.log(`\x1b[32m[COMMUNICATION] Middleware stopped cleanly.\x1b[0m`);
            process.exit(0);
        } catch (error) {
            console.error(`\x1b[31m[COMMUNICATION] Error during shutdown:\x1b[0m`, error);
            process.exit(1);
        }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}
