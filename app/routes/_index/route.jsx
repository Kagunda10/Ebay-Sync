// Assuming this is in a file like routes/index.jsx or a similar entry point

import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { login } from "../../shopify.server";
import indexStyles from "./style.css";
import db from "../../db.server"; // Ensure you import your db module correctly

export const links = () => [{ rel: "stylesheet", href: indexStyles }];

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  const shopParam = url.searchParams.get("shop");
  if (shopParam) {
    // Attempt to find the shop in the database
    const shopRecord = await db.shop.findUnique({
      where: { name: shopParam },
    });

    // If the shop doesn't exist, create it
    if (!shopRecord) {
      await db.shop.create({
        data: {
          name: shopParam,
          // The 'isActive' field is set to true by default as per the schema
          // 'createdAt' is automatically set to the current date/time
        },
      });
    }

    // Redirect to the app with the shop parameter
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return json({ showForm: Boolean(login) });
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <div className="index">
      <div className="content">
        <h1>A short heading about [your app]</h1>
        <p>A tagline about [your app] that describes your value proposition.</p>
        {showForm && (
          <Form method="post" action="/auth/login">
            <label>
              <span>Shop domain</span>
              <input type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button type="submit">Log in</button>
          </Form>
        )}
        {/* Rest of your App component */}
      </div>
    </div>
  );
}
