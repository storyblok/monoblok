We render rich text from Storyblok with our own components for blocks like embedded product cards
and for some formatting such as links and custom text handling. Those components have no way to get
at information the page already has, like the current locale or the logged-in customer, so we end up
duplicating it through global state in every framework we use. Worse, when one of our components
renders another rich text field inside itself, we have hit infinite render loops that crash the
page. As a developer maintaining several frontends, I want to hand data to the rich text renderer
once and have every custom component receive it, and I want nested rich text inside a custom
component to be safe by default. This should work the same way in every framework we use.
