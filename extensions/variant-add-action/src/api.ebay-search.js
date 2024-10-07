// file: api/ebay-search.js

import { json } from "@remix-run/node";
import { searchEbayItems } from "../../utils/ebayApi";
import { authenticate } from "../shopify.server";

function shortenUrl(url) {
    const match = url.match(/https:\/\/www\.ebay\.com\/itm\/\d+/);
    return match ? match[0] : url;
}

export const loader = async ({ request }) => {
    // The authenticate.admin method returns a CORS method to automatically wrap responses so that extensions, which are hosted on extensions.shopifycdn.com, can access this route.
    const { cors } = await authenticate.admin(request);

    const url = new URL(request.url);
    const title = url.searchParams.get("title");

    if (!title) {
        return cors(json({ error: "Title is required" }, { status: 400 }));
    }

    try {
        const results = await searchEbayItems(title, 10); // Increase the limit to 10
        const formattedResults = results.map(item => ({
            ...item,
            itemWebUrl: shortenUrl(item.itemWebUrl)
        }));
        return cors(json({ results: formattedResults }));
    } catch (error) {
        console.error("Error searching eBay:", error);
        return cors(json({ error: "Failed to search eBay" }, { status: 500 }));
    }
};
