const data2019 = await d3.csv("data/2019.csv");
const data2022 = await d3.csv("data/2022.csv");

// Use MEDIAN instead of MEAN for wealth data (more realistic)
const median2019 = d3.median(data2019, d => +d.NETWORTH);
const median2022 = d3.median(data2022, d => +d.NETWORTH);

// Keep HHSEX as string (CSV values are strings "1" and "2")
const medianBySex2019 = d3.rollups(data2019, v => d3.median(v, d => +d.NETWORTH), d => d.HHSEX);
const medianBySex2022 = d3.rollups(data2022, v => d3.median(v, d => +d.NETWORTH), d => d.HHSEX);

function getAgeGroup(age) {
    age = +age;
    if (age < 35) return "Under 35";
    if (age < 45) return "35-44";
    if (age < 55) return "45-54";
    if (age < 65) return "55-64";
    return "65+";
}

const medianByAge2019 = d3.rollups(data2019, v => d3.median(v, d => +d.NETWORTH), d => getAgeGroup(d.AGE));
const medianByAge2022 = d3.rollups(data2022, v => d3.median(v, d => +d.NETWORTH), d => getAgeGroup(d.AGE));

// Expanded education mapping - SCF typically uses this scale
// Let's create a comprehensive mapping and log what we find
const educMap = {
    1: "No High School",
    2: "High School", 
    3: "Some College",
    4: "College Degree",
    // Additional common SCF codes
    5: "Graduate Degree",
    6: "Professional Degree",
    7: "Doctorate"
};

// Log unique education values to help debug
console.log("Unique EDUC values in 2019:", [...new Set(data2019.map(d => d.EDUC))].sort());
console.log("Unique EDUC values in 2022:", [...new Set(data2022.map(d => d.EDUC))].sort());

const medianByEduc2019 = d3.rollups(data2019, v => d3.median(v, d => +d.NETWORTH), d => educMap[d.EDUC] || `Unknown (${d.EDUC})`);
const medianByEduc2022 = d3.rollups(data2022, v => d3.median(v, d => +d.NETWORTH), d => educMap[d.EDUC] || `Unknown (${d.EDUC})`);

// Log the results to verify
console.log("Median by education 2019:", medianByEduc2019);
console.log("Median by education 2022:", medianByEduc2022);

// Overall median net worth for each year
const overallData = [
    { year: 2019, networth: median2019 },
    { year: 2022, networth: median2022 }
];

// Median net worth by household-head sex
// HHSEX: "1" = Male, "2" = Female (CSV returns strings)
const sexData = [
    { year: 2019, sex: "Male", networth: medianBySex2019.find(d => d[0] === "1")?.[1] || 0 },
    { year: 2019, sex: "Female", networth: medianBySex2019.find(d => d[0] === "2")?.[1] || 0 },
    { year: 2022, sex: "Male", networth: medianBySex2022.find(d => d[0] === "1")?.[1] || 0 },
    { year: 2022, sex: "Female", networth: medianBySex2022.find(d => d[0] === "2")?.[1] || 0 }
];

console.log("Sex data:", sexData);

const ageOrder = ["Under 35", "35-44", "45-54", "55-64", "65+"];
const ageData = [
    ...medianByAge2019.map(d => ({ year: 2019, category: d[0], networth: d[1] })),
    ...medianByAge2022.map(d => ({ year: 2022, category: d[0], networth: d[1] }))
];

// Sort education data by actual wealth (ascending) to show proper hierarchy
const educOrder = [...new Set([...medianByEduc2019, ...medianByEduc2022].map(d => d[0]))]
    .sort((a, b) => {
        const avg2019 = medianByEduc2019.find(d => d[0] === a)?.[1] || 0;
        const avg2022 = medianByEduc2022.find(d => d[0] === a)?.[1] || 0;
        const avgA = (avg2019 + avg2022) / 2;
        
        const avgB2019 = medianByEduc2019.find(d => d[0] === b)?.[1] || 0;
        const avgB2022 = medianByEduc2022.find(d => d[0] === b)?.[1] || 0;
        const avgB = (avgB2019 + avgB2022) / 2;
        
        return avgA - avgB;
    });

const educData = [
    ...medianByEduc2019.map(d => ({ year: 2019, category: d[0], networth: d[1] })),
    ...medianByEduc2022.map(d => ({ year: 2022, category: d[0], networth: d[1] }))
];

// Chart setup
const svg = d3.select("#chart");
const width = 600;
const height = 500;
const margin = { top: 50, right: 40, bottom: 80, left: 90 };
const chartWidth = width - margin.left - margin.right;
const chartHeight = height - margin.top - margin.bottom;

const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

// Scales
let x0 = d3.scaleBand().range([0, chartWidth]).padding(0.2);
let x1 = d3.scaleBand().padding(0.1);
let y = d3.scaleLinear().range([chartHeight, 0]);

const colorSex = d3.scaleOrdinal().domain(["Male", "Female"]).range(["#4a90e2", "#e94e77"]);
const colorAge = d3.scaleOrdinal().domain(ageOrder).range(["#e94e77", "#f97316", "#eab308", "#22c55e", "#4a90e2"]);
const colorEduc = d3.scaleOrdinal().domain(educOrder).range(d3.schemeSet2);

// Axes
const xAxisGroup = g.append("g").attr("class", "axis").attr("transform", `translate(0, ${chartHeight})`);
const yAxisGroup = g.append("g").attr("class", "axis");

// Title
const title = svg.append("text")
    .attr("x", width / 2)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .style("font-size", "20px")
    .style("font-weight", "600");

const legend = d3.select("#legend");

// Format currency for display
function formatCurrency(value) {
    if (value >= 1000000) {
        return "$" + (value / 1000000).toFixed(2) + "M";
    } else if (value >= 1000) {
        return "$" + (value / 1000).toFixed(0) + "K";
    } else {
        return "$" + value.toFixed(0);
    }
}

// Render functions
function renderOverall() {
    title.text("Median U.S. Household Net Worth");
    legend.style("display", "none");
    
    g.selectAll(".year-group").remove();
    
    x0.domain(overallData.map(d => d.year));
    y.domain([0, d3.max(overallData, d => d.networth) * 1.1]);

    const bars = g.selectAll(".bar").data(overallData, d => d.year);
    
    bars.exit().transition().duration(500).attr("height", 0).attr("y", chartHeight).remove();
    
    const barsEnter = bars.enter().append("rect").attr("class", "bar");
    
    bars.merge(barsEnter)
        .transition().duration(800)
        .attr("x", d => x0(d.year))
        .attr("width", x0.bandwidth())
        .attr("y", d => y(d.networth))
        .attr("height", d => chartHeight - y(d.networth))
        .attr("fill", "#4a90e2");

    xAxisGroup.transition().duration(500).call(d3.axisBottom(x0));
    yAxisGroup.transition().duration(500).call(d3.axisLeft(y).ticks(5).tickFormat(formatCurrency));
}

function renderGrouped(data, categories, colorScale, titleText) {
    title.text(titleText);
    
    g.selectAll(".bar").remove();
    g.selectAll(".year-group").remove();
    g.selectAll(".value-label").remove();

    const years = [2019, 2022];
    
    x0.domain(years);
    x1.domain(categories).range([0, x0.bandwidth()]);
    y.domain([0, d3.max(data, d => d.networth) * 1.1]);

    const groups = g.selectAll(".year-group")
        .data(years)
        .enter()
        .append("g")
        .attr("class", "year-group")
        .attr("transform", year => `translate(${x0(year)}, 0)`);

    // Draw bars
    const bars = groups.selectAll("rect")
        .data(year => data.filter(d => d.year === year))
        .enter()
        .append("rect")
        .attr("x", d => x1(d.category))
        .attr("width", x1.bandwidth())
        .attr("y", chartHeight)
        .attr("height", 0)
        .attr("fill", d => colorScale(d.category));
    
    bars.transition().duration(800)
        .attr("y", d => y(d.networth))
        .attr("height", d => chartHeight - y(d.networth));

    // Add value labels on top of bars to make small bars visible
    const labels = groups.selectAll("text")
        .data(year => data.filter(d => d.year === year))
        .enter()
        .append("text")
        .attr("class", "value-label")
        .attr("x", d => x1(d.category) + x1.bandwidth() / 2)
        .attr("y", chartHeight)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#333")
        .text(d => formatCurrency(d.networth));
    
    labels.transition().duration(800)
        .attr("y", d => y(d.networth) - 5);

    xAxisGroup.transition().duration(500).call(d3.axisBottom(x0));
    yAxisGroup.transition().duration(500).call(d3.axisLeft(y).ticks(5).tickFormat(formatCurrency));

    // Update legend
    legend.style("display", "flex");
    legend.html("");
    categories.forEach(cat => {
        const item = legend.append("div").attr("class", "legend-item");
        item.append("div").attr("class", "legend-color").style("background", colorScale(cat));
        item.append("span").text(cat);
    });
}

function renderBySex() {
    title.text("Median Net Worth by Household Head Sex");
    
    g.selectAll(".bar").remove();
    g.selectAll(".year-group").remove();
    g.selectAll(".value-label").remove();

    const years = [2019, 2022];
    const sexes = ["Male", "Female"];
    
    x0.domain(years);
    x1.domain(sexes).range([0, x0.bandwidth()]);
    y.domain([0, d3.max(sexData, d => d.networth) * 1.1]);

    const groups = g.selectAll(".year-group")
        .data(years)
        .enter()
        .append("g")
        .attr("class", "year-group")
        .attr("transform", year => `translate(${x0(year)}, 0)`);

    // Draw bars
    const bars = groups.selectAll("rect")
        .data(year => sexData.filter(d => d.year === year))
        .enter()
        .append("rect")
        .attr("x", d => x1(d.sex))
        .attr("width", x1.bandwidth())
        .attr("y", chartHeight)
        .attr("height", 0)
        .attr("fill", d => colorSex(d.sex));
    
    bars.transition().duration(800)
        .attr("y", d => y(d.networth))
        .attr("height", d => chartHeight - y(d.networth));

    // Add value labels on top of bars
    const labels = groups.selectAll("text")
        .data(year => sexData.filter(d => d.year === year))
        .enter()
        .append("text")
        .attr("class", "value-label")
        .attr("x", d => x1(d.sex) + x1.bandwidth() / 2)
        .attr("y", chartHeight)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#333")
        .text(d => formatCurrency(d.networth));
    
    labels.transition().duration(800)
        .attr("y", d => y(d.networth) - 5);

    xAxisGroup.transition().duration(500).call(d3.axisBottom(x0));
    yAxisGroup.transition().duration(500).call(d3.axisLeft(y).ticks(5).tickFormat(formatCurrency));

    // Update legend
    legend.style("display", "flex");
    legend.html("");
    sexes.forEach(sex => {
        const item = legend.append("div").attr("class", "legend-item");
        item.append("div").attr("class", "legend-color").style("background", colorSex(sex));
        item.append("span").text(sex);
    });
}

function renderByAge() {
    renderGrouped(ageData, ageOrder, colorAge, "Median Net Worth by Age Group");
}

function renderByEducation() {
    renderGrouped(educData, educOrder, colorEduc, "Median Net Worth by Education Level");
}

// For the final comparison, show percentage change by category
function renderFinalComparison() {
    title.text("Wealth Growth 2019-2022: Who Benefited Most?");
    
    g.selectAll(".bar").remove();
    g.selectAll(".year-group").remove();
    legend.style("display", "none");

    // Calculate percentage changes for each demographic
    const changes = [];
    
    // Overall
    changes.push({
        category: "Overall",
        change: ((median2022 - median2019) / median2019) * 100
    });
    
    // By sex
    const male2019 = sexData.find(d => d.year === 2019 && d.sex === "Male")?.networth || 0;
    const male2022 = sexData.find(d => d.year === 2022 && d.sex === "Male")?.networth || 0;
    const female2019 = sexData.find(d => d.year === 2019 && d.sex === "Female")?.networth || 0;
    const female2022 = sexData.find(d => d.year === 2022 && d.sex === "Female")?.networth || 0;
    
    if (male2019 > 0) changes.push({ category: "Male HH", change: ((male2022 - male2019) / male2019) * 100 });
    if (female2019 > 0) changes.push({ category: "Female HH", change: ((female2022 - female2019) / female2019) * 100 });
    
    // By age groups - show a few key ones
    ["Under 35", "45-54", "65+"].forEach(ageGroup => {
        const age2019 = ageData.find(d => d.year === 2019 && d.category === ageGroup)?.networth || 0;
        const age2022 = ageData.find(d => d.year === 2022 && d.category === ageGroup)?.networth || 0;
        if (age2019 > 0) changes.push({ category: ageGroup, change: ((age2022 - age2019) / age2019) * 100 });
    });

    x0.domain(changes.map(d => d.category));
    y.domain([d3.min(changes, d => d.change) * 1.2, d3.max(changes, d => d.change) * 1.2]);

    const bars = g.selectAll(".bar")
        .data(changes)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x0(d.category))
        .attr("width", x0.bandwidth())
        .attr("y", chartHeight)
        .attr("height", 0)
        .attr("fill", d => d.change >= 0 ? "#22c55e" : "#ef4444")
        .transition().duration(800)
        .attr("y", d => d.change >= 0 ? y(d.change) : y(0))
        .attr("height", d => Math.abs(y(d.change) - y(0)));

    // Add zero line
    g.append("line")
        .attr("x1", 0)
        .attr("x2", chartWidth)
        .attr("y1", y(0))
        .attr("y2", y(0))
        .attr("stroke", "#666")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5");

    xAxisGroup.transition().duration(500).call(d3.axisBottom(x0))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");
    
    yAxisGroup.transition().duration(500).call(d3.axisLeft(y).ticks(5).tickFormat(d => d.toFixed(0) + "%"));
}

// Scrollytelling logic
let currentStep = 0;

const steps = document.querySelectorAll(".step");
const scrollContainer = document.getElementById("scroll-container");

function updateChart(stepIndex) {
    if (stepIndex === currentStep) return;
    currentStep = stepIndex;

    switch(stepIndex) {
        case 0:
            renderOverall();
            break;
        case 1:
            renderBySex();
            break;
        case 2:
            renderByAge();
            break;
        case 3:
            renderByEducation();
            break;
        case 4:
            renderFinalComparison();
            break;
    }
}

function checkScroll() {
    const scrollTop = window.scrollY;
    const containerTop = scrollContainer.offsetTop;

    steps.forEach((step, i) => {
        const stepTop = step.offsetTop + containerTop;
        const stepBottom = stepTop + step.offsetHeight;
        
        if (scrollTop >= stepTop - window.innerHeight / 2 && scrollTop < stepBottom - window.innerHeight / 2) {
            step.classList.add("active");
            updateChart(i);
        } else {
            step.classList.remove("active");
        }
    });
}

window.addEventListener("scroll", checkScroll);
window.addEventListener("resize", checkScroll);

// Initial render
renderOverall();
checkScroll();