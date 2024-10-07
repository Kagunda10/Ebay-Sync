// file: app/routes/analytics.jsx
import { useEffect, useState, useCallback } from 'react';
import { useLoaderData, useNavigate, useFetcher } from '@remix-run/react';
import { AppProvider, Banner, BlockStack, DropZone, FooterHelp, Frame, Page, Text, InlineGrid, Grid, Divider, Toast } from '@shopify/polaris';
import translations from '@shopify/polaris/locales/en.json';
import polarisStyles from "@shopify/polaris/build/esm/styles.css";
import { json } from "@remix-run/node";
import db from '../db.server';
import { authenticate } from "../shopify.server";
import { getRecentActivities } from "app/routes/recentActivities";
import { getShopMetrics, determineSyncStatus, handleExport, handleSubmit } from "../../utils/shopifyUtils";
import ProductCard from "../components/ProductCard";
import ImportSection from "../components/ImportSection";
import ExportSection from "../components/ExportSection";
import RecentActivityTable from "../components/RecentActivityTable";
import SyncActions from "../components/SyncActions";
import JobStatus from '../components/JobStatus';
import { initiateJob } from '../queue.server';


export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const { shop } = session;
    const shopId = await findOrCreateShopIdByName(shop);

    let metrics = null;
    let activities = [];

    if (shop) {
        try {
            metrics = await getShopMetrics(shop);
            activities = await getRecentActivities(shop);
        } catch (error) {
            console.error("Failed to fetch data:", error);
            throw new Response("Error fetching data", { status: 500 });
        }
    }

    return json({ shop, metrics, activities, shopId });
};

export async function action({ request }) {
    try {
        const formData = await request.formData();
        const actionType = formData.get("actionType");
        const searchTerm = formData.get("searchTerm");
        const shopId = formData.get("shopId");

        const { admin } = await authenticate.admin(request);


        if (actionType === "sync") {
            console.log("Sync action triggered");
            const shopIdInt = parseInt(shopId, 10);
            const result = await initiateJob(shopIdInt);
            console.log("Sync job queued:", result);
            return json({ jobId: result.jobId, message: "Sync job started" });
        } else if (actionType === "checkJobStatus") {
            const jobId = formData.get("jobId");
            if (!jobId) {
                const activeJob = await db.job.findFirst({
                    where: { status: { in: ['waiting', 'active'] } },
                    orderBy: { createdAt: 'desc' }
                });
                return json({ activeJobId: activeJob?.id });
            }
            const job = await db.job.findUnique({
                where: { id: jobId }
            });

            if (!job) {
                return json({ error: "Job not found" }, { status: 404 });
            }

            return json({
                status: job.status,
                progress: job.progress,
                startedAt: job.startedAt,
                updatedAt: job.updatedAt
            });
        }

        return json({ error: "Invalid action type" }, { status: 400 });
    } catch (error) {
        console.error("Action Error:", error);
        return json({ errorMessage: "An error occurred while processing your request" }, { status: 500 });
    }
}


async function findOrCreateShopIdByName(shopName) {
    let shop;
    try {
        shop = await db.shop.findUnique({
            where: {
                name: shopName,
            },
        });
        if (!shop) {
            shop = await db.shop.create({
                data: {
                    name: shopName,
                },
            });
        }
    } catch (error) {
        console.error('Error in findOrCreateShopIdByName:', error);
        throw error;
    }
    return shop.id;
}

export default function Analytics() {
    const fetcher = useFetcher();
    const { shop, metrics, activities, shopId } = useLoaderData();
    const [file, setFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const [uploadStatus, setUploadStatus] = useState('');
    const [toastActive, setToastActive] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [syncDisabled, setSyncDisabled] = useState(false);
    const [limit, setLimit] = useState(10);
    const [jobId, setJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState(null);
    const [jobProgress, setJobProgress] = useState(0);
    const navigate = useNavigate();

    const toggleActive = useCallback(() => setToastActive(active => !active), []);
    const syncStatus = metrics ? determineSyncStatus(metrics.lastProductUpdateTime) : 'Loading...';
    const uploadURL = `/uploads?shop=${encodeURIComponent(shop.toString())}`;

    const syncAll = async () => {
        console.log('Sync all triggered');
        setSyncDisabled(true);
        setToastMessage('Starting sync job...');
        toggleActive();

        console.log('Submitting fetch request for sync...');
        fetcher.submit(
            { actionType: 'sync', shopId },
            { method: "post" }
        );
    };

    useEffect(() => {
        const checkJobStatus = () => {
            if (jobId) {
                console.log('Checking status for job:', jobId);
                fetcher.submit(
                    { actionType: 'checkJobStatus', jobId },
                    { method: "post" }
                );
            } else {
                console.log('Checking for active jobs...');
                fetcher.submit(
                    { actionType: 'checkJobStatus' },
                    { method: "post" }
                );
            }
        };

        const intervalId = setInterval(checkJobStatus, 10000);

        return () => clearInterval(intervalId);
    }, [fetcher, jobId]);

    useEffect(() => {
        console.log('Fetcher data:', fetcher.data);
        if (fetcher.data?.jobId) {
            console.log('Job ID received:', fetcher.data.jobId);
            setJobId(fetcher.data.jobId);
            setJobStatus('active');
            setJobProgress(0);
            setToastMessage('Sync job started');
            toggleActive();
        } else if (fetcher.data?.status) {
            setJobStatus(fetcher.data.status);
            setJobProgress(fetcher.data.progress || 0);
            if (fetcher.data.status === 'completed') {
                setSyncDisabled(false);
                setToastMessage('Sync completed successfully');
                toggleActive();
                setTimeout(() => {
                    setJobId(null);
                    setJobStatus(null);
                    setJobProgress(0);
                }, 3000);
            } else if (fetcher.data.status === 'failed') {
                setSyncDisabled(false);
                setToastMessage('Sync failed');
                toggleActive();
                setTimeout(() => {
                    setJobId(null);
                    setJobStatus(null);
                    setJobProgress(0);
                }, 3000);
            }
        } else if (fetcher.data?.activeJobId) {
            setJobId(fetcher.data.activeJobId);
            setJobStatus('active');
        }
    }, [fetcher.data, toggleActive]);


    const goBack = () => navigate(-1);

    const handleDropZoneDrop = useCallback((_dropFiles, acceptedFiles) => {
        const uploadedFile = acceptedFiles[0];
        setFile(uploadedFile);
        setFileName(uploadedFile.name);
    }, []);

    useEffect(() => {
        let timer;
        if (uploadStatus === 'success' || uploadStatus === 'error') {
            timer = setTimeout(() => {
                setFile(null);
                setFileName('');
                setUploadStatus('');
            }, uploadStatus === 'success' ? 5000 : 10000);
        }
        return () => clearTimeout(timer);
    }, [uploadStatus]);

    return (
        <AppProvider i18n={translations}>
            <Frame>
                {/* <SyncActions syncAll={syncAll} goBack={goBack} toastActive={toastActive} syncDisabled={syncDisabled} /> */}
                <SyncActions
                    syncAll={syncAll}
                    goBack={goBack}
                    syncDisabled={syncDisabled}
                />
                <Page title="Import/Export">
                    <BlockStack gap="800">
                        {/* <JobStatus jobId={jobId} jobStatus={jobStatus} jobProgress={jobProgress} /> */}
                        <InlineGrid gap="400" columns={3}>
                            <ProductCard title="Products" value={metrics ? metrics.totalProducts : 'Loading...'} description="Number of uploaded products" status='success' />
                            <ProductCard title="Cost of Inventory" value={`$${metrics ? metrics.totalProductsWorth : 'Loading...'}`} description="Worth of products" status='success' />
                            <ProductCard title="Shop Status" value={syncStatus} description={`Last sync: ${metrics ? metrics.lastProductUpdateTime : 'Loading...'}`} status={syncStatus === 'Up to Date' ? 'success' : 'critical'} />
                        </InlineGrid>
                        {uploadStatus === 'success' && <Banner status="success" title="File uploaded successfully!" />}
                        {uploadStatus === 'error' && <Banner status="critical" title="Error uploading file" />}
                        {fileName && <Text status='success' alignment="center" fontWeight='bold'>{`Uploaded file: ${fileName}`}</Text>}
                        {/* <Grid> */}
                        {/* <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}> */}
                        <ImportSection handleDropZoneDrop={handleDropZoneDrop} handleSubmit={() => handleSubmit(uploadURL, file, setUploadStatus)} fileName={fileName} uploadStatus={uploadStatus} />
                        {/* </Grid.Cell> */}
                        {/* <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}> */}
                        <ExportSection handleExport={(type) => handleExport(shop, type, setToastMessage, setToastActive)} />
                        {/* </Grid.Cell> */}
                        {/* </Grid> */}
                        <Divider />

                        <RecentActivityTable activities={activities} limit={limit} />
                        <Divider />
                        <FooterHelp />
                    </BlockStack>
                </Page>
                {toastActive && <Toast content={toastMessage} onDismiss={toggleActive} />}
            </Frame>
        </AppProvider>
    );
}
