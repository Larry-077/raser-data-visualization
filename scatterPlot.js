

import { fmtK, fmtPrice, calculateValueMetrics } from './utils.js';

export class ScatterPlot {
    constructor(selector, data) {
        console.log('ScatterPlot constructor called');
        
        this.svg = d3.select(selector);
        this.data = calculateValueMetrics(data);
        this.currentFilter = 'All';
        this.currentXAxis = 'hp';
        this.currentYAxis = 'price';
        this.maxDataCount = 100; 
        
        
        const brands = Array.from(new Set(this.data.map(d => d.brand))).sort();
        this.colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(brands);
        
        this.initVis();
    }

    initVis() {
        const vis = this;
        const container = vis.svg.node()?.parentElement;
        
        if (container) {
            vis.draw(1200, 500);
        }
    }

   
    setMaxDataCount(count) {
        this.maxDataCount = count;
        console.log('Max data count set to:', count);
        
        const container = this.svg.node()?.parentElement;
        if (container) {
            const rect = container.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                this.draw(rect.width, rect.height);
            } else {
                this.draw(1200, 500);
            }
        }
    }

    getAxisConfig(key) {
        const configs = {
            hp: { label: 'Horsepower (HP)', format: d => d },
            tops: { label: 'Top Speed (km/h)', format: d => d },
            accel: { label: '0-100 km/h Time (s)', format: d => d.toFixed(1) },
            price: { label: 'Price ($)', format: d => fmtPrice(d) },
            capacity: { label: 'Engine/Battery Capacity', format: d => d },
            hpPerDollar: { label: 'HP per $1000', format: d => (d * 1000).toFixed(2) },
            speedPerDollar: { label: 'Speed per $1000', format: d => (d * 1000).toFixed(2) },
            performanceScore: { label: 'Performance Score', format: d => d.toFixed(0) }
        };
        return configs[key] || configs.hp;
    }

    draw(width, height) {
        const vis = this;
        
        console.log('=== DRAW CALLED ===');
        console.log('Max data count:', vis.maxDataCount);
        
        vis.svg.selectAll('*').remove();

        vis.margin = {top: 40, right: 120, bottom: 60, left: 80};
        vis.width = width - vis.margin.left - vis.margin.right;
        vis.height = height - vis.margin.top - vis.margin.bottom;
        
        vis.svg
            .attr('width', width)
            .attr('height', height);
        
        vis.g = vis.svg.append('g')
            .attr('transform', `translate(${vis.margin.left},${vis.margin.top})`);
        
        let validData = vis.data.filter(d => 
            isFinite(d[vis.currentXAxis]) && isFinite(d[vis.currentYAxis])
        );
        

        if (validData.length > vis.maxDataCount) {
            validData = validData
                .sort((a, b) => b.performanceScore - a.performanceScore)
                .slice(0, vis.maxDataCount);
            
            console.log(`Sampled ${vis.maxDataCount} cars from ${vis.data.length} total`);
        }
        
        console.log('Displaying data points:', validData.length);
        
        if (validData.length === 0) {
            vis.g.append('text')
                .attr('x', vis.width / 2)
                .attr('y', vis.height / 2)
                .attr('text-anchor', 'middle')
                .style('fill', 'white')
                .text('No valid data to display');
            return;
        }
        

        const xExtent = d3.extent(validData, d => d[vis.currentXAxis]);
        const yExtent = d3.extent(validData, d => d[vis.currentYAxis]);
        
        vis.xScale = d3.scaleLinear()
            .domain([xExtent[0] * 0.9, xExtent[1] * 1.1])
            .range([0, vis.width])
            .nice();
        
        vis.yScale = d3.scaleLinear()
            .domain([yExtent[0] * 0.9, yExtent[1] * 1.1])
            .range([vis.height, 0])
            .nice();

        const xAxis = d3.axisBottom(vis.xScale).ticks(8);
        const yAxis = d3.axisLeft(vis.yScale).ticks(8);
        
        vis.g.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0, ${vis.height})`)
            .call(xAxis);

        vis.g.append('g')
            .attr('class', 'axis y-axis')
            .call(yAxis);
        
   
        const xAxisConfig = vis.getAxisConfig(vis.currentXAxis);
        const yAxisConfig = vis.getAxisConfig(vis.currentYAxis);
        
        vis.g.append('text')
            .attr('class', 'axis-label')
            .attr('x', vis.width / 2)
            .attr('y', vis.height + 45)
            .attr('text-anchor', 'middle')
            .text(xAxisConfig.label);

        vis.g.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('x', -vis.height / 2)
            .attr('y', -55)
            .attr('text-anchor', 'middle')
            .text(yAxisConfig.label);

        const tooltip = d3.select('#tooltip');

        vis.dots = vis.g.selectAll('.dot')
            .data(validData)
            .join('circle')
                .attr('class', 'dot')
                .attr('cx', d => vis.xScale(d[vis.currentXAxis]))
                .attr('cy', d => vis.yScale(d[vis.currentYAxis]))
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
                               Top Speed: ${d.tops} km/h<br>
                               0-100: ${d.accel}s<br>
                               Price: ${fmtPrice(d.price)}<br>
                               <em style="color: var(--accent-red)">
                               HP/$1000: ${(d.hpPerDollar * 1000).toFixed(2)}<br>
                               Performance Score: ${d.performanceScore.toFixed(0)}
                               </em>`);
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
        
        vis.g.append('text')
            .attr('x', vis.width - 10)
            .attr('y', 20)
            .attr('text-anchor', 'end')
            .attr('fill', 'var(--text-secondary)')
            .style('font-size', '12px')
            .text(`Showing ${validData.length} of ${vis.data.length} cars`);
        
        console.log('=== DRAW COMPLETE ===');
    }

    filterBySeats(seatValue) {
        const vis = this;
        vis.currentFilter = seatValue;
        
        if (!vis.dots) return;
        
        vis.dots
            .transition()
            .duration(300)
            .attr('opacity', d => (seatValue === 'All' || d.seats === seatValue) ? 0.7 : 0.05)
            .attr('r', d => (seatValue === 'All' || d.seats === seatValue) ? 6 : 4);
    }

    changeAxes(xAxis, yAxis) {
        const vis = this;
        vis.currentXAxis = xAxis;
        vis.currentYAxis = yAxis;
        
        const container = vis.svg.node()?.parentElement;
        if (container) {
            const rect = container.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                vis.draw(rect.width, rect.height);
            } else {
                vis.draw(1200, 500);
            }
        }
    }
}