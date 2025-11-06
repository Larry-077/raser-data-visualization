// 工具函数模块

// 生成唯一键
export const keyOf = d => `${d.brand}__${d.model}`;

// 格式化数字（K表示千）
export const fmtK = x => !isFinite(x) ? '—' : (x >= 1e3 ? (x / 1e3).toFixed(1) + 'k' : String(Math.round(x || 0)));

// 格式化价格
export const fmtPrice = x => !isFinite(x) ? '—' : '$' + fmtK(x);

// 解析CSV行数据
export const parseRow = (d) => {
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
        capacity: num(d['CC/Battery Capacity']),
        torque: num(d['Torque'])
    };
};

// 创建品牌颜色映射
export const createBrandColorScale = (data) => {
    const brands = Array.from(new Set(data.map(d => d.brand))).sort();
    return d3.scaleOrdinal(d3.schemeCategory10).domain(brands);
};

// 计算性价比指标
export const calculateValueMetrics = (data) => {
    return data.map(d => ({
        ...d,
        hpPerDollar: isFinite(d.hp) && isFinite(d.price) && d.price > 0 ? d.hp / d.price : 0,
        speedPerDollar: isFinite(d.tops) && isFinite(d.price) && d.price > 0 ? d.tops / d.price : 0,
        performanceScore: isFinite(d.hp) && isFinite(d.tops) && isFinite(d.accel) && d.accel > 0 
            ? (d.hp * d.tops) / d.accel : 0
    }));
};