import { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import "./App.css";
import CountryBarChart from "./charts/CountryBarChart";
import HeightWeightScatter from "./charts/HeightWeightScatter";
import CountryDisciplineGenderSankey from "./charts/CountryDisciplineGenderSankey";




type AthleteRow = {
  name: string;
  gender: string;
  country: string;
  disciplines: string;
  height?: string;
  weight?: string;
  birth_date?: string;
};

function parseNumber(v: any) {
  const n = +v;
  return Number.isFinite(n) ? n : null;
}

function parseYearFromBirthDate(s?: string) {
  if (!s) return null;
  const y = +String(s).slice(0, 4);
  return Number.isFinite(y) ? y : null;
}

export default function App() {
  const [rows, setRows] = useState<AthleteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  useEffect(() => {
    d3.csv("/data/athletes.csv").then((data) => {
      setRows(data as unknown as AthleteRow[]);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
  console.log("selectedCountry changed:", selectedCountry);
}, [selectedCountry]);

  const stats = useMemo(() => {
    const n = rows.length;
    const countries = new Set(rows.map((d) => d.country).filter(Boolean));
    const disciplines = new Set(rows.map((d) => d.disciplines).filter(Boolean));
    

    return { n, countries: countries.size, disciplines: disciplines.size };
  }, [rows]);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
  <div style={{ padding: 16 }}>
    <h2 style={{ margin: "0 0 6px 0" }}>
      HW2 Dashboard (Paris Athletes)
    </h2>

    <div style={{ marginBottom: 10, fontSize: 13 }}>
      Loaded <b>{stats.n}</b> athletes • <b>{stats.countries}</b> countries •{" "}
      <b>{stats.disciplines}</b> disciplines
    </div>

    <div className="dashboard">
 <div className="panel">
  <h3>View 1 (Overview): Athletes by Country</h3>
  <CountryBarChart
    data={rows}
    topN={15}
    width={380}
    height={290}
    selectedCountry={selectedCountry}
    onSelectCountry={setSelectedCountry}
  />
  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
    Click a bar to filter all views. Click again to clear.
  </div>
</div>

<div className="panel">
  <h3>View 2 (Focus): Height vs Weight</h3>
  <HeightWeightScatter
    data={rows}
    width={380}
    height={270}
    selectedCountry={selectedCountry}
  />
</div>

<div className="panel" style={{ gridRow: "1 / span 2", gridColumn: "2" }}>
  <h3>View 3 (Advanced): Sankey Flow</h3>
  <CountryDisciplineGenderSankey
    data={rows}
    selectedCountry={selectedCountry}
    width={900}
    height={640}
    topCountries={12}
    topDisciplines={12}
  />
</div>

</div>

  </div>
);

}
