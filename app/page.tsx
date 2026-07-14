'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  Search, 
  Grid, 
  List, 
  AlertTriangle, 
  ArrowDown, 
  ArrowUp, 
  TrendingUp, 
  Droplet, 
  X, 
  RefreshCw, 
  Database,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';

interface TransitionAlert {
  daysRemaining: number;
  nextSeasonName: string;
  nextHControl: number;
  currentHControl: number;
}

interface ReservoirData {
  name: string;
  timestamp: string;
  htl: number;
  hdbt: number;
  hc: number;
  hMinOp: number;
  hControl: number;
  qve: number;
  q_x: number;
  qxt: number;
  qxm: number;
  ncxs: number;
  ncxm: number;
  sync_time: string;
  riverBasin: string;
  region: string;
  status: "normal" | "warning" | "danger" | "dead";
  activeSeasonName: string;
  transitionAlert: TransitionAlert | null;
  installedCapacity: number | null;
  tailraceElev: number | null;
  estimatedPowerMW: number;
  estimatedEnergyKwh: number;
  wTotal: number | null;
  wActive: number | null;
  wDead: number | null;
  wFlood: number | null;
  volumeExponent: number;
  hMaxTechnical: number | null;
  emergencyBreachNotes: string | null;
}

interface HistoryPoint {
  timestamp: string;
  htl: number;
  qve: number;
  q_x: number;
  qxt: number;
  qxm: number;
}

export default function Dashboard() {
  const [waterLevels, setWaterLevels] = useState<ReservoirData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("All");
  const [selectedBasin, setSelectedBasin] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [specialFilter, setSpecialFilter] = useState<"none" | "discharge" | "warning">("none");

  // Selected Reservoir Detail Drawer
  const [selectedReservoir, setSelectedReservoir] = useState<ReservoirData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; htl: number; time: string } | null>(null);

  // Load latest data
  const loadLatestLevels = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const res = await fetch(`/api/water-levels?t=${Date.now()}`);
      if (!res.ok) throw new Error("Không thể kết nối API dữ liệu");
      const result = await res.json();
      
      if (result.success && result.data) {
        setWaterLevels(result.data);
        setError(null);
      } else {
        throw new Error(result.error || "Không có dữ liệu trả về");
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Lỗi tải dữ liệu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLatestLevels();
  }, []);

  // Fetch history for detailed drawer
  const fetchReservoirHistory = async (reservoirName: string, currentHtl: number) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/history?reservoir=${encodeURIComponent(reservoirName)}&current=${currentHtl}&t=${Date.now()}`);
      if (!res.ok) throw new Error("Không thể kết nối API lịch sử");
      const result = await res.json();
      if (result.success && result.data) {
        setHistory(result.data);
      }
    } catch (e) {
      console.error("Lỗi tải dữ liệu lịch sử:", e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleChartMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (!chartProps || chartProps.points.length === 0) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * chartProps.width;
    
    // Find closest point based on X coordinate
    let closest = chartProps.points[0];
    let minDiff = Math.abs(closest.x - mouseX);
    
    for (let i = 1; i < chartProps.points.length; i++) {
      const diff = Math.abs(chartProps.points[i].x - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = chartProps.points[i];
      }
    }
    
    setHoveredPoint(closest);
  };

  const handleSelectReservoir = (res: ReservoirData) => {
    setSelectedReservoir(res);
    setHistory([]);
    setHoveredPoint(null); // clear hover state
    fetchReservoirHistory(res.name, res.htl);
  };

  const handleCloseDrawer = () => {
    setSelectedReservoir(null);
    setHistory([]);
    setHoveredPoint(null); // clear hover state
  };

  // Get unique regions and basins for filter dropdowns
  const regions = useMemo(() => {
    const list = new Set(waterLevels.map(r => r.region));
    return ["All", ...Array.from(list)];
  }, [waterLevels]);

  const basins = useMemo(() => {
    const list = new Set(waterLevels.map(r => r.riverBasin).filter(Boolean));
    return ["All", ...Array.from(list)];
  }, [waterLevels]);

  // Filtered Reservoirs
  const filteredLevels = useMemo(() => {
    // 1. Base search and dropdown filters
    const baseList = waterLevels.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.riverBasin.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRegion = selectedRegion === "All" || item.region === selectedRegion;
      const matchesBasin = selectedBasin === "All" || item.riverBasin === selectedBasin;
      return matchesSearch && matchesRegion && matchesBasin;
    });

    if (specialFilter === "none") return baseList;

    // 2. Identify elements matching the active click filter criteria
    const baseMatched = baseList.filter(r => {
      if (specialFilter === "discharge") return r.qxt > 0;
      if (specialFilter === "warning") return r.status === "danger" || r.status === "warning";
      return true;
    });

    // 3. Check if any matches belong to "Sông Đà"
    const hasSongDaMatch = baseMatched.some(r => r.riverBasin === "Sông Đà");

    // 4. Return union: base matches + all other "Sông Đà" reservoirs in the filtered set
    return baseList.filter(r => {
      const isBaseMatch = specialFilter === "discharge" ? (r.qxt > 0) : (r.status === "danger" || r.status === "warning");
      if (isBaseMatch) return true;
      if (hasSongDaMatch && r.riverBasin === "Sông Đà") return true;
      return false;
    });
  }, [waterLevels, searchQuery, selectedRegion, selectedBasin, specialFilter]);

  // Global Aggregate Metrics
  const aggregates = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;
    let dischargeCount = 0;
    let alertCount = 0;

    waterLevels.forEach(r => {
      totalInflow += r.qve;
      totalOutflow += r.q_x;
      if (r.qxt > 0) dischargeCount++;
      if (r.status === "danger" || r.status === "warning") alertCount++;
    });

    return {
      totalInflow: Math.round(totalInflow),
      totalOutflow: Math.round(totalOutflow),
      dischargeCount,
      alertCount
    };
  }, [waterLevels]);

  // Find reservoirs with active upcoming seasonal transition warnings (within 7 days)
  const transitionAlerts = useMemo(() => {
    return waterLevels.filter(r => r.transitionAlert !== null);
  }, [waterLevels]);

  // Custom SVG Line Chart coordinates calculations
  const chartProps = useMemo(() => {
    if (history.length === 0) return null;

    const width = 420;
    const height = 180;
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 25;

    const htls = history.map(h => h.htl);
    const minH = Math.min(...htls);
    const maxH = Math.max(...htls);
    const hRange = (maxH - minH) || 2;
    
    // Add 10% breathing room to chart limits
    const yMin = minH - hRange * 0.1;
    const yMax = maxH + hRange * 0.1;
    const yRange = yMax - yMin;

    const points = history.map((pt, idx) => {
      const x = paddingLeft + (idx / (history.length - 1)) * (width - paddingLeft - paddingRight);
      const y = height - paddingBottom - ((pt.htl - yMin) / yRange) * (height - paddingTop - paddingBottom);
      return { x, y, htl: pt.htl, time: pt.timestamp };
    });

    // SVG path string
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    
    // SVG area shade path string
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

    return {
      width,
      height,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      points,
      linePath,
      areaPath,
      yMin: yMin.toFixed(1),
      yMax: yMax.toFixed(1),
    };
  }, [history]);

  // Estimate current reservoir storage volume and available flood control slice
  const capacityInfo = useMemo(() => {
    if (!selectedReservoir) return null;
    const { wTotal, wActive, wDead, wFlood, htl, hdbt, hc, hControl } = selectedReservoir;
    if (wTotal === null || wActive === null || wDead === null) return null;

    const elevationRatio = Math.max(0, Math.min(1, (htl - hc) / (hdbt - hc)));
    const exponent = selectedReservoir.volumeExponent || 2.0;
    const activeCurrent = wActive * Math.pow(elevationRatio, exponent);
    const wCurrentVal = wDead + activeCurrent;

    // Use active storage percentage for intuitive feedback since dead storage is non-releasable
    const activePercent = (activeCurrent / wActive) * 100;
    
    // Remaining available volume to Normal Water Level (Hdbt)
    const wRemaining = Math.max(0, wActive - activeCurrent);

    // Any reservoir with active season limitation (hControl < hdbt) has flood regulation capacity
    const hasFloodControl = (typeof wFlood === 'number' && wFlood > 0) || (hControl < hdbt);

    return {
      wCurrentVal,
      activeCurrent,
      activePercent,
      wRemaining,
      hasFloodControl
    };
  }, [selectedReservoir]);

  return (
    <div className="container">
      {/* 1. Header Area */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Droplet style={{ color: 'var(--color-primary)' }} />
            Giám sát Hồ Chứa Thủy Điện
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Dữ liệu vận hành thời gian thực & cảnh báo an toàn đón lũ Việt Nam
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            onClick={() => loadLatestLevels(true)} 
            disabled={refreshing}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            <RefreshCw className={refreshing ? "spin" : ""} style={{ width: '16px', height: '16px', transition: 'transform 0.5s ease' }} />
            {refreshing ? "Đang đồng bộ..." : "Đồng bộ dữ liệu"}
          </button>
        </div>
      </header>



      {/* 3. Global Stats Grid */}
      <section className="metrics-grid">
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
            Tổng lưu lượng nước về
            <ArrowDown style={{ color: 'var(--color-success)', width: '18px' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-success)' }}>
            {aggregates.totalInflow.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '400' }}>m³/s</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
            Tổng lưu lượng nước xả
            <ArrowUp style={{ color: 'var(--color-primary)', width: '18px' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-primary)' }}>
            {aggregates.totalOutflow.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '400' }}>m³/s</span>
          </div>
        </div>

        <div 
          className="glass-panel" 
          style={{ 
            padding: '20px', 
            cursor: 'pointer', 
            userSelect: 'none',
            border: specialFilter === 'discharge' ? '1px solid var(--color-info)' : '1px solid transparent',
            boxShadow: specialFilter === 'discharge' ? '0 0 15px rgba(14, 165, 233, 0.25)' : undefined,
            background: specialFilter === 'discharge' ? 'rgba(14, 165, 233, 0.03)' : undefined,
            transition: 'all 0.3s ease'
          }}
          onClick={() => setSpecialFilter(specialFilter === 'discharge' ? 'none' : 'discharge')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
            Số hồ đang xả lũ (qua tràn)
            <TrendingUp style={{ color: 'var(--color-info)', width: '18px' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
            {aggregates.dischargeCount} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>/ {waterLevels.length}</span>
          </div>
        </div>

        <div 
          className={`glass-panel ${aggregates.alertCount > 0 && specialFilter !== 'warning' ? 'pulse-warning-amber' : ''}`} 
          style={{ 
            padding: '20px', 
            cursor: 'pointer', 
            userSelect: 'none',
            borderTop: specialFilter === 'warning' ? '1px solid var(--color-warning)' : '1px solid transparent',
            borderRight: specialFilter === 'warning' ? '1px solid var(--color-warning)' : '1px solid transparent',
            borderBottom: specialFilter === 'warning' ? '1px solid var(--color-warning)' : '1px solid transparent',
            borderLeft: specialFilter === 'warning' 
              ? '1px solid var(--color-warning)' 
              : (aggregates.alertCount > 0 ? '4px solid var(--color-warning)' : '1px solid transparent'),
            boxShadow: specialFilter === 'warning' ? '0 0 15px rgba(245, 158, 11, 0.25)' : undefined,
            background: specialFilter === 'warning' ? 'rgba(245, 158, 11, 0.03)' : undefined,
            transition: 'all 0.3s ease'
          }}
          onClick={() => setSpecialFilter(specialFilter === 'warning' ? 'none' : 'warning')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
            Cảnh báo mức nước lũ
            <AlertTriangle style={{ color: aggregates.alertCount > 0 ? 'var(--color-warning)' : 'var(--text-muted)', width: '18px' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: aggregates.alertCount > 0 ? 'var(--color-warning)' : 'var(--text-primary)' }}>
            {aggregates.alertCount} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>hồ cần lưu ý</span>
          </div>
        </div>
      </section>

      {/* 4. Filters Bar */}
      <section className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexGrow: 1, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '240px', flexGrow: 1 }}>
            <Search style={{ position: 'absolute', left: '12px', top: '12px', width: '16px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Tìm tên hồ, lưu vực sông..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-control"
              style={{ width: '100%', paddingLeft: '36px' }}
            />
          </div>

          <select 
            value={selectedRegion} 
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="input-control font-sans"
            style={{ minWidth: '160px', cursor: 'pointer' }}
          >
            <option value="All">-- Tất cả vùng miền --</option>
            {regions.filter(r => r !== "All").map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select 
            value={selectedBasin} 
            onChange={(e) => setSelectedBasin(e.target.value)}
            className="input-control font-sans"
            style={{ minWidth: '180px', cursor: 'pointer' }}
          >
            <option value="All">-- Tất cả lưu vực --</option>
            {basins.filter(b => b !== "All").map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* View mode toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setViewMode("grid")}
            style={{ background: viewMode === "grid" ? 'rgba(255,255,255,0.08)' : 'none', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Dạng lưới"
          >
            <Grid style={{ width: '16px', height: '16px' }} />
          </button>
          <button 
            onClick={() => setViewMode("table")}
            style={{ background: viewMode === "table" ? 'rgba(255,255,255,0.08)' : 'none', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Dạng bảng"
          >
            <List style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      </section>

      {specialFilter !== "none" && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '24px', background: 'rgba(255, 255, 255, 0.03)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            Đang lọc: <strong>{specialFilter === 'discharge' ? 'Hồ đang mở cửa xả lũ qua tràn' : 'Hồ có mức nước cảnh báo nguy hiểm/tiệm cận'}</strong>. 
            <span style={{ color: 'var(--color-primary)', marginLeft: '6px' }}>
              (Đã tự động hiển thị toàn bộ 5 hồ chứa thuộc hệ thống bậc thang Sông Đà để giám sát liên hồ).
            </span>
          </span>
          <button 
            onClick={() => setSpecialFilter("none")} 
            style={{ background: 'rgba(255, 255, 255, 0.06)', border: 'none', borderRadius: '6px', padding: '6px 12px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500', transition: 'background 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
          >
            Xóa lọc <X style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      )}

      {/* 5. Main Content Area */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
          <RefreshCw className="spin" style={{ width: '36px', height: '36px', color: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Đang tải dữ liệu hồ chứa...</p>
        </div>
      ) : error ? (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', borderLeft: '4px solid var(--color-danger)' }}>
          <AlertTriangle style={{ color: 'var(--color-danger)', width: '48px', height: '48px', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Không thể tải dữ liệu</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{error}</p>
          <button onClick={() => loadLatestLevels()} className="btn-primary">Thử lại</button>
        </div>
      ) : filteredLevels.length === 0 ? (
        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Search style={{ width: '36px', height: '36px', margin: '0 auto 12px', opacity: 0.5 }} />
          <p>Không tìm thấy hồ thủy điện nào khớp với bộ lọc của bạn.</p>
        </div>
      ) : viewMode === "grid" ? (
        // Grid View
        <div className="reservoir-grid">
          {filteredLevels.map(item => {
            const hRange = item.hdbt - item.hc || 10;
            // Percent active storage calculation
            let percentFill = ((item.htl - item.hc) / hRange) * 100;
            percentFill = Math.max(0, Math.min(100, percentFill)); // clamp between 0 - 100

            // Controlled level position inside gauge percentage
            let percentControl = ((item.hControl - item.hc) / hRange) * 100;
            percentControl = Math.max(0, Math.min(100, percentControl));

            // Status Badge Color Class Mapping
            let fillClass = "gauge-fill-normal";
            let statusText = "Bình thường";
            let statusClass = "status-badge-normal";
            
            if (item.status === "dead") {
              fillClass = "gauge-fill-dead";
              statusText = "Dưới mực nước chết";
              statusClass = "status-badge-dead";
            } else if (item.status === "danger") {
              fillClass = "gauge-fill-danger";
              statusText = "Vượt kiểm soát lũ";
              statusClass = "status-badge-danger";
            } else if (item.status === "warning") {
              fillClass = "gauge-fill-warning";
              statusText = "Tiệm cận kiểm soát";
              statusClass = "status-badge-warning";
            }

            return (
              <div 
                key={item.name} 
                className="glass-card gauge-card"
                onClick={() => handleSelectReservoir(item)}
                style={{ cursor: 'pointer' }}
              >
                <div className="gauge-card-header">
                  <div>
                    <h3 className="reservoir-name">{item.name}</h3>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.riverBasin}</span>
                    </div>
                  </div>
                  <span className={`status-badge ${statusClass}`}>
                    {statusText}
                  </span>
                </div>

                <div className="gauge-body">
                  {/* Vertical Visual Gauge */}
                  <div className="gauge-visual">
                    <div 
                      className={`gauge-fill ${fillClass}`} 
                      style={{ height: `${percentFill}%` }}
                    />
                    {/* Controlled level marker */}
                    <div 
                      className="gauge-marker"
                      style={{ bottom: `${percentControl}%`, borderTopColor: 'var(--color-warning)' }}
                      data-label={`KL: ${item.hControl.toFixed(1)}m`}
                    />
                  </div>

                  {/* Level Metrics details */}
                  <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Nước thượng lưu:</span>
                      <strong style={{ color: item.status === 'danger' ? 'var(--color-danger)' : item.status === 'warning' ? 'var(--color-warning)' : 'var(--text-primary)' }}>
                        {item.htl.toFixed(2)} m
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                      <span className="tooltip-container" style={{ color: 'var(--text-secondary)' }}>
                        Mức kiểm soát lũ:
                        <span className="tooltip-box">
                          <h5>⚠️ Mức kiểm soát đón lũ ({item.activeSeasonName})</h5>
                          <p>Mực nước tối đa được phép duy trì theo Quy trình liên hồ chứa sông Hồng (QĐ 740 & QĐ 922/QĐ-TTg) nhằm dành ra dung tích đón lũ.</p>
                          <p><strong>Tại sao vượt quá không xả lũ?</strong> Hồ được phép trữ nước cao hơn giới hạn nếu dự báo 10 ngày tới không mưa lũ (vận hành linh hoạt), hoặc để trữ lũ bảo vệ hạ du theo Lệnh của Bộ Nông nghiệp & PTNT.</p>
                        </span>
                      </span>
                      <strong style={{ color: 'var(--color-warning)' }}>{item.hControl.toFixed(1)} m</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Mức dâng bình thường:</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{item.hdbt.toFixed(1)} m</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Mức nước chết:</span>
                      <span style={{ color: 'var(--text-muted)' }}>{item.hMinOp.toFixed(1)} m</span>
                    </div>
                  </div>
                </div>

                {/* Flow statistics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Lưu lượng về:</span>
                    <strong style={{ color: 'var(--color-success)', fontSize: '14px' }}>{item.qve.toLocaleString()} m³/s</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Tổng lượng xả:</span>
                    <strong style={{ color: item.q_x > 0 ? 'var(--color-primary)' : 'var(--text-secondary)', fontSize: '14px' }}>
                      {item.q_x.toLocaleString()} m³/s
                    </strong>
                  </div>
                </div>

                {/* Active spillway/gate discharge details */}
                {(item.qxt > 0 || item.ncxs > 0 || item.ncxm > 0) && (
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '8px 10px', 
                    borderRadius: '8px', 
                    background: 'rgba(239, 68, 68, 0.05)', 
                    border: '1px solid rgba(239, 68, 68, 0.15)', 
                    fontSize: '11px',
                    lineHeight: '1.4'
                  }}>
                    <span style={{ fontWeight: '600', color: 'var(--color-danger)', display: 'block', marginBottom: '2px' }}>
                      🌊 Đang mở cửa xả lũ:
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Lưu lượng xả tràn (Qxt):</span>
                      <strong style={{ color: 'var(--color-danger)' }}>{item.qxt.toLocaleString()} m³/s</strong>
                    </div>
                    {(item.ncxs > 0 || item.ncxm > 0) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        <span>Cửa xả mở (Sâu / Mặt):</span>
                        <strong style={{ color: 'var(--color-danger)' }}>{item.ncxs} sâu / {item.ncxm} mặt</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* Transition warning banner inside card */}
                {item.transitionAlert && (
                  <div style={{ 
                    background: 'rgba(245, 158, 11, 0.06)', 
                    border: '1px solid rgba(245, 158, 11, 0.15)', 
                    padding: '8px 10px', 
                    borderRadius: '8px', 
                    fontSize: '11px',
                    lineHeight: '1.4',
                    marginTop: '12px',
                    color: 'var(--text-primary)'
                  }}>
                    <span style={{ fontWeight: '600', color: 'var(--color-warning)', display: 'block', marginBottom: '2px' }}>
                      ⚠️ Sắp chuyển giai đoạn vận hành:
                    </span>
                    Trong <strong>{item.transitionAlert.daysRemaining} ngày</strong> nữa sẽ sang giai đoạn <strong>{item.transitionAlert.nextSeasonName}</strong>. 
                    {item.transitionAlert.nextHControl !== item.transitionAlert.currentHControl && (
                      <> Mức nước kiểm soát {item.transitionAlert.nextHControl < item.transitionAlert.currentHControl ? "giảm" : "tăng"} từ <strong>{item.transitionAlert.currentHControl.toFixed(1)}m</strong> {item.transitionAlert.nextHControl < item.transitionAlert.currentHControl ? "xuống" : "lên"} <strong>{item.transitionAlert.nextHControl.toFixed(1)}m</strong>.</>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>{item.activeSeasonName}</span>
                  <span>Đồng bộ: {item.sync_time || new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Table View
        <div className="table-container glass-panel">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Tên hồ</th>
                <th>Lưu vực</th>
                <th>Thời điểm</th>
                <th>Thượng lưu (Htl)</th>
                <th className="tooltip-container">
                  Kiểm soát (Hctl)
                  <span className="tooltip-box" style={{ width: '260px' }}>
                    <h5>⚠️ Mức kiểm soát đón lũ</h5>
                    <p>Mực nước tối đa được phép duy trì theo Quy trình liên hồ chứa sông Hồng (QĐ 740 & QĐ 922/QĐ-TTg) để dành dung tích trống cắt lũ.</p>
                    <p><strong>Lưu ý:</strong> Hồ có thể giữ nước cao hơn nếu dự báo không mưa lũ (vận hành linh hoạt) hoặc theo Lệnh cắt lũ hạ du của Bộ NN&PTNT.</p>
                  </span>
                </th>
                <th>Bình thường (Hdbt)</th>
                <th>Chết (Hc)</th>
                <th>Nước về (Qve)</th>
                <th>Tổng xả (Qx)</th>
                <th>Cửa xả (Sâu/Mặt)</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredLevels.map(item => (
                <tr 
                  key={item.name} 
                  onClick={() => handleSelectReservoir(item)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: '600' }}>{item.name}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{item.riverBasin}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {new Date(item.timestamp).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'})} {new Date(item.timestamp).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})}
                  </td>
                  <td style={{ fontWeight: '600', color: item.status === 'danger' ? 'var(--color-danger)' : item.status === 'warning' ? 'var(--color-warning)' : 'inherit' }}>
                    {item.htl.toFixed(2)} m
                  </td>
                  <td style={{ color: 'var(--color-warning)', fontWeight: '500' }}>{item.hControl.toFixed(1)} m</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{item.hdbt.toFixed(1)} m</td>
                  <td style={{ color: 'var(--text-muted)' }}>{item.hMinOp.toFixed(1)} m</td>
                  <td style={{ color: 'var(--color-success)', fontWeight: '500' }}>{item.qve.toLocaleString()}</td>
                  <td style={{ color: item.q_x > 0 ? 'var(--color-primary)' : 'var(--text-secondary)', fontWeight: '500' }}>{item.q_x.toLocaleString()}</td>
                  <td>{item.ncxs} / {item.ncxm}</td>
                  <td>
                    <span className={`status-badge ${
                      item.status === 'dead' ? 'status-badge-dead' :
                      item.status === 'danger' ? 'status-badge-danger' :
                      item.status === 'warning' ? 'status-badge-warning' : 'status-badge-normal'
                    }`}>
                      {item.status === 'dead' ? 'Chết' :
                       item.status === 'danger' ? 'Vượt lũ' :
                       item.status === 'warning' ? 'Tiệm cận' : 'Bình thường'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Detailed Side Panel (Drawer) Backdrop & Element */}
      <div 
        className={`drawer-backdrop ${selectedReservoir ? 'open' : ''}`} 
        onClick={handleCloseDrawer}
      />
      
      <div className={`drawer ${selectedReservoir ? 'open' : ''}`}>
        {selectedReservoir && (
          <>
            <div className="drawer-header">
              <div>
                <span style={{ fontSize: '11px', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
                  {selectedReservoir.region}
                </span>
                <h2 style={{ fontSize: '22px', color: 'var(--text-primary)', marginTop: '2px' }}>{selectedReservoir.name}</h2>
              </div>
              <button 
                onClick={handleCloseDrawer} 
                style={{ background: 'rgba(255,255,255,0.04)', border: 'none', padding: '6px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X style={{ width: '20px', height: '20px', color: 'var(--text-secondary)' }} />
              </button>
            </div>

            {/* Extreme Technical Limit Emergency Alert */}
            {selectedReservoir.hMaxTechnical && (selectedReservoir.hMaxTechnical - selectedReservoir.htl <= 1.5) && (
              <div 
                className="flash-red"
                style={{ 
                  border: '1px solid rgba(239, 68, 68, 0.4)', 
                  padding: '12px 14px', 
                  borderRadius: '8px', 
                  marginBottom: '20px', 
                  fontSize: '13px', 
                  color: 'var(--text-primary)', 
                  display: 'flex', 
                  gap: '8px' 
                }}
              >
                <AlertTriangle style={{ color: 'var(--color-danger)', flexShrink: 0, width: '18px', marginTop: '2px' }} />
                <div>
                  <strong style={{ color: 'var(--color-danger)' }}>🚨 CẢNH BÁO BÁO ĐỘNG ĐỎ KHẨN CẤP:</strong> 
                  <p style={{ marginTop: '4px', color: 'var(--text-primary)', fontWeight: '600', lineHeight: '1.4' }}>
                    Mực nước hiện tại ({selectedReservoir.htl.toFixed(2)}m) đã tiến sát hoặc vượt qua giới hạn kỹ thuật lũ kiểm tra ({selectedReservoir.hMaxTechnical.toFixed(1)}m)! Nguy cơ mất an toàn công trình cực kỳ cao.
                  </p>
                  {selectedReservoir.emergencyBreachNotes && (
                    <p style={{ marginTop: '8px', fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: '4px', borderLeft: '3px solid var(--color-danger)', color: 'rgba(255,255,255,0.9)', lineHeight: '1.4' }}>
                      <strong>Phương án xử lý khẩn cấp:</strong> {selectedReservoir.emergencyBreachNotes}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Transition Countdown in Drawer if active */}
            {selectedReservoir.transitionAlert && (
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '12px 14px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', color: 'var(--text-primary)', display: 'flex', gap: '8px' }}>
                <AlertTriangle style={{ color: 'var(--color-warning)', flexShrink: 0, width: '18px' }} />
                <div>
                  <strong>Sắp chuyển giai đoạn vận hành:</strong> 
                  <p style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                    Trong {selectedReservoir.transitionAlert.daysRemaining} ngày nữa sẽ sang giai đoạn <strong>{selectedReservoir.transitionAlert.nextSeasonName}</strong>. 
                    {selectedReservoir.transitionAlert.nextHControl !== selectedReservoir.transitionAlert.currentHControl && (
                      <> Mức nước kiểm soát {selectedReservoir.transitionAlert.nextHControl < selectedReservoir.transitionAlert.currentHControl ? "giảm" : "tăng"} từ <strong>{selectedReservoir.transitionAlert.currentHControl.toFixed(1)}m</strong> {selectedReservoir.transitionAlert.nextHControl < selectedReservoir.transitionAlert.currentHControl ? "xuống" : "lên"} <strong>{selectedReservoir.transitionAlert.nextHControl.toFixed(1)}m</strong>.</>
                    )}
                  </p>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Detailed metrics grid */}
              <div>
                <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '10px' }}>Thông số vận hành hiện tại</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* Row 1: Current water level (Full width) */}
                  <div className="glass-panel" style={{ padding: '12px 16px', gridColumn: '1 / span 2', background: 'rgba(255,255,255,0.015)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Mực nước hồ hiện tại (Htl)</span>
                      <strong style={{ fontSize: '20px', color: selectedReservoir.status === 'danger' ? 'var(--color-danger)' : selectedReservoir.status === 'warning' ? 'var(--color-warning)' : 'var(--text-primary)', marginTop: '4px', display: 'block' }}>
                        {selectedReservoir.htl.toFixed(2)} m
                      </strong>
                    </div>
                    
                    <span className={`status-badge ${
                      selectedReservoir.status === 'dead' ? 'status-badge-dead' :
                      selectedReservoir.status === 'danger' ? 'status-badge-danger' :
                      selectedReservoir.status === 'warning' ? 'status-badge-warning' : 'status-badge-normal'
                    }`}>
                      {selectedReservoir.status === 'dead' ? 'Mực nước chết' :
                       selectedReservoir.status === 'danger' ? 'Vượt giới hạn lũ' :
                       selectedReservoir.status === 'warning' ? 'Tiệm cận giới hạn' : 'Vận hành bình thường'}
                    </span>
                  </div>

                  {/* Row 2: Flood Season Control (Left) & Check Flood Limit (Right) */}
                  <div className="glass-panel tooltip-container" style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', cursor: 'help' }}>
                     <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Giới hạn lũ (Hcontrol)</span>
                     <strong style={{ fontSize: '16px', color: 'var(--color-warning)', marginTop: '4px', display: 'block' }}>{selectedReservoir.hControl.toFixed(1)} m</strong>
                     <span className="tooltip-box" style={{ top: '105%' }}>
                       <h5>⚠️ Mức kiểm soát đón lũ ({selectedReservoir.activeSeasonName})</h5>
                       <p>Mực nước lớn nhất được phép duy trì trong giai đoạn lũ hiện tại theo Quy trình liên hồ chứa sông Hồng để giữ lại khoảng trống phòng lũ.</p>
                       <p><strong>Lưu ý:</strong> Có thể tích nước vượt giới hạn nếu dự báo 10 ngày tới không mưa lũ, hoặc để cắt lũ bảo vệ hạ du theo Lệnh bằng văn bản của Bộ NN&PTNT.</p>
                     </span>
                  </div>

                  <div className="glass-panel tooltip-container" style={{ padding: '12px', background: selectedReservoir.hMaxTechnical && (selectedReservoir.hMaxTechnical - selectedReservoir.htl <= 1.5) ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.01)', border: selectedReservoir.hMaxTechnical && (selectedReservoir.hMaxTechnical - selectedReservoir.htl <= 1.5) ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)', cursor: 'help' }}>
                     <span style={{ fontSize: '11px', color: selectedReservoir.hMaxTechnical && (selectedReservoir.hMaxTechnical - selectedReservoir.htl <= 1.5) ? 'var(--color-danger)' : 'var(--text-secondary)', display: 'block' }}>Lũ kiểm tra (Hlkt)</span>
                     <strong style={{ fontSize: '16px', color: 'var(--color-danger)', marginTop: '4px', display: 'block' }}>
                       {selectedReservoir.hMaxTechnical ? `${selectedReservoir.hMaxTechnical.toFixed(1)} m` : "Không có số liệu"}
                     </strong>
                     <span className="tooltip-box" style={{ top: '105%' }}>
                       <h5>🚨 Mực nước lũ kiểm tra (Check Flood Level)</h5>
                       <p>Ngưỡng giới hạn kỹ thuật tối đa của công trình. Vượt quá mực nước này sẽ gây mất an toàn đập chính, có nguy cơ xảy ra sự cố vỡ đập thảm họa.</p>
                       <p>Khi nước tiệm cận ngưỡng này, bắt buộc phải kích hoạt các phương án phá đập phụ sự cố hoặc xả lũ khẩn cấp tối đa để cứu đập chính.</p>
                     </span>
                  </div>

                  {/* Row 3: Normal Water Level (Left) & Dead Water Level (Right) */}
                  <div className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.01)' }}>
                     <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Nước dâng BT (Hdbt)</span>
                     <strong style={{ fontSize: '16px', marginTop: '4px', display: 'block' }}>{selectedReservoir.hdbt.toFixed(1)} m</strong>
                  </div>

                  <div className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.01)' }}>
                     <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Mực nước chết (Hc)</span>
                     <strong style={{ fontSize: '16px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>{selectedReservoir.hMinOp.toFixed(1)} m</strong>
                  </div>
                </div>
              </div>

              {/* Reservoir Capacity & Volume Metrics */}
              <div>
                <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '10px' }}>Dung tích hồ chứa</h4>
                
                {selectedReservoir.wTotal !== null ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {capacityInfo && (
                      <div className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.01)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Dung tích hữu ích hiện tại (Ước tính)</span>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
                          <strong style={{ fontSize: '18px', color: 'var(--color-primary)' }}>
                            {capacityInfo.activeCurrent.toFixed(1)} triệu m³
                          </strong>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            ({capacityInfo.activePercent.toFixed(1)}% dung tích hữu ích)
                          </span>
                        </div>
                        
                        {/* Visual progress bar based on ACTIVE capacity */}
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                          <div 
                            style={{ 
                              width: `${capacityInfo.activePercent}%`, 
                              height: '100%', 
                              background: 'var(--color-primary)', 
                              borderRadius: '3px',
                              transition: 'width 0.5s ease'
                            }} 
                          />
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="glass-panel" style={{ padding: '10px', background: 'rgba(255,255,255,0.01)', fontSize: '12px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Tổng dung tích hiện tại</span>
                        <strong style={{ fontSize: '14px', color: 'var(--color-info)' }}>{capacityInfo?.wCurrentVal.toLocaleString(undefined, {maximumFractionDigits: 0})} triệu m³</strong>
                      </div>
                      <div className="glass-panel" style={{ padding: '10px', background: 'rgba(255,255,255,0.01)', fontSize: '12px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Dung tích toàn bộ (thiết kế)</span>
                        <strong style={{ fontSize: '14px' }}>{selectedReservoir.wTotal?.toLocaleString()} triệu m³</strong>
                      </div>
                      <div className="glass-panel" style={{ padding: '10px', background: 'rgba(255,255,255,0.01)', fontSize: '12px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Dung tích hữu ích (thiết kế)</span>
                        <strong style={{ fontSize: '14px' }}>{selectedReservoir.wActive?.toLocaleString()} triệu m³</strong>
                      </div>
                      <div className="glass-panel" style={{ padding: '10px', background: 'rgba(255,255,255,0.01)', fontSize: '12px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Dung tích chết (thiết kế)</span>
                        <strong style={{ fontSize: '14px' }}>{selectedReservoir.wDead?.toLocaleString()} triệu m³</strong>
                      </div>
                    </div>

                    {/* Flood Control Capability */}
                    {capacityInfo && capacityInfo.hasFloodControl ? (
                      <div className="glass-panel tooltip-container" style={{ padding: '12px', background: 'rgba(14, 165, 233, 0.03)', border: '1px solid rgba(14, 165, 233, 0.1)', cursor: 'help' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🛡️ Dung tích phòng lũ / Điều tiết lũ
                        </span>
                        {selectedReservoir.wFlood !== null && selectedReservoir.wFlood > 0 ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Dung tích cắt lũ thiết kế:</span>
                            <strong style={{ fontSize: '14px' }}>{selectedReservoir.wFlood?.toLocaleString()} triệu m³</strong>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Hình thức phòng lũ:</span>
                            <strong style={{ fontSize: '12px', color: 'var(--color-warning)' }}>Điều tiết theo mực nước giới hạn</strong>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Khoảng trống trữ lũ khả dụng:</span>
                          <strong style={{ fontSize: '14px', color: 'var(--color-success)' }}>
                            {capacityInfo.wRemaining.toLocaleString(undefined, {maximumFractionDigits: 0})} triệu m³
                          </strong>
                        </div>
                        <span className="tooltip-box" style={{ top: '105%' }}>
                          <h5>🛡️ Dung tích phòng lũ (Flood Control Capacity)</h5>
                          <p><strong>Dung tích cắt lũ thiết kế:</strong> Dung tích trống quy định giữa mực nước kiểm soát lũ và mực nước dâng bình thường để hứng và cắt các đợt lũ lớn bảo vệ hạ du.</p>
                          <p><strong>Khoảng trống trữ lũ khả dụng:</strong> Dung tích trống còn lại của hồ từ mực nước hiện tại đến mực nước dâng bình thường, cho thấy khả năng hấp thụ thêm nước lũ ngay lúc này.</p>
                        </span>
                      </div>
                    ) : (
                      <div className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.05)', textAlign: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          ℹ️ Không có khả năng cắt lũ (hồ chứa nhỏ hoặc hồ điều tiết ngày)
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.05)', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      ℹ️ Không có thông số dung tích thiết kế cho hồ chứa này
                    </span>
                  </div>
                )}
              </div>

              {/* Flow metrics */}
              <div>
                <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '10px' }}>Lưu lượng dòng chảy</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.01)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Nước chảy về hồ (Qve)</span>
                    <strong style={{ fontSize: '18px', color: 'var(--color-success)' }}>{selectedReservoir.qve.toLocaleString()} m³/s</strong>
                  </div>
                  <div className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.01)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Tổng lượng xả (Qx)</span>
                    <strong style={{ fontSize: '18px', color: selectedReservoir.q_x > 0 ? 'var(--color-primary)' : 'inherit' }}>
                      {selectedReservoir.q_x.toLocaleString()} m³/s
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Xả qua đập tràn (Qxt):</span>
                    <strong>{selectedReservoir.qxt.toLocaleString()} m³/s</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Xả qua nhà máy (Qxm):</span>
                    <strong>{selectedReservoir.qxm.toLocaleString()} m³/s</strong>
                  </div>
                </div>
              </div>

              {/* Hydro Power Generation Estimation */}
              {selectedReservoir.tailraceElev && (
                <div>
                  <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '10px' }}>Ước tính công suất phát điện</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.01)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Công suất phát hiện tại</span>
                      <strong style={{ fontSize: '18px', color: selectedReservoir.estimatedPowerMW > 0 ? 'var(--color-info)' : 'var(--text-muted)' }}>
                        {selectedReservoir.estimatedPowerMW > 0 ? `${selectedReservoir.estimatedPowerMW.toLocaleString()} MW` : "0 MW (Dừng phát)"}
                      </strong>
                    </div>
                    <div className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.01)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Sản lượng mỗi giờ</span>
                      <strong style={{ fontSize: '18px', color: selectedReservoir.estimatedEnergyKwh > 0 ? 'var(--color-info)' : 'var(--text-muted)' }}>
                        {selectedReservoir.estimatedEnergyKwh > 0 ? `${selectedReservoir.estimatedEnergyKwh.toLocaleString()} kWh` : "0 kWh"}
                      </strong>
                    </div>
                  </div>
                  <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic', lineHeight: '1.4' }}>
                     * Ước lượng vật lý theo lưu lượng qua nhà máy {selectedReservoir.qxm.toLocaleString()} m³/s, hiệu suất η = 85%, mực nước hạ lưu trung bình {selectedReservoir.tailraceElev}m và công suất lắp máy tối đa {selectedReservoir.installedCapacity}MW.
                  </p>
                </div>
              )}

              {/* Spillway Gates */}
              <div>
                <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '10px' }}>Trạng thái cửa xả lũ</h4>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="glass-panel" style={{ padding: '12px', flexGrow: 1, textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Số cửa xả sâu</span>
                    <strong style={{ fontSize: '18px', color: selectedReservoir.ncxs > 0 ? 'var(--color-danger)' : 'inherit' }}>{selectedReservoir.ncxs}</strong>
                  </div>
                  <div className="glass-panel" style={{ padding: '12px', flexGrow: 1, textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Số cửa xả mặt</span>
                    <strong style={{ fontSize: '18px', color: selectedReservoir.ncxm > 0 ? 'var(--color-danger)' : 'inherit' }}>{selectedReservoir.ncxm}</strong>
                  </div>
                </div>
              </div>

              {/* 72 Hours Trend Chart */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Mực nước 24h - 72h qua</h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mực nước (m)</span>
                </div>

                <div className="glass-panel" style={{ padding: '12px', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {historyLoading ? (
                    <RefreshCw className="spin" style={{ width: '24px', height: '24px', color: 'var(--color-primary)' }} />
                  ) : history.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Không tìm thấy dữ liệu lịch sử</span>
                  ) : chartProps ? (
                    // Custom SVG Sparkline
                    <div style={{ width: '100%' }}>
                      <svg viewBox={`0 0 ${chartProps.width} ${chartProps.height}`} style={{ width: '100%', height: 'auto' }}>
                        <defs>
                          <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.00" />
                          </linearGradient>
                        </defs>
                        
                        {/* Y-Axis Grid Lines */}
                        <line x1={chartProps.paddingLeft} y1={chartProps.paddingTop} x2={chartProps.width - chartProps.paddingRight} y2={chartProps.paddingTop} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
                        <line x1={chartProps.paddingLeft} y1={chartProps.height - chartProps.paddingBottom} x2={chartProps.width - chartProps.paddingRight} y2={chartProps.height - chartProps.paddingBottom} stroke="rgba(255,255,255,0.05)" />
                        
                        {/* Limit line (Hcontrol) if in range */}
                        {/* Y Labels */}
                        <text x={chartProps.paddingLeft - 8} y={chartProps.paddingTop + 4} fill="var(--text-muted)" fontSize="10" textAnchor="end">{chartProps.yMax}m</text>
                        <text x={chartProps.paddingLeft - 8} y={chartProps.height - chartProps.paddingBottom + 3} fill="var(--text-muted)" fontSize="10" textAnchor="end">{chartProps.yMin}m</text>

                        {/* Chart Area Gradient Fill */}
                        <path d={chartProps.areaPath} fill="url(#chart-grad)" />

                        {/* Chart Stroke Line */}
                        <path d={chartProps.linePath} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Data point indicators */}
                        {chartProps.points.map((p, i) => {
                          // Show dots only on endpoints or every few points for readability
                          const shouldDrawDot = i === 0 || i === chartProps.points.length - 1 || (i % 6 === 0);
                          if (!shouldDrawDot) return null;
                          return (
                            <g key={i}>
                              <circle cx={p.x} cy={p.y} r="3" fill="var(--bg-surface-solid)" stroke="var(--color-primary)" strokeWidth="1.5" />
                            </g>
                          );
                        })}

                        {/* Date X Labels (First and last) */}
                        {chartProps.points.length > 0 && (
                          <>
                            <text x={chartProps.paddingLeft} y={chartProps.height - 8} fill="var(--text-muted)" fontSize="9" textAnchor="start">
                              {new Date(chartProps.points[0].time).toLocaleDateString('vi-VN', {month: '2-digit', day: '2-digit'})} {new Date(chartProps.points[0].time).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                            </text>
                            <text x={chartProps.width - chartProps.paddingRight} y={chartProps.height - 8} fill="var(--text-muted)" fontSize="9" textAnchor="end">
                              {new Date(chartProps.points[chartProps.points.length-1].time).toLocaleDateString('vi-VN', {month: '2-digit', day: '2-digit'})} {new Date(chartProps.points[chartProps.points.length-1].time).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                            </text>
                          </>
                        )}

                        {/* Hover elements */}
                        {hoveredPoint && (
                          <g pointerEvents="none">
                            {/* Vertical tracking dashed line */}
                            <line 
                              x1={hoveredPoint.x} 
                              y1={chartProps.paddingTop} 
                              x2={hoveredPoint.x} 
                              y2={chartProps.height - chartProps.paddingBottom} 
                              stroke="var(--color-primary)" 
                              strokeWidth="1" 
                              strokeDasharray="3" 
                            />
                            {/* Highlight circle on data point */}
                            <circle 
                              cx={hoveredPoint.x} 
                              cy={hoveredPoint.y} 
                              r="5" 
                              fill="var(--color-primary)" 
                              stroke="var(--bg-surface-solid)" 
                              strokeWidth="2" 
                            />
                            {/* Tooltip Card */}
                            <rect
                              x={Math.max(chartProps.paddingLeft, Math.min(hoveredPoint.x - 70, chartProps.width - chartProps.paddingRight - 140))}
                              y={Math.max(5, hoveredPoint.y - 45)}
                              width="140"
                              height="35"
                              rx="6"
                              fill="rgba(15, 23, 42, 0.95)"
                              stroke="rgba(14, 165, 233, 0.2)"
                              strokeWidth="1"
                            />
                            {/* Tooltip Time */}
                            <text
                              x={Math.max(chartProps.paddingLeft + 70, Math.min(hoveredPoint.x, chartProps.width - chartProps.paddingRight - 70))}
                              y={Math.max(16, hoveredPoint.y - 34)}
                              fill="var(--text-muted)"
                              fontSize="8"
                              fontWeight="500"
                              textAnchor="middle"
                            >
                              {new Date(hoveredPoint.time).toLocaleDateString('vi-VN', {month: '2-digit', day: '2-digit'})} {new Date(hoveredPoint.time).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                            </text>
                            {/* Tooltip Value */}
                            <text
                              x={Math.max(chartProps.paddingLeft + 70, Math.min(hoveredPoint.x, chartProps.width - chartProps.paddingRight - 70))}
                              y={Math.max(28, hoveredPoint.y - 22)}
                              fill="var(--color-primary)"
                              fontSize="10"
                              fontWeight="700"
                              textAnchor="middle"
                            >
                              Htl: {hoveredPoint.htl.toFixed(2)} m
                            </text>
                          </g>
                        )}

                        {/* Interactive overlay target */}
                        <rect
                          x={chartProps.paddingLeft}
                          y={chartProps.paddingTop}
                          width={chartProps.width - chartProps.paddingLeft - chartProps.paddingRight}
                          height={chartProps.height - chartProps.paddingTop - chartProps.paddingBottom}
                          fill="transparent"
                          onMouseMove={handleChartMouseMove}
                          onMouseLeave={() => setHoveredPoint(null)}
                          style={{ cursor: 'crosshair' }}
                        />
                      </svg>
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Database style={{ width: '12px' }} />
                  Dữ liệu được lưu trữ tự động trong cơ sở dữ liệu.
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar style={{ width: '12px' }} />
                  Giai đoạn vận hành quy định: {selectedReservoir.activeSeasonName}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
