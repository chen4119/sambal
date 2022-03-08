

export function renderPage({ page, options }) {
    return `
        <html>
            <head>
                <script src="/index.js"></script>
                <script src="/node_modules/bootstrap/dist/js/bootstrap.min.js"></script>
                <link rel="stylesheet" href="theme.css">
                <link rel="stylesheet" href="/node_modules/@fontsource/roboto/300.css">
                <style>
                    pre[class*="language-"] {
                        margin-top: 24px;
                        margin-bottom: 24px;
                    }

                    .MuiButton-iconSizeSmall > *:first-child {
                        font-size: 18px;
                    }

                    .MuiTypography-body2 {
                        font-size: 0.875rem;
                        font-family: "Roboto", "Helvetica", "Arial", sans-serif;
                        font-weight: 400;
                        line-height: 1.43;
                        letter-spacing: 0.01071em;
                    }
                </style>
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

