module.exports = {
    entry: {
        renderPage: () => {
            return `
                <html>
                    <head> 
                        <script src="client"></script>
                    </head>
                    <body>
                        <h1>Hello from mock theme</h1>
                    </body>
                </html>
            `
        }
    },
    browserBundle: {
        client: "client.123.js"
    }
};