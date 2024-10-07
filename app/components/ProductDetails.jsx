// file: app/components/ProductDetails.jsx
import { MediaCard, BlockStack, Divider, Text } from '@shopify/polaris';

export default function ProductDetails({ productData, translations }) {
    return (
        <MediaCard
            title={<Text fontWeight="bold">{productData.title}</Text>}
            description={
                <BlockStack gap={100}>
                    <Divider borderColor="transparent" />
                    <Text fontWeight="bold">{translations.price || "Product SKU"}: {productData.sku}</Text>
                    <Divider borderColor="transparent" />
                    <Text fontWeight="bold">{translations.price || "Price"}: ${productData.price}</Text>
                    <Divider borderColor="transparent" />
                    <Text fontWeight="bold">{translations.inventory || "Inventory"}: {productData.inventoryQuantity}</Text>
                </BlockStack>
            }
            size="small"
        >
            {productData.image && (
                <img
                    alt={productData.title}
                    width="150"
                    height="150"
                    style={{ objectFit: 'contain', objectPosition: 'center' }}
                    src={productData.image}
                />
            )}
        </MediaCard>
    );
}
