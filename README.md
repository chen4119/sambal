
# [Sambal](https://sambal.dev)

A linked data static site generator using schema.org json-ld as the content model.

If you're thinking not another static site generator...I know but I hope you'll hear me out on why Sambal is different.  Whereas the purpose of many static site generators is to help users generate HTML or bundle javascript more efficiently, that is not what Sambal is about.  Sambal simply let you use your favorite UI library as you normally would so you don't have to learn anything new.

Instead, the main focus for Sambal is the content model.  It natively supports [schema.org](https://schema.org/) [json-ld](https://json-ld.org/) to help you generate a more meaningful and SEO website based on the semantic meaning of your data.  Compare to other static site generators where they essentially don't care about the meaning of your data, Sambal's focus on data semantics has 3 major advantages: 

1. It can automatically add application/ld+json, facebook, and twitter metadata tags to your webpage.

2. You can build UI themes based on the semantic meaning of your data and not rely on the property name of your data.  To illustrate the difference, it's unambiguous what blogpost tags are but you can encode tags in your blogpost with many names, i.e. keywords, categories, tags, etc.  By relying solely on property names, UI themes are brittle in nature. 

3. Leverage the power of linked data.  Unlike plain old json, json-ld (aka json linked data) can reference other data fragments with a url just like linking to another webpage with a hyperlink.  Say goodbye to duplicating data in static markdown or yaml file.

# Get started

```sh
npm install --save-dev sambal    // install sambal as a dev dependency

npx sambal init                  // create sambal.site.js, sambal.entry.js and sample content

npx sambal serve                 // start dev server on localhost:3000
```