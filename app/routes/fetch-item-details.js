// file: api/ebay-search.js

import { json } from "@remix-run/node";
// import { authenticate } from "../shopify.server";
import { getItemDetails } from "../../utils/ebayApi";

function shortenUrl(url) {
    const match = url.match(/https:\/\/www\.ebay\.com\/itm\/\d+/);
    return match ? match[0] : url;
}

export const loader = async ({ request }) => {
    // const { cors } = await authenticate.admin(request);
    const url = new URL(request.url);
    const itemId = url.searchParams.get("itemid");

    if (!title) {
        return json({ error: "Item ID is required" }, { status: 400 });
    }

    try {
        const { condition, price, availability } = await getItemDetails(itemId);

        return json({ condition, price, availability });
    } catch (error) {
        console.error("Error refreshing variant:", error);
        return cors(json({ error: "Error refreshing variant" }, { status: 500 }));
    }
};
