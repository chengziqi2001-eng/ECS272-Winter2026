import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";

type AthleteRow = {
  name?: string;
  country?: string;
  disciplines?: string;
  height?: string;
  weight?: string;
  gender?: string;
};

type Props = {
  data: AthleteRow[];
  width?: number;
  height?: number;
  selectedCountry?: string | null;
};

type Point = {
  height: number;
  weight: number;
  gender: string;
  name: string;
  country: string;
  discipline: string;
};


function toNumber(v: any) {
  const n = +v;
  return Number.isFinite(n) ? n : null;
}

function parseDisciplinesField(v: any): string {
  const s = (v ?? "").toString().trim();
  if (!s) return "Unknown";

  // Extract items inside single quotes: ['A', 'B'] -> ["A", "B"]
  const matches = Array.from(s.matchAll(/'([^']+)'/g)).map((m) => m[1].trim());
  if (matches.length) return matches.join(", ");

  // Fallback if it’s not in the "['...']" format
  return s.replace(/^\[|\]$/g, "").replace(/"/g, "").trim();
}


export default function HeightWeightScatter({
  data,
  width = 560,
  height = 340,
  selectedCountry = null,
}: Props) {


  // Parse + filter usable points
  const pts: Point[] = useMemo(() => {
    const out: Point[] = [];
    for (const d of data) {
      const h = toNumber(d.height);
      const w = toNumber(d.weight);
      if (h == null || w == null) continue;
      // guard against weird zeros
      if (h <= 0 || w <= 0) continue;
    out.push({
  height: h,
  weight: w,
  gender: (d.gender && String(d.gender).trim()) || "Unknown",
  name: (d.name && String(d.name).trim()) || "Unknown",
  country: (d.country && String(d.country).trim()) || "Unknown",
  discipline: parseDisciplinesField(d.disciplines),
});
;

    }
    return out;
  }, [data]);

 const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const margin = { top: 28, right: 18, bottom: 52, left: 58 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Title
    g.append("text")
      .attr("x", 0)
      .attr("y", -10)
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .text("Height vs Weight (colored by gender)");

    // Scales
    const x = d3
      .scaleLinear()
      .domain(d3.extent(pts, (d) => d.height) as [number, number])
      .nice()
      .range([0, innerW]);

    const y = d3
      .scaleLinear()
      .domain(d3.extent(pts, (d) => d.weight) as [number, number])
      .nice()
      .range([innerH, 0]);

    const genders = Array.from(new Set(pts.map((d) => d.gender))).sort();
    const color = d3.scaleOrdinal<string>().domain(genders).range(d3.schemeTableau10);

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6).tickSizeOuter(0));

    g.append("g").call(d3.axisLeft(y).ticks(6).tickSizeOuter(0));

    // Axis labels
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 42)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .text("Height");

    g.append("text")
      .attr("x", -innerH / 2)
      .attr("y", -44)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .text("Weight");

    // Points
        // tooltip
    const container = d3.select(svgRef.current.parentElement);
    container.style("position", "relative");

    let tip = container.select<HTMLDivElement>(".tooltip-scatter");
    if (tip.empty()) {
      tip = container
        .append("div")
        .attr("class", "tooltip-scatter")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("background", "rgba(0,0,0,0.75)")
        .style("color", "white")
        .style("padding", "6px 8px")
        .style("border-radius", "6px")
        .style("font-size", "12px")
        .style("opacity", "0")
        .style("max-width", "260px");
    }

    const t = d3.transition().duration(450).ease(d3.easeCubicInOut);

    const circles = g
      .append("g")
      .selectAll("circle")
      .data(pts)
      .join("circle")
      .attr("cx", (d) => x(d.height))
      .attr("cy", (d) => y(d.weight))
      .attr("r", 3)
      .attr("fill", (d) => color(d.gender) as string)
      .attr("cursor", "default")
      .on("mousemove", (event, d) => {
        tip
          .style("opacity", "1")
          .style("left", `${event.offsetX + 12}px`)
          .style("top", `${event.offsetY - 8}px`)
          .html(
            `<b>${d.name}</b><br/>${d.country}<br/>${d.gender}<br/>H: ${d.height}  W: ${d.weight}<br/><span style="opacity:0.9">${d.discipline}</span>`
          );
      })
      .on("mouseleave", () => tip.style("opacity", "0"));

    circles
      .transition(t as any)
      .attr("opacity", (d) =>
        selectedCountry ? (d.country === selectedCountry ? 0.9 : 0.12) : 0.75
      );


    // Legend (simple)
    const legend = g
      .append("g")
      .attr("transform", `translate(${innerW - 110}, 6)`);

    const legendItem = legend
      .selectAll("g")
      .data(genders)
      .join("g")
      .attr("transform", (_, i) => `translate(0, ${i * 16})`);

    legendItem
      .append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("rx", 2)
      .attr("y", -8)
      .attr("fill", (d) => color(d) as string);

    legendItem
      .append("text")
      .attr("x", 14)
      .attr("y", 0)
      .attr("font-size", 11)
      .text((d) => d);
  }, [pts, width, height, selectedCountry]);

  // If dataset has no numeric height/weight, show a friendly message
  if (pts.length === 0) {
    return (
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        No valid (height, weight) pairs found in the dataset.
      </div>
    );
  }

  return <svg ref={svgRef} />;
}
