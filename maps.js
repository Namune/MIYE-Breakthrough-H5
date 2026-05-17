window.GameMaps = (() => {
  const TILE = {
    GRASS: 0,
    WALL: 1,
    WHEAT: 2,
    WATER: 3,
    SHADOW: 4,
    PATH: 5,
    FLOOR: 6,
    FIELD: 7,
    BRIDGE: 8,
    EXIT: 9
  };

  function makeGrid(width, height, baseTile) {
    return Array.from({ length: height }, () => Array.from({ length: width }, () => baseTile));
  }

  function fillRect(grid, x, y, w, h, tile) {
    for (let row = y; row < y + h; row += 1) {
      for (let col = x; col < x + w; col += 1) {
        if (grid[row] && grid[row][col] !== undefined) {
          grid[row][col] = tile;
        }
      }
    }
  }

  function borderWalls(grid) {
    const width = grid[0].length;
    const height = grid.length;
    fillRect(grid, 0, 0, width, 1, TILE.WALL);
    fillRect(grid, 0, height - 1, width, 1, TILE.WALL);
    fillRect(grid, 0, 0, 1, height, TILE.WALL);
    fillRect(grid, width - 1, 0, 1, height, TILE.WALL);
  }

  function buildOpenGrid(style) {
    const grid = makeGrid(32, 22, TILE.GRASS);
    borderWalls(grid);
    (style.wheat || []).forEach((rect) => fillRect(grid, rect.x, rect.y, rect.w, rect.h, TILE.WHEAT));
    (style.water || []).forEach((rect) => fillRect(grid, rect.x, rect.y, rect.w, rect.h, TILE.WATER));
    (style.shadow || []).forEach((rect) => fillRect(grid, rect.x, rect.y, rect.w, rect.h, TILE.SHADOW));
    (style.walls || []).forEach((rect) => fillRect(grid, rect.x, rect.y, rect.w, rect.h, TILE.WALL));
    return grid;
  }

  function makeRoamers(prefix, points, hp, speed, reward) {
    return points.map((point, index) => ({
      id: `${prefix}-roamer-${index + 1}`,
      x: point[0],
      y: point[1],
      hp: hp + (index % 3) * 2,
      speed: speed,
      reward: reward + (index % 2)
    }));
  }

  function makeMiniBosses(prefix, points, hp, speed, reward) {
    return points.map((point, index) => ({
      id: `${prefix}-mini-${index + 1}`,
      x: point[0],
      y: point[1],
      hp: hp + index * 8,
      speed: speed,
      reward,
      elite: true,
      title: `${prefix} 头目 ${index + 1}`
    }));
  }

  function makeHybridLevel(config) {
    return {
      id: config.id,
      route: config.route,
      name: config.name,
      progress: config.progress,
      theme: config.theme,
      fogRadius: config.theme === 'night' ? 5 : 4,
      start: config.start,
      exit: config.portal,
      intro: config.intro,
      hybrid: {
        roamers: makeRoamers(config.id, config.roamerPoints, config.roamerHp, config.roamerSpeed, config.roamerReward),
        minibosses: makeMiniBosses(config.id, config.minibossPoints, config.minibossHp, config.minibossSpeed, config.minibossReward),
        sites: config.sites || [],
        merchant: config.merchant,
        hazardSpots: config.hazardSpots,
        portal: { x: config.portal.x, y: config.portal.y, title: '裂隙传送门' },
        bossEntry: config.bossEntry,
        boss: {
          x: config.boss.x,
          y: config.boss.y,
          hp: config.boss.hp,
          title: config.boss.title
        },
        rewardChest: {
          x: config.rewardChest.x,
          y: config.rewardChest.y,
          title: '战利宝箱'
        },
        lootTable: config.lootTable
      },
      grid: buildOpenGrid(config.style)
    };
  }

  const battle = [
    makeHybridLevel({
      id: 'battle-1',
      route: 'battle',
      name: '第 1 幕：夜野外环',
      progress: '第 1 幕 / 共 6 幕',
      theme: 'night',
      start: { x: 3, y: 18 },
      portal: { x: 27, y: 4 },
      bossEntry: { x: 23, y: 5 },
      boss: { x: 26, y: 7, hp: 120, title: '夜野首领' },
      rewardChest: { x: 26, y: 11 },
      merchant: { x: 8, y: 6, title: '篝火商人' },
      intro: [
        { speaker: '提示', text: '这一幕已经改成大地图玩法。先在外环清怪，再处理 1 个小 Boss。' },
        { speaker: '提示', text: '清空场上敌人后，传送门会打开，把你送进大 Boss 区。' },
        { speaker: '提示', text: 'Boss 倒下后会出现宝箱，掉落会进入你的背包。' }
      ],
      roamerPoints: [[6, 5], [10, 6], [14, 4], [18, 7], [22, 5], [8, 13], [13, 15], [20, 14], [25, 16]],
      minibossPoints: [[16, 10]],
      roamerHp: 18,
      roamerSpeed: 52,
      roamerReward: 3,
      minibossHp: 48,
      minibossSpeed: 42,
      minibossReward: 16,
      hazardSpots: [{ x: 11, y: 8, kind: 'gust', radius: 18 }, { x: 20, y: 12, kind: 'static', radius: 18 }],
      lootTable: ['potion', 'shield', 'dagger'],
      style: {
        wheat: [{ x: 4, y: 3, w: 3, h: 3 }, { x: 21, y: 4, w: 4, h: 2 }, { x: 8, y: 14, w: 4, h: 3 }, { x: 24, y: 15, w: 3, h: 3 }],
        water: [{ x: 13, y: 6, w: 3, h: 2 }, { x: 5, y: 11, w: 2, h: 3 }, { x: 26, y: 9, w: 2, h: 3 }],
        walls: [{ x: 15, y: 17, w: 7, h: 1 }, { x: 22, y: 8, w: 1, h: 5 }]
      }
    }),
    makeHybridLevel({
      id: 'battle-2',
      route: 'battle',
      name: '第 3 幕：黑麦荒坡',
      progress: '第 3 幕 / 共 6 幕',
      theme: 'night',
      start: { x: 4, y: 18 },
      portal: { x: 27, y: 3 },
      bossEntry: { x: 24, y: 5 },
      boss: { x: 26, y: 8, hp: 145, title: '荒坡镇守者' },
      rewardChest: { x: 25, y: 12 },
      merchant: { x: 6, y: 9, title: '阴坡商亭' },
      intro: [
        { speaker: '提示', text: '这一幕是更开阔的野外战场。地图不再是狭窄迷宫，而是多区域刷怪。' },
        { speaker: '提示', text: '场上有 2 个小 Boss，解决它们之后才会打开传送门。 ' }
      ],
      roamerPoints: [[7, 4], [11, 5], [16, 4], [22, 5], [25, 7], [9, 10], [14, 12], [19, 11], [24, 13], [11, 16], [18, 17]],
      minibossPoints: [[10, 8], [21, 15]],
      roamerHp: 20,
      roamerSpeed: 54,
      roamerReward: 4,
      minibossHp: 56,
      minibossSpeed: 46,
      minibossReward: 18,
      hazardSpots: [{ x: 13, y: 8, kind: 'mire', radius: 18 }, { x: 18, y: 6, kind: 'static', radius: 18 }, { x: 7, y: 15, kind: 'gust', radius: 18 }],
      lootTable: ['shield', 'boots', 'decoy'],
      style: {
        wheat: [{ x: 5, y: 4, w: 3, h: 2 }, { x: 17, y: 3, w: 4, h: 3 }, { x: 22, y: 12, w: 3, h: 3 }, { x: 9, y: 15, w: 4, h: 2 }],
        water: [{ x: 14, y: 6, w: 2, h: 3 }, { x: 4, y: 14, w: 2, h: 3 }, { x: 26, y: 8, w: 2, h: 2 }],
        walls: [{ x: 12, y: 10, w: 6, h: 1 }, { x: 18, y: 10, w: 1, h: 6 }, { x: 7, y: 8, w: 1, h: 5 }]
      }
    }),
    makeHybridLevel({
      id: 'battle-3',
      route: 'battle',
      name: '第 5 幕：暗潮主战场',
      progress: '第 5 幕 / 共 6 幕',
      theme: 'night',
      start: { x: 3, y: 18 },
      portal: { x: 28, y: 3 },
      bossEntry: { x: 24, y: 5 },
      boss: { x: 26, y: 8, hp: 170, title: '暗潮巨首' },
      rewardChest: { x: 26, y: 12 },
      merchant: { x: 7, y: 7, title: '夜幕补给点' },
      intro: [
        { speaker: '提示', text: '这一幕会同时刷更多小怪和 3 个小 Boss，节奏更接近真正的大地图战区。' }
      ],
      roamerPoints: [[6, 4], [10, 5], [14, 5], [18, 4], [23, 4], [26, 6], [8, 10], [13, 11], [18, 10], [24, 12], [9, 16], [15, 17], [21, 16]],
      minibossPoints: [[9, 7], [17, 8], [24, 15]],
      roamerHp: 22,
      roamerSpeed: 58,
      roamerReward: 4,
      minibossHp: 64,
      minibossSpeed: 51,
      minibossReward: 20,
      hazardSpots: [{ x: 12, y: 7, kind: 'static', radius: 18 }, { x: 20, y: 9, kind: 'gust', radius: 20 }, { x: 6, y: 14, kind: 'mire', radius: 18 }, { x: 25, y: 10, kind: 'static', radius: 18 }],
      lootTable: ['wand', 'potion', 'shield', 'boots'],
      style: {
        wheat: [{ x: 4, y: 3, w: 3, h: 2 }, { x: 12, y: 3, w: 4, h: 2 }, { x: 21, y: 3, w: 4, h: 2 }, { x: 8, y: 14, w: 3, h: 3 }, { x: 19, y: 14, w: 3, h: 3 }],
        water: [{ x: 15, y: 7, w: 2, h: 3 }, { x: 5, y: 11, w: 2, h: 2 }, { x: 25, y: 8, w: 2, h: 3 }],
        walls: [{ x: 11, y: 9, w: 7, h: 1 }, { x: 18, y: 9, w: 1, h: 6 }, { x: 8, y: 8, w: 1, h: 5 }, { x: 23, y: 13, w: 1, h: 4 }]
      }
    })
  ];

  const puzzle = [
    makeHybridLevel({
      id: 'puzzle-1',
      route: 'puzzle',
      name: '第 2 幕：晴野外环',
      progress: '第 2 幕 / 共 6 幕',
      theme: 'day',
      start: { x: 3, y: 18 },
      portal: { x: 27, y: 4 },
      bossEntry: { x: 24, y: 5 },
      boss: { x: 26, y: 8, hp: 128, title: '晴野首领' },
      rewardChest: { x: 26, y: 12 },
      merchant: { x: 8, y: 7, title: '晒谷商亭' },
      intro: [
        { speaker: '提示', text: '晴野线现在同样是大地图刷怪流程，不再是狭窄迷宫加单个机关。' }
      ],
      roamerPoints: [[5, 5], [10, 5], [15, 4], [21, 5], [25, 7], [7, 11], [14, 12], [20, 13], [25, 15]],
      minibossPoints: [[14, 8]],
      roamerHp: 18,
      roamerSpeed: 52,
      roamerReward: 3,
      minibossHp: 50,
      minibossSpeed: 42,
      minibossReward: 16,
      hazardSpots: [{ x: 11, y: 10, kind: 'gust', radius: 18 }, { x: 22, y: 10, kind: 'mire', radius: 18 }],
      lootTable: ['potion', 'decoy', 'boots'],
      style: {
        wheat: [{ x: 4, y: 4, w: 3, h: 2 }, { x: 21, y: 4, w: 4, h: 2 }, { x: 10, y: 14, w: 4, h: 2 }, { x: 24, y: 15, w: 3, h: 3 }],
        water: [{ x: 14, y: 6, w: 2, h: 2 }, { x: 6, y: 12, w: 2, h: 2 }, { x: 26, y: 9, w: 2, h: 2 }],
        walls: [{ x: 13, y: 10, w: 6, h: 1 }, { x: 19, y: 10, w: 1, h: 6 }]
      }
    }),
    makeHybridLevel({
      id: 'puzzle-2',
      route: 'puzzle',
      name: '第 4 幕：折镜原野',
      progress: '第 4 幕 / 共 6 幕',
      theme: 'day',
      start: { x: 4, y: 18 },
      portal: { x: 27, y: 3 },
      bossEntry: { x: 23, y: 5 },
      boss: { x: 26, y: 8, hp: 150, title: '折镜守主' },
      rewardChest: { x: 25, y: 12 },
      merchant: { x: 6, y: 8, title: '路边补给点' },
      intro: [
        { speaker: '提示', text: '这幕同样是开阔大地图。先清掉 2 个小 Boss，再经传送门进入主战区。' }
      ],
      roamerPoints: [[7, 4], [12, 5], [17, 4], [22, 5], [26, 7], [9, 10], [15, 11], [20, 10], [24, 13], [12, 16], [18, 16]],
      minibossPoints: [[10, 7], [21, 14]],
      roamerHp: 20,
      roamerSpeed: 54,
      roamerReward: 4,
      minibossHp: 58,
      minibossSpeed: 46,
      minibossReward: 18,
      hazardSpots: [{ x: 14, y: 8, kind: 'static', radius: 18 }, { x: 18, y: 6, kind: 'gust', radius: 18 }, { x: 8, y: 15, kind: 'mire', radius: 18 }],
      lootTable: ['shield', 'wand', 'boots'],
      style: {
        wheat: [{ x: 5, y: 3, w: 3, h: 2 }, { x: 17, y: 3, w: 4, h: 2 }, { x: 23, y: 12, w: 3, h: 2 }, { x: 8, y: 15, w: 4, h: 2 }],
        water: [{ x: 14, y: 6, w: 2, h: 3 }, { x: 4, y: 13, w: 2, h: 3 }, { x: 26, y: 8, w: 2, h: 2 }],
        walls: [{ x: 11, y: 9, w: 6, h: 1 }, { x: 18, y: 10, w: 1, h: 5 }, { x: 7, y: 8, w: 1, h: 4 }]
      }
    }),
    makeHybridLevel({
      id: 'puzzle-3',
      route: 'puzzle',
      name: '第 6 幕：总闸战区',
      progress: '第 6 幕 / 共 6 幕',
      theme: 'day',
      start: { x: 3, y: 18 },
      portal: { x: 28, y: 3 },
      bossEntry: { x: 24, y: 5 },
      boss: { x: 26, y: 8, hp: 176, title: '总闸领主' },
      rewardChest: { x: 26, y: 12 },
      merchant: { x: 7, y: 8, title: '总闸补给车' },
      intro: [
        { speaker: '提示', text: '终幕已经统一成大地图总战区：多波小怪、3 个小 Boss、传送门转场和最终宝箱。' }
      ],
      roamerPoints: [[6, 4], [11, 5], [15, 5], [20, 4], [25, 5], [8, 9], [13, 10], [18, 11], [24, 10], [7, 15], [14, 16], [20, 16], [26, 14]],
      minibossPoints: [[8, 7], [17, 8], [24, 14]],
      roamerHp: 22,
      roamerSpeed: 58,
      roamerReward: 4,
      minibossHp: 66,
      minibossSpeed: 51,
      minibossReward: 20,
      hazardSpots: [{ x: 12, y: 8, kind: 'gust', radius: 18 }, { x: 20, y: 8, kind: 'static', radius: 18 }, { x: 6, y: 13, kind: 'mire', radius: 18 }, { x: 24, y: 10, kind: 'static', radius: 18 }],
      lootTable: ['shield', 'potion', 'axe', 'decoy'],
      style: {
        wheat: [{ x: 4, y: 3, w: 3, h: 2 }, { x: 12, y: 3, w: 4, h: 2 }, { x: 21, y: 3, w: 4, h: 2 }, { x: 9, y: 14, w: 3, h: 3 }, { x: 19, y: 14, w: 4, h: 2 }],
        water: [{ x: 15, y: 7, w: 2, h: 3 }, { x: 5, y: 11, w: 2, h: 2 }, { x: 26, y: 8, w: 2, h: 3 }],
        walls: [{ x: 11, y: 9, w: 7, h: 1 }, { x: 18, y: 9, w: 1, h: 6 }, { x: 8, y: 8, w: 1, h: 5 }, { x: 23, y: 13, w: 1, h: 4 }]
      }
    })
  ];

  function cloneLevel(route, index) {
    const source = route === 'battle' ? battle[index] : puzzle[index];
    return JSON.parse(JSON.stringify(source));
  }

  return {
    TILE,
    battle,
    puzzle,
    cloneLevel
  };
})();
