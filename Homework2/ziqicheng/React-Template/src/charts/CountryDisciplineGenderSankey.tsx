import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import {
  sankey as d3Sankey,
  sankeyLinkHorizontal,
  SankeyGraph,
  SankeyNode,
  SankeyLink,
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
  topCountries?: number;     // reduce clutter
  topDisciplines?: number;   // reduce clutter
};

function clean(v: any, fallback: string) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : fallback;
}

// Try to split “disciplines” if it contains multiple values.
// Many datasets are single discipline; this still works.
function splitDisciplines(s: string) {
  // common separators: comma, semicolon, pipe, slash
  const parts = s
    .split(/[,;|/]/g)
    .map((x) => x.trim())
    .filter(Boolean);

  // if no separator matched, keep original
  return parts.length ? parts : [s];
}

export default function CountryDisciplineGenderSankey({
  data,
  width = 1120,
  height = 340,
  topCountries = 12,
  topDisciplines = 12,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const graph = useMemo(() => {
    // 1) Clean rows
    const cleaned = data.map((d) => ({
      country: clean(d.country, "Unknown Country"),
      disciplineRaw: clean(d.disciplines, "Unknown Discipline"),
      gender: clean(d.gender, "Unknown"),
    }));

    // 2) Top-N country filter (by athlete count)
    const countryCounts = d3.rollup(
      cleaned,
      (v) => v.length,
      (d) => d.country
    );
    const topCountrySet = new Set(
      Array.from(countryCounts, ([k, v]) => ({ k, v }))
        .sort((a, b) => d3.descending(a.v, b.v))
        .slice(0, topCountries)
        .map((d) => d.k)
    );

    const filteredCountries = cleaned.filter((d) => topCountrySet.has(d.country));

    // 3) Explode disciplines (if multi-valued)
    const exploded: { country: string; discipline: string; gender: string }[] = [];
    for (const d of filteredCountries) {
      for (const disc of splitDisciplines(d.disciplineRaw)) {
        exploded.push({
          country: d.country,
          discipline: disc,
          gender: d.gender,
        });
      }
    }

    // 4) Top-N discipline filter (by count, after country filter)
    const discCounts = d3.rollup(
      exploded,
      (v) => v.length,
      (d) => d.discipline
    );
    const topDiscSet = new Set(
      Array.from(discCounts, ([k, v]) => ({ k, v }))
        .sort((a, b) => d3.descending(a.v, b.v))
        .slice(0, topDisciplines)
        .map((d) => d.k)
    );

    const finalRows = exploded.filter((d) => topDiscSet.has(d.discipline));

    // 5) Build links: Country -> Discipline, Discipline -> Gender
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

    const links = Array.from(linksMap, ([key, value]) => {
      const [source, target] = key.split("|||");
      return { source, target, value };
    });

    // Nodes are all unique labels appearing in links
    const nodeNames = Array.from(
      new Set(links.flatMap((l) => [l.source, l.target]))
    );

    // Nice ordering: Countries left, Disciplines middle, Gender right
    const countries = nodeNames.filter((n) => n.startsWith("C: "));
    const disciplines = nodeNames.filter((n) => n.startsWith("D: "));
    const genders = nodeNames.filter((n) => n.startsWith("G: "));

    const ordered = [...countries.sort(), ...disciplines.sort(), ...genders.sort()];
    const nodes = ordered.map((name) => ({ name }));

    // Map name -> index for sankey numeric linking
    const idx = new Map(nodes.map((n, i) => [n.name, i]));
    const sankeyLinks = links.map((l) => ({
      source: idx.get(l.source)!,
      target: idx.get(l.target)!,
      value: l.value,
    }));

    return { nodes, links: sankeyLinks };
  }, [data, topCountries, topDisciplines]);

  useEffect(() => {
    if (!svgRef.current) return;

    const margin = { top: 28, right: 12, bottom: 14, left: 12 };
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
      .text("Country → Discipline → Gender (Sankey, Top categories)");

    // Build sankey layout
    const sankeyGen = d3Sankey<
      SankeyNode<{ name: string }, {}>,
      SankeyLink<SankeyNode<{ name: string }, {}>, {}>
    >()
      .nodeWidth(12)
      .nodePadding(10)
      .extent([
        [0, 0],
        [innerW, innerH],
      ]);

    const sankeyData: SankeyGraph<{ name: string }, { value: number }> = {
      nodes: graph.nodes.map((d) => ({ ...d })),
      links: graph.links.map((d) => ({ ...d })),
    };

    const { nodes, links } = sankeyGen(sankeyData);

    // Color nodes by “layer”
    const layer = (name: string) =>
      name.startsWith("C: ") ? "Country" : name.startsWith("D: ") ? "Discipline" : "Gender";

    const layers = ["Country", "Discipline", "Gender"];
    const color = d3.scaleOrdinal<string>().domain(layers).range(d3.schemeTableau10);

    // Links
    g.append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.35)
      .attr("stroke-width", (d: any) => Math.max(1, d.width));

    // Nodes
    const nodeG = g.append("g").selectAll("g").data(nodes).join("g");

    nodeG
      .append("rect")
      .attr("x", (d: any) => d.x0)
      .attr("y", (d: any) => d.y0)
      .attr("height", (d: any) => Math.max(1, d.y1 - d.y0))
      .attr("width", (d: any) => d.x1 - d.x0)
      .attr("rx", 2)
      .attr("fill", (d: any) => color(layer(d.name)) as string)
      .attr("opacity", 0.9);

    // Labels
    nodeG
      .append("text")
      .attr("x", (d: any) => (d.x0 < innerW / 2 ? d.x1 + 6 : d.x0 - 6))
      .attr("y", (d: any) => (d.y0 + d.y1) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d: any) => (d.x0 < innerW / 2 ? "start" : "end"))
      .attr("font-size", 10)
      .text((d: any) => d.name.replace(/^C:\s|^D:\s|^G:\s/, ""));

    // Simple legend
    const legend = g.append("g").attr("transform", `translate(${innerW - 240}, 6)`);
    const li = legend.selectAll("g").data(layers).join("g").attr("transform", (_, i) => `translate(${i * 80},0)`);
    li.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("y", -8).attr("fill", (d) => color(d) as string);
    li.append("text").attr("x", 14).attr("y", 0).attr("font-size", 11).text((d) => d);
  }, [graph, width, height]);

  return <svg ref={svgRef} />;
}
