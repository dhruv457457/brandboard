import type { PatchTier } from "@patched/shared";

/**
 * Tier for each patch when the creator didn't pick one: the largest spot is Mega, the bigger half Prime,
 * the rest Mini. `areas` are w*h in percent, indexed like the patches.
 */
export function defaultTiers(areas: number[]): PatchTier[] {
  const ranked = areas.map((a, i) => ({ a, i })).sort((x, y) => y.a - x.a);
  const out: PatchTier[] = new Array(areas.length).fill("mini");
  ranked.forEach(({ i }, rank) => {
    out[i] = rank === 0 ? "mega" : rank < Math.ceil(areas.length / 2) ? "prime" : "mini";
  });
  return out;
}
