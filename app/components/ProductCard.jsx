// file: app/components/ProductCard.jsx
import { Card, Text } from '@shopify/polaris';

export default function ProductCard({ title, value, description, status }) {
    return (
        <Card title={title}>
            <Text variant='heading3xl' as='h2' alignment='center' status={status}>{value}</Text>
            <Text as='p' variant='bodySm' alignment='center' fontWeight='semibold'>{description}</Text>
        </Card>
    );
}
