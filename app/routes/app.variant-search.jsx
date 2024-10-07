// app/routes/variant-search.jsx
import { useState, useEffect, useCallback } from "react";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { AppProvider, Frame, Page, Toast, Card, Banner, FormLayout, TextField, Button } from '@shopify/polaris';
import translations from '@shopify/polaris/locales/en.json';
import polarisStyles from "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async () => {
    return json({ productData: null });
};

export const action = async ({ request }) => {
    const formData = await request.formData();
    const sku = formData.get("sku");
    const condition = formData.get("condition");

    if (!sku) {
        return json({ errorMessage: "SKU is required" }, { status: 400 });
    }

    const { admin } = await authenticate.admin(request);

    const query = `
        query($sku: String!) {
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
        }
    `;

    const variables = { sku };

    try {
        const response = await admin.graphql(query, variables);
        const variant = response.data.productVariants.edges[0]?.node;

        if (!variant) {
            return json({ errorMessage: "Variant not found" }, { status: 404 });
        }

        return json({
            productData: {
                id: variant.product.id,
                title: variant.product.title,
                image: variant.product.featuredImage?.originalSrc,
                price: variant.price,
                inventoryQuantity: variant.inventoryQuantity,
                sku: variant.sku,
                variantId: variant.id,
            },
        });
    } catch (error) {
        console.error("Error fetching variant:", error);
        return json({ errorMessage: "Error fetching variant" }, { status: 500 });
    }
};

export default function VariantSearch() {
    const fetcher = useFetcher();
    const { productData: initialProductData } = useLoaderData();
    const [toastActive, setToastActive] = useState(false);
    const [toastMessage, setToastMessage] = useState("");

    const toggleActive = useCallback(() => setToastActive((active) => !active), []);

    useEffect(() => {
        if (fetcher.data?.productData) {
            setToastMessage("Product found successfully");
            setToastActive(true);
        } else if (fetcher.data?.errorMessage) {
            setToastMessage(fetcher.data.errorMessage);
            setToastActive(true);
        }
    }, [fetcher.data]);

    const toastMarkup = toastActive ? (
        <Toast content={toastMessage} onDismiss={toggleActive} />
    ) : null;

    const productData = fetcher.data?.productData || initialProductData;

    const [sku, setSku] = useState("");
    const [condition, setCondition] = useState("");

    const handleSubmit = (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        fetcher.submit(formData, { method: "post", action: "/variant-search" });
    };

    return (
        <AppProvider i18n={translations}>
            <Frame>
                <Page title="Variant Search">
                    <Card sectioned>
                        <form method="post" onSubmit={handleSubmit}>
                            <FormLayout>
                                <TextField
                                    label="Variant SKU"
                                    value={sku}
                                    onChange={setSku}
                                    name="sku"
                                    autoComplete="off"
                                />
                                <TextField
                                    label="Condition (optional)"
                                    value={condition}
                                    onChange={setCondition}
                                    name="condition"
                                    autoComplete="off"
                                />
                                <Button submit primary>
                                    Search
                                </Button>
                            </FormLayout>
                        </form>
                    </Card>
                    {fetcher.data?.errorMessage && (
                        <Banner status="critical" title="Error">
                            <p>{fetcher.data.errorMessage}</p>
                        </Banner>
                    )}
                    {productData && (
                        <Card title={productData.title} sectioned>
                            {productData.image && (
                                <img
                                    src={productData.image}
                                    alt={productData.title}
                                    style={{ maxWidth: "100%" }}
                                />
                            )}
                            <p>SKU: {productData.sku}</p>
                            <p>Price: ${productData.price}</p>
                            <p>Inventory Quantity: {productData.inventoryQuantity}</p>
                        </Card>
                    )}
                </Page>
                {toastMarkup}
            </Frame>
        </AppProvider>
    );
}
