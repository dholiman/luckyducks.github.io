# Gelica fonts — drop point

`styles.css` `@font-face` declarations at the top of the file expect
these exact filenames. Drop your purchased / licensed Gelica files here:

| Weight | Style | woff2 (preferred) | otf (fallback) |
|---|---|---|---|
| Light (300)   | normal | `Gelica-Light.woff2`        | `Gelica-Light.otf`        |
| Light (300)   | italic | `Gelica-LightItalic.woff2`  | `Gelica-LightItalic.otf`  |
| Regular (400) | normal | `Gelica-Regular.woff2`      | `Gelica-Regular.otf`      |
| Regular (400) | italic | `Gelica-RegularItalic.woff2`| `Gelica-RegularItalic.otf`|
| Bold (700)    | normal | `Gelica-Bold.woff2`         | `Gelica-Bold.otf`         |
| Bold (700)    | italic | `Gelica-BoldItalic.woff2`   | `Gelica-BoldItalic.otf`   |
| Black (900)   | normal | `Gelica-Black.woff2`        | `Gelica-Black.otf`        |

The marketing site uses more weights and both italic + roman because the
editorial display (`.hero-display em`, `.features-h2 em`, etc.) sets
specific `<em>` runs in italic, and the body styles use both 300 and 400
for hierarchy.

If you only have `.otf`, the browser falls back to the `.otf` listed in
each `src:` rule — works fine but larger downloads.

## License note

Gelica is an Adobe Originals font. Standard Adobe Fonts subscription
**does not** include self-hosting rights. Verify your license covers
`@font-face` use before deploying.
