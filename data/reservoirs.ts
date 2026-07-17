export interface SeasonalPhase {
  name: string;
  startMonth: number; // 1-indexed (1-12)
  startDay: number;
  endMonth: number;
  endDay: number;
  hControl: number; // Controlled water level elevation (m)
}

export interface ReservoirMetadata {
  name: string;
  riverBasin: string;
  region: string;
  hdbt: number; // Normal water level (m)
  hc: number; // Dead water level reported by EVN (m)
  hMinOp: number; // Minimum operational limit (m) (e.g. 81.5m for Hoa Binh)
  seasons: SeasonalPhase[];
  installedCapacity?: number; // Installed Capacity (MW)
  tailraceElev?: number; // Average tailrace elevation / turbine center (m)
  wTotal?: number; // Total capacity (million m3)
  wActive?: number; // Active capacity (million m3)
  wDead?: number; // Dead capacity (million m3)
  wFlood?: number; // Flood control capacity (million m3)
  volumeExponent?: number; // Exponent for capacity curve calculation (e.g. 1.0 for linear canyon, 2.0 for quadratic valley)
  hMaxTechnical?: number; // Check flood level / Maximum technical safety limit (m)
  emergencyBreachNotes?: string; // Standard operational instructions for emergency breach of auxiliary dams
}

export const reservoirsMetadata: Record<string, ReservoirMetadata> = {
  // --- Đông Bắc Bộ ---
  "Tuyên Quang": {
    name: "Tuyên Quang",
    riverBasin: "Sông Gâm / Sông Lô",
    region: "Đông Bắc Bộ",
    hdbt: 120.0,
    hc: 90.0,
    hMinOp: 90.0,
    installedCapacity: 342,
    tailraceElev: 50.0,
    hMaxTechnical: 122.6,
    wTotal: 2240,
    wActive: 1700,
    wDead: 540,
    wFlood: 1000,
    volumeExponent: 1.3,
    seasons: [
      { name: "Lũ sớm", startMonth: 6, startDay: 15, endMonth: 7, endDay: 19, hControl: 118.0 },
      { name: "Lũ chính vụ", startMonth: 7, startDay: 20, endMonth: 8, endDay: 21, hControl: 105.2 },
      { name: "Lũ muộn", startMonth: 8, startDay: 22, endMonth: 9, endDay: 15, hControl: 110.0 },
      { name: "Mùa cạn", startMonth: 9, startDay: 16, endMonth: 6, endDay: 14, hControl: 120.0 }
    ]
  },
  "Thác Bà": {
    name: "Thác Bà",
    riverBasin: "Sông Chảy",
    region: "Đông Bắc Bộ",
    hdbt: 58.0,
    hc: 46.0,
    hMinOp: 46.0,
    installedCapacity: 120,
    tailraceElev: 18.0,
    hMaxTechnical: 61.0,
    emergencyBreachNotes: "Mực nước vượt 59.6m và tiếp tục tăng bắt buộc chuẩn bị phương án nổ mìn/máy xúc phá đập đất phụ số 4 (đập phụ sự cố) để xả lũ khẩn cấp, cứu đập chính Thác Bà.",
    wTotal: 2490,
    wActive: 2160,
    wDead: 330,
    wFlood: 450,
    volumeExponent: 1.3,
    seasons: [
      { name: "Lũ sớm", startMonth: 6, startDay: 15, endMonth: 7, endDay: 19, hControl: 57.0 },
      { name: "Lũ chính vụ", startMonth: 7, startDay: 20, endMonth: 8, endDay: 21, hControl: 56.0 },
      { name: "Lũ muộn", startMonth: 8, startDay: 22, endMonth: 9, endDay: 15, hControl: 56.0 },
      { name: "Mùa cạn", startMonth: 9, startDay: 16, endMonth: 6, endDay: 14, hControl: 58.0 }
    ]
  },

  // --- Tây Bắc Bộ ---
  "Sơn La": {
    name: "Sơn La",
    riverBasin: "Sông Đà",
    region: "Tây Bắc Bộ",
    hdbt: 215.0,
    hc: 175.0,
    hMinOp: 175.0,
    installedCapacity: 2400,
    tailraceElev: 115.0,
    hMaxTechnical: 217.8,
    wTotal: 9260,
    wActive: 6530,
    wDead: 2730,
    wFlood: 4000,
    volumeExponent: 1.6,
    seasons: [
      { name: "Lũ sớm", startMonth: 6, startDay: 15, endMonth: 7, endDay: 19, hControl: 205.0 },
      { name: "Lũ chính vụ", startMonth: 7, startDay: 20, endMonth: 8, endDay: 21, hControl: 194.0 },
      { name: "Lũ muộn", startMonth: 8, startDay: 22, endMonth: 9, endDay: 15, hControl: 200.0 },
      { name: "Mùa cạn", startMonth: 9, startDay: 16, endMonth: 6, endDay: 14, hControl: 215.0 }
    ]
  },
  "Hòa Bình": {
    name: "Hòa Bình",
    riverBasin: "Sông Đà",
    region: "Tây Bắc Bộ",
    hdbt: 117.0,
    hc: 80.0,
    hMinOp: 81.5, // Operational dead limit requested
    installedCapacity: 2400, // Includes 480 MW expansion (2 x 240 MW)
    tailraceElev: 13.0,
    hMaxTechnical: 122.0,
    wTotal: 9450,
    wActive: 5600,
    wDead: 3850,
    wFlood: 3000,
    volumeExponent: 1.4,
    seasons: [
      { name: "Lũ sớm", startMonth: 6, startDay: 15, endMonth: 7, endDay: 19, hControl: 105.0 },
      { name: "Lũ chính vụ", startMonth: 7, startDay: 20, endMonth: 8, endDay: 21, hControl: 101.0 },
      { name: "Lũ muộn", startMonth: 8, startDay: 22, endMonth: 9, endDay: 15, hControl: 103.0 },
      { name: "Mùa cạn", startMonth: 9, startDay: 16, endMonth: 6, endDay: 14, hControl: 117.0 }
    ]
  },
  "Lai Châu": {
    name: "Lai Châu",
    riverBasin: "Sông Đà",
    region: "Tây Bắc Bộ",
    hdbt: 295.0,
    hc: 265.0,
    hMinOp: 265.0,
    installedCapacity: 1200, // 3 x 400 MW
    tailraceElev: 200.0,
    hMaxTechnical: 300.0,
    wTotal: 1215.1,
    wActive: 799.7,
    wDead: 415.4,
    volumeExponent: 1.0,
    seasons: [
      { name: "Lũ sớm", startMonth: 6, startDay: 15, endMonth: 7, endDay: 19, hControl: 290.0 },
      { name: "Lũ chính vụ", startMonth: 7, startDay: 20, endMonth: 8, endDay: 21, hControl: 290.0 },
      { name: "Lũ muộn", startMonth: 8, startDay: 22, endMonth: 9, endDay: 15, hControl: 290.0 },
      { name: "Mùa cạn", startMonth: 9, startDay: 16, endMonth: 6, endDay: 14, hControl: 295.0 }
    ]
  },
  "Bản Chát": {
    name: "Bản Chát",
    riverBasin: "Sông Đà",
    region: "Tây Bắc Bộ",
    hdbt: 475.0,
    hc: 431.0,
    hMinOp: 431.0,
    installedCapacity: 220, // 2 x 110 MW
    tailraceElev: 375.0,
    hMaxTechnical: 480.0,
    wTotal: 1622,
    wActive: 1202,
    wDead: 420,
    volumeExponent: 1.0,
    seasons: [
      { name: "Mùa lũ", startMonth: 6, startDay: 15, endMonth: 9, endDay: 15, hControl: 470.0 },
      { name: "Mùa cạn", startMonth: 9, startDay: 16, endMonth: 6, endDay: 14, hControl: 475.0 }
    ]
  },
  "Huội Quảng": {
    name: "Huội Quảng",
    riverBasin: "Sông Đà",
    region: "Tây Bắc Bộ",
    hdbt: 370.0,
    hc: 368.0,
    hMinOp: 368.0,
    installedCapacity: 520, // 2 x 260 MW (first underground hydro in VN)
    tailraceElev: 215.0,
    hMaxTechnical: 372.0,
    wTotal: 184,
    wActive: 16,
    wDead: 168,
    volumeExponent: 1.0,
    seasons: [
      { name: "Mùa lũ", startMonth: 6, startDay: 15, endMonth: 9, endDay: 15, hControl: 369.0 },
      { name: "Mùa cạn", startMonth: 9, startDay: 16, endMonth: 6, endDay: 14, hControl: 370.0 }
    ]
  },

  // --- Bắc Trung Bộ ---
  "Bản Vẽ": {
    name: "Bản Vẽ",
    riverBasin: "Sông Cả",
    region: "Bắc Trung Bộ",
    hdbt: 200.0,
    hc: 155.0,
    hMinOp: 155.0,
    wTotal: 1834.6,
    wActive: 1383.0,
    wDead: 451.6,
    seasons: [
      { name: "Lũ chính vụ", startMonth: 7, startDay: 20, endMonth: 11, endDay: 30, hControl: 192.5 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 7, endDay: 19, hControl: 200.0 }
    ]
  },
  "Trung Sơn": {
    name: "Trung Sơn",
    riverBasin: "Sông Mã",
    region: "Bắc Trung Bộ",
    hdbt: 160.0,
    hc: 150.0,
    hMinOp: 150.0,
    installedCapacity: 260,
    tailraceElev: 118.0,
    wTotal: 348.5,
    wActive: 112.1,
    wDead: 236.4,
    wFlood: 112.0,
    volumeExponent: 1.0,
    seasons: [
      { name: "Mùa lũ", startMonth: 6, startDay: 15, endMonth: 10, endDay: 15, hControl: 155.0 },
      { name: "Mùa cạn", startMonth: 10, startDay: 16, endMonth: 6, endDay: 14, hControl: 160.0 }
    ]
  },
  "KHE BỐ": {
    name: "KHE BỐ",
    riverBasin: "Sông Cả",
    region: "Bắc Trung Bộ",
    hdbt: 65.0,
    hc: 63.0,
    hMinOp: 63.0,
    wTotal: 97.8,
    wActive: 17.2,
    wDead: 80.6,
    seasons: [
      { name: "Mùa lũ", startMonth: 7, startDay: 20, endMonth: 11, endDay: 30, hControl: 64.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 7, endDay: 19, hControl: 65.0 }
    ]
  },
  "Quảng Trị": {
    name: "Quảng Trị",
    riverBasin: "Sông Rào Quán",
    region: "Bắc Trung Bộ",
    hdbt: 480.0,
    hc: 450.0,
    hMinOp: 450.0,
    wTotal: 163.0,
    wActive: 142.0,
    wDead: 21.0,
    wFlood: 30.0,
    seasons: [
      { name: "Mùa lũ", startMonth: 9, startDay: 1, endMonth: 12, endDay: 15, hControl: 475.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 16, endMonth: 8, endDay: 31, hControl: 480.0 }
    ]
  },

  // --- Nam Trung Bộ ---
  "A Vương": {
    name: "A Vương",
    riverBasin: "Sông Vu Gia - Thu Bồn",
    region: "Nam Trung Bộ",
    hdbt: 380.0,
    hc: 340.0,
    hMinOp: 340.0,
    wTotal: 343.55,
    wActive: 266.5,
    wDead: 77.05,
    seasons: [
      { name: "Mùa lũ", startMonth: 9, startDay: 1, endMonth: 12, endDay: 15, hControl: 370.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 16, endMonth: 8, endDay: 31, hControl: 380.0 }
    ]
  },
  "Sông Bung 2": {
    name: "Sông Bung 2",
    riverBasin: "Sông Vu Gia - Thu Bồn",
    region: "Nam Trung Bộ",
    hdbt: 605.0,
    hc: 565.0,
    hMinOp: 565.0,
    wTotal: 94.3,
    wActive: 51.7,
    wDead: 42.6,
    seasons: [
      { name: "Mùa lũ", startMonth: 9, startDay: 1, endMonth: 12, endDay: 15, hControl: 595.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 16, endMonth: 8, endDay: 31, hControl: 605.0 }
    ]
  },
  "Sông Bung 4": {
    name: "Sông Bung 4",
    riverBasin: "Sông Vu Gia - Thu Bồn",
    region: "Nam Trung Bộ",
    hdbt: 222.5,
    hc: 205.0,
    hMinOp: 205.0,
    wTotal: 510.8,
    wActive: 234.0,
    wDead: 276.8,
    seasons: [
      { name: "Mùa lũ", startMonth: 9, startDay: 1, endMonth: 12, endDay: 15, hControl: 216.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 16, endMonth: 8, endDay: 31, hControl: 222.5 }
    ]
  },
  "Sông Tranh 2": {
    name: "Sông Tranh 2",
    riverBasin: "Sông Vu Gia - Thu Bồn",
    region: "Nam Trung Bộ",
    hdbt: 175.0,
    hc: 140.0,
    hMinOp: 140.0,
    wTotal: 730.0,
    wActive: 500.0,
    wDead: 230.0,
    seasons: [
      { name: "Mùa lũ", startMonth: 9, startDay: 1, endMonth: 12, endDay: 15, hControl: 170.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 16, endMonth: 8, endDay: 31, hControl: 175.0 }
    ]
  },
  "Sông Ba Hạ": {
    name: "Sông Ba Hạ",
    riverBasin: "Sông Ba",
    region: "Nam Trung Bộ",
    hdbt: 105.0,
    hc: 101.0,
    hMinOp: 101.0,
    wTotal: 395.0,
    wActive: 165.9,
    wDead: 229.1,
    seasons: [
      { name: "Mùa lũ", startMonth: 9, startDay: 15, endMonth: 12, endDay: 15, hControl: 103.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 16, endMonth: 9, endDay: 14, hControl: 105.0 }
    ]
  },
  "Sông Hinh": {
    name: "Sông Hinh",
    riverBasin: "Sông Ba",
    region: "Nam Trung Bộ",
    hdbt: 209.0,
    hc: 196.0,
    hMinOp: 196.0,
    wTotal: 357.0,
    wActive: 323.0,
    wDead: 34.0,
    seasons: [
      { name: "Mùa lũ", startMonth: 9, startDay: 15, endMonth: 12, endDay: 15, hControl: 203.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 16, endMonth: 9, endDay: 14, hControl: 209.0 }
    ]
  },
  "Vĩnh Sơn A": {
    name: "Vĩnh Sơn A",
    riverBasin: "Sông Kôn",
    region: "Nam Trung Bộ",
    hdbt: 775.0,
    hc: 765.0,
    hMinOp: 765.0,
    wTotal: 147.3,
    wActive: 123.3,
    wDead: 24.0,
    seasons: [
      { name: "Mùa lũ", startMonth: 9, startDay: 1, endMonth: 12, endDay: 15, hControl: 772.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 16, endMonth: 8, endDay: 31, hControl: 775.0 }
    ]
  },
  "Vĩnh Sơn B": {
    name: "Vĩnh Sơn B",
    riverBasin: "Sông Kôn",
    region: "Nam Trung Bộ",
    hdbt: 826.0,
    hc: 813.6,
    hMinOp: 813.6,
    wTotal: 108.3,
    wActive: 97.8,
    wDead: 10.5,
    seasons: [
      { name: "Mùa lũ", startMonth: 9, startDay: 1, endMonth: 12, endDay: 15, hControl: 822.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 16, endMonth: 8, endDay: 31, hControl: 826.0 }
    ]
  },
  "Vĩnh Sơn C": {
    name: "Vĩnh Sơn C",
    riverBasin: "Sông Kôn",
    region: "Nam Trung Bộ",
    hdbt: 981.0,
    hc: 971.3,
    hMinOp: 971.3,
    wTotal: 58.0,
    wActive: 35.0,
    wDead: 23.0,
    seasons: [
      { name: "Mùa lũ", startMonth: 9, startDay: 1, endMonth: 12, endDay: 15, hControl: 976.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 16, endMonth: 8, endDay: 31, hControl: 981.0 }
    ]
  },

  // --- Tây Nguyên ---
  "Thượng Kon Tum": {
    name: "Thượng Kon Tum",
    riverBasin: "Sông Sê San",
    region: "Tây Nguyên",
    hdbt: 1160.0,
    hc: 1138.0,
    hMinOp: 1138.0,
    wTotal: 145.52,
    wActive: 103.1,
    wDead: 42.42,
    seasons: [
      { name: "Mùa lũ", startMonth: 6, startDay: 15, endMonth: 11, endDay: 30, hControl: 1150.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 6, endDay: 14, hControl: 1160.0 }
    ]
  },
  "Pleikrông": {
    name: "Pleikrông",
    riverBasin: "Sông Sê San",
    region: "Tây Nguyên",
    hdbt: 570.0,
    hc: 537.0,
    hMinOp: 537.0,
    wTotal: 1048.7,
    wActive: 948.0,
    wDead: 100.7,
    seasons: [
      { name: "Mùa lũ", startMonth: 6, startDay: 15, endMonth: 11, endDay: 30, hControl: 560.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 6, endDay: 14, hControl: 570.0 }
    ]
  },
  "Ialy": {
    name: "Ialy",
    riverBasin: "Sông Sê San",
    region: "Tây Nguyên",
    hdbt: 515.0,
    hc: 490.0,
    hMinOp: 490.0,
    wTotal: 1037.0,
    wActive: 779.02,
    wDead: 258.07,
    seasons: [
      { name: "Mùa lũ", startMonth: 6, startDay: 15, endMonth: 11, endDay: 30, hControl: 506.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 6, endDay: 14, hControl: 515.0 }
    ]
  },
  "Sê San 3": {
    name: "Sê San 3",
    riverBasin: "Sông Sê San",
    region: "Tây Nguyên",
    hdbt: 304.5,
    hc: 303.2,
    hMinOp: 303.2,
    wTotal: 92.0,
    wActive: 38.0,
    wDead: 54.0,
    seasons: [
      { name: "Mùa lũ", startMonth: 6, startDay: 15, endMonth: 11, endDay: 30, hControl: 304.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 6, endDay: 14, hControl: 304.5 }
    ]
  },
  "Sê San 3A": {
    name: "Sê San 3A",
    riverBasin: "Sông Sê San",
    region: "Tây Nguyên",
    hdbt: 239.0,
    hc: 238.5,
    hMinOp: 238.5,
    wTotal: 80.6,
    wActive: 4.0,
    wDead: 76.6,
    seasons: [
      { name: "Mùa lũ", startMonth: 6, startDay: 15, endMonth: 11, endDay: 30, hControl: 238.8 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 6, endDay: 14, hControl: 239.0 }
    ]
  },
  "Sê San 4": {
    name: "Sê San 4",
    riverBasin: "Sông Sê San",
    region: "Tây Nguyên",
    hdbt: 215.0,
    hc: 210.0,
    hMinOp: 210.0,
    wTotal: 893.3,
    wActive: 264.16,
    wDead: 629.14,
    seasons: [
      { name: "Mùa lũ", startMonth: 6, startDay: 15, endMonth: 11, endDay: 30, hControl: 212.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 6, endDay: 14, hControl: 215.0 }
    ]
  },
  "Kanak": {
    name: "Kanak",
    riverBasin: "Sông Ba",
    region: "Tây Nguyên",
    hdbt: 515.0,
    hc: 485.0,
    hMinOp: 485.0,
    wTotal: 313.7,
    wActive: 285.5,
    wDead: 28.2,
    seasons: [
      { name: "Mùa lũ", startMonth: 9, startDay: 15, endMonth: 12, endDay: 15, hControl: 505.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 16, endMonth: 9, endDay: 14, hControl: 515.0 }
    ]
  },
  "An Khê": {
    name: "An Khê",
    riverBasin: "Sông Ba",
    region: "Tây Nguyên",
    hdbt: 429.0,
    hc: 427.0,
    hMinOp: 427.0,
    wTotal: 15.9,
    wActive: 5.6,
    wDead: 10.3,
    seasons: [
      { name: "Mùa lũ", startMonth: 9, startDay: 15, endMonth: 12, endDay: 15, hControl: 428.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 16, endMonth: 9, endDay: 14, hControl: 429.0 }
    ]
  },
  "Srêpốk 3": {
    name: "Srêpốk 3",
    riverBasin: "Sông Srêpốk",
    region: "Tây Nguyên",
    hdbt: 272.0,
    hc: 268.0,
    hMinOp: 268.0,
    wTotal: 218.99,
    wActive: 62.85,
    wDead: 156.14,
    seasons: [
      { name: "Mùa lũ", startMonth: 6, startDay: 15, endMonth: 11, endDay: 30, hControl: 270.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 6, endDay: 14, hControl: 272.0 }
    ]
  },
  "Buôn Kuốp": {
    name: "Buôn Kuốp",
    riverBasin: "Sông Srêpốk",
    region: "Tây Nguyên",
    hdbt: 412.0,
    hc: 409.0,
    hMinOp: 409.0,
    wTotal: 63.24,
    wActive: 14.7,
    wDead: 48.54,
    seasons: [
      { name: "Mùa lũ", startMonth: 6, startDay: 15, endMonth: 11, endDay: 30, hControl: 410.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 6, endDay: 14, hControl: 412.0 }
    ]
  },
  "Buôn Tua Srah": {
    name: "Buôn Tua Srah",
    riverBasin: "Sông Srêpốk",
    region: "Tây Nguyên",
    hdbt: 487.5,
    hc: 465.0,
    hMinOp: 465.0,
    wTotal: 786.9,
    wActive: 522.6,
    wDead: 264.3,
    seasons: [
      { name: "Mùa lũ", startMonth: 6, startDay: 15, endMonth: 11, endDay: 30, hControl: 475.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 6, endDay: 14, hControl: 487.5 }
    ]
  },
  "Đồng Nai 3": {
    name: "Đồng Nai 3",
    riverBasin: "Sông Đồng Nai",
    region: "Tây Nguyên",
    hdbt: 590.0,
    hc: 570.0,
    hMinOp: 570.0,
    wTotal: 1690.1,
    wActive: 903.0,
    wDead: 787.1,
    seasons: [
      { name: "Mùa lũ", startMonth: 7, startDay: 1, endMonth: 11, endDay: 30, hControl: 582.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 6, endDay: 30, hControl: 590.0 }
    ]
  },
  "Đơn Dương": {
    name: "Đơn Dương",
    riverBasin: "Sông Đồng Nai",
    region: "Tây Nguyên",
    hdbt: 1042.0,
    hc: 1018.0,
    hMinOp: 1018.0,
    wTotal: 165.0,
    wActive: 155.14,
    wDead: 9.86,
    seasons: [
      { name: "Mùa lũ", startMonth: 7, startDay: 1, endMonth: 11, endDay: 30, hControl: 1038.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 6, endDay: 30, hControl: 1042.0 }
    ]
  },
  "Đại Ninh": {
    name: "Đại Ninh",
    riverBasin: "Sông Đồng Nai",
    region: "Tây Nguyên",
    hdbt: 880.0,
    hc: 860.0,
    hMinOp: 860.0,
    wTotal: 319.77,
    wActive: 251.73,
    wDead: 68.04,
    seasons: [
      { name: "Mùa lũ", startMonth: 7, startDay: 1, endMonth: 11, endDay: 30, hControl: 874.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 6, endDay: 30, hControl: 880.0 }
    ]
  },
  "Hàm Thuận": {
    name: "Hàm Thuận",
    riverBasin: "Sông Đồng Nai",
    region: "Tây Nguyên",
    hdbt: 605.0,
    hc: 575.0,
    hMinOp: 575.0,
    wTotal: 695.0,
    wActive: 523.0,
    wDead: 172.0,
    seasons: [
      { name: "Mùa lũ", startMonth: 7, startDay: 1, endMonth: 11, endDay: 30, hControl: 600.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 6, endDay: 30, hControl: 605.0 }
    ]
  },
  "Đa Mi": {
    name: "Đa Mi",
    riverBasin: "Sông Đồng Nai",
    region: "Tây Nguyên",
    hdbt: 325.0,
    hc: 323.0,
    hMinOp: 323.0,
    wTotal: 140.8,
    wActive: 11.6,
    wDead: 129.2,
    seasons: [
      { name: "Mùa lũ", startMonth: 7, startDay: 1, endMonth: 11, endDay: 30, hControl: 324.5 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 6, endDay: 30, hControl: 325.0 }
    ]
  },

  // --- Đông Nam Bộ ---
  "Trị An": {
    name: "Trị An",
    riverBasin: "Sông Đồng Nai",
    region: "Đông Nam Bộ",
    hdbt: 62.0,
    hc: 50.0,
    hMinOp: 50.0,
    wTotal: 2765.0,
    wActive: 2547.0,
    wDead: 218.0,
    seasons: [
      { name: "Mùa lũ", startMonth: 7, startDay: 1, endMonth: 11, endDay: 30, hControl: 60.8 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 6, endDay: 30, hControl: 62.0 }
    ]
  },
  "Đồng Nai 4": {
    name: "Đồng Nai 4",
    riverBasin: "Sông Đồng Nai",
    region: "Đông Nam Bộ",
    hdbt: 476.0,
    hc: 474.0,
    hMinOp: 474.0,
    wTotal: 337.2,
    wActive: 16.7,
    wDead: 320.5,
    seasons: [
      { name: "Mùa lũ", startMonth: 7, startDay: 1, endMonth: 11, endDay: 30, hControl: 475.0 },
      { name: "Mùa cạn", startMonth: 12, startDay: 1, endMonth: 6, endDay: 30, hControl: 476.0 }
    ]
  }
};

/**
 * Returns the active seasonal phase and next transition details for a reservoir on a given date.
 */
export function getActiveSeasonAndTransition(
  metadata: ReservoirMetadata,
  date: Date = new Date()
): {
  activePhase: SeasonalPhase;
  daysToTransition: number;
  nextPhase: SeasonalPhase | null;
} {
  const seasons = metadata.seasons;
  if (!seasons || seasons.length === 0) {
    // Default fallback to keep it working
    const fallbackPhase: SeasonalPhase = {
      name: "Bình thường",
      startMonth: 1,
      startDay: 1,
      endMonth: 12,
      endDay: 31,
      hControl: metadata.hdbt
    };
    return { activePhase: fallbackPhase, daysToTransition: 999, nextPhase: null };
  }

  const currentYear = date.getFullYear();

  // Helper to parse phase start/end into absolute timestamps for active checking
  const getPhaseDates = (phase: SeasonalPhase, year: number) => {
    let start = new Date(year, phase.startMonth - 1, phase.startDay, 0, 0, 0);
    let end = new Date(year, phase.endMonth - 1, phase.endDay, 23, 59, 59);
    
    // Handle wrap-around year transition (e.g. Dec to June)
    if (start.getTime() > end.getTime()) {
      // If start is after end, it wraps around the new year
      // Let's check if current date is after start (so end is next year) or before end (so start is previous year)
      const testDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      if (testDate.getTime() >= start.getTime()) {
        end = new Date(year + 1, phase.endMonth - 1, phase.endDay, 23, 59, 59);
      } else {
        start = new Date(year - 1, phase.startMonth - 1, phase.startDay, 0, 0, 0);
      }
    }
    return { start, end };
  };

  // Find active phase
  let activePhase: SeasonalPhase | null = null;
  let activeIndex = -1;

  for (let i = 0; i < seasons.length; i++) {
    const { start, end } = getPhaseDates(seasons[i], currentYear);
    if (date.getTime() >= start.getTime() && date.getTime() <= end.getTime()) {
      activePhase = seasons[i];
      activeIndex = i;
      break;
    }
  }

  // Fallback in case date ranges have tiny overlaps/gaps due to leap years or timezone shifts
  if (!activePhase) {
    activePhase = seasons[0];
    activeIndex = 0;
  }

  // Find next phase
  const nextIndex = (activeIndex + 1) % seasons.length;
  const nextPhase = seasons[nextIndex];

  // Calculate days to next transition
  const { start: nextStart } = getPhaseDates(nextPhase, currentYear);
  let nextStartTime = nextStart.getTime();

  // If next phase starts in a past date for current year, it must be for next year
  if (nextStartTime < date.getTime()) {
    const nextYearStart = getPhaseDates(nextPhase, currentYear + 1).start;
    nextStartTime = nextYearStart.getTime();
  }

  const msDiff = nextStartTime - date.getTime();
  const daysToTransition = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

  return { activePhase, daysToTransition, nextPhase };
}

/**
 * Calculates estimated hydroelectric power generation (in MW) and energy (in kWh per hour).
 * Uses the formula: P (kW) = eta * rho * g * Q * H
 * => P (kW) = 0.85 * 1000 * 9.81 * Qxm * (Htl - tailraceElev) / 1000
 * => P (MW) = P (kW) / 1000
 */
export function estimateHydroPower(
  htl: number,
  qxm: number,
  tailraceElev?: number,
  installedCapacity?: number
): { powerMW: number; energyKwh: number } {
  if (!tailraceElev || qxm <= 0 || htl <= tailraceElev) {
    return { powerMW: 0, energyKwh: 0 };
  }

  const head = htl - tailraceElev;
  const eta = 0.85; // average turbine-generator efficiency
  const g = 9.81;
  
  // Power in kW
  let powerKw = eta * g * qxm * head;
  
  // Cap at installed capacity if metadata is available
  if (installedCapacity) {
    powerKw = Math.min(powerKw, installedCapacity * 1000);
  }
  
  const powerMW = parseFloat((powerKw / 1000).toFixed(1));
  const energyKwh = Math.round(powerKw); // 1 hour of generating at P kW yields P kWh

  return { powerMW, energyKwh };
}

