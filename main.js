function setView(h){
    const v = h || location.hash || '#ribbon';
    document.querySelectorAll('section').forEach(s=>s.classList.remove('active'));
    document.getElementById('linkRibbon').classList.toggle('active', v==='#ribbon');
    document.getElementById('linkGauges').classList.toggle('active', v==='#gauges');
    document.getElementById('linkDash').classList.toggle('active', v==='#dash');

    if (v === '#gauges') document.getElementById('viewGauges').classList.add('active');
    else if (v === '#dash') document.getElementById('viewDash').classList.add('active');
    else document.getElementById('viewRibbon').classList.add('active');
}
window.addEventListener('hashchange',()=>setView(location.hash));

const CSV_PATH = 'Cars Datasets 2025.csv';

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
        price: num(d['Cars Prices'])
    };
};

const RAW = (await d3.csv(CSV_PATH, parseRow))
    .filter(d => d.model && (isFinite(d.hp)||isFinite(d.accel)||isFinite(d.tops)));

const brands  = Array.from(new Set(RAW.map(d=>d.brand))).sort();
const palette = d3.scaleOrdinal().domain(brands).range([
    '#ff2a3d','#ff7b89','#ff4c6a','#ff8a50','#ffc857',
    '#9bd356','#4db3ff','#66e0ff','#b08cff','#ad1fff',
    '#7c4dff','#d81b60','#ff3d00','#c8d0d7','#6ad3c2','#c6ff8e'
]);
const fmtK = x => !isFinite(x) ? '—' : (x>=1e6? (x/1e6).toFixed(2)+'M' : x>=1e3? (x/1e3).toFixed(0)+'k' : String(Math.round(x||0)));
const keyOf = d => `${d.brand}__${d.model}`;

class RibbonTrack {
    constructor(parentSel, data){
        this.parentSel = parentSel;
        this.data = data;
        this.initVis();
    }
    initVis(){
        const vis = this;
        vis.margin = {top: 40, right: 20, bottom: 20, left: 60};
        vis.outerW = 1120; vis.outerH = 660;
        vis.width  = vis.outerW - vis.margin.left - vis.margin.right;
        vis.height = vis.outerH - vis.margin.top - vis.margin.bottom;

        vis.svg = d3.select('#ribbonSVG');
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
            .attr('stroke','#1f2227').attr('stroke-width',30).attr('stroke-linecap','round').attr('stroke-linejoin','round');
        vis.baseTrack = vis.g.append('path')
            .attr('d', vis.trackD).attr('fill','none')
            .attr('stroke','#2a2f35').attr('stroke-width',18).attr('stroke-linecap','round').attr('stroke-linejoin','round')
            .attr('stroke-dasharray','10 18');
        vis.totalLen = vis.baseTrack.node().getTotalLength();

        vis.trailG = vis.g.append('g');
        vis.carG   = vis.g.append('g');
        vis.hudG   = vis.g.append('g');
        vis.infoG  = vis.g.append('g');

        vis.wStroke = d3.scaleLinear().domain(d3.extent(vis.data, d=>d.hp)).range([6, 22]);
        vis.glow    = d3.scaleLinear().domain(d3.extent(vis.data, d=>d.tops)).range([.35, .95]);
        vis.dash    = d3.scaleLinear().domain(d3.extent(vis.data, d=>d.accel)).range([36, 8]);
        vis.speed   = d3.scaleLinear().domain(d3.extent(vis.data, d=>d.hp)).range([1.0, 3.2]);

        const names = vis.data.map(d => `${d.brand} ${d.model}`);
        const opts  = ['— None —', ...names];
        const s1 = d3.select('#carSel1'), s2 = d3.select('#carSel2'), s3 = d3.select('#carSel3');

        [s1,s2,s3].forEach(s => s.selectAll('option').data(opts).join('option').text(d=>d));
        d3.select('#random3').on('click', () => {
            const pick = d3.shuffle(names.slice()).slice(0,3);
            s1.node().value = pick[0] || '— None —';
            s2.node().value = pick[1] || '— None —';
            s3.node().value = pick[2] || '— None —';
            vis.setCars(vis.getSelected());
        });
        [s1,s2,s3].forEach(s => s.on('change', ()=> vis.setCars(vis.getSelected())));
        
        s1.node().value = "ASTON MARTIN VANTAGE F1";
        s2.node().value = "TOYOTA GR SUPRA";
        s3.node().value = "PORSCHE 911 GT3 RS";

        vis.setCars(vis.getSelected());
        vis.start();
    }
    getSelected(){
        const chosen = [carSel1.value, carSel2.value, carSel3.value].filter(v=> v && v!=='— None —');
        if(!chosen.length){
             return [
                this.data.find(c => c.model === 'VANTAGE F1'),
                this.data.find(c => c.model === 'GR SUPRA'),
                this.data.find(c => c.model === '911 GT3 RS')
            ].filter(Boolean);
        }
        const list=[], seen=new Set();
        for(const name of chosen){
            const car = this.data.find(x => `${x.brand} ${x.model}`===name);
            if(car && !seen.has(keyOf(car))){ list.push(car); seen.add(keyOf(car)); }
        }
        if(list.length<3){
            this.data.slice().sort((a,b)=>(b.hp||0)-(a.hp||0)).some(c=>{
                if(!seen.has(keyOf(c))){ list.push(c); seen.add(keyOf(c)); }
                return list.length>=3;
            });
        }
        return list.slice(0,3);
    }
    setCars(list){
        const vis = this;
        vis.cars = list;
        vis.states = vis.cars.map((d,i)=>({d, off:(i*vis.totalLen/10)%vis.totalLen, v: vis.speed(d.hp)}));
        vis.updateVis();
    }
    updateVis(){
        const vis = this;
        vis.infoG.selectAll('*').remove();
        const x=820,y=16,w=260,h=140;
        vis.infoG.append('rect').attr('x',x).attr('y',y).attr('rx',10).attr('ry',10).attr('width',w).attr('height',h)
            .attr('fill','rgba(16,18,22,.55)').attr('stroke','rgba(255,255,255,.12)');
        vis.infoG.append('text').attr('x',x+10).attr('y',y+18).text('Cars (details)').style('font-size','12px').style('fill','#dfe3e8');
        vis.infoG.selectAll('.card').data(vis.cars, keyOf).join(enter=>{
            const g = enter.append('g').attr('class','card')
                .attr('transform',(_,i)=>`translate(${x+8},${y+28+i*36})`);
            g.append('circle').attr('r',5).attr('cy',6).attr('fill', d=>palette(d.brand));
            g.append('text').attr('x',12).attr('y',10).style('font-size','12px').style('fill','#e9edf2')
                .text(d=>`${d.brand} ${d.model}`);
            g.append('text').attr('x',12).attr('y',24).style('font-size','11px').style('fill','#c9c9c9')
                .text(d=>`HP ${d.hp ?? '—'} · 0–100 ${d.accel ?? '—'}s · ${d.tops ?? '—'} km/h · $${fmtK(d.price)}`);
            return g;
        });
        vis.hudG.selectAll('*').remove();
        vis.hudG.append('rect').attr('x',820).attr('y',164).attr('rx',10).attr('ry',10).attr('width',260).attr('height',78)
            .attr('fill','rgba(16,18,22,.55)').attr('stroke','rgba(255,255,255,.12)');
        vis.hudG.append('text').attr('x',830).attr('y',182).text('Live Order').style('font-size','12px').style('fill','#dfe3e8');
        vis.cars.slice(0,3).forEach((d,i)=>{
            vis.hudG.append('text').attr('x',830).attr('y',202+i*16).text(`${i+1}. ${d.brand} ${d.model}`)
                .style('font-size','12px').style('fill','#c9c9c9');
        });
        const ribbons = vis.carG.selectAll('.ribbon').data(vis.cars, keyOf)
            .join(
                enter => {
                    const g = enter.append('g').attr('class','ribbon');
                    g.append('path').attr('class','rLine').attr('d', vis.trackD).attr('fill','none');
                    g.append('circle').attr('class','marker').attr('r',7).attr('stroke','#111').attr('stroke-width',2);
                    g.append('text').attr('class','spd').attr('dy',-12).attr('text-anchor','middle')
                        .style('font-size','11px').style('fill','#dfe3e8');
                    return g;
                },
                update => update,
                exit => exit.remove()
            );
        ribbons.each(function(d){
            const sel = d3.select(this);
            sel.select('.rLine')
                .attr('stroke', palette(d.brand))
                .attr('stroke-opacity', vis.glow(d.tops||0))
                .attr('stroke-width', vis.wStroke(d.hp||0))
                .attr('stroke-linecap','round')
                .attr('stroke-dasharray', `${vis.dash(d.accel||0)} ${vis.dash(d.accel||0)}`);
            sel.select('.marker').attr('fill', palette(d.brand));
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

class GaugeCluster {
    constructor(parentSel, data){
        this.parentSel = parentSel;
        this.data = data;
        this.initVis();
    }
    initVis(){
        const vis = this;
        vis.margin = {top: 20, right: 20, bottom: 20, left: 20};
        vis.svg = d3.select('#gaugeSVG');
        vis.g   = vis.svg.append('g').attr('transform',`translate(${vis.margin.left},${vis.margin.top})`);
        vis.slots   = [{x:140,y:160},{x:560,y:160},{x:980,y:160}];
        vis.metrics = [{key:'hp',label:'HP'},{key:'accel',label:'0-100s'},{key:'tops',label:'Top'},{key:'price',label:'Price'}];
        vis.slots.forEach(p=>{
            vis.g.append('circle').attr('cx',p.x).attr('cy',p.y).attr('r',120).attr('fill','rgba(255,255,255,.02)').attr('stroke','#2a2f35');
            vis.g.append('text').attr('x',p.x).attr('y',p.y+140).attr('text-anchor','middle').style('font-size','12px').style('fill','#dfe3e8').text('Select a car');
        });
        const names = vis.data.map(d => `${d.brand} ${d.model}`);
        const opts  = ['— None —', ...names];
        vis.selects = [d3.select('#g1'), d3.select('#g2'), d3.select('#g3')];
        vis.selects.forEach(s => s.selectAll('option').data(opts).join('option').text(d=>d));
        vis.selects.forEach(s => s.on('change', ()=> vis.drawAll()));
        document.getElementById('baseMode').addEventListener('change', ()=> vis.drawAll());
        vis.drawAll();
    }
    drawAll(){
        const vis = this;
        const picked = vis.selects
            .map(s => vis.data.find(x=> `${x.brand} ${x.model}`===s.node().value))
            .filter(Boolean);

        const baseMode = document.getElementById('baseMode').value;
        const best = {
            hp:   d3.max(picked, d=>d.hp)   || 1,
            accel:d3.min(picked, d=>d.accel)|| 1,
            tops: d3.max(picked, d=>d.tops) || 1,
            price:d3.max(picked, d=>d.price)|| 1
        };

        vis.slots.forEach((p,slotIdx)=>{
            vis.g.selectAll(`.slot-${slotIdx}`).remove();
            const name = vis.selects[slotIdx].node().value;
            if(name==='— None —') return;
            const car = vis.data.find(x=> `${x.brand} ${x.model}`===name);
            const layer = vis.g.append('g').attr('class',`slot-${slotIdx}`);
            layer.append('text')
                .attr('x',p.x).attr('y',p.y-132).attr('text-anchor','middle')
                .style('font-weight','700').text(`${car.brand} ${car.model}`);
            vis.metrics.forEach((m,idx)=>{
                const r0=40+idx*18, r1=r0+12;
                const ang = d3.scaleLinear().domain([-1,1]).range([-2.1,2.1]);
                layer.append('path')
                    .attr('d', d3.arc()({innerRadius:r0, outerRadius:r1, startAngle:-2.1, endAngle:2.1}))
                    .attr('transform',`translate(${p.x},${p.y})`).attr('fill','#1c2026');
                const vAbs = car[m.key];
                const vNorm = (m.key==='accel') ? (best.accel / vAbs) : (vAbs / best[m.key]);
                const global = vis.normalizeGlobal(m.key, vAbs);
                const val = (baseMode==='norm') ? vNorm : global;
                const needle = layer.append('path')
                    .attr('transform',`translate(${p.x},${p.y})`)
                    .attr('fill', vis.colorFor(m.key)).attr('opacity',.85);
                const to = ang(-1 + 2*val);
                needle.transition().duration(700).ease(d3.easeCubicOut)
                    .attrTween('d', function(){ const i=d3.interpolate(-2.1, to); return t=> d3.arc()({innerRadius:r0, outerRadius:r1, startAngle:-2.1, endAngle:i(t)}); });
            });
            const hp=car.hp, ac=car.accel, ts=car.tops, pr=car.price;
            layer.append('text').attr('x',p.x).attr('y',p.y+18).attr('text-anchor','middle').style('font-size','20px').text(`${hp||'—'} hp`);
            layer.append('text').attr('x',p.x).attr('y',p.y+40).attr('text-anchor','middle').style('font-size','12px').style('fill','#c9c9c9')
                .text(`0-100 ${ac||'—'}s · ${ts||'—'} km/h · $${fmtK(pr)}`);
        });
    }
    normalizeGlobal(key, val){
        const arr = k => d3.extent(this.data, d=>d[k]);
        const safe = a => (a[1]-a[0])||1;
        if(!isFinite(val)) return 0.5;
        if(key==='accel'){ const e=arr('accel'); return 1 - ((val - e[0]) / safe(e)); }
        const e=arr(key); return (val - e[0]) / safe(e);
    }
    colorFor(k){ return k==='hp'? '#ff2a3d' : k==='accel'? '#66ccff' : k==='tops'? '#ffc857' : '#c8d0d7'; }
}

class AccelerationDash {
    constructor(parentSel, data) {
        this.parentSel = parentSel;
        this.data = data;
        this.initVis();
    }

    initVis() {
        const vis = this;
        vis.margin = {top: 60, right: 60, bottom: 60, left: 60};
        vis.width = 1120 - vis.margin.left - vis.margin.right;
        vis.height = 660 - vis.margin.top - vis.margin.bottom;

        vis.svg = d3.select(vis.parentSel);
        vis.g = vis.svg.append('g').attr('transform', `translate(${vis.margin.left},${vis.margin.top})`);
        
        vis.startX = 50;
        vis.endX = vis.width - 50;

        for (let i = 0; i < 3; i++) {
            const y = vis.height / 4 * (i + 1);
            vis.g.append('line')
                .attr('x1', vis.startX - 20).attr('x2', vis.endX + 20)
                .attr('y1', y).attr('y2', y)
                .attr('stroke', '#2a2f35').attr('stroke-width', 2).attr('stroke-dasharray', '8 8');
        }
        
        vis.g.append('line').attr('x1', vis.startX).attr('x2', vis.startX)
           .attr('y1', 50).attr('y2', vis.height - 50)
           .attr('stroke', 'var(--green)').attr('stroke-width', 3);
        vis.g.append('text').text('START').attr('x', vis.startX - 10).attr('y', 30)
           .attr('fill', 'var(--green)').attr('text-anchor', 'end').style('font-weight', 700);

        vis.g.append('line').attr('x1', vis.endX).attr('x2', vis.endX)
           .attr('y1', 50).attr('y2', vis.height - 50)
           .attr('stroke', 'var(--red)').attr('stroke-width', 3);
        vis.g.append('text').text('FINISH (100 km/h)').attr('x', vis.endX + 10).attr('y', 30)
           .attr('fill', 'var(--red)').style('font-weight', 700);

        vis.carG = vis.g.append('g');

        const names = vis.data.map(d => `${d.brand} ${d.model}`);
        vis.selects = [d3.select('#dashCar1'), d3.select('#dashCar2'), d3.select('#dashCar3')];
        vis.selects.forEach(sel => {
            sel.selectAll('option').data(names).join('option').text(d => d);
            sel.on('change', () => vis.updateVis());
        });

        d3.select('#startRaceBtn').on('click', () => vis.startRace());

        vis.selects[0].node().value = "FERRARI SF90 STRADALE";
        vis.selects[1].node().value = "TESLA MODEL S PLAID";
        vis.selects[2].node().value = "ROLLS ROYCE PHANTOM";
        
        vis.updateVis();
    }

    updateVis() {
        const vis = this;
        d3.select('#startRaceBtn').property('disabled', false).style('opacity', 1);

        vis.cars = vis.selects
            .map(sel => vis.data.find(c => `${c.brand} ${c.model}` === sel.node().value))
            .filter(Boolean);
        
        const carNodes = vis.carG.selectAll('.car-racer')
            .data(vis.cars, d => keyOf(d))
            .join(
                enter => {
                    const g = enter.append('g').attr('class', 'car-racer');
                    g.append('circle').attr('r', 15).attr('stroke', '#fff').attr('stroke-width', 2);
                    g.append('text').attr('class', 'car-label').attr('x', -25)
                       .attr('text-anchor', 'end').attr('dy', '0.35em').attr('fill', '#fff');
                    g.append('text').attr('class', 'time-label').attr('x', vis.endX + 25)
                        .attr('dy', '0.35em').attr('fill', 'var(--amber)').style('font-weight', 'bold')
                        .style('opacity', 0);
                    return g;
                }
            );
        
        carNodes
            .attr('transform', (d, i) => `translate(${vis.startX}, ${vis.height / 4 * (i + 1)})`)
            .select('circle').attr('fill', d => palette(d.brand));
        
        carNodes.select('.car-label').text(d => `${d.brand} ${d.model}`);
        carNodes.select('.time-label').text(d => `${d.accel}s`);
    }

    startRace() {
        const vis = this;
        d3.select('#startRaceBtn').property('disabled', true).style('opacity', 0.5);
        
        vis.carG.selectAll('.car-racer')
            .attr('transform', (d, i) => `translate(${vis.startX}, ${vis.height / 4 * (i + 1)})`)
            .select('.time-label').style('opacity', 0);

        vis.carG.selectAll('.car-racer')
            .transition()
            .ease(d3.easeLinear)
            .duration(d => (d.accel || 10) * 800)
            .attr('transform', (d, i) => `translate(${vis.endX}, ${vis.height / 4 * (i + 1)})`)
            .on('end', function() {
                d3.select(this).select('.time-label').transition().style('opacity', 1);
            });
        
        const maxDuration = d3.max(vis.cars, d => (d.accel || 10) * 800);
        setTimeout(() => {
            d3.select('#startRaceBtn').property('disabled', false).style('opacity', 1);
        }, maxDuration);
    }
}

new RibbonTrack('#ribbonSVG', RAW);
new GaugeCluster('#gaugeSVG', RAW);
new AccelerationDash('#dashSVG', RAW);
setView(location.hash || '#ribbon');