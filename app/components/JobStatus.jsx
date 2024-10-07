import React, { useEffect, useState } from 'react';
import { Banner, ProgressBar, Text, BlockStack } from '@shopify/polaris';

export default function JobStatus({ jobId, jobStatus, jobProgress }) {
    const [startTime, setStartTime] = useState(null);
    const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(null);

    useEffect(() => {
        if (jobId && jobStatus === 'active' && !startTime) {
            setStartTime(Date.now());
        }
    }, [jobId, jobStatus, startTime]);

    useEffect(() => {
        if (startTime && jobProgress > 0) {
            const elapsedTime = (Date.now() - startTime) / 1000;
            const estimatedTotalTime = elapsedTime / (jobProgress / 100);
            const timeRemaining = Math.max(0, estimatedTotalTime - elapsedTime);
            setEstimatedTimeRemaining(formatTime(timeRemaining));
        }

        if (['completed', 'failed'].includes(jobStatus)) {
            console.log('Job completed or failed. Resetting in 3 seconds.');
            setTimeout(() => {
                setStartTime(null);
                setEstimatedTimeRemaining(null);
            }, 3000);
        }
    }, [jobStatus, jobProgress, startTime]);

    if (!jobId) {
        return (
            <Banner title="Product Sync Status" tone="info">
                <p>No active sync job at the moment. Use the 'Sync All' button to start a new sync.</p>
            </Banner>
        );
    }

    console.log('Rendering JobStatus component');
    return (
        <Banner
            title='Your products are syncing'
            tone={jobStatus === 'failed' ? 'critical' : 'success'}
            status="info">
            <BlockStack gap="200">
                <Text variant="bodyMd" as="p">
                    Job Status: {jobStatus || 'In Progress'}
                </Text>

                <div style={{ flexGrow: 1 }}>
                    <ProgressBar progress={jobProgress} size="small" />
                </div>
                {estimatedTimeRemaining && (
                    <Text variant="bodySm">
                        Est. time remaining: {estimatedTimeRemaining}
                    </Text>
                )}
            </BlockStack>
        </Banner>
    );
}

function formatTime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.round(seconds % 60);

    let timeString = '';
    if (days > 0) timeString += `${days}d `;
    if (hours > 0) timeString += `${hours}h `;
    if (minutes > 0) timeString += `${minutes}m `;
    if (remainingSeconds > 0 || timeString === '') timeString += `${remainingSeconds}s`;

    return timeString.trim();
}