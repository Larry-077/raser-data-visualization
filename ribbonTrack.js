// 赛道动画可视化模块

import { keyOf } from './utils.js';

export class RibbonTrack {
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
    
    stop(){
        this._running = false;
    }
}
