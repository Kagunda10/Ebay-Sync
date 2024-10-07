// file: app/routes/search.jsx
import { useState, useEffect, useCallback } from 'react';
import { useFetcher, useNavigate, useLoaderData } from "@remix-run/react";
import db from '../db.server';
import { json } from "@remix-run/node";
import { AppProvider, Banner, BlockStack, Frame, Page, Toast, CalloutCard, ButtonGroup, Button, Modal, ResourceList, Text } from '@shopify/polaris';
import translations from '@shopify/polaris/locales/en.json';
import polarisStyles from "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";
import SyncActions from "../components/SyncActions";
import SearchForm from "../components/SearchForm";
import ProductDetails from "../components/ProductDetails";
import UpdateForm from "../components/UpdateForm";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
    try {
        const { session } = await authenticate.admin(request);
        const { shop } = session;
        return json({ shop });
    } catch (error) {
        console.error("Loader Error:", error);
        return json({ errorMessage: "Failed to load shop data" }, { status: 500 });
    }
};

export async function action({ request }) {
    try {
        const formData = await request.formData();
        const actionType = formData.get("actionType");
        const variantSKU = formData.get("searchTerm");
        const shop = formData.get("shop");

        const shopId = await findOrCreateShopIdByName(shop);

        const { admin } = await authenticate.admin(request);

        if (actionType === "search") {
            const response = await admin.graphql(
                `#graphql
                query getProductByVariantSKU($variantSKU: String!) {
                    productVariants(first: 1, query: $variantSKU) {
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
                        variantSKU
                    },
                }
            );

            const responseJson = await response.json();
            const variantData = responseJson.data.productVariants.edges[0]?.node;

            if (!variantData) {
                return json({ errorMessage: "No product found with the provided SKU" }, { status: 404 });
            }

            const product = await db.product.findUnique({
                where: {
                    SKU_shopId: { SKU: variantData.sku, shopId: shopId }
                }
            });

            const productData = {
                id: variantData.product.id,
                title: variantData.product.title,
                image: variantData.product.featuredImage?.originalSrc,
                price: variantData.price,
                inventoryQuantity: variantData.inventoryQuantity,
                sku: variantData.sku,
                variantId: variantData.id,
                url: product ? product.URL : ''  // Use the URL from Prisma database if it exists
            };

            return json({ productData });
        } else if (actionType === "update") {
            const sku = formData.get("sku");
            const newUrl = formData.get("newUrl");

            // First, try to find the existing product
            const existingProduct = await db.product.findUnique({
                where: { SKU_shopId: { SKU: sku, shopId: shopId } },
            });

            if (existingProduct) {
                // If product exists, update it
                await db.product.update({
                    where: { SKU_shopId: { SKU: sku, shopId: shopId } },
                    data: { URL: newUrl },
                });
                return json({ successMessage: "Product URL updated successfully" });
            } else {
                // If product does not exist, create a new one
                await db.product.create({
                    data: { SKU: sku, URL: newUrl, shopId: shopId },
                });
                return json({ successMessage: "Product created successfully" });
            }
        } else if (actionType === "delete") {
            const sku = formData.get("sku");

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
    const { shop } = useLoaderData();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentUrl, setCurrentUrl] = useState('');
    const [showSearchForm, setShowSearchForm] = useState(true);
    const [isNew, setIsNew] = useState(false);
    const [toastActive, setToastActive] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [error, setError] = useState('');
    const [syncDisabled, setSyncDisabled] = useState(false);
    const [showEbayModal, setShowEbayModal] = useState(false);
    const [ebayResults, setEbayResults] = useState([]);
    const [bannerVisible, setBannerVisible] = useState(false);
    const navigate = useNavigate();

    const toggleActive = useCallback(() => setToastActive(active => !active), []);

    const syncAll = async () => {
        setSyncDisabled(true);
        setToastMessage('Sync has started');
        toggleActive();
        const response = await fetch(`/sync?shop=${shop}`, { method: 'POST' });
        const data = await response.json();

        if (data.status === 'error') {
            setToastMessage(data.message);
            setSyncDisabled(false);
            toggleActive();
            return;
        }

        setTimeout(() => {
            toggleActive();
        }, 3000);
        console.log('Sync process has started...');
    };

    const goBack = () => navigate(-1);

    const toastMarkup = toastActive ? (
        <Toast content={toastMessage} onDismiss={toggleActive} />
    ) : null;

    const resetForm = () => {
        setSearchTerm('');
        setCurrentUrl('');
        setShowSearchForm(true);
        setIsNew(false);
        setError('');
    };

    useEffect(() => {
        if (fetcher.data?.productData) {
            setCurrentUrl(fetcher.data.productData.url || '');
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

    return (
        <AppProvider i18n={translations}>
            <Frame>
                {bannerVisible && <Banner status="success">URL updated successfully</Banner>}
                <SyncActions syncAll={syncAll} goBack={goBack} toastActive={toastActive} syncDisabled={syncDisabled} />
                <Page title="Product Search and Update">
                    <BlockStack gap="800">
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
                        {fetcher.data?.productData && !showSearchForm && (
                            <>
                                <ProductDetails productData={fetcher.data.productData} translations={translations} />
                                <UpdateForm
                                    currentUrl={currentUrl}
                                    setCurrentUrl={setCurrentUrl}
                                    productData={fetcher.data.productData}
                                    translations={translations}
                                    fetcher={fetcher}
                                    shop={shop}
                                />
                                {fetcher.data?.successMessage && <Banner status="success" role="status">{fetcher.data.successMessage}</Banner>}
                                <CalloutCard
                                    title="Could not find what you are looking for?"
                                    illustration='data:image/png;base64,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'
                                    primaryAction={{
                                        content: 'Search Ebay',
                                        onAction: handleSearchEbay,
                                        variant: 'primary'
                                    }}
                                >
                                    <p>You can run the search for the product on eBay</p>
                                    {/* <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                                        <ButtonGroup>
                                            <Button primary tone="success" onClick={() => setShowSearchForm(true)}>Search Again</Button>
                                            <Button primary tone="critical" submit onClick={handleSearchEbay}>Search Ebay</Button>
                                        </ButtonGroup>
                                    </div> */}
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
                                    const { title, price, condition, itemWebUrl } = item;
                                    return (
                                        <ResourceList.Item
                                            id={title}
                                            accessibilityLabel={`View details for ${title}`}
                                            onClick={() => handleSelectEbayItem(itemWebUrl)}
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
