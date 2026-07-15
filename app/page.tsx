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
  const [viewMode, setViewMode] = useState<"grid" | "table" | "cascade">("grid");
  const [selectedCascade, setSelectedCascade] = useState<"song_da" | "se_san" | "dong_nai">("song_da");
  const [cascadeHistory, setCascadeHistory] = useState<Record<string, HistoryPoint[]>>({});
  const [cascadeLoading, setCascadeLoading] = useState(false);
  const [specialFilter, setSpecialFilter] = useState<"none" | "discharge" | "warning" | "low_level">("none");

  // Selected Reservoir Detail Drawer
  const [selectedReservoir, setSelectedReservoir] = useState<ReservoirData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [cascadeHoverIndex, setCascadeHoverIndex] = useState<number | null>(null);
  const [historyRange, setHistoryRange] = useState<"3d" | "7d" | "15d" | "30d" | "1y">("3d");

  // Overrides for river levels
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [editingStation, setEditingStation] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [savingOverride, setSavingOverride] = useState(false);

  const handleSaveOverride = async (stationName: string) => {
    setSavingOverride(true);
    try {
      const res = await fetch('/api/river-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationName, level: editValue })
      });
      if (res.ok) {
        const result = await res.json();
        setOverrides(prev => {
          const next = { ...prev };
          if (result.level === null) {
            delete next[stationName];
          } else {
            next[stationName] = result.level;
          }
          return next;
        });
        setEditingStation(null);
      } else {
        alert("Lỗi khi lưu mực nước hiệu chỉnh");
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi kết nối");
    } finally {
      setSavingOverride(false);
    }
  };

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
        if (result.overrides) {
          setOverrides(result.overrides);
        }
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

  // Cascade definitions and metadata
  const CASCADES = useMemo(() => ({
    song_da: {
      title: "Bậc thang thủy điện Sông Đà",
      description: "Hệ thống bậc thang thủy điện lớn nhất Việt Nam, điều tiết lưu lượng nước từ thượng lưu về hồ chứa Hòa Bình trước khi đổ vào hạ lưu sông Hồng.",
      reservoirs: ["Lai Châu", "Sơn La", "Hòa Bình"],
      connections: [
        { from: "Lai Châu", to: "Sơn La", desc: "Nước xả từ Lai Châu chảy về hồ chứa Sơn La (~150km)" },
        { from: "Sơn La", to: "Hòa Bình", desc: "Nước xả từ Sơn La chảy về hồ chứa Hòa Bình (~200km)" },
        { from: "Hòa Bình", to: "Hạ du", desc: "Xả nước xuống sông Đà hạ lưu để điều tiết lũ cho đồng bằng Bắc Bộ" }
      ]
    },
    se_san: {
      title: "Bậc thang thủy điện Sông Sê San",
      description: "Chuỗi hồ chứa liên hoàn trên dòng Sê San tại Tây Nguyên, điều tiết nguồn nước phát điện trước khi chảy sang Campuchia.",
      reservoirs: ["Ialy", "Sê San 3", "Sê San 3A", "Sê San 4"],
      connections: [
        { from: "Ialy", to: "Sê San 3", desc: "Nước xả chảy trực tiếp xuống hồ chứa Sê San 3" },
        { from: "Sê San 3", to: "Sê San 3A", desc: "Nước xả chảy trực tiếp xuống hồ chứa Sê San 3A" },
        { from: "Sê San 3A", to: "Sê San 4", desc: "Nước xả chảy trực tiếp xuống hồ chứa Sê San 4" },
        { from: "Sê San 4", to: "Hạ du", desc: "Xả nước đổ vào hạ du sông Sê San chảy sang địa phận Campuchia" }
      ]
    },
    dong_nai: {
      title: "Bậc thang thủy điện Sông Đồng Nai",
      description: "Hệ thống liên hồ chứa điều tiết nước phát điện và cấp nước sinh hoạt, nông nghiệp cho vùng Đông Nam Bộ.",
      reservoirs: ["Đồng Nai 3", "Đồng Nai 4", "Trị An"],
      connections: [
        { from: "Đồng Nai 3", to: "Đồng Nai 4", desc: "Nước xả chảy xuống hồ chứa Đồng Nai 4" },
        { from: "Đồng Nai 4", to: "Trị An", desc: "Nước chảy qua phụ lưu tự do xuống hồ chứa Trị An" },
        { from: "Trị An", to: "Hạ du", desc: "Xả nước cấp nước sinh hoạt và đẩy mặn cho TP.HCM và các tỉnh lân cận" }
      ]
    }
  }), []);

  // Compute total inflow/outflow metrics for the selected cascade
  const cascadeStats = useMemo(() => {
    const reservoirNames = CASCADES[selectedCascade]?.reservoirs || [];
    let totalQve = 0;
    let totalQx = 0;
    let totalQxt = 0;
    let totalWastedPowerMW = 0;
    
    reservoirNames.forEach(name => {
      const item = waterLevels.find(w => w.name === name);
      if (item) {
        totalQve += item.qve || 0;
        totalQx += item.q_x || 0;
        totalQxt += item.qxt || 0;
        
        // Sum potential wasted power for reservoirs with tailraceElev
        if (item.qxt > 0 && item.tailraceElev) {
          const head = item.htl - item.tailraceElev;
          if (head > 0) {
            const powerKw = 0.85 * 9.81 * item.qxt * head;
            totalWastedPowerMW += powerKw / 1000;
          }
        }
      }
    });
    
    const totalWastedVolumeM3PerHour = totalQxt * 3600;
    const totalWastedMillionM3PerHour = totalWastedVolumeM3PerHour / 1000000;
    
    return { totalQve, totalQx, totalQxt, totalWastedPowerMW, totalWastedMillionM3PerHour };
  }, [selectedCascade, waterLevels, CASCADES]);

  // Compute accumulated metrics from history data over the selected timeframe
  const cascadeHistoryStats = useMemo(() => {
    const reservoirNames = CASCADES[selectedCascade]?.reservoirs || [];
    let accumulatedWastedVolumeM3 = 0;
    let accumulatedWastedEnergyMWh = 0;
    
    reservoirNames.forEach(name => {
      const historyData = cascadeHistory[name] || [];
      const item = waterLevels.find(w => w.name === name);
      const tailraceElev = item?.tailraceElev || null;
      
      historyData.forEach(pt => {
        const qxt = Number(pt.qxt) || 0;
        const htl = Number(pt.htl) || 0;
        
        if (qxt > 0) {
          accumulatedWastedVolumeM3 += qxt * 3600; // 1 hour of flow in m3
          
          if (tailraceElev) {
            const head = htl - tailraceElev;
            if (head > 0) {
              const powerKw = 0.85 * 9.81 * qxt * head;
              accumulatedWastedEnergyMWh += powerKw / 1000; // 1 hour of MW = 1 MWh
            }
          }
        }
      });
    });
    
    const accumulatedWastedMillionM3 = accumulatedWastedVolumeM3 / 1000000;
    
    return {
      accumulatedWastedMillionM3,
      accumulatedWastedEnergyMWh
    };
  }, [selectedCascade, cascadeHistory, CASCADES]);

  const loadCascadeHistories = async (cascadeKey: keyof typeof CASCADES, range = historyRange) => {
    setCascadeLoading(true);
    try {
      const resList = CASCADES[cascadeKey].reservoirs;
      const promises = resList.map(async (name) => {
        const currentItem = waterLevels.find(w => w.name === name);
        const currentHtl = currentItem ? currentItem.htl : 0;
        const res = await fetch(`/api/history?reservoir=${encodeURIComponent(name)}&current=${currentHtl}&range=${range}&t=${Date.now()}`);
        if (!res.ok) throw new Error(`Lỗi tải lịch sử hồ ${name}`);
        const result = await res.json();
        return { name, data: result.success ? result.data : [] };
      });
      const results = await Promise.all(promises);
      const newHistoryMap: Record<string, HistoryPoint[]> = {};
      results.forEach(r => {
        newHistoryMap[r.name] = r.data;
      });
      setCascadeHistory(newHistoryMap);
    } catch (err) {
      console.error(err);
    } finally {
      setCascadeLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === "cascade" && waterLevels.length > 0) {
      loadCascadeHistories(selectedCascade, historyRange);
    }
  }, [viewMode, selectedCascade, historyRange, waterLevels]);

  // Fetch history for detailed drawer
  const fetchReservoirHistory = async (reservoirName: string, currentHtl: number, rangeStr = historyRange) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/history?reservoir=${encodeURIComponent(reservoirName)}&current=${currentHtl}&range=${rangeStr}&t=${Date.now()}`);
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

  const handleRangeChange = (range: "3d" | "7d" | "15d" | "30d" | "1y") => {
    setHistoryRange(range);
    if (selectedReservoir) {
      setHistory([]);
      fetchReservoirHistory(selectedReservoir.name, selectedReservoir.htl, range);
    }
  };

  const handleChartMouseMove = (e: React.MouseEvent<SVGRectElement>, chartWidth = 420) => {
    if (history.length === 0) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * chartWidth;
    
    let closestIdx = 0;
    const paddingLeft = chartWidth === 420 ? 45 : 50;
    const paddingRight = 15;
    const chartAreaWidth = chartWidth - paddingLeft - paddingRight;
    
    let minDiff = Infinity;
    for (let i = 0; i < history.length; i++) {
      const ptX = paddingLeft + (i / (history.length - 1)) * chartAreaWidth;
      const diff = Math.abs(ptX - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    
    setHoveredIndex(closestIdx);
  };

  const handleChartMouseLeave = () => {
    setHoveredIndex(null);
  };

  const handleCascadeMouseMove = (e: React.MouseEvent<SVGRectElement>, chartWidth = 360, dataLength = 0) => {
    if (dataLength <= 1) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    
    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * chartWidth;
    
    const paddingLeft = 40;
    const paddingRight = 10;
    const chartAreaWidth = chartWidth - paddingLeft - paddingRight;
    
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < dataLength; i++) {
      const ptX = paddingLeft + (i / (dataLength - 1)) * chartAreaWidth;
      const diff = Math.abs(ptX - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    
    setCascadeHoverIndex(closestIdx);
  };

  const handleCascadeMouseLeave = () => {
    setCascadeHoverIndex(null);
  };

  const handleSelectReservoir = (res: ReservoirData) => {
    setSelectedReservoir(res);
    setHistory([]);
    setHoveredIndex(null); // clear hover state
    fetchReservoirHistory(res.name, res.htl, historyRange);
  };

  const handleCloseDrawer = () => {
    setSelectedReservoir(null);
    setHistory([]);
    setHoveredIndex(null); // clear hover state
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
      if (specialFilter === "low_level") {
        const isPondage = (r.hdbt - r.hc) < 3.0;
        return isPondage ? (r.htl <= r.hc + 0.05) : (r.htl <= (r.hc + 0.15 * (r.hdbt - r.hc)));
      }
      return true;
    });

    // 3. Check if any matches belong to "Sông Đà"
    const hasSongDaMatch = baseMatched.some(r => r.riverBasin === "Sông Đà");

    // 4. Return union: base matches + all other "Sông Đà" reservoirs in the filtered set
    return baseList.filter(r => {
      let isBaseMatch = false;
      if (specialFilter === "discharge") isBaseMatch = r.qxt > 0;
      else if (specialFilter === "warning") isBaseMatch = r.status === "danger" || r.status === "warning";
      else if (specialFilter === "low_level") {
        const isPondage = (r.hdbt - r.hc) < 3.0;
        isBaseMatch = isPondage ? (r.htl <= r.hc + 0.05) : (r.htl <= (r.hc + 0.15 * (r.hdbt - r.hc)));
      }

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
    let lowLevelCount = 0;

    waterLevels.forEach(r => {
      totalInflow += r.qve;
      totalOutflow += r.q_x;
      if (r.qxt > 0) dischargeCount++;
      if (r.status === "danger" || r.status === "warning") alertCount++;
      
      const isPondage = (r.hdbt - r.hc) < 3.0;
      const isLow = isPondage ? (r.htl <= r.hc + 0.05) : (r.htl <= (r.hc + 0.15 * (r.hdbt - r.hc)));
      if (isLow) lowLevelCount++;
    });

    return {
      totalInflow: Math.round(totalInflow),
      totalOutflow: Math.round(totalOutflow),
      dischargeCount,
      alertCount,
      lowLevelCount
    };
  }, [waterLevels]);

  // Find reservoirs with active upcoming seasonal transition warnings (within 7 days)
  const transitionAlerts = useMemo(() => {
    return waterLevels.filter(r => r.transitionAlert !== null);
  }, [waterLevels]);

  // Custom SVG Line Chart coordinates calculations
  const chartProps = useMemo(() => {
    if (history.length === 0 || !selectedReservoir) return null;

    const width = 420;
    const height = 180;
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 25;

    const htls = history.map(h => h.htl);
    const minH = Math.min(...htls);
    const maxH = Math.max(...htls);
    let hRange = maxH - minH;
    
    // Ensure chart has a minimum vertical scale range of 0.5 meters to prevent micro-fluctuations (noise) from looking like flood waves
    if (hRange < 0.5) {
      hRange = 0.5;
    }
    
    const avg = (minH + maxH) / 2;
    const yMin = avg - hRange * 0.55;
    const yMax = avg + hRange * 0.55;
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

    // Calculate position for the hControl line if it fits on screen
    const hControl = selectedReservoir.hControl;
    let hControlY = null;
    if (hControl >= yMin && hControl <= yMax) {
      hControlY = height - paddingBottom - ((hControl - yMin) / yRange) * (height - paddingTop - paddingBottom);
    }

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
      yMin: yMin.toFixed(2),
      yMax: yMax.toFixed(2),
      hControlY
    };
  }, [history, selectedReservoir]);

  // Custom SVG Flow Chart coordinates calculations (Inflow vs Outflow)
  const flowChartProps = useMemo(() => {
    if (history.length === 0 || !selectedReservoir) return null;

    const width = 420;
    const height = 150;
    const paddingLeft = 50;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 25;

    const inflows = history.map(h => h.qve || 0);
    const outflows = history.map(h => h.q_x || 0);
    const allFlows = [...inflows, ...outflows];
    const minF = Math.min(...allFlows);
    const maxF = Math.max(...allFlows);
    let fRange = maxF - minF;
    if (fRange < 100) fRange = 100;

    const yMin = Math.max(0, minF - fRange * 0.1);
    const yMax = maxF + fRange * 0.1;
    const yRange = yMax - yMin;

    const points = history.map((pt, idx) => {
      const x = paddingLeft + (idx / (history.length - 1)) * (width - paddingLeft - paddingRight);
      const yOutflow = height - paddingBottom - (((pt.q_x || 0) - yMin) / yRange) * (height - paddingTop - paddingBottom);
      const yInflow = height - paddingBottom - (((pt.qve || 0) - yMin) / yRange) * (height - paddingTop - paddingBottom);
      return { x, yOutflow, yInflow, q_x: pt.q_x || 0, qve: pt.qve || 0, time: pt.timestamp };
    });

    // Outflow SVG path
    const outflowLinePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yOutflow}`).join(' ');
    const outflowAreaPath = `${outflowLinePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

    // Inflow SVG path
    const inflowLinePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yInflow}`).join(' ');

    return {
      width,
      height,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      points,
      outflowLinePath,
      outflowAreaPath,
      inflowLinePath,
      yMin: Math.round(yMin),
      yMax: Math.round(yMax),
    };
  }, [history, selectedReservoir]);

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

  const downstreamInfo = useMemo(() => {
    if (!selectedReservoir) return null;
    
    const name = selectedReservoir.name;
    let stationName = "";
    let riverName = "";
    let bd1 = 0;
    let bd2 = 0;
    let bd3 = 0;
    let currentLevel = 0;
    let isRedRiverDelta = false;
    
    // Sum Qx for Sông Hồng basin
    const q_hb = waterLevels.find(r => r.name === "Hòa Bình")?.q_x || 0;
    const q_tq = waterLevels.find(r => r.name === "Tuyên Quang")?.q_x || 0;
    const q_tb = waterLevels.find(r => r.name === "Thác Bà")?.q_x || 0;
    
    if (["Lai Châu", "Bản Chát", "Huội Quảng", "Sơn La", "Hòa Bình"].includes(name)) {
      stationName = "Hà Nội";
      riverName = "Sông Hồng";
      bd1 = 9.5;
      bd2 = 10.5;
      bd3 = 11.5;
      isRedRiverDelta = true;
      
      const totalQ = q_hb + q_tq + q_tb + 1200; // sum of main flood-control discharges + baseline tributary flow
      // Calibrated rating curve for Hanoi: Q -> H
      currentLevel = 1.5 + 0.0005 * totalQ - 0.000000005 * Math.pow(totalQ, 2);
      // Bound it realistically
      currentLevel = Math.max(1.8, Math.min(13.5, currentLevel));
    } else if (name === "Tuyên Quang") {
      stationName = "Tuyên Quang";
      riverName = "Sông Lô";
      bd1 = 22.0;
      bd2 = 24.0;
      bd3 = 26.0;
      
      const q_x_tq = selectedReservoir.q_x || 0;
      const totalQ = q_x_tq + 600;
      currentLevel = 12.0 + 0.0075 * totalQ - 0.0000005 * Math.pow(totalQ, 2);
      currentLevel = Math.max(13.5, Math.min(28.5, currentLevel));
    } else if (name === "Thác Bà") {
      stationName = "Thác Bà";
      riverName = "Sông Chảy";
      bd1 = 22.0;
      bd2 = 24.0;
      bd3 = 26.0;
      
      const q_x_tb = selectedReservoir.q_x || 0;
      const totalQ = q_x_tb + 200;
      currentLevel = 15.0 + 0.015 * totalQ - 0.000001 * Math.pow(totalQ, 2);
      currentLevel = Math.max(16.0, Math.min(30.0, currentLevel));
    } else if (["Bản Vẽ", "Khe Bố"].includes(name)) {
      stationName = "Nam Đàn";
      riverName = "Sông Cả";
      bd1 = 5.4;
      bd2 = 6.9;
      bd3 = 7.9;
      
      const q_x = selectedReservoir.q_x || 0;
      const totalQ = q_x + 300;
      currentLevel = 1.8 + 0.003 * totalQ - 0.0000002 * Math.pow(totalQ, 2);
      currentLevel = Math.max(2.0, Math.min(9.5, currentLevel));
    } else if (name === "Trung Sơn") {
      stationName = "Giàng";
      riverName = "Sông Mã";
      bd1 = 4.0;
      bd2 = 5.0;
      bd3 = 6.0;
      
      const q_x = selectedReservoir.q_x || 0;
      const totalQ = q_x + 400;
      currentLevel = 1.5 + 0.0025 * totalQ - 0.00000015 * Math.pow(totalQ, 2);
      currentLevel = Math.max(1.8, Math.min(7.2, currentLevel));
    } else {
      return null;
    }
    
    const isOverridden = overrides[stationName] !== undefined && overrides[stationName] !== null;
    if (isOverridden) {
      currentLevel = overrides[stationName];
    }
    
    // Determine alert status
    let status: "normal" | "warning" | "danger" | "extreme" = "normal";
    let message = "";
    let badgeText = "An toàn";
    
    if (currentLevel >= bd3) {
      status = "extreme";
      badgeText = "Báo động III";
      message = isRedRiverDelta 
        ? "🔥 NGUY HIỂM CỰC ĐỘ: Lũ sông Hồng vượt mức BĐ3 đe dọa trực tiếp an toàn đê điều Hà Nội và vùng hạ du. Di dời khẩn cấp vùng ngoài đê!"
        : `🔥 NGUY HIỂM CỰC ĐỘ: Lũ lớn trên ${riverName} vượt mức BĐ3. Nguy cơ vỡ đê bối, ngập lụt diện rộng.`;
    } else if (currentLevel >= bd2) {
      status = "danger";
      badgeText = "Báo động II";
      message = `🚨 BÁO ĐỘNG LŨ CẤP II: Ngập úng bãi sông ngoài đê. Các phương án tuần tra đê điều phải được kích hoạt khẩn cấp.`;
    } else if (currentLevel >= bd1) {
      status = "warning";
      badgeText = "Báo động I";
      message = `⚠️ CẢNH BÁO LŨ CẤP I: Nước sông đang dâng cao. Hạn chế các hoạt động nông nghiệp, bến đò ven sông.`;
    } else {
      status = "normal";
      badgeText = "Dưới báo động";
      message = `✅ Mực nước sông đang ở mức an toàn. Dòng chảy chịu sự điều tiết của các hồ chứa thượng nguồn.`;
    }
    
    return {
      stationName,
      riverName,
      bd1,
      bd2,
      bd3,
      currentLevel,
      status,
      message,
      badgeText,
      q_hb,
      q_tq,
      q_tb,
      isRedRiverDelta,
      isOverridden
    };
  }, [selectedReservoir, waterLevels, overrides]);

  // Mini Sparkline coordinates generator for Cascade flow path visualization
  const getCascadeChartProps = (historyData: HistoryPoint[], meta: any) => {
    if (!historyData || historyData.length === 0) return null;

    const width = 360;
    const height = 90;
    const paddingLeft = 40;
    const paddingRight = 10;
    const paddingTop = 8;
    const paddingBottom = 16;

    const htls = historyData.map(h => h.htl);
    const minH = Math.min(...htls);
    const maxH = Math.max(...htls);
    let hRange = maxH - minH;
    if (hRange < 0.5) hRange = 0.5;

    const avg = (minH + maxH) / 2;
    const yMin = avg - hRange * 0.55;
    const yMax = avg + hRange * 0.55;
    const yRange = yMax - yMin;

    const points = historyData.map((pt, idx) => {
      const x = paddingLeft + (idx / (historyData.length - 1)) * (width - paddingLeft - paddingRight);
      const y = height - paddingBottom - ((pt.htl - yMin) / yRange) * (height - paddingTop - paddingBottom);
      return { x, y, htl: pt.htl, time: pt.timestamp };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

    const hControl = meta.hControl || meta.hdbt;
    let hControlY = null;
    if (hControl >= yMin && hControl <= yMax) {
      hControlY = height - paddingBottom - ((hControl - yMin) / yRange) * (height - paddingTop - paddingBottom);
    }

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
      hControlY
    };
  };

  const getCascadeFlowChartProps = (historyData: HistoryPoint[]) => {
    if (!historyData || historyData.length === 0) return null;

    const width = 360;
    const height = 90;
    const paddingLeft = 40;
    const paddingRight = 10;
    const paddingTop = 8;
    const paddingBottom = 16;

    const inflows = historyData.map(h => h.qve || 0);
    const outflows = historyData.map(h => h.q_x || 0);
    const allFlows = [...inflows, ...outflows];
    const minF = Math.min(...allFlows);
    const maxF = Math.max(...allFlows);
    let fRange = maxF - minF;
    if (fRange < 100) fRange = 100;

    const yMin = Math.max(0, minF - fRange * 0.1);
    const yMax = maxF + fRange * 0.1;
    const yRange = yMax - yMin;

    const points = historyData.map((pt, idx) => {
      const x = paddingLeft + (idx / (historyData.length - 1)) * (width - paddingLeft - paddingRight);
      const yOutflow = height - paddingBottom - (((pt.q_x || 0) - yMin) / yRange) * (height - paddingTop - paddingBottom);
      const yInflow = height - paddingBottom - (((pt.qve || 0) - yMin) / yRange) * (height - paddingTop - paddingBottom);
      return { x, yOutflow, yInflow, q_x: pt.q_x || 0, qve: pt.qve || 0, time: pt.timestamp };
    });

    const outflowLinePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yOutflow}`).join(' ');
    const outflowAreaPath = `${outflowLinePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
    const inflowLinePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yInflow}`).join(' ');

    return {
      width,
      height,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      points,
      outflowLinePath,
      outflowAreaPath,
      inflowLinePath,
      yMin: Math.round(yMin),
      yMax: Math.round(yMax),
    };
  };

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

        <div 
          className={`glass-panel ${aggregates.lowLevelCount > 0 && specialFilter !== 'low_level' ? 'pulse-warning-blue' : ''}`} 
          style={{ 
            padding: '20px', 
            cursor: 'pointer', 
            userSelect: 'none',
            borderTop: specialFilter === 'low_level' ? '1px solid var(--color-primary)' : '1px solid transparent',
            borderRight: specialFilter === 'low_level' ? '1px solid var(--color-primary)' : '1px solid transparent',
            borderBottom: specialFilter === 'low_level' ? '1px solid var(--color-primary)' : '1px solid transparent',
            borderLeft: specialFilter === 'low_level' 
              ? '1px solid var(--color-primary)' 
              : (aggregates.lowLevelCount > 0 ? '4px solid var(--color-primary)' : '1px solid transparent'),
            boxShadow: specialFilter === 'low_level' ? '0 0 15px rgba(14, 165, 233, 0.25)' : undefined,
            background: specialFilter === 'low_level' ? 'rgba(14, 165, 233, 0.03)' : undefined,
            transition: 'all 0.3s ease'
          }}
          onClick={() => setSpecialFilter(specialFilter === 'low_level' ? 'none' : 'low_level')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
            Hồ có mực nước thấp
            <Droplet style={{ color: aggregates.lowLevelCount > 0 ? 'var(--color-primary)' : 'var(--text-muted)', width: '18px', height: '18px' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: aggregates.lowLevelCount > 0 ? 'var(--color-primary)' : 'var(--text-primary)' }}>
            {aggregates.lowLevelCount} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>hồ cận MNC</span>
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
          <button 
            onClick={() => setViewMode("cascade")}
            style={{ background: viewMode === "cascade" ? 'rgba(255,255,255,0.08)' : 'none', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: viewMode === "cascade" ? 'var(--color-primary)' : 'var(--text-secondary)' }}
            title="Bậc thang liên hồ"
          >
            <Layers style={{ width: '15px', height: '15px' }} />
            <span>Liên hồ</span>
          </button>
        </div>
      </section>

      {specialFilter !== "none" && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '24px', background: 'rgba(255, 255, 255, 0.03)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            Đang lọc: <strong>{specialFilter === 'discharge' ? 'Hồ đang mở cửa xả lũ qua tràn' : specialFilter === 'warning' ? 'Hồ có mức nước cảnh báo nguy hiểm/tiệm cận' : 'Hồ có mực nước thấp (dưới 15% dung tích hữu ích)'}</strong>. 
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
      ) : viewMode === "table" ? (
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
      ) : (
        // Cascade View
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            {/* Cascade Selector Tabs */}
            <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '10px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
              {(["song_da", "se_san", "dong_nai"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedCascade(key)}
                  style={{
                    background: selectedCascade === key ? 'var(--color-primary)' : 'none',
                    color: selectedCascade === key ? '#000' : 'var(--text-secondary)',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: selectedCascade === key ? '600' : 'normal',
                    fontSize: '13px',
                    transition: 'all 0.2s'
                  }}
                >
                  {CASCADES[key].title}
                </button>
              ))}
            </div>

            {/* Timeframe Selector for Cascade View */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Thời gian xem:</span>
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11px' }}>
                {(["3d", "7d", "15d", "30d", "1y"] as const).map((r) => {
                  const labels: Record<string, string> = {
                    "3d": "3 ngày",
                    "7d": "7 ngày",
                    "15d": "15 ngày",
                    "30d": "30 ngày",
                    "1y": "Tất cả"
                  };
                  const isActive = historyRange === r;
                  return (
                    <button
                      key={r}
                      onClick={() => handleRangeChange(r)}
                      style={{
                        background: isActive ? 'var(--color-primary)' : 'none',
                        color: isActive ? '#000' : 'var(--text-secondary)',
                        border: 'none',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: isActive ? '600' : 'normal',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {labels[r]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '800px', lineHeight: '1.4', marginBottom: '12px' }}>
            {CASCADES[selectedCascade].description}
          </div>

          {/* Cascade Total Inflow/Outflow Metrics Summary */}
          <div style={{ 
            display: 'flex', 
            gap: '24px', 
            marginBottom: '20px', 
            padding: '12px 20px', 
            background: 'rgba(255,255,255,0.02)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '10px',
            width: 'fit-content',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.05em' }}>TỔNG LƯỢNG NƯỚC VỀ BẬC THANG</span>
              <strong style={{ fontSize: '18px', color: 'var(--color-success)' }}>
                {cascadeStats.totalQve.toLocaleString()} <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>m³/s</span>
              </strong>
            </div>
            
            <div style={{ width: '1px', background: 'var(--border-color)', alignSelf: 'stretch' }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.05em' }}>TỔNG LƯỢNG NƯỚC XẢ BẬC THANG</span>
              <strong style={{ fontSize: '18px', color: cascadeStats.totalQx > 0 ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
                {cascadeStats.totalQx.toLocaleString()} <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>m³/s</span>
              </strong>
            </div>

            <div style={{ width: '1px', background: 'var(--border-color)', alignSelf: 'stretch' }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.05em' }}>TỔNG XẢ QUA TRÀN (XẢ LŨ)</span>
              <strong style={{ fontSize: '18px', color: cascadeStats.totalQxt > 0 ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                {cascadeStats.totalQxt.toLocaleString()} <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>m³/s</span>
              </strong>
            </div>

            <div style={{ width: '1px', background: 'var(--border-color)', alignSelf: 'stretch' }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '340px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.05em' }}>ĐIỆN NĂNG LÃNG PHÍ TIỀN NĂNG</span>
              <strong style={{ fontSize: '18px', color: cascadeStats.totalWastedPowerMW > 0 ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                {cascadeStats.totalWastedPowerMW.toFixed(1)} <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>MW</span>
              </strong>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.3' }}>
                Tức thời: ~ {(cascadeStats.totalWastedPowerMW / 1000).toFixed(2)} triệu kWh/h (~ {cascadeStats.totalWastedMillionM3PerHour.toFixed(2)} triệu m³/h)
              </span>
              {cascadeHistoryStats.accumulatedWastedMillionM3 > 0 && (
                <span style={{ fontSize: '9px', color: 'var(--color-danger)', fontWeight: '600', marginTop: '2px', lineHeight: '1.3' }}>
                  Tích lũy ({historyRange === "3d" ? "3 ngày" : historyRange === "7d" ? "7 ngày" : historyRange === "15d" ? "15 ngày" : historyRange === "30d" ? "30 ngày" : "Lịch sử"}): ~ {cascadeHistoryStats.accumulatedWastedMillionM3.toFixed(2)} triệu m³ (~ {(cascadeHistoryStats.accumulatedWastedEnergyMWh / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} triệu kWh)
                </span>
              )}
            </div>
          </div>

          {cascadeLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', gap: '10px', color: 'var(--text-muted)' }}>
              <RefreshCw className="spin" style={{ color: 'var(--color-primary)' }} />
              <span>Đang tải lịch sử các hồ bậc thang...</span>
            </div>
          ) : (
            <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0px', width: '960px', margin: '0 auto' }}>
              {CASCADES[selectedCascade].reservoirs.map((name, index) => {
                const item = waterLevels.find(w => w.name === name);
                if (!item) return null;

                // Find history data
                const historyData = cascadeHistory[name] || [];
                const miniChart = getCascadeChartProps(historyData, item);
                const miniFlowChart = getCascadeFlowChartProps(historyData);

                // Compute fill status
                const activeRange = item.hdbt - item.hc || 10;
                const percentFill = Math.max(0, Math.min(100, ((item.htl - item.hc) / activeRange) * 100));
                
                // Controlled level position inside gauge percentage
                let percentControl = ((item.hControl - item.hc) / activeRange) * 100;
                percentControl = Math.max(0, Math.min(100, percentControl));

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

                // Check connections downstream
                const conn = CASCADES[selectedCascade].connections[index];

                return (
                  <React.Fragment key={name}>
                    {/* Reservoir Cascade Row Card */}
                    <div 
                      className="glass-panel cascade-card" 
                      onClick={() => handleSelectReservoir(item)}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = 'rgba(14, 165, 233, 0.4)'}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                    >
                      {/* Sticky Top Header Capsule */}
                      <div className="cascade-card-title-sticky">
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '6px' }}>
                          Bậc {index + 1} • {item.riverBasin}
                        </span>
                        <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{item.name}</strong>
                        <span className={`status-badge ${statusClass}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                          {statusText}
                        </span>
                      </div>

                      {/* Left: Metadata and vertical gauge */}
                      <div className="cascade-card-left">

                        <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                          {/* Visual vertical gauge */}
                          <div style={{
                            width: '24px',
                            height: '90px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            position: 'relative',
                            overflow: 'hidden',
                            flexShrink: 0
                          }}>
                            <div 
                              className={`gauge-fill ${fillClass}`} 
                              style={{ 
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                bottom: 0,
                                height: `${percentFill}%`,
                                transition: 'height 0.5s ease-out'
                              }}
                            />
                            {percentControl !== undefined && (
                              <div 
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  right: 0,
                                  bottom: `${percentControl}%`,
                                  height: '2px',
                                  background: 'var(--color-warning)',
                                  zIndex: 3
                                }}
                              />
                            )}
                          </div>

                          {/* Quick details */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', flexGrow: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Thượng lưu:</span>
                              <strong style={{ color: 'var(--text-primary)' }}>{item.htl.toFixed(2)}m</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Giới hạn lũ:</span>
                              <span style={{ color: 'var(--color-warning)', fontWeight: '600' }}>{item.hControl.toFixed(1)}m</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Nước về (Qve):</span>
                              <span style={{ color: 'var(--color-success)', fontWeight: '600' }}>{item.qve.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Tổng xả (Qx):</span>
                              <span style={{ color: item.q_x > 0 ? 'var(--color-primary)' : 'var(--text-secondary)', fontWeight: '600' }}>{item.q_x.toLocaleString()}</span>
                            </div>

                            {/* Spillway xả lũ warning in cascade card */}
                            {(item.qxt > 0 || item.ncxs > 0 || item.ncxm > 0) && (
                              <div style={{ 
                                marginTop: '8px', 
                                padding: '6px 8px', 
                                borderRadius: '6px', 
                                background: 'rgba(239, 68, 68, 0.05)', 
                                border: '1px solid rgba(239, 68, 68, 0.15)', 
                                fontSize: '10px',
                                lineHeight: '1.3'
                              }}>
                                <span style={{ fontWeight: '600', color: 'var(--color-danger)', display: 'block', marginBottom: '2px' }}>
                                  🌊 Đang xả lũ:
                                </span>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                                  <span>Xả tràn (Qxt):</span>
                                  <strong style={{ color: 'var(--color-danger)' }}>{item.qxt.toLocaleString()} m³/s</strong>
                                </div>
                                {(item.ncxs > 0 || item.ncxm > 0) && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    <span>Cửa mở:</span>
                                    <strong style={{ color: 'var(--color-danger)' }}>{item.ncxs}S / {item.ncxm}M</strong>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Transition warning alert in cascade card */}
                            {item.transitionAlert && (
                              <div style={{ 
                                background: 'rgba(245, 158, 11, 0.06)', 
                                border: '1px solid rgba(245, 158, 11, 0.15)', 
                                padding: '6px 8px', 
                                borderRadius: '6px', 
                                fontSize: '10px',
                                lineHeight: '1.3',
                                marginTop: '8px',
                                color: 'var(--text-primary)'
                              }}>
                                <span style={{ fontWeight: '600', color: 'var(--color-warning)', display: 'block', marginBottom: '2px' }}>
                                  ⚠️ Giai đoạn kế tiếp:
                                </span>
                                <strong>{item.transitionAlert.daysRemaining} ngày</strong> nữa sang <strong>{item.transitionAlert.nextSeasonName}</strong>. 
                                {item.transitionAlert.nextHControl !== item.transitionAlert.currentHControl && (
                                  <> Hctl: {item.transitionAlert.currentHControl.toFixed(1)}m ➜ {item.transitionAlert.nextHControl.toFixed(1)}m.</>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Twin trend mini-charts side-by-side */}
                      <div className="cascade-charts-grid">
                        {/* Mini-Chart 1: Water Level */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            <span>Mực nước ({historyRange === "3d" ? "72h" : historyRange === "7d" ? "7 ngày" : historyRange === "15d" ? "15 ngày" : "Lịch sử"})</span>
                            <span>Mét (m)</span>
                          </div>
                          
                          <div className="glass-panel" style={{ padding: '8px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.01)' }}>
                            {historyData.length === 0 ? (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Không có lịch sử</span>
                            ) : miniChart ? (
                              <svg viewBox={`0 0 ${miniChart.width} ${miniChart.height}`} style={{ width: '100%', height: '100%' }}>
                                <line x1={miniChart.paddingLeft} y1={miniChart.paddingTop} x2={miniChart.width - miniChart.paddingRight} y2={miniChart.paddingTop} stroke="rgba(255,255,255,0.04)" strokeDasharray="2" />
                                <line x1={miniChart.paddingLeft} y1={miniChart.height - miniChart.paddingBottom} x2={miniChart.width - miniChart.paddingRight} y2={miniChart.height - miniChart.paddingBottom} stroke="rgba(255,255,255,0.04)" />
                                
                                <text x={miniChart.paddingLeft - 4} y={miniChart.paddingTop + 4} fill="var(--text-muted)" fontSize="8" textAnchor="end">{miniChart.yMax}m</text>
                                <text x={miniChart.paddingLeft - 4} y={miniChart.height - miniChart.paddingBottom + 3} fill="var(--text-muted)" fontSize="8" textAnchor="end">{miniChart.yMin}m</text>
                                
                                <path d={miniChart.areaPath} fill="rgba(14, 165, 233, 0.05)" />
                                <path d={miniChart.linePath} fill="none" stroke="var(--color-primary)" strokeWidth="1.5" />

                                {miniChart.hControlY !== null && (
                                  <line x1={miniChart.paddingLeft} y1={miniChart.hControlY} x2={miniChart.width - miniChart.paddingRight} y2={miniChart.hControlY} stroke="var(--color-warning)" strokeWidth="1" strokeDasharray="3 3" />
                                )}

                                {/* Hover vertical line & tooltip */}
                                {cascadeHoverIndex !== null && cascadeHoverIndex < miniChart.points.length && (() => {
                                  const p = miniChart.points[cascadeHoverIndex];
                                  return (
                                    <g key="hover-group">
                                      {/* Vertical Line */}
                                      <line
                                        x1={p.x}
                                        y1={miniChart.paddingTop}
                                        x2={p.x}
                                        y2={miniChart.height - miniChart.paddingBottom}
                                        stroke="rgba(255,255,255,0.15)"
                                        strokeDasharray="2 2"
                                      />
                                      {/* Tooltip point */}
                                      <circle
                                        cx={p.x}
                                        cy={p.y}
                                        r="3.5"
                                        fill="var(--color-primary)"
                                        stroke="#1e293b"
                                        strokeWidth="1"
                                      />
                                      {/* Tooltip value */}
                                      <text
                                        x={Math.max(miniChart.paddingLeft + 35, Math.min(p.x, miniChart.width - miniChart.paddingRight - 35))}
                                        y={Math.max(20, p.y - 10)}
                                        fill="var(--text-primary)"
                                        fontSize="9"
                                        fontWeight="700"
                                        textAnchor="middle"
                                      >
                                        {p.htl.toFixed(2)} m
                                      </text>
                                    </g>
                                  );
                                })()}

                                {/* Interactive overlay target */}
                                <rect
                                  x={miniChart.paddingLeft}
                                  y={miniChart.paddingTop}
                                  width={miniChart.width - miniChart.paddingLeft - miniChart.paddingRight}
                                  height={miniChart.height - miniChart.paddingTop - miniChart.paddingBottom}
                                  fill="transparent"
                                  onMouseMove={(e) => handleCascadeMouseMove(e, miniChart.width, historyData.length)}
                                  onMouseLeave={handleCascadeMouseLeave}
                                  style={{ cursor: 'crosshair' }}
                                />
                              </svg>
                            ) : null}
                          </div>
                        </div>

                        {/* Mini-Chart 2: Flow Rates */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            <span>Lưu lượng (m³/s)</span>
                            <span style={{ color: 'var(--color-success)' }}>Qve (đứt)</span>
                            <span style={{ color: 'var(--color-primary)' }}>Qx (liền)</span>
                          </div>

                          <div className="glass-panel" style={{ padding: '8px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.01)' }}>
                            {historyData.length === 0 ? (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Không có lịch sử</span>
                            ) : miniFlowChart ? (
                              <svg viewBox={`0 0 ${miniFlowChart.width} ${miniFlowChart.height}`} style={{ width: '100%', height: '100%' }}>
                                <line x1={miniFlowChart.paddingLeft} y1={miniFlowChart.paddingTop} x2={miniFlowChart.width - miniFlowChart.paddingRight} y2={miniFlowChart.paddingTop} stroke="rgba(255,255,255,0.04)" strokeDasharray="2" />
                                <line x1={miniFlowChart.paddingLeft} y1={miniFlowChart.height - miniFlowChart.paddingBottom} x2={miniFlowChart.width - miniFlowChart.paddingRight} y2={miniFlowChart.height - miniFlowChart.paddingBottom} stroke="rgba(255,255,255,0.04)" />

                                <text x={miniFlowChart.paddingLeft - 4} y={miniFlowChart.paddingTop + 4} fill="var(--text-muted)" fontSize="8" textAnchor="end">{miniFlowChart.yMax.toLocaleString()}</text>
                                <text x={miniFlowChart.paddingLeft - 4} y={miniFlowChart.height - miniFlowChart.paddingBottom + 3} fill="var(--text-muted)" fontSize="8" textAnchor="end">{miniFlowChart.yMin.toLocaleString()}</text>

                                <path d={miniFlowChart.outflowAreaPath} fill="rgba(14, 165, 233, 0.03)" />
                                <path d={miniFlowChart.outflowLinePath} fill="none" stroke="var(--color-primary)" strokeWidth="1.2" />
                                <path d={miniFlowChart.inflowLinePath} fill="none" stroke="var(--color-success)" strokeWidth="1" strokeDasharray="2 2" />

                                {/* Hover vertical line & tooltip */}
                                {cascadeHoverIndex !== null && cascadeHoverIndex < miniFlowChart.points.length && (() => {
                                  const p = miniFlowChart.points[cascadeHoverIndex];
                                  return (
                                    <g key="hover-group-flow">
                                      {/* Vertical Line */}
                                      <line
                                        x1={p.x}
                                        y1={miniFlowChart.paddingTop}
                                        x2={p.x}
                                        y2={miniFlowChart.height - miniFlowChart.paddingBottom}
                                        stroke="rgba(255,255,255,0.15)"
                                        strokeDasharray="2 2"
                                      />
                                      {/* Tooltip point (Outflow) */}
                                      <circle
                                        cx={p.x}
                                        cy={p.yOutflow}
                                        r="3"
                                        fill="var(--color-primary)"
                                        stroke="#1e293b"
                                        strokeWidth="1"
                                      />
                                      {/* Tooltip point (Inflow) */}
                                      <circle
                                        cx={p.x}
                                        cy={p.yInflow}
                                        r="3"
                                        fill="var(--color-success)"
                                        stroke="#1e293b"
                                        strokeWidth="1"
                                      />
                                      {/* Tooltip values */}
                                      <text
                                        x={Math.max(miniFlowChart.paddingLeft + 45, Math.min(p.x, miniFlowChart.width - miniFlowChart.paddingRight - 45))}
                                        y={18}
                                        fill="var(--text-primary)"
                                        fontSize="8"
                                        fontWeight="700"
                                        textAnchor="middle"
                                      >
                                        Qve: {p.qve.toLocaleString()} | Qx: {p.q_x.toLocaleString()}
                                      </text>
                                      <text
                                        x={Math.max(miniFlowChart.paddingLeft + 45, Math.min(p.x, miniFlowChart.width - miniFlowChart.paddingRight - 45))}
                                        y={miniFlowChart.height - 2}
                                        fill="var(--text-muted)"
                                        fontSize="7"
                                        textAnchor="middle"
                                      >
                                        {new Date(p.time).toLocaleDateString('vi-VN', {month: '2-digit', day: '2-digit'})} {new Date(p.time).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                                      </text>
                                    </g>
                                  );
                                })()}

                                {/* Interactive overlay target */}
                                <rect
                                  x={miniFlowChart.paddingLeft}
                                  y={miniFlowChart.paddingTop}
                                  width={miniFlowChart.width - miniFlowChart.paddingLeft - miniFlowChart.paddingRight}
                                  height={miniFlowChart.height - miniFlowChart.paddingTop - miniFlowChart.paddingBottom}
                                  fill="transparent"
                                  onMouseMove={(e) => handleCascadeMouseMove(e, miniFlowChart.width, historyData.length)}
                                  onMouseLeave={handleCascadeMouseLeave}
                                  style={{ cursor: 'crosshair' }}
                                />
                              </svg>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Visual Downstream Connection Arrow */}
                    {conn && (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        margin: '12px 0',
                        color: item.q_x > 0 ? 'var(--color-primary)' : 'var(--text-muted)',
                        position: 'relative',
                        zIndex: 2
                      }}>
                        <div style={{ 
                          fontSize: '11px', 
                          background: item.q_x > 0 ? 'rgba(14,165,233,0.06)' : 'rgba(255,255,255,0.02)', 
                          padding: '4px 10px', 
                          borderRadius: '12px', 
                          border: item.q_x > 0 ? '1px dashed rgba(14,165,233,0.25)' : '1px solid var(--border-color)',
                          marginBottom: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span>{conn.desc}</span>
                          <strong>{item.q_x > 0 ? `${item.q_x.toLocaleString()} m³/s` : "Không xả"}</strong>
                        </div>
                        <ArrowDown className={item.q_x > 0 ? "pulse" : ""} style={{ width: '20px', height: '20px' }} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5.5 Footer Disclaimer */}
      <footer style={{ 
        marginTop: '40px', 
        paddingTop: '24px', 
        borderTop: '1px solid var(--border-color)', 
        color: 'var(--text-muted)', 
        fontSize: '12px',
        lineHeight: '1.6',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          <strong style={{ color: 'var(--color-warning)' }}>⚠️ Tuyên bố miễn trừ trách nhiệm (Disclaimer):</strong>
        </div>
        <ul style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px', listStyleType: 'disc' }}>
          <li>
            <strong>Tính chất dự án:</strong> Đây là dự án hobby phi thương mại phục vụ nhu cầu tra cứu và nghiên cứu cá nhân. Thông tin trên trang này không được sử dụng cho mục đích dự báo khí tượng thủy văn, điều hành phòng chống thiên tai chuyên nghiệp hoặc ra các quyết định thực tế.
          </li>
          <li>
            <strong>Nguồn dữ liệu hồ chứa:</strong> Dữ liệu vận hành hồ chứa (mực nước hồ, lưu lượng xả, nước về) được tự động thu thập (crawl) từ trang thông tin vận hành của Tập đoàn Điện lực Việt Nam (EVN): <a href="https://www.evn.com.vn/c3/thong-tin-ho-thuy-dien/Muc-nuoc-cac-ho-thuy-dien-117-123.aspx" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: '500' }} onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}>evn.com.vn</a>.
          </li>
          <li>
            <strong>Dữ liệu mực nước các sông:</strong> Dự án hiện tại <strong>không có dữ liệu đo đạc thực tế</strong> của mực nước tại các con sông (như trạm Hà Nội trên sông Hồng, trạm Tuyên Quang trên sông Lô...). Các trị số mực nước sông hạ lưu hiển thị trên hệ thống là kết quả tính toán mô phỏng/giả lập dựa trên lưu lượng xả lũ để phục vụ học tập thuật toán điều tiết liên hồ chứa.
          </li>
        </ul>
        <div style={{ marginTop: '12px', fontSize: '11px', textAlign: 'center', opacity: 0.6 }}>
          © {new Date().getFullYear()} Giám sát Hồ Chứa Việt Nam • Dự án tham khảo cá nhân
        </div>
      </footer>

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

            {/* Operational Guidelines according to Decision 740/QĐ-TTg */}
            {selectedReservoir.region.includes("Bắc Bộ") && (
              <div style={{
                background: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                fontSize: '13px'
              }}>
                <h4 style={{ 
                  fontSize: '13px', 
                  textTransform: 'uppercase', 
                  color: 'var(--color-primary)', 
                  letterSpacing: '0.05em', 
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: '600'
                }}>
                  📖 Chỉ dẫn vận hành lũ (QĐ 740/QĐ-TTg)
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-secondary)' }}>
                  <div>
                    <strong>Giai đoạn hiện tại:</strong> <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{selectedReservoir.activeSeasonName}</span> (15/06 - 19/07).
                  </div>

                  {(() => {
                    const today = new Date();
                    const month = today.getMonth() + 1; // 1-indexed
                    const day = today.getDate();
                    
                    // Check if current date is between July 10 and July 19
                    const isTransitionJuly = (month === 7 && day >= 10 && day <= 19);
                    
                    if (isTransitionJuly) {
                      // Find next season (Lũ chính vụ) control level
                      const mainFloodLimit = selectedReservoir.name === "Hòa Bình" ? 101.0
                                           : selectedReservoir.name === "Sơn La" ? 194.0
                                           : selectedReservoir.name === "Tuyên Quang" ? 105.2
                                           : selectedReservoir.name === "Thác Bà" ? 56.0
                                           : selectedReservoir.name === "Bản Chát" ? 475.0
                                           : selectedReservoir.name === "Lai Châu" ? 290.0
                                           : selectedReservoir.hControl; // fallback

                      return (
                        <div style={{
                          background: 'rgba(245, 158, 11, 0.08)',
                          borderLeft: '4px solid var(--color-warning)',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          color: 'var(--text-primary)',
                          lineHeight: '1.4'
                        }}>
                          <strong style={{ color: 'var(--color-warning)', display: 'block', marginBottom: '4px' }}>
                            ⚠️ HẠ MỰC NƯỚC CHUYỂN TIẾP (10/07 - 19/07):
                          </strong>
                          Theo quy định chuyển tiếp mùa lũ: Từ ngày 10/07, nếu không có lũ lớn, hồ <strong>{selectedReservoir.name}</strong> phải vận hành điều tiết hạ dần mực nước từ giới hạn lũ sớm ({selectedReservoir.hControl.toFixed(1)}m) về mực nước trước lũ chính vụ là <strong>{mainFloodLimit.toFixed(1)}m</strong> trước ngày 20/07.
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div style={{ lineHeight: '1.4' }}>
                    <strong>Quy định cốt lõi liên hồ chứa sông Hồng:</strong>
                    <ul style={{ paddingLeft: '18px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px', listStyleType: 'disc' }}>
                      <li>
                        <strong>Thời kỳ lũ sớm (15/06 - 19/07):</strong> Được duy trì mực nước cao để tối ưu phát điện (Sơn La ≤ 200m, Hòa Bình ≤ 105m).
                      </li>
                      <li>
                        <strong>Thời kỳ chuyển tiếp (10/07 - 19/07):</strong> Vận hành hạ mực nước dần về cao trình trước lũ chính vụ.
                      </li>
                      <li>
                        <strong>Thời kỳ lũ chính vụ (20/07 - 21/08):</strong> Mực nước hồ khống chế ở mức thấp nhất trước lũ để sẵn sàng dung tích cắt lũ bảo vệ Hà Nội (Sơn La ≤ 194m, Hòa Bình ≤ 101m, Tuyên Quang ≤ 105.2m).
                      </li>
                    </ul>
                  </div>

                  <div style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                    <a 
                      href="https://vanban.chinhphu.vn/?pageid=27160&docid=197171" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        color: 'var(--color-primary)', 
                        textDecoration: 'none', 
                        fontWeight: '600',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                    >
                      🔗 Tra cứu Quyết định 740/QĐ-TTg (Quy trình liên hồ sông Hồng)
                    </a>
                  </div>
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

                  {/* Wasted water and potential power loss calculation card */}
                  {selectedReservoir.qxt > 0 && (() => {
                    const head = selectedReservoir.htl - selectedReservoir.tailraceElev;
                    if (head <= 0) return null;
                    const eta = 0.85;
                    const g = 9.81;
                    const wastedPowerKw = eta * g * selectedReservoir.qxt * head;
                    const wastedPowerMW = wastedPowerKw / 1000;
                    const wastedMillionM3PerHour = (selectedReservoir.qxt * 3600) / 1000000;
                    return (
                      <div style={{ 
                        marginTop: '16px', 
                        padding: '12px 14px', 
                        borderRadius: '10px', 
                        background: 'rgba(239, 68, 68, 0.04)', 
                        border: '1px solid rgba(239, 68, 68, 0.15)' 
                      }}>
                        <h5 style={{ fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--color-danger)', letterSpacing: '0.05em', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                          ⚡ Tổn thất năng lượng xả lũ (Wasted Power)
                        </h5>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Công suất tổn hao</span>
                            <strong style={{ fontSize: '16px', color: 'var(--color-danger)' }}>
                              {wastedPowerMW.toFixed(1)} MW
                            </strong>
                          </div>
                          <div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Lượng nước lãng phí</span>
                            <strong style={{ fontSize: '16px', color: 'var(--color-danger)' }}>
                              {wastedMillionM3PerHour.toFixed(3)} triệu m³/h
                            </strong>
                          </div>
                        </div>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic', margin: '8px 0 0 0', lineHeight: '1.4' }}>
                          * Công suất điện năng bị lãng phí do lượng nước xả lũ {selectedReservoir.qxt.toLocaleString()} m³/s này không được dẫn qua tua-bin ở độ chênh mực nước {head.toFixed(1)}m.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Downstream Gauge Monitoring */}
              {downstreamInfo && (
                <div>
                  <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '10px' }}>
                    Giám sát lưu vực hạ du
                  </h4>
                  <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.015)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>
                          Trạm quan trắc: {downstreamInfo.stationName} ({downstreamInfo.riverName})
                        </span>
                        
                        {editingStation === downstreamInfo.stationName ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                            <input
                              type="number"
                              step="0.01"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              placeholder="Nhập m"
                              style={{
                                width: '90px',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '4px',
                                color: '#fff',
                                padding: '4px 8px',
                                fontSize: '14px',
                                outline: 'none'
                              }}
                              disabled={savingOverride}
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveOverride(downstreamInfo.stationName)}
                              disabled={savingOverride}
                              style={{
                                background: 'var(--color-success)',
                                border: 'none',
                                color: '#fff',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                opacity: savingOverride ? 0.6 : 1
                              }}
                            >
                              Lưu
                            </button>
                            <button
                              onClick={() => setEditingStation(null)}
                              disabled={savingOverride}
                              style={{
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                color: '#fff',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <strong style={{ 
                              fontSize: '18px', 
                              color: downstreamInfo.status === 'extreme' ? 'var(--color-danger)' : 
                                     downstreamInfo.status === 'danger' ? 'var(--color-warning)' : 
                                     downstreamInfo.status === 'warning' ? 'var(--color-primary)' : 'var(--color-success)',
                              display: 'block'
                            }}>
                              {downstreamInfo.currentLevel.toFixed(2)} m
                            </strong>
                            
                            {downstreamInfo.isOverridden && (
                              <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>
                                Thực tế
                              </span>
                            )}
                            
                            <button
                              onClick={() => {
                                setEditingStation(downstreamInfo.stationName);
                                setEditValue(downstreamInfo.isOverridden ? downstreamInfo.currentLevel.toString() : "");
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '11px',
                                padding: '2px 4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}
                              title="Hiệu chỉnh mực nước thực tế"
                            >
                              ✏️ Chỉnh
                            </button>
                            
                            {downstreamInfo.isOverridden && (
                              <button
                                onClick={async () => {
                                  setEditValue("");
                                  setSavingOverride(true);
                                  try {
                                    const res = await fetch('/api/river-overrides', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ stationName: downstreamInfo.stationName, level: null })
                                    });
                                    if (res.ok) {
                                      setOverrides(prev => {
                                        const next = { ...prev };
                                        delete next[downstreamInfo.stationName];
                                        return next;
                                      });
                                    }
                                  } catch (e) {
                                    console.error(e);
                                  } finally {
                                    setSavingOverride(false);
                                  }
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'rgba(239, 68, 68, 0.8)',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  padding: '2px 4px'
                                }}
                                title="Xóa hiệu chỉnh, quay về mô phỏng"
                              >
                                Xóa hiệu chỉnh
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <span className={`status-badge ${
                        downstreamInfo.status === 'extreme' ? 'status-badge-danger pulse-warning-red' :
                        downstreamInfo.status === 'danger' ? 'status-badge-danger' :
                        downstreamInfo.status === 'warning' ? 'status-badge-warning' : 'status-badge-normal'
                      }`}>
                        {downstreamInfo.badgeText}
                      </span>
                    </div>

                    {/* Horizontal gauge bar showing BD1, BD2, BD3 limits */}
                    <div style={{ position: 'relative', height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', margin: '20px 0 12px 0', overflow: 'hidden' }}>
                      {/* Progress Fill */}
                      <div style={{ 
                        width: `${Math.max(10, Math.min(100, (downstreamInfo.currentLevel / (downstreamInfo.bd3 + 1.5)) * 100))}%`, 
                        height: '100%', 
                        background: downstreamInfo.status === 'extreme' ? 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-warning) 60%, var(--color-danger) 100%)' :
                                    downstreamInfo.status === 'danger' ? 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-warning) 100%)' :
                                    downstreamInfo.status === 'warning' ? 'var(--color-primary)' : 'var(--color-success)',
                        borderRadius: '6px',
                        opacity: 0.8,
                        transition: 'width 0.5s ease'
                      }} />
                      
                      {/* BD1 Marker */}
                      <div style={{ position: 'absolute', left: `${(downstreamInfo.bd1 / (downstreamInfo.bd3 + 1.5)) * 100}%`, top: 0, bottom: 0, width: '2px', background: 'var(--color-warning)', zIndex: 10 }}>
                        <span style={{ position: 'absolute', bottom: '100%', transform: 'translateX(-50%)', fontSize: '8px', color: 'var(--color-warning)', fontWeight: '600' }}>BĐ1</span>
                      </div>
                      
                      {/* BD2 Marker */}
                      <div style={{ position: 'absolute', left: `${(downstreamInfo.bd2 / (downstreamInfo.bd3 + 1.5)) * 100}%`, top: 0, bottom: 0, width: '2px', background: 'var(--color-danger)', zIndex: 10 }}>
                        <span style={{ position: 'absolute', bottom: '100%', transform: 'translateX(-50%)', fontSize: '8px', color: 'var(--color-danger)', fontWeight: '600' }}>BĐ2</span>
                      </div>
                      
                      {/* BD3 Marker */}
                      <div style={{ position: 'absolute', left: `${(downstreamInfo.bd3 / (downstreamInfo.bd3 + 1.5)) * 100}%`, top: 0, bottom: 0, width: '2px', background: 'rgba(239, 68, 68, 0.8)', zIndex: 10 }}>
                        <span style={{ position: 'absolute', bottom: '100%', transform: 'translateX(-50%)', fontSize: '8px', color: '#ff4444', fontWeight: 'bold' }}>BĐ3</span>
                      </div>
                    </div>

                    <p style={{ 
                      fontSize: '12px', 
                      color: downstreamInfo.status === 'extreme' ? 'var(--color-danger)' : 
                             downstreamInfo.status === 'danger' ? 'var(--color-warning)' : 
                             downstreamInfo.status === 'warning' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      lineHeight: '1.4', 
                      marginTop: '8px',
                      fontWeight: downstreamInfo.status !== 'normal' ? '600' : '400'
                    }}>
                      {downstreamInfo.message}
                    </p>

                    {/* Red River basin note detailing composite discharges */}
                    {downstreamInfo.isRedRiverDelta && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '12px', paddingTop: '8px', fontSize: '10.5px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span>* Tổng lưu lượng xả đổ về đồng bằng (Hòa Bình + Tuyên Quang + Thác Bà):</span>
                        <strong style={{ color: 'var(--text-secondary)' }}>
                          {(downstreamInfo.q_hb + downstreamInfo.q_tq + downstreamInfo.q_tb).toLocaleString()} m³/s
                        </strong>
                      </div>
                    )}

                    {/* Safety Catchment Warning Disclaimer */}
                    <div style={{ 
                      marginTop: '12px', 
                      padding: '10px 12px', 
                      background: 'rgba(239, 68, 68, 0.04)', 
                      border: '1px dashed rgba(239, 68, 68, 0.25)', 
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: 'var(--color-danger)',
                      lineHeight: '1.4'
                    }}>
                      <strong style={{ display: 'block', marginBottom: '3px' }}>⚠️ Khuyến cáo an toàn / Giới hạn mô hình:</strong>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        Trị số mực nước sông trên đây được <strong>tính toán thủy văn ước lượng</strong> dựa theo lượng nước xả từ các hồ chứa thượng nguồn. Mô hình này <strong>chưa thể tính toán lượng nước mưa chảy tràn trực tiếp ở các phụ lưu tự do hạ du</strong>. Vào mùa mưa bão lớn, mực nước thực tế có thể cao hơn mô phỏng do phụ lưu đổ nước. Khuyến nghị người vận hành chủ động theo dõi và sử dụng nút <strong>✏️ Chỉnh</strong> để cập nhật số liệu đo đạc chính xác từ cơ quan khí tượng thủy văn.
                      </span>
                    </div>
                  </div>
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

              {/* Historical Trend Chart with Range Selector */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Biểu đồ mực nước</h4>
                  
                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11px' }}>
                    {(["3d", "7d", "15d", "30d", "1y"] as const).map((r) => {
                      const labels: Record<string, string> = {
                        "3d": "3 ngày",
                        "7d": "7 ngày",
                        "15d": "15 ngày",
                        "30d": "30 ngày",
                        "1y": "Tất cả"
                      };
                      const isActive = historyRange === r;
                      return (
                        <button
                          key={r}
                          onClick={() => handleRangeChange(r)}
                          style={{
                            background: isActive ? 'var(--color-primary)' : 'none',
                            color: isActive ? '#000' : 'var(--text-secondary)',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: isActive ? '600' : 'normal',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {labels[r]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '12px', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
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
                        {chartProps.hControlY !== null && (
                          <g>
                            <line 
                              x1={chartProps.paddingLeft} 
                              y1={chartProps.hControlY} 
                              x2={chartProps.width - chartProps.paddingRight} 
                              y2={chartProps.hControlY} 
                              stroke="var(--color-warning)" 
                              strokeWidth="1.5" 
                              strokeDasharray="4 4" 
                              opacity="0.8"
                            />
                            <text 
                              x={chartProps.width - chartProps.paddingRight - 4} 
                              y={chartProps.hControlY - 4} 
                              fill="var(--color-warning)" 
                              fontSize="8" 
                              fontWeight="600" 
                              textAnchor="end"
                            >
                              Giới hạn lũ ({selectedReservoir.hControl.toFixed(1)}m)
                            </text>
                          </g>
                        )}

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

                        {/* Synchronized Hover elements */}
                        {hoveredIndex !== null && chartProps.points[hoveredIndex] && (() => {
                          const p = chartProps.points[hoveredIndex];
                          return (
                            <g pointerEvents="none">
                              {/* Vertical tracking dashed line */}
                              <line 
                                x1={p.x} 
                                y1={chartProps.paddingTop} 
                                x2={p.x} 
                                y2={chartProps.height - chartProps.paddingBottom} 
                                stroke="var(--color-primary)" 
                                strokeWidth="1" 
                                strokeDasharray="3" 
                              />
                              {/* Highlight circle on data point */}
                              <circle 
                                cx={p.x} 
                                cy={p.y} 
                                r="5" 
                                fill="var(--color-primary)" 
                                stroke="var(--bg-surface-solid)" 
                                strokeWidth="2" 
                              />
                              {/* Tooltip Card */}
                              <rect
                                x={Math.max(chartProps.paddingLeft, Math.min(p.x - 70, chartProps.width - chartProps.paddingRight - 140))}
                                y={Math.max(5, p.y - 45)}
                                width="140"
                                height="35"
                                rx="6"
                                fill="rgba(15, 23, 42, 0.95)"
                                stroke="rgba(14, 165, 233, 0.2)"
                                strokeWidth="1"
                              />
                              {/* Tooltip Time */}
                              <text
                                x={Math.max(chartProps.paddingLeft + 70, Math.min(p.x, chartProps.width - chartProps.paddingRight - 70))}
                                y={Math.max(16, p.y - 34)}
                                fill="var(--text-muted)"
                                fontSize="8"
                                fontWeight="500"
                                textAnchor="middle"
                              >
                                {new Date(p.time).toLocaleDateString('vi-VN', {month: '2-digit', day: '2-digit'})} {new Date(p.time).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                              </text>
                              {/* Tooltip Value */}
                              <text
                                x={Math.max(chartProps.paddingLeft + 70, Math.min(p.x, chartProps.width - chartProps.paddingRight - 70))}
                                y={Math.max(28, p.y - 22)}
                                fill="var(--color-primary)"
                                fontSize="10"
                                fontWeight="700"
                                textAnchor="middle"
                              >
                                Htl: {p.htl.toFixed(2)} m
                              </text>
                            </g>
                          );
                        })()}

                        {/* Interactive overlay target */}
                        <rect
                          x={chartProps.paddingLeft}
                          y={chartProps.paddingTop}
                          width={chartProps.width - chartProps.paddingLeft - chartProps.paddingRight}
                          height={chartProps.height - chartProps.paddingTop - chartProps.paddingBottom}
                          fill="transparent"
                          onMouseMove={(e) => handleChartMouseMove(e, chartProps.width)}
                          onMouseLeave={handleChartMouseLeave}
                          style={{ cursor: 'crosshair' }}
                        />
                      </svg>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Dynamic Flow Rates (Discharge & Inflow) Chart */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Lưu lượng Xả & Về (m³/s)</h4>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--color-primary)', borderRadius: '50%' }} /> Xả (Qx)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', border: '1px dashed var(--color-success)', borderRadius: '50%' }} /> Về (Qve)
                    </span>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '12px', minHeight: '170px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {historyLoading ? (
                    <RefreshCw className="spin" style={{ width: '24px', height: '24px', color: 'var(--color-primary)' }} />
                  ) : history.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Không tìm thấy dữ liệu lịch sử</span>
                  ) : flowChartProps ? (
                    <div style={{ width: '100%' }}>
                      <svg viewBox={`0 0 ${flowChartProps.width} ${flowChartProps.height}`} style={{ width: '100%', height: 'auto' }}>
                        <defs>
                          <linearGradient id="flow-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.00" />
                          </linearGradient>
                        </defs>

                        {/* Y-Axis Grid Lines */}
                        <line x1={flowChartProps.paddingLeft} y1={flowChartProps.paddingTop} x2={flowChartProps.width - flowChartProps.paddingRight} y2={flowChartProps.paddingTop} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
                        <line x1={flowChartProps.paddingLeft} y1={flowChartProps.height - flowChartProps.paddingBottom} x2={flowChartProps.width - flowChartProps.paddingRight} y2={flowChartProps.height - flowChartProps.paddingBottom} stroke="rgba(255,255,255,0.05)" />

                        {/* Y Labels */}
                        <text x={flowChartProps.paddingLeft - 8} y={flowChartProps.paddingTop + 4} fill="var(--text-muted)" fontSize="9" textAnchor="end">{flowChartProps.yMax.toLocaleString()}</text>
                        <text x={flowChartProps.paddingLeft - 8} y={flowChartProps.height - flowChartProps.paddingBottom + 3} fill="var(--text-muted)" fontSize="9" textAnchor="end">{flowChartProps.yMin.toLocaleString()}</text>

                        {/* Outflow Area Fill */}
                        <path d={flowChartProps.outflowAreaPath} fill="url(#flow-grad)" />

                        {/* Outflow Stroke Line (Qx) */}
                        <path d={flowChartProps.outflowLinePath} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Inflow Stroke Line (Qve) */}
                        <path d={flowChartProps.inflowLinePath} fill="none" stroke="var(--color-success)" strokeWidth="1.5" strokeDasharray="3 3" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Date X Labels (First and last) */}
                        {flowChartProps.points.length > 0 && (
                          <>
                            <text x={flowChartProps.paddingLeft} y={flowChartProps.height - 8} fill="var(--text-muted)" fontSize="9" textAnchor="start">
                              {new Date(flowChartProps.points[0].time).toLocaleDateString('vi-VN', {month: '2-digit', day: '2-digit'})} {new Date(flowChartProps.points[0].time).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                            </text>
                            <text x={flowChartProps.width - flowChartProps.paddingRight} y={flowChartProps.height - 8} fill="var(--text-muted)" fontSize="9" textAnchor="end">
                              {new Date(flowChartProps.points[flowChartProps.points.length-1].time).toLocaleDateString('vi-VN', {month: '2-digit', day: '2-digit'})} {new Date(flowChartProps.points[flowChartProps.points.length-1].time).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                            </text>
                          </>
                        )}

                        {/* Synchronized Hover elements */}
                        {hoveredIndex !== null && flowChartProps.points[hoveredIndex] && (() => {
                          const p = flowChartProps.points[hoveredIndex];
                          return (
                            <g pointerEvents="none">
                              {/* Vertical tracking dashed line */}
                              <line 
                                x1={p.x} 
                                y1={flowChartProps.paddingTop} 
                                x2={p.x} 
                                y2={flowChartProps.height - flowChartProps.paddingBottom} 
                                stroke="var(--color-primary)" 
                                strokeWidth="1" 
                                strokeDasharray="3" 
                              />
                              {/* Highlight circles */}
                              <circle cx={p.x} cy={p.yOutflow} r="4" fill="var(--color-primary)" stroke="var(--bg-surface-solid)" strokeWidth="1.5" />
                              <circle cx={p.x} cy={p.yInflow} r="4" fill="var(--color-success)" stroke="var(--bg-surface-solid)" strokeWidth="1.5" />
                              
                              {/* Tooltip Card */}
                              <rect
                                x={Math.max(flowChartProps.paddingLeft, Math.min(p.x - 70, flowChartProps.width - flowChartProps.paddingRight - 140))}
                                y={Math.max(5, Math.min(p.yOutflow - 45, flowChartProps.height - flowChartProps.paddingBottom - 50))}
                                width="140"
                                height="42"
                                rx="6"
                                fill="rgba(15, 23, 42, 0.95)"
                                stroke="rgba(14, 165, 233, 0.2)"
                                strokeWidth="1"
                              />
                              {/* Tooltip Qx */}
                              <text
                                x={Math.max(flowChartProps.paddingLeft + 70, Math.min(p.x, flowChartProps.width - flowChartProps.paddingRight - 70))}
                                y={Math.max(16, Math.min(p.yOutflow - 34, flowChartProps.height - flowChartProps.paddingBottom - 38))}
                                fill="var(--color-primary)"
                                fontSize="9"
                                fontWeight="700"
                                textAnchor="middle"
                              >
                                Xả (Qx): {p.q_x.toLocaleString()} m³/s
                              </text>
                              {/* Tooltip Qve */}
                              <text
                                x={Math.max(flowChartProps.paddingLeft + 70, Math.min(p.x, flowChartProps.width - flowChartProps.paddingRight - 70))}
                                y={Math.max(28, Math.min(p.yOutflow - 22, flowChartProps.height - flowChartProps.paddingBottom - 26))}
                                fill="var(--color-success)"
                                fontSize="9"
                                fontWeight="700"
                                textAnchor="middle"
                              >
                                Về (Qve): {p.qve.toLocaleString()} m³/s
                              </text>
                              {/* Tooltip Date */}
                              <text
                                x={Math.max(flowChartProps.paddingLeft + 70, Math.min(p.x, flowChartProps.width - flowChartProps.paddingRight - 70))}
                                y={Math.max(40, Math.min(p.yOutflow - 10, flowChartProps.height - flowChartProps.paddingBottom - 14))}
                                fill="var(--text-muted)"
                                fontSize="7"
                                textAnchor="middle"
                              >
                                {new Date(p.time).toLocaleDateString('vi-VN', {month: '2-digit', day: '2-digit'})} {new Date(p.time).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                              </text>
                            </g>
                          );
                        })()}

                        {/* Interactive overlay target */}
                        <rect
                          x={flowChartProps.paddingLeft}
                          y={flowChartProps.paddingTop}
                          width={flowChartProps.width - flowChartProps.paddingLeft - flowChartProps.paddingRight}
                          height={flowChartProps.height - flowChartProps.paddingTop - flowChartProps.paddingBottom}
                          fill="transparent"
                          onMouseMove={(e) => handleChartMouseMove(e, flowChartProps.width)}
                          onMouseLeave={handleChartMouseLeave}
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
