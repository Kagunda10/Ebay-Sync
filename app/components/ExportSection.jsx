// file: app/components/ExportSection.jsx
import { BlockStack, Button, ButtonGroup, Card, InlineStack, Text, InlineGrid } from '@shopify/polaris';
import { useNavigate } from "@remix-run/react";
import { ExportIcon } from '@shopify/polaris-icons';

export default function ExportSection({ handleExport, shop }) {
    const navigate = useNavigate();

    const handleExportAll = () => {
        handleExport("all");
    };

    const handleExportZeroQuantity = () => {
        handleExport("zeroQuantity");
    };

    return (
        <Card title="Export" sectioned>
            <BlockStack gap={400}>
                <InlineGrid columns="1fr auto">
                    <Text as="h2" variant="headingMd">
                        Export
                    </Text>
                    <Button
                        variant="plain"
                        onClick={() => { navigate('/app/zero') }}
                        accessibilityLabel="Out of Stock Products"
                    >
                        View Out of Stock Products
                    </Button>

                </InlineGrid>
                {/* <Text variant="headingMd" as="h2">Export</Text> */}
                <Text>
                    <p>Use the buttons below to export products from your store. You can export all products or only those that are out of stock.</p>
                </Text>
                <InlineStack align="center">
                    <ButtonGroup segmented>
                        <Button icon={ExportIcon} onClick={handleExportAll}>All Products</Button>
                        <Button icon={ExportIcon} onClick={handleExportZeroQuantity}>Out of Stock</Button>
                    </ButtonGroup>
                </InlineStack>

            </BlockStack>
        </Card>
    );
}