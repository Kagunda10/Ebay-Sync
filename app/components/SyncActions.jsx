import React from 'react';
import { PageActions } from '@shopify/polaris';

export default function SyncActions({ syncAll, goBack, syncDisabled }) {
    return (
        <div style={{ padding: '20px' }}>
            <PageActions
                primaryAction={{
                    content: syncDisabled ? 'Syncing...' : 'Sync',
                    onAction: syncAll,
                    disabled: syncDisabled,
                    loading: syncDisabled,
                    style: { backgroundColor: 'green', color: 'white' }
                }}
                secondaryActions={[{
                    content: 'Back',
                    onAction: goBack
                }]}
            />
        </div>
    );
}