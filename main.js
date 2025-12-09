// ===========================================
// REAL / NOMINAL TOGGLE MODE
// ===========================================
window.mode = "nominal"; // default

// CPI (example values — replace with real dataset if needed)
const CPI = {
    2019: 255.7,
    2022: 296.8
};
const CPI_REF = CPI[2022];

function adjustForInflation(nominal, year) {
    if (window.mode === "nominal") return +nominal;
    return +nominal * (CPI_REF / CPI[year]);
}

// ===========================================
// LOAD DATA
// ===========================================
const data2019 = await d3.csv("data/2019.csv");
const data2022 = await d3.csv("data/2022.csv");

console.log("Data loaded:", data2019.length, data2022.length); // Debug

// ===========================================
// GROUP HELPERS
// ===========================================
function getAgeGroup(age) {
    age = +age;
    if (age < 35) return "Under 35";
    if (age < 45) return "35-44";
    if (age < 55) return "45-54";
    if (age < 65) return "55-64";
    return "65+";
}

function mapEducation(code) {
    code = +code;
    if (code === 1) return "Less than HS";
    if (code === 2) return "High School";
    if (code === 3) return "Some College";
    if (code === 4) return "Bachelor's";
    if (code === 5 || code === 6 || code === 7) return "Graduate";
    return null;
}

// ===========================================
// GENERALIZED MEDIAN FUNCTION (NOMINAL/REAL)
// ===========================================
function medianCalc(data, year) {
    return d3.median(data, d => adjustForInflation(d.NETWORTH, year));
}

// ===========================================
// MEDIAN OVERALL
// ===========================================
function computeOverall() {
    return [
        { year: 2019, networth: medianCalc(data2019, 2019) },
        { year: 2022, networth: medianCalc(data2022, 2022) }
    ];
}

// ===========================================
// SEX ROLLUPS
// ===========================================
function computeBySex() {
    function roll(data, year) {
        return d3.rollups(
            data,
            v => d3.median(v, d => adjustForInflation(d.NETWORTH, year)),
            d => d.HHSEX
        );
    }

    const r19 = roll(data2019, 2019);
    const r22 = roll(data2022, 2022);

    return [
        { year: 2019, sex: "Male", networth: r19.find(d => d[0] === "1")?.[1] },
        { year: 2019, sex: "Female", networth: r19.find(d => d[0] === "2")?.[1] },
        { year: 2022, sex: "Male", networth: r22.find(d => d[0] === "1")?.[1] },
        { year: 2022, sex: "Female", networth: r22.find(d => d[0] === "2")?.[1] }
    ];
}

// ===========================================
// AGE ROLLUPS
// ===========================================
function computeByAge() {
    const roll19 = d3.rollups(
        data2019,
        v => d3.median(v, d => adjustForInflation(d.NETWORTH, 2019)),
        d => getAgeGroup(d.AGE)
    );
    const roll22 = d3.rollups(
        data2022,
        v => d3.median(v, d => adjustForInflation(d.NETWORTH, 2022)),
        d => getAgeGroup(d.AGE)
    );

    return [
        ...roll19.map(d => ({ year: 2019, category: d[0], networth: d[1] })),
        ...roll22.map(d => ({ year: 2022, category: d[0], networth: d[1] }))
    ];
}

// ===========================================
// EDUCATION ROLLUPS
// ===========================================
function computeByEduc() {
    const c19 = data2019.filter(d => mapEducation(d.EDUC));
    const c22 = data2022.filter(d => mapEducation(d.EDUC));

    const r19 = d3.rollups(
        c19,
        v => d3.median(v, d => adjustForInflation(d.NETWORTH, 2019)),
        d => mapEducation(d.EDUC)
    );

    const r22 = d3.rollups(
        c22,
        v => d3.median(v, d => adjustForInflation(d.NETWORTH, 2022)),
        d => mapEducation(d.EDUC)
    );

    return [
        ...r19.map(d => ({ year: 2019, category: d[0], networth: d[1] })),
        ...r22.map(d => ({ year: 2022, category: d[0], networth: d[1] }))
    ];
}

// ===========================================
// SCALES + SVG SETUP
// ===========================================
const svg = d3.select("#chart");
const width = 600, height = 500;
const margin = { top: 60, right: 40, bottom: 80, left: 90 };
const chartWidth = width - margin.left - margin.right;
const chartHeight = height - margin.top - margin.bottom;

const g = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

let x0 = d3.scaleBand().range([0, chartWidth]).padding(0.25);
let x1 = d3.scaleBand().padding(0.15);
let y = d3.scaleLinear().range([chartHeight, 0]);

const xAxisGroup = g.append("g").attr("transform", `translate(0, ${chartHeight})`);
const yAxisGroup = g.append("g");

const title = svg.append("text")
    .attr("x", width / 2)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .style("font-size", "20px")
    .style("font-weight", "700");

const legend = d3.select("#legend");

function formatCurrency(v) {
    if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(2) + "M";
    if (v >= 1000) return "$" + (v / 1000).toFixed(0) + "K";
    return "$" + v;
}

function clearChart() {
    g.selectAll("rect").remove();
    g.selectAll(".year-group").remove();
    g.selectAll(".value-label").remove();
    g.selectAll(".zero-line").remove();
    legend.html("").style("display", "none");
}

// ===========================================
// RENDER FUNCTIONS (Adjusted for REAL/NOMINAL)
// ===========================================
function renderOverall() {
    clearChart();
    title.text(
        window.mode === "nominal"
            ? "Median U.S. Household Net Worth"
            : "Real Median Net Worth (Inflation-adjusted)"
    );

    const data = computeOverall();
    x0.domain([2019, 2022]);
    y.domain([0, d3.max(data, d => d.networth) * 1.2]);

    g.selectAll(".bar")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", d => x0(d.year))
        .attr("y", chartHeight)
        .attr("height", 0)
        .attr("width", x0.bandwidth())
        .attr("fill", "#4a90e2")
        .transition()
        .duration(800)
        .attr("y", d => y(d.networth))
        .attr("height", d => chartHeight - y(d.networth));

    xAxisGroup.call(d3.axisBottom(x0));
    yAxisGroup.call(d3.axisLeft(y).ticks(5).tickFormat(formatCurrency));
}

function renderBySex() {
    clearChart();
    title.text(
        window.mode === "nominal"
            ? "Median Net Worth by Sex"
            : "Real Net Worth by Sex (Inflation-adjusted)"
    );

    const data = computeBySex();
    const years = [2019, 2022];
    const sexes = ["Male", "Female"];

    x0.domain(years);
    x1.domain(sexes).range([0, x0.bandwidth()]);
    y.domain([0, d3.max(data, d => d.networth) * 1.2]);

    const groups = g.selectAll(".year-group")
        .data(years)
        .enter()
        .append("g")
        .attr("class", "year-group")
        .attr("transform", d => `translate(${x0(d)},0)`);

    groups.selectAll("rect")
        .data(d => data.filter(s => s.year === d))
        .enter()
        .append("rect")
        .attr("x", d => x1(d.sex))
        .attr("width", x1.bandwidth())
        .attr("y", chartHeight)
        .attr("height", 0)
        .attr("fill", d => (d.sex === "Male" ? "#4a90e2" : "#e94e77"))
        .transition()
        .duration(800)
        .attr("y", d => y(d.networth))
        .attr("height", d => chartHeight - y(d.networth));

    groups.selectAll(".value-label")
        .data(d => data.filter(s => s.year === d))
        .enter()
        .append("text")
        .attr("class", "value-label")
        .attr("x", d => x1(d.sex) + x1.bandwidth() / 2)
        .attr("y", d => y(d.networth) - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text(d => formatCurrency(d.networth));

    xAxisGroup.call(d3.axisBottom(x0));
    yAxisGroup.call(d3.axisLeft(y).ticks(5).tickFormat(formatCurrency));

    legend.style("display", "flex");
    ["Male", "Female"].forEach(sex => {
        const item = legend.append("div").attr("class", "legend-item");
        item.append("div")
            .attr("class", "legend-color")
            .style("background", sex === "Male" ? "#4a90e2" : "#e94e77");
        item.append("span").text(sex);
    });
}

function renderByAge() {
    clearChart();
    title.text(
        window.mode === "nominal"
            ? "Median Net Worth by Age Group"
            : "Real Net Worth by Age Group (Inflation-adjusted)"
    );

    const data = computeByAge();
    const years = [2019, 2022];
    const ageOrder = ["Under 35", "35-44", "45-54", "55-64", "65+"];

    x0.domain(years);
    x1.domain(ageOrder).range([0, x0.bandwidth()]);
    y.domain([0, d3.max(data, d => d.networth) * 1.2]);

    const colorAge = d3.scaleOrdinal()
        .domain(ageOrder)
        .range(["#e94e77", "#f97316", "#eab308", "#22c55e", "#4a90e2"]);

    const groups = g.selectAll(".year-group")
        .data(years)
        .enter()
        .append("g")
        .attr("class", "year-group")
        .attr("transform", d => `translate(${x0(d)},0)`);

    groups.selectAll("rect")
        .data(d => data.filter(a => a.year === d))
        .enter()
        .append("rect")
        .attr("x", d => x1(d.category))
        .attr("width", x1.bandwidth())
        .attr("y", chartHeight)
        .attr("height", 0)
        .attr("fill", d => colorAge(d.category))
        .transition()
        .duration(800)
        .attr("y", d => y(d.networth))
        .attr("height", d => chartHeight - y(d.networth));

    groups.selectAll(".value-label")
        .data(d => data.filter(a => a.year === d))
        .enter()
        .append("text")
        .attr("class", "value-label")
        .attr("x", d => x1(d.category) + x1.bandwidth() / 2)
        .attr("y", d => y(d.networth) - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text(d => formatCurrency(d.networth));

    xAxisGroup.call(d3.axisBottom(x0));
    yAxisGroup.call(d3.axisLeft(y).ticks(5).tickFormat(formatCurrency));

    legend.style("display", "flex");
    ageOrder.forEach(cat => {
        const item = legend.append("div").attr("class", "legend-item");
        item.append("div")
            .attr("class", "legend-color")
            .style("background", colorAge(cat));
        item.append("span").text(cat);
    });
}

function renderByEducation() {
    clearChart();
    title.text(
        window.mode === "nominal"
            ? "Median Net Worth by Education Level"
            : "Real Net Worth by Education (Inflation-adjusted)"
    );

    const data = computeByEduc();
    const years = [2019, 2022];
    const order = ["Less than HS", "High School", "Some College", "Bachelor's", "Graduate"];

    const colorEduc = d3.scaleOrdinal()
        .domain(order)
        .range(d3.schemeSet2);

    x0.domain(years);
    x1.domain(order).range([0, x0.bandwidth()]);
    y.domain([0, d3.max(data, d => d.networth) * 1.2]);

    const groups = g.selectAll(".year-group")
        .data(years)
        .enter()
        .append("g")
        .attr("class", "year-group")
        .attr("transform", d => `translate(${x0(d)},0)`);

    groups.selectAll("rect")
        .data(d => data.filter(e => e.year === d))
        .enter()
        .append("rect")
        .attr("x", d => x1(d.category))
        .attr("width", x1.bandwidth())
        .attr("y", chartHeight)
        .attr("height", 0)
        .attr("fill", d => colorEduc(d.category))
        .transition()
        .duration(800)
        .attr("y", d => y(d.networth))
        .attr("height", d => chartHeight - y(d.networth));

    groups.selectAll(".value-label")
        .data(d => data.filter(e => e.year === d))
        .enter()
        .append("text")
        .attr("class", "value-label")
        .attr("x", d => x1(d.category) + x1.bandwidth() / 2)
        .attr("y", d => y(d.networth) - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text(d => formatCurrency(d.networth));

    xAxisGroup.call(d3.axisBottom(x0));
    yAxisGroup.call(d3.axisLeft(y).ticks(5).tickFormat(formatCurrency));

    legend.style("display", "flex");
    order.forEach(cat => {
        const item = legend.append("div").attr("class", "legend-item");
        item.append("div")
            .attr("class", "legend-color")
            .style("background", colorEduc(cat));
        item.append("span").text(cat);
    });
}

// ===========================================
// FINAL COMPARISON
// ===========================================
function renderFinalComparison() {
    clearChart();
    title.text(
        window.mode === "nominal"
            ? "Wealth Growth 2019–2022: Who Benefited Most?"
            : "Real Wealth Growth (Inflation-adjusted)"
    );

    const overall = computeOverall();
    const sex = computeBySex();
    const age = computeByAge();

    function pct(oldV, newV) {
        return ((newV - oldV) / oldV) * 100;
    }

    const categories = [];

    categories.push({
        category: "Overall",
        change: pct(overall[0].networth, overall[1].networth)
    });

    // Male
    const m19 = sex.find(d => d.sex === "Male" && d.year === 2019)?.networth;
    const m22 = sex.find(d => d.sex === "Male" && d.year === 2022)?.networth;
    categories.push({ category: "Male HH", change: pct(m19, m22) });

    // Female
    const f19 = sex.find(d => d.sex === "Female" && d.year === 2019)?.networth;
    const f22 = sex.find(d => d.sex === "Female" && d.year === 2022)?.networth;
    categories.push({ category: "Female HH", change: pct(f19, f22) });

    ["Under 35", "45-54", "65+"].forEach(a => {
        const a19 = age.find(d => d.category === a && d.year === 2019)?.networth;
        const a22 = age.find(d => d.category === a && d.year === 2022)?.networth;
        if (a19 && a22) {
            categories.push({ category: a, change: pct(a19, a22) });
        }
    });

    x0.domain(categories.map(d => d.category));
    y.domain([
        Math.min(0, d3.min(categories, d => d.change)),
        d3.max(categories, d => d.change) * 1.2
    ]);

    g.selectAll("rect")
        .data(categories)
        .enter()
        .append("rect")
        .attr("x", d => x0(d.category))
        .attr("width", x0.bandwidth())
        .attr("y", y(0))
        .attr("height", 0)
        .attr("fill", d => d.change >= 0 ? "#22c55e" : "#ef4444")
        .transition()
        .duration(800)
        .attr("y", d => Math.min(y(d.change), y(0)))
        .attr("height", d => Math.abs(y(d.change) - y(0)));

    g.selectAll(".value-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "value-label")
        .attr("x", d => x0(d.category) + x0.bandwidth() / 2)
        .attr("y", d => y(d.change) - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text(d => d.change.toFixed(0) + "%");

    // Zero line
    g.append("line")
        .attr("class", "zero-line")
        .attr("x1", 0).attr("x2", chartWidth)
        .attr("y1", y(0)).attr("y2", y(0))
        .attr("stroke", "#555")
        .attr("stroke-width", 1.5);

    xAxisGroup.call(d3.axisBottom(x0).tickFormat(d => d));
    yAxisGroup.call(d3.axisLeft(y).ticks(5).tickFormat(d => d + "%"));
}

// ===========================================
// SCROLL HANDLING
// ===========================================
let currentStep = 0;

const steps = document.querySelectorAll(".step");
const scrollContainer = document.getElementById("scroll-container");

function updateChart(stepIndex) {
    if (stepIndex === currentStep) return;
    currentStep = stepIndex;

    if (stepIndex === 0) renderOverall();
    if (stepIndex === 1) renderBySex();
    if (stepIndex === 2) renderByAge();
    if (stepIndex === 3) renderByEducation();
    if (stepIndex === 4) renderFinalComparison();

    updateTextVisibility();
}

function checkScroll() {
    const scrollTop = window.scrollY;
    const containerTop = scrollContainer.offsetTop;

    steps.forEach((step, i) => {
        const stepTop = step.offsetTop + containerTop;
        const stepHeight = step.offsetHeight;

        if (
            scrollTop >= stepTop - window.innerHeight / 2 &&
            scrollTop < stepTop + stepHeight - window.innerHeight / 2
        ) {
            updateChart(i);
        }
    });
}

window.addEventListener("scroll", checkScroll);
window.addEventListener("resize", checkScroll);

// ===========================================
// TEXT TOGGLE HANDLING - FIXED!
// ===========================================
function updateTextVisibility() {
    const isNominal = window.mode === "nominal";

    document.querySelectorAll(".nominal-text").forEach(el => {
        el.style.display = isNominal ? "block" : "none";
    });
    document.querySelectorAll(".real-text").forEach(el => {
        el.style.display = isNominal ? "none" : "block";
    });
}

// CRITICAL FIX: Wait for DOM to be ready, then attach listeners
function initToggle() {
    console.log("Initializing toggle listeners..."); // Debug
    
    const radioButtons = document.querySelectorAll("input[name='mode']");
    console.log("Found radio buttons:", radioButtons.length); // Debug
    
    radioButtons.forEach(input => {
        input.addEventListener("change", (e) => {
            console.log("Mode changed to:", e.target.value); // Debug
            window.mode = e.target.value;
            
            // Force re-render of current step
            if (currentStep === 0) renderOverall();
            else if (currentStep === 1) renderBySex();
            else if (currentStep === 2) renderByAge();
            else if (currentStep === 3) renderByEducation();
            else if (currentStep === 4) renderFinalComparison();
            
            updateTextVisibility();
        });
    });
}

// Call init function to set up listeners
initToggle();

// Initial load
renderOverall();
updateTextVisibility();
checkScroll();