import React from "react";

const Head = () => (
    <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no"/>
        <meta httpEquiv="X-UA-Compatible" content="ie=edge"/>
        <script src="/mock-theme/index.js"></script>
    </head>
);

export function renderPage({ page, options }) {
    const { mainEntity } = page;
    return (
        <html>
            <Head/>
            <body>
                <h1>{mainEntity.headline}</h1>
                <p>Google Analytics Id {options.googleAnalyticsId}</p>
            </body>
        </html>
    );
}

export const defaultOptions = {
    googleAnalyticsId: "UA-123"
}