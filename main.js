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

console.log("Data loaded:", data2019.length, data2022.length);

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
// SCALES + SVG SETUP (MAIN CHART)
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

    const m19 = sex.find(d => d.sex === "Male" && d.year === 2019)?.networth;
    const m22 = sex.find(d => d.sex === "Male" && d.year === 2022)?.networth;
    categories.push({ category: "Male HH", change: pct(m19, m22) });

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
// TEXT TOGGLE HANDLING
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

function initToggle() {
    console.log("Initializing toggle listeners...");
    
    const radioButtons = document.querySelectorAll("input[name='mode']");
    console.log("Found radio buttons:", radioButtons.length);
    
    radioButtons.forEach(input => {
        input.addEventListener("change", (e) => {
            console.log("Mode changed to:", e.target.value);
            window.mode = e.target.value;
            
            if (currentStep === 0) renderOverall();
            else if (currentStep === 1) renderBySex();
            else if (currentStep === 2) renderByAge();
            else if (currentStep === 3) renderByEducation();
            else if (currentStep === 4) renderFinalComparison();
            
            updateTextVisibility();
            renderInteractiveChart();
        });
    });
}

// ===========================================
// INTERACTIVE COLLAPSIBLE CHART (NEW!)
// ===========================================

// Track selected categories
const selectedCategories = {
    overall: true,
    male: false,
    female: false,
    under35: false,
    age3544: false,
    age4554: false,
    age5564: false,
    age65plus: false,
    lessHS: false,
    highSchool: false,
    someCollege: false,
    bachelors: false,
    graduate: false
};

function getAllPercentageChanges() {
    const overall = computeOverall();
    const sex = computeBySex();
    const age = computeByAge();
    const educ = computeByEduc();

    function pct(oldV, newV) {
        return ((newV - oldV) / oldV) * 100;
    }

    const allData = [];

    // Overall
    if (selectedCategories.overall) {
        allData.push({
            category: "Overall",
            change: pct(overall[0].networth, overall[1].networth),
            group: "overall"
        });
    }

    // Sex
    if (selectedCategories.male) {
        const m19 = sex.find(d => d.sex === "Male" && d.year === 2019)?.networth;
        const m22 = sex.find(d => d.sex === "Male" && d.year === 2022)?.networth;
        allData.push({ category: "Male", change: pct(m19, m22), group: "sex" });
    }
    if (selectedCategories.female) {
        const f19 = sex.find(d => d.sex === "Female" && d.year === 2019)?.networth;
        const f22 = sex.find(d => d.sex === "Female" && d.year === 2022)?.networth;
        allData.push({ category: "Female", change: pct(f19, f22), group: "sex" });
    }

    // Age groups
    const ageMap = {
        under35: "Under 35",
        age3544: "35-44",
        age4554: "45-54",
        age5564: "55-64",
        age65plus: "65+"
    };
    
    Object.keys(ageMap).forEach(key => {
        if (selectedCategories[key]) {
            const ageLabel = ageMap[key];
            const a19 = age.find(d => d.category === ageLabel && d.year === 2019)?.networth;
            const a22 = age.find(d => d.category === ageLabel && d.year === 2022)?.networth;
            if (a19 && a22) {
                allData.push({ category: ageLabel, change: pct(a19, a22), group: "age" });
            }
        }
    });

    // Education
    const educMap = {
        lessHS: "Less than HS",
        highSchool: "High School",
        someCollege: "Some College",
        bachelors: "Bachelor's",
        graduate: "Graduate"
    };

    Object.keys(educMap).forEach(key => {
        if (selectedCategories[key]) {
            const educLabel = educMap[key];
            const e19 = educ.find(d => d.category === educLabel && d.year === 2019)?.networth;
            const e22 = educ.find(d => d.category === educLabel && d.year === 2022)?.networth;
            if (e19 && e22) {
                allData.push({ category: educLabel, change: pct(e19, e22), group: "education" });
            }
        }
    });

    return allData;
}

function renderInteractiveChart() {
    const container = document.getElementById("interactive-chart-container");
    if (!container) return;

    // Clear previous chart
    container.innerHTML = "";

    const data = getAllPercentageChanges();

    if (data.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding:40px; color:#888;'>Select at least one category to display the chart</p>";
        return;
    }

    // Create SVG
    const svg = d3.select(container)
        .append("svg")
        .attr("width", 800)
        .attr("height", 500)
        .style("background", "white")
        .style("border-radius", "12px")
        .style("box-shadow", "0 4px 15px rgba(0,0,0,0.1)")
        .style("margin", "0 auto")
        .style("display", "block");

    const margin = { top: 60, right: 40, bottom: 100, left: 90 };
    const width = 800 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Scales
    const x = d3.scaleBand()
        .domain(data.map(d => d.category))
        .range([0, width])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([
            Math.min(0, d3.min(data, d => d.change)),
            d3.max(data, d => d.change) * 1.2
        ])
        .range([height, 0]);

    // Color scale
    const colorScale = d3.scaleOrdinal()
        .domain(["overall", "sex", "age", "education"])
        .range(["#4a90e2", "#e94e77", "#f97316", "#22c55e"]);

    // Bars
    g.selectAll("rect")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", d => x(d.category))
        .attr("width", x.bandwidth())
        .attr("y", d => Math.min(y(d.change), y(0)))
        .attr("height", d => Math.abs(y(d.change) - y(0)))
        .attr("fill", d => colorScale(d.group))
        .attr("rx", 4);

    // Value labels
    g.selectAll(".value-label")
        .data(data)
        .enter()
        .append("text")
        .attr("class", "value-label")
        .attr("x", d => x(d.category) + x.bandwidth() / 2)
        .attr("y", d => y(d.change) - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .text(d => d.change.toFixed(1) + "%");

    // Zero line
    g.append("line")
        .attr("x1", 0).attr("x2", width)
        .attr("y1", y(0)).attr("y2", y(0))
        .attr("stroke", "#555")
        .attr("stroke-width", 2);

    // Axes
    g.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end")
        .attr("dx", "-0.8em")
        .attr("dy", "0.15em");

    g.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => d + "%"));

    // Title
    svg.append("text")
        .attr("x", 800 / 2)
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .style("font-weight", "700")
        .text(window.mode === "nominal" 
            ? "Wealth Growth 2019-2022: Custom Comparison" 
            : "Real Wealth Growth (Inflation-adjusted): Custom Comparison");
}

function initCollapsibles() {
    const collapsibles = document.querySelectorAll(".collapsible");
    
    collapsibles.forEach(btn => {
        btn.addEventListener("click", function() {
            this.classList.toggle("active");
            const content = this.nextElementSibling;
            
            if (content.style.display === "block") {
                content.style.display = "none";
            } else {
                content.style.display = "block";
            }
        });
    });

    // Add listeners to all checkboxes
    document.querySelectorAll(".content-block input[type='checkbox']").forEach(checkbox => {
        checkbox.addEventListener("change", (e) => {
            const categoryKey = e.target.getAttribute("data-category");
            selectedCategories[categoryKey] = e.target.checked;
            renderInteractiveChart();
        });
    });
}

// Initialize everything
initToggle();
initCollapsibles();

// Initial load
renderOverall();
updateTextVisibility();
checkScroll();
renderInteractiveChart();