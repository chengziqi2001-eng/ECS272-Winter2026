import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";

type AthleteRow = {
  country?: string;
};

type Props = {
  data: AthleteRow[];
  width?: number;
  height?: number;
  topN?: number;
  selectedCountry?: string | null;
  onSelectCountry?: (country: string | null) => void;
};


export default function CountryBarChart({
  data,
  width = 560,
  height = 340,
  topN = 15,
  selectedCountry = null,
  onSelectCountry,
}: Props) {


  // Aggregate counts
  const rows = useMemo(() => {
    const counts = d3.rollup(
      data.filter((d) => d.country && String(d.country).trim().length > 0),
      (v) => v.length,
      (d) => String(d.country).trim()
    );

    return Array.from(counts, ([country, count]) => ({ country, count }))
      .sort((a, b) => d3.descending(a.count, b.count))
      .slice(0, topN);
  }, [data, topN]);

  const svgRef = useRef<SVGSVGElement | null>(null);


  useEffect(() => {
    if (!svgRef.current) return;

    const margin = { top: 28, right: 16, bottom: 60, left: 58 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // clear before redraw

    // scales
    const x = d3
      .scaleBand<string>()
      .domain(rows.map((d) => d.country))
      .range([0, innerW])
      .padding(0.2);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => d.count) ?? 0])
      .nice()
      .range([innerH, 0]);

    // root group
    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // title (inside svg)
    g.append("text")
      .attr("x", 0)
      .attr("y", -10)
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .text(`Top ${topN} Countries by Athlete Count`);

    // axes
    const xAxis = d3.axisBottom(x).tickSizeOuter(0);
    const yAxis = d3.axisLeft(y).ticks(6).tickSizeOuter(0);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(xAxis)
      .selectAll("text")
      .attr("text-anchor", "end")
      .attr("transform", "rotate(-35)")
      .attr("dx", "-0.6em")
      .attr("dy", "0.2em");

    g.append("g").call(yAxis);

    // axis labels
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 52)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .text("Country");

    g.append("text")
      .attr("x", -innerH / 2)
      .attr("y", -44)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .text("Number of Athletes");

    // bars
        // tooltip (HTML div inside parent)
    const container = d3.select(svgRef.current.parentElement);
    container.style("position", "relative");

    let tip = container.select<HTMLDivElement>(".tooltip-country");
    if (tip.empty()) {
      tip = container
        .append("div")
        .attr("class", "tooltip-country")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("background", "rgba(0,0,0,0.75)")
        .style("color", "white")
        .style("padding", "6px 8px")
        .style("border-radius", "6px")
        .style("font-size", "12px")
        .style("opacity", "0");
    }

    const t = d3.transition().duration(500).ease(d3.easeCubicInOut);

    const bars = g
      .selectAll<SVGRectElement, { country: string; count: number }>("rect.bar")
      .data(rows, (d: any) => d.country)
      .join("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d.country)!)
      .attr("width", x.bandwidth())
      .attr("y", (d) => y(d.count))
      .attr("height", (d) => innerH - y(d.count))
      .attr("rx", 3)
      .attr("fill", "#888")              // debug: make sure bars are visible/clickable
      .style("pointer-events", "all")     // ensure clicks register
      .style("cursor", "pointer")
      .on("click", (_, d) => {
        console.log("clicked country:", d.country);
        if (!onSelectCountry) return;
        onSelectCountry(selectedCountry === d.country ? null : d.country);
      });

    // animated update for height + opacity + selection styling
    bars
      .transition(t as any)
      .attr("y", (d) => y(d.count))
      .attr("height", (d) => innerH - y(d.count))
      .attr("opacity", (d) =>
        selectedCountry ? (d.country === selectedCountry ? 1 : 0.25) : 0.9
      )
      .attr("stroke", (d) => (d.country === selectedCountry ? "#333" : "none"))
      .attr("stroke-width", (d) => (d.country === selectedCountry ? 2 : 0));


    // value labels (optional, subtle)
    g.selectAll("text.value")
      .data(rows)
      .join("text")
      .attr("class", "value")
      .attr("x", (d) => (x(d.country)! + x.bandwidth() / 2))
      .attr("y", (d) => y(d.count) - 4)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .text((d) => d.count.toString());
  }, [rows, width, height, topN, selectedCountry]);

  return <svg ref={svgRef} />;
}
