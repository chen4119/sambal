

export function renderPage({ page, options }) {
    return `
        <html>
            <head>
                <script src="/index.js"></script>
                <script src="/node_modules/bootstrap/dist/js/bootstrap.min.js"></script>
                <link rel="stylesheet" href="theme.css">
                <link rel="stylesheet" href="/node_modules/@fontsource/roboto/300.css">
            </head>
            <body>
                <h1>Hello from mock theme</h1>
                <p>${options.hello}</p>
            </body>
        </html>
    `;
}


export const defaultOptions = {
    hello: "test1"
}

