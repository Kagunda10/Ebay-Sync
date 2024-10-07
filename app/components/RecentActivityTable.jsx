// file: app/components/RecentActivityTable.jsx
import { DataTable, Text, Badge } from '@shopify/polaris';

export default function RecentActivityTable({ activities, limit }) {
    const rows = activities.map(activity => [
        activity.type,
        activity.description,
        activity.createdAt.slice(0, 10),
        <Badge status="success" progress="complete">{activity.type}ed</Badge>
    ]);
    const limitedRows = rows.slice(0, limit);

    return (
        <>
            <Text variant='headingLg'>Recent activity</Text>
            <DataTable
                columnContentTypes={['text', 'text', 'text', 'text']}
                headings={[
                    <Text fontWeight='bold' variant='headingMd'>Operation</Text>,
                    <Text fontWeight='bold' variant='headingMd'>Description</Text>,
                    <Text fontWeight='bold' variant='headingMd'>Time</Text>,
                    <Text fontWeight='bold' variant='headingMd'>Status</Text>,
                ]}
                rows={limitedRows}
                hasZebraStripingOnData
                increasedTableDensity
            />
        </>
    );
}
