import { buildGlobeGeometry } from "../../packages/geo/src/build.ts";

const result = await buildGlobeGeometry();
console.log(
  `Palestine selectable: ${result.palestineSelectable}. Index entries: ${result.index}.`,
);
