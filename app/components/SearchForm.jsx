// file: app/components/SearchForm.jsx
import { Card, BlockStack, FormLayout, TextField, Button, Text } from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';

export default function SearchForm({ searchTerm, setSearchTerm, translations, fetcher, shop }) {
    return (
        <fetcher.Form method="post">
            <Card title={translations.searchProductTitle || "Search for a Product"}>
                <BlockStack gap={100}>
                    <Text as='h2' fontWeight='medium'>{translations.enterSku || "Enter the SKU of variant you wish to find"}</Text>
                    <FormLayout>
                        <TextField
                            value={searchTerm}
                            onChange={setSearchTerm}
                            label={translations.productSku || "Variant SKU"}
                            name="searchTerm"
                            type="text"
                            autoComplete="off"
                            aria-label={translations.enterSkuAria || "Enter the SKU of the product"}
                        />
                        <input type="hidden" name="actionType" value="search" />
                        <input type="hidden" name="shop" value={shop} />
                        <div style={{ marginTop: '12px', textAlign: 'center' }}>
                            <Button variant="secondary" tone='success' icon={SearchIcon} size='medium' submit>{translations.search || "Search"}</Button>
                        </div>
                    </FormLayout>
                </BlockStack>
            </Card>
        </fetcher.Form>
    );
}
