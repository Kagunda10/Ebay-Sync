import { useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Text,
  Banner,
  ChoiceList,
  Link
} from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.product-variant-details.action.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { i18n, close, data } = useApi(TARGET);
  const [productTitle, setProductTitle] = useState('');
  const [variantSKU, setVariantSKU] = useState('');
  const [ebayResults, setEbayResults] = useState([]);
  const [shopName, setShopName] = useState(''); // State for shop name

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(''); // Initialize as a string

  useEffect(() => {
    const fetchShopDetails = async () => {
      try {
        const shopQuery = {
          query: `query {
            shop {
              myshopifyDomain
            }
          }`
        };
        const res = await fetch("shopify:admin/api/graphql.json", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.token}` // Ensure you pass the correct token here
          },
          body: JSON.stringify(shopQuery),
        });


        if (!res.ok) throw new Error('Network error while fetching shop details');

        const shopData = await res.json();
        console.log('Shop data fetched:', shopData);
        setShopName(shopData.data.shop.myshopifyDomain);
      } catch (err) {
        console.error('Error fetching shop details:', err);
      }
    };


    const fetchVariantInfo = async () => {
      try {
        console.log('Data selected:', data.selected);
        if (!data.selected || data.selected.length === 0) {
          throw new Error('No variant selected');
        }

        console.log('Fetching variant info...');
        const getVariantQuery = {
          query: `query Variant($id: ID!) {
            productVariant(id: $id) {
              sku
              product {
                title
              }
            }
          }`,
          variables: { id: data.selected[0].id },
        };

        const res = await fetch("shopify:admin/api/graphql.json", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.token}` // Ensure you pass the correct token here
          },
          body: JSON.stringify(getVariantQuery),
        });

        if (!res.ok) throw new Error('Network error while fetching variant info');

        const variantData = await res.json();
        console.log('Variant data fetched:', variantData);

        setProductTitle(variantData.data.productVariant.product.title);
        setVariantSKU(variantData.data.productVariant.sku);

        // Fetch eBay results
        console.log('Fetching eBay results...');
        const ebayRes = await fetch(`api/admin-ebay-search?title=${variantData.data.productVariant.product.title}`);
        if (!ebayRes.ok) throw new Error('Network error while fetching eBay results');

        const ebayData = await ebayRes.json();
        console.log('eBay data fetched:', ebayData);
        setEbayResults(ebayData.results);
      } catch (err) {
        console.error('Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchVariantInfo();
    fetchShopDetails();
  }, [data.selected]);

  const handleSelectEbayItem = (value) => {
    console.log('ChoiceList onChange value:', value);
    if (value && value.length > 0) {
      setSelectedId(value); // Save the first selected ID
      console.log('Selected ID set to:', value);
    } else {
      console.log('No value selected');
    }
  };

  const handleSave = async () => {
    console.log('Saving with selected ID:', selectedId);
    try {
      const res = await fetch('/api/update-product-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: variantSKU, newUrl: selectedId, shop: shopName }), // Use the selected ID
      });

      const result = await res.json();
      if (res.ok) {
        console.log(result.successMessage);
        close();
      } else {
        console.error(result.errorMessage);
      }
    } catch (err) {
      console.error('Failed to update product URL:', err);
    }
  };

  return (
    <AdminAction
      title='Search Ebay'
      primaryAction={
        <Button
          onPress={handleSave}
        >
          Done
        </Button>
      }
      secondaryAction={
        <Button
          onPress={() => {
            console.log('closing');
            close();
          }}
        >
          Close
        </Button>
      }
    >
      <BlockStack>
        <Text fontWeight="bold">Current product: {productTitle}</Text>
        {loading ? (
          <Text>Loading...</Text>
        ) : error ? (
          <Banner status="critical">{error}</Banner>
        ) : (
          ebayResults.length > 0 ? (
            <ChoiceList
              title="eBay Products"
              selected={selectedId ? [selectedId] : []} // Set the selected ID
              onChange={handleSelectEbayItem} // Corrected onChange handler usage
              choices={ebayResults.map(item => ({
                label: `${item.title} - Price: ${item.price} - Condition: ${item.condition} - Link: ${item.id}`,
                id: item.id // Use ID as value
              }))}
            />
          ) : (
            <Banner status="info">Nothing to show here, Try again later or use a different product</Banner>
          )
        )}
      </BlockStack>
    </AdminAction>
  );
}
