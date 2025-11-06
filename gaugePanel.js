// 仪表盘可视化模块

import { keyOf, fmtK } from './utils.js';

export class EnhancedGaugePanel {
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
