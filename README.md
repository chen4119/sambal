
# [Sambal](https://sambal.dev)

A linked data static site generator using schema.org json-ld as the content model.

Unlike other static site generators where the purpose is to help users generate HTML or bundle javascript more efficiently, this is not what Sambal is about.  Sambal simply let you use your favorite UI library as you normally would so you don't have to learn anything new.

Instead, the main focus for Sambal is the content model.  It natively supports [schema.org](https://schema.org/) structured data to help you generate a more meaningful and SEO website based on the semantic meaning of your data.  

# Features

1. Automatically add schema.org structured data, facebook open graph, and twitter metadata tags to your webpage

2. Leverage the power of linked data.  Unlike plain old json, json-ld can reference other data fragments with a url just like linking to another webpage with a hyperlink

3. Build UI themes based on the semantic meaning of your data and not rely on the property name of your data

4. Publish both HTML and json-ld files

5. Convert images to schema.org ImageObject

# Get started

```sh
npm install --save-dev sambal    // install sambal as a dev dependency

npx sambal init                  // create sambal.site.js, sambal.entry.js and sample content

npx sambal serve                 // start dev server on localhost:3000
```