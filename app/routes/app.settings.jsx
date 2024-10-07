import React, { useEffect, useState, useCallback } from 'react';
import { useFetcher, useLoaderData } from '@remix-run/react';
import { json } from "@remix-run/node";
import db from "../db.server";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  AppProvider,
  PageActions,
  Frame,
  ChoiceList,
  RangeSlider,
  BlockStack,
  Checkbox,
  Tag,
  Toast,
  Box
} from '@shopify/polaris';
import translations from '@shopify/polaris/locales/en.json';
import { authenticate } from "../shopify.server";
import { unauthenticated } from "../shopify.server";

export async function loader({ request }) {


  const { session, sessionToken } = await authenticate.admin(request);
  const { shop } = session;
  console.log(sessionToken)

  const shopId = (await db.shop.findFirst({ where: { name: shop } }))?.id ?? null;

  const settings = await db.setting.findFirst({
    where: { shopId: Number(shopId) }
  });

  return json({ shopId, settings });
}

export async function action({ request }) {
  const formData = Object.fromEntries(await request.formData());
  const { frequency, markup, concurrentScrapeSync, lowStockAlert, emails, shopId } = formData;

  // Parse emails from JSON string to array
  const emailArray = JSON.parse(emails);

  // Check if settings already exist for the given shopId
  const existingSettings = await db.setting.findFirst({
    where: { shopId: Number(shopId) }
  });

  let settings;
  if (existingSettings) {
    // Update existing settings
    settings = await db.setting.update({
      where: { id: existingSettings.id },
      data: {
        frequency,
        markup: Number(markup),
        concurrentScrapeSync: concurrentScrapeSync === "true",
        lowStockAlert: lowStockAlert === "true",
        emails: JSON.stringify(emailArray) // Store emails as JSON string
      },
    });
  } else {
    // Create new settings
    settings = await db.setting.create({
      data: {
        frequency,
        markup: Number(markup),
        concurrentScrapeSync: concurrentScrapeSync === "true",
        lowStockAlert: lowStockAlert === "true",
        emails: JSON.stringify(emailArray), // Store emails as JSON string
        shopId: Number(shopId)
      },
    });
  }

  return json({ settings });
}

export default function Settings() {
  const { shopId, settings } = useLoaderData();
  const [changesMade, setChangesMade] = useState(false);
  const [selected, setSelected] = useState(settings?.frequency || 'daily');
  const [rangeValue, setRangeValue] = useState(settings?.markup || 30);
  const [scrapeSyncChecked, setScrapeSyncChecked] = useState(settings?.concurrentScrapeSync || false);
  const [stockChecked, setStockChecked] = useState(settings?.lowStockAlert || false);
  const [emailInputValue, setEmailInputValue] = useState('');
  const [emails, setEmails] = useState(Array.isArray(settings?.emails) ? settings?.emails : JSON.parse(settings?.emails || '[]'));

  const fetcher = useFetcher();
  const [toastActive, setToastActive] = useState(false);
  const [toastContent, setToastContent] = useState('');

  const toggleToastActive = useCallback(() => setToastActive((active) => !active), []);

  const handleEmailInputChange = useCallback(
    (value) => {
      setEmailInputValue(value);
      setChangesMade(true);
    },
    [],
  );

  const handleEmailAdd = useCallback(() => {
    if (emailInputValue && emails.length < 3) {
      setEmails([...emails, emailInputValue]);
      setEmailInputValue('');
      setChangesMade(true);
    }
  }, [emailInputValue, emails]);

  const handleEmailRemove = useCallback((email) => {
    setEmails(emails.filter(e => e !== email));
    setChangesMade(true);
  }, [emails]);

  const handleValueChange = useCallback(() => {
    setChangesMade(true);
  }, []);

  const handleSaveSettings = () => {
    fetcher.submit({
      frequency: selected,
      markup: rangeValue,
      concurrentScrapeSync: scrapeSyncChecked.toString(),
      lowStockAlert: stockChecked.toString(),
      emails: JSON.stringify(emails), // Convert array to JSON string
      shopId: shopId
    }, { method: "post", action: "/settings" });

    setChangesMade(false);
  };

  useEffect(() => {
    if (fetcher.state === "submitting") {
      console.log('Submitting settings...');
    }
    if (fetcher.state === "idle" && fetcher.data) {
      setToastContent('Settings saved successfully');
      setToastActive(true);
    } else if (fetcher.state === "idle" && fetcher.error) {
      setToastContent('Failed to save settings');
      setToastActive(true);
    }
  }, [fetcher.state, fetcher.data, fetcher.error]);

  useEffect(() => {
    setSelected(settings?.frequency || 'daily');
    setRangeValue(settings?.markup || 30);
    setScrapeSyncChecked(settings?.concurrentScrapeSync || false);
    setStockChecked(settings?.lowStockAlert || false);
    setEmails(Array.isArray(settings?.emails) ? settings?.emails : JSON.parse(settings?.emails || '[]'));
  }, [settings]);

  useEffect(() => {
    if (toastActive) {
      const timer = setTimeout(() => {
        setToastActive(false);
      }, 3000); // Toast will disappear after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [toastActive]);

  return (
    <AppProvider i18n={translations}>
      <Frame>
        <div style={{ padding: '20px' }}>
          {changesMade && (
            <PageActions
              primaryAction={{
                content: 'Save Settings',
                onAction: handleSaveSettings
              }}
            />
          )}
        </div>
        <Page title="Store Settings">
          <Layout>
            <Layout.AnnotatedSection
              title="Store Settings"
              description="Modify your store's settings"
            >
              <FormLayout>
                <Card sectioned>
                  <BlockStack gap={400}>
                    <ChoiceList
                      title="Choose product sync schedule"
                      choices={[
                        { label: 'Daily', value: 'daily' },
                        { label: 'Weekly', value: 'weekly' },
                        { label: 'Monthly', value: 'monthly' }
                      ]}
                      selected={selected}
                      onChange={(value) => {
                        setSelected(value);
                        handleValueChange();
                      }}
                    />
                  </BlockStack>
                </Card>
                <Card sectioned>
                  <BlockStack gap={400}>
                    <RangeSlider
                      label="Price markup percentage"
                      value={rangeValue}
                      onChange={(value) => {
                        setRangeValue(value);
                        handleValueChange();
                      }}
                      min={1}
                      max={100}
                      suffix={
                        <p
                          style={{
                            minWidth: '24px',
                            textAlign: 'right',
                          }}
                        >
                          {rangeValue}
                        </p>
                      }
                      output
                    />
                  </BlockStack>
                </Card>
                <Card sectioned>
                  <BlockStack gap={400}>
                    <Checkbox
                      label="Enable concurrent scraping and syncing"
                      checked={scrapeSyncChecked}
                      onChange={(newChecked) => {
                        setScrapeSyncChecked(newChecked);
                        handleValueChange();
                      }}
                    />
                  </BlockStack>
                </Card>
                <Card sectioned>
                  <BlockStack gap={400}>
                    <Checkbox
                      label="Enable low stock level alerts"
                      checked={stockChecked}
                      onChange={(newChecked) => {
                        setStockChecked(newChecked);
                        handleValueChange();
                      }}
                    />
                  </BlockStack>
                </Card>
              </FormLayout>
            </Layout.AnnotatedSection>
            <Layout.AnnotatedSection
              title="Notification settings">
              <FormLayout>
                <Card sectioned>
                  <BlockStack gap={400}>
                    <Box>
                      {emails.map((email) => (
                        <Tag key={email} onRemove={() => handleEmailRemove(email)}>
                          {email}
                        </Tag>
                      ))}
                    </Box>
                    {emails.length < 3 && (
                      <TextField
                        label="Add Email"
                        type="email"
                        value={emailInputValue}
                        onChange={handleEmailInputChange}
                        onBlur={handleEmailAdd}
                        helpText="We’ll use this address to send notifications about low stock alerts."
                        autoComplete="email"
                      />
                    )}
                  </BlockStack>
                </Card>
              </FormLayout>
            </Layout.AnnotatedSection>
          </Layout>
        </Page>
        {toastActive && <Toast content={toastContent} onDismiss={toggleToastActive} />}
      </Frame>
    </AppProvider>
  );
}
