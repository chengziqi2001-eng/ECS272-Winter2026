import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import {
  sankey as d3Sankey,
  sankeyLinkHorizontal,
  SankeyGraph,
} from "d3-sankey";

type AthleteRow = {
  country?: string;
  disciplines?: string;
  gender?: string;
};

type Props = {
  data: AthleteRow[];
  width?: number;
  height?: number;
  topCountries?: number;
  topDisciplines?: number;
  selectedCountry?: string | null;
};

function clean(v: any, fallback: string) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : fallback;
}

function splitDisciplines(s: string) {
  const parts = s
    .split(/[,;|/]/g)
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length ? parts : [s];
}

export default function CountryDisciplineGenderSankey({
  data,
  width = 900,
  height = 640,
  topCountries = 12,
  topDisciplines = 12,
  selectedCountry = null,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const graph = useMemo(() => {
    const cleaned = data.map((d) => ({
      country: clean(d.country, "Unknown Country"),
      disciplineRaw: clean(d.disciplines, "Unknown Discipline"),
      gender: clean(d.gender, "Unknown"),
    }));

    // If a country is selected, only use that country (skip topCountries filtering)
    const base = selectedCountry
      ? cleaned.filter((d) => d.country === selectedCountry)
      : cleaned;

    // Country filter only when NOT selected
    let filteredCountries = base;
    if (!selectedCountry) {
      const countryCounts = d3.rollup(base, (v) => v.length, (d) => d.country);
      const topCountrySet = new Set(
        Array.from(countryCounts, ([k, v]) => ({ k, v }))
          .sort((a, b) => d3.descending(a.v, b.v))
          .slice(0, topCountries)
          .map((d) => d.k)
      );
      filteredCountries = base.filter((d) => topCountrySet.has(d.country));
    }

    // Explode disciplines (in case list-like)
    const exploded: { country: string; discipline: string; gender: string }[] = [];
    for (const d of filteredCountries) {
      for (const disc of splitDisciplines(d.disciplineRaw)) {
        exploded.push({ country: d.country, discipline: disc, gender: d.gender });
      }
    }

    // Top disciplines filter
    const discCounts = d3.rollup(exploded, (v) => v.length, (d) => d.discipline);
    const topDiscSet = new Set(
      Array.from(discCounts, ([k, v]) => ({ k, v }))
        .sort((a, b) => d3.descending(a.v, b.v))
        .slice(0, topDisciplines)
        .map((d) => d.k)
    );
    const finalRows = exploded.filter((d) => topDiscSet.has(d.discipline));

    // Build links
    const linksMap = new Map<string, number>();
    const addLink = (source: string, target: string, value: number) => {
      const key = `${source}|||${target}`;
      linksMap.set(key, (linksMap.get(key) ?? 0) + value);
    };

    for (const r of finalRows) {
      const c = `C: ${r.country}`;
      const p = `D: ${r.discipline}`;
      const g = `G: ${r.gender}`;
      addLink(c, p, 1);
      addLink(p, g, 1);
    }

    const linksNamed = Array.from(linksMap, ([key, value]) => {
      const [source, target] = key.split("|||");
      return { source, target, value };
    });

    const nodeNames = Array.from(new Set(linksNamed.flatMap((l) => [l.source, l.target])));

    const countries = nodeNames.filter((n) => n.startsWith("C: ")).sort();
    const disciplines = nodeNames.filter((n) => n.startsWith("D: ")).sort();
    const genders = nodeNames.filter((n) => n.startsWith("G: ")).sort();

    const ordered = [...countries, ...disciplines, ...genders];
    const nodes = ordered.map((name) => ({ name }));

    const idx = new Map(nodes.map((n, i) => [n.name, i]));
    const links = linksNamed.map((l) => ({
      source: idx.get(l.source)!,
      target: idx.get(l.target)!,
      value: l.value,
    }));

    return { nodes, links };
  }, [data, topCountries, topDisciplines, selectedCountry]);

  useEffect(() => {
    if (!svgRef.current) return;

    const margin = { top: 34, right: 12, bottom: 14, left: 12 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);

    // Fade out old diagram, then remove
    svg.selectAll("g.sankey-root")
      .transition()
      .duration(250)
      .style("opacity", 0)
      .remove();

    // Create new root and fade in
    const root = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("class", "sankey-root")
      .style("opacity", 0)
      .attr("transform", `translate(${margin.left},${margin.top})`);

    root.transition().duration(450).style("opacity", 1);

    // Tooltip
    const parent = svgRef.current.parentElement;
    if (!parent) return;
    const container = d3.select(parent).style("position", "relative");

    let tip = container.select<HTMLDivElement>(".tooltip-sankey");
    if (tip.empty()) {
      tip = container
        .append("div")
        .attr("class", "tooltip-sankey")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("background", "rgba(0,0,0,0.75)")
        .style("color", "white")
        .style("padding", "6px 8px")
        .style("border-radius", "6px")
        .style("font-size", "12px")
        .style("opacity", "0")
        .style("max-width", "280px");
    }

    const showTip = (event: any, html: string) => {
      tip
        .style("opacity", "1")
        .style("left", `${event.offsetX + 12}px`)
        .style("top", `${event.offsetY - 8}px`)
        .html(html);
    };
    const hideTip = () => tip.style("opacity", "0");

    // Title (inside root so it fades too)
    root
      .append("text")
      .attr("x", 0)
      .attr("y", -12)
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .text(selectedCountry
        ? `Sankey for ${selectedCountry} (Discipline → Gender)`
        : "Country → Discipline → Gender (Sankey)");

    // Sankey generator
    const sankeyGen = d3Sankey<{ name: string }, { source: number; target: number; value: number }>()
      .nodeWidth(12)
      .nodePadding(10)
      .extent([[0, 0], [innerW, innerH]]);

    const sankeyData: SankeyGraph<{ name: string }, { source: number; target: number; value: number }> = {
      nodes: graph.nodes.map((d) => ({ ...d })),
      links: graph.links.map((d) => ({ ...d })),
    };

    const { nodes, links } = sankeyGen(sankeyData);

    const layer = (name: string) =>
      name.startsWith("C: ") ? "Country" : name.startsWith("D: ") ? "Discipline" : "Gender";

    const layers = ["Country", "Discipline", "Gender"];
    const color = d3.scaleOrdinal<string>().domain(layers).range(d3.schemeTableau10);

    // Links
    root
      .append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.35)
      .attr("stroke-width", (d: any) => Math.max(1, d.width))
      .on("mousemove", (event: any, d: any) => {
        const s = d.source.name.replace(/^.\:\s/, "");
        const t = d.target.name.replace(/^.\:\s/, "");
        showTip(event, `<b>${s}</b> → <b>${t}</b><br/>Value: ${d.value}`);
      })
      .on("mouseleave", hideTip);

    // Nodes
    const nodeG = root.append("g").selectAll("g").data(nodes).join("g");

    nodeG
      .append("rect")
      .attr("x", (d: any) => d.x0)
      .attr("y", (d: any) => d.y0)
      .attr("height", (d: any) => Math.max(1, d.y1 - d.y0))
      .attr("width", (d: any) => d.x1 - d.x0)
      .attr("rx", 2)
      .attr("fill", (d: any) => color(layer(d.name)) as string)
      .attr("opacity", 0.9)
      .on("mousemove", (event: any, d: any) => {
        const n = d.name.replace(/^.\:\s/, "");
        showTip(event, `<b>${n}</b><br/>Total: ${d.value}`);
      })
      .on("mouseleave", hideTip);

    // Labels
    nodeG
      .append("text")
      .attr("x", (d: any) => (d.x0 < innerW / 2 ? d.x1 + 6 : d.x0 - 6))
      .attr("y", (d: any) => (d.y0 + d.y1) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d: any) => (d.x0 < innerW / 2 ? "start" : "end"))
      .attr("font-size", 10)
      .text((d: any) => d.name.replace(/^C:\s|^D:\s|^G:\s/, ""));

    // Legend
    const legend = root.append("g").attr("transform", `translate(${innerW - 240}, 10)`);
    const li = legend
      .selectAll("g")
      .data(layers)
      .join("g")
      .attr("transform", (_, i) => `translate(${i * 80},0)`);

    li.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("rx", 2)
      .attr("y", -8)
      .attr("fill", (d) => color(d) as string);

    li.append("text")
      .attr("x", 14)
      .attr("y", 0)
      .attr("font-size", 11)
      .text((d) => d);
  }, [graph, width, height, selectedCountry]);

  return <svg ref={svgRef} />;
}
