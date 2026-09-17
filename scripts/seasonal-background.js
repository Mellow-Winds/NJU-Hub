// Adapted from MyBlog/assets/js/background.js: 96 colors and UTC+8 daily selection.
// Uses fixed 15-day groups from February 4, not astronomical solar-term dates.
window.NjuSeasonalBackground = (() => {
  const solarTerms = {
    spring: ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨'],
    summer: ['立夏', '小满', '芒种', '夏至', '小暑', '大暑'],
    autumn: ['立秋', '处暑', '白露', '秋分', '寒露', '霜降'],
    winter: ['立冬', '小雪', '大雪', '冬至', '小寒', '大寒']
  };

  const palettes = [
    {
      key: 'spring', name: '春', english: 'Spring', description: '新芽绿', core: '#A1C795', terms: solarTerms.spring,
      deep: { name: '深芽', color: '#356B4B' },
      subthemes: [
        { name: '返青', colors: [
          { name: '返青', color: '#91B8AA' }, { name: '青芽', color: '#92BAA9' },
          { name: '春汐', color: '#94BDA7' }, { name: '芽影', color: '#95BFA6' }
        ] },
        { name: '雨芽', colors: [
          { name: '雨芽', color: '#97C1A4' }, { name: '叶露', color: '#9AC39F' },
          { name: '叶青', color: '#9DC59A' }, { name: '新叶', color: '#A1C795' }
        ] },
        { name: '新叶', colors: [
          { name: '新叶', color: '#A4C990' }, { name: '叶光', color: '#A8CA8D' },
          { name: '叶影', color: '#ABCB89' }, { name: '叶青', color: '#AFCC86' }
        ] },
        { name: '春草', colors: [
          { name: '春草', color: '#B2CD82' }, { name: '草光', color: '#B1CD84' },
          { name: '草影', color: '#B0CC86' }, { name: '嫩枝', color: '#B0CC88' }
        ] },
        { name: '柳青', colors: [
          { name: '柳青', color: '#AFCB8A' }, { name: '柳光', color: '#ABCA90' },
          { name: '柳影', color: '#A7C995' }, { name: '浅柳', color: '#A3C89B' }
        ] },
        { name: '晴芽', colors: [
          { name: '晴芽', color: '#9FC7A0' }, { name: '芽光', color: '#9AC5A4' },
          { name: '芽色', color: '#96C3A8' }, { name: '芽暮', color: '#91C1AB' }
        ] }
      ]
    },
    {
      key: 'summer', name: '夏', english: 'Summer', description: '青蓝水汽', core: '#73B7C6', terms: solarTerms.summer,
      deep: { name: '深海', color: '#2F6F78' },
      subthemes: [
        { name: '青绿', colors: [
          { name: '青绿', color: '#8CBFAF' }, { name: '夏青', color: '#88BFB1' },
          { name: '青空', color: '#85BEB3' }, { name: '夏芽', color: '#81BEB5' }
        ] },
        { name: '湖青', colors: [
          { name: '湖青', color: '#7DBDB7' }, { name: '浅湖', color: '#7ABCBB' },
          { name: '湖风', color: '#78BABF' }, { name: '汐蓝', color: '#75B9C2' }
        ] },
        { name: '澄蓝', colors: [
          { name: '澄蓝', color: '#73B7C6' }, { name: '潮色', color: '#72B5CA' },
          { name: '晴川', color: '#71B3CD' }, { name: '碧波', color: '#70B1D1' }
        ] },
        { name: '天空蓝', colors: [
          { name: '天空蓝', color: '#6FAFD4' }, { name: '水色', color: '#73B0D3' },
          { name: '晴雨', color: '#76B2D2' }, { name: '远波', color: '#7AB3D0' }
        ] },
        { name: '青蓝', colors: [
          { name: '青蓝', color: '#7DB4CF' }, { name: '云海', color: '#7FB6C7' },
          { name: '云风', color: '#81B8BF' }, { name: '凉风', color: '#84B9B7' }
        ] },
        { name: '晚夏草绿', colors: [
          { name: '晚夏草绿', color: '#86BBAF' }, { name: '海盐', color: '#8CBBA6' },
          { name: '夏雨', color: '#93BC9D' }, { name: '荫影', color: '#99BC94' }
        ] }
      ]
    },
    {
      key: 'autumn', name: '秋', english: 'Autumn', description: '草木金橙', core: '#D29A5F', terms: solarTerms.autumn,
      deep: { name: '深橙', color: '#B84A0A' },
      subthemes: [
        { name: '草绿', colors: [
          { name: '草绿', color: '#9FBC8A' }, { name: '秋青', color: '#A5BB86' },
          { name: '初黄', color: '#ABBA82' }, { name: '秋芽', color: '#B1B87D' }
        ] },
        { name: '麦黄', colors: [
          { name: '麦黄', color: '#B7B779' }, { name: '麦色', color: '#BCB576' },
          { name: '金穗', color: '#C0B273' }, { name: '秋黄', color: '#C5B06F' }
        ] },
        { name: '金橙', colors: [
          { name: '金橙', color: '#C9AD6C' }, { name: '桂蜜', color: '#CBA869' },
          { name: '金露', color: '#CEA466' }, { name: '秋蜜', color: '#D09F62' }
        ] },
        { name: '暖橙', colors: [
          { name: '暖橙', color: '#D29A5F' }, { name: '夕照', color: '#D3955D' },
          { name: '枫光', color: '#D4915B' }, { name: '丹橙', color: '#D48C5A' }
        ] },
        { name: '枫橙', colors: [
          { name: '枫橙', color: '#D58758' }, { name: '橙光', color: '#D2835B' },
          { name: '橙火', color: '#CF7E5D' }, { name: '落焰', color: '#CC7A60' }
        ] },
        { name: '暮红', colors: [
          { name: '暮红', color: '#C97562' }, { name: '秋霞', color: '#C6766B' },
          { name: '暖红', color: '#C47873' }, { name: '橙暮', color: '#C1797B' }
        ] }
      ]
    },
    {
      key: 'winter', name: '冬', english: 'Winter', description: '暮紫冰蓝', core: '#919AC7', terms: solarTerms.winter,
      deep: { name: '夜雪', color: '#4C568D' },
      subthemes: [
        { name: '暮红', colors: [
          { name: '暮红', color: '#BE7A83' }, { name: '霞影', color: '#B97B8A' },
          { name: '暮紫', color: '#B47D91' }, { name: '冬霞', color: '#AF7E98' }
        ] },
        { name: '紫霞', colors: [
          { name: '紫霞', color: '#AA7F9F' }, { name: '霞紫', color: '#A683A5' },
          { name: '紫霜', color: '#A287AB' }, { name: '霜影', color: '#9E8BB2' }
        ] },
        { name: '冰紫', colors: [
          { name: '冰紫', color: '#9A8FB8' }, { name: '淡霜', color: '#9892BC' },
          { name: '紫晶', color: '#9695BF' }, { name: '霜花', color: '#9397C3' }
        ] },
        { name: '雪青', colors: [
          { name: '雪青', color: '#919AC7' }, { name: '初雪', color: '#8F9DC9' },
          { name: '雪影', color: '#8D9FCA' }, { name: '冬暮', color: '#8AA2CC' }
        ] },
        { name: '霜蓝', colors: [
          { name: '霜蓝', color: '#88A4CE' }, { name: '冬烟', color: '#88A8CB' },
          { name: '寒暮', color: '#87ACC8' }, { name: '雪夜', color: '#87B0C5' }
        ] },
        { name: '冷蓝', colors: [
          { name: '冰蓝', color: '#86B4C2' }, { name: '冬云', color: '#89B5BC' },
          { name: '寒光', color: '#8BB6B6' }, { name: '长冬', color: '#8EB7B0' }
        ] }
      ]
    }
  ];

  palettes.forEach(palette => {
    palette.colors = [];
    palette.subthemes.forEach((subtheme, subthemeIndex) => {
      subtheme.term = palette.terms[subthemeIndex];
      subtheme.colors.forEach(variant => {
        variant.index = palette.colors.length;
        variant.term = subtheme.term;
        variant.variantIndex = subtheme.colors.indexOf(variant);
        palette.colors.push(variant.color);
      });
    });
  });

  const yearColors = palettes.flatMap(palette => palette.colors);
  let globalIndex = 0;
  palettes.forEach(palette => {
    palette.subthemes.forEach(subtheme => {
      subtheme.colors.forEach(variant => {
        variant.globalIndex = globalIndex++;
      });
    });
  });

  const DAY = 86400000;
  const UTC8 = 8 * 3600000;
  let timer;
  let started = false;

  function getDate(now = Date.now()) {
    const date = new Date(now + UTC8);
    return {
      year: date.getUTCFullYear(), month: date.getUTCMonth(), date: date.getUTCDate(),
      dayIndex: Math.floor((now + UTC8) / DAY)
    };
  }

  function gradient(index) {
    const wrap = value => (value % yearColors.length + yearColors.length) % yearColors.length;
    return [yearColors[wrap(index - 1)], yearColors[wrap(index)], yearColors[wrap(index + 1)]];
  }

  function getTheme(now = Date.now()) {
    const today = getDate(now);
    let year = today.year;
    if (today.dayIndex < Date.UTC(year, 1, 4) / DAY) year--;
    const elapsedDays = today.dayIndex - Date.UTC(year, 1, 4) / DAY;
    // Fixed 15-day groups; the last group absorbs the year's remaining 5–6 days.
    const termIndex = Math.min(23, Math.floor(elapsedDays / 15));
    const seasonIndex = Math.floor(termIndex / 6);
    // A stable shuffled cycle changes daily without repeats on consecutive days.
    const order = [0, 1, 2, 3];
    let seed = (Math.imul(year, 374761393) + termIndex * 668265263) >>> 0;
    for (let i = 3; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    const variantIndex = order[(elapsedDays - termIndex * 15) % 4];
    const globalIndex = termIndex * 4 + variantIndex;
    return {
      ...today, termIndex, seasonIndex, variantIndex, globalIndex,
      palette: palettes[seasonIndex], term: palettes[seasonIndex].terms[termIndex % 6],
      tones: gradient(globalIndex)
    };
  }

  function apply(now = Date.now()) {
    const theme = getTheme(now);
    const root = document.documentElement;
    theme.tones.forEach((color, i) => root.style.setProperty(`--nju-seasonal-${'abc'[i]}`, color));
    root.style.setProperty('--nju-seasonal-deep', theme.palette.deep.color);
    root.dataset.njuSeason = theme.palette.key;
    root.dataset.njuSolarTerm = theme.term;
    return theme;
  }

  function refresh() {
    clearTimeout(timer);
    const now = Date.now();
    apply(now);
    timer = setTimeout(refresh, DAY - ((now + UTC8) % DAY) + 50);
  }

  function start() {
    if (started) return;
    started = true;
    refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', refresh);
  }

  function onVisible() {
    if (!document.hidden) refresh();
  }

  return { palettes, yearColors, getDate, gradient, getTheme, apply, start };
})();
