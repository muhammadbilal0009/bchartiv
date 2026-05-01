const seasons = ["Winter", "Spring", "Summer", "Fall"];
const countries = ["India", "USA"];
const tooltip = d3.select("#tooltip");
const chart = d3.select("#comparison-chart");
const legend = d3.select("#comparison-legend");
const indiaFilter = d3.select("#comparison-india-city-filter");
const usaFilter = d3.select("#comparison-usa-city-filter");

const margin = { top: 24, right: 20, bottom: 70, left: 70 };
let width = 1000;
let height = 460;
let innerWidth = width - margin.left - margin.right;
let innerHeight = height - margin.top - margin.bottom;

const normalizeSeason = (value) => {
  const key = String(value || "").trim().toLowerCase();
  if (key === "autumn" || key === "fall") return "Fall";
  if (key === "winter") return "Winter";
  if (key === "spring") return "Spring";
  if (key === "summer") return "Summer";
  return null;
};

const toClean = (rows) =>
  rows
    .map((d) => ({
      city: String(d.city || "").trim(),
      season: normalizeSeason(d.season),
      pm25: +d.pm25,
      year: +d.year,
    }))
    .filter((d) => d.city && d.season && Number.isFinite(d.pm25) && Number.isFinite(d.year));

const root = chart.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
const gridGroup = root.append("g").attr("class", "grid");
const xAxisGroup = root.append("g").attr("class", "axis").attr("transform", `translate(0,${innerHeight})`);
const yAxisGroup = root.append("g").attr("class", "axis");
const barsGroup = root.append("g");
const labelsGroup = root.append("g").attr("class", "labels");

const xAxisLabel = root
  .append("text")
  .attr("x", innerWidth / 2)
  .attr("y", innerHeight + 52)
  .attr("fill", "#f0f0f0")
  .attr("text-anchor", "middle")
  .text("Season");

const yAxisLabel = root
  .append("text")
  .attr("transform", "rotate(-90)")
  .attr("x", -innerHeight / 2)
  .attr("y", -50)
  .attr("fill", "#f0f0f0")
  .attr("text-anchor", "middle")
  .text("PM2.5 Concentration");

const updateDimensions = () => {
  const shell = chart.node().closest(".chart-shell");
  const shellWidth = Math.max(340, shell.clientWidth - 28);
  width = shellWidth;
  height = width < 520 ? 320 : width < 860 ? 380 : 460;
  innerWidth = width - margin.left - margin.right;
  innerHeight = height - margin.top - margin.bottom;

  chart.attr("viewBox", `0 0 ${width} ${height}`);
  root.attr("transform", `translate(${margin.left},${margin.top})`);
  xAxisGroup.attr("transform", `translate(0,${innerHeight})`);
  xAxisLabel.attr("x", innerWidth / 2).attr("y", innerHeight + 52);
  yAxisLabel.attr("x", -innerHeight / 2);
};

Promise.all([
  d3.csv("./india_air_quality_datapreprocessing_final.csv", d3.autoType),
  d3.csv("./USA_air_quality_datapreproccessing_final.csv", d3.autoType),
]).then(([indiaRows, usaRows]) => {
  const india = toClean(indiaRows);
  const usa = toClean(usaRows);

  const indiaCities = Array.from(new Set(india.map((d) => d.city))).sort(d3.ascending);
  const usaCities = Array.from(new Set(usa.map((d) => d.city))).sort(d3.ascending);

  indiaFilter
    .selectAll("option")
    .data(["All Cities", ...indiaCities])
    .join("option")
    .attr("value", (d) => d)
    .text((d) => d);

  usaFilter
    .selectAll("option")
    .data(["All Cities", ...usaCities])
    .join("option")
    .attr("value", (d) => d)
    .text((d) => d);

  const color = d3.scaleOrdinal().domain(countries).range(["red", "green"]);

  let currentIndiaSelection = "All Cities";
  let currentUsaSelection = "All Cities";
  let selectedGroup = null;

  d3.select("body").on("click", (event) => {
    if (event.target.tagName !== "rect" && selectedGroup !== null) {
      selectedGroup = null;
      barsGroup.selectAll("rect").transition().duration(200).style("opacity", 1);
    }
  });

  const render = (selectedIndiaCity, selectedUsaCity, isResize = false) => {
    currentIndiaSelection = selectedIndiaCity;
    currentUsaSelection = selectedUsaCity;
    updateDimensions();

    let indiaRowsActive = india;
    if (selectedIndiaCity !== "All Cities") indiaRowsActive = indiaRowsActive.filter((d) => d.city === selectedIndiaCity);

    let usaRowsActive = usa;
    if (selectedUsaCity !== "All Cities") usaRowsActive = usaRowsActive.filter((d) => d.city === selectedUsaCity);

    const seasonCountryMean = new Map();

    d3.rollups(
      indiaRowsActive,
      (group) => d3.mean(group, (d) => d.pm25),
      (d) => d.season
    ).forEach(([season, value]) => {
      seasonCountryMean.set(`${season}|||India`, value);
    });

    d3.rollups(
      usaRowsActive,
      (group) => d3.mean(group, (d) => d.pm25),
      (d) => d.season
    ).forEach(([season, value]) => {
      seasonCountryMean.set(`${season}|||USA`, value);
    });

    const data = seasons.flatMap((season) =>
      countries.map((country) => ({
        key: `${season}-${country}`,
        season,
        country,
        city: country === "India" ? selectedIndiaCity : selectedUsaCity,
        value: seasonCountryMean.get(`${season}|||${country}`) ?? 0,
      }))
    );

    const x0 = d3.scaleBand().domain(seasons).range([0, innerWidth]).padding(0.25);
    const x1 = d3.scaleBand().domain(countries).range([0, x0.bandwidth()]).padding(0.12);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.value) * 1.1 || 1])
      .nice()
      .range([innerHeight, 0]);

    const axisDuration = isResize ? 0 : 450;
    const updateDuration = isResize ? 0 : 700;
    const enterDuration = isResize ? 0 : 1500;

    gridGroup
      .transition()
      .duration(axisDuration)
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(""))
      .selection()
      .call((g) => g.select(".domain").remove());

    xAxisGroup.transition().duration(axisDuration).call(d3.axisBottom(x0));
    yAxisGroup.transition().duration(axisDuration).call(d3.axisLeft(y));

    barsGroup
      .selectAll("rect")
      .data(data, (d) => d.key)
      .join(
        (enter) =>
          enter
            .append("rect")
            .attr("x", (d) => x0(d.season) + x1(d.country))
            .attr("y", y(0))
            .attr("width", x1.bandwidth())
            .attr("height", 0)
            .attr("fill", (d) => color(d.country))
            .on("mousemove", (event, d) => {
              tooltip
                .style("opacity", 1)
                .html(
                  `Country: ${d.country}<br/>City: ${d.city}<br/>Season: ${d.season}<br/>PM2.5: ${d.value.toFixed(2)}`
                )
                .style("left", `${event.clientX}px`)
                .style("top", `${event.clientY}px`);
            })
            .on("mouseleave", () => {
              tooltip.style("opacity", 0);
            })
            .on("click", (event, d) => {
              selectedGroup = selectedGroup === d.country ? null : d.country;
              barsGroup.selectAll("rect")
                .transition()
                .duration(200)
                .style("opacity", (b) => (selectedGroup === null || selectedGroup === b.country ? 1 : 0.3));
            })
            .call((enterBars) =>
              enterBars
                .transition()
                .duration(enterDuration)
                .ease(d3.easeCubicOut)
                .attr("y", (d) => y(d.value))
                .attr("height", (d) => innerHeight - y(d.value))
                .style("opacity", (d) => (selectedGroup === null || selectedGroup === d.country ? 1 : 0.3))
            ),
        (update) =>
          update.call((updateBars) =>
            updateBars
              .transition()
              .duration(updateDuration)
              .attr("x", (d) => x0(d.season) + x1(d.country))
              .attr("width", x1.bandwidth())
              .attr("y", (d) => y(d.value))
              .attr("height", (d) => innerHeight - y(d.value))
              .style("opacity", (d) => (selectedGroup === null || selectedGroup === d.country ? 1 : 0.3))
          ),
        (exit) =>
          exit.call((exitBars) =>
            exitBars
              .transition()
              .duration(400)
              .attr("y", y(0))
              .attr("height", 0)
              .style("opacity", 0)
              .remove()
          )
      );

    labelsGroup
      .selectAll("text")
      .data(data, (d) => d.key)
      .join(
        (enter) =>
          enter
            .append("text")
            .attr("x", (d) => x0(d.season) + x1(d.country) + x1.bandwidth() / 2)
            .attr("y", y(0))
            .attr("fill", "#cccccc")
            .attr("text-anchor", "middle")
            .attr("font-size", "11px")
            .attr("font-weight", "600")
            .style("pointer-events", "none")
            .style("opacity", 0)
            .text((d) => (d.value > 0 ? d.value.toFixed(1) : ""))
            .call((enterText) =>
              enterText
                .transition()
                .duration(enterDuration)
                .ease(d3.easeCubicOut)
                .attr("y", (d) => y(d.value) - 6)
                .style("opacity", 1)
            ),
        (update) =>
          update.call((updateText) =>
            updateText
              .transition()
              .duration(updateDuration)
              .attr("x", (d) => x0(d.season) + x1(d.country) + x1.bandwidth() / 2)
              .attr("y", (d) => y(d.value) - 6)
              .style("opacity", 1)
              .text((d) => (d.value > 0 ? d.value.toFixed(1) : ""))
          ),
        (exit) =>
          exit.call((exitText) =>
            exitText
              .transition()
              .duration(400)
              .attr("y", y(0))
              .style("opacity", 0)
              .remove()
          )
      );
  };

  const renderFromInputs = () => {
    selectedGroup = null;
    render(indiaFilter.node().value, usaFilter.node().value);
  };

  indiaFilter.on("change", renderFromInputs);
  usaFilter.on("change", renderFromInputs);

  window.addEventListener("resize", () => {
    render(currentIndiaSelection, currentUsaSelection, true);
  });

  const legendItems = legend
    .selectAll("div")
    .data(countries)
    .enter()
    .append("div")
    .attr("class", "legend-item");

  legendItems
    .append("span")
    .attr("class", "legend-swatch")
    .style("background", (d) => color(d));

  legendItems.append("span").text((d) => d);

  render("All Cities", "All Cities");
});
