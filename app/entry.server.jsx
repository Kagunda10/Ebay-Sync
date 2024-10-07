// New Relic must be the first import
import newrelic from 'newrelic';
const Bugsnag = require('@bugsnag/js')
import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import { createReadableStreamFromReadable } from "@remix-run/node";
import { isbot } from "isbot";
import { addDocumentResponseHeaders } from "./shopify.server";

const ABORT_DELAY = 5000;

Bugsnag.start({ apiKey: '7f52b73d3398b9014b2b05a8b13644e0' })


export default async function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  remixContext,
) {
  addDocumentResponseHeaders(request, responseHeaders);

  // Set CORS headers
  responseHeaders.set("Access-Control-Allow-Origin", "ngrok-free"); // Allow all domains
  responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"); // Specify allowed request methods
  responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization"); // Specify allowed headers

  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";

  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer
        context={remixContext}
        url={request.url}
        abortDelay={ABORT_DELAY}
      />,
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
          pipe(body);
        },
        onShellError(error) {
          // Log error using New Relic
          // newrelic.noticeError(error);
          Bugsnag.notify(error)
          reject(error);
        },
        onError(error) {
          // Log error using New Relic

          // newrelic.noticeError(error);
          Bugsnag.notify(error)

          responseStatusCode = 500;
          console.error(error);
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
