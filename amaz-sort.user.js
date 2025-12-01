// ==UserScript==
// @name         Amazon Japan Sort by Price per kg and per piece
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Sort Amazon Japan search results by price per kg and per piece, (note: for English user only)
// @author       snomiao <snomiao@gmail.com>
// @match        https://www.amazon.co.jp/*
// @match        https://amazon.co.jp/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp
// @grant        none
// @run-at       document-idle
// ==/UserScript==

const pieceUnits = ["pieces", "piece", "pack", "bags", "bag"];
const weightUnits = {
  g: 0.001,
  kg: 1,
  pound: 0.453592,
  pounds: 0.453592,
  oz: 0.0283495,
  "fl oz": 0.0295735, // assuming density ~1kg/L
  liters: 1, // assuming density ~1kg/L
  ml: 0.001, // assuming density ~1kg/L
};
// matches: pieces, weight, pieces x weight
const rePieceWeights =
  /(?:(?<weightSize>\d+\.*\d*)\s*(?<weightUnit>oz|g|ml|fl\soz|g|oz|kg|liters|pound|ton|pieces?|pack|bags?))|(?:(?<count1>\d+)\s*pieces?|pack\sof\s(?<count2>\d+)|\s*?[x×*]\s*?(?<count3>\d+)\s\w+s\b|(?<count4>\d+)\s\w+s\s+)/gi;
const rePricePerWeight =
  /¥(?<price>\d{1,3}(,\d{3})*(\.\d{2})?|\d+(\.\d{2})?)\s*\/\s*(?<weightSize>\d+\.*\d*)\s*(?<weightUnit>oz|g|ml|fl\soz|g|oz|kg|liters|pound|ton)/g;
const rePricePerUnit =
  /¥(?<price>\d{1,3}(,\d{3})*(\.\d{2})?|\d+(\.\d{2})?)\s*\/\s*(?:(?<count>\d+)\s*(pieces?|pack|bags?)|count|unit)/g;

const rePrice = /¥(?<price>\d{1,3}(,\d{3})*(\.\d{2})?|\d+(\.\d{2})?)/g;
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
// setInterval(main, 3000);
main().then(console.log);

async function main() {
  const result = await theSort();
  console.log("Sorting completed.", result);
  console.log(
    result
      // .map((e) => ({ ...e, rand: Math.random() }))
      // .toSorted(compareBy((e) => e.rand))
      .at(0),
  );
}

async function theSort() {
  const data =
    typeof window !== "undefined"
      ? $$("[role=listitem],#gridStyleContainer>div,sc-list-item-content,ol.a-carousel>*").map(
          (e) => ({
            e,
            text: e.innerText,
          }),
        )
      : (await import("./testData")).testData.map((text) => ({ text }));
  console.log(`Found ${data.length} items to sort.`);
  const ranked = data.map(({ e, text }) => {
    const price = text.match(rePrice);
    const pricePerKgs = Array.from(text.matchAll(rePricePerWeight))
      // convert to kg
      .map((m) => {
        const g = m.groups;
        const size = parseFloat(g.weightSize);
        const unit = g.weightUnit.toLowerCase();
        const factor = weightUnits[unit] || null;
        if (factor != null) {
          return {
            price: parseFloat(m.groups.price.replace(",", "")),
            weightSizeInKg: size * factor,
          };
        } else {
          alert(`Unknown weight unit in price per weight: ${unit}`);
          return null;
        }
      })
      .filter((v) => v != null)
      // calculate price per kg
      .map((v) => ({
        pricePerKg: v.price / v.weightSizeInKg,
      }));
    const pricePerUnits = Array.from(text.matchAll(rePricePerUnit))
      .map((m) => {
        const g = m.groups;
        return {
          price: parseFloat(g.price.replace(",", "")),
          count: g.count ? parseInt(g.count) : 1,
        };
      })
      .map((v) => v.price / v.count);

    const weights = text
      .matchAll(rePieceWeights)
      .map((m) => {
        const g = m.groups;
        return {
          weightSize: g.weightSize ? parseFloat(g.weightSize) : null,
          weightUnit: g.weightUnit || null,
          count: g.count1
            ? parseInt(g.count1)
            : g.count2
              ? parseInt(g.count2)
              : g.count3
                ? parseInt(g.count3)
                : g.count4
                  ? parseInt(g.count4)
                  : null,
        };
      })
      // recognize pieces in weightUnit
      .map((w) => {
        if (w.weightUnit) {
          const unit = w.weightUnit.toLowerCase();
          if (
            unit === "pieces" ||
            unit === "piece" ||
            unit === "pack" ||
            unit === "bags" ||
            unit === "bag"
          ) {
            return { ...w, pieces: w.weightSize, weightSize: null, weightUnit: null };
          }
        }
        return w;
      })
      // convert weights to kg if possible
      .map((w) => {
        if (w.weightSize && w.weightUnit) {
          let sizeInKg = null;
          const factor = weightUnits[w.weightUnit.toLowerCase()] || null;
          if (factor != null) {
            sizeInKg = w.weightSize * factor;
          } else {
            alert(`Unknown weight unit: ${w.weightUnit}`);
          }
          return { ...w, weightSizeInKg: sizeInKg };
        }
        return w;
      })

      // merge sibling same weights in different units (e.g., "15.2 fl oz (430 ml)"), accpets small floating point errors
      .reduce((acc, curr) => {
        if (curr.weightSizeInKg && acc.length > 0) {
          const last = acc[acc.length - 1];
          if (Math.abs(last.weightSizeInKg - curr.weightSizeInKg) < 0.01) {
            // same weight, check pieces, merge if one of them has no pieces
            if (!last.pieces && curr.pieces) {
              acc[acc.length - 1] = { ...last, pieces: curr.pieces };
            }
            return acc;
          }
        }
        acc.push(curr);
        return acc;
      }, [])

      // merge sibling weight and pieces info (e.g., "24 pieces x 500 ml" or "(550 ml) x 48 Bottles") into one entry
      .reduce((acc, curr) => {
        if (curr.pieces && acc.length > 0 && !acc[acc.length - 1].pieces) {
          // merge pieces into last weight entry
          const last = acc[acc.length - 1];
          acc[acc.length - 1] = { ...last, pieces: curr.pieces };
        } else {
          acc.push(curr);
        }
        return acc;
      }, [])

      // calculate price per kg and per piece
      .map((w) => {
        const priceNum = price ? parseFloat(price[0].replace("¥", "").replace(",", "")) : null;
        let pricePerKg = null;
        let pricePerUnit = null;

        if (w.weightSizeInKg && priceNum) {
          pricePerKg = priceNum / (w.weightSizeInKg * (w.pieces || 1));
        }
        if (w.pieces && priceNum) {
          pricePerUnit = priceNum / w.pieces;
        }

        return { ...w, pricePerKg, pricePerUnit };
      })
      .filter((w) => w.weightSize || w.pieces);

    return {
      e,
      text,
      price: price ? parseFloat(price[0].replace("¥", "").replace(",", "")) : null,
      pricePerKgs, // when sell by price per weight
      weights: Array.from(weights),
      pricePerKg: Math.min(
        ...weights
          .toSorted(compareBy((w) => w.pricePerKg))
          .map((w) => w.pricePerKg)
          .filter((v) => v != null)
          .filter((v) => v != Infinity),
        ...pricePerKgs.map((w) => w.pricePerKg),
      ),
      pricePerUnit: Math.min(
        ...weights
          .map((w) => w.pricePerUnit)
          .filter((v) => v != null)
          .filter((v) => v != Infinity),
        ...pricePerUnits,
      ),
    };
    // const pricePerKg =
    // const pricePerUnit = pieces/price
  });

  // add title info: price, price per kg (kg), price per unit (units)
  ranked.map((e) => {
    if (e.e) {
      e.e.title += `\nPrice: ¥${e.price ? e.price.toFixed(2) : "N/A"}`;
      e.e.title += `\nPrice per kg: ¥${
        e.pricePerKg != null && e.pricePerKg != Infinity ? e.pricePerKg.toFixed(2) : "N/A"
      }`;
      e.e.title += `\nPrice per unit: ¥${
        e.pricePerUnit != null && e.pricePerUnit != Infinity ? e.pricePerUnit.toFixed(2) : "N/A"
      }`;
      if (e.e.parentElement?.id === "gridStyleContainer" && e.e.firstChild) {
        e.e.firstChild.style.backgroundColor = "transparent";
      }
    }
    return e;
  });

  ranked
    .filter((e) => e.pricePerKg != null && e.pricePerKg != Infinity)
    .toSorted(compareBy((e) => e.pricePerKg))
    // add ranking index, 0-based
    .map((e, i) => ({ ...e, i }))
    // change bg color based on ranking (oklch from green to red, lightness 0.9)
    .map((e) => {
      if (e.e) {
        const ratio = Math.pow(e.i / (data.length - 1), 0.2); // emphasize top ranks
        const oklch = `oklch(0.9 ${0.3 - 0.3 * ratio} ${120 - 120 * ratio})`;
        e.e.style.backgroundColor = oklch;
      }
      return e;
    })
    // move to end of parent to reflect sorting
    .map((e) => {
      if (e.e) {
        const parent = e.e.parentElement;
        if (parent.id === "gridStyleContainer") return e; // skip grid style container to avoid breaking grid layout
        parent.removeChild(e.e);
        parent.appendChild(e.e);
      }
      return e;
    });

  // for the rest, sort by price per count
  ranked
    .filter((e) => e.pricePerKg == null || e.pricePerKg == Infinity)
    .filter((e) => e.pricePerUnit != null && e.pricePerUnit != Infinity)
    .toSorted(compareBy((e) => e.pricePerUnit))
    // add ranking index, 0-based
    .map((e, i) => ({ ...e, i }))
    // change bg color based on ranking (oklch from blue to purple, lightness 0.8)
    .map((e) => {
      if (e.e) {
        const ratio = Math.pow(e.i / (data.length - 1), 0.2); // emphasize top ranks
        const oklch = `oklch(0.9 ${0.3 - 0.3 * ratio} ${270 - 270 * ratio})`;
        e.e.style.backgroundColor = oklch;
      }
      return e;
    })
    // move to end of parent to reflect sorting
    .map((e) => {
      if (e.e) {
        const parent = e.e.parentElement;
        if (parent.id === "gridStyleContainer") return e; // skip grid style container to avoid breaking grid layout
        parent.removeChild(e.e);
        parent.appendChild(e.e);
      }
      return e;
    });
  return ranked;
}

/**
 * @template T
 * @param {(item: T) => any} fn
 * @returns {(a: T, b: T) => number}
 */
function compareBy(fn) {
  return (a, b) => {
    const va = fn(a);
    const vb = fn(b);
    if (va < vb) return -1;
    if (va > vb) return 1;
    return 0;
  };
}
