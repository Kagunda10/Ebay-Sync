import React, { useState, useEffect } from 'react';
import { useLocation } from "@remix-run/react";
import { Page, Card, Select, TextField, Button, Banner, AppProvider, Layout, Text, Navigation, Frame } from '@shopify/polaris';
import translations from '@shopify/polaris/locales/en.json';
import polarisStyles from "@shopify/polaris/build/esm/styles.css";
import { PlusIcon } from '@shopify/polaris-icons';

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

const Navbar = () => {
    const location = useLocation(); // Get the current location object

    const navItems = [
        { url: '/upload', label: 'Upload' },
        { url: '/search', label: 'Search' },
        { url: '/configuration', label: 'Configuration' },
    ];

    return (
        <Navigation location="/">
            <Navigation.Section
                items={navItems.map(item => ({
                    ...item,
                    label: location.pathname === item.url ? <strong>{item.label}</strong> : item.label, // Conditionally apply bold style
                }))}
            />
        </Navigation>
    );
};


// Real POST request to specified URL
const postRequest = async (url, data) => {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return await response.json(); // Assuming the response is in JSON format
    } catch (error) {
        console.error('Error making a POST request:', error);
        throw error; // Rethrow to handle it in the calling function
    }
};

// Mock GET request to /status remains the same
const mockGetRequest = async (url) => {
    console.log(`Mock GET request to ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate a delay
    const currentDateTime = new Date().toISOString(); // Simulate a successful response with current date and time
    return { status: 200, dateTime: currentDateTime };
};

const Configuration = () => {
    const [frequency, setFrequency] = useState('Daily');
    const [markup, setMarkup] = useState('1.00');
    const [message, setMessage] = useState('');
    const [dateTime, setDateTime] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const { status, dateTime } = await mockGetRequest('/status');
                if (status === 200) {
                    setDateTime(dateTime);
                }
            } catch (error) {
                console.error('Error fetching status:', error);
            }
        };
        fetchStatus();
    }, []);

    const handleFrequencyChange = (newValue) => setFrequency(newValue);
    const handleMarkupChange = (newValue) => setMarkup(newValue);

    const handleSubmit = async () => {
        setError(''); // Reset error message
        try {
            const { status, message } = await postRequest('https://2ba2-3-144-167-0.ngrok-free.app/configuration', { frequency, markup });
            console.log(status, message);
            if (status === 200) {
                setMessage(message);
            } else {
                setMessage('Error setting configuration');
            }
        } catch (error) {
            // console.error('Error setting configuration:', error);
            setError('Error setting configuration, please try again later.');
        }
    };

    return (
        <AppProvider i18n={translations}>
            <Frame navigation={<Navbar />}> {/* Wrap your content with Frame and include Navbar */}

                <Page title="Configuration">
                    <ui-title-bar title="DATASYNC PRO">
                    </ui-title-bar>
                    <Layout>
                        <Layout.Section>
                            <Text variation="subdued">{dateTime}</Text>
                        </Layout.Section>
                        <Layout.Section>
                            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                                <Card sectioned>
                                    {message && <Banner status="success" onDismiss={() => setMessage('')}>{message}</Banner>}
                                    {error && <Banner status="critical" onDismiss={() => setError('')}>{error}</Banner>}
                                    <div style={{ margin: '0 auto', maxWidth: '400px' }}>
                                        <Select
                                            label="Frequency"
                                            options={['Daily', 'Weekly', 'Monthly']}
                                            onChange={handleFrequencyChange}
                                            value={frequency}
                                        />
                                        {/* Added spacing between Frequency and Markup */}
                                        <div style={{ marginTop: '20px' }}>
                                            <TextField
                                                label="Markup"
                                                type="number"
                                                value={markup}
                                                onChange={handleMarkupChange}
                                                prefix="%"
                                                helpText="Specify the markup percentage."
                                            />
                                        </div>
                                        {/* Added spacing between Markup and Set button */}
                                        <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                            <Button onClick={handleSubmit}
                                                variant='primary'
                                                primary size="large"
                                                icon={PlusIcon}
                                                tone="success">Set</Button>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </Layout.Section>
                    </Layout>
                </Page>
            </Frame>
        </AppProvider>
    );

};

export default Configuration;
