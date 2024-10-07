import { json } from "@remix-run/node";
import { Queue } from 'bullmq';
import { scrapeEbay } from '../../utils/scraper';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const scrapeQueue = new Queue('scrape-queue', {
    connection: process.env.REDIS_URL
});

export async function action({ request }) {
    const formData = await request.formData();
    const shopId = formData.get("shopId");
    const action = formData.get("action");

    console.log(`Received action: ${action}, shopId: ${shopId}`);

    if (action === 'start') {
        try {
            console.log('Adding job to queue...');
            const job = await scrapeQueue.add('scrape', { shopId }, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
            });
            console.log(`Job added with id: ${job.id}`);
            return json({ success: true, jobId: job.id, message: 'Scraping job started' });
        } catch (error) {
            console.error('Error starting scraping job:', error);
            return json({ success: false, message: 'Error starting scraping job', error: error.message }, { status: 500 });
        }
    } else if (action === 'status') {
        const jobId = formData.get("jobId");
        try {
            console.log(`Checking status for job: ${jobId}`);
            const job = await scrapeQueue.getJob(jobId);
            if (!job) {
                console.log(`Job ${jobId} not found`);
                return json({ success: false, message: 'Job not found' }, { status: 404 });
            }
            const state = await job.getState();
            const progress = job.progress;
            console.log(`Job ${jobId} status: ${state}, progress: ${progress}`);
            return json({ success: true, status: state, progress });
        } catch (error) {
            console.error('Error getting job status:', error);
            return json({ success: false, message: 'Error getting job status', error: error.message }, { status: 500 });
        }
    }

    console.log('Invalid action received');
    return json({ success: false, message: 'Invalid action' }, { status: 400 });
}