import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useSearchParams, useNavigate } from "@remix-run/react";
import { useEffect } from 'react';
import { authenticate } from "~/shopify.server";
import db from "~/db.server";
import {
    Page,
    Layout,
    Card,
    ResourceList,
    ResourceItem,
    Text,
    Button,
    Banner,
    Frame,
    Pagination,
    Thumbnail,
    Link,
    Box,
    Modal,
    Avatar,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

export const loader = async ({ request }) => {
    const { session, admin } = await authenticate.admin(request);
    const { shop } = session;

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const sortKey = url.searchParams.get("sortKey") || "SKU";
    const sortDirection = url.searchParams.get("sortDirection") || "asc";

    const shopRecord = await db.shop.findUnique({
        where: { name: shop },
    });

    if (!shopRecord) {
        return json({ products: [], error: "Shop not found", totalProducts: 0 });
    }

    const pageSize = 10;

    const [dbProducts, totalProducts] = await Promise.all([
        db.product.findMany({
            where: {
                shopId: shopRecord.id,
                quantity: 0,
            },
            orderBy: {
                [sortKey]: sortDirection,
            },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        db.product.count({
            where: {
                shopId: shopRecord.id,
                quantity: 0,
            },
        }),
    ]);

    const productsWithDetails = (await Promise.all(
        dbProducts.map(async (product) => {
            const response = await admin.graphql(
                `#graphql
            query getProductByVariantSKU($variantSKU: String!) {
                productVariants(first: 1, query: $variantSKU) {
                    edges {
                        node {
                            id
                            sku
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
                        variantSKU: product.SKU,
                    },
                }
            );

            const responseJson = await response.json();
            const variantData = responseJson.data.productVariants.edges[0]?.node;

            return {
                ...product,
                name: variantData?.product.title || "Unknown Product",
                image: variantData?.product.featuredImage?.originalSrc || "",
            };
        })
    )).filter(product => product.name !== "Unknown Product");
    return json({
        products: productsWithDetails,
        totalProducts,
        currentPage: page,
        sortKey,
        sortDirection,
        shopName: "chiefautomation.myshopify.com"
    });
};

export async function action({ request }) {
    console.log("Action started");
    const { session } = await authenticate.admin(request);
    const { shop } = session;
    const formData = await request.formData();
    const actionType = formData.get("actionType");
    const sku = formData.get("sku");
    const newUrl = formData.get("newUrl");
    const price = formData.get("price");
    const quantity = formData.get("quantity");

    console.log("Received data:", { actionType, sku, newUrl, shop });

    const shopRecord = await db.shop.findUnique({
        where: { name: shop },
    });

    if (!shopRecord) {
        console.log("Shop not found:", shop);
        return json({ error: "Shop not found" });
    }

    console.log("Shop found:", shopRecord);

    if (actionType === "updateUrl") {
        try {
            console.log("Searching for existing product");
            const existingProduct = await db.product.findUnique({
                where: { SKU_shopId: { SKU: sku, shopId: shopRecord.id } },
            });

            console.log("Existing product:", existingProduct);

            if (existingProduct) {
                console.log("Updating product");
                const updatedProduct = await db.product.update({
                    where: { SKU_shopId: { SKU: sku, shopId: shopRecord.id } },
                    data: {
                        URL: newUrl,
                        price: parseFloat(price), // Ensure price is a numeric value
                        quantity: parseInt(quantity, 10) // Ensure quantity is an integer
                    },
                });
                console.log("Updated product:", updatedProduct);
                return json({ successMessage: "Product updated successfully" });
            } else {
                console.log("Creating new product");
                const newProduct = await db.product.create({
                    data: {
                        SKU: sku,
                        URL: newUrl,
                        shopId: shopRecord.id,
                        price: parseFloat(price), // Ensure price is a numeric value
                        quantity: parseInt(quantity, 10) // Ensure quantity is an integer
                    },
                });
                console.log("Created product:", newProduct);
                return json({ successMessage: "Product created successfully" });
            }
        } catch (error) {
            console.error("Error updating/creating product:", error);
            return json({ error: "Failed to update/create product" });
        }
    } else if (actionType === "deleteProduct") {
        try {
            console.log("Deleting product");
            const deletedProduct = await db.product.delete({
                where: { SKU_shopId: { SKU: sku, shopId: shopRecord.id } },
            });
            return json({ successMessage: "Product deleted successfully" });
        } catch (error) {
            console.error("Error deleting product:", error);

            return json({ error: "Failed to delete product" });
        }
    }

    console.log("Invalid action type");
    return json({ error: "Invalid action" });
}

export default function ZeroQuantityProducts() {
    const { products, error, totalProducts, sortKey, sortDirection, shopName } = useLoaderData();
    const fetcher = useFetcher();

    const [searchParams, setSearchParams] = useSearchParams();
    const currentPage = parseInt(searchParams.get("page") || "1", 10);
    const navigate = useNavigate();

    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const [showEbayModal, setShowEbayModal] = useState(false);
    const [ebayResults, setEbayResults] = useState([]);
    const [currentSKU, setCurrentSKU] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSortChange = useCallback((newSortKey) => {
        const newSortDirection = newSortKey === sortKey && sortDirection === 'asc' ? 'desc' : 'asc';
        setSearchParams({ page: "1", sortKey: newSortKey, sortDirection: newSortDirection });
    }, [sortKey, sortDirection, setSearchParams]);

    const handleUpdateQuantity = useCallback(async (sku, title) => {
        setCurrentSKU(sku);
        setIsLoading(true);
        setShowEbayModal(true);

        try {
            const response = await fetch(`/ebay-search?title=${encodeURIComponent(title)}`);
            const data = await response.json();
            setEbayResults(data.results || []);
        } catch (error) {
            console.error("Error fetching eBay results:", error);
            setEbayResults([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleSelectEbayItem = useCallback((itemWebUrl, price, quantity) => {
        setIsLoading(true);
        const formData = new FormData();
        formData.append("actionType", "updateUrl");
        formData.append("sku", currentSKU);
        formData.append("newUrl", itemWebUrl);
        formData.append("price", price);
        formData.append("quantity", quantity);


        fetcher.submit(formData, { method: "post" });
    }, [currentSKU, fetcher]);

    const handleDeleteProduct = useCallback((sku) => {
        setIsLoading(true);
        const formData = new FormData();
        formData.append("actionType", "deleteProduct");
        formData.append("sku", sku);

        fetcher.submit(formData, { method: "post" });
    }, [fetcher]);

    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data) {
            setIsLoading(false);
            setShowEbayModal(false);
            if (fetcher.data.successMessage) {
                setSuccessMessage(fetcher.data.successMessage);
                setTimeout(() => setSuccessMessage(''), 3000);
            } else if (fetcher.data.error) {
                setErrorMessage(fetcher.data.error);
                setTimeout(() => setErrorMessage(''), 3000);
            }
        }
    }, [fetcher]);

    const sortOptions = [
        { label: "SKU", value: "SKU" },
        { label: "Price", value: "price" },
    ];


    return (
        <Frame>
            <Page title="Out of Stock Products">
                {successMessage && (
                    <Banner status="success" onDismiss={() => setSuccessMessage('')}>
                        <p>{successMessage}</p>
                    </Banner>
                )}
                {errorMessage && (
                    <Banner status="critical" onDismiss={() => setErrorMessage('')}>
                        <p>{errorMessage}</p>
                    </Banner>
                )}
                <Layout>
                    <Layout.Section>
                        {error && (
                            <Banner status="critical">
                                <p>{error}</p>
                            </Banner>
                        )}
                        <Card>
                            <ResourceList
                                resourceName={{ singular: "product", plural: "products" }}
                                items={products}
                                renderItem={(product) => (
                                    <ResourceItem
                                        id={product.id}
                                        accessibilityLabel={`View details for ${product.SKU}`}
                                        media={
                                            <Thumbnail
                                                size="large"
                                                source={product.image || "https://placeholder.com/100x100"}
                                                alt={product.name}
                                            />
                                        }
                                    >
                                        <Box padding="4">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <Box as="h3" padding={{ bottom: "2" }}>
                                                        <Link url={product.URL} target="_blank">
                                                            <Text variant="headingMd">{product.name}</Text>
                                                        </Link>
                                                    </Box>
                                                    <Box as="p" padding={{ bottom: "1" }}><Text>SKU: {product.SKU}</Text></Box>
                                                    <Box as="p" padding={{ bottom: "1" }}><Text>Price: ${product.price}</Text></Box>
                                                    <Box as="p" padding={{ bottom: "1" }}><Text>Quantity: {product.quantity}</Text></Box>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <Button onClick={() => handleUpdateQuantity(product.SKU, product.name)}>
                                                        Update Product
                                                    </Button>
                                                    <Button tone="critical" onClick={() => handleDeleteProduct(product.SKU)}>
                                                        Delete Product
                                                    </Button>
                                                </div>
                                            </div>
                                        </Box>
                                    </ResourceItem>
                                )}
                                sortValue={`${sortKey}_${sortDirection}`}
                                sortOptions={sortOptions}
                                onSortChange={handleSortChange}
                                totalItemsCount={totalProducts}
                                showHeader
                            />
                            <Box padding="4">
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <Pagination
                                        hasPrevious={currentPage > 1}
                                        onPrevious={() => {
                                            setSearchParams({ page: (currentPage - 1).toString(), sortKey, sortDirection });
                                        }}
                                        hasNext={currentPage * 10 < totalProducts}
                                        onNext={() => {
                                            setSearchParams({ page: (currentPage + 1).toString(), sortKey, sortDirection });
                                        }}
                                    />
                                </div>
                            </Box>
                        </Card>
                    </Layout.Section>
                </Layout>
            </Page>
            <Modal
                open={showEbayModal}
                onClose={() => setShowEbayModal(false)}
                title={`eBay Search Results for SKU: ${currentSKU}`}
                primaryAction={{
                    content: 'Close',
                    onAction: () => setShowEbayModal(false),
                }}
            >
                <Modal.Section>
                    {isLoading ? (
                        <div>Loading...</div>
                    ) : ebayResults.length > 0 ? (
                        <ResourceList
                            resourceName={{ singular: 'product', plural: 'products' }}
                            items={ebayResults}
                            renderItem={(item) => {
                                const { title, price, condition, itemWebUrl, image } = item;
                                const quantity = 1;
                                return (
                                    <ResourceList.Item
                                        id={title}
                                        accessibilityLabel={`View details for ${title}`}
                                        onClick={() => handleSelectEbayItem(itemWebUrl, price, quantity)}
                                        media={<Avatar source={image} size="medium" />}
                                    >
                                        <h3>
                                            <Text variation="strong">
                                                <Link url={itemWebUrl}>
                                                    {title}
                                                </Link>
                                            </Text>
                                        </h3>
                                        <div>Price: {price}</div>
                                        <div>Condition: {condition}</div>
                                    </ResourceList.Item>
                                );
                            }}
                        />
                    ) : (
                        <Banner status="warning">
                            No results found. Try a different search term or try again later.
                        </Banner>
                    )}
                </Modal.Section>
            </Modal>
        </Frame>
    );
}
