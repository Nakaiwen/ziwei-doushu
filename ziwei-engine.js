/* =============================================================================
 * 紫微斗數 安星引擎  ziwei-engine.js
 * 小六太乙 · 紫微斗數盤工具
 *
 * 設計原則：
 *   1. 純函式、零外部相依，可在瀏覽器或 node 直接執行。
 *   2. 國曆 → 農曆（年月日 + 閏月）採內建 lunarInfo(1900-2100) 對照表，
 *      與隔壁 bazi-tool 的 solar-lunar.js 用途互補：
 *        - solar-lunar.js 以「節氣」定月、計四柱干支（八字用）；
 *        - 本引擎以「正月初一」定農曆年、需要真正的農曆「月數 / 日數 / 閏月」，
 *          這是紫微定命宮、起紫微所必需，solar-lunar.js 並未提供，故另建。
 *   3. 安星法以「中州派 / 三合派」通行安法為主，凡有流派分歧者於 NOTES 標註，
 *      畫面上也會提示，方便核對。
 *
 * 已用 Nakai 命例（國曆1976/10/14 亥時，陽女）驗證：
 *   閏八月21日 → 命宮己亥、木三局、命主巨門、身主文昌、身宮在酉(夫妻宮)。
 * ============================================================================= */
(function (global, factory) {
  typeof module !== 'undefined' && module.exports ? (module.exports = factory())
    : (global.ziweiEngine = factory());
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---- 基礎常數 ---------------------------------------------------------------
  const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const ZODIAC = ['鼠', '牛', '虎', '兔', '龍', '蛇', '馬', '羊', '猴', '雞', '狗', '豬'];
  const HOUR_LABEL = ['子(23-01)', '丑(01-03)', '寅(03-05)', '卯(05-07)', '辰(07-09)',
    '巳(09-11)', '午(11-13)', '未(13-15)', '申(15-17)', '酉(17-19)', '戌(19-21)', '亥(21-23)'];
  const PALACE_NAMES = ['命宮', '兄弟', '夫妻', '子女', '財帛', '疾厄',
    '遷移', '交友', '官祿', '田宅', '福德', '父母'];

  const NOTES = []; // 收集本次排盤採用的流派說明，回傳給 UI 顯示

  // ---- 農曆對照表 lunarInfo 1900-2100 ----------------------------------------
  // 每年一個 hex：bit16=閏月大小(1=30天)，bit15..4 為 1~12 月大小(1=30天)，bit3..0 = 閏月月份(0=無閏月)
  // 來源為通行的 solarlunar / calendar.js 對照表，已對 1976=0x0d558(閏8月) 等抽驗。
  const lunarInfo = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
    0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
    0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, // 2050-2059
    0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
    0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
    0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252, // 2090-2099
    0x0d520 // 2100
  ];

  function leapMonth(y) { return lunarInfo[y - 1900] & 0xf; }
  function leapDays(y) {
    if (leapMonth(y)) return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29;
    return 0;
  }
  function monthDays(y, m) { return (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
  function yearDays(y) {
    let sum = 348; // 12*29
    for (let i = 0x8000; i > 0x8; i >>= 1) sum += (lunarInfo[y - 1900] & i) ? 1 : 0;
    return sum + leapDays(y);
  }

  // 國曆(西元) → 農曆 ：回傳 { lYear, lMonth, lDay, isLeap }
  function solarToLunar(y, m, d) {
    const baseUTC = Date.UTC(1900, 0, 31); // 農曆 1900-01-01 = 西元 1900-01-31
    let offset = Math.floor((Date.UTC(y, m - 1, d) - baseUTC) / 86400000);
    let ly = 1900, temp = 0;
    for (; ly < 2101 && offset > 0; ly++) {
      temp = yearDays(ly);
      offset -= temp;
    }
    if (offset < 0) { offset += temp; ly--; }
    const leap = leapMonth(ly);
    let isLeap = false, lm = 1;
    for (; lm < 13 && offset > 0; lm++) {
      if (leap > 0 && lm === leap + 1 && !isLeap) {
        lm--; isLeap = true; temp = leapDays(ly);
      } else {
        temp = monthDays(ly, lm);
      }
      if (isLeap && lm === leap + 1) isLeap = false;
      offset -= temp;
    }
    if (offset === 0 && leap > 0 && lm === leap + 1) {
      if (isLeap) isLeap = false; else { isLeap = true; lm--; }
    }
    if (offset < 0) { offset += temp; lm--; }
    return { lYear: ly, lMonth: lm, lDay: offset + 1, isLeap: isLeap };
  }

  function yearGanZhi(lYear) {
    let g = (lYear - 4) % 10, z = (lYear - 4) % 12;
    if (g < 0) g += 10; if (z < 0) z += 12;
    return { ganIndex: g, zhiIndex: z, text: GAN[g] + ZHI[z] };
  }

  // 農曆 → 國曆（給「本月能量」逐日取國曆日期算日柱用）
  function lunarToSolar(lY, lM, lD, isLeap) {
    let off = 0;
    for (let y = 1900; y < lY; y++) off += yearDays(y);
    const leap = leapMonth(lY);
    if (isLeap && leap === lM) {
      for (let m = 1; m <= lM; m++) off += monthDays(lY, m);
    } else {
      for (let m = 1; m < lM; m++) off += monthDays(lY, m);
      if (leap > 0 && leap < lM) off += leapDays(lY);
    }
    off += (lD - 1);
    const dt = new Date(Date.UTC(1900, 0, 31) + off * 86400000);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }
  function lunarMonthLen(lY, lM, isLeap) { return (isLeap && leapMonth(lY) === lM) ? leapDays(lY) : monthDays(lY, lM); }
  function leapMonthOf(lY) { return leapMonth(lY); }

  // ---- 安星規則資料 -----------------------------------------------------------
  // 五虎遁：年干 → 寅宮天干索引
  const YIN_GAN = { 0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6, 3: 8, 8: 8, 4: 0, 9: 0 };

  // 60甲子納音五行 → 局數（水2 木3 金4 土5 火6）。索引 = (年干*? )，這裡用干支文字查表。
  const NAYIN_JU = (function () {
    const pairs = [
      ['甲子', '乙丑', 4], ['丙寅', '丁卯', 6], ['戊辰', '己巳', 3], ['庚午', '辛未', 5], ['壬申', '癸酉', 4],
      ['甲戌', '乙亥', 6], ['丙子', '丁丑', 2], ['戊寅', '己卯', 5], ['庚辰', '辛巳', 4], ['壬午', '癸未', 3],
      ['甲申', '乙酉', 2], ['丙戌', '丁亥', 5], ['戊子', '己丑', 6], ['庚寅', '辛卯', 3], ['壬辰', '癸巳', 2],
      ['甲午', '乙未', 4], ['丙申', '丁酉', 6], ['戊戌', '己亥', 3], ['庚子', '辛丑', 5], ['壬寅', '癸卯', 4],
      ['甲辰', '乙巳', 6], ['丙午', '丁未', 2], ['戊申', '己酉', 5], ['庚戌', '辛亥', 4], ['壬子', '癸丑', 3],
      ['甲寅', '乙卯', 2], ['丙辰', '丁巳', 5], ['戊午', '己未', 6], ['庚申', '辛酉', 3], ['壬戌', '癸亥', 2]
    ];
    const map = {};
    pairs.forEach(([a, b, ju]) => { map[a] = ju; map[b] = ju; });
    return map;
  })();
  const JU_NAME = { 2: '水二局', 3: '木三局', 4: '金四局', 5: '土五局', 6: '火六局' };

  // 命主（依命宮地支）
  const MING_ZHU = ['貪狼', '巨門', '祿存', '文曲', '廉貞', '武曲', '破軍', '武曲', '廉貞', '文曲', '祿存', '巨門'];
  // 身主（依生年地支）
  const SHEN_ZHU = ['鈴星', '天相', '天梁', '天同', '文昌', '天機', '火星', '天相', '天梁', '天同', '文昌', '天機'];

  // 祿存（年干）
  const LU_CUN = { 0: 2, 1: 3, 2: 5, 3: 6, 4: 5, 5: 6, 6: 8, 7: 9, 8: 11, 9: 0 };
  // 天魁、天鉞（年干）
  const KUI_YUE = {
    0: [1, 7], 4: [1, 7], 6: [1, 7],    // 甲戊庚：魁丑 鉞未
    1: [0, 8], 5: [0, 8],               // 乙己：魁子 鉞申
    2: [11, 9], 3: [11, 9],             // 丙丁：魁亥 鉞酉
    7: [6, 2],                          // 辛：魁午 鉞寅
    8: [3, 5], 9: [3, 5]                // 壬癸：魁卯 鉞巳
  };
  // 生年四化（年干 → {星:化}），採中州派通行表（庚干化科取太陰，標註待核）
  const SI_HUA = {
    0: { 廉貞: '祿', 破軍: '權', 武曲: '科', 太陽: '忌' },
    1: { 天機: '祿', 天梁: '權', 紫微: '科', 太陰: '忌' },
    2: { 天同: '祿', 天機: '權', 文昌: '科', 廉貞: '忌' },
    3: { 太陰: '祿', 天同: '權', 天機: '科', 巨門: '忌' },
    4: { 貪狼: '祿', 太陰: '權', 右弼: '科', 天機: '忌' },
    5: { 武曲: '祿', 貪狼: '權', 天梁: '科', 文曲: '忌' },
    6: { 太陽: '祿', 武曲: '權', 太陰: '科', 天同: '忌' },
    7: { 巨門: '祿', 太陽: '權', 文曲: '科', 文昌: '忌' },
    8: { 天梁: '祿', 紫微: '權', 左輔: '科', 武曲: '忌' },
    9: { 破軍: '祿', 巨門: '權', 太陰: '科', 貪狼: '忌' }
  };
  function siHuaByGan(g) { return SI_HUA[g] || {}; }
  function huaTextOf(g) { const m = SI_HUA[g] || {}; return Object.keys(m).map(k => k + m[k]).join('　'); }

  // 火星 / 鈴星 起例（年支三合 → 起宮），再順數至生時。中州派通行。
  const HUO_LING_START = {
    寅: [1, 3], 午: [1, 3], 戌: [1, 3],   // 寅午戌：火起丑 鈴起卯
    申: [2, 10], 子: [2, 10], 辰: [2, 10], // 申子辰：火起寅 鈴起戌
    巳: [3, 10], 酉: [3, 10], 丑: [3, 10], // 巳酉丑：火起卯 鈴起戌
    亥: [9, 10], 卯: [9, 10], 未: [9, 10]  // 亥卯未：火起酉 鈴起戌
  };
  // 天馬（年支三合，馬在四生地）
  const TIAN_MA = { 申: 2, 子: 2, 辰: 2, 寅: 8, 午: 8, 戌: 8, 巳: 11, 酉: 11, 丑: 11, 亥: 5, 卯: 5, 未: 5 };
  // 華蓋 / 咸池（年支三合）
  const HUA_GAI = { 寅: 10, 午: 10, 戌: 10, 申: 4, 子: 4, 辰: 4, 巳: 1, 酉: 1, 丑: 1, 亥: 7, 卯: 7, 未: 7 };
  const XIAN_CHI = { 寅: 3, 午: 3, 戌: 3, 申: 9, 子: 9, 辰: 9, 巳: 6, 酉: 6, 丑: 6, 亥: 0, 卯: 0, 未: 0 };
  // 孤辰寡宿（年支四方）
  const GU_GUA = {
    寅: [5, 1], 卯: [5, 1], 辰: [5, 1],   // 寅卯辰：孤巳 寡丑
    巳: [8, 4], 午: [8, 4], 未: [8, 4],   // 巳午未：孤申 寡辰
    申: [11, 7], 酉: [11, 7], 戌: [11, 7], // 申酉戌：孤亥 寡未
    亥: [2, 10], 子: [2, 10], 丑: [2, 10]  // 亥子丑：孤寅 寡戌
  };
  // 破碎（年支）
  const PO_SUI = { 子: 5, 午: 5, 卯: 5, 酉: 5, 寅: 9, 申: 9, 巳: 9, 亥: 9, 辰: 1, 戌: 1, 丑: 1, 未: 1 };

  // 流年文昌 / 文曲（依流年天干，與本命時系昌曲安法不同）
  const LIU_CHANG = { 0: 5, 1: 6, 2: 8, 3: 9, 4: 8, 5: 9, 6: 11, 7: 0, 8: 2, 9: 3 }; // 甲巳乙午丙申丁酉戊申己酉庚亥辛子壬寅癸卯
  const LIU_QU = { 0: 9, 1: 8, 2: 6, 3: 5, 4: 6, 5: 5, 6: 3, 7: 2, 8: 0, 9: 11 };     // 甲酉乙申丙午丁巳戊午己巳庚卯辛寅壬子癸亥
  // 流年盤：以西元/農曆年取干支，安流年命宮、流年四化、流曜
  function liuNian(year) {
    const g = ((year - 4) % 10 + 10) % 10, z = ((year - 4) % 12 + 12) % 12;
    const lu = LU_CUN[g], luan = ((3 - z) % 12 + 12) % 12;
    const stars = [
      { name: '流祿', zhi: lu }, { name: '流羊', zhi: (lu + 1) % 12 }, { name: '流陀', zhi: (lu + 11) % 12 },
      { name: '流魁', zhi: KUI_YUE[g][0] }, { name: '流鉞', zhi: KUI_YUE[g][1] },
      { name: '流昌', zhi: LIU_CHANG[g] }, { name: '流曲', zhi: LIU_QU[g] },
      { name: '流馬', zhi: TIAN_MA[ZHI[z]] },
      { name: '流鸞', zhi: luan }, { name: '流喜', zhi: (luan + 6) % 12 }
    ];
    return {
      gan: g, zhi: z, ganChar: GAN[g], zhiChar: ZHI[z], ganZhi: GAN[g] + ZHI[z],
      mingZhi: z, hua: siHuaByGan(g), huaText: huaTextOf(g), stars: stars
    };
  }

  // ---- 14主星 廟旺利陷亮度表（子..亥）-----------------------------------------
  // 採通行版本（紫微斗數全書系統），流派略有出入，畫面標註「亮度僅供核對」。
  // 等級：廟 旺 得 利 平 不 陷
  const BRIGHTNESS = {
    紫微: ['平', '廟', '廟', '旺', '陷', '旺', '廟', '廟', '旺', '平', '陷', '旺'],
    天機: ['廟', '陷', '得', '旺', '利', '平', '廟', '陷', '得', '旺', '利', '平'],
    太陽: ['陷', '陷', '旺', '廟', '旺', '旺', '廟', '得', '得', '平', '不', '陷'],
    武曲: ['旺', '廟', '得', '利', '廟', '平', '旺', '廟', '得', '利', '廟', '平'],
    天同: ['旺', '不', '利', '廟', '平', '廟', '陷', '不', '旺', '平', '平', '廟'],
    廉貞: ['平', '利', '廟', '平', '利', '陷', '平', '利', '廟', '平', '利', '陷'],
    天府: ['廟', '廟', '廟', '得', '廟', '得', '旺', '廟', '得', '陷', '廟', '得'],
    太陰: ['廟', '廟', '陷', '陷', '陷', '陷', '不', '不', '利', '旺', '廟', '廟'],
    貪狼: ['旺', '廟', '平', '利', '廟', '陷', '旺', '廟', '平', '利', '廟', '陷'],
    巨門: ['旺', '陷', '廟', '廟', '平', '旺', '旺', '陷', '廟', '廟', '平', '旺'],
    天相: ['廟', '廟', '廟', '陷', '得', '得', '廟', '廟', '廟', '陷', '得', '得'],
    天梁: ['廟', '旺', '廟', '廟', '旺', '陷', '廟', '旺', '陷', '地', '旺', '陷'],
    七殺: ['旺', '廟', '廟', '陷', '廟', '平', '旺', '廟', '廟', '陷', '廟', '平'],
    破軍: ['廟', '旺', '得', '陷', '旺', '平', '廟', '旺', '得', '陷', '旺', '平']
  };

  function brightnessOf(star, zhiIndex) {
    const row = BRIGHTNESS[star];
    return row ? row[zhiIndex] : '';
  }

  // ---- 主流程 -----------------------------------------------------------------
  /**
   * @param {Object} o
   *   o.solarYear, o.solarMonth, o.solarDay  國曆生日
   *   o.hourBranch  時辰地支索引 0(子)..11(亥)
   *   o.gender      'M' | 'F'
   *   o.leapRule    閏月取月規則：'split15'(預設,過十五作下月) | 'thisMonth' | 'nextMonth'
   */
  function computeChart(o) {
    NOTES.length = 0;
    const hb = o.hourBranch;
    const gender = o.gender;
    const lunar = solarToLunar(o.solarYear, o.solarMonth, o.solarDay);

    // 紫微以「正月初一」分年，年干支用農曆年計算
    const yGZ = yearGanZhi(lunar.lYear);
    const yearGan = yGZ.ganIndex, yearZhi = yGZ.zhiIndex;
    const yangYearGan = yearGan % 2 === 0; // 陽干

    // 閏月取月：決定「定命宮/起紫微/月系星」所用的月數
    let monthForChart = lunar.lMonth;
    let leapNote = '';
    if (lunar.isLeap) {
      const rule = o.leapRule || 'split15';
      if (rule === 'thisMonth') {
        monthForChart = lunar.lMonth;
        leapNote = `生於閏${lunar.lMonth}月，採「一律作本月論」。`;
      } else if (rule === 'nextMonth') {
        monthForChart = lunar.lMonth + 1;
        leapNote = `生於閏${lunar.lMonth}月，採「一律作下月論」。`;
      } else {
        monthForChart = lunar.lDay > 15 ? lunar.lMonth + 1 : lunar.lMonth;
        leapNote = `生於閏${lunar.lMonth}月${lunar.lDay}日，採中州派「過十五作下月、十五前作本月」，本盤以「${monthForChart}月」起例。`;
      }
      if (monthForChart > 12) monthForChart = 12;
      NOTES.push('【閏月】' + leapNote);
    }

    // --- 定命宮 / 身宮 ---
    const monthCell = (2 + (monthForChart - 1)) % 12;            // 寅起正月順數
    const mingGong = ((monthCell - hb) % 12 + 12) % 12;          // 命宮：子時起該宮逆數至生時
    const shenGong = (monthCell + hb) % 12;                      // 身宮：順數至生時

    // --- 十二宮地支位置（命宮起，逆佈）---
    const palaceZhi = [];   // palaceZhi[k] = 第k宮(命=0)所在地支索引
    for (let k = 0; k < 12; k++) palaceZhi[k] = ((mingGong - k) % 12 + 12) % 12;

    // --- 各宮天干（五虎遁）---
    const yinGan = YIN_GAN[yearGan];
    function ganOfZhi(zi) { return (yinGan + ((zi - 2) % 12 + 12) % 12) % 10; }
    const zhiGan = [];      // zhiGan[zhiIndex] = 天干索引
    for (let z = 0; z < 12; z++) zhiGan[z] = ganOfZhi(z);

    // --- 五行局（命宮納音）---
    const mingGanZhiText = GAN[zhiGan[mingGong]] + ZHI[mingGong];
    const ju = NAYIN_JU[mingGanZhiText];

    // --- 安紫微（除日定局法）---
    function findZiWei(day, ju) {
      const offset = day % ju;
      let step, reminder;
      if (offset === 0) { step = day / ju; reminder = 0; }
      else { step = Math.floor(day / ju) + 1; reminder = ju - offset; }
      let base = (2 + (step - 1)) % 12;                 // 寅為第1步順數
      if (reminder % 2 === 0) base = (base + reminder) % 12;        // 餘偶數順行
      else base = ((base - reminder) % 12 + 12) % 12;              // 餘奇數逆行
      return base;
    }
    const ziWei = findZiWei(lunar.lDay, ju);
    const tianFu = ((4 - ziWei) % 12 + 12) % 12;

    // --- 安星：星 → 地支索引 ---
    const stars = {}; // 名稱 -> { zhi, type }
    function put(name, zhi, type) { stars[name] = { zhi: ((zhi % 12) + 12) % 12, type: type }; }

    // 紫微星系（逆佈）
    put('紫微', ziWei, '主');
    put('天機', ziWei - 1, '主');
    put('太陽', ziWei - 3, '主');
    put('武曲', ziWei - 4, '主');
    put('天同', ziWei - 5, '主');
    put('廉貞', ziWei - 8, '主');
    // 天府星系（順佈）
    put('天府', tianFu, '主');
    put('太陰', tianFu + 1, '主');
    put('貪狼', tianFu + 2, '主');
    put('巨門', tianFu + 3, '主');
    put('天相', tianFu + 4, '主');
    put('天梁', tianFu + 5, '主');
    put('七殺', tianFu + 6, '主');
    put('破軍', tianFu + 10, '主');

    // 月系星（用 monthForChart）：左輔右弼、天刑天姚
    const zuoFuPos = (4 + monthForChart - 1) % 12;             // 左輔：辰起正月順數
    const youBiPos = ((10 - (monthForChart - 1)) % 12 + 12) % 12; // 右弼：戌起正月逆數
    put('左輔', zuoFuPos, '輔');
    put('右弼', youBiPos, '輔');
    // 三台八座（用生日）：三台由左輔起初一順數、八座由右弼起初一逆數至生日
    put('三台', ((zuoFuPos + (lunar.lDay - 1)) % 12 + 12) % 12, '雜');
    put('八座', ((youBiPos - (lunar.lDay - 1)) % 12 + 12) % 12, '雜');
    put('天刑', (9 + monthForChart - 1) % 12, '雜');   // 酉起正月順數
    put('天姚', (1 + monthForChart - 1) % 12, '雜');   // 丑起正月順數

    // 時系星：文昌文曲、地空地劫、台輔封誥
    put('文昌', ((10 - hb) % 12 + 12) % 12, '輔');     // 戌起子時逆數
    put('文曲', (4 + hb) % 12, '輔');                  // 辰起子時順數
    put('地劫', (11 + hb) % 12, '煞');                 // 亥起子時順數
    put('地空', ((11 - hb) % 12 + 12) % 12, '煞');     // 亥起子時逆數
    put('台輔', (6 + hb) % 12, '雜');                  // 午起子時順數
    put('封誥', (2 + hb) % 12, '雜');                  // 寅起子時順數

    // 年干系：祿存、擎羊、陀羅、天魁、天鉞
    const lc = LU_CUN[yearGan];
    put('祿存', lc, '輔');
    put('擎羊', (lc + 1) % 12, '煞');
    put('陀羅', ((lc - 1) % 12 + 12) % 12, '煞');
    put('天魁', KUI_YUE[yearGan][0], '輔');
    put('天鉞', KUI_YUE[yearGan][1], '輔');

    // 年支系：火星、鈴星（起例 + 順數至生時）、天馬、紅鸞天喜、天哭天虛、龍池鳳閣、孤辰寡宿、華蓋咸池破碎
    const zhiChar = ZHI[yearZhi];
    const hl = HUO_LING_START[zhiChar];
    put('火星', (hl[0] + hb) % 12, '煞');
    put('鈴星', (hl[1] + hb) % 12, '煞');
    put('天馬', TIAN_MA[zhiChar], '雜');
    const hongLuan = ((3 - yearZhi) % 12 + 12) % 12; // 卯起子年逆數
    put('紅鸞', hongLuan, '雜');
    put('天喜', (hongLuan + 6) % 12, '雜');
    put('天哭', ((6 - yearZhi) % 12 + 12) % 12, '雜'); // 午起逆數
    put('天虛', (6 + yearZhi) % 12, '雜');             // 午起順數
    put('龍池', (4 + yearZhi) % 12, '雜');             // 辰起順數
    put('鳳閣', ((10 - yearZhi) % 12 + 12) % 12, '雜'); // 戌起逆數
    put('孤辰', GU_GUA[zhiChar][0], '雜');
    put('寡宿', GU_GUA[zhiChar][1], '雜');
    put('華蓋', HUA_GAI[zhiChar], '雜');
    put('咸池', XIAN_CHI[zhiChar], '雜');
    put('破碎', PO_SUI[zhiChar], '雜');

    NOTES.push('【火鈴】採中州派三合局起例，全書派鈴星起法略異，請核對。');
    NOTES.push('【亮度】14主星廟旺利陷採通行表，僅供參考核對。');
    NOTES.push('【四化】生年／大限／小限四化共用同一張十干四化表，採中州派通行版（庚干化科取太陰、壬干化科取左輔），庚壬兩干各家略異，請核對。');

    // --- 生年四化標記 ---
    const huaMap = SI_HUA[yearGan]; // {星:化}

    // --- 大限 ---
    // 起運歲 = 局數；陽男陰女順行、陰男陽女逆行
    const forward = (yangYearGan && gender === 'M') || (!yangYearGan && gender === 'F');
    NOTES.push(`【大限】${yangYearGan ? '陽' : '陰'}年生${gender === 'M' ? '男' : '女'}，大限${forward ? '順' : '逆'}行，${ju}歲起運。`);
    const daXian = {}; // zhiIndex -> {start,end}
    for (let k = 0; k < 12; k++) {
      const zi = forward ? (mingGong + k) % 12 : ((mingGong - k) % 12 + 12) % 12;
      const start = ju + k * 10;
      daXian[zi] = { start: start, end: start + 9 };
    }

    // --- 小限（一歲起宮，年支三合）---
    const XIAO_START = { 寅: 4, 午: 4, 戌: 4, 申: 10, 子: 10, 辰: 10, 巳: 7, 酉: 7, 丑: 7, 亥: 1, 卯: 1, 未: 1 };
    const xiaoStart = XIAO_START[zhiChar];

    // --- 組裝 12 宮資料 ---
    const palaces = []; // 以地支索引 0..11 為 key 的陣列
    for (let z = 0; z < 12; z++) palaces[z] = {
      zhiIndex: z, zhi: ZHI[z], gan: GAN[zhiGan[z]], ganIndex: zhiGan[z], ganZhi: GAN[zhiGan[z]] + ZHI[z],
      stars: [], palaceName: '', isMing: false, isShen: false,
      daXian: daXian[z] || null
    };
    // 宮名 / 身宮
    for (let k = 0; k < 12; k++) {
      const z = palaceZhi[k];
      palaces[z].palaceName = PALACE_NAMES[k];
      palaces[z].palaceIndex = k;
    }
    palaces[mingGong].isMing = true;
    palaces[shenGong].isShen = true;

    // --- 大限清單（含宮干、四化），供「大限盤」切換 ---
    const daList = [];
    for (let z = 0; z < 12; z++) {
      if (!daXian[z]) continue;
      daList.push({
        zhiIndex: z, zhi: ZHI[z], ganIndex: zhiGan[z], gan: GAN[zhiGan[z]],
        ganZhi: GAN[zhiGan[z]] + ZHI[z], palaceName: palaces[z].palaceName,
        start: daXian[z].start, end: daXian[z].end,
        hua: siHuaByGan(zhiGan[z]), huaText: huaTextOf(zhiGan[z])
      });
    }
    daList.sort((a, b) => a.start - b.start);
    NOTES.push('【小限】一歲起宮採年支三合（申子辰起戌…），行度「男順女逆」，與大限的陰陽順逆判法不同。');

    // 派星進宮（含亮度、四化）
    const ORDER = { 主: 0, 輔: 1, 煞: 2, 雜: 3 };
    Object.keys(stars).forEach(name => {
      const s = stars[name];
      palaces[s.zhi].stars.push({
        name: name, type: s.type,
        brightness: s.type === '主' ? brightnessOf(name, s.zhi) : '',
        hua: huaMap[name] || ''
      });
    });
    palaces.forEach(p => p.stars.sort((a, b) => (ORDER[a.type] - ORDER[b.type])));

    return {
      input: o,
      lunar: lunar,
      lunarText: `${yGZ.text}年（${lunar.lYear}）${lunar.isLeap ? '閏' : ''}${lunar.lMonth}月${lunar.lDay}日 ${ZHI[hb]}時`,
      yearGanZhi: yGZ.text,
      zodiac: ZODIAC[yearZhi],
      monthForChart: monthForChart,
      mingGong: mingGong, shenGong: shenGong,
      mingGanZhi: mingGanZhiText,
      ju: ju, juName: JU_NAME[ju],
      mingZhu: MING_ZHU[mingGong],
      shenZhu: SHEN_ZHU[yearZhi],
      yinYang: yangYearGan ? '陽' : '陰',
      genderText: gender === 'M' ? '男' : '女',
      yinYangGender: (yangYearGan ? '陽' : '陰') + (gender === 'M' ? '男' : '女'),
      forward: forward,
      ziWei: ZHI[ziWei], tianFu: ZHI[tianFu],
      huaMap: huaMap,
      daList: daList,
      xiaoStart: xiaoStart,
      xiaoForward: gender === 'M', // 小限男順女逆
      lunarBirthYear: lunar.lYear,
      zhiGanIndex: zhiGan.slice(), // 各地支宮干索引
      palaces: palaces,
      palaceZhi: palaceZhi,
      notes: NOTES.slice()
    };
  }

  return {
    computeChart: computeChart,
    solarToLunar: solarToLunar, lunarToSolar: lunarToSolar, lunarMonthLen: lunarMonthLen, leapMonthOf: leapMonthOf,
    siHuaByGan: siHuaByGan, huaTextOf: huaTextOf, liuNian: liuNian,
    GAN: GAN, ZHI: ZHI, ZODIAC: ZODIAC, HOUR_LABEL: HOUR_LABEL, PALACE_NAMES: PALACE_NAMES
  };
}));
