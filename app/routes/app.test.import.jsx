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

        console.log('Submitting fetch request...');
        fetcher.submit(
            { shopId: shopId, action: 'start' },
            { method: "post", action: "/api/scrape" }
        );
    };

    // In your useEffect for handling fetcher data
    useEffect(() => {
        console.log('Fetcher data:', fetcher.data);
        if (fetcher.data?.jobId) {
            console.log('Job ID received:', fetcher.data.jobId);
            setJobId(fetcher.data.jobId);
            setToastMessage(fetcher.data.message);
            toggleActive();
        } else if (fetcher.data?.status) {
            console.log('Job status update:', fetcher.data.status);
            setJobStatus(fetcher.data.status);
            setJobProgress(fetcher.data.progress || 0);
            if (fetcher.data.status === 'completed') {
                setSyncDisabled(false);
                setJobId(null);
                setToastMessage('Sync completed successfully');
                toggleActive();
            }
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
                        <JobStatus />
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
