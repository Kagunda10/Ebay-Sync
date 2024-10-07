// queue.server.js
const AWS = require('aws-sdk');
const { PrismaClient } = require('@prisma/client');

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY, // Use environment variable
    secretAccessKey: process.env.AWS_SECRET_KEY, // Use environment variable
    region: process.env.AWS_REGION // Use environment variable
});

const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL; // Use environment variable

const prisma = new PrismaClient();
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

const BATCH_SIZE = 5;

async function initiateJob(shopId) {
    // Start the timer
    console.time(`Job duration for shopId: ${shopId}`);

    try {
        console.log(`Initiating job for shopId: ${shopId}`);

        const products = await prisma.product.findMany({
            where: { shopId: shopId },
            select: { id: true },
            take: 30
        });

        const totalProducts = products.length;
        console.log(`Total products to process: ${totalProducts}`);

        const batches = [];
        for (let i = 0; i < products.length; i += BATCH_SIZE) {
            batches.push(products.slice(i, i + BATCH_SIZE));
        }

        console.log(`Total number of batches: ${batches.length}`);

        // Create the job with totalBatches and initialize batchesCompleted to 0
        const newJob = await prisma.job.create({
            data: {
                shopId: shopId,
                status: "queued",
                progress: 0,
                errors: [],
                totalBatches: batches.length, // Store total batches
                batchesCompleted: 0 // Initialize batchesCompleted
            }
        });

        console.log(`Job created with id: ${newJob.id}`);

        for (let i = 0; i < batches.length; i++) {
            const batchJob = {
                jobId: newJob.id,
                shopId: shopId,
                batchId: i,
                productIds: batches[i].map(p => p.id),
                totalProducts: totalProducts,
                totalBatches: batches.length
            };

            const params = {
                MessageBody: JSON.stringify(batchJob),
                QueueUrl: SQS_QUEUE_URL,
                MessageGroupId: `${newJob.id}-${i}`, // Unique MessageGroupId per batch
                MessageDeduplicationId: `${newJob.id}-${i}-${Date.now()}` // Ensure uniqueness
            };

            try {
                await sqs.sendMessage(params).promise();
                console.log(`Published batch ${i} to SQS. Batch size: ${batches[i].length}`);
            } catch (sendError) {
                console.error(`Error sending batch ${i} to SQS:`, sendError);
            }
        }

        console.log(`Job ${newJob.id} queued successfully in ${batches.length} batches`);

        // End the timer and log the duration
        console.timeEnd(`Job duration for shopId: ${shopId}`);

        return { success: true, message: "Sync job queued successfully", jobId: newJob.id };
    } catch (error) {
        console.error("Error queueing sync job:", error);
        throw error;
    }
}

module.exports = { initiateJob };
