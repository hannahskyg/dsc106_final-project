
const data2019 = await d3.csv("data/2019.csv");
const data2022 = await d3.csv("data/2022.csv");

const mean2019 = d3.mean(data2019, d => +d.NETWORTH);
const mean2022 = d3.mean(data2022, d => +d.NETWORTH);

const meanBySex2019 = d3.rollups(data2019, v => d3.mean(v, d => +d.NETWORTH), d => d.HHSEX);
const meanBySex2022 = d3.rollups(data2022, v => d3.mean(v, d => +d.NETWORTH), d => d.HHSEX);



// ---------------- SAMPLE DATA ----------------
// You will replace this with your own aggregated values.
// From SCFP2019.csv and SCFP2022.csv

// Overall mean net worth for each year
const overallData = [
  { year: 2019, networth: mean2019 },
  { year: 2022, networth: mean2022 }
];

// Mean net worth by household-head sex
// HHSEX: 1 = Male, 2 = Female
const sexData = [
  { year: 2019, sex: "Male", networth: meanBySex2019.find(d => d[0] === "1")[1] },
  { year: 2019, sex: "Female", networth: meanBySex2019.find(d => d[0] === "2")[1] },
  { year: 2022, sex: "Male", networth: meanBySex2022.find(d => d[0] === "1")[1]  },
  { year: 2022, sex: "Female", networth: meanBySex2022.find(d => d[0] === "2")[1]  }
];

// ---------------- CHART SETUP ----------------
const svg = d3.select("#chart");
const width = +svg.attr("width");
const height = +svg.attr("height");
const margin = { top: 50, right: 40, bottom: 60, left: 80 };

const chartWidth = width - margin.left - margin.right;
const chartHeight = height - margin.top - margin.bottom;

const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

let x0 = d3.scaleBand().range([0, chartWidth]).padding(0.2);
let x1 = d3.scaleBand().padding(0.1);
let y = d3.scaleLinear().range([chartHeight, 0]);

const color = d3.scaleOrdinal()
  .domain(["Male", "Female"])
  .range(["#4a90e2", "#e94e77"]);

// Axis groups
const xAxisGroup = g.append("g").attr("transform", `translate(0, ${chartHeight})`);
const yAxisGroup = g.append("g");

// Chart title
svg.append("text")
  .attr("x", width / 2)
  .attr("y", 25)
  .attr("text-anchor", "middle")
  .style("font-size", "18px")
  .text("Mean U.S. Household Net Worth: 2019 vs 2022");

// ---------------- RENDER FUNCTIONS ----------------

// Overall (default)
function renderOverall() {
  const data = overallData;

  x0.domain(data.map(d => d.year));
  y.domain([0, d3.max(data, d => d.networth)]);

  // JOIN
  const bars = g.selectAll(".bar").data(data, d => d.year);

  // EXIT
  bars.exit().remove();

  // UPDATE + ENTER
  bars.enter()
    .append("rect")
    .attr("class", "bar")
    .merge(bars)
    .transition()
    .duration(600)
    .attr("x", d => x0(d.year))
    .attr("width", x0.bandwidth())
    .attr("y", d => y(d.networth))
    .attr("height", d => chartHeight - y(d.networth))
    .attr("fill", "#4a90e2");

  // Axes
  xAxisGroup.call(d3.axisBottom(x0).tickFormat(d => d));
  yAxisGroup.call(d3.axisLeft(y));
}

// Grouped by HHSEX
function renderBySex() {
  const data = sexData;

  const years = [...new Set(data.map(d => d.year))];
  const sexes = [...new Set(data.map(d => d.sex))];

  x0.domain(years);
  x1.domain(sexes).range([0, x0.bandwidth()]);

  y.domain([0, d3.max(data, d => d.networth)]);

  // JOIN
  const groups = g.selectAll(".year-group")
    .data(years);

  groups.enter()
    .append("g")
    .attr("class", "year-group")
    .merge(groups)
    .attr("transform", year => `translate(${x0(year)}, 0)`);

  const bars = g.selectAll(".year-group")
    .selectAll("rect")
    .data(year => data.filter(d => d.year === year));

  bars.exit().remove();

  bars.enter()
    .append("rect")
    .merge(bars)
    .transition()
    .duration(600)
    .attr("x", d => x1(d.sex))
    .attr("width", x1.bandwidth())
    .attr("y", d => y(d.networth))
    .attr("height", d => chartHeight - y(d.networth))
    .attr("fill", d => color(d.sex));

  xAxisGroup.call(d3.axisBottom(x0));
  yAxisGroup.call(d3.axisLeft(y));
}

// ---------------- TOGGLE LOGIC ----------------
document.getElementById("sexToggle").addEventListener("change", function () {
  if (this.checked) {
    renderBySex();
  } else {
    renderOverall();
  }
});

// Initial load
renderOverall();

