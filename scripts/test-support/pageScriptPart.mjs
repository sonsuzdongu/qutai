// Tests reach into the page script (src/browser/pageScript.ts, one string) by slicing it at comment or code markers.
// A renamed or moved marker would otherwise slice the wrong text and fail with a confusing error; this says which one.

/** The text of `script` from `startMarker` up to (not including) `endMarker`; throws naming a missing marker. */
export function pageScriptPart(script, startMarker, endMarker) {
  const start = script.indexOf(startMarker);
  if (start < 0) throw new Error(`The page script has no ${JSON.stringify(startMarker)} any more: update the test's start marker.`);
  const end = script.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`The page script has no ${JSON.stringify(endMarker)} after ${JSON.stringify(startMarker)}: update the test's end marker.`);
  return script.slice(start, end);
}
