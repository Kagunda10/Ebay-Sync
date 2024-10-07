// testJobInitiation.js

const { initiateJob } = require('./app/queue.server');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testJobInitiation() {
    try {
        console.log('Initiating job for shopId: 6');
        const result = await initiateJob(6);
        console.log('Job initiation result:', result);

        // Poll for job status
        if (result.jobId) {
            let jobCompleted = false;
            while (!jobCompleted) {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                const job = await prisma.job.findUnique({ where: { id: result.jobId } });
                console.log('Job status:', job.status, 'Progress:', job.progress + '%');
                if (['completed', 'failed', 'completed with errors'].includes(job.status)) {
                    jobCompleted = true;
                    if (job.errors && job.errors.length > 0) {
                        console.log('Job errors:', job.errors);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error during job initiation:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testJobInitiation().catch(console.error);