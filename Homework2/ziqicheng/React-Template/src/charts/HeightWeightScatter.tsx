import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";

type AthleteRow = {
  height?: string;     // often in cm
  weight?: string;     // often in kg
  gender?: string;
};

type Point = {
  height: number;
  weight: number;
  gender: string;
};

type Props = {
  data: AthleteRow[];
  width?: number;
  height?: number;
};

function toNumber(v: any) {
  const n = +v;
  return Number.isFinite(n) ? n : null;
}

export default function HeightWeightScatter({
  data,
  width = 560,
  height = 340,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

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
      });
    }
    return out;
  }, [data]);

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
    g.append("g")
      .selectAll("circle")
      .data(pts)
      .join("circle")
      .attr("cx", (d) => x(d.height))
      .attr("cy", (d) => y(d.weight))
      .attr("r", 3)
      .attr("fill", (d) => color(d.gender) as string)
      .attr("opacity", 0.75);

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
  }, [pts, width, height]);

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
