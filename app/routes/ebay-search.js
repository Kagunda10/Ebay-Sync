// file: app/routes/ebay-search.js

// file: app/routes/ebay-search.js

import { json } from "@remix-run/node";
import { searchEbayItems } from "../../utils/ebayApi"; // Assuming the provided API file is located in utils

function shortenUrl(url) {
    const match = url.match(/https:\/\/www\.ebay\.com\/itm\/\d+/);
    return match ? match[0] : url;
}

export const loader = async ({ request }) => {
    const url = new URL(request.url);
    const title = url.searchParams.get("title");

    if (!title) {
        return json({ error: "Title is required" }, { status: 400 });
    }

    try {
        const results = await searchEbayItems(title, 10); // Increase the limit to 10
        const formattedResults = results.map(item => ({
            ...item,
            itemWebUrl: shortenUrl(item.itemWebUrl)
        }));
        return json({ results: formattedResults });
    } catch (error) {
        console.error("Error searching eBay:", error);
        return json({ error: "Failed to search eBay" }, { status: 500 });
    }
};



// file: app/routes/api/ebay-search.js

// file: app/routes/ebay-search.js

// import { json } from "@remix-run/node";

// export const loader = async ({ request }) => {
//     const url = new URL(request.url);
//     const title = url.searchParams.get("title");

//     if (!title) {
//         return json({ error: "Title is required" }, { status: 400 });
//     }

//     // Hardcoded JSON response
//     const results = [
//         {
//             title: "Sample eBay Product 1",
//             price: "$19.99",
//             condition: "New",
//             quantity: 10,
//             url: "https://www.ebay.com/sample-product-1"
//         },
//         {
//             title: "Sample eBay Product 2",
//             price: "$29.99",
//             condition: "Used",
//             quantity: 5,
//             url: "https://www.ebay.com/sample-product-2"
//         }
//     ];

//     // For testing empty results, use the following:
//     // const results = [];

//     return json({ results });
// };
