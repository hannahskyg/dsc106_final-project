
const data2019 = await d3.csv("data/2019.csv");
const data2022 = await d3.csv("data/2022.csv");

const mean2019 = d3.mean(data2019, d => +d.NETWORTH);
const mean2022 = d3.mean(data2022, d => +d.NETWORTH);

const meanBySex2019 = d3.rollups(data2019, v => d3.mean(v, d => +d.NETWORTH), d => d.HHSEX);
const meanBySex2022 = d3.rollups(data2022, v => d3.mean(v, d => +d.NETWORTH), d => d.HHSEX);

function getAgeGroup(age) {
            age = +age;
            if (age < 35) return "Under 35";
            if (age < 45) return "35-44";
            if (age < 55) return "45-54";
            if (age < 65) return "55-64";
            return "65+";
}


 const meanByAge2019 = d3.rollups(data2019, v => d3.mean(v, d => +d.NETWORTH), d => getAgeGroup(d.AGE));
 const meanByAge2022 = d3.rollups(data2022, v => d3.mean(v, d => +d.NETWORTH), d => getAgeGroup(d.AGE));
   // Education: 1=No HS, 2=HS, 3=Some College, 4=College+
        const educMap = {1: "No HS", 2: "High School", 3: "Some College", 4: "College+"};
        const meanByEduc2019 = d3.rollups(data2019, v => d3.mean(v, d => +d.NETWORTH), d => educMap[d.EDUC] || "Unknown");
        const meanByEduc2022 = d3.rollups(data2022, v => d3.mean(v, d => +d.NETWORTH), d => educMap[d.EDUC] || "Unknown");
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

  const ageOrder = ["Under 35", "35-44", "45-54", "55-64", "65+"];
        const ageData = [
            ...meanByAge2019.map(d => ({ year: 2019, category: d[0], networth: d[1] })),
            ...meanByAge2022.map(d => ({ year: 2022, category: d[0], networth: d[1] }))
        ];

        const educOrder = ["No HS", "High School", "Some College", "College+"];
        const educData = [
            ...meanByEduc2019.map(d => ({ year: 2019, category: d[0], networth: d[1] })),
            ...meanByEduc2022.map(d => ({ year: 2022, category: d[0], networth: d[1] }))
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
        const colorEduc = d3.scaleOrdinal().domain(educOrder).range(["#ef4444", "#f97316", "#eab308", "#22c55e"]);

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

        // Render functions
        function renderOverall() {
            title.text("Mean U.S. Household Net Worth");
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
            yAxisGroup.transition().duration(500).call(d3.axisLeft(y).ticks(5).tickFormat(d => "$" + (d/1000000).toFixed(1) + "M"));
        }

        function renderGrouped(data, categories, colorScale, titleText) {
            title.text(titleText);
            
            g.selectAll(".bar").remove();
            g.selectAll(".year-group").remove();

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

            groups.selectAll("rect")
                .data(year => data.filter(d => d.year === year))
                .enter()
                .append("rect")
                .attr("x", d => x1(d.category))
                .attr("width", x1.bandwidth())
                .attr("y", chartHeight)
                .attr("height", 0)
                .attr("fill", d => colorScale(d.category))
                .transition().duration(800)
                .attr("y", d => y(d.networth))
                .attr("height", d => chartHeight - y(d.networth));

            xAxisGroup.transition().duration(500).call(d3.axisBottom(x0));
            yAxisGroup.transition().duration(500).call(d3.axisLeft(y).ticks(5).tickFormat(d => "$" + (d/1000000).toFixed(1) + "M"));

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
            renderGrouped(sexData, ["Male", "Female"], colorSex, "Net Worth by Household Head Sex");
        }

        function renderByAge() {
            renderGrouped(ageData, ageOrder, colorAge, "Net Worth by Age Group");
        }

        function renderByEducation() {
            renderGrouped(educData, educOrder, colorEduc, "Net Worth by Education Level");
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
                    renderGrouped(
                        [...sexData, ...ageData, ...educData],
                        ["Male", "Female"],
                        colorSex,
                        "Understanding Wealth Inequality"
                    );
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

