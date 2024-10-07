// file: api/ebay-search.js

import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { searchEbayItems } from "../../utils/ebayApi";

function shortenUrl(url) {
    const match = url.match(/https:\/\/www\.ebay\.com\/itm\/\d+/);
    return match ? match[0] : url;
}

export const loader = async ({ request }) => {
    const { cors } = await authenticate.admin(request);
    const url = new URL(request.url);
    const title = url.searchParams.get("title");

    if (!title) {
        return cors(json({ error: "Title is required" }, { status: 400 }));
    }

    try {
        const results = await searchEbayItems(title, 10);
        const formattedResults = results.map(item => ({
            id: shortenUrl(item.itemWebUrl), // Generate ID from the shortened URL
            title: item.title,
            price: item.price,
            condition: item.condition,
            itemWebUrl: shortenUrl(item.itemWebUrl),
            image: item.image,
        }));
        return cors(json({ results: formattedResults }));
    } catch (error) {
        console.error("Error searching eBay:", error);
        return cors(json({ error: "Failed to search eBay" }, { status: 500 }));
    }
};
