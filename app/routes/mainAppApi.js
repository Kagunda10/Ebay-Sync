// file: mainAppApi.js

import { json } from "@remix-run/node";
import { searchEbayItems } from "../../utils/ebayApi"; // Assuming the provided API file is located in utils


export const loader = async ({ request }) => {
    const url = new URL(request.url);
    const title = url.searchParams.get("title");

    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        });
    }

    if (request.method !== "GET") {
        return json({ error: "Method not allowed" }, { status: 405 });
    }

    if (!title) {
        return json({ error: "Title is required" }, { status: 400 });
    }

    try {
        const results = await searchEbayItems(title, 10); // Assuming searchEbayItems is defined
        const formattedResults = results.map(item => ({
            ...item,
            itemWebUrl: shortenUrl(item.itemWebUrl)
        }));
        return json({ results: formattedResults }, {
            headers: {
                "Access-Control-Allow-Origin": "*",
            }
        });
    } catch (error) {
        console.error("Error searching eBay:", error);
        return json({ error: "Failed to search eBay" }, { status: 500 });
    }
};

function shortenUrl(url) {
    const match = url.match(/https:\/\/www\.ebay\.com\/itm\/\d+/);
    return match ? match[0] : url;
}
