type Kind = "fraction" | "scientific" | "measured";

type Hit = {
  token: string;
  kind: Kind;
  value: string;
  unit: string;
  exponent?: string;
};

const FACTORS = [0.5, 0.6, 0.75, 0.8, 1.25, 1.5, 1.75, 2, 2.5, 3];

export function buildVariantPlan(text: string, seed = randomSeed()): string {
  const hits = extractCalcNumbers(text);
  if (!hits.length) {
    return `THIS RUN ${seed}. This paper has no calculation to retarget. Edit the existing parts: change a named object that is not drawn in a figure, and keep the same task, part letter, and marks. Do not add a question.`;
  }
  const rendered = hits.map((hit, index) => replacement(hit, seed, index));
  keepWholeHalfLives(hits, rendered);
  const lines = hits.map((hit, index) => `${hit.token} → ${rendered[index]}`);
  return `THIS RUN ${seed}. Use these calculation numbers. Do not keep the reference numbers, and do not repeat the numbers from the previous paper. If a waiting time is a whole number of half-lives, keep that whole number.\n${lines.join("\n")}\nAlso rewrite every long question that has no printed figure. Same task and marks. Different wording. Do not add a question.`;
}

function keepWholeHalfLives(hits: Hit[], rendered: string[]): void {
  const times = hits
    .map((hit, index) => ({ hit, index }))
    .filter(({ hit }) => /^(d|days?)$/i.test(hit.unit));
  for (let i = 0; i < times.length; i += 1) {
    for (let j = i + 1; j < times.length; j += 1) {
      const left = Number(times[i].hit.value);
      const right = Number(times[j].hit.value);
      if (!left || !right) continue;
      const halfSlot = left < right ? times[i] : times[j];
      const elapsedSlot = left < right ? times[j] : times[i];
      const ratio = Number(elapsedSlot.hit.value) / Number(halfSlot.hit.value);
      const steps = Math.round(ratio);
      if (steps < 2 || steps > 12 || Math.abs(ratio - steps) > 0.05) continue;
      const newHalf = Number(rendered[halfSlot.index].split(" ")[0]);
      if (!newHalf) continue;
      const decimals = elapsedSlot.hit.value.includes(".") ? elapsedSlot.hit.value.split(".")[1].length : 0;
      const next = decimals > 0 ? (newHalf * steps).toFixed(decimals) : String(Math.round(newHalf * steps));
      rendered[elapsedSlot.index] = `${next} ${elapsedSlot.hit.unit}`.trim();
    }
  }
}

function randomSeed(): number {
  return Math.floor(Math.random() * 9000) + 1000;
}

function extractCalcNumbers(text: string): Hit[] {
  const cleaned = text.replace(/\(\s*\d+(?:\.\d+)?\s*marks?\s*\)/gi, " ");
  const hits: Hit[] = [];
  const seen = new Set<string>();
  const add = (hit: Hit) => {
    const key = hit.token.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    hits.push(hit);
  };

  for (const match of cleaned.matchAll(/\b1\/(\d+)\b/g)) {
    add({ token: match[0], kind: "fraction", value: match[1], unit: "" });
  }

  for (const match of cleaned.matchAll(/(\d+(?:\.\d+)?)\s*[x×]\s*10\^?\{?\s*(-?\d+)\s*\}?/g)) {
    const after = cleaned.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 6);
    if (/^\s*(?:C|kg)\b/.test(after)) continue;
    add({
      token: `${match[1]} × 10^${match[2]}`,
      kind: "scientific",
      value: match[1],
      unit: "",
      exponent: match[2],
    });
  }

  for (const match of cleaned.matchAll(/(\d+(?:\.\d+)?)\s*(W\/cm(?:2|²)?|cm-1|cm⁻¹)/gi)) {
    add({ token: match[0].replace(/\s+/g, " "), kind: "measured", value: match[1], unit: match[2] });
  }

  for (const match of cleaned.matchAll(/(\d+(?:\.\d+)?)\s*(days?|grams?|years?|mm|cm)\b/gi)) {
    const unit = match[2];
    const after = cleaned.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 3);
    if (/^\s*(?:-1|⁻)/.test(after)) continue;
    add({ token: `${match[1]} ${unit}`, kind: "measured", value: match[1], unit });
  }

  for (const match of cleaned.matchAll(/(\d+(?:\.\d+)?)\s*m\b/gi)) {
    add({ token: `${match[1]} m`, kind: "measured", value: match[1], unit: "m" });
  }

  for (const match of cleaned.matchAll(/(\d+(?:\.\d+)?)\s*d\b/gi)) {
    add({ token: `${match[1]} d`, kind: "measured", value: match[1], unit: "d" });
  }

  return hits;
}

function replacement(hit: Hit, seed: number, index: number): string {
  if (hit.kind === "fraction") {
    const choices = ["4", "8", "16", "64", "128"].filter((value) => value !== hit.value);
    const next = choices[(seed + index) % choices.length];
    return `1/${next}`;
  }
  if (hit.kind === "scientific") {
    const next = varyDecimal(hit.value, seed, index);
    return `${next} × 10^${hit.exponent}`;
  }
  return `${varyDecimal(hit.value, seed, index)} ${hit.unit}`.trim();
}

function varyDecimal(original: string, seed: number, index: number): string {
  const numeric = Number(original);
  if (!Number.isFinite(numeric) || numeric === 0) return original;
  const decimals = original.includes(".") ? original.split(".")[1].length : 0;
  let factor = FACTORS[(seed + index * 3) % FACTORS.length];
  let next = numeric * factor;
  let printed = decimals > 0 ? next.toFixed(decimals) : String(Math.max(1, Math.round(next)));
  if (Number(printed) === numeric) {
    if (decimals > 0) {
      const step = 10 ** -decimals;
      const direction = (seed + index) % 2 === 0 ? 1 : -1;
      const shifted = numeric + direction * step * (1 + (index % 3));
      printed = (shifted > 0 ? shifted : numeric + step).toFixed(decimals);
    } else {
      printed = String(numeric + 1 + ((seed + index) % 4));
    }
  }
  return printed;
}
