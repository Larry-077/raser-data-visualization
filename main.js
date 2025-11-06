

import { parseRow } from './utils.js';
import { ScatterPlot } from './scatterPlot.js';
import { RibbonTrack } from './ribbonTrack.js';
import { EnhancedGaugePanel } from './gaugePanel.js';

const CSV_PATH = 'Cars Datasets 2025.csv';


async function main() {
    try {
        const rawData = (await d3.csv(CSV_PATH, parseRow))
            .filter(d => d.model && isFinite(d.hp) && isFinite(d.capacity) && d.seats && d.seats !== 'N/A');
        
        console.log('Loaded data:', rawData.length, 'cars');
        console.log('Sample data:', rawData.slice(0, 3));
        
        if (rawData.length === 0) {
            console.error('No valid data loaded! Check CSV file path and format.');
            return;
        }
        

        const ribbonVis = new RibbonTrack('#ribbonSVG', rawData);
        const gaugePanel = new EnhancedGaugePanel('#infoView', rawData);
        const scatterPlot = new ScatterPlot('#scatterPlotSVG', rawData);

      
        setupControls(rawData, ribbonVis, gaugePanel, scatterPlot);
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading CSV file. Please check:\n1. File name is correct: "' + CSV_PATH + '"\n2. File is in the same directory as index.html\n3. Check browser console for details');
    }
}

main();


function setupControls(data, ribbonVis, gaugePanel, scatterPlot) {

    const names = data.map(d => `${d.brand} ${d.model}`);
    const selects = [d3.select('#carSel1'), d3.select('#carSel2'), d3.select('#carSel3')];
    selects.forEach(s => s.selectAll('option').data(names).join('option').text(d => d));

    function updateComparisonPanel() {
        const selectedNames = selects.map(s => s.property('value'));
        const selectedCars = selectedNames.map(name => data.find(d => `${d.brand} ${d.model}` === name)).filter(Boolean);
        const baseline = d3.select('#baseMode').property('value');
        ribbonVis.setCars(selectedCars);
        gaugePanel.update(selectedCars, baseline);
    }

    if (names.length >= 3) {
        selects[0].property('value', names[0]);
        selects[1].property('value', names[1]);
        selects[2].property('value', names[2]);
    }

    selects.forEach(s => s.on('change', updateComparisonPanel));
    d3.select('#baseMode').on('change', updateComparisonPanel);
    d3.select('#random3').on('click', () => {
        const randomCars = d3.shuffle(names.slice()).slice(0, 3);
        selects.forEach((s, i) => s.property('value', randomCars[i]));
        updateComparisonPanel();
    });
    updateComparisonPanel();


    

    const dataCountSlider = d3.select('#dataCountSlider');
    const dataCountValue = d3.select('#dataCountValue');
    

    const totalCars = data.length;
    dataCountSlider.attr('max', totalCars);
    dataCountSlider.property('value', Math.min(100, totalCars));
    dataCountValue.text(Math.min(100, totalCars));
    
    dataCountSlider.on('input', function() {
        const count = +this.value;
        dataCountValue.text(count);
        scatterPlot.setMaxDataCount(count);
    });
    

    const seatOptions = ['All', ...Array.from(new Set(data.map(d => d.seats))).sort()];
    const seatFilter = d3.select('#seatFilter');
    seatFilter.selectAll('option').data(seatOptions).join('option')
        .attr('value', d => d)
        .text(d => d);
    
    seatFilter.on('change', function() {
        scatterPlot.filterBySeats(this.value);
    });


    const xAxisSelect = d3.select('#xAxisSelect');
    const yAxisSelect = d3.select('#yAxisSelect');
    
    const axisOptions = [
        { value: 'hp', label: 'Horsepower' },
        { value: 'tops', label: 'Top Speed' },
        { value: 'accel', label: '0-100 Time' },
        { value: 'price', label: 'Price' },
        { value: 'capacity', label: 'Capacity' },
        { value: 'hpPerDollar', label: 'HP per $1000' },
        { value: 'speedPerDollar', label: 'Speed per $1000' },
        { value: 'performanceScore', label: 'Performance Score' }
    ];
    
    xAxisSelect.selectAll('option').data(axisOptions).join('option')
        .attr('value', d => d.value)
        .text(d => d.label);
    
    yAxisSelect.selectAll('option').data(axisOptions).join('option')
        .attr('value', d => d.value)
        .text(d => d.label);
    
    xAxisSelect.property('value', 'hp');
    yAxisSelect.property('value', 'price');
    
    function updateScatterAxes() {
        const xAxis = xAxisSelect.property('value');
        const yAxis = yAxisSelect.property('value');
        scatterPlot.changeAxes(xAxis, yAxis);
    }
    
    xAxisSelect.on('change', updateScatterAxes);
    yAxisSelect.on('change', updateScatterAxes);
    
    setTimeout(() => {
        updateScatterAxes();
    }, 200);
}