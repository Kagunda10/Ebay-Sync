// file: app/components/ImportSection.jsx
import { BlockStack, Button, Card, DropZone, Text, Tooltip } from '@shopify/polaris';

export default function ImportSection({ handleDropZoneDrop, handleSubmit, fileName, uploadStatus }) {
    return (
        <Card title="Import" sectioned>
            <BlockStack gap={200}>
                <Text variant="headingMd" as="h2">Import</Text>
                <Tooltip content="Ensure you have the required columns (SKU and URL)">
                    <Text as="p">Please ensure your file has a SKU and URL column</Text>
                </Tooltip>
                <DropZone onDrop={handleDropZoneDrop} accept=".csv">
                    <DropZone.FileUpload actionHint="Accepts .csv" />
                </DropZone>
                <div style={{ marginTop: '12px', textAlign: 'center' }}>
                    <Button variant="primary" onClick={handleSubmit}>Upload File</Button>
                </div>
            </BlockStack>
        </Card>
    );
}
