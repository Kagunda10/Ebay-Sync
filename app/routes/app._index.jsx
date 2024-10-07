import { useEffect } from "react";
import { json } from "@remix-run/node";
import { useActionData, useNavigation, useSubmit, useLocation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  Link,
  InlineStack,
  Navigation,
  Frame,
  TopBar,
  FooterHelp
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// Define Navbar component directly within this file
const Navbar = () => {
  const location = useLocation(); // Get the current location object

  const navItems = [
    { url: '/import', label: 'Import/Export' },
    { url: '/search', label: 'Search' },
    // { url: '/export', label: 'Export' },
    { url: '/settings', label: 'Settings' },
  ];

  return (
    <Navigation location="/">
      <Navigation.Section
        items={navItems.map(item => ({
          ...item,
          label: location.pathname === item.url ? <strong>{item.label}</strong> : item.label, // Conditionally apply bold style
        }))}
      />
    </Navigation>
  );
};



// export const loader = async ({ request }) => {
//   await authenticate.admin(request);

//   return null;
// };

// export const action = async ({ request }) => {
//   const { admin } = await authenticate.admin(request);
//   const color = ["Red", "Orange", "Yellow", "Green"][
//     Math.floor(Math.random() * 4)
//   ];
//   const response = await admin.graphql(
//     `#graphql
//       mutation populateProduct($input: ProductInput!) {
//         productCreate(input: $input) {
//           product {
//             id
//             title
//             handle
//             status
//             variants(first: 10) {
//               edges {
//                 node {
//                   id
//                   price
//                   barcode
//                   createdAt
//                 }
//               }
//             }
//           }
//         }
//       }`,
//     {
//       variables: {
//         input: {
//           title: `${color} Snowboard`,
//           variants: [{ price: Math.random() * 100 }],
//         },
//       },
//     },
//   );
//   const responseJson = await response.json();

//   return json({
//     product: responseJson.data?.productCreate?.product,
//   });
// };

export default function Index() {

  return (
    <Frame > {/* Wrap your content with Frame and include Navbar */}

      <Page>
        <ui-title-bar title="DATASYNC PRO">
        </ui-title-bar>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <BlockStack gap="500">
            <Layout>
              <Layout.Section>
                <Card sectioned>
                  <BlockStack gap="500">
                    <Text alignment="center" variant="headingLg">Welcome to DataSync Pro</Text>
                    <Text>Your comprehensive solution for seamless inventory management and pricing strategy optimization on Shopify.</Text>

                    <BlockStack spacing="tight">
                      <Text variant="headingSm">1. Effortless Data Integration</Text>
                      <Text>Say goodbye to manual updates and data inconsistencies. With DataSync Pro, you can easily upload your product information via CSV files. Our system is built to ensure that your CSV files adhere to a specific format for seamless integration, with a file size limit of up to 10 MB, ensuring quick and efficient data processing. This feature not only saves time but also significantly reduces the margin for error, allowing you to focus on what matters most - growing your business.</Text>
                    </BlockStack>

                    <BlockStack spacing="tight">
                      <Text variant="headingSm">2. Product Management at Your Fingertips</Text>
                      <Text>Keeping your product listings accurate is key to customer satisfaction and retention. DataSync Pro offers a robust product search feature, enabling you to swiftly locate any item using its SKU. Found an error or need to update a product's source URL? No problem. Our application facilitates on-the-spot updates, ensuring your product information is always accurate and reliable for your customers.</Text>
                    </BlockStack>

                    <BlockStack spacing="tight">
                      <Text variant="headingSm">3. Customized Automation for Optimal Efficiency</Text>
                      <Text>DataSync Pro understands that every business is unique. That's why we offer customizable automation settings to fit your specific needs. Set the frequency at which your product data is refreshed - be it daily, weekly, or at any interval that suits your operation. Additionally, our application allows you to apply a predefined markup to your product prices automatically. This feature ensures that your pricing strategy remains consistent and profitable, adapting to market changes without the need for constant manual adjustments.</Text>
                    </BlockStack>
                  </BlockStack>
                </Card>
              </Layout.Section>
              {/* <Layout.Section variant="oneThird"> */}
              {/* <BlockStack gap="500">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Features
                  </Text>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Link
                        to="upload"
                        // target="_blank"
                        removeUnderline
                      >
                        Upload a file
                      </Link>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Link
                        to="/search"
                        // target="_blank"
                        removeUnderline
                      >
                        Search
                      </Link>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <span>
                        <Link
                          url="/configuration"
                          target="_blank"
                          removeUnderline
                        >
                          Configuration
                        </Link>
                      </span>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack> */}
              {/* </Layout.Section> */}
            </Layout>
          </BlockStack>
        </div>
        <FooterHelp>
          If you have any questions, please contact us at{' '}
          <Link url="mailto:cnjiiri@industrialautomationco.com">cnjiiri@industrialautomationco.com</Link>
        </FooterHelp>
      </Page>
    </Frame>
  );
}
