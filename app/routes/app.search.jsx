// file: app/routes/search.jsx
import { useState, useEffect, useCallback } from 'react';
import { useFetcher, useNavigate, useLoaderData } from "@remix-run/react";
import db from '../db.server';
import { json } from "@remix-run/node";
import { AppProvider, Banner, BlockStack, ProgressBar, Avatar, Frame, Page, Toast, CalloutCard, ButtonGroup, Button, Modal, ResourceList, Text } from '@shopify/polaris';
import translations from '@shopify/polaris/locales/en.json';
import polarisStyles from "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";
import SyncActions from "../components/SyncActions";
import SearchForm from "../components/SearchForm";
import ProductDetails from "../components/ProductDetails";
import UpdateForm from "../components/UpdateForm";
import VariantList from "../components/VariantList";
import JobStatus from '../components/JobStatus';
import { initiateJob } from '../queue.server';

import fetch from 'node-fetch';


export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
    try {
        const { session, admin } = await authenticate.admin(request);
        const { shop } = session;
        const shopId = await findOrCreateShopIdByName(shop);

        const url = new URL(request.url);
        const searchTerm = url.searchParams.get("searchTerm");
        const actionType = url.searchParams.get("actionType");

        console.log("Search Term:", shop);
        console.log("Action Type:", actionType);


        return json({ shop, searchTerm, actionType, shopId });
    } catch (error) {
        console.error("Loader Error:", error);
        return json({ errorMessage: "Failed to load shop data" }, { status: 500 });
    }
};

export async function action({ request }) {
    try {
        const formData = await request.formData();
        const actionType = formData.get("actionType");
        const searchTerm = formData.get("searchTerm");
        const shop = formData.get("shop");
        // const shopId = formData.get("shopId");

        const { admin } = await authenticate.admin(request);


        if (actionType === "search") {
            const shopId = await findOrCreateShopIdByName(shop);
            console.log("Searching for SKU prefix:", searchTerm);

            // First, search the Prisma database for SKUs with the given prefix
            const matchingProducts = await db.product.findMany({
                where: {
                    SKU: {
                        contains: searchTerm
                    },
                    shop: {
                        name: shop
                    }
                },
                take: 10 // Limit to 10 results
            });

            console.log("Matching products from Prisma:", matchingProducts.length);

            if (matchingProducts.length === 0) {
                return json({ errorMessage: "No products found with the provided SKU prefix" }, { status: 404 });
            }

            // If we have matching products, query Shopify for each one
            const skus = matchingProducts.map(product => product.SKU);
            const shopifyVariants = [];

            for (const sku of skus) {
                const response = await admin.graphql(
                    `#graphql
                    query getProductByVariantSKU($sku: String!) {
                        productVariants(first: 1, query: $sku) {
                            edges {
                                node {
                                    id
                                    sku
                                    inventoryQuantity
                                    price
                                    product {
                                        id
                                        title
                                        featuredImage {
                                            originalSrc
                                        }
                                    }
                                }
                            }
                        }
                    }`,
                    {
                        variables: {
                            sku: `sku:${sku}`
                        },
                    }
                );

                const responseJson = await response.json();
                const variant = responseJson.data.productVariants.edges[0]?.node;

                if (variant) {
                    const prismaProduct = matchingProducts.find(p => p.SKU === variant.sku);
                    shopifyVariants.push({
                        ...variant,
                        url: prismaProduct.URL,
                        markup: prismaProduct.markup,
                        condition: prismaProduct.condition,
                        prismaPrice: prismaProduct.price,
                        prismaQuantity: prismaProduct.quantity
                    });
                }
            }

            console.log("Matching Shopify variants:", shopifyVariants.length);

            if (shopifyVariants.length === 0) {
                return json({ errorMessage: "No matching products found in Shopify" }, { status: 404 });
            }

            if (shopifyVariants.length === 1) {
                // If only one variant is found, return it as productData
                const variantData = shopifyVariants[0];
                const productData = {
                    id: variantData.product.id,
                    title: variantData.product.title,
                    image: variantData.product.featuredImage?.originalSrc,
                    price: variantData.price,
                    inventoryQuantity: variantData.inventoryQuantity,
                    sku: variantData.sku,
                    variantId: variantData.id,
                    url: variantData.url,
                    markup: variantData.markup,
                    condition: variantData.condition,
                    prismaPrice: variantData.prismaPrice,
                    prismaQuantity: variantData.prismaQuantity
                };

                return json({ productData });
            } else {
                // If multiple variants are found, return the list
                return json({ variants: shopifyVariants });
            }
        } else if (actionType === "update") {
            const sku = formData.get("sku");
            const newUrl = formData.get("newUrl");
            const markup = parseInt(formData.get("markup"), 10);
            const shopId = await findOrCreateShopIdByName(shop);

            // First, try to find the existing product
            const existingProduct = await db.product.findUnique({
                where: { SKU_shopId: { SKU: sku, shopId: shopId } },
            });

            if (existingProduct) {
                // If product exists, update it
                await db.product.update({
                    where: { SKU_shopId: { SKU: sku, shopId: shopId } },
                    data: { URL: newUrl, markup: markup },
                });
                return json({ successMessage: "Product URL updated successfully" });
            } else {
                // If product does not exist, create a new one
                await db.product.create({
                    data: { SKU: sku, URL: newUrl, shopId: shopId, markup: markup },
                });
                return json({ successMessage: "Product created successfully" });

            }
        } else if (actionType === "delete") {
            const sku = formData.get("sku");
            const shopId = await findOrCreateShopIdByName(shop);

            const productToDelete = await db.product.findUnique({
                where: { SKU_shopId: { SKU: sku, shopId: shopId } },
            });

            if (productToDelete) {
                await db.product.delete({
                    where: { SKU_shopId: { SKU: sku, shopId: shopId } },
                });
                return json({ successMessage: "Product deleted successfully" });
            } else {
                return json({ errorMessage: "Product not found" }, { status: 404 });
            }
        } else if (actionType === "refresh") {
            const sku = formData.get("sku");
            const url = formData.get("newUrl");
            const shopId = await findOrCreateShopIdByName(shop);

            // TODO: Add scraping of one variant 
            // Perform the eBay scraping request
            const ebayResponse = await fetch('https://93iq20us2l.execute-api.us-east-2.amazonaws.com/default/ebayScraper', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url }) // Use the URL from form data
            });

            if (!ebayResponse.ok) {
                throw new Error('Failed to fetch eBay data');
            }
            // const regex = /\/itm\/(\d+)(?:\?|$)/;
            // const match = url.match(regex);
            // const itemId = match ? match[1] : null;
            // const ebayRes = await fetch(`/fetch-item-details?itemid=${itemId}`);
            // console.log(ebayRes);

            const { condition, price, availability } = ebayResponse;


            // Persist the new data 
            const existingProduct = await db.product.findUnique({
                where: { SKU_shopId: { SKU: sku, shopId: shopId } },
            });

            if (existingProduct) {
                // If product exists, update it
                await db.product.update({
                    where: { SKU_shopId: { SKU: sku, shopId: shopId } },
                    data: { condition: condition, price: price, quantity: availability },
                });
                return json({ successMessage: "Product data refreshed successfully" });
            } else {

                return json({ successMessage: "Product does not exist" });

            }

            // return json({ successMessage: "Product data refreshed successfully", ebayData });
        } else if (actionType === "sync") {
            console.log("Form Data:", Object.fromEntries(formData));
            const shopId = formData.get("shopId");// Log the form data
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

export default function SearchPage() {
    const fetcher = useFetcher();
    const { shop, searchTerm: initialSearchTerm, actionType: initialActionType, shopId } = useLoaderData();
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
    const [actionType, setActionType] = useState(initialActionType || '');
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [currentUrl, setCurrentUrl] = useState('');
    const [markup, setCurrentMarkup] = useState('');
    const [showSearchForm, setShowSearchForm] = useState(true);
    const [isNew, setIsNew] = useState(false);
    const [toastActive, setToastActive] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [error, setError] = useState('');
    const [syncDisabled, setSyncDisabled] = useState(false);
    const [showEbayModal, setShowEbayModal] = useState(false);
    const [ebayResults, setEbayResults] = useState([]);
    const [bannerVisible, setBannerVisible] = useState(false);
    const [jobId, setJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState(null);
    const [jobProgress, setJobProgress] = useState(0);
    const navigate = useNavigate();

    // New state for variant list
    const [showVariantList, setShowVariantList] = useState(false);
    const [variants, setVariants] = useState([]);

    const toggleActive = useCallback(() => setToastActive(active => !active), []);


    const goBack = () => navigate(-1);

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
    // useEffect(() => {
    //     const checkJobStatus = () => {
    //         if (jobId) {
    //             console.log('Checking status for job:', jobId);
    //             fetcher.submit(
    //                 { actionType: 'checkJobStatus', jobId },
    //                 { method: "post" }
    //             );
    //         } else {
    //             console.log('Checking for active jobs...');
    //             fetcher.submit(
    //                 { actionType: 'checkJobStatus' },
    //                 { method: "post" }
    //             );
    //         }
    //     };

    //     const intervalId = setInterval(checkJobStatus, 10000);

    //     return () => clearInterval(intervalId);
    // }, [fetcher, jobId]);

    // useEffect(() => {
    //     console.log('Fetcher data:', fetcher.data);
    //     if (fetcher.data?.jobId) {
    //         console.log('Job ID received:', fetcher.data.jobId);
    //         setJobId(fetcher.data.jobId);
    //         setJobStatus('active');
    //         setJobProgress(0);
    //         setToastMessage('Sync job started');
    //         toggleActive();
    //     } else if (fetcher.data?.status) {
    //         setJobStatus(fetcher.data.status);
    //         setJobProgress(fetcher.data.progress || 0);
    //         if (fetcher.data.status === 'completed') {
    //             setSyncDisabled(false);
    //             setToastMessage('Sync completed successfully');
    //             toggleActive();
    //             setTimeout(() => {
    //                 setJobId(null);
    //                 setJobStatus(null);
    //                 setJobProgress(0);
    //             }, 3000);
    //         } else if (fetcher.data.status === 'failed') {
    //             setSyncDisabled(false);
    //             setToastMessage('Sync failed');
    //             toggleActive();
    //             setTimeout(() => {
    //                 setJobId(null);
    //                 setJobStatus(null);
    //                 setJobProgress(0);
    //             }, 3000);
    //         }
    //     } else if (fetcher.data?.activeJobId) {
    //         setJobId(fetcher.data.activeJobId);
    //         setJobStatus('active');
    //     }
    // }, [fetcher.data, toggleActive]);



    const toastMarkup = toastActive ? (
        <Toast content={toastMessage} onDismiss={toggleActive} />
    ) : null;

    const resetForm = () => {
        setSearchTerm('');
        setCurrentUrl('');
        setCurrentMarkup('');
        setShowSearchForm(true);
        setIsNew(false);
        setError('');
        setShowVariantList(false);
        setVariants([]);
    };

    // Trigger fetcher when searchTerm and actionType are available
    useEffect(() => {
        if (!hasSubmitted && searchTerm && actionType === "search") {
            fetcher.submit(
                { searchTerm, actionType, shop },
                { method: "post", action: "/app/test/search" }
            );
            setHasSubmitted(true);
        }
    }, [searchTerm, actionType, shop, hasSubmitted, fetcher]);

    useEffect(() => {
        if (fetcher.data?.successMessage) {
            setHasSubmitted(false);
        }
    }, [fetcher.data?.successMessage]);

    useEffect(() => {
        if (fetcher.data?.productData) {
            setCurrentUrl(fetcher.data.productData.url || '');
            setCurrentMarkup(fetcher.data.productData.markup || '');
            setShowSearchForm(false);
            setShowVariantList(false);
            setError('');
        } else if (fetcher.data?.variants) {
            setVariants(fetcher.data.variants);
            setShowVariantList(true);
            setShowSearchForm(false);
            setError('');
        } else if (fetcher.data?.errorMessage) {
            setError(fetcher.data.errorMessage);
        }
    }, [fetcher.data]);

    useEffect(() => {
        if (fetcher.data?.successMessage) {
            setToastMessage(fetcher.data.successMessage);
            setToastActive(true);
            resetForm();
        }
    }, [fetcher.data?.successMessage]);

    const handleSearchEbay = async () => {
        const response = await fetch(`/ebay-search?title=${fetcher.data.productData.title}`);
        const data = await response.json();
        setEbayResults(data.results);
        setShowEbayModal(true);
    };

    const handleSelectEbayItem = (url) => {
        setCurrentUrl(url);
        setShowEbayModal(false);
        setBannerVisible(true);
        setTimeout(() => {
            setBannerVisible(false);
        }, 3000);
    };

    const handleSelectVariant = (variant) => {
        const productData = {
            id: variant.product.id,
            title: variant.product.title,
            image: variant.product.featuredImage?.originalSrc,
            price: variant.price,
            inventoryQuantity: variant.inventoryQuantity,
            sku: variant.sku,
            variantId: variant.id,
            url: variant.url,
            markup: variant.markup,
        };
        fetcher.data = { productData };
        setShowVariantList(false);
    };


    return (
        <AppProvider i18n={translations}>
            <Frame>
                {bannerVisible && <Banner status="success">URL updated successfully</Banner>}
                <SyncActions
                    syncAll={syncAll}
                    goBack={goBack}
                    syncDisabled={syncDisabled}
                />

                <Page title="Product Search and Update">
                    <BlockStack gap="800">
                        {/* <JobStatus jobId={jobId} jobStatus={jobStatus} jobProgress={jobProgress} /> */}

                        {error && <Banner status="critical" role="alert">{error}</Banner>}
                        {showSearchForm && (
                            <SearchForm
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                translations={translations}
                                fetcher={fetcher}
                                shop={shop}
                            />
                        )}
                        {showVariantList && (
                            <VariantList
                                variants={variants}
                                onSelectVariant={handleSelectVariant}
                            />
                        )}
                        {fetcher.data?.productData && !showSearchForm && !showVariantList && (
                            <>
                                <ProductDetails productData={fetcher.data.productData} translations={translations} />
                                <UpdateForm
                                    currentUrl={currentUrl}
                                    markup={markup}
                                    setCurrentUrl={setCurrentUrl}
                                    setCurrentMarkup={setCurrentMarkup}
                                    productData={fetcher.data.productData}
                                    translations={translations}
                                    fetcher={fetcher}
                                    shop={shop}
                                />
                                {fetcher.data?.successMessage && <Banner status="success" role="status">{fetcher.data.successMessage}</Banner>}
                                <CalloutCard
                                    title="Could not find what you are looking for?"
                                    illustration="data:image/svg+xml,%3c?xml%20version='1.0'%20encoding='utf-8'?%3e%3c!--%20Generator:%20Adobe%20Illustrator%2022.0.1,%20SVG%20Export%20Plug-In%20.%20SVG%20Version:%206.00%20Build%200)%20--%3e%3csvg%20version='1.1'%20id='Layer_1'%20xmlns='http://www.w3.org/2000/svg'%20xmlns:xlink='http://www.w3.org/1999/xlink'%20x='0px'%20y='0px'%20viewBox='0%200%201080%201080'%20style='enable-background:new%200%200%201080%201080;'%20xml:space='preserve'%3e%3cstyle%20type='text/css'%3e%20.st0{fill:%23D3D5DD;}%20.st1{fill:%23FFFFFF;}%20%3c/style%3e%3ccircle%20class='st0'%20cx='540'%20cy='540'%20r='475'/%3e%3cpath%20class='st1'%20d='M791.6,318.5c0,25.2-20.5,45.7-45.7,45.7c-1.1,0-2.1,0-3.2-0.1l-408.5-1.4v-0.2c-25.2,0-45.7-20.5-45.7-45.8%20s20.4-44.9,45.7-44.9l411.7,1C771.1,272.8,791.6,293.3,791.6,318.5z'/%3e%3cpath%20class='st1'%20d='M718.4,761.4v2.8c0,4.7-0.6,9.3-1.9,13.5c0,0.1,0,0.2,0,0.2c-4.8,15.3-17.5,27.2-33.3,30.9%20c-0.4,0-0.7,0.1-1.1,0.2c-0.3,0.1-0.7,0.1-1,0.2c-0.4,0.1-0.8,0.2-1.2,0.2c-0.3,0.1-0.7,0.2-1,0.2c-0.7,0.1-1.3,0.1-1.9,0.2%20c-0.2,0.1-0.5,0.1-0.7,0.1c-0.9,0.1-1.9,0.1-2.9,0.1h-0.1c-0.1,0-0.2,0-0.3,0H407.3c-25.3,0-45.7-19.6-45.7-44.9%20c0-25.3,20.1-45.4,45.3-45.4l15.2-0.7l140.9-0.2l-187.9-188c-17.9-17.9-18.5-46.2-0.6-64.1c17.9-17.9,46.3-17.9,64.1-0.1l89.1,88.2%20l99.9,99.7l-0.2-152.6c-0.1-1.1-0.1-2.1-0.1-3.2c0-25.2,20.5-45.7,45.7-45.7s45.7,20.5,45.7,45.7L718.4,761.4z'/%3e%3c/svg%3e"
                                    primaryAction={{
                                        content: 'Search Ebay',
                                        onAction: handleSearchEbay,
                                        variant: 'primary'
                                    }}
                                >
                                    <p>You can run the search for the product on eBay</p>
                                </CalloutCard>
                            </>
                        )}
                        <CalloutCard
                            title="Don't have any products yet?"
                            illustration="data:image/svg+xml,%3c?xml%20version='1.0'%20encoding='utf-8'?%3e%3c!--%20Generator:%20Adobe%20Illustrator%2022.0.1,%20SVG%20Export%20Plug-In%20.%20SVG%20Version:%206.00%20Build%200)%20--%3e%3csvg%20version='1.1'%20id='Layer_1'%20xmlns='http://www.w3.org/2000/svg'%20xmlns:xlink='http://www.w3.org/1999/xlink'%20x='0px'%20y='0px'%20viewBox='0%200%201080%201080'%20style='enable-background:new%200%200%201080%201080;'%20xml:space='preserve'%3e%3cstyle%20type='text/css'%3e%20.st0{fill:%23D3D5DD;}%20.st1{fill:%23FFFFFF;}%20%3c/style%3e%3ccircle%20class='st0'%20cx='540'%20cy='540'%20r='475'/%3e%3cpath%20class='st1'%20d='M791.6,318.5c0,25.2-20.5,45.7-45.7,45.7c-1.1,0-2.1,0-3.2-0.1l-408.5-1.4v-0.2c-25.2,0-45.7-20.5-45.7-45.8%20s20.4-44.9,45.7-44.9l411.7,1C771.1,272.8,791.6,293.3,791.6,318.5z'/%3e%3cpath%20class='st1'%20d='M718.4,761.4v2.8c0,4.7-0.6,9.3-1.9,13.5c0,0.1,0,0.2,0,0.2c-4.8,15.3-17.5,27.2-33.3,30.9%20c-0.4,0-0.7,0.1-1.1,0.2c-0.3,0.1-0.7,0.1-1,0.2c-0.4,0.1-0.8,0.2-1.2,0.2c-0.3,0.1-0.7,0.2-1,0.2c-0.7,0.1-1.3,0.1-1.9,0.2%20c-0.2,0.1-0.5,0.1-0.7,0.1c-0.9,0.1-1.9,0.1-2.9,0.1h-0.1c-0.1,0-0.2,0-0.3,0H407.3c-25.3,0-45.7-19.6-45.7-44.9%20c0-25.3,20.1-45.4,45.3-45.4l15.2-0.7l140.9-0.2l-187.9-188c-17.9-17.9-18.5-46.2-0.6-64.1c17.9-17.9,46.3-17.9,64.1-0.1l89.1,88.2%20l99.9,99.7l-0.2-152.6c-0.1-1.1-0.1-2.1-0.1-3.2c0-25.2,20.5-45.7,45.7-45.7s45.7,20.5,45.7,45.7L718.4,761.4z'/%3e%3c/svg%3e"
                            primaryAction={{
                                content: 'Bulk import',
                                onAction: () => navigate('/app/import'),
                                variant: 'primary'
                            }}
                        >
                            <p>Take the first step in growing your business by uploading your product details. Start now to provide competitive pricing!</p>
                        </CalloutCard>
                    </BlockStack>
                </Page>
                {toastMarkup}
                <Modal
                    open={showEbayModal}
                    onClose={() => setShowEbayModal(false)}
                    title="eBay Search Results"
                    primaryAction={{
                        content: 'Close',
                        onAction: () => setShowEbayModal(false),
                    }}
                >
                    <Modal.Section>
                        {ebayResults.length > 0 ? (
                            <ResourceList
                                resourceName={{ singular: 'product', plural: 'products' }}
                                items={ebayResults}
                                renderItem={(item) => {
                                    const { title, price, condition, itemWebUrl, image } = item;
                                    return (
                                        <ResourceList.Item
                                            id={title}
                                            accessibilityLabel={`View details for ${title}`}
                                            onClick={() => handleSelectEbayItem(itemWebUrl)}
                                            media={<Avatar source={image} size="xl" />}
                                        >
                                            <h3>
                                                <Text variation="strong" tone="success">
                                                    <a href={itemWebUrl} target="_blank" rel="noopener noreferrer">
                                                        {title}
                                                    </a>
                                                </Text>
                                            </h3>
                                            <div>Price: {price}</div>
                                            <div>Condition: {condition}</div>
                                        </ResourceList.Item>
                                    );
                                }}
                            />
                        ) : (
                            <Banner status="info">
                                Nothing to show here, Try again later or use a different product
                            </Banner>
                        )}
                    </Modal.Section>
                </Modal>
            </Frame>
        </AppProvider>
    );
}
