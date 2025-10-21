// --- 全局状态与辅助函数 ---
const keyOf = d => `${d.brand}__${d.model}`;
const fmtK = x => !isFinite(x) ? '—' : (x >= 1e3 ? (x / 1e3).toFixed(0) + 'k' : String(Math.round(x || 0)));

// --- 数据加载 ---
const CSV_PATH = 'Cars Datasets 2025 1.csv';

const parseRow = (d) => {
    const num = (v) => {
        if (v == null) return NaN;
        const s = String(v).trim();
        if (/^\s*\d+(\.\d+)?\s*-\s*\d+/i.test(s)) {
            const parts = s.split('-').map(t => t.replace(/[^0-9.]/g, ''));
            return +parts[1];
        }
        return +s.replace(/[^0-9.]/g, '');
    };
    return {
        brand: String(d['Company Names'] || 'UNKNOWN').toUpperCase().trim(),
        model: String(d['Cars Names'] || '').trim(),
        hp:    num(d['HorsePower']),
        tops:  num(d['Total Speed']),
        accel: num(d['Performance(0 - 100 )KM/H']),
        price: num(d['Cars Prices']),
        seats: String(d['Seats'] || 'N/A').trim(),
        capacity: num(d['CC/Battery Capacity'])
    };
};

// --- 主程序入口 ---
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
        
        // 初始化所有可视化模块
        const ribbonVis = new RibbonTrack('#ribbonSVG', rawData);
        const gaugePanel = new EnhancedGaugePanel('#infoView', rawData);
        const scatterPlot = new ScatterPlot('#scatterPlotSVG', rawData);

        // 设置并管理所有控件
        setupControls(rawData, ribbonVis, gaugePanel, scatterPlot);
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading CSV file. Please check:\n1. File name is correct: "' + CSV_PATH + '"\n2. File is in the same directory as index.html\n3. Check browser console for details');
    }
}

main();

// --- 控件管理 ---
function setupControls(data, ribbonVis, gaugePanel, scatterPlot) {
    // --- 主对比面板的控件 ---
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

    // 设置默认选择的车辆
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

    // --- 散点图的控件 ---
    const seatOptions = ['All', ...Array.from(new Set(data.map(d => d.seats))).sort()];
    const seatFilter = d3.select('#seatFilter');
    seatFilter.selectAll('option').data(seatOptions).join('option')
        .attr('value', d => d)
        .text(d => d);
    
    seatFilter.on('change', function() {
        scatterPlot.filterBySeats(this.value);
    });
}

// ===============================================
//           可视化类
// ===============================================

class RibbonTrack {
    constructor(parentSel, data){
        this.parentSel = parentSel;
        this.data = data;
        const brands  = Array.from(new Set(this.data.map(d=>d.brand))).sort();
        this.palette = d3.scaleOrdinal(d3.schemeCategory10).domain(brands);
        this.initVis();
    }
    initVis(){
        const vis = this;
        vis.margin = {top: 40, right: 20, bottom: 20, left: 60};
        vis.outerW = 1120; vis.outerH = 660;
        vis.width  = vis.outerW - vis.margin.left - vis.margin.right;
        vis.height = vis.outerH - vis.margin.top - vis.margin.bottom;

        vis.svg = d3.select(vis.parentSel);
        vis.g   = vis.svg.append('g').attr('transform',`translate(${vis.margin.left},${vis.margin.top})`);
        
        const path = d3.path();
        path.moveTo(300, 550);
        path.bezierCurveTo(100, 550, 50, 350, 200, 250);
        path.bezierCurveTo(350, 150, 650, 150, 800, 250);
        path.bezierCurveTo(950, 350, 900, 550, 700, 550);
        path.closePath();
        vis.trackD = path.toString();

        vis.g.append('path')
            .attr('d', vis.trackD).attr('fill','none')
            .attr('stroke','#e0e0e0').attr('stroke-width',30).attr('stroke-linecap','round').attr('stroke-linejoin','round');
        vis.baseTrack = vis.g.append('path')
            .attr('d', vis.trackD).attr('fill','none')
            .attr('stroke','#f0f0f0').attr('stroke-width',18).attr('stroke-linecap','round').attr('stroke-linejoin','round')
            .attr('stroke-dasharray','10 18');
        vis.totalLen = vis.baseTrack.node().getTotalLength();

        vis.carG   = vis.g.append('g');

        vis.wStroke = d3.scaleLinear().domain(d3.extent(vis.data, d=>d.hp)).range([6, 22]);
        vis.glow    = d3.scaleLinear().domain(d3.extent(vis.data, d=>d.tops)).range([.35, .95]);
        vis.dash    = d3.scaleLinear().domain(d3.extent(vis.data, d=>d.accel)).range([36, 8]);
        
        vis.speed = d3.scalePow().exponent(2)
            .domain([0, d3.max(vis.data, d => d.hp)])
            .range([0.5, 6.0]);

        vis.setCars([]);
        vis.start();
    }
    
    setCars(list){
        const vis = this;
        vis.cars = list;
        vis.states = vis.cars.map((d,i)=>({d, off:(i*vis.totalLen/10)%vis.totalLen, v: vis.speed(d.hp)}));
        vis.updateVis();
    }

    updateVis(){
        const vis = this;
        const ribbons = vis.carG.selectAll('.ribbon').data(vis.cars, keyOf)
            .join(
                enter => {
                    const g = enter.append('g').attr('class','ribbon');
                    g.append('path').attr('class','rLine').attr('d', vis.trackD).attr('fill','none');
                    g.append('circle').attr('class','marker').attr('r',7).attr('stroke','#333').attr('stroke-width',2);
                    g.append('text').attr('class','spd').attr('dy',-12).attr('text-anchor','middle')
                        .style('font-size','11px').style('fill','#1d1d1f');
                    return g;
                },
                update => update,
                exit => exit.remove()
            );

        ribbons.each(function(d){
            const sel = d3.select(this);
            sel.select('.rLine')
                .attr('stroke', vis.palette(d.brand))
                .attr('stroke-opacity', vis.glow(d.tops||0))
                .attr('stroke-width', vis.wStroke(d.hp||0))
                .attr('stroke-linecap','round')
                .attr('stroke-dasharray', `${vis.dash(d.accel||0)} ${vis.dash(d.accel||0)}`);
            sel.select('.marker').attr('fill', vis.palette(d.brand));
        });
    }
    start(){
        const vis = this;
        if(vis._running) return;
        vis._running = true; let t0 = performance.now();
        const step = ()=>{
            if(!vis._running) return;
            const now = performance.now(); const dt = Math.min(32, now - t0); t0 = now;
            vis.carG.selectAll('.ribbon').each(function(_,i){
                const s = vis.states[i]; if(!s) return;
                s.v   = vis.speed(s.d.hp||0);
                s.off = (s.off + s.v*dt/16) % (vis.totalLen||1);
                const p = vis.baseTrack.node().getPointAtLength(s.off);
                const row = d3.select(this);
                row.select('.marker').attr('cx',p.x).attr('cy',p.y);
                const dashLen = parseFloat(row.select('.rLine').attr('stroke-dasharray').split(' ')[0])||12;
                row.select('.rLine').attr('stroke-dashoffset', -s.off*(dashLen/36));
                row.select('.spd').attr('x',p.x).attr('y',p.y).text(`${s.d.hp ?? '—'} hp`);
            });
            requestAnimationFrame(step);
        };
        step();
    }
}

class EnhancedGaugePanel {
    constructor(selector, data) {
        this.container = d3.select(selector);
        this.data = data;
        this.metrics = [
            {key:'hp',label:'HP'},{key:'tops',label:'Top Speed'},
            {key:'accel',label:'0-100s'}, {key:'price',label:'Price'}
        ];
        this.colorFor = k => k==='hp'? '#e63946' : k==='accel'? '#457b9d' : k==='tops'? '#fca311' : '#6c757d';
    }

    update(selectedCars, baseline) {
        const best = {
            hp: d3.max(selectedCars, d => d.hp) || 1,
            accel: d3.min(selectedCars, d => d.accel) || 1,
            tops: d3.max(selectedCars, d => d.tops) || 1,
            price: d3.max(selectedCars, d => d.price) || 1
        };

        const cards = this.container.selectAll('.info-card')
            .data(selectedCars, d => keyOf(d))
            .join(
                enter => {
                    const card = enter.append('div').attr('class', 'info-card');
                    const content = card.append('div').attr('class', 'card-content');
                    
                    const svgContainer = content.append('div').attr('class', 'gauge-container');
                    const svg = svgContainer.append('svg').attr('viewBox', '0 0 200 200');
                    const g = svg.append('g').attr('transform', 'translate(100, 100)');
                    
                    const textInfo = content.append('div').attr('class', 'info-text');
                    textInfo.append('h3');
                    textInfo.append('p').attr('class', 'info-hp');
                    textInfo.append('p').attr('class', 'info-tops');
                    textInfo.append('p').attr('class', 'info-accel');
                    textInfo.append('p').attr('class', 'info-price');

                    this.metrics.forEach((m, idx) => {
                        const r0 = 40 + idx * 14, r1 = r0 + 10;
                        g.append('path')
                            .attr('d', d3.arc()({innerRadius: r0, outerRadius: r1, startAngle: -2.1, endAngle: 2.1}))
                            .attr('fill', '#e9ecef');
                        
                        g.append('path').attr('class', `needle-${m.key}`);
                    });
                    
                    return card;
                },
                update => update,
                exit => exit.remove()
            );

        cards.each((d, i, nodes) => {
            const card = d3.select(nodes[i]);
            const car = d;

            card.select('h3').text(`${car.brand} ${car.model}`);
            card.select('.info-hp').html(`Horsepower: <strong>${car.hp || 'N/A'} HP</strong>`);
            card.select('.info-tops').html(`Top Speed: <strong>${car.tops || 'N/A'} km/h</strong>`);
            card.select('.info-accel').html(`0-100 km/h: <strong>${car.accel || 'N/A'}s</strong>`);
            card.select('.info-price').html(`Price: <strong>$${fmtK(car.price)}</strong>`);

            const g = card.select('g');
            this.metrics.forEach((m, idx) => {
                const r0 = 40 + idx * 14, r1 = r0 + 10;
                const ang = d3.scaleLinear().domain([-1, 1]).range([-2.1, 2.1]);
                
                const vAbs = car[m.key];
                const vNorm = (m.key === 'accel') 
                    ? (isFinite(best.accel) && best.accel > 0 && isFinite(vAbs) ? (best.accel / vAbs) : 0)
                    : (isFinite(best[m.key]) && best[m.key] > 0 && isFinite(vAbs) ? (vAbs / best[m.key]) : 0);

                const global = this.normalizeGlobal(m.key, vAbs);
                
                let val = (baseline === 'norm') ? vNorm : global;
                
                if (isFinite(val)) {
                    val = Math.max(0.03, val);
                }

                const to = ang(-1 + 2 * (isFinite(val) ? val : 0));

                const needle = g.select(`.needle-${m.key}`);
                const currentAngle = needle.attr('data-angle') ? +needle.attr('data-angle') : -2.1;

                needle
                    .attr('fill', this.colorFor(m.key))
                    .transition().duration(750).ease(d3.easeCubicOut)
                    .attrTween('d', () => {
                        const interpolator = d3.interpolate(currentAngle, to);
                        return t => {
                            const currentInterpolatedAngle = interpolator(t);
                            needle.attr('data-angle', currentInterpolatedAngle);
                            return d3.arc()({
                                innerRadius: r0, outerRadius: r1, 
                                startAngle: -2.1, endAngle: currentInterpolatedAngle
                            });
                        }
                    });
            });
        });
    }
    
    normalizeGlobal(key, val){
        const arr = d3.extent(this.data.filter(d => isFinite(d[key])), d => d[key]);
        if (!isFinite(val) || arr[0] === undefined || arr[1] === undefined) return 0;
        
        const domainSize = arr[1] - arr[0];
        if (domainSize === 0) return 0.5;

        if(key === 'accel'){ 
            return 1 - ((val - arr[0]) / domainSize); 
        }
        return (val - arr[0]) / domainSize;
    }
}

class ScatterPlot {
    constructor(selector, data) {
        this.svg = d3.select(selector);
        this.data = data;
        this.currentFilter = 'All';
        
        console.log('ScatterPlot initialized with', data.length, 'data points');
        
        // 创建品牌颜色映射
        const brands = Array.from(new Set(this.data.map(d => d.brand))).sort();
        this.colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(brands);
        
        this.initVis();
    }

    initVis() {
        const vis = this;
        
        // 立即绘制一次
        const container = vis.svg.node().parentElement;
        if (container) {
            const rect = container.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                vis.draw(rect.width, rect.height);
            }
        }
        
        // 监听窗口大小变化
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    vis.draw(width, height);
                }
            }
        });
        resizeObserver.observe(container);
    }

    draw(width, height) {
        const vis = this;
        
        console.log('Drawing scatter plot:', width, 'x', height);
        
        vis.svg.selectAll('*').remove();

        vis.margin = {top: 20, right: 30, bottom: 50, left: 70};
        vis.width = width - vis.margin.left - vis.margin.right;
        vis.height = height - vis.margin.top - vis.margin.bottom;
        
        // 设置SVG尺寸
        vis.svg
            .attr('width', width)
            .attr('height', height);
        
        vis.g = vis.svg.append('g')
            .attr('transform', `translate(${vis.margin.left},${vis.margin.top})`);
        
        // 创建比例尺
        const maxHp = d3.max(vis.data, d => d.hp);
        const maxCapacity = d3.max(vis.data, d => d.capacity);
        
        console.log('Data ranges - HP:', [0, maxHp], 'Capacity:', [0, maxCapacity]);
        
        vis.xScale = d3.scaleLinear()
            .domain([0, maxHp * 1.1])
            .range([0, vis.width])
            .nice();
            
        vis.yScale = d3.scaleLinear()
            .domain([0, maxCapacity * 1.1])
            .range([vis.height, 0])
            .nice();
        
        // 添加坐标轴
        const xAxis = d3.axisBottom(vis.xScale).ticks(8);
        const yAxis = d3.axisLeft(vis.yScale).ticks(8);
        
        vis.g.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0, ${vis.height})`)
            .call(xAxis);

        vis.g.append('g')
            .attr('class', 'axis y-axis')
            .call(yAxis);
        
        // 添加坐标轴标签
        vis.g.append('text')
            .attr('class', 'axis-label')
            .attr('x', vis.width / 2)
            .attr('y', vis.height + 40)
            .attr('text-anchor', 'middle')
            .text('Horsepower (HP)');

        vis.g.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('x', -vis.height / 2)
            .attr('y', -50)
            .attr('text-anchor', 'middle')
            .text('Engine/Battery Capacity (cc/kWh)');

        const tooltip = d3.select('#tooltip');

        // 绘制数据点
        vis.dots = vis.g.selectAll('.dot')
            .data(vis.data)
            .join('circle')
                .attr('class', 'dot')
                .attr('cx', d => vis.xScale(d.hp))
                .attr('cy', d => vis.yScale(d.capacity))
                .attr('r', 6)
                .attr('fill', d => vis.colorScale(d.brand))
                .attr('opacity', d => (vis.currentFilter === 'All' || d.seats === vis.currentFilter) ? 0.7 : 0.05)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1)
                .style('cursor', 'pointer')
                .on('mouseover', function(event, d) {
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr('r', 10)
                        .attr('stroke-width', 2);
                    
                    tooltip.style('opacity', 1)
                        .html(`<strong>${d.brand} ${d.model}</strong><br>
                               Seats: ${d.seats}<br>
                               HP: ${d.hp}<br>
                               Capacity: ${d.capacity} cc<br>
                               Top Speed: ${d.tops} km/h<br>
                               Price: $${fmtK(d.price)}`);
                })
                .on('mousemove', (event) => {
                    tooltip
                        .style('left', `${event.pageX + 15}px`)
                        .style('top', `${event.pageY - 10}px`);
                })
                .on('mouseout', function() {
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr('r', 6)
                        .attr('stroke-width', 1);
                    
                    tooltip.style('opacity', 0);
                });
        
        console.log('Scatter plot drawn with', vis.dots.size(), 'points');
    }

    filterBySeats(seatValue) {
        const vis = this;
        vis.currentFilter = seatValue;
        console.log('Filtering by seats:', seatValue);
        
        if (!vis.dots) return;
        
        vis.dots
            .transition()
            .duration(300)
            .attr('opacity', d => (seatValue === 'All' || d.seats === seatValue) ? 0.7 : 0.05)
            .attr('r', d => (seatValue === 'All' || d.seats === seatValue) ? 6 : 4);
    }
}