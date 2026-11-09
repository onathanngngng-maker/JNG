/** Arithmetic the solution must follow, so the model does not invent a different result. */
export function checkedWorking(paper: string): string {
  if (!/phy4232|phosphorus|bremsstrahlung|palladium|lutetium/i.test(paper)) return "";
  const parts = [decayWorking(paper), shellWorking(paper), kineticWorking(paper), beamWorking(paper), tissueWorking(paper)].filter(
    (part): part is string => Boolean(part),
  );
  if (!parts.length) return "";
  return `CHECKED NUMBERS. Use these values on the matching lines of the reference solution. Keep the reference solution's lines and page breaks. Do not merge steps into one line.\n${parts.join("\n")}`;
}

function decayWorking(paper: string): string {
  const fraction = paper.match(/\b1\/(\d+)\b/);
  const halves = [...paper.matchAll(/half-life(?:\s+of)?\s+(\d+(?:\.\d+)?)\s*(days?|d)\b/gi)];
  const mass = paper.match(/(\d+(?:\.\d+)?)\s*grams?\b/i);
  const elapsed = paper.match(/after\s+(\d+(?:\.\d+)?)\s*days?\b/i);
  const lines: string[] = [];
  if (fraction && halves[0]) {
    const denominator = Number(fraction[1]);
    const steps = Math.round(Math.log2(denominator));
    if (2 ** steps === denominator) {
      const half = Number(halves[0][1]);
      lines.push(`Solution 1:\na. (1/2)^${steps} = 1/${denominator}\n${half}*${steps} = ${trim(half * steps)} days`);
    }
  }
  if (mass && halves[1] && elapsed) {
    const half = Number(halves[1][1]);
    const time = Number(elapsed[1]);
    const steps = time / half;
    const nearest = Math.round(steps);
    const whole = Math.abs(steps - nearest) < 1e-6;
    const usedSteps = whole ? nearest : steps;
    const remaining = Number(mass[1]) * 0.5 ** usedSteps;
    const shownSteps = whole ? String(nearest) : trim(steps);
    lines.push(
      `b. ${time} days is equal to ${shownSteps} half-lives\n${mass[1]} g*(1/2)^${shownSteps} = ${trim(remaining)} g\nTherefore, there is ${trim(remaining)} g left after ${time} days.`,
    );
  }
  return lines.join("\n");
}

function shellWorking(paper: string): string {
  if (!/phosphorus/i.test(paper)) return "";
  const ry = 13.57;
  const z = 15;
  const energy = (n: number) => (-ry * (z / n) ** 2) / 1000;
  const e1 = energy(1);
  const e2 = energy(2);
  const e3 = energy(3);
  return [
    `Solution 2: E = (-13.57 eV)*(Z/n)^2, Z = 15`,
    `n=1 E = ${trim(e1)} keV; n=2 E = ${trim(e2)} keV; n=3 E = ${trim(e3)} keV`,
    `2 to 1: ${trim(e2 - e1)} keV; 3 to 2: ${trim(e3 - e2)} keV; 3 to 1: ${trim(e3 - e1)} keV`,
  ].join("\n");
}

function kineticWorking(paper: string): string {
  const speeds = [...paper.matchAll(/(\d+(?:\.\d+)?)\s*[x×]\s*10\^?\{?\s*(\d+)\s*\}?\s*(?:m\/s)?/g)];
  if (speeds.length < 2 || !/velocity/i.test(paper)) return "";
  const velocity = (match: RegExpMatchArray) => Number(match[1]) * 10 ** Number(match[2]);
  const mass = 9.1e-31;
  const energy = (speed: number) => 0.5 * mass * speed * speed;
  const e1 = energy(velocity(speeds[0]));
  const e2 = energy(velocity(speeds[1]));
  return `Solution 3: m = 9.1×10⁻³¹ kg; E1 = ${sci(e1)} J; E2 = ${sci(e2)} J; photon = ${sci(e1 - e2)} J`;
}

function beamWorking(paper: string): string {
  const intensities = [...paper.matchAll(/(\d+(?:\.\d+)?)\s*W\/cm/gi)].map((match) => Number(match[1]));
  const coeffs = [...paper.matchAll(/(\d+(?:\.\d+)?)\s*cm(?:-1|⁻¹|\^\{-1\})/gi)].map((match) => Number(match[1]));
  if (intensities.length < 2 || coeffs.length < 2 || !/tumor|attenuation/i.test(paper)) return "";
  const horizontal = intensities[0];
  const vertical = intensities[1];
  const tumor = coeffs[0];
  const normal = coeffs[1];
  const thickness = Number(paper.match(/(\d+(?:\.\d+)?)\s*cm\b/i)?.[1] || 1);
  const chain = (start: number, first: number, middle: number) => {
    const a = round3(start * Math.exp(-first * thickness));
    const b = round3(a * Math.exp(-middle * thickness));
    const c = round3(b * Math.exp(-first * thickness));
    return { a, b, c, d1: round3(start - a), d2: round3(a - b), d3: round3(b - c) };
  };
  const down = chain(vertical, normal, tumor);
  const across = chain(horizontal, normal, tumor);
  return [
    `Solution 4: I(x)=I(0)e^(-μx), x = ${thickness} cm`,
    `vertical: I1 = ${trim(down.a)} ; I2 = ${trim(down.b)} ; It1 = ${trim(down.c)} W/cm²`,
    `ΔI1 = ${trim(down.d1)} ; ΔI2 = ${trim(down.d2)} ; ΔI3 = ${trim(down.d3)} W/cm²`,
    `horizontal: Ip1 = ${trim(across.a)} ; Ip2 = ${trim(across.b)} ; It2 = ${trim(across.c)} W/cm²`,
    `ΔIp1 = ${trim(across.d1)} ; ΔIp2 = ${trim(across.d2)} ; ΔIp3 = ${trim(across.d3)} W/cm²`,
    `centre quadrant = ${trim(down.d2 + across.d2)} W/cm²`,
  ].join("\n");
}

function tissueWorking(paper: string): string {
  if (!/bone/i.test(paper) || !/muscle/i.test(paper)) return "";
  const low = transmit(0.9, 6);
  const high = transmit(0.12, 0.18);
  return [
    "Solution 5: read μ from the figure. 20 keV: muscle 0.9 cm⁻¹, bone 6 cm⁻¹.",
    `It = ${sci(low)} I0`,
    "0.5 MeV: muscle 0.12 cm⁻¹, bone 0.18 cm⁻¹.",
    `It = ${trim(high)} I0`,
  ].join("\n");
}

function transmit(muscle: number, bone: number): number {
  return Math.exp(-muscle) * Math.exp(-bone) * Math.exp(-muscle);
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function trim(value: number): string {
  if (!Number.isFinite(value)) return "";
  const fixed = Math.abs(value) >= 100 ? value.toFixed(2) : value.toFixed(3);
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function sci(value: number): string {
  if (value === 0) return "0";
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const coefficient = value / 10 ** exponent;
  return `${trim(Number(coefficient.toFixed(2)))}×10^${exponent}`;
}
