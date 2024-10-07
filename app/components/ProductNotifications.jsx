import { useLoaderData } from "@remix-run/react";
import { Card, ResourceList, Text, Banner, Avatar } from '@shopify/polaris';

function ProductNotifications() {
    const { lowStockProducts } = useLoaderData();

    return (
        <Card>
            <ResourceList
                resourceName={{ singular: 'product', plural: 'products' }}
                items={lowStockProducts}
                renderItem={(item) => {
                    const { id, title, inventoryQuantity, image, price } = item;
                    // const media = <Avatar customer size="medium" source={image || ''} />;
                    // const shortcutActions = inventoryQuantity < 10 ? [{ content: 'Restock', onAction: () => alert('Restock action for ' + title) }] : [];

                    return (
                        <ResourceList.Item
                            id={id}
                            // media={media}
                            accessibilityLabel={`View details for ${title}`}
                        // shortcutActions={shortcutActions}
                        // persistActions
                        >
                            <h3>
                                <Text variation="strong">{title}</Text>
                            </h3>
                            <div>Price: ${price}</div>
                            <div>Inventory: {inventoryQuantity}</div>
                            {inventoryQuantity < 10 && <Banner status="critical">Stock is low</Banner>}
                        </ResourceList.Item>
                    );
                }}
            />
        </Card>
    );
}

export default ProductNotifications;
