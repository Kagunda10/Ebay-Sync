import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { authenticate } from "../shopify.server";


export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {

  const url = new URL(request.url);

  const shop = url.searchParams.get('shop');

  await authenticate.admin(request);

  return json({ apiKey: process.env.SHOPIFY_API_KEY || "", shop: shop });
};

export default function App() {
  const { apiKey, accessToken } = useLoaderData();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <ui-nav-menu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/import">Import/ Export</Link>
        <Link to="/app/search">Search</Link>
        <Link to="/app/settings">Settings</Link>

        {/* <Link to="/configuration">Configuration</Link> */}
      </ui-nav-menu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
