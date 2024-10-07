import React, { useState, useCallback, useEffect } from 'react';
import { useLocation, useLoaderData, useNavigate } from "@remix-run/react";
import { AppProvider, Frame, Page, Layout, Card, DropZone, Button, Banner, BlockStack, Text, List, Navigation, Toast, PageActions } from '@shopify/polaris';
import translations from '@shopify/polaris/locales/en.json';
import polarisStyles from "@shopify/polaris/build/esm/styles.css";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";



export const links = () => [{ rel: "stylesheet", href: polarisStyles }];


export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const { shop } = session;

    return json({ shop });
};


export default function UploadPage() {
    const { shop } = useLoaderData();


    const uploadURL = `/uploads?shop=${encodeURIComponent(shop.toString())}`;
    console.log(uploadURL);

    const [file, setFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const [uploadStatus, setUploadStatus] = useState('');

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

    const handleDropZoneDrop = useCallback((_dropFiles, acceptedFiles, _rejectedFiles) => {
        const uploadedFile = acceptedFiles[0];
        setFile(uploadedFile);
        setFileName(uploadedFile.name);
    }, []);

    const handleSubmit = async (shop) => {
        if (!file) return;

        const formData = new FormData();

        formData.append('file', file);
        // formData.append('shop', shop);
        for (let [key, value] of formData.entries()) {
            console.log(key, value[0]);
        }
        try {

            const response = await fetch(uploadURL, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Error uploading the file, ensure that the csv format is correct');
            setUploadStatus('success');
        } catch (error) {
            console.error('Error uploading the file, ensure that the csv format is correct', error);
            setUploadStatus('error');
        }
    };
    useEffect(() => {
        // This code runs only in the client-side environment
        const fullURL = window.location.href; // Access the full URL
        const url = new URL(fullURL);
        const shop = url.searchParams.get('shop');

    }, []); // An empty dependency array ensures this effect runs only once after the initial render


    useEffect(() => {

        let timer;

        if (uploadStatus === 'success') {
            timer = setTimeout(() => {
                // Resets the state after a successful upload
                setFile(null);
                setFileName('');
                setUploadStatus('');
            }, 5000); // Adjust the delay as needed
        } else if (uploadStatus === 'error') {
            timer = setTimeout(() => {
                // Resets the state after showing the error banner
                // This allows the user to try uploading a file again
                setFile(null);
                setFileName('');
                setUploadStatus('');
            }, 10000); // Adjust the delay as needed, giving more time for the user to read the error
        }

        return () => clearTimeout(timer);
    }, [uploadStatus]);

    return (
        <AppProvider i18n={translations}>
            <Frame> {/* Wrap your content with Frame and include Navbar */}
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
                <Page title="File Upload" narrowWidth>
                    {/* <ui-title-bar title="DATASYNC PRO">
                    </ui-title-bar> */}
                    <Layout>
                        <Layout.Section>
                            {uploadStatus === 'success' && <Banner status="success" title="File uploaded successfully!" />}
                            {uploadStatus === 'error' && <Banner status="critical" title="Error uploading file" />}
                            {fileName && <Text>{`Uploaded file: ${fileName}`}</Text>}
                        </Layout.Section>
                        <Layout.Section>
                            <Card>
                                <Card sectioned>
                                    <BlockStack spacing="tight">
                                        <Text variant="headingMd">Required CSV Format:</Text>
                                        <List type="bullet">
                                            <List.Item>SKU</List.Item>
                                            <List.Item>Source URL</List.Item>
                                        </List>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <Text style={{ marginLeft: '8px' }}>Review this format carefully before uploading your file. Ensure that your CSV file has the above columns.</Text>
                                        </div>
                                    </BlockStack>
                                </Card>
                            </Card>
                            <Card sectioned>
                                <BlockStack spacing="tight">
                                    <Text variant="headingMd" as="h2">Upload your CSV file</Text>
                                    <Text as="p">Please ensure your file adheres to the specified format before uploading.</Text>
                                </BlockStack>
                                <DropZone onDrop={handleDropZoneDrop} accept=".csv">
                                    <DropZone.FileUpload />
                                </DropZone>
                            </Card>
                            <div style={{ marginTop: '12px', textAlign: 'right' }}>
                                <Button variant="primary" tone='success' onClick={handleSubmit}>Upload File</Button>
                            </div>
                        </Layout.Section>
                    </Layout>
                </Page>
                {toastMarkup}
            </Frame>
        </AppProvider>
    );


}