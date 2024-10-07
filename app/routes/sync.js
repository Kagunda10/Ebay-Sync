// file: app/routes/sync.js
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Rate limiter configuration
const rateLimiter = new RateLimiterMemory({
    points: 3, // 3 actions
    duration: 24 * 60 * 60, // Per day (24 hours)
    blockDuration: 3 * 60 * 60, // Block for 3 hours
});

export async function action({ request }) {
    try {
        const { session } = await authenticate.admin(request);
        const { shop } = session;

        // Check rate limit
        try {
            await rateLimiter.consume(shop);
        } catch (rateLimiterRes) {
            return json({
                status: 'error',
                message: 'Sync limit reached. You can only sync 3 times a day and once every 3 hours.'
            }, { status: 429 });
        }

        // Execute the sync process
        // const command = `node utils/updateProducts.js ${shop}`;
        // await execPromise(command);

        return json({ status: 'success', message: 'Sync started successfully' });
    } catch (error) {
        console.error("Sync Action Error:", error);
        return json({ status: 'error', message: 'An error occurred while starting the sync process' }, { status: 500 });
    }
}
