import { useEffect, useState, useCallback } from 'react';
import { Component } from 'react'
import { useLocation, useFetcher, Link, useLoaderData, useNavigate } from '@remix-run/react'; // Confirm that useLocation is correctly imported.
import { Page, Card, Button, ButtonGroup, Text, Frame, AppProvider, Navigation, Banner, PageActions, Toast } from '@shopify/polaris'; // Confirm these imports.
import translations from '@shopify/polaris/locales/en.json';
import polarisStyles from "@shopify/polaris/build/esm/styles.css"
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";


export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const { shop } = session;

    return json({ shop });
};

export default function ExportPage() {
    const fetcher = useFetcher();
    const [message, setMessage] = useState("");
    const [showBanner, setShowBanner] = useState(false);

    const [toastActive, setToastActive] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const navigate = useNavigate();

    const toggleActive = useCallback(() => setToastActive((active) => !active), []);

    const syncAll = async () => {
        setToastMessage('Sync has started');
        toggleActive();
        setTimeout(() => {
            toggleActive(); // Hide the toast after 3 seconds
        }, 3000);

        // Add your sync logic here
        console.log('Sync process has started...');
    };

    const goBack = () => navigate(-1);

    const toastMarkup = toastActive ? (
        <Toast content={toastMessage} onDismiss={toggleActive} />
    ) : null;


    // Function to handle export based on type
    const handleExport = async (type) => {
        try {
            const response = await fetch(`/exports?exportType=${type}`);
            if (response.ok) {
                const contentDisposition = response.headers.get('Content-Disposition');
                if (contentDisposition && contentDisposition.indexOf('attachment') !== -1) {
                    const blob = await response.blob();
                    const downloadUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = contentDisposition.split('filename=')[1].replaceAll('"', '');
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                } else {
                    const data = await response.json();
                    setMessage(data.message);
                    setShowBanner(true);
                }
            } else {
                throw new Error("Failed to fetch data. Server responded with an error.");
            }
        } catch (error) {
            setMessage(error.message || "An error occurred.");
            setShowBanner(true);
        }
    };

    // Effect to manage notifications
    useEffect(() => {
        if (fetcher.data && fetcher.data.message) {
            setMessage(fetcher.data.message);
            setShowBanner(true);

            const timer = setTimeout(() => {
                setShowBanner(false);
                setMessage("");
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [fetcher.data]);

    return (
        <AppProvider i18n={translations}>
            <Frame >
                <div style={{ padding: '20px' }}>
                    <PageActions
                        primaryAction={{
                            content: 'Sync',
                            onAction: syncAll,
                            loading: toastActive, // Optionally show loading state when sync is active
                            style: { backgroundColor: 'green', color: 'white' }
                        }}
                        secondaryActions={[{
                            content: 'Back',
                            onAction: goBack
                        }]}
                    />
                </div>
                <Page title="Export Products" narrowWidth>
                    <Card sectioned>
                        <Text>
                            <p>Use the buttons below to export products from your store. You can export all products or only those that are out of stock.</p>
                        </Text>
                        <Button onClick={() => handleExport("all")}>Export All Products</Button>
                        <Button onClick={() => handleExport("zeroQuantity")}>Export Out of Stock Products</Button>
                    </Card>
                    {showBanner && message && (
                        <Banner status="info" onDismiss={() => setShowBanner(false)}>
                            {message}
                        </Banner>
                    )}
                </Page>
                {toastMarkup}
            </Frame>
        </AppProvider>
    );
}

