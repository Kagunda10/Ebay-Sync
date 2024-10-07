import { json } from "@remix-run/node";
import { Queue } from 'bullmq';

const scrapeQueue = new Queue('scrape-queue', {
    connection: process.env.REDIS_URL
});

export async function action({ request }) {
    const formData = await request.formData();
    const action = formData.get("action");

    if (action === 'check_active') {
        const activeJobs = await scrapeQueue.getActive();
        if (activeJobs.length > 0) {
            return json({ activeJobId: activeJobs[0].id });
        }
        const waitingJobs = await scrapeQueue.getWaiting();
        if (waitingJobs.length > 0) {
            return json({ activeJobId: waitingJobs[0].id });
        }
        return json({ activeJobId: null });
    } else if (action === 'status') {
        const jobId = formData.get("jobId");
        const job = await scrapeQueue.getJob(jobId);

        if (!job) {
            return json({ status: 'not_found' });
        }

        const state = await job.getState();
        const progress = job.progress;
        const processedOn = job.processedOn || Date.now(); // Use current time if job hasn't started processing yet

        return json({ status: state, progress, startTime: processedOn });
    }

    return json({ error: 'Invalid action' }, { status: 400 });
}