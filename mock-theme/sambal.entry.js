

export function renderPage({ page, options }) {
    return `
        <html>
            <head> 
                <script src="/index.js"></script>
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

