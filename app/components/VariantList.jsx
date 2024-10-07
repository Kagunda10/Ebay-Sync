// file: app/components/VariantList.jsx
import React from 'react';
import { ResourceList, Card, Avatar, Text } from '@shopify/polaris';

export default function VariantList({ variants, onSelectVariant }) {
    return (
        <Card background="bg-surface-secondary">
            {/* <Card roundedAbove="md" background="bg-surface-secondary"> */}
            <Text variant="headingMd" as="h2">Search Results</Text>
            <Text variant="bodyMd" as="p">{variants.length} product(s) found</Text>
            {/* </Card> */}
            <ResourceList
                resourceName={{ singular: 'variant', plural: 'variants' }}
                items={variants}
                renderItem={(variant) => {
                    const { sku, price, inventoryQuantity, product, condition } = variant;
                    const { title, featuredImage } = product;
                    return (
                        <ResourceList.Item
                            id={title}
                            accessibilityLabel={`View details for ${title}`}
                            onClick={() => onSelectVariant(variant)}
                            media={<Avatar source={featuredImage?.originalSrc} size="xl" />}
                        >
                            <h3>
                                <Text variation="strong" fontWeight='bold'>
                                    {title}
                                </Text>
                            </h3>
                            <div>SKU: {sku}</div>
                            <div>Quantity: {inventoryQuantity}</div>
                            <div>Price: {price}</div>
                            <div>Condition: {condition}</div>
                        </ResourceList.Item>
                    );
                }}
            />
        </Card>
    );
}
