# amaz-sort.user.js

Userscript that sorts Amazon Japan (amazon.co.jp) search results by **price per kg** and **price per piece**, so the best-value items come first.

It reads each result's price and the weight or count in its title (g, kg, ml, L, pieces, packs, bags, …), works out a unit price and reorders the list.

> Note: it parses the English-language Amazon Japan UI, so switch the site language to English.

## Install

1. Install a userscript manager such as [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/).
2. Open [amaz-sort.user.js (raw)](https://raw.githubusercontent.com/snomiao/amaz-sort.user.js/main/amaz-sort.user.js) and confirm the install.

## Development

```bash
bunx vitest   # runs amaz-sort.user.spec.ts against the sample results in testData.ts
```

## License

MIT
