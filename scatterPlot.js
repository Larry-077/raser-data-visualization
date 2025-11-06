// 简化的散点图模块 - 用于调试

import { fmtK, fmtPrice, calculateValueMetrics } from './utils.js';

export class ScatterPlot {
    constructor(selector, data) {
        console.log('ScatterPlot constructor called');
        console.log('Selector:', selector);
        console.log('Data length:', data.length);
        
        this.svg = d3.select(selector);
        console.log('SVG element:', this.svg.node());
        
        this.data = calculateValueMetrics(data);
        this.currentFilter = 'All';
        this.currentXAxis = 'hp';
        this.currentYAxis = 'price';
        
        // 创建品牌颜色映射
        const brands = Array.from(new Set(this.data.map(d => d.brand))).sort();
        this.colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(brands);
        
        console.log('Brands:', brands.length);
        console.log('Color scale created');
        
        this.initVis();
    }

    initVis() {
        const vis = this;
        console.log('initVis called');
        
        // 立即尝试绘制
        const container = vis.svg.node()?.parentElement;
        console.log('Container:', container);
        
        if (container) {
            // 使用固定尺寸先测试
            console.log('Drawing with fixed size');
            vis.draw(1200, 500);
        } else {
            console.error('Container not found!');
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
        console.log('Width:', width, 'Height:', height);
        console.log('Current X axis:', vis.currentXAxis);
        console.log('Current Y axis:', vis.currentYAxis);
        
        // 清除现有内容
        vis.svg.selectAll('*').remove();
        console.log('Cleared SVG');

        vis.margin = {top: 40, right: 120, bottom: 60, left: 80};
        vis.width = width - vis.margin.left - vis.margin.right;
        vis.height = height - vis.margin.top - vis.margin.bottom;
        
        console.log('Inner dimensions:', vis.width, 'x', vis.height);
        
        // 设置SVG尺寸
        vis.svg
            .attr('width', width)
            .attr('height', height);
        
        vis.g = vis.svg.append('g')
            .attr('transform', `translate(${vis.margin.left},${vis.margin.top})`);
        
        console.log('Created main group');
        
        // 过滤有效数据
        const validData = vis.data.filter(d => 
            isFinite(d[vis.currentXAxis]) && isFinite(d[vis.currentYAxis])
        );
        
        console.log('Valid data points:', validData.length);
        console.log('Sample data:', validData.slice(0, 3));
        
        if (validData.length === 0) {
            console.error('No valid data to display!');
            vis.g.append('text')
                .attr('x', vis.width / 2)
                .attr('y', vis.height / 2)
                .attr('text-anchor', 'middle')
                .style('fill', 'white')
                .text('No valid data to display');
            return;
        }
        
        // 创建比例尺
        const xExtent = d3.extent(validData, d => d[vis.currentXAxis]);
        const yExtent = d3.extent(validData, d => d[vis.currentYAxis]);
        
        console.log('X extent:', xExtent);
        console.log('Y extent:', yExtent);
        
        vis.xScale = d3.scaleLinear()
            .domain([xExtent[0] * 0.9, xExtent[1] * 1.1])
            .range([0, vis.width])
            .nice();
        
        vis.yScale = d3.scaleLinear()
            .domain([yExtent[0] * 0.9, yExtent[1] * 1.1])
            .range([vis.height, 0])
            .nice();
        
        console.log('Scales created');
        console.log('X scale domain:', vis.xScale.domain());
        console.log('Y scale domain:', vis.yScale.domain());
        
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
        
        console.log('Axes added');
        
        // 添加坐标轴标签
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
        
        console.log('Labels added');

        const tooltip = d3.select('#tooltip');

        // 绘制数据点
        console.log('Creating dots...');
        vis.dots = vis.g.selectAll('.dot')
            .data(validData)
            .join('circle')
                .attr('class', 'dot')
                .attr('cx', d => {
                    const x = vis.xScale(d[vis.currentXAxis]);
                    return x;
                })
                .attr('cy', d => {
                    const y = vis.yScale(d[vis.currentYAxis]);
                    return y;
                })
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
        
        console.log('Dots created:', vis.dots.size());
        console.log('=== DRAW COMPLETE ===');
    }

    filterBySeats(seatValue) {
        const vis = this;
        vis.currentFilter = seatValue;
        console.log('Filtering by seats:', seatValue);
        
        if (!vis.dots) {
            console.warn('No dots to filter');
            return;
        }
        
        vis.dots
            .transition()
            .duration(300)
            .attr('opacity', d => (seatValue === 'All' || d.seats === seatValue) ? 0.7 : 0.05)
            .attr('r', d => (seatValue === 'All' || d.seats === seatValue) ? 6 : 4);
    }

    changeAxes(xAxis, yAxis) {
        const vis = this;
        console.log('=== CHANGING AXES ===');
        console.log('New X axis:', xAxis);
        console.log('New Y axis:', yAxis);
        
        vis.currentXAxis = xAxis;
        vis.currentYAxis = yAxis;
        
        // 重新绘制
        const container = vis.svg.node()?.parentElement;
        if (container) {
            const rect = container.getBoundingClientRect();
            console.log('Container rect:', rect);
            if (rect.width > 0 && rect.height > 0) {
                vis.draw(rect.width, rect.height);
            } else {
                console.log('Using fixed size');
                vis.draw(1200, 500);
            }
        } else {
            console.error('Container not found in changeAxes');
        }
    }
}