(() => {
  const BASE_WIDTH = 360;
  const BASE_HEIGHT = 640;
  const TILE_SIZE = 16;
  const VIEW = { x: 12, y: 48, w: 336, h: 414 };
  const DIALOGUE_BOX = { x: 18, y: 446, w: 324, h: 100 };
  const SAFE = { top: 0, right: 0, bottom: 0, left: 0 };
  const ERROR_TEXT = '哎呀，出错了，请重启试试吧~';
  const MOVE_SPEED = 150;
  const GUARD_HIT_COOLDOWN = 0.5;
  const DIALOGUE_CHAR_TIME = 0.05;
  const SAVE_KEY = 'maiying-handheld-save-v1';
  const RANDOM_EVENT_CHANCE = 0.2;
  const GALLERY_THRESHOLDS = Object.freeze([2, 5, 9, 13]);
  const SCREEN = Object.freeze({
    TITLE: 'title',
    ROUTE_SELECT: 'route-select',
    PLAYING: 'playing',
    SETTLEMENT: 'settlement',
    EASTER: 'easter',
    ACHIEVEMENTS: 'achievements',
    GALLERY: 'gallery',
    CREDITS: 'credits'
  });
  const SHOP_ITEMS = Object.freeze([
    { id: 'coin', name: '金币袋', price: 6, short: '金', desc: '立刻换到一袋金币', accent: '#ffd86d' },
    { id: 'potion', name: '回血药水', price: 10, short: '药', desc: '恢复 1 点生命', accent: '#ff8f95' },
    { id: 'dagger', name: '长刀', price: 15, short: '刀', desc: '切换成长距离快斩', accent: '#ffe58b' },
    { id: 'wand', name: '巨刃', price: 18, short: '刃', desc: '切换成超长重斩', accent: '#d9c4ff' },
    { id: 'axe', name: '重斧', price: 20, short: '斧', desc: '切换成高伤横扫', accent: '#ffbf95' },
    { id: 'skyblade', name: '裂穹刀', price: 34, short: '穹', desc: '后期超规格武器，偶发全图裂斩', accent: '#c3e4ff' },
    { id: 'shield', name: '护盾', price: 20, short: '盾', desc: '首次受击免伤', accent: '#95f2ff' },
    { id: 'boots', name: '加速靴', price: 12, short: '靴', desc: '本关移动提速', accent: '#8ae59d' },
    { id: 'exp', name: '历练手册', price: 14, short: '经', desc: '获得经验并推进等级', accent: '#9fe0ff' },
    { id: 'ally', name: '协战呼哨', price: 22, short: '伴', desc: '招募一名随机 AI 队友', accent: '#ffc9e8' }
  ]);
  const CAMPAIGN_ORDER = Object.freeze([
    { route: 'battle', index: 0, label: '夜雾踏查' },
    { route: 'puzzle', index: 0, label: '晴野远行' },
    { route: 'battle', index: 1, label: '夜行潜越' },
    { route: 'puzzle', index: 1, label: '折镜穿光' },
    { route: 'battle', index: 2, label: '暗夜反打' },
    { route: 'puzzle', index: 2, label: '总闸终章' },
    { route: 'battle', index: 2, label: '裂穹狂潮' },
    { route: 'puzzle', index: 2, label: '无尽总闸' },
    { route: 'battle', index: 1, label: '火雨前线' },
    { route: 'battle', index: 2, label: '五王暴雨' },
    { route: 'easter', index: 0, label: '彩蛋关' }
  ]);
  const MAX_LEVEL = 10;
  const TILE = window.GameMaps.TILE;
  const Sprite = window.PixelSprites;

  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let fatalShown = false;
  let lastFatalMessage = '';
  let booted = false;
  let frameTime = 0;
  const layout = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    width: BASE_WIDTH,
    height: BASE_HEIGHT
  };

  const state = createInitialState();
  function init() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
      throw new Error('Canvas element missing.');
    }
    ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D context missing.');
    }
    ctx.imageSmoothingEnabled = false;
    loadSaveData();
    bindEvents();
    resize();
    render();
    requestAnimationFrame(loop);
  }

  function createInitialState() {
    return {
      screen: SCREEN.TITLE,
      lastTime: 0,
      time: 0,
      frameIndex: 0,
      hitAreas: [],
      pointers: {},
      keys: {},
      keyboardInteract: false,
      keyboardAttack: false,
      keyboardDash: false,
      keyboardConfirm: false,
      mouseTap: null,
      dialogue: null,
      settlement: null,
      overlay: null,
      play: null,
      easter: null,
      achievementBanner: null,
      menuBack: SCREEN.TITLE,
      profile: createDefaultProfile(),
      routeProgress: createRouteProgress()
    };
  }

  function createRouteProgress() {
    return {
      battle: { currentLevel: 0, cleared: false },
      puzzle: { currentLevel: 0, cleared: false, parts: [], hasSeed: false, firstPickupShown: false }
    };
  }

  function createDefaultProfile() {
    return {
      coins: 0,
      totalExp: 0,
      supportLevel: 1,
      unlockedGallery: false,
      achievements: {},
      bestRatings: {},
      continueData: null,
      routeProgress: createRouteProgress()
    };
  }

  function getCampaignStepInfo(step) {
    return CAMPAIGN_ORDER[step] || null;
  }

  function getCampaignFinalStep() {
    return CAMPAIGN_ORDER.length - 1;
  }

  function getBossHpForTheme(baseHp, theme) {
    const base = Number.isFinite(baseHp) ? baseHp : 48;
    return theme === 'night' ? Math.round(base * 1.28) : base;
  }

  function getCampaignBossPower(play) {
    if (!play || !Number.isFinite(play.campaignStep)) {
      return 1;
    }
    const stage = play.campaignStep + 1;
    return 1 + Math.max(0, stage - 1) * 0.18;
  }

  function getSceneKey(route, index) {
    return `${route}-${index}`;
  }

  function getCampaignStageLabel(step, fallback) {
    const info = getCampaignStepInfo(step);
    return info ? info.label : (fallback || '战役推进');
  }

  function getCampaignStageNumber(play) {
    if (!play || !Number.isFinite(play.campaignStep)) {
      return 1;
    }
    return play.campaignStep + 1;
  }

  function isCampaignStage(play, stageNumber) {
    return getCampaignStageNumber(play) === stageNumber;
  }

  function isCampaignStageAtLeast(play, stageNumber) {
    return getCampaignStageNumber(play) >= stageNumber;
  }

  function getCampaignMutationTier(play) {
    const step = Number.isFinite(play && play.campaignStep) ? play.campaignStep : 0;
    if (step >= 7) return 4;
    if (step >= 6) return 3;
    if (step >= 4) return 2;
    if (step >= 2) return 1;
    return 0;
  }

  function getRunPowerTier(play) {
    const level = play && play.progression && Number.isFinite(play.progression.level) ? play.progression.level : 1;
    return Math.max(0, Math.floor((level - 1) / 2));
  }

  function getWeaponMutationTier(play) {
    return getCampaignMutationTier(play) + getRunPowerTier(play);
  }

  function getDashCataclysmChance(play) {
    const chance = 0.02 + getCampaignMutationTier(play) * 0.025 + getRunPowerTier(play) * 0.012;
    return clamp(chance, 0.02, 0.18);
  }

  function getPlaySceneLabel(play) {
    if (!play) {
      return '战役推进';
    }
    if (play.hybrid && play.hybrid.active) {
      return play.hybrid.phase === 'danger' ? '危险区清场' : '环境区探索';
    }
    if (play.route === 'battle' && play.levelIndex === 1) {
      return '潜越守卫区';
    }
    if (play.route === 'battle' && play.levelIndex === 2) {
      return '近战反打';
    }
    if (play.route === 'puzzle' && play.levelIndex === 1) {
      return '折镜机关区';
    }
    if (play.route === 'puzzle' && play.levelIndex === 2) {
      return '总闸推理区';
    }
    return '战役推进区';
  }

  function getSceneAccent(play) {
    if (!play) {
      return '#8fd2ab';
    }
    return play.theme === 'night' ? '#9bd7f3' : '#f3d487';
  }

  function getSiteIconName(kind) {
    return kind === 'cache' ? 'coin'
      : kind === 'spring' ? 'potionBlue'
        : kind === 'tower' ? 'torch'
          : kind === 'relay' ? 'scroll'
            : kind === 'forge' ? 'axe'
              : kind === 'altar' ? 'campfire'
                : kind === 'gamble' ? 'clover'
                  : 'question';
  }

  function getHazardIconName(kind) {
    return kind === 'mire' ? 'poison'
      : kind === 'static' ? 'shock'
        : 'alert';
  }

  function getNearbyIconName(kind, target) {
    if (kind === 'merchant') return 'shop';
    if (kind === 'site') return getSiteIconName(target && target.kind);
    if (kind === 'portal') return 'anchor';
    if (kind === 'chest') return 'trophy';
    if (kind === 'loot') return getItemIconName(target && target.itemId);
    if (kind === 'shrine') return 'heal';
    if (kind === 'sign') return 'sign';
    if (kind === 'rune') return 'attack';
    if (kind === 'mirror') return 'ice';
    if (kind === 'valve') return 'anchor';
    if (kind === 'door') return 'lock';
    if (kind === 'npc') return 'question';
    if (kind === 'seed' || kind === 'item') return 'crystal';
    if (kind === 'grave') return 'defense';
    if (kind === 'exit') return 'arrowUp';
    return 'question';
  }

  function getAchievementIconName(id) {
    return id === 'firstAdventure' ? 'exp'
      : id === 'darkWalker' ? 'feather'
        : id === 'sunWalker' ? 'heal'
          : id === 'dualRoutes' ? 'anchor'
            : id === 'perfectSneak' ? 'sword'
              : id === 'collector' ? 'crystal'
                : id === 'marketMind' ? 'shop'
                  : id === 'rich' ? 'trophy'
                    : id === 'truth' ? 'settings'
                      : 'trophy';
  }

  function normalizePuzzleProgress(progress) {
    const base = createRouteProgress().puzzle;
    const next = { ...base, ...(progress || {}) };
    next.parts = Array.isArray(next.parts) ? next.parts.slice() : [];
    next.hasSeed = Boolean(next.hasSeed);
    next.firstPickupShown = Boolean(next.firstPickupShown);
    next.currentLevel = Number.isFinite(next.currentLevel) ? next.currentLevel : 0;
    next.cleared = Boolean(next.cleared);
    return next;
  }

  function normalizeRouteProgress(progress) {
    const base = createRouteProgress();
    return {
      battle: {
        ...base.battle,
        ...(progress && progress.battle ? progress.battle : {}),
        currentLevel: Number.isFinite(progress && progress.battle && progress.battle.currentLevel) ? progress.battle.currentLevel : 0,
        cleared: Boolean(progress && progress.battle && progress.battle.cleared)
      },
      puzzle: normalizePuzzleProgress(progress && progress.puzzle)
    };
  }

  function normalizeProfileData(rawProfile) {
    const base = createDefaultProfile();
    const profile = {
      ...base,
      ...(rawProfile || {})
    };
    profile.achievements = { ...(rawProfile && rawProfile.achievements ? rawProfile.achievements : {}) };
    profile.bestRatings = { ...(rawProfile && rawProfile.bestRatings ? rawProfile.bestRatings : {}) };
    profile.routeProgress = normalizeRouteProgress(rawProfile && rawProfile.routeProgress);
    profile.coins = Number.isFinite(profile.coins) ? profile.coins : 0;
    profile.totalExp = Number.isFinite(profile.totalExp) ? profile.totalExp : 0;
    profile.supportLevel = clamp(Number.isFinite(profile.supportLevel) ? profile.supportLevel : 1, 1, MAX_LEVEL);
    profile.unlockedGallery = Boolean(profile.unlockedGallery);
    profile.continueData = rawProfile && rawProfile.continueData ? {
      route: rawProfile.continueData.route,
      levelIndex: rawProfile.continueData.levelIndex,
      campaignStep: Number.isFinite(rawProfile.continueData.campaignStep) ? rawProfile.continueData.campaignStep : null
    } : null;
    return profile;
  }

  function getSupportLevelThreshold(level) {
    return 8 + Math.max(0, Math.min(MAX_LEVEL, level) - 1) * 6;
  }

  function restoreRouteProgress(progress) {
    state.routeProgress = normalizeRouteProgress(progress);
  }

  function setScreen(nextScreen, options) {
    state.screen = nextScreen;
    if (options && options.menuBack) {
      state.menuBack = options.menuBack;
    }
  }

  function clearTransientState() {
    state.dialogue = null;
    state.overlay = null;
    state.settlement = null;
    state.easter = null;
  }

  function loadSaveData() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) {
        return;
      }
      state.profile = normalizeProfileData(JSON.parse(raw));
      restoreRouteProgress(state.profile.routeProgress);
      refreshUnlocks();
    } catch (error) {
      console.error('load save failed', error);
      state.profile = createDefaultProfile();
      restoreRouteProgress(state.profile.routeProgress);
    }
  }

  function saveProgress(showPrompt) {
    try {
      refreshUnlocks();
      state.profile.routeProgress = normalizeRouteProgress(state.routeProgress);
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(state.profile));
      if (showPrompt && state.play) {
        pushPrompt(state.play, '进度已保存到本地掌机记忆。');
      }
    } catch (error) {
      console.error('save failed', error);
      if (showPrompt && state.play) {
        pushPrompt(state.play, '保存失败，请稍后再试。');
      }
    }
  }

  function refreshUnlocks() {
    const achievements = state.profile.achievements;
    const battleCleared = state.routeProgress.battle.cleared;
    const puzzleCleared = state.routeProgress.puzzle.cleared;
    if (battleCleared || puzzleCleared) achievements.firstAdventure = true;
    if (battleCleared) achievements.darkWalker = true;
    if (puzzleCleared) achievements.sunWalker = true;
    if (battleCleared && puzzleCleared) achievements.dualRoutes = true;
    if (state.profile.coins >= 100) achievements.rich = true;
    state.profile.unlockedGallery = getGalleryUnlockCount() > 0 || (battleCleared && puzzleCleared);
  }

  function clearRouteBranch(route) {
    if (route === 'battle') {
      state.routeProgress.battle = { currentLevel: 0, cleared: false };
      return;
    }
    state.routeProgress.puzzle = {
      currentLevel: 0,
      cleared: false,
      parts: [],
      hasSeed: false,
      firstPickupShown: false
    };
  }

  function createLevelUi() {
    return {
      joystick: {
        baseX: 82,
        baseY: 566,
        maxRadius: 24,
        zone: { x: 10, y: 502, w: 132, h: 128 }
      },
      dashButton: { x: 168, y: 514, r: 26 },
      interactButton: { x: 322, y: 454, r: 22 },
      attackStick: {
        baseX: 286,
        baseY: 566,
        maxRadius: 22,
        zone: { x: 204, y: 502, w: 144, h: 130 }
      },
      mapButton: { x: 242, y: 12, w: 50, h: 22 },
      bagButton: { x: 296, y: 12, w: 52, h: 22 },
      pauseButton: { x: 188, y: 12, w: 50, h: 22 },
      pausePressed: false
    };
  }

  function createPlayerState(route, startX, startY) {
    return {
      x: startX,
      y: startY,
      w: 12,
      h: 14,
      facing: 'down',
      walking: false,
      colorShirt: '#7dc4ff',
      colorPants: '#efb454',
      hp: 3,
      maxHp: 3,
      defense: 0,
      invuln: 0,
      attackCooldown: 0,
      dashCooldown: 0,
      critPulse: 0
    };
  }

  function createQuickSlots() {
    return [
      { id: 'potion', short: '药', name: '药水', count: 0, color: '#ff8f95' },
      { id: 'decoy', short: '饵', name: '诱饵', count: 0, color: '#95f2ff' },
      { id: 'shield', short: '盾', name: '护盾', count: 0, color: '#ffd772' },
      { id: 'boots', short: '靴', name: '靴子', count: 0, color: '#8ae59d' }
    ];
  }

  function createRunStats(route) {
    return {
      route,
      damageTaken: 0,
      detectedCount: 0,
      completion: 0,
      rating: 'C'
    };
  }

  function createRandomEventState(route) {
    const enabled = Math.random() < RANDOM_EVENT_CHANCE;
    return {
      route,
      enabled,
      triggered: false,
      triggerTimer: enabled ? 8 + Math.random() * 8 : -1,
      current: null,
      merchant: null,
      chests: [],
      sunshineTimer: 0,
      timeFreezeTimer: 0,
      fogTimer: 0
    };
  }

  function createHybridState(level) {
    const hybrid = level.hybrid || null;
    const requiredSites = hybrid && hybrid.sites ? hybrid.sites.filter((site) => site.required !== false).length : 0;
    const totalRoamers = hybrid && hybrid.roamers ? hybrid.roamers.length : 0;
    const totalMinibosses = hybrid && hybrid.minibosses ? hybrid.minibosses.length : 0;
    return {
      active: Boolean(hybrid),
      phase: totalRoamers + totalMinibosses > 0 ? 'field' : 'portal',
      totalRoamers,
      totalMinibosses,
      defeatedRoamers: 0,
      defeatedMinibosses: 0,
      requiredSites,
      completedSites: 0,
      optionalSites: hybrid && hybrid.sites ? hybrid.sites.filter((site) => site.required === false).length : 0,
      optionalDone: 0,
      hazards: [],
      hazardTimer: 2.8,
      mapExpanded: false,
      fullMapReveal: false,
      exitOpen: false,
      portalOpen: false,
      merchantActive: false,
      lastPhasePrompt: '',
      dangerCleared: totalRoamers + totalMinibosses === 0,
      pendingRoamerWaves: [],
      currentRoamerWave: 0,
      totalRoamerWaves: totalRoamers > 0 ? 1 : 0,
      nextRoamerWaveDelay: 0,
      wavePrompted: false,
      transitionTimer: 0,
      transitionDuration: 0,
      transitionSwapped: false,
      transitionOrigin: null,
      transitionTarget: null,
      transitionStyle: 'portal',
      inBossZone: false,
      chestOpened: false,
      lootCollected: 0,
      totalLoot: 0,
      rewardTimer: 0,
      rewardPortalReady: false,
      rewardPortalArmed: false,
      bossWaveQueue: [],
      bossWaveTimer: 0,
      bossWaveIndex: 0,
      bossWaveTotal: 0
    };
  }

  function getHybridPortalTile(level) {
    const width = level && level.grid && level.grid[0] ? level.grid[0].length : 0;
    const height = level && level.grid ? level.grid.length : 0;
    return {
      x: Math.max(1, Math.floor(width * 0.5)),
      y: Math.max(1, Math.floor(height * 0.5))
    };
  }

  function inflateLevelActors(level) {
    const portalTile = getHybridPortalTile(level);
    return {
      npcs: (level.npcs || []).map((npc) => ({
        ...npc,
        px: npc.x * TILE_SIZE + 2,
        py: npc.y * TILE_SIZE + 1
      })),
      items: (level.items || []).map((item) => ({
        ...item,
        px: item.x * TILE_SIZE,
        py: item.y * TILE_SIZE,
        collected: false
      })),
      clues: (level.clues || []).map((item) => ({
        ...item,
        px: item.x * TILE_SIZE,
        py: item.y * TILE_SIZE,
        found: false
      })),
      loreMarks: (level.loreMarks || []).map((item) => ({
        ...item,
        px: item.x * TILE_SIZE,
        py: item.y * TILE_SIZE,
        read: false
      })),
      shrines: (level.shrines || []).map((item) => ({
        ...item,
        px: item.x * TILE_SIZE,
        py: item.y * TILE_SIZE,
        active: false
      })),
      signs: (level.signs || []).map((sign) => ({
        ...sign,
        px: sign.x * TILE_SIZE,
        py: sign.y * TILE_SIZE,
        read: false
      })),
      plots: (level.plots || []).map((plot) => ({
        ...plot,
        px: plot.x * TILE_SIZE,
        py: plot.y * TILE_SIZE
      })),
      runes: (level.runes || []).map((rune) => ({
        ...rune,
        px: rune.x * TILE_SIZE,
        py: rune.y * TILE_SIZE,
        active: false
      })),
      mirrors: (level.mirrors || []).map((mirror) => ({
        ...mirror,
        px: mirror.x * TILE_SIZE,
        py: mirror.y * TILE_SIZE
      })),
      receivers: (level.receivers || []).map((receiver) => ({
        ...receiver,
        px: receiver.x * TILE_SIZE,
        py: receiver.y * TILE_SIZE,
        lit: false
      })),
      valves: (level.valves || []).map((valve) => ({
        ...valve,
        px: valve.x * TILE_SIZE,
        py: valve.y * TILE_SIZE,
        on: Boolean(valve.on)
      })),
      roamers: (level.hybrid && level.hybrid.roamers ? level.hybrid.roamers : []).map((roamer) => ({
        ...roamer,
        x: roamer.x * TILE_SIZE + 2,
        y: roamer.y * TILE_SIZE + 2,
        w: 12,
        h: 12,
        hp: roamer.hp || 18,
        maxHp: roamer.hp || 18,
        speed: roamer.speed || 52,
        stuckTimer: 0,
        nudgeDir: Math.random() < 0.5 ? -1 : 1,
        touchCooldown: 0,
        hitFlash: 0,
        spriteKey: roamer.spriteKey || pickHybridRoamerSprite(level.theme, Number((roamer.id || '').replace(/\D/g, '')) || 0)
      })),
      minibosses: (level.hybrid && level.hybrid.minibosses ? level.hybrid.minibosses : []).map((boss) => ({
        ...boss,
        x: boss.x * TILE_SIZE + 1,
        y: boss.y * TILE_SIZE + 1,
        w: 14,
        h: 14,
        hp: boss.hp || 48,
        maxHp: boss.hp || 48,
        speed: boss.speed || 42,
        stuckTimer: 0,
        nudgeDir: Math.random() < 0.5 ? -1 : 1,
        touchCooldown: 0,
        hitFlash: 0,
        spriteKey: boss.spriteKey || pickHybridMiniBossSprite(level.theme, Number((boss.id || '').replace(/\D/g, '')) || 0)
      })),
      envSites: (level.hybrid && level.hybrid.sites ? level.hybrid.sites : []).map((site) => ({
        ...site,
        px: site.x * TILE_SIZE,
        py: site.y * TILE_SIZE,
        done: false
      })),
      merchantSpot: level.hybrid && level.hybrid.merchant ? {
        ...level.hybrid.merchant,
        px: level.hybrid.merchant.x * TILE_SIZE + 2,
        py: level.hybrid.merchant.y * TILE_SIZE + 1,
        active: false
      } : null,
      portalSpot: level.hybrid && level.hybrid.portal ? {
        ...level.hybrid.portal,
        x: portalTile.x,
        y: portalTile.y,
        px: portalTile.x * TILE_SIZE,
        py: portalTile.y * TILE_SIZE,
        active: false
      } : null,
      rewardChest: level.hybrid && level.hybrid.rewardChest ? {
        ...level.hybrid.rewardChest,
        px: level.hybrid.rewardChest.x * TILE_SIZE,
        py: level.hybrid.rewardChest.y * TILE_SIZE,
        active: false,
        opened: false,
        tier: 'common'
      } : null,
      hazardSpots: (level.hybrid && level.hybrid.hazardSpots ? level.hybrid.hazardSpots : []).map((spot) => ({
        ...spot,
        px: spot.x * TILE_SIZE + 8,
        py: spot.y * TILE_SIZE + 8
      })),
      seedSpot: level.seedSpot ? {
        ...level.seedSpot,
        px: level.seedSpot.x * TILE_SIZE,
        py: level.seedSpot.y * TILE_SIZE,
        collected: false
      } : null,
      door: level.door ? {
        ...level.door,
        px: level.door.x * TILE_SIZE,
        py: level.door.y * TILE_SIZE
      } : null,
      guards: (level.guards || []).map((guard) => ({
        ...guard,
        x: guard.start.x * TILE_SIZE + 2,
        y: guard.start.y * TILE_SIZE + 1,
        pathIndex: 1,
        facing: 'down',
        alert: 0,
        mode: 'patrol',
        canSeePlayer: false,
        searchTimer: 0,
        hitTimer: 0,
        stunTimer: 0,
        lastSeenX: guard.start.x * TILE_SIZE + 2,
        lastSeenY: guard.start.y * TILE_SIZE + 1,
        patrolRoute: buildGuardPatrol(level.grid, guard.path)
      })),
      collectibles: (level.collectibles || []).map((item) => ({
        ...item,
        px: item.x * TILE_SIZE,
        py: item.y * TILE_SIZE,
        collected: false
      })),
      boss: level.boss ? {
        x: level.boss.x * TILE_SIZE,
        y: level.boss.y * TILE_SIZE,
        hp: getBossHpForTheme(level.boss.hp, level.theme),
        maxHp: getBossHpForTheme(level.boss.hp, level.theme),
        touchCooldown: 0,
        deathTimer: 0,
        dying: false,
        hitFlash: 0,
        warningTimer: 2.2,
        summonTimer: 4.2,
        darkPulseTimer: 5.4
      } : null
    };
  }

  function createPlayState(route, index, level) {
    const startX = level.start.x * TILE_SIZE + 2;
    const startY = level.start.y * TILE_SIZE + 1;
    const play = {
      route,
      levelIndex: index,
      level,
      theme: level.theme,
      worldWidth: level.grid[0].length * TILE_SIZE,
      worldHeight: level.grid.length * TILE_SIZE,
      camera: { x: 0, y: 0 },
      player: createPlayerState(route, startX, startY),
      ui: createLevelUi(),
      prompt: '',
      promptTimer: 0,
      particleTimer: 0,
      particles: [],
      effects: [],
      inTallGrass: false,
      guardCooldown: 0,
      guardSlowTimer: 0,
      lastBossPhase: 1,
      flags: {
        exitOpen: route === 'battle' && index === 0,
        doorOpened: false,
        bridgeOpen: false,
        loreTrailShown: false,
        allShrinesLit: false,
        allCluesLogged: false,
        bridgePrompted: false,
        keypadErrors: 0,
        keypadHintActive: false,
        runeSolved: false,
        mirrorSolved: false
      },
      collectedLights: 0,
      comboCount: 0,
      comboBest: 0,
      comboTimer: 0,
      progression: {
        level: clamp(Math.max(1, state.profile.supportLevel || 1), 1, MAX_LEVEL),
        exp: 0,
        nextExp: getSupportLevelThreshold(Math.max(1, state.profile.supportLevel || 1)),
        defense: Math.max(0, ((Math.min(MAX_LEVEL, Math.max(1, state.profile.supportLevel || 1)) - 1) * 0.08)),
        ascensionUnlocked: false
      },
      attackState: {
        aiming: false,
        holdTime: 0,
        angle: 0,
        hasOffset: false,
        firedDuringHold: false
      },
      hybrid: createHybridState(level),
      run: createRunStats(route),
      randomEvent: createRandomEventState(route),
      inventory: {
        quickSlots: createQuickSlots(),
        weapon: 'sword',
        moveMultiplier: 1,
        shieldReady: false,
        backpack: [],
        critBonus: 0
      },
      playerSwings: [],
      decoys: [],
      bossWarnings: [],
      bossMinions: [],
      extraBosses: [],
      allies: [],
      allyGraves: [],
      lootDrops: [],
      playerBullets: [],
      enemyBullets: [],
      puzzleHints: [],
      darkPulse: {
        timer: 0,
        flash: 0
      },
      feedback: {
        shakeTimer: 0,
        shakePower: 0,
        flashDamage: 0,
        flashShield: 0,
        flashHit: 0,
        flashKill: 0,
        flashHeal: 0,
        flashCrit: 0,
        skySlash: 0,
        skySlashAngle: -0.8,
        executeFlash: 0
      },
      special: {
        bombGearTimer: 0,
        bombCooldown: 0,
        bombIgnoreWalls: false,
        emberGearTimer: 0,
        emberPulseCooldown: 0,
        fires: [],
        critRampStacks: 0,
        critRampReady: false,
        duckrope: null,
        rain: false
      },
      planted: [],
      plantAnimations: [],
      runeProgress: 0,
      beamSegments: [],
      litReceivers: 0,
      bonusGoal: createBonusGoal(route, index),
      bonusTracker: {
        talkedNpcs: {},
        wrongPlantCount: 0,
        runeResetCount: 0,
        mirrorTurns: 0,
        valveMistakes: 0
      },
      discovered: level.grid.map((row) => row.map(() => false)),
      ...inflateLevelActors(level)
    };
    if (play.hybrid.active) {
      play.randomEvent.enabled = false;
      play.randomEvent.triggerTimer = -1;
      initializeHybridRoamerWaves(play);
      if (play.merchantSpot) {
        play.merchantSpot.offers = createMerchantStock(play, 3);
        play.merchantSpot.visits = 0;
      }
    }
    play.player.maxHp = Math.min(5, 3 + Math.floor((play.progression.level - 1) / 2) * 0.5);
    play.player.hp = play.player.maxHp;
    play.player.defense = play.progression.defense;
    configureCampaignStage(play);
    return play;
  }

  function grantBombGear(play, source) {
    if (!play || !play.special) {
      return;
    }
    play.special.bombGearTimer = 9;
    play.special.bombCooldown = 0.15;
    play.special.bombIgnoreWalls = isCampaignStageAtLeast(play, 6);
    pushPrompt(play, `${source || '特殊装备'}已启动：追踪爆炸弹持续 9 秒。`);
    spawnTextEffect(play, play.player.x + 6, play.player.y - 8, '爆裂追踪', '#ffb770', 14, -18, 0.8);
  }

  function grantEmberGear(play, source) {
    if (!play || !play.special) {
      return;
    }
    play.special.emberGearTimer = 6;
    play.special.emberPulseCooldown = 0.1;
    pushPrompt(play, `${source || '特殊装备'}已启动：近身焚击持续 6 秒。`);
    spawnTextEffect(play, play.player.x + 6, play.player.y - 8, '近身焚击', '#ffdd8a', 14, -18, 0.8);
  }

  function configureCampaignStage(play) {
    if (!play) {
      return;
    }
    if (isCampaignStage(play, 4)) {
      const achievements = state.profile.achievements;
      if (!achievements.bombGearGifted) {
        achievements.bombGearGifted = true;
        grantBombGear(play, '第四关赠礼');
      }
    }
    if (isCampaignStage(play, 9)) {
      play.special.rain = true;
      const extraCount = Math.ceil((play.roamers || []).length * 0.5);
      for (let i = 0; i < extraCount; i += 1) {
        const base = play.roamers[i % Math.max(1, play.roamers.length)];
        if (base) {
          play.roamers.push({
            ...base,
            id: `${base.id}-storm-${i}`,
            x: base.x + ((i % 2) ? 12 : -12),
            y: base.y + ((i % 3) ? 10 : -10),
            hp: Math.round(base.maxHp || base.hp || 18),
            maxHp: Math.round(base.maxHp || base.hp || 18),
            speed: base.speed || 10,
            touchCooldown: 0,
            hitFlash: 0
          });
        }
      }
      play.hybrid.totalRoamers = (play.roamers || []).length;
      initializeHybridRoamerWaves(play);
    }
    if (isCampaignStageAtLeast(play, 8)) {
      spawnWorldLootDrop(play, 'embergear', play.player.x + 18, play.player.y + 12, 'field');
    }
    if (isCampaignStage(play, 11)) {
      play.special.rain = true;
      play.special.duckrope = {
        progress: 0,
        target: 100,
        intro: 1.4,
        success: false,
        npcA: { x: -24, y: play.player.y + 16, arrived: false },
        npcB: { x: -38, y: play.player.y + 26, arrived: false, active: false },
        endingTimer: 0
      };
      play.inventory.quickSlots = createQuickSlots();
      play.lootDrops = [];
      play.allies = [];
      play.allyGraves = [];
      play.decoys = [];
      play.hybrid.pendingRoamerWaves = [];
      play.hybrid.nextRoamerWaveDelay = 999;
      play.roamers = [];
      play.minibosses = [];
      play.bossMinions = [];
      play.merchantSpot = null;
      play.rewardChest = null;
      play.portalSpot = null;
      play.boss = {
        x: play.player.x + 90,
        y: play.player.y - 10,
        hp: 999,
        maxHp: 999,
        title: '拔河鸭王',
        duckBoss: true,
        touchCooldown: 0,
        deathTimer: 0,
        dying: false,
        hitFlash: 0,
        warningTimer: 99,
        summonTimer: 99,
        darkPulseTimer: 99,
        spawnTimer: 0
      };
    }
  }

  function getEnemyAimTarget(play, source) {
    let target = null;
    let bestDist = Infinity;
    (play.decoys || []).forEach((decoy) => {
      const dist = distance(source.x, source.y, decoy.x, decoy.y);
      if (dist < bestDist) {
        bestDist = dist;
        target = { type: 'decoy', actor: decoy, x: decoy.x, y: decoy.y, w: 12, h: 12 };
      }
    });
    if (target) {
      return target;
    }
    (play.allies || []).forEach((ally) => {
      if (ally.hp <= 0) {
        return;
      }
      const dist = distance(source.x, source.y, ally.x + 6, ally.y + 7);
      if (dist < bestDist) {
        bestDist = dist;
        target = { type: 'ally', actor: ally, x: ally.x, y: ally.y, w: ally.w || 12, h: ally.h || 14 };
      }
    });
    if (target) {
      return target;
    }
    return { type: 'player', actor: play.player, x: play.player.x, y: play.player.y, w: play.player.w, h: play.player.h };
  }

  function getPlayerDamageMultiplier(play) {
    return play && play.progression && play.progression.ascensionUnlocked ? 2 : 1;
  }

  function getPlayerCritBonus(play) {
    let bonus = 0;
    if (play && play.special && play.special.critRampReady) {
      bonus += 0.3;
    }
    return bonus;
  }

  function getAttackSpeedMultiplier(play) {
    return 1 + ((play && play.special && play.special.critRampStacks) || 0) * 0.02;
  }

  function triggerExecuteMark(target) {
    if (!target || target.executeTimer > 0 || target.hp <= 0) {
      return false;
    }
    target.executeTimer = 1;
    target.executeFlash = 1;
    return true;
  }

  function maybeTriggerExecute(play, target, targetType, x, y) {
    if (!play || !target || target.hp <= 0 || target.executeTimer > 0) {
      return false;
    }
    const chance = targetType === 'boss' ? 0.012 : (targetType === 'miniboss' ? 0.02 : 0.03);
    if (Math.random() >= chance) {
      return false;
    }
    const remain = target.maxHp ? Math.max(1, Math.round((target.hp / target.maxHp) * 100)) : 1;
    if (!triggerExecuteMark(target)) {
      return false;
    }
    pushPrompt(play, `<随机事件> 触发斩杀对象！对象斩杀前剩余血量：${remain}%`);
    spawnTextEffect(play, x, y - 10, '斩杀锁定', '#d7fff7', 15, -16, 1);
    play.feedback.executeFlash = Math.max(play.feedback.executeFlash, 0.28);
    return true;
  }

  function resolveExecuteDeath(play, target, targetType, x, y) {
    if (!play || !target) {
      return;
    }
    target.executeTimer = 0;
    target.executeFlash = 0;
    target.hp = 0;
    spawnBurstEffect(play, x, y, '#cffff4', 18, 30);
    spawnTextEffect(play, x, y - 8, '血刃终结', '#bafcf1', 16, -18, 0.88);
    if (targetType === 'boss') {
      target.dying = true;
      target.deathTimer = 1.25;
      play.enemyBullets = [];
      play.bossWarnings = [];
      play.bossMinions = [];
    } else if (targetType === 'miniboss' || targetType === 'roamer' || targetType === 'bossMinion') {
      trySpawnEnemyDrop(play, target, targetType === 'roamer' ? 'roamer' : 'miniboss');
    }
  }

  function updateExecuteTimer(play, target, targetType, delta, x, y) {
    if (!target || !(target.executeTimer > 0)) {
      return false;
    }
    target.executeTimer = Math.max(0, target.executeTimer - delta);
    target.executeFlash = Math.max(0, (target.executeFlash || 0) - delta);
    if (Math.random() < 0.34) {
      spawnBurstEffect(play, x, y, '#dcfff7', 3, 14);
    }
    if (target.executeTimer <= 0) {
      resolveExecuteDeath(play, target, targetType, x, y);
    }
    return true;
  }

  function awardAchievement(id) {
    if (state.profile.achievements[id]) {
      return;
    }
    state.profile.achievements[id] = true;
    const meta = getAchievementMeta(id);
    state.achievementBanner = {
      title: meta ? meta.name : '新成就',
      desc: meta ? meta.desc : '已完成一项新的挑战记录。',
      timer: 3
    };
  }

  function getRatingScore(letter) {
    return { C: 0, B: 1, A: 2, S: 3 }[letter] || 0;
  }

  function getBestStoredRating(route, index) {
    return state.profile.bestRatings[`${route}-${index}`] || 'C';
  }

  function storeBestRating(route, index, rating) {
    const key = `${route}-${index}`;
    if (getRatingScore(rating) >= getRatingScore(state.profile.bestRatings[key])) {
      state.profile.bestRatings[key] = rating;
    }
  }

  function getTotalRatingScore() {
    return Object.values(state.profile.bestRatings).reduce((sum, rating) => sum + getRatingScore(rating), 0);
  }

  function getGalleryUnlockCount() {
    const score = getTotalRatingScore();
    let count = 0;
    GALLERY_THRESHOLDS.forEach((threshold) => {
      if (score >= threshold) {
        count += 1;
      }
    });
    return count;
  }

  function getNextGalleryThreshold() {
    const score = getTotalRatingScore();
    return GALLERY_THRESHOLDS.find((threshold) => threshold > score) || null;
  }

  function hasAllRouteRatings(route, minimumRating) {
    const levels = window.GameMaps[route] || [];
    return levels.length > 0 && levels.every((level, index) => getRatingScore(getBestStoredRating(route, index)) >= getRatingScore(minimumRating));
  }

  function checkProgressAchievements() {
    if (hasAllRouteRatings('puzzle', 'S')) {
      awardAchievement('collector');
    }
  }

  function createBonusGoal(route, index) {
    const table = {
      'battle-0': { title: '清场探路', short: '清掉全部游荡怪，并保留 2 点以上生命完成环境点', reward: 6, tag: '前线调查员' },
      'battle-1': { title: '静夜双灯', short: '点亮 2 座灯座后收齐全部萤火', reward: 6, tag: '潜越导演' },
      'battle-2': { title: '压线反打', short: '至少保留 2 点生命击败暗影巨人', reward: 8, tag: '终幕主角' },
      'puzzle-0': { title: '谨慎侦察', short: '完成环境点并点亮整张大地图', reward: 6, tag: '地图侦察员' },
      'puzzle-1': { title: '折镜直觉', short: '和照影匠聊过后，用不超过 4 次翻镜点亮日照锁', reward: 6, tag: '光路工程师' },
      'puzzle-2': { title: '一遍推开', short: '不乱试闸门，凭逻辑一次解出正确组合', reward: 6, tag: '总闸侦探' }
    };
    const meta = table[getSceneKey(route, index)];
    return meta ? { ...meta, done: false, announced: false } : null;
  }

  function isBonusGoalComplete(play) {
    if (!play || !play.bonusGoal) {
      return false;
    }
    if (play.hybrid.active && play.route === 'battle' && play.levelIndex === 0) {
      return play.hybrid.defeatedRoamers >= play.hybrid.totalRoamers &&
        play.hybrid.completedSites >= play.hybrid.requiredSites &&
        play.player.hp >= 2;
    }
    if (play.hybrid.active && play.route === 'puzzle' && play.levelIndex === 0) {
      return play.hybrid.completedSites >= play.hybrid.requiredSites && play.hybrid.fullMapReveal;
    }
    if (play.route === 'battle' && play.levelIndex === 0) {
      return play.loreMarks.length > 0 && play.loreMarks.every((mark) => mark.read);
    }
    if (play.route === 'battle' && play.levelIndex === 1) {
      return play.shrines.length > 0 && play.shrines.every((shrine) => shrine.active) &&
        play.collectibles.length > 0 && play.collectibles.every((item) => item.collected);
    }
    if (play.route === 'battle' && play.levelIndex === 2) {
      return play.boss && play.boss.hp <= 0 && play.player.hp >= 2;
    }
    if (play.route === 'puzzle' && play.levelIndex === 0) {
      return play.flags.runeSolved && (play.bonusTracker.runeResetCount || 0) === 0;
    }
    if (play.route === 'puzzle' && play.levelIndex === 1) {
      return Boolean(play.bonusTracker.talkedNpcs['npc-mirror']) &&
        play.flags.mirrorSolved &&
        (play.bonusTracker.mirrorTurns || 0) <= 4;
    }
    if (play.route === 'puzzle' && play.levelIndex === 2) {
      return play.flags.bridgeOpen && (play.bonusTracker.valveMistakes || 0) === 0;
    }
    return false;
  }

  function getBonusGoalStatus(play) {
    if (!play || !play.bonusGoal) {
      return '本关没有额外惊喜目标';
    }
    if (play.bonusGoal.done) {
      return `已完成 · +${play.bonusGoal.reward} 金币`;
    }
    if (play.hybrid.active && play.route === 'battle' && play.levelIndex === 0) {
      return `清场 ${play.hybrid.defeatedRoamers}/${play.hybrid.totalRoamers} · 生命 ${play.player.hp}/3`;
    }
    if (play.hybrid.active && play.route === 'puzzle' && play.levelIndex === 0) {
      return play.hybrid.fullMapReveal ? `环境 ${play.hybrid.completedSites}/${play.hybrid.requiredSites}` : '先去观测塔点亮大地图';
    }
    if (play.route === 'battle' && play.levelIndex === 0) {
      return `残页 ${play.loreMarks.filter((mark) => mark.read).length}/${play.loreMarks.length}`;
    }
    if (play.route === 'battle' && play.levelIndex === 1) {
      return `灯座 ${play.shrines.filter((shrine) => shrine.active).length}/${play.shrines.length}`;
    }
    if (play.route === 'battle' && play.levelIndex === 2) {
      return `当前生命 ${play.player.hp}/3`;
    }
    if (play.route === 'puzzle' && play.levelIndex === 0) {
      return (play.bonusTracker.runeResetCount || 0) === 0 ? '目前保持一次点亮' : `已重置 ${play.bonusTracker.runeResetCount} 次`;
    }
    if (play.route === 'puzzle' && play.levelIndex === 1) {
      return `翻镜 ${play.bonusTracker.mirrorTurns || 0}/4 · ${play.flags.mirrorSolved ? '已通光' : '未通光'}`;
    }
    if (play.route === 'puzzle' && play.levelIndex === 2) {
      return (play.bonusTracker.valveMistakes || 0) > 0 ? `误试 ${play.bonusTracker.valveMistakes} 次` : '当前保持零误试';
    }
    return '进行中';
  }

  function updateBonusGoal(play) {
    if (!play || !play.bonusGoal) {
      return;
    }
    play.bonusGoal.done = isBonusGoalComplete(play);
    if (play.bonusGoal.done && !play.bonusGoal.announced) {
      play.bonusGoal.announced = true;
      spawnBurstEffect(play, play.player.x + 6, play.player.y + 7, '#ffe58b', 12, 28);
      pushPrompt(play, `额外挑战达成：${play.bonusGoal.title}，通关可额外获得 ${play.bonusGoal.reward} 金币。`);
    }
  }

  function getShareLine(info) {
    if (!info) {
      return '';
    }
    if (info.route === 'battle') {
      return info.rating === 'S' ? '危险区和终幕压迫都被你稳稳接住了。'
        : info.rating === 'A' ? '节奏已经很顺，只差一点就能打成纯净演出。'
          : info.rating === 'B' ? '惊险值拉满，属于很适合分享的一局。'
            : '虽然有点狼狈，但这才像真实的野外冒险。';
    }
    return info.rating === 'S' ? '探索、机关和收束都被你一步步推到了最优。'
      : info.rating === 'A' ? '整体推进很稳，只差一点就能把细节也补满。'
        : info.rating === 'B' ? '主线已经打通，但这片麦野还藏着更多细节。'
          : '像第一次摸清旧掌机的秘密，慢一点也很有味道。';
  }

  function computePuzzleCompletion(play) {
    if (play.hybrid.active) {
      const roamerRatio = play.hybrid.totalRoamers ? play.hybrid.defeatedRoamers / play.hybrid.totalRoamers : 1;
      const siteRatio = play.hybrid.requiredSites ? play.hybrid.completedSites / play.hybrid.requiredSites : 1;
      const optionalRatio = play.hybrid.optionalSites ? play.hybrid.optionalDone / play.hybrid.optionalSites : 0;
      return clamp(roamerRatio * 0.35 + siteRatio * 0.45 + optionalRatio * 0.1 + (play.hybrid.fullMapReveal ? 0.1 : 0), 0, 1);
    }
    const bonus = play.bonusGoal && play.bonusGoal.done ? 0.08 : 0;
    if (play.levelIndex === 0) {
      const total = play.level.runeSolution ? play.level.runeSolution.length : 0;
      return clamp((total ? play.runeProgress / total : 0) * 0.8 + (play.flags.runeSolved ? 0.2 : 0) + bonus, 0, 1);
    }
    if (play.levelIndex === 1) {
      const receiverRatio = play.receivers.length ? play.litReceivers / play.receivers.length : 0;
      return clamp(receiverRatio * 0.8 + (play.flags.mirrorSolved ? 0.2 : 0) + bonus, 0, 1);
    }
    const targetCount = play.level.valveGoal ? Object.keys(play.level.valveGoal).length : 0;
    const correctCount = targetCount ? play.valves.filter((valve) => play.level.valveGoal[valve.id] === valve.on).length : 0;
    return clamp((targetCount ? correctCount / targetCount : 0) * 0.8 + (play.flags.bridgeOpen ? 0.2 : 0) + bonus, 0, 1);
  }

  function computeLevelRating(play) {
    if (play.route === 'battle') {
      if (play.run.damageTaken === 0) return 'S';
      if (play.run.damageTaken <= 1) return 'A';
      if (play.run.damageTaken <= 3) return 'B';
      return 'C';
    }
    const completion = computePuzzleCompletion(play);
    play.run.completion = completion;
    if (completion >= 1) return 'S';
    if (completion >= 0.9) return 'A';
    if (completion >= 0.7) return 'B';
    return 'C';
  }

  function getRatingSummary(rating, route) {
    if (route === 'battle') {
      return rating === 'S' ? '危险区、守卫区和终幕压迫都处理得非常漂亮。'
        : rating === 'A' ? '受击很少，整体节奏已经相当稳定。'
          : rating === 'B' ? '虽然有惊险失误，但还是把战役稳稳推进下去了。'
            : '硬扛着闯过来了，下一轮还能更利落。';
    }
    return rating === 'S' ? '探索、机关和收束都做到了极高完成度。'
      : rating === 'A' ? '完成度已经很高，只差一点点就完美。'
        : rating === 'B' ? '主线推进稳定，探索度还可以再挖深。'
          : '虽然过关了，但还有不少隐藏反馈没顾上。';
  }

  function getShopItem(itemId) {
    return SHOP_ITEMS.find((item) => item.id === itemId) || null;
  }

  function getQuickSlot(play, slotId) {
    return play.inventory.quickSlots.find((slot) => slot.id === slotId) || null;
  }

  function addQuickSlot(play, slotId, amount) {
    const slot = getQuickSlot(play, slotId);
    if (slot) {
      slot.count += amount;
    }
  }

  function getBackpackEntry(play, itemId) {
    return play && play.inventory && play.inventory.backpack
      ? play.inventory.backpack.find((entry) => entry.id === itemId) || null
      : null;
  }

  function addBackpackItem(play, itemId, amount, label) {
    if (!play.inventory.backpack) {
      play.inventory.backpack = [];
    }
    let entry = getBackpackEntry(play, itemId);
    if (!entry) {
      entry = {
        id: itemId,
        name: label || (getShopItem(itemId)?.name || itemId),
        count: 0
      };
      play.inventory.backpack.push(entry);
    }
    entry.count += amount;
  }

  function getLootDropLabel(itemId) {
    return itemId === 'potion' ? '药水'
      : itemId === 'shield' ? '护盾'
        : itemId === 'boots' ? '靴子'
          : itemId === 'exp' ? '历练手册'
            : itemId === 'ally' ? '协战呼哨'
          : itemId === 'decoy' ? '诱饵'
            : itemId === 'bombgear' ? '爆裂追踪'
              : itemId === 'embergear' ? '近身焚击'
            : itemId === 'skyblade' ? '裂穹刀'
            : itemId === 'dagger' ? '长刀'
              : itemId === 'wand' ? '巨刃'
                : itemId === 'axe' ? '重斧'
                  : itemId === 'sword' ? '近战剑'
                : itemId === 'coin' ? '金币'
                  : '补给';
  }

  function gainCoins(amount, play, x, y, text) {
    state.profile.coins += amount;
    refreshUnlocks();
    if (play) {
      spawnBurstEffect(play, x, y, '#ffe58b', Math.min(8, 4 + amount), 20);
      pushPrompt(play, `${text || '金币'} +${amount}`);
    }
  }

  function gainExp(play, amount, x, y, source) {
    if (!play || !amount) {
      return;
    }
    play.progression.exp += amount;
    state.profile.totalExp += amount;
    if (x !== undefined && y !== undefined) {
      spawnBurstEffect(play, x, y, '#8fdcff', Math.min(10, 4 + amount), 20);
    }
    pushPrompt(play, `${source || '历练'} +${amount} 经验`);
    while (play.progression.level < MAX_LEVEL && play.progression.exp >= play.progression.nextExp) {
      play.progression.exp -= play.progression.nextExp;
      play.progression.level += 1;
      play.progression.nextExp = getSupportLevelThreshold(play.progression.level);
      state.profile.supportLevel = Math.max(state.profile.supportLevel || 1, play.progression.level);
      play.progression.defense = Math.min(0.4, play.progression.defense + 0.08);
      play.player.defense = play.progression.defense;
      play.player.maxHp = Math.min(5, play.player.maxHp + 0.5);
      play.player.hp = Math.min(play.player.maxHp, play.player.hp + 1);
      triggerFeedbackEvent(play, 'heal');
      if (play.progression.level === MAX_LEVEL && !play.progression.ascensionUnlocked) {
        play.progression.ascensionUnlocked = true;
        play.player.invuln = Math.max(play.player.invuln, 9999);
        pushPrompt(play, '首次达到 10 级：伤害翻倍，且本局进入完全免伤。');
        spawnTextEffect(play, play.player.x + 6, play.player.y - 20, '满级觉醒', '#ffeeb0', 18, -18, 1);
      } else {
        pushPrompt(play, `升到 ${play.progression.level} 级，生命上限和防御都提升了。`);
      }
    }
    if (play.progression.level >= MAX_LEVEL) {
      play.progression.level = MAX_LEVEL;
      play.progression.exp = Math.min(play.progression.exp, play.progression.nextExp);
    }
    refreshUnlocks();
  }

  function getRandomSupportOfferPool(play) {
    const pool = ['potion', 'shield', 'boots', 'exp', 'ally', 'dagger', 'wand'];
    if ((play && Number.isFinite(play.levelIndex) && play.levelIndex >= 1) || (play && Number.isFinite(play.campaignStep) && play.campaignStep >= 2)) {
      pool.push('axe');
    }
    if (play && Number.isFinite(play.campaignStep) && play.campaignStep >= 6) {
      pool.push('skyblade');
    }
    return pool;
  }

  function createCampaignSupplyOffers(play, count) {
    const total = Math.max(1, count || 5);
    const pool = getRandomSupportOfferPool(play).slice();
    const offers = [];
    const used = new Set();
    while (offers.length < total && pool.length) {
      const pickIndex = Math.floor(Math.random() * pool.length);
      const itemId = pool.splice(pickIndex, 1)[0];
      if (used.has(itemId)) {
        continue;
      }
      const item = getShopItem(itemId);
      if (!item) {
        continue;
      }
      used.add(itemId);
      offers.push({
        itemId: item.id,
        name: item.name,
        desc: item.desc,
        price: Math.max(4, item.id === 'ally' ? 18 : Math.floor(item.price * (item.id === 'exp' ? 0.75 : 0.9)))
      });
    }
    return offers;
  }

  function createRandomChestLoot(play, count) {
    const total = Math.max(3, count || 5);
    const pool = getRandomSupportOfferPool(play).concat(['coin', 'coin', 'exp']);
    const drops = [];
    for (let i = 0; i < total; i += 1) {
      drops.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    if (play && Number.isFinite(play.campaignStep) && play.campaignStep >= 6) {
      drops[0] = 'skyblade';
    }
    return drops;
  }

  function getRandomAllyWeapon(play) {
    const pool = ['sword', 'dagger', 'wand', 'axe'];
    if (play && Number.isFinite(play.campaignStep) && play.campaignStep >= 7) {
      pool.push('skyblade');
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function getAllyWeaponProfile(weaponId) {
    if (weaponId === 'skyblade') {
      return { range: 126, keepDistance: 40, speed: 86, strikeScale: 1.25, knockback: 28, color: '#bfe9ff', role: '裂穹' };
    }
    if (weaponId === 'dagger') {
      return { range: 92, keepDistance: 20, speed: 94, strikeScale: 0.62, knockback: 10, color: '#ffd688', role: '突击' };
    }
    if (weaponId === 'wand') {
      return { range: 118, keepDistance: 34, speed: 78, strikeScale: 0.92, knockback: 18, color: '#d7c2ff', role: '重刃' };
    }
    if (weaponId === 'axe') {
      return { range: 96, keepDistance: 18, speed: 74, strikeScale: 1.05, knockback: 22, color: '#ffbf95', role: '破阵' };
    }
    return { range: 88, keepDistance: 16, speed: 84, strikeScale: 0.72, knockback: 12, color: '#9fe1ff', role: '护卫' };
  }

  function spawnAiCompanion(play, x, y, weaponId) {
    if (!play) {
      return null;
    }
    const ally = {
      id: `ally-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      x: x !== undefined ? x : play.player.x - 12,
      y: y !== undefined ? y : play.player.y + 6,
      w: 12,
      h: 14,
      hp: 2.5,
      maxHp: 2.5,
      weapon: weaponId || getRandomAllyWeapon(play),
      name: `协战者 ${play.allies.length + 1}`,
      attackCooldown: 0,
      touchCooldown: 0,
      hitFlash: 0,
      facing: 'down',
      walking: false,
      aimX: 0,
      aimY: 0,
      colorShirt: ['#8dc8ff', '#ff9dbe', '#9be6b1', '#d9b7ff'][Math.floor(Math.random() * 4)],
      colorPants: ['#5c78a4', '#745b4d', '#5f6d93', '#7e5e9f'][Math.floor(Math.random() * 4)]
    };
    play.allies.push(ally);
    spawnBurstEffect(play, ally.x + 6, ally.y + 7, '#ffc9e8', 10, 24);
    pushPrompt(play, `${ally.name} 加入了队伍，使用的是${getWeaponDisplayName(ally.weapon)}。`);
    return ally;
  }

  function handleCompanionDeath(play, ally) {
    play.allies = play.allies.filter((entry) => entry !== ally);
    play.allyGraves.push({
      id: `grave-${ally.id}`,
      x: ally.x,
      y: ally.y,
      rewardSeed: Math.random()
    });
    spawnBurstEffect(play, ally.x + 6, ally.y + 7, '#d7d0ff', 8, 22);
    pushPrompt(play, `${ally.name} 倒下了，原地留下了一座墓碑。`);
  }

  function applyShopPurchase(play, itemId) {
    if (itemId === 'coin') {
      gainCoins(12, play, play.player.x + 6, play.player.y + 7, '金币补给');
    } else if (itemId === 'potion') {
      addQuickSlot(play, 'potion', 1);
    } else if (itemId === 'dagger') {
      play.inventory.weapon = 'dagger';
    } else if (itemId === 'wand') {
      play.inventory.weapon = 'wand';
    } else if (itemId === 'axe') {
      play.inventory.weapon = 'axe';
    } else if (itemId === 'skyblade') {
      play.inventory.weapon = 'skyblade';
      play.inventory.critBonus = Math.max(play.inventory.critBonus || 0, 0.06);
    } else if (itemId === 'sword') {
      play.inventory.weapon = 'sword';
    } else if (itemId === 'decoy') {
      addQuickSlot(play, 'decoy', 1);
    } else if (itemId === 'shield') {
      play.inventory.shieldReady = true;
      const slot = getQuickSlot(play, 'shield');
      if (slot) slot.count = 1;
    } else if (itemId === 'boots') {
      play.inventory.moveMultiplier = 1.5;
      const slot = getQuickSlot(play, 'boots');
      if (slot) slot.count = 1;
    } else if (itemId === 'exp') {
      gainExp(play, 5, play.player.x + 6, play.player.y + 7, '补给训练');
    } else if (itemId === 'ally') {
      spawnAiCompanion(play, play.player.x - 10 + Math.random() * 20, play.player.y + 4 + Math.random() * 10);
    }
  }

  function rebuildShopLoadout(play, boughtMap) {
    play.inventory.quickSlots = createQuickSlots();
    play.inventory.weapon = 'sword';
    play.inventory.moveMultiplier = 1;
    play.inventory.shieldReady = false;
    play.inventory.critBonus = 0;
    Object.keys(boughtMap).forEach((itemId) => {
      if (boughtMap[itemId]) {
        applyShopPurchase(play, itemId);
      }
    });
  }

  function clearShopPurchases() {
    const play = state.play;
    if (!play || !state.overlay || state.overlay.type !== 'shop') {
      return;
    }
    const refund = Object.keys(state.overlay.bought).reduce((sum, itemId) => {
      const offer = (state.overlay.offers || []).find((entry) => entry.itemId === itemId);
      return sum + (offer ? offer.price : 0);
    }, 0);
    state.profile.coins += refund;
    state.overlay.bought = {};
    rebuildShopLoadout(play, state.overlay.bought);
    state.overlay.message = refund > 0 ? `已清空本关购物，返还 ${refund} 金币` : '当前还没有已购项目';
    refreshUnlocks();
    saveProgress(false);
  }

  function getShopLoadoutSummary(play) {
    const summary = [];
    if (play.inventory.weapon === 'skyblade') summary.push('裂穹刀');
    if (play.inventory.weapon === 'dagger') summary.push('长刀');
    if (play.inventory.weapon === 'wand') summary.push('巨刃');
    if (play.inventory.weapon === 'axe') summary.push('重斧');
    if (play.inventory.weapon === 'sword') summary.push('近战剑');
    if (play.inventory.shieldReady) summary.push('护盾');
    if ((play.inventory.moveMultiplier || 1) > 1) summary.push('加速靴');
    if (play.allies && play.allies.length) summary.push(`队友x${play.allies.length}`);
    play.inventory.quickSlots.forEach((slot) => {
      if (slot.count > 0 && (slot.id === 'potion' || slot.id === 'decoy')) {
        summary.push(`${slot.name}x${slot.count}`);
      }
    });
    return summary.length ? summary.join(' / ') : '当前未装备';
  }

  function getWeaponCooldown(play) {
    return getWeaponStats(play).cooldown / getAttackSpeedMultiplier(play);
  }

  function getItemIconName(itemId) {
    return itemId === 'coin' ? 'coin'
      : itemId === 'potion' ? 'potionRed'
      : itemId === 'bombgear' ? 'bomb'
      : itemId === 'embergear' ? 'fire'
      : itemId === 'skyblade' ? 'sword'
      : itemId === 'dagger' ? 'dagger'
        : itemId === 'wand' ? 'axe'
          : itemId === 'axe' ? 'axe'
            : itemId === 'sword' ? 'sword'
        : itemId === 'exp' ? 'exp'
          : itemId === 'ally' ? 'shop'
        : itemId === 'shield' ? 'shieldFull'
          : itemId === 'boots' ? 'speed'
            : itemId === 'decoy' ? 'bomb'
              : 'question';
  }

  function getWeaponDisplayName(weaponId) {
    return getWeaponStats({ inventory: { weapon: weaponId } }).name;
  }

  function getWeaponStats(play) {
    const weaponId = play && play.inventory && play.inventory.weapon ? play.inventory.weapon : 'sword';
    const mutationTier = getWeaponMutationTier(play);
    const lateBoost = mutationTier * 2;
    const critBonus = play && play.inventory ? (play.inventory.critBonus || 0) : 0;
    if (weaponId === 'skyblade') {
      return {
        name: '裂穹刀',
        reach: 50 + mutationTier * 2,
        radius: 44 + mutationTier * 2,
        damage: Math.round((32 + lateBoost * 2) * getPlayerDamageMultiplier(play)),
        cooldown: 0.72,
        critChance: 0.22 + mutationTier * 0.03 + critBonus + getPlayerCritBonus(play),
        critMultiplier: 2.55,
        globalSlashChance: 0.14 + mutationTier * 0.03,
        status: mutationTier >= 4 ? '裂穹灭场中' : '裂穹重斩中'
      };
    }
    if (weaponId === 'dagger') {
      return { name: '长刀', reach: 34 + mutationTier, radius: 30 + mutationTier, damage: Math.round((16 + lateBoost) * getPlayerDamageMultiplier(play)), cooldown: 0.24, critChance: 0.14 + mutationTier * 0.018 + critBonus + getPlayerCritBonus(play), critMultiplier: 1.88, globalSlashChance: 0, status: mutationTier >= 3 ? '长刀疯斩中' : '长刀快斩中' };
    }
    if (weaponId === 'wand') {
      return { name: '巨刃', reach: 42 + mutationTier * 2, radius: 34 + mutationTier, damage: Math.round((22 + lateBoost * 2) * getPlayerDamageMultiplier(play)), cooldown: Math.max(0.48, 0.66 - mutationTier * 0.03), critChance: 0.12 + mutationTier * 0.016 + critBonus + getPlayerCritBonus(play), critMultiplier: 2.1, globalSlashChance: mutationTier >= 4 ? 0.06 : 0, status: mutationTier >= 3 ? '巨刃镇场中' : '巨刃重斩中' };
    }
    if (weaponId === 'axe') {
      return { name: '重斧', reach: 36 + mutationTier, radius: 32 + mutationTier * 2, damage: Math.round((20 + lateBoost * 2) * getPlayerDamageMultiplier(play)), cooldown: Math.max(0.38, 0.5 - mutationTier * 0.02), critChance: 0.18 + mutationTier * 0.022 + critBonus + getPlayerCritBonus(play), critMultiplier: 2.2, globalSlashChance: mutationTier >= 3 ? 0.05 : 0, status: mutationTier >= 3 ? '重斧碎场中' : '重斧横扫中' };
    }
    return { name: '近战剑', reach: 28 + mutationTier, radius: 26 + mutationTier, damage: Math.round((12 + lateBoost) * getPlayerDamageMultiplier(play)), cooldown: Math.max(0.22, 0.32 - mutationTier * 0.02), critChance: 0.08 + mutationTier * 0.015 + critBonus + getPlayerCritBonus(play), critMultiplier: 1.75, globalSlashChance: mutationTier >= 4 ? 0.04 : 0, status: mutationTier >= 3 ? '近战暴走中' : '近战连斩中' };
  }

  function isWeaponItem(itemId) {
    return itemId === 'sword' || itemId === 'dagger' || itemId === 'wand' || itemId === 'axe' || itemId === 'skyblade';
  }

  function getEnemyWeaponDropPool(play) {
    const pool = ['dagger', 'wand'];
    if (Number.isFinite(play && play.campaignStep) && play.campaignStep >= 2) {
      pool.push('axe');
    }
    if (Number.isFinite(play && play.campaignStep) && play.campaignStep >= 6) {
      pool.push('skyblade');
    }
    return pool;
  }

  function getBossDamageValue(play, source) {
    const step = Number.isFinite(play && play.campaignStep) ? play.campaignStep : (play && Number.isFinite(play.levelIndex) ? play.levelIndex : 0);
    if (source === 'miniboss') {
      return step >= 4 ? 2 : 1;
    }
    if (source === 'boss') {
      return step >= 3 ? 2 : 1;
    }
    return step >= 5 ? 2 : 1;
  }

  function spawnWorldLootDrop(play, itemId, x, y, source) {
    if (!play) {
      return;
    }
    play.lootDrops.push({
      id: `${itemId}-${source || 'field'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      itemId,
      name: getLootDropLabel(itemId),
      x,
      y,
      source: source || 'field'
    });
  }

  function trySpawnEnemyDrop(play, target, kind) {
    if (!play || !target || (play.hybrid && play.hybrid.phase === 'reward')) {
      return;
    }
    const cx = target.x + (target.w || 12) * 0.5;
    const cy = target.y + (target.h || 12) * 0.5;
    const coinChance = kind === 'miniboss' ? 0.6 : 0.16;
    const weaponChance = kind === 'miniboss' ? 0.16 : 0.035;
    if (Math.random() < coinChance) {
      spawnWorldLootDrop(play, 'coin', cx - 6, cy - 2, 'enemy');
      spawnBurstEffect(play, cx, cy, '#ffe58b', 6, 16);
    }
    if (Math.random() < weaponChance) {
      const pool = getEnemyWeaponDropPool(play);
      const weaponId = pool[Math.floor(Math.random() * pool.length)];
      spawnWorldLootDrop(play, weaponId, cx + 6, cy + 2, 'enemy');
      spawnBurstEffect(play, cx, cy, '#b5dcff', 8, 18);
      pushPrompt(play, `${getLootDropLabel(weaponId)} 掉在地上了，靠近可拾取。`);
    }
    if (Math.random() < (kind === 'miniboss' ? 0.28 : 0.08)) {
      spawnWorldLootDrop(play, Math.random() < 0.7 ? 'exp' : 'ally', cx, cy + 6, 'enemy');
    }
    if (isCampaignStageAtLeast(play, 3)) {
      const bombChance = 0.03;
      if (Math.random() < bombChance) {
        spawnWorldLootDrop(play, 'bombgear', cx - 2, cy + 10, 'enemy');
      }
    }
    if (isCampaignStageAtLeast(play, 6)) {
      const emberChance = isCampaignStageAtLeast(play, 8) ? 0.16 : 0.08;
      if (Math.random() < emberChance) {
        spawnWorldLootDrop(play, 'embergear', cx + 2, cy + 10, 'enemy');
      }
    }
  }

  function openDeathOverlay(reason) {
    state.overlay = {
      type: 'death',
      title: '你倒下了',
      message: reason || '这次推进失败了，重新整顿后再试一次。'
    };
  }

  function pickHybridRoamerSprite(theme, index) {
    const nightPool = ['slimeGreen', 'skeletonShield', 'goblinTorch', 'ghostBlue', 'bat', 'cultistPurple', 'slimeFire'];
    const dayPool = ['slimeBlue', 'mushroom', 'rockGolem', 'zombie', 'mageBlue', 'spider', 'mimicPlant'];
    const pool = theme === 'night' ? nightPool : dayPool;
    return pool[index % pool.length];
  }

  function pickHybridMiniBossSprite(theme, index) {
    const nightPool = ['bruteHorn', 'boarDemon', 'skeletonKnight'];
    const dayPool = ['iceGolem', 'stoneKnight', 'magePurple'];
    const pool = theme === 'night' ? nightPool : dayPool;
    return pool[index % pool.length];
  }

  function getCampaignBossFrames(play) {
    const stage = getCampaignStageNumber(play);
    if (stage >= 9) return ['finalBossA', 'finalBossB'];
    if (stage === 8) return ['dragonBoss'];
    if (stage === 7) return ['stoneKnight'];
    if (stage === 6) return ['iceGolem'];
    if (stage === 5) return ['lavaBoss'];
    if (stage === 4) return ['treeBoss'];
    if (stage === 3) return ['ogreBoss'];
    if (stage === 2) return ['magePurple'];
    return ['dragonBoss'];
  }

  function getCampaignBossTitle(play) {
    const stage = getCampaignStageNumber(play);
    if (stage >= 9) return '暴雨主宰';
    if (stage === 8) return '裂穹龙君';
    if (stage === 7) return '石冠战王';
    if (stage === 6) return '霜牢魔像';
    if (stage === 5) return '熔火监视者';
    if (stage === 4) return '古树主宰';
    if (stage === 3) return '荒城巨像';
    if (stage === 2) return '紫冠术主';
    return '裂隙领主';
  }

  function getCampaignBossWavePlan(play) {
    const stage = getCampaignStageNumber(play);
    if (stage >= 9) {
      return [
        { delay: 4.5, title: '炎狱副王', spriteFrames: ['lavaBoss'], hpScale: 0.44, speedScale: 1.02 },
        { delay: 4.8, title: '古树副王', spriteFrames: ['treeBoss'], hpScale: 0.48, speedScale: 1.04 },
        { delay: 5.2, title: '寒牢副王', spriteFrames: ['iceGolem'], hpScale: 0.52, speedScale: 1.06 }
      ];
    }
    if (stage === 8) {
      return [
        { delay: 5.2, title: '重铠副王', spriteFrames: ['ogreBoss'], hpScale: 0.46, speedScale: 1.02 },
        { delay: 5.6, title: '龙影副王', spriteFrames: ['finalBossA', 'finalBossB'], hpScale: 0.5, speedScale: 1.04 }
      ];
    }
    if (stage === 7) {
      return [
        { delay: 6.2, title: '寒脊副王', spriteFrames: ['iceGolem'], hpScale: 0.48, speedScale: 1.02 }
      ];
    }
    return [];
  }

  function getRewardChestTier(play) {
    const step = Number.isFinite(play && play.campaignStep) ? play.campaignStep : 0;
    if (step >= 5) return 'boss';
    if (step >= 3) return 'epic';
    if (step >= 1) return 'rare';
    return 'common';
  }

  function getUiTheme(theme) {
    const night = theme === 'night';
    return {
      shell: night ? '#f8fbff' : '#fffefb',
      shellBorder: night ? '#acd8ff' : '#c8ddff',
      panel: night ? '#ffffff' : '#fffefd',
      panelSoft: night ? '#eef8ff' : '#f5f7ff',
      panelMute: night ? '#e5eefc' : '#eef4ff',
      text: '#4f463e',
      softText: night ? '#6c7fa6' : '#7f7292',
      accent: night ? '#67d5ff' : '#75c8ff',
      accentSoft: night ? '#dff6ff' : '#e8f7ff',
      gold: '#ffe18c',
      alert: '#ff8ea5',
      ok: '#78dca0',
      blue: '#7db8ff',
      coral: '#ffb7c7',
      plum: '#cdbbff',
      tape: night ? '#eef8ff' : '#f4f8ff',
      shadow: night ? 'rgba(94, 141, 182, 0.14)' : 'rgba(123, 154, 210, 0.16)',
      line: night ? '#d3e9ff' : '#dfe8ff',
      stickerBorder: night ? '#bfe4ff' : '#c6d8ff'
    };
  }

  function getGlobalUiTheme() {
    return getUiTheme('day');
  }

  function drawPaperCard(x, y, w, h, fill, border, shadow) {
    const ui = getGlobalUiTheme();
    Sprite.rect(ctx, x + 2, y + 4, w, h, shadow || ui.shadow);
    Sprite.frame(ctx, x, y, w, h, fill, border);
    Sprite.rect(ctx, x + 4, y + 4, w - 8, 2, 'rgba(255,255,255,0.75)');
    Sprite.rect(ctx, x + 6, y + 8, Math.min(26, Math.max(14, Math.floor(w * 0.18))), 2, ui.accent);
    Sprite.rect(ctx, x + 6, y + 12, Math.min(18, Math.max(10, Math.floor(w * 0.12))), 2, ui.coral);
    Sprite.rect(ctx, x + Math.floor(w * 0.5) - 10, y + 8, 20, 2, ui.gold);
    Sprite.rect(ctx, x + w - Math.min(28, Math.max(14, Math.floor(w * 0.2))) - 6, y + h - 10, Math.min(28, Math.max(14, Math.floor(w * 0.2))), 2, ui.blue);
    Sprite.rect(ctx, x + w - 28, y + 8, 14, 2, ui.plum);
    Sprite.rect(ctx, x + 4, y + h - 6, w - 8, 1, ui.line);
  }

  function drawSticker(x, y, w, h, text, fill, textColor, border) {
    Sprite.frame(ctx, x, y, w, h, fill, border || '#decfb9');
    Sprite.rect(ctx, x + 2, y + 2, w - 4, 2, 'rgba(255,255,255,0.16)');
    Sprite.label(ctx, text, x + w * 0.5, y + Math.max(4, Math.floor(h * 0.28)), textColor, h >= 18 ? 10 : 9, 'center');
  }

  function drawSectionTag(x, y, text, ui, tone) {
    const fill = tone === 'blue' ? ui.blue : tone === 'gold' ? ui.gold : tone === 'coral' ? ui.coral : ui.accent;
    drawSticker(x, y, 58, 16, text, fill, '#fffdf7', ui.stickerBorder);
  }

  function drawUiAccentLine(x, y, w, color) {
    Sprite.rect(ctx, x, y, w, 2, color);
    Sprite.rect(ctx, x, y + 3, Math.max(16, Math.floor(w * 0.35)), 1, 'rgba(255,255,255,0.18)');
  }

  function drawIconTile(x, y, size, fill, border, icon) {
    Sprite.frame(ctx, x, y, size, size, fill, border);
    if (Sprite.drawIcon && icon) {
      Sprite.drawIcon(ctx, icon, x + 2, y + 2, size - 4);
    }
  }

  function purchaseShopItem(itemId) {
    const play = state.play;
    if (!play || !state.overlay || state.overlay.type !== 'shop') {
      return;
    }
    const offer = (state.overlay.offers || []).find((entry) => entry.itemId === itemId);
    const item = getShopItem(itemId);
    if (!item || !offer) {
      return;
    }
    if (state.overlay.bought[itemId]) {
      state.profile.coins += offer.price;
      delete state.overlay.bought[itemId];
      rebuildShopLoadout(play, state.overlay.bought);
      state.overlay.message = `${item.name} 已取消`;
      refreshUnlocks();
      saveProgress(false);
      return;
    }
    if (state.profile.coins < offer.price) {
      state.overlay.message = '金币不够';
      return;
    }
    state.profile.coins -= offer.price;
    state.overlay.bought[itemId] = true;
    rebuildShopLoadout(play, state.overlay.bought);
    state.overlay.message = `${item.name} 已装备`;
    refreshUnlocks();
    saveProgress(false);
  }

  function closeShopOverlay() {
    if (!state.overlay || state.overlay.type !== 'shop') {
      return;
    }
    const introQueue = state.overlay.pendingIntro;
    state.overlay = null;
    if (introQueue && introQueue.length) {
      startDialogue(introQueue);
    }
  }

  function useQuickSlot(slotId) {
    if (state.screen !== SCREEN.PLAYING || !state.play || state.dialogue || state.overlay) {
      return;
    }
    const play = state.play;
    const slot = getQuickSlot(play, slotId);
    if (!slot || slot.count <= 0) {
      pushPrompt(play, '这个格子里还没有可用道具。');
      return;
    }
    if (slotId === 'potion') {
      if (play.player.hp >= 3) {
        pushPrompt(play, '生命已满，先留着药水。');
        return;
      }
      play.player.hp = Math.min(3, play.player.hp + 1);
      slot.count -= 1;
      spawnBurstEffect(play, play.player.x + 6, play.player.y + 7, '#ff8f95', 10, 20);
      triggerFeedbackEvent(play, 'heal');
      pushPrompt(play, '药水生效，恢复了 1 点生命。');
    } else if (slotId === 'decoy') {
      slot.count -= 1;
      play.decoys.push({
        x: play.player.x,
        y: play.player.y,
        ttl: 5
      });
      spawnBurstEffect(play, play.player.x + 6, play.player.y + 7, '#d9c4ff', 8, 18);
      pushPrompt(play, '诱饵假人落地了，守卫会被它吸引。');
    } else if (slotId === 'shield') {
      pushPrompt(play, play.inventory.shieldReady ? '护盾待命中，首次受击会自动挡下。' : '护盾已经碎掉了。');
    } else if (slotId === 'boots') {
      pushPrompt(play, '加速靴已经持续生效。');
    }
  }

  function getFacingAngle(facing) {
    return facing === 'up' ? -Math.PI / 2
      : facing === 'down' ? Math.PI / 2
        : facing === 'left' ? Math.PI
          : 0;
  }

  function angleToFacing(angle) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    return Math.abs(dx) > Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'down' : 'up');
  }

  function hasContinueGame() {
    return Boolean(state.profile.continueData ||
      state.routeProgress.battle.currentLevel > 0 ||
      state.routeProgress.puzzle.currentLevel > 0 ||
      state.routeProgress.battle.cleared ||
      state.routeProgress.puzzle.cleared);
  }

  function continueSavedGame() {
    if (state.profile.continueData) {
      const info = state.profile.continueData;
      if (Number.isFinite(info.campaignStep)) {
        loadCampaignStep(info.campaignStep, false);
        return;
      }
      loadLevel(info.route, info.levelIndex, false);
      return;
    }
    loadCampaignStep(0, false);
  }

  function bindEvents() {
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    document.addEventListener('contextmenu', blockNativeSelection);
    document.addEventListener('selectstart', blockNativeSelection);
    document.addEventListener('dragstart', blockNativeSelection);
    document.addEventListener('gesturestart', blockNativeSelection);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    window.addEventListener('error', (event) => {
      lastFatalMessage = event && (event.message || (event.error && event.error.message)) ? String(event.message || event.error.message) : '运行时错误';
      console.error(event.error || event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
      lastFatalMessage = event && event.reason ? String(event.reason.message || event.reason) : 'Promise 异常';
      console.error(event.reason);
    });
  }

  function blockNativeSelection(event) {
    event.preventDefault();
  }

  function resize() {
    SAFE.top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('padding-top')) || 0;
    SAFE.right = 0;
    SAFE.bottom = 0;
    SAFE.left = 0;
    const width = window.innerWidth;
    const height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    layout.scale = Math.min(width / BASE_WIDTH, height / BASE_HEIGHT);
    layout.width = BASE_WIDTH * layout.scale;
    layout.height = BASE_HEIGHT * layout.scale;
    layout.offsetX = (width - layout.width) * 0.5;
    layout.offsetY = (height - layout.height) * 0.5;
  }

  function onKeyDown(event) {
    state.keys[event.key.toLowerCase()] = true;
    if (event.key === 'Home') {
      toggleGmMenu();
      event.preventDefault();
      return;
    }
    if (event.key === 'z' || event.key === 'Enter') {
      state.keyboardInteract = true;
      event.preventDefault();
    }
    if (event.key === 'x') {
      state.keyboardAttack = true;
      event.preventDefault();
    }
    if (event.key === 'c' || event.key === 'Shift') {
      state.keyboardDash = true;
      event.preventDefault();
    }
    if (event.key === 'Escape') {
      if (state.overlay && state.overlay.type === 'gm') {
        closeGmMenu();
      } else {
        togglePause();
      }
      event.preventDefault();
    }
    if (event.key.toLowerCase() === 'm') {
      toggleMapView();
      event.preventDefault();
    }
    if (event.key.toLowerCase() === 'b') {
      toggleBackpack();
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    delete state.keys[event.key.toLowerCase()];
  }

  function onPointerDown(event) {
    event.preventDefault();
    const point = toBasePoint(event);
    const hit = findHitArea(point);
    state.pointers[event.pointerId] = {
      x: point.x,
      y: point.y,
      startX: point.x,
      startY: point.y,
      moved: false,
      consumed: false
    };

    if (hit) {
      if (hit.kind === 'tap') {
        hit.action();
        state.pointers[event.pointerId].consumed = true;
      } else if (hit.kind === 'interact') {
        triggerInteract();
        state.pointers[event.pointerId].consumed = true;
      } else if (hit.kind === 'dash') {
        triggerDash();
        state.pointers[event.pointerId].consumed = true;
      }
    } else if (state.dialogue && !state.overlay) {
      advanceDialogue();
      state.pointers[event.pointerId].consumed = true;
    }
  }

  function onPointerMove(event) {
    const point = toBasePoint(event);
    const pointer = state.pointers[event.pointerId];
    if (!pointer) {
      return;
    }
    pointer.x = point.x;
    pointer.y = point.y;
    if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > 8) {
      pointer.moved = true;
    }
  }

  function onPointerUp(event) {
    const pointer = state.pointers[event.pointerId];
    if (pointer && !pointer.consumed && state.screen === SCREEN.PLAYING && state.play) {
      const attackZone = state.play.ui && state.play.ui.attackStick ? state.play.ui.attackStick.zone : null;
      if (attackZone && pointInRect(pointer.startX, pointer.startY, attackZone) && !(state.play.attackState && state.play.attackState.aiming)) {
        const attackStick = state.play.ui.attackStick;
        const dx = pointer.x - attackStick.baseX;
        const dy = pointer.y - attackStick.baseY;
        state.mouseTap = {
          kind: 'attack',
          angle: Math.hypot(dx, dy) > 8 ? Math.atan2(dy, dx) : getFacingAngle(state.play.player.facing)
        };
      }
    }
    if (pointer && !pointer.moved && !pointer.consumed) {
      if (state.screen === SCREEN.CREDITS) {
        returnFromMenu();
      } else if (state.dialogue && !state.overlay) {
        advanceDialogue();
      }
    }
    delete state.pointers[event.pointerId];
  }

  function toBasePoint(event) {
    const rect = canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    return {
      x: (localX - layout.offsetX) / layout.scale,
      y: (localY - layout.offsetY) / layout.scale
    };
  }

  function loop(timestamp) {
    try {
      const delta = Math.min(0.033, (timestamp - (state.lastTime || timestamp)) / 1000);
      state.lastTime = timestamp;
      state.time += delta;
      frameTime += delta;
      if (frameTime >= 0.16) {
        frameTime = 0;
        state.frameIndex = (state.frameIndex + 1) % 4;
      }
      update(delta);
      render();
      state.keyboardInteract = false;
      state.keyboardAttack = false;
      state.keyboardDash = false;
      state.mouseTap = null;
      requestAnimationFrame(loop);
    } catch (error) {
      lastFatalMessage = error && (error.message || String(error)) ? String(error.message || error) : '循环错误';
      console.error(error);
    }
  }

  function update(delta) {
    if (state.achievementBanner) {
      state.achievementBanner.timer -= delta;
      if (state.achievementBanner.timer <= 0) {
        state.achievementBanner = null;
      }
    }
    if (state.dialogue) {
      updateDialogue(delta);
      return;
    }
    if (state.overlay) {
      return;
    }

    if (state.screen === SCREEN.PLAYING && state.play) {
      updatePlaying(delta);
    } else if (state.screen === SCREEN.EASTER && state.easter) {
      updateEaster(delta);
    }
  }

  function updateDialogue(delta) {
    const current = state.dialogue.queue[state.dialogue.index];
    if (!current) {
      finishDialogue();
      return;
    }
    if (state.dialogue.visibleChars < current.text.length) {
      state.dialogue.timer += delta;
      while (state.dialogue.timer >= DIALOGUE_CHAR_TIME && state.dialogue.visibleChars < current.text.length) {
        state.dialogue.timer -= DIALOGUE_CHAR_TIME;
        state.dialogue.visibleChars += 1;
      }
    }
  }

  function advanceDialogue() {
    if (!state.dialogue) {
      return;
    }
    const current = state.dialogue.queue[state.dialogue.index];
    if (state.dialogue.visibleChars < current.text.length) {
      state.dialogue.visibleChars = current.text.length;
      return;
    }
    state.dialogue.index += 1;
    state.dialogue.timer = 0;
    state.dialogue.visibleChars = 0;
    if (state.dialogue.index >= state.dialogue.queue.length) {
      finishDialogue();
    }
  }

  function finishDialogue() {
    if (!state.dialogue) {
      return;
    }
    const callback = state.dialogue.onFinish;
    state.dialogue = null;
    if (callback) {
      callback();
    }
  }

  function startDialogue(queue, onFinish) {
    state.dialogue = {
      queue: queue.slice(),
      index: 0,
      visibleChars: 0,
      timer: 0,
      onFinish: onFinish || null
    };
  }

  function updatePlaying(delta) {
    const play = state.play;
    if (play.special && play.special.duckrope) {
      updateDuckStage(play, delta);
      updateCamera(play);
      updateAmbientParticles(play, delta);
      updateEffects(play, delta);
      updateFeedbackState(play, delta);
      updatePlayerSwings(play, delta);
      return;
    }
    const input = readMoveInput();
    const activeInteract = state.keyboardInteract;
    const attackInput = readAttackPad(play);
    const transitionLocked = play.hybrid.active && play.hybrid.phase === 'transition';

    play.player.invuln = Math.max(0, play.player.invuln - delta);
    play.player.attackCooldown = Math.max(0, play.player.attackCooldown - delta);
    play.player.dashCooldown = Math.max(0, play.player.dashCooldown - delta);
    play.promptTimer = Math.max(0, play.promptTimer - delta);
    play.comboTimer = Math.max(0, play.comboTimer - delta);
    if (play.comboTimer <= 0) {
      play.comboCount = 0;
    }
    updateDecoys(play, delta);

    updateAttackAim(play, attackInput, delta);
    const aimLocked = play.attackState && play.attackState.aiming && !isMeleeWeapon(play);
    const moveSpeed = MOVE_SPEED * (play.inventory.moveMultiplier || 1);

    if (!transitionLocked && !aimLocked && (input.dx !== 0 || input.dy !== 0)) {
      movePlayer(play, input.dx * moveSpeed * delta, input.dy * moveSpeed * delta);
      play.player.walking = true;
      if (Math.abs(input.dx) > Math.abs(input.dy)) {
        play.player.facing = input.dx > 0 ? 'right' : 'left';
      } else {
        play.player.facing = input.dy > 0 ? 'down' : 'up';
      }
    } else {
      play.player.walking = false;
    }

    updateCamera(play);
    updateDiscovery(play);
    updateAmbientParticles(play, delta);
    updateEffects(play, delta);
    updateFeedbackState(play, delta);
    updatePlayerSwings(play, delta);
    updateSpecialSystems(play, delta);
    updateAllies(play, delta);
    updateRandomEvent(play, delta);
    if (play.hybrid.active) {
      updateHybridLoop(play, delta);
    } else {
      updateBattleRoute(play, delta);
      updatePuzzleRoute(play, delta);
    }

    if (!transitionLocked && activeInteract) {
      triggerInteract();
    }
    if (!transitionLocked && state.keyboardDash) {
      triggerDash();
    }
    if (!transitionLocked && state.keyboardAttack && isCombatModeEnabled(play) && play.player.attackCooldown <= 0) {
      play.player.attackCooldown = getWeaponCooldown(play);
      performPlayerAttack(play, getFacingAngle(play.player.facing));
    }
    if (!transitionLocked && state.mouseTap && state.mouseTap.kind === 'attack' && isCombatModeEnabled(play) && play.player.attackCooldown <= 0) {
      play.player.attackCooldown = getWeaponCooldown(play);
      performPlayerAttack(play, state.mouseTap.angle);
      spawnBurstEffect(play, play.player.x + 6, play.player.y + 7, '#ffe58b', 4, 14);
      state.mouseTap = null;
    }
    if (play.ui.pausePressed) {
      play.ui.pausePressed = false;
    }
  }

  function updateDuckStage(play, delta) {
    const duck = play.special.duckrope;
    play.player.invuln = 9;
    play.player.attackCooldown = Math.max(0, play.player.attackCooldown - delta);
    play.promptTimer = Math.max(0, play.promptTimer - delta);
    const input = readMoveInput();
    const moveSpeed = MOVE_SPEED * 0.45;
    if (input.dx !== 0 || input.dy !== 0) {
      movePlayer(play, input.dx * moveSpeed * delta, input.dy * moveSpeed * delta);
      play.player.walking = true;
    } else {
      play.player.walking = false;
    }
    duck.intro = Math.max(0, duck.intro - delta);
    duck.npcA.x = Math.min(play.player.x + 36, duck.npcA.x + delta * 22);
    duck.npcA.arrived = duck.npcA.x >= play.player.x + 35;
    if (duck.progress >= 70 || duck.success) {
      duck.npcB.active = true;
    }
    if (duck.npcB.active) {
      duck.npcB.x = Math.min(play.player.x + 58, duck.npcB.x + delta * 24);
      duck.npcB.arrived = duck.npcB.x >= play.player.x + 57;
    }
    const tugPress = (state.keyboardAttack || (state.mouseTap && state.mouseTap.kind === 'attack')) ? 1 : 0;
    if (tugPress) {
      duck.progress = Math.min(duck.target, duck.progress + 2.4);
      spawnBurstEffect(play, play.player.x + 12, play.player.y + 4, '#d7f7ff', 3, 10);
      state.mouseTap = null;
    }
    duck.progress = Math.max(0, duck.progress - delta * 4.6);
    if (Math.random() < 0.18) {
      duck.progress = Math.max(0, duck.progress - 0.28);
    }
    if (!duck.success && duck.progress >= duck.target) {
      duck.success = true;
      duck.endingTimer = 3.8;
      pushPrompt(play, 'A：拔个鸭咯！');
      spawnTextEffect(play, play.player.x + 44, play.player.y - 24, '恭喜您通过本游戏所有关卡', '#fff7d8', 20, -6, 2.8);
    }
    if (duck.success) {
      duck.endingTimer = Math.max(0, duck.endingTimer - delta);
      if (duck.endingTimer <= 0) {
        clearCurrentLevel('恭喜您通过本游戏所有关卡。小告示：祝您生活愉快，日日有风，夜夜好梦。');
      }
    }
  }

  function updateSpecialSystems(play, delta) {
    if (!play.special) {
      return;
    }
    play.special.bombGearTimer = Math.max(0, play.special.bombGearTimer - delta);
    play.special.emberGearTimer = Math.max(0, play.special.emberGearTimer - delta);
    play.special.bombCooldown = Math.max(0, play.special.bombCooldown - delta);
    play.special.emberPulseCooldown = Math.max(0, play.special.emberPulseCooldown - delta);
    play.special.fires.forEach((fire) => {
      fire.ttl -= delta;
      fire.phase += delta * 6;
    });
    play.special.fires = play.special.fires.filter((fire) => fire.ttl > 0);
    if (play.special.bombGearTimer > 0 && play.special.bombCooldown <= 0) {
      const targetInfo = getNearestEnemyTarget(play, play.player.x + 6, play.player.y + 7);
      if (targetInfo && targetInfo.target) {
        const angle = Math.atan2((targetInfo.target.y + 6) - (play.player.y + 7), (targetInfo.target.x + 6) - (play.player.x + 6));
        play.special.bombCooldown = 0.75;
        play.playerBullets.push({
          kind: 'bomb',
          x: play.player.x + 6,
          y: play.player.y + 7,
          vx: Math.cos(angle) * 52,
          vy: Math.sin(angle) * 52,
          ttl: 2.2,
          damage: 14 + getCampaignMutationTier(play) * 3,
          radius: 28,
          homing: true,
          ignoreWalls: play.special.bombIgnoreWalls,
          targetType: targetInfo.type
        });
      }
    }
    if (play.special.emberGearTimer > 0 && play.special.emberPulseCooldown <= 0) {
      play.special.emberPulseCooldown = 0.45;
      collectActiveEnemies(play).forEach((entry) => {
        const actor = entry.target;
        const dist = distance(play.player.x + 6, play.player.y + 7, actor.x + (actor.w || 12) * 0.5, actor.y + (actor.h || 12) * 0.5);
        if (dist <= 52 && !(actor.executeTimer > 0)) {
          const damage = Math.max(4, Math.round(actor.hp * 0.35));
          const tx = actor.x + (actor.w || 12) * 0.5;
          const ty = actor.y + (actor.h || 12) * 0.5;
          finishDirectEnemyStrike(play, actor, entry.type, damage, true, tx, ty, entry.type === 'roamer' ? (actor.reward || 3) : (actor.reward || 0), '焚击', '#ffd28a', 1.08);
          applyEnemyKnockback(play, actor, play.player.x + 6, play.player.y + 7, 18);
          igniteEnemy(play, actor, tx, ty, 2.4);
        }
      });
    }
    updateEnemyStatusEffects(play, delta);
  }

  function readMoveInput() {
    let dx = 0;
    let dy = 0;

    if (state.keys['arrowleft'] || state.keys['a']) dx -= 1;
    if (state.keys['arrowright'] || state.keys['d']) dx += 1;
    if (state.keys['arrowup'] || state.keys['w']) dy -= 1;
    if (state.keys['arrowdown'] || state.keys['s']) dy += 1;

    const pad = readPointerPad();
    dx += pad.dx;
    dy += pad.dy;

    if (dx !== 0 && dy !== 0) {
      const norm = 1 / Math.hypot(dx, dy);
      dx *= norm;
      dy *= norm;
    } else {
      dx = clamp(dx, -1, 1);
      dy = clamp(dy, -1, 1);
    }
    return { dx, dy };
  }

  function readPointerPad() {
    return readStickInput(state.play.ui.joystick);
  }

  function readAttackPad(play) {
    if (!play || !isCombatModeEnabled(play)) {
      return {
        dx: 0,
        dy: 0,
        thumbX: 0,
        thumbY: 0,
        active: false,
        angle: 0,
        strength: 0
      };
    }
    return readStickInput(play.ui.attackStick);
  }

  function readStickInput(joystick) {
    for (const pointer of Object.values(state.pointers)) {
      if (pointer.consumed) {
        continue;
      }
      const inZone = pointer.startX >= joystick.zone.x &&
        pointer.startX <= joystick.zone.x + joystick.zone.w &&
        pointer.startY >= joystick.zone.y &&
        pointer.startY <= joystick.zone.y + joystick.zone.h;
      if (!inZone) {
        continue;
      }
      const dx = pointer.x - joystick.baseX;
      const dy = pointer.y - joystick.baseY;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        return {
          dx: 0,
          dy: 0,
          thumbX: joystick.baseX,
          thumbY: joystick.baseY,
          active: true
        };
      }
      const clamped = Math.min(dist, joystick.maxRadius);
      const nx = dx / dist;
      const ny = dy / dist;
      return {
        dx: nx * (clamped / joystick.maxRadius),
        dy: ny * (clamped / joystick.maxRadius),
        thumbX: joystick.baseX + nx * clamped,
        thumbY: joystick.baseY + ny * clamped,
        active: true,
        angle: Math.atan2(ny, nx),
        strength: clamped / joystick.maxRadius
      };
    }
    return {
      dx: 0,
      dy: 0,
      thumbX: joystick.baseX,
      thumbY: joystick.baseY,
      active: false,
      angle: 0,
      strength: 0
    };
  }

  function updateAttackAim(play, attackInput, delta) {
    if (!isCombatModeEnabled(play)) {
      if (play.attackState) {
        play.attackState.aiming = false;
      }
      return;
    }
    const aim = play.attackState;
    if (attackInput.active) {
      if (!aim.aiming) {
        aim.aiming = true;
        aim.holdTime = 0;
        aim.angle = getFacingAngle(play.player.facing);
        aim.hasOffset = false;
        aim.firedDuringHold = false;
      }
      aim.holdTime += delta;
      if (attackInput.strength > 0.22) {
        aim.angle = attackInput.angle;
        aim.hasOffset = true;
        play.player.facing = angleToFacing(aim.angle);
      }
      if (!isMeleeWeapon(play) && !aim.firedDuringHold && play.player.attackCooldown <= 0 && attackInput.strength > 0.12 && aim.holdTime >= 0.02) {
        play.player.attackCooldown = getWeaponCooldown(play);
        performPlayerAttack(play, aim.hasOffset ? aim.angle : getFacingAngle(play.player.facing));
        spawnBurstEffect(play, play.player.x + 6, play.player.y + 7, '#ffe58b', 6, 16);
        aim.firedDuringHold = true;
      }
      return;
    }
    if (!aim.aiming) {
      return;
    }
    if (!aim.firedDuringHold && play.player.attackCooldown <= 0) {
      play.player.attackCooldown = getWeaponCooldown(play);
      const angle = aim.hasOffset ? aim.angle : getFacingAngle(play.player.facing);
      performPlayerAttack(play, angle);
      spawnBurstEffect(play, play.player.x + 6, play.player.y + 7, '#ffe58b', 5, 16);
    }
    aim.aiming = false;
    aim.holdTime = 0;
    aim.hasOffset = false;
    aim.firedDuringHold = false;
  }

  function isCombatModeEnabled(play) {
    return Boolean(play);
  }

  function isMeleeWeapon(play) {
    return true;
  }

  function toggleMapView() {
    if (state.screen !== SCREEN.PLAYING || !state.play || state.dialogue || state.overlay || !state.play.hybrid.active) {
      return;
    }
    state.play.hybrid.mapExpanded = !state.play.hybrid.mapExpanded;
  }

  function pointerInCircle(x, y, radius) {
    return Object.values(state.pointers).some((pointer) => distance(pointer.x, pointer.y, x, y) <= radius);
  }

  function updateAmbientParticles(play, delta) {
    play.particleTimer -= delta;
    if (play.particleTimer <= 0) {
      play.particleTimer = play.theme === 'night' ? 0.24 : 0.38;
      play.particles.push({
        x: Math.random() * play.worldWidth,
        y: Math.random() * play.worldHeight,
        vx: (Math.random() - 0.5) * (play.theme === 'night' ? 8 : 10),
        vy: (Math.random() - 0.5) * (play.theme === 'night' ? 6 : 12),
        ttl: 2.5 + Math.random() * 2,
        color: play.theme === 'night' ? '#f9ef9c' : '#9be9ff'
      });
    }

    play.particles = play.particles.filter((particle) => particle.ttl > 0);
    play.particles.forEach((particle) => {
      particle.ttl -= delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      if (particle.x < 0) particle.x = play.worldWidth;
      if (particle.x > play.worldWidth) particle.x = 0;
      if (particle.y < 0) particle.y = play.worldHeight;
      if (particle.y > play.worldHeight) particle.y = 0;
    });
  }

  function updateEffects(play, delta) {
    play.effects = play.effects.filter((effect) => effect.ttl > 0);
    play.effects.forEach((effect) => {
      effect.ttl -= delta;
      effect.x += effect.vx * delta;
      effect.y += effect.vy * delta;
      if (effect.kind !== 'text') {
        effect.size = Math.max(1, effect.size + effect.grow * delta);
      }
      effect.alpha = Math.max(0, effect.ttl / effect.maxTtl);
    });
  }

  function updateFeedbackState(play, delta) {
    if (!play || !play.feedback) {
      return;
    }
    play.feedback.shakeTimer = Math.max(0, play.feedback.shakeTimer - delta);
    play.feedback.flashDamage = Math.max(0, play.feedback.flashDamage - delta);
    play.feedback.flashShield = Math.max(0, play.feedback.flashShield - delta);
    play.feedback.flashHit = Math.max(0, play.feedback.flashHit - delta);
    play.feedback.flashKill = Math.max(0, play.feedback.flashKill - delta);
    play.feedback.flashHeal = Math.max(0, play.feedback.flashHeal - delta);
    play.feedback.flashCrit = Math.max(0, play.feedback.flashCrit - delta);
    play.feedback.skySlash = Math.max(0, play.feedback.skySlash - delta);
    if (play.feedback.shakeTimer <= 0) {
      play.feedback.shakePower = 0;
    }
  }

  function triggerFeedbackEvent(play, kind) {
    if (!play || !play.feedback) {
      return;
    }
    if (kind === 'swing') {
      play.feedback.flashHit = Math.max(play.feedback.flashHit, 0.06);
      play.feedback.shakeTimer = Math.max(play.feedback.shakeTimer, 0.08);
      play.feedback.shakePower = Math.max(play.feedback.shakePower, isMeleeWeapon(play) ? 1.6 : 0.8);
      return;
    }
    if (kind === 'hit') {
      play.feedback.flashHit = Math.max(play.feedback.flashHit, 0.1);
      play.feedback.shakeTimer = Math.max(play.feedback.shakeTimer, 0.1);
      play.feedback.shakePower = Math.max(play.feedback.shakePower, 1.4);
      return;
    }
    if (kind === 'kill') {
      play.feedback.flashKill = Math.max(play.feedback.flashKill, 0.18);
      play.feedback.shakeTimer = Math.max(play.feedback.shakeTimer, 0.14);
      play.feedback.shakePower = Math.max(play.feedback.shakePower, 2.6);
      return;
    }
    if (kind === 'crit') {
      play.feedback.flashCrit = Math.max(play.feedback.flashCrit, 0.24);
      play.feedback.flashHit = Math.max(play.feedback.flashHit, 0.16);
      play.feedback.shakeTimer = Math.max(play.feedback.shakeTimer, 0.16);
      play.feedback.shakePower = Math.max(play.feedback.shakePower, 3.6);
      return;
    }
    if (kind === 'shield') {
      play.feedback.flashShield = Math.max(play.feedback.flashShield, 0.18);
      play.feedback.shakeTimer = Math.max(play.feedback.shakeTimer, 0.14);
      play.feedback.shakePower = Math.max(play.feedback.shakePower, 2.2);
      return;
    }
    if (kind === 'heal') {
      play.feedback.flashHeal = Math.max(play.feedback.flashHeal, 0.18);
      return;
    }
    if (kind === 'damage') {
      play.feedback.flashDamage = Math.max(play.feedback.flashDamage, 0.28);
      play.feedback.shakeTimer = Math.max(play.feedback.shakeTimer, 0.2);
      play.feedback.shakePower = Math.max(play.feedback.shakePower, 4.6);
    }
  }

  function getCameraShakeOffset(play) {
    if (!play || !play.feedback || play.feedback.shakeTimer <= 0 || play.feedback.shakePower <= 0) {
      return { x: 0, y: 0 };
    }
    const power = play.feedback.shakePower * Math.min(1, play.feedback.shakeTimer * 10);
    return {
      x: (Math.random() - 0.5) * power * 2,
      y: (Math.random() - 0.5) * power * 2
    };
  }

  function spawnBurstEffect(play, x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
      play.effects.push({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(angle) * (speed * (0.5 + Math.random() * 0.7)),
        vy: Math.sin(angle) * (speed * (0.5 + Math.random() * 0.7)),
        ttl: 0.45 + Math.random() * 0.25,
        maxTtl: 0.7,
        size: 2 + Math.random() * 2,
        grow: 2,
        color,
        alpha: 1
      });
    }
  }

  function spawnTrailEffect(play, x, y, color) {
    play.effects.push({
      kind: 'trail',
      x,
      y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      ttl: 0.24,
      maxTtl: 0.24,
      size: 8,
      grow: -18,
      color,
      alpha: 1
    });
  }

  function spawnRingEffect(play, x, y, radius, color, ttl, grow) {
    play.effects.push({
      kind: 'ring',
      x,
      y,
      vx: 0,
      vy: 0,
      ttl: ttl === undefined ? 0.38 : ttl,
      maxTtl: ttl === undefined ? 0.38 : ttl,
      size: radius === undefined ? 10 : radius,
      grow: grow === undefined ? 90 : grow,
      color: color || '#ffe58b',
      alpha: 1
    });
  }

  function spawnTextEffect(play, x, y, text, color, size, vy, ttl) {
    if (!play || !text) {
      return;
    }
    play.effects.push({
      kind: 'text',
      x,
      y,
      vx: 0,
      vy: vy === undefined ? -18 : vy,
      ttl: ttl === undefined ? 0.7 : ttl,
      maxTtl: ttl === undefined ? 0.7 : ttl,
      size: size || 12,
      grow: 0,
      color: color || '#ffffff',
      text,
      alpha: 1
    });
  }

  function spawnIconEffect(play, x, y, icon, ttl, size) {
    if (!play || !icon) {
      return;
    }
    play.effects.push({
      kind: 'icon',
      x,
      y,
      vx: 0,
      vy: -16,
      ttl: ttl || 0.7,
      maxTtl: ttl || 0.7,
      size: size || 14,
      grow: 0,
      icon,
      alpha: 1
    });
  }

  function spawnCritEffect(play, x, y, damage) {
    spawnIconEffect(play, x - 12, y - 8, 'crit', 0.8, 14);
    spawnTextEffect(play, x + 10, y - 4, `暴击 ${damage}`, '#ff616c', 13, -22, 0.82);
  }

  function getActiveFogRadius(play) {
    if (!play) {
      return 0;
    }
    const base = play.level.fogRadius || 0;
    if (!base) {
      return 0;
    }
    if (play.randomEvent && play.randomEvent.fogTimer > 0) {
      return Math.max(2, Math.floor(base * 0.5));
    }
    return base;
  }

  function getRandomEventPool(route) {
    return route === 'battle'
      ? ['merchant', 'chests', 'fog', 'freeze']
      : ['merchant', 'chests', 'sunshine', 'freeze'];
  }

  function findEventSpawnTiles(play, count, minDistance) {
    const tiles = [];
    const used = new Set();
    const playerX = play.player.x + 6;
    const playerY = play.player.y + 7;
    for (let tries = 0; tries < 140 && tiles.length < count; tries += 1) {
      const tx = 1 + Math.floor(Math.random() * Math.max(1, play.level.grid[0].length - 2));
      const ty = 1 + Math.floor(Math.random() * Math.max(1, play.level.grid.length - 2));
      const tile = getTile(play.level.grid, tx, ty);
      const key = `${tx},${ty}`;
      if (used.has(key) || [TILE.WALL, TILE.WATER, TILE.SHADOW, TILE.EXIT].includes(tile)) {
        continue;
      }
      const px = tx * TILE_SIZE;
      const py = ty * TILE_SIZE;
      if (distance(px + 8, py + 8, playerX, playerY) < minDistance) {
        continue;
      }
      used.add(key);
      tiles.push({ tx, ty, px, py });
    }
    return tiles;
  }

  function createMerchantOffer(play, excludedIds) {
    const allowCombatSupport = Number.isFinite(play && play.campaignStep) && play.campaignStep >= CAMPAIGN_ORDER.length - 2;
    const pool = allowCombatSupport
      ? ['coin', 'potion', 'shield', 'boots', 'exp', 'dagger', 'wand', 'axe', 'ally']
      : ['coin', 'coin', 'potion', 'potion', 'shield', 'shield', 'boots', 'exp', 'exp'];
    const blocked = new Set(excludedIds || []);
    const available = pool.filter((itemId) => !blocked.has(itemId) && getShopItem(itemId));
    const source = available.length ? available : pool;
    const item = getShopItem(source[Math.floor(Math.random() * source.length)]);
    if (!item) {
      return { itemId: 'potion', name: '回血药水', desc: '恢复 1 点生命', price: 5 };
    }
    return {
      itemId: item.id,
      name: item.name,
      desc: item.desc,
      price: Math.max(4, Math.floor(item.price * 0.5))
    };
  }

  function createMerchantStock(play, count) {
    const total = Math.max(1, count || 5);
    const used = new Set();
    const offers = [];
    const allowCombatSupport = Number.isFinite(play && play.campaignStep) && play.campaignStep >= CAMPAIGN_ORDER.length - 2;
    if (allowCombatSupport) {
      const weaponPool = getEnemyWeaponDropPool(play).filter((itemId, index, list) => list.indexOf(itemId) === index && getShopItem(itemId));
      const guaranteedWeapon = weaponPool[Math.floor(Math.random() * weaponPool.length)];
      const guaranteedItem = getShopItem(guaranteedWeapon);
      if (guaranteedItem) {
        used.add(guaranteedItem.id);
        offers.push({
          itemId: guaranteedItem.id,
          name: guaranteedItem.name,
          desc: guaranteedItem.desc,
          price: Math.max(5, Math.floor(guaranteedItem.price * 0.55)),
          sold: false
        });
      }
    }
    for (let i = offers.length; i < total; i += 1) {
      const offer = createMerchantOffer(play, used);
      used.add(offer.itemId);
      offers.push({ ...offer, sold: false });
    }
    return offers;
  }

  function getMerchantOffers(merchant) {
    if (!merchant) {
      return [];
    }
    if (Array.isArray(merchant.offers) && merchant.offers.length) {
      return merchant.offers;
    }
    if (merchant.offer) {
      return [merchant.offer];
    }
    return [];
  }

  function getMerchantWorldPoint(merchant) {
    if (merchant && Number.isFinite(merchant.px) && Number.isFinite(merchant.py)) {
      return { x: merchant.px + 6, y: merchant.py + 7 };
    }
    return {
      x: (merchant && Number.isFinite(merchant.x) ? merchant.x : 0) + 6,
      y: (merchant && Number.isFinite(merchant.y) ? merchant.y : 0) + 7
    };
  }

  function revealDiscoveryAround(play, centerX, centerY, radius) {
    const revealRadius = Math.max(1, radius || 2);
    for (let y = -revealRadius; y <= revealRadius; y += 1) {
      for (let x = -revealRadius; x <= revealRadius; x += 1) {
        const gx = centerX + x;
        const gy = centerY + y;
        if (play.discovered[gy] && play.discovered[gy][gx] !== undefined) {
          play.discovered[gy][gx] = true;
        }
      }
    }
  }

  function triggerRandomEvent(play) {
    const eventState = play.randomEvent;
    if (!eventState || eventState.triggered || !eventState.enabled) {
      return;
    }
    eventState.triggered = true;
    const type = getRandomEventPool(play.route)[Math.floor(Math.random() * getRandomEventPool(play.route).length)];
    eventState.current = type;
    if (type === 'merchant') {
      const point = findEventSpawnTiles(play, 1, 58)[0];
      if (!point) {
        eventState.current = null;
        return;
      }
      eventState.merchant = {
        x: point.px + 2,
        y: point.py + 1,
        ttl: 30,
        offer: createMerchantOffer(play)
      };
      pushPrompt(play, `随机事件：神秘商人来了，${eventState.merchant.offer.name} 限时 ${eventState.merchant.offer.price} 金币。`);
      return;
    }
    if (type === 'chests') {
      const rewards = play.route === 'battle'
        ? ['coins', 'potion', 'decoy']
        : ['coins', 'potion', 'boots'];
      eventState.chests = findEventSpawnTiles(play, 3, 42).map((point, index) => ({
        x: point.px + 1,
        y: point.py + 2,
        ttl: 30,
        reward: rewards[index % rewards.length]
      }));
      pushPrompt(play, '随机事件：宝箱雨落下了，30 秒内去抢补给。');
      return;
    }
    if (type === 'fog') {
      eventState.fogTimer = 10;
      pushPrompt(play, '随机事件：迷雾潮汐扩散了，视野暂时缩小。');
      return;
    }
    if (type === 'sunshine') {
      eventState.sunshineTimer = 5;
      pushPrompt(play, '随机事件：阳光普照，互动目标全部高亮。');
      return;
    }
    eventState.timeFreezeTimer = 5;
    pushPrompt(play, '随机事件：时间裂缝出现，敌人暂时静止。');
  }

  function applyEventChestReward(play, chest) {
    if (chest.reward === 'coins') {
      gainCoins(6, play, chest.x + 7, chest.y + 7, '宝箱金币');
      return;
    }
    if (chest.reward === 'potion') {
      addQuickSlot(play, 'potion', 1);
      pushPrompt(play, '宝箱开出了回血药水。');
      spawnBurstEffect(play, chest.x + 7, chest.y + 7, '#ff8f95', 8, 20);
      return;
    }
    if (chest.reward === 'decoy') {
      addQuickSlot(play, 'decoy', 1);
      pushPrompt(play, '宝箱开出了诱饵假人。');
      spawnBurstEffect(play, chest.x + 7, chest.y + 7, '#d9c4ff', 8, 20);
      return;
    }
    play.inventory.moveMultiplier = Math.max(play.inventory.moveMultiplier || 1, 1.5);
    const boots = getQuickSlot(play, 'boots');
    if (boots) {
      boots.count = 1;
    }
    pushPrompt(play, '宝箱开出了加速靴，本关移动速度提升。');
    spawnBurstEffect(play, chest.x + 7, chest.y + 7, '#8ae59d', 8, 20);
  }

  function updateRandomEvent(play, delta) {
    const eventState = play.randomEvent;
    if (!eventState) {
      return;
    }
    eventState.timeFreezeTimer = Math.max(0, eventState.timeFreezeTimer - delta);
    eventState.sunshineTimer = Math.max(0, eventState.sunshineTimer - delta);
    eventState.fogTimer = Math.max(0, eventState.fogTimer - delta);
    if (!eventState.triggered && eventState.triggerTimer > 0) {
      eventState.triggerTimer -= delta;
      if (eventState.triggerTimer <= 0) {
        triggerRandomEvent(play);
      }
    }
    if (eventState.merchant) {
      eventState.merchant.ttl -= delta;
      if (eventState.merchant.ttl <= 0) {
        if (state.overlay && state.overlay.type === 'merchant' && state.overlay.merchant === eventState.merchant) {
          state.overlay = null;
        }
        eventState.merchant = null;
        if (eventState.current === 'merchant') {
          eventState.current = null;
          pushPrompt(play, '神秘商人收摊离开了。');
        }
      }
    }
    if (eventState.chests.length) {
      eventState.chests.forEach((chest) => {
        chest.ttl -= delta;
        if (distance(chest.x + 7, chest.y + 7, play.player.x + 6, play.player.y + 7) < 14) {
          chest.ttl = 0;
          applyEventChestReward(play, chest);
        }
      });
      eventState.chests = eventState.chests.filter((chest) => chest.ttl > 0);
      if (!eventState.chests.length && eventState.current === 'chests') {
        eventState.current = null;
      }
    }
    if (eventState.current === 'fog' && eventState.fogTimer <= 0) {
      eventState.current = null;
    }
    if (eventState.current === 'sunshine' && eventState.sunshineTimer <= 0) {
      eventState.current = null;
    }
    if (eventState.current === 'freeze' && eventState.timeFreezeTimer <= 0) {
      eventState.current = null;
    }
  }

  function updateDiscovery(play) {
    const fogRadius = getActiveFogRadius(play);
    const revealRadius = play.hybrid.active ? Math.max(3, fogRadius || 0) : fogRadius;
    if (!revealRadius) {
      return;
    }
    const tx = Math.floor((play.player.x + play.player.w * 0.5) / TILE_SIZE);
    const ty = Math.floor((play.player.y + play.player.h * 0.5) / TILE_SIZE);
    for (let y = -revealRadius; y <= revealRadius; y += 1) {
      for (let x = -revealRadius; x <= revealRadius; x += 1) {
        const gx = tx + x;
        const gy = ty + y;
        if (play.discovered[gy] && play.discovered[gy][gx] !== undefined) {
          play.discovered[gy][gx] = true;
        }
      }
    }
  }

  function updateCamera(play) {
    const targetX = play.player.x + play.player.w * 0.5 - VIEW.w * 0.5;
    const targetY = play.player.y + play.player.h * 0.5 - VIEW.h * 0.5;
    play.camera.x = clamp(targetX, 0, Math.max(0, play.worldWidth - VIEW.w));
    play.camera.y = clamp(targetY, 0, Math.max(0, play.worldHeight - VIEW.h));
  }

  function updateHybridLoop(play, delta) {
    if (!play.hybrid.active) {
      return;
    }
    if (play.hybrid.phase === 'transition') {
      const progress = 1 - (play.hybrid.transitionTimer / Math.max(0.001, play.hybrid.transitionDuration || 1));
      if (!play.hybrid.transitionSwapped && progress >= 0.52) {
        play.hybrid.transitionSwapped = true;
        enterHybridBossArena(play, true);
      }
      play.hybrid.transitionTimer = Math.max(0, play.hybrid.transitionTimer - delta);
      if (play.hybrid.transitionTimer <= 0) {
        play.hybrid.phase = 'boss';
        pushPrompt(play, '大 Boss 区已载入，先活下来再找机会贴身打。');
      }
      return;
    }
    if (play.hybrid.phase === 'boss') {
      if (play.boss) {
        updateBoss(play, delta);
        updateBossMinions(play, delta);
      }
      if (play.extraBosses && play.extraBosses.length) {
        updateExtraBosses(play, delta);
      }
      updateBossWaveSpawner(play, delta);
      if (!play.boss && (!play.extraBosses || !play.extraBosses.length) && !(play.hybrid.bossWaveQueue && play.hybrid.bossWaveQueue.length)) {
        spawnHybridRewardChest(play);
      }
      return;
    }
    if (play.hybrid.phase === 'reward') {
      play.hybrid.rewardTimer = Math.max(0, play.hybrid.rewardTimer - delta);
      if (play.hybrid.rewardTimer <= 0) {
        clearCurrentLevel(`你清空了整片大地图，击破最终 Boss 并带着 ${play.inventory.backpack.length} 种战利品离开。`);
      }
      return;
    }
    updateHybridHazards(play, delta);
    updateHybridRoamers(play, delta);
    updateHybridMiniBosses(play, delta);
    if (play.hybrid.phase === 'field' && updateHybridRoamerWaves(play, delta)) {
      return;
    }
    if (play.hybrid.phase === 'field' && play.roamers.length <= 0 && play.minibosses.length <= 0) {
      play.hybrid.phase = 'portal';
      play.hybrid.dangerCleared = true;
      if (play.merchantSpot) {
        play.merchantSpot.active = true;
      }
      play.hybrid.exitOpen = true;
      play.hybrid.portalOpen = true;
      play.flags.exitOpen = true;
      if (play.portalSpot) {
        play.portalSpot.active = true;
      }
      pushPrompt(play, '场上小怪和小 Boss 已清空，裂隙传送门打开了。');
    }
  }

  function initializeHybridRoamerWaves(play) {
    if (!play || !play.hybrid || !play.hybrid.active) {
      return;
    }
    const allRoamers = (play.roamers || []).slice();
    if (!allRoamers.length) {
      play.hybrid.pendingRoamerWaves = [];
      play.hybrid.currentRoamerWave = 0;
      play.hybrid.totalRoamerWaves = 0;
      play.hybrid.nextRoamerWaveDelay = 0;
      return;
    }
    const waves = [];
    let index = 0;
    while (index < allRoamers.length) {
      const remaining = allRoamers.length - index;
      let batchSize = remaining <= 5 ? remaining : 3 + Math.floor(Math.random() * 3);
      if (remaining - batchSize > 0 && remaining - batchSize < 3) {
        batchSize = remaining - 3;
      }
      waves.push(allRoamers.slice(index, index + batchSize));
      index += batchSize;
    }
    play.roamers = waves.shift() || [];
    play.hybrid.pendingRoamerWaves = waves;
    play.hybrid.currentRoamerWave = play.roamers.length ? 1 : 0;
    play.hybrid.totalRoamerWaves = play.hybrid.currentRoamerWave + play.hybrid.pendingRoamerWaves.length;
    play.hybrid.nextRoamerWaveDelay = 0;
    play.hybrid.wavePrompted = false;
  }

  function spawnNextHybridRoamerWave(play) {
    if (!play || !play.hybrid || !play.hybrid.pendingRoamerWaves.length) {
      return false;
    }
    const nextWave = play.hybrid.pendingRoamerWaves.shift();
    play.hybrid.currentRoamerWave += 1;
    play.hybrid.nextRoamerWaveDelay = 0;
    play.hybrid.wavePrompted = false;
    nextWave.forEach((roamer) => {
      roamer.touchCooldown = Math.max(roamer.touchCooldown || 0, 0.45);
      roamer.hitFlash = 0;
      play.roamers.push(roamer);
      spawnBurstEffect(play, roamer.x + 6, roamer.y + 6, play.theme === 'night' ? '#9cf3ff' : '#ffd38d', 8, 18);
    });
    pushPrompt(play, `第 ${play.hybrid.currentRoamerWave} 拨野怪出现了，先清掉这批再往前推。`);
    return true;
  }

  function updateHybridRoamerWaves(play, delta) {
    if (!play || !play.hybrid || play.hybrid.phase !== 'field' || !play.hybrid.pendingRoamerWaves.length) {
      return false;
    }
    if (play.roamers.length > 0) {
      play.hybrid.nextRoamerWaveDelay = 0;
      play.hybrid.wavePrompted = false;
      return false;
    }
    if (!play.hybrid.wavePrompted) {
      play.hybrid.wavePrompted = true;
      play.hybrid.nextRoamerWaveDelay = 1.8;
      pushPrompt(play, '这一拨清完了，下一拨野怪正在靠近。');
    } else {
      play.hybrid.nextRoamerWaveDelay = Math.max(0, play.hybrid.nextRoamerWaveDelay - delta);
    }
    if (play.hybrid.nextRoamerWaveDelay <= 0) {
      spawnNextHybridRoamerWave(play);
    }
    return true;
  }

  function spawnHybridHazard(play) {
    if (!play.hazardSpots || !play.hazardSpots.length) {
      return;
    }
    const spot = play.hazardSpots[Math.floor(Math.random() * play.hazardSpots.length)];
    const colors = {
      gust: '#9fd8ff',
      mire: '#c9a36f',
      static: '#d7b4ff'
    };
    play.hybrid.hazards.push({
      kind: spot.kind || 'gust',
      x: spot.px,
      y: spot.py,
      radius: spot.radius || 18,
      warning: 0.9,
      ttl: 1.7,
      hit: false,
      color: colors[spot.kind || 'gust'] || '#9fd8ff'
    });
  }

  function updateHybridHazards(play, delta) {
    if (!play.hybrid.active) {
      return;
    }
    play.hybrid.hazardTimer -= delta;
    const nextDelay = play.hybrid.phase === 'danger' ? 2.6 : 4.1;
    if (play.hybrid.hazardTimer <= 0 && play.hybrid.phase !== 'escape') {
      play.hybrid.hazardTimer = nextDelay;
      spawnHybridHazard(play);
    }
    play.hybrid.hazards.forEach((hazard) => {
      if (hazard.warning > 0) {
        hazard.warning -= delta;
      } else {
        hazard.ttl -= delta;
        if (!hazard.hit && distance(play.player.x + 6, play.player.y + 7, hazard.x, hazard.y) <= hazard.radius) {
          hazard.hit = true;
          const label = hazard.kind === 'mire' ? '陷泥区拖住了你' : (hazard.kind === 'static' ? '静电团劈到了你' : '狂风带撞到了你');
          applyPlayerDamage(play, 0.5, `${label}，还剩 ${Math.max(0, play.player.hp - 0.5)} 点生命。`, hazard.color);
        }
        (play.allies || []).slice().forEach((ally) => {
          if (distance(ally.x + 6, ally.y + 7, hazard.x, hazard.y) <= hazard.radius) {
            applyCompanionDamage(play, ally, 0.5, hazard.x, hazard.y);
          }
        });
      }
    });
    play.hybrid.hazards = play.hybrid.hazards.filter((hazard) => hazard.warning > 0 || hazard.ttl > 0);
  }

  function updateHybridRoamers(play, delta) {
    if (!play.hybrid.active || !play.roamers.length) {
      return;
    }
    const frozen = play.randomEvent && play.randomEvent.timeFreezeTimer > 0;
    play.roamers.forEach((roamer) => {
      roamer.touchCooldown = Math.max(0, roamer.touchCooldown - delta);
      roamer.hitFlash = Math.max(0, roamer.hitFlash - delta * 5.2);
      if (updateExecuteTimer(play, roamer, 'roamer', delta, roamer.x + 6, roamer.y + 6)) {
        return;
      }
      if (!frozen) {
        const chase = getEnemyAimTarget(play, { x: roamer.x + 6, y: roamer.y + 6 });
        const dx = chase.x - (roamer.x + 6);
        const dy = chase.y - (roamer.y + 6);
        const dist = Math.max(1, Math.hypot(dx, dy));
        moveRoamer(play, roamer, (dx / dist) * roamer.speed * delta, (dy / dist) * roamer.speed * delta, delta);
        if (roamer.touchCooldown <= 0 && chase.type === 'player' && rectsOverlap(play.player, roamer)) {
          roamer.touchCooldown = 0.8;
          applyPlayerDamage(play, 0.5, `游荡怪砍到了你，还剩 ${Math.max(0, play.player.hp - 0.5)} 点生命。`, '#c59dff');
        }
        (play.allies || []).slice().forEach((ally) => {
          if (roamer.touchCooldown <= 0 && rectsOverlap(ally, roamer)) {
            roamer.touchCooldown = 0.8;
            applyCompanionDamage(play, ally, 0.5, roamer.x + 6, roamer.y + 6);
          }
        });
      }
    });
    const alive = play.roamers.filter((roamer) => roamer.hp > 0);
    play.hybrid.defeatedRoamers += play.roamers.length - alive.length;
    play.roamers = alive;
  }

  function updateHybridMiniBosses(play, delta) {
    if (!play.hybrid.active || !play.minibosses.length) {
      return;
    }
    play.minibosses.forEach((boss) => {
      boss.touchCooldown = Math.max(0, boss.touchCooldown - delta);
      boss.hitFlash = Math.max(0, boss.hitFlash - delta * 4.6);
      if (updateExecuteTimer(play, boss, 'miniboss', delta, boss.x + 7, boss.y + 7)) {
        return;
      }
      const chase = getEnemyAimTarget(play, { x: boss.x + 7, y: boss.y + 7 });
      const dx = chase.x - (boss.x + 7);
      const dy = chase.y - (boss.y + 7);
      const dist = Math.max(1, Math.hypot(dx, dy));
      moveRoamer(play, boss, (dx / dist) * (boss.speed || 42) * delta, (dy / dist) * (boss.speed || 42) * delta, delta);
      if (boss.touchCooldown <= 0 && chase.type === 'player' && rectsOverlap(play.player, boss)) {
        boss.touchCooldown = 1;
        const damage = 1;
        applyPlayerDamage(play, damage, `小 Boss ${boss.title || '头目'} 把你撞退了，还剩 ${Math.max(0, play.player.hp - damage)} 点生命。`, '#ffb27d');
      } else if (boss.touchCooldown <= 0 && chase.type === 'ally' && rectsOverlap(chase.actor, boss)) {
        boss.touchCooldown = 1;
        applyCompanionDamage(play, chase.actor, 1, boss.x + 7, boss.y + 7);
      }
    });
    const alive = play.minibosses.filter((boss) => boss.hp > 0);
    play.hybrid.defeatedMinibosses += play.minibosses.length - alive.length;
    play.minibosses = alive;
  }

  function moveRoamer(play, roamer, dx, dy, delta) {
    const startX = roamer.x;
    const startY = roamer.y;

    if ((roamer.stuckTimer || 0) > 0.2) {
      const angle = (roamer.stuckTimer * 1.5) * (roamer.nudgeDir || 1);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      dx = rx;
      dy = ry;
    }

    moveRoamerAxis(play, roamer, 'x', dx);
    moveRoamerAxis(play, roamer, 'y', dy);
    
    const moved = Math.hypot(roamer.x - startX, roamer.y - startY);
    const wanted = Math.max(0.01, Math.hypot(dx, dy));

    if (moved < wanted * 0.6) {
      roamer.stuckTimer = Math.min(1.2, (roamer.stuckTimer || 0) + delta * 2);
      const nudgeBase = roamer.speed || 12;
      const nudge = nudgeBase * (0.5 + roamer.stuckTimer) * delta;
      const nudgeDir = roamer.nudgeDir || 1;
      if (Math.abs(dx) >= Math.abs(dy)) {
        moveRoamerAxis(play, roamer, 'y', nudge * nudgeDir);
      } else {
        moveRoamerAxis(play, roamer, 'x', nudge * nudgeDir);
      }
      
      if (Math.hypot(roamer.x - startX, roamer.y - startY) < 0.05) {
        if (Math.random() < delta * 5) roamer.nudgeDir = -nudgeDir;
      }
    } else {
      roamer.stuckTimer = Math.max(0, (roamer.stuckTimer || 0) - delta * 4);
    }
  }

  function moveRoamerAxis(play, roamer, axis, amount) {
    roamer[axis] += amount;
    if (detectTileCollision(play, roamer)) {
      roamer[axis] -= amount;
    }
  }

  function getNearestEnemyTarget(play, x, y) {
    const targets = []
      .concat((play.roamers || []).map((target) => ({ target, type: 'roamer' })))
      .concat((play.minibosses || []).map((target) => ({ target, type: 'miniboss' })))
      .concat((play.bossMinions || []).map((target) => ({ target, type: 'bossMinion' })));
    if (play.boss) {
      targets.push({ target: play.boss, type: 'boss' });
    }
    (play.extraBosses || []).forEach((boss) => {
      if (boss && !boss.dying) {
        targets.push({ target: boss, type: 'boss' });
      }
    });
    let best = null;
    let bestDist = Infinity;
    targets.forEach((entry) => {
      const tx = entry.target.x + ((entry.target.w || 14) * 0.5);
      const ty = entry.target.y + ((entry.target.h || 14) * 0.5);
      const dist = distance(x, y, tx, ty);
      if (dist < bestDist) {
        bestDist = dist;
        best = entry;
      }
    });
    return best;
  }

  function collectActiveEnemies(play) {
    const list = []
      .concat((play.roamers || []).map((target) => ({ target, type: 'roamer' })))
      .concat((play.minibosses || []).map((target) => ({ target, type: 'miniboss' })))
      .concat((play.bossMinions || []).map((target) => ({ target, type: 'bossMinion' })));
    if (play.boss && !play.boss.dying) {
      list.push({ target: play.boss, type: 'boss' });
    }
    (play.extraBosses || []).forEach((boss) => {
      if (boss && !boss.dying) {
        list.push({ target: boss, type: 'boss' });
      }
    });
    return list.filter((entry) => entry.target && entry.target.hp > 0);
  }

  function igniteEnemy(play, target, x, y, duration) {
    if (!target) {
      return;
    }
    target.burnTimer = Math.max(target.burnTimer || 0, duration || 2);
    target.burnTick = Math.max(target.burnTick || 0, 0.24);
    if (play && play.special) {
      play.special.fires.push({
        x,
        y,
        ttl: duration || 2,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function updateEnemyStatusEffects(play, delta) {
    collectActiveEnemies(play).forEach((entry) => {
      const actor = entry.target;
      if (actor.burnTimer > 0) {
        actor.burnTimer = Math.max(0, actor.burnTimer - delta);
        actor.burnTick = Math.max(0, (actor.burnTick || 0) - delta);
        if (actor.burnTick <= 0) {
          actor.burnTick = 0.34;
          const burnDamage = entry.type === 'boss' ? 2 : 1.2;
          actor.hp = Math.max(0, actor.hp - burnDamage);
          setHitFlash(actor, 0.4);
          spawnBurstEffect(play, actor.x + (actor.w || 12) * 0.5, actor.y + (actor.h || 12) * 0.5, '#ffd58a', 4, 12);
        }
      }
    });
  }

  function applyCompanionDamage(play, ally, amount, sourceX, sourceY) {
    if (!ally || ally.hp <= 0) {
      return;
    }
    ally.hp = Math.max(0, ally.hp - amount);
    ally.hitFlash = 1;
    applyEnemyKnockback(play, ally, sourceX, sourceY, 10);
    if (ally.hp <= 0) {
      handleCompanionDeath(play, ally);
    }
  }

  function updateAllies(play, delta) {
    if (!play || !play.allies || !play.allies.length) {
      return;
    }
    play.allies.slice().forEach((ally, index) => {
      const profile = getAllyWeaponProfile(ally.weapon);
      ally.attackCooldown = Math.max(0, (ally.attackCooldown || 0) - delta);
      ally.touchCooldown = Math.max(0, (ally.touchCooldown || 0) - delta);
      ally.hitFlash = Math.max(0, (ally.hitFlash || 0) - delta * 5);
      const orbitAngle = state.time * 1.6 + index * 2.2;
      const followX = play.player.x + Math.cos(orbitAngle) * (22 + index * 6);
      const followY = play.player.y + 8 + Math.sin(orbitAngle) * (14 + index * 3);
      const targetInfo = getNearestEnemyTarget(play, ally.x + 6, ally.y + 7);
      let moveTargetX = followX;
      let moveTargetY = followY;
      const danger = (play.hybrid && play.hybrid.hazards || []).find((hazard) => distance(ally.x + 6, ally.y + 7, hazard.x, hazard.y) < hazard.radius + 14);
      if (danger) {
        const fleeDx = (ally.x + 6) - danger.x;
        const fleeDy = (ally.y + 7) - danger.y;
        const fleeDist = Math.max(1, Math.hypot(fleeDx, fleeDy));
        moveTargetX = ally.x + (fleeDx / fleeDist) * 34;
        moveTargetY = ally.y + (fleeDy / fleeDist) * 34;
      }
      if (targetInfo) {
        const tx = targetInfo.target.x + ((targetInfo.target.w || 14) * 0.5);
        const ty = targetInfo.target.y + ((targetInfo.target.h || 14) * 0.5);
        const dist = distance(ally.x + 6, ally.y + 7, tx, ty);
        ally.aimX = tx;
        ally.aimY = ty;
        if (!danger && dist < profile.range) {
          if (dist > profile.keepDistance + 8) {
            moveTargetX = tx - 6;
            moveTargetY = ty - 7;
          } else if (dist < Math.max(8, profile.keepDistance - 6)) {
            const backDx = (ally.x + 6) - tx;
            const backDy = (ally.y + 7) - ty;
            const backDist = Math.max(1, Math.hypot(backDx, backDy));
            moveTargetX = ally.x + (backDx / backDist) * 18;
            moveTargetY = ally.y + (backDy / backDist) * 18;
          }
        }
        const stats = getWeaponStats({ inventory: { weapon: ally.weapon } });
        if (dist <= stats.reach + 10 && ally.attackCooldown <= 0) {
          ally.attackCooldown = Math.max(0.24, stats.cooldown * 0.9);
          targetInfo.target.hp -= Math.max(6, Math.round(stats.damage * profile.strikeScale));
          setHitFlash(targetInfo.target, 1);
          spawnBurstEffect(play, tx, ty, profile.color, 5, 14);
          if (targetInfo.type !== 'boss') {
            applyEnemyKnockback(play, targetInfo.target, ally.x + 6, ally.y + 7, profile.knockback);
          }
          if (targetInfo.target.hp <= 0) {
            gainExp(play, targetInfo.type === 'boss' ? 5 : (targetInfo.type === 'miniboss' ? 3 : 1), tx, ty, '协战击倒');
            if (targetInfo.type === 'roamer' || targetInfo.type === 'miniboss') {
              trySpawnEnemyDrop(play, targetInfo.target, targetInfo.type === 'roamer' ? 'roamer' : 'miniboss');
            }
          }
        }
      }
      const dx = moveTargetX - ally.x;
      const dy = moveTargetY - ally.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const speed = profile.speed;
      moveRoamerAxis(play, ally, 'x', (dx / dist) * Math.min(speed * delta, Math.abs(dx)));
      moveRoamerAxis(play, ally, 'y', (dy / dist) * Math.min(speed * delta, Math.abs(dy)));
      ally.walking = Math.abs(dx) > 2 || Math.abs(dy) > 2;
      ally.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    });
  }

  function sacrificeCompanionGrave(play, grave) {
    if (!play || !grave) {
      return;
    }
    play.allyGraves = play.allyGraves.filter((entry) => entry !== grave);
    const roll = Math.random();
    if (roll < 0.28) {
      pushPrompt(play, '献祭落空了，墓碑只散出一圈冷风。');
      return;
    }
    if (roll < 0.56) {
      gainCoins(8, play, grave.x + 6, grave.y + 7, '献祭回礼');
      return;
    }
    if (roll < 0.8) {
      gainExp(play, 6, grave.x + 6, grave.y + 7, '墓碑回响');
      return;
    }
    spawnAiCompanion(play, grave.x, grave.y - 8);
  }

  function applyEnemyKnockback(play, target, fromX, fromY, power) {
    if (!play || !target) {
      return;
    }
    const tx = target.x + (target.w || 12) * 0.5;
    const ty = target.y + (target.h || 12) * 0.5;
    const dx = tx - fromX;
    const dy = ty - fromY;
    const dist = Math.max(1, Math.hypot(dx, dy));
    moveRoamerAxis(play, target, 'x', (dx / dist) * power);
    moveRoamerAxis(play, target, 'y', (dy / dist) * power);
  }

  function applyPlayerKnockback(play, fromX, fromY, power) {
    if (!play || !play.player) {
      return;
    }
    const dx = (play.player.x + 6) - fromX;
    const dy = (play.player.y + 7) - fromY;
    const dist = Math.max(1, Math.hypot(dx, dy));
    moveAxis(play, 'x', (dx / dist) * power);
    moveAxis(play, 'y', (dy / dist) * power);
  }

  function spawnAmbushRoamers(play, count, aroundX, aroundY) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / Math.max(1, count);
      play.roamers.push({
        id: `ambush-${Date.now()}-${i}`,
        x: aroundX + Math.cos(angle) * 22,
        y: aroundY + Math.sin(angle) * 22,
        w: 12,
        h: 12,
        hp: 14,
        maxHp: 14,
        speed: 52,
        touchCooldown: 0,
        hitFlash: 0,
        spriteKey: pickHybridRoamerSprite(play.theme, play.roamers.length + i)
      });
    }
    play.hybrid.phase = 'field';
    play.hybrid.exitOpen = false;
    play.hybrid.portalOpen = false;
    play.flags.exitOpen = false;
  }

  function beginHybridTransition(play) {
    play.hybrid.phase = 'transition';
    play.hybrid.transitionDuration = 1.55;
    play.hybrid.transitionTimer = play.hybrid.transitionDuration;
    play.hybrid.transitionSwapped = false;
    play.hybrid.transitionStyle = 'portal';
    play.hybrid.transitionOrigin = {
      x: play.player.x + 6,
      y: play.player.y + 7,
      portalX: play.portalSpot ? play.portalSpot.px + 8 : play.player.x + 6,
      portalY: play.portalSpot ? play.portalSpot.py + 8 : play.player.y + 7
    };
    const bossEntry = play.level.hybrid && play.level.hybrid.bossEntry;
    play.hybrid.transitionTarget = bossEntry ? {
      x: bossEntry.x * TILE_SIZE + 8,
      y: bossEntry.y * TILE_SIZE + 8
    } : {
      x: play.player.x + 6,
      y: play.player.y + 7
    };
    play.hybrid.portalOpen = false;
    if (play.portalSpot) {
      play.portalSpot.active = false;
    }
    play.enemyBullets = [];
    play.bossWarnings = [];
    pushPrompt(play, '你踏进了裂隙传送门，正在切入大 Boss 区。');
  }

  function enterHybridBossArena(play, keepTransition) {
    const bossEntry = play.level.hybrid && play.level.hybrid.bossEntry;
    const bossMeta = play.level.hybrid && play.level.hybrid.boss;
    if (bossEntry) {
      play.player.x = bossEntry.x * TILE_SIZE + 2;
      play.player.y = bossEntry.y * TILE_SIZE + 1;
    }
    play.hybrid.phase = keepTransition ? 'transition' : 'boss';
    play.hybrid.inBossZone = true;
    play.hybrid.mapExpanded = false;
    if (bossMeta) {
      const baseHp = getBossHpForTheme(bossMeta.hp, play.theme);
      const boostedHp = Math.round(baseHp * getCampaignBossPower(play));
      play.boss = {
        x: bossMeta.x * TILE_SIZE,
        y: bossMeta.y * TILE_SIZE,
        w: 32,
        h: 32,
        hp: boostedHp,
        maxHp: boostedHp,
        title: getCampaignBossTitle(play) || bossMeta.title || '大 Boss',
        spriteFrames: getCampaignBossFrames(play),
        touchCooldown: 0,
        deathTimer: 1.25,
        dying: false,
        spawnTimer: 1.2,
        hitFlash: 0,
        warningTimer: 2.2,
        summonTimer: 4.2,
        darkPulseTimer: 5.4
      };
      if (isCampaignStage(play, 9)) {
        play.boss.damageReduction = 0.35;
        play.boss.critShieldBreak = 0;
        spawnBossMinions(play, 2);
      }
      play.extraBosses = [];
      play.hybrid.bossWaveQueue = getCampaignBossWavePlan(play);
      play.hybrid.bossWaveTimer = play.hybrid.bossWaveQueue.length ? play.hybrid.bossWaveQueue[0].delay : 0;
      play.hybrid.bossWaveIndex = 0;
      play.hybrid.bossWaveTotal = play.hybrid.bossWaveQueue.length;
    }
    updateCamera(play);
    if (!keepTransition) {
      pushPrompt(play, '大 Boss 区已载入，先活下来再找机会贴身打。');
    }
  }

  function spawnHybridRewardChest(play) {
    play.hybrid.phase = 'reward';
    play.enemyBullets = [];
    play.bossWarnings = [];
    play.bossMinions = [];
    play.extraBosses = [];
    play.hybrid.rewardTimer = 15;
    play.hybrid.rewardPortalReady = true;
    play.hybrid.rewardPortalArmed = false;
    if (play.portalSpot) {
      play.portalSpot.active = true;
    }
    if (play.rewardChest) {
      play.rewardChest.active = true;
      play.rewardChest.opened = false;
      play.rewardChest.tier = getRewardChestTier(play);
    }
    pushPrompt(play, '大 Boss 倒下了，裂隙稳定了 15 秒，先拾取战利品再离场。');
  }

  function openHybridRewardChest(play) {
    if (!play.rewardChest || play.rewardChest.opened) {
      return;
    }
    const drops = createRandomChestLoot(play, 5);
    play.rewardChest.opened = true;
    play.rewardChest.active = false;
    play.hybrid.chestOpened = true;
    play.hybrid.rewardPortalArmed = true;
    play.hybrid.totalLoot = drops.length;
    play.lootDrops = drops.map((itemId, index) => ({
      id: `${itemId}-${index}`,
      itemId,
      name: getLootDropLabel(itemId),
      x: play.rewardChest.px + 8 + Math.cos((Math.PI * 2 * index) / Math.max(1, drops.length)) * 16,
      y: play.rewardChest.py + 8 + Math.sin((Math.PI * 2 * index) / Math.max(1, drops.length)) * 14,
      source: 'chest'
    }));
    spawnBurstEffect(play, play.rewardChest.px + 8, play.rewardChest.py + 8, '#ffe58b', 14, 28);
    pushPrompt(play, '宝箱炸开了，掉落散在地上，靠近后按互动收进背包。');
  }

  function collectHybridLoot(play, loot) {
    play.lootDrops = play.lootDrops.filter((entry) => entry !== loot);
    if (loot.itemId === 'coin') {
      gainCoins(loot.source === 'enemy' ? 3 : 6, play, loot.x, loot.y, loot.source === 'enemy' ? '掉落金币' : '宝箱金币');
    } else if (loot.itemId === 'exp') {
      gainExp(play, loot.source === 'enemy' ? 3 : 6, loot.x, loot.y, loot.source === 'enemy' ? '野战历练' : '宝箱历练');
    } else if (loot.itemId === 'ally') {
      spawnAiCompanion(play, loot.x - 6, loot.y - 7);
    } else if (loot.itemId === 'bombgear') {
      grantBombGear(play, '掉落特装');
      spawnBurstEffect(play, loot.x, loot.y, '#ffbf7d', 12, 24);
    } else if (loot.itemId === 'embergear') {
      grantEmberGear(play, '掉落特装');
      spawnBurstEffect(play, loot.x, loot.y, '#ffd98a', 12, 24);
    } else {
      addBackpackItem(play, loot.itemId, 1, loot.name);
      applyShopPurchase(play, loot.itemId);
      spawnBurstEffect(play, loot.x, loot.y, '#a5edb3', 10, 22);
      pushPrompt(play, isWeaponItem(loot.itemId) ? `${loot.name} 已装备，节奏马上变了。` : `${loot.name} 已收入背包。`);
    }
    if (loot.source === 'chest') {
      play.hybrid.lootCollected += 1;
    }
    if (play.lootDrops.length <= 0) {
      pushPrompt(play, play.hybrid.rewardPortalArmed ? '掉落已经收完，踏进中心裂隙就能离场。' : '掉落已经收完，离场裂隙仍在维持。');
    }
  }

  function resolveEnvironmentSite(play, site) {
    if (!play.hybrid.active || site.done) {
      return;
    }
    site.done = true;
    if (site.required === false) {
      play.hybrid.optionalDone += 1;
    } else {
      play.hybrid.completedSites += 1;
    }
    if (site.kind === 'cache') {
      gainCoins(site.reward || 8, play, site.px + 8, site.py + 8, '遗落补给');
      addQuickSlot(play, 'potion', 1);
      if (Math.random() < 0.35) {
        gainExp(play, 4, site.px + 8, site.py + 8, '遗落笔记');
      }
      pushPrompt(play, '货箱里除了金币，还有一份本关药水。');
      return;
    }
    if (site.kind === 'spring') {
      play.player.hp = Math.min(3, play.player.hp + 1);
      play.inventory.shieldReady = true;
      const slot = getQuickSlot(play, 'shield');
      if (slot) {
        slot.count = 1;
      }
      spawnBurstEffect(play, site.px + 8, site.py + 8, '#8de0ff', 10, 24);
      triggerFeedbackEvent(play, 'heal');
      triggerFeedbackEvent(play, 'shield');
      pushPrompt(play, '泉眼让你恢复了体力，还顺手补上了一层护盾。');
      return;
    }
    if (site.kind === 'tower') {
      play.hybrid.fullMapReveal = true;
      updateDiscovery(play);
      gainCoins(site.reward || 5, play, site.px + 8, site.py + 8, '观测奖励');
      gainExp(play, 3, site.px + 8, site.py + 8, '观测经验');
      pushPrompt(play, '观测塔把整片区域标出来了，大地图现在一眼能看清。');
      return;
    }
    if (site.kind === 'relay') {
      revealDiscoveryAround(play, site.x, site.y, 4);
      play.hybrid.hazards = [];
      play.hybrid.hazardTimer = Math.max(play.hybrid.hazardTimer, 4.8);
      addQuickSlot(play, 'decoy', 1);
      gainCoins(site.reward || 4, play, site.px + 8, site.py + 8, '路标回收');
      pushPrompt(play, '旧路标把周边地形补亮了，还顺手拆出一枚诱饵假人。');
      return;
    }
    if (site.kind === 'forge') {
      play.inventory.weapon = 'wand';
      play.inventory.moveMultiplier = Math.max(play.inventory.moveMultiplier || 1, 1.25);
      addQuickSlot(play, 'potion', 1);
      gainCoins(site.reward || 6, play, site.px + 8, site.py + 8, '工棚零件');
      if (Math.random() < 0.45) {
        spawnAiCompanion(play, site.px - 2, site.py + 4);
      }
      pushPrompt(play, '废工棚里翻出了一把巨刃，这关的斩击距离和脚程都抬上来了。');
      return;
    }
    if (site.kind === 'altar') {
      const shield = getQuickSlot(play, 'shield');
      if (play.player.hp > 1) {
        play.player.hp -= 1;
        play.inventory.shieldReady = true;
        if (shield) {
          shield.count = 1;
        }
        gainCoins(site.reward || 14, play, site.px + 8, site.py + 8, '祭坛回报');
        pushPrompt(play, '祭坛抽走了 1 点生命，却回吐了一大把金币，还补了一层护盾。');
      } else {
        gainCoins(Math.max(5, Math.floor((site.reward || 14) * 0.45)), play, site.px + 8, site.py + 8, '谨慎供奉');
        pushPrompt(play, '你血量太低，祭坛只收走一点运气，给了较少金币。');
      }
      return;
    }
    if (site.kind === 'gamble') {
      if (Math.random() < 0.55) {
        gainCoins(site.reward || 12, play, site.px + 8, site.py + 8, '赌桌战利');
        play.inventory.weapon = Math.random() < 0.5 ? 'dagger' : 'axe';
        pushPrompt(play, `你赌赢了，拿到一笔金币，还临时换成了${getWeaponDisplayName(play.inventory.weapon)}。`);
      } else {
        const loss = Math.min(6, state.profile.coins);
        state.profile.coins = Math.max(0, state.profile.coins - loss);
        refreshUnlocks();
        spawnAmbushRoamers(play, 2, site.px + 8, site.py + 8);
        pushPrompt(play, `赌输了，丢了 ${loss} 金币，还惊动了附近两只游荡怪。`);
      }
      return;
    }
    play.hybrid.hazards = [];
    pushPrompt(play, '环境继电器稳定下来，这片区域暂时安静了。');
  }

  function updateBattleRoute(play, delta) {
    if (play.route !== 'battle') {
      return;
    }
    updateBonusGoal(play);
    play.guardSlowTimer = Math.max(0, (play.guardSlowTimer || 0) - delta);
    if (play.levelIndex === 1) {
      const hiddenInWheat = isPlayerInTallGrass(play);
      if (hiddenInWheat && !play.inTallGrass) {
        pushPrompt(play, '你钻进了高麦丛，警戒下降速度提升。');
        spawnBurstEffect(play, play.player.x + 6, play.player.y + 7, '#ffe58b', 8, 22);
      }
      play.inTallGrass = hiddenInWheat;
      updateGuards(play, delta);
      checkBattleCollectibles(play);
      const activeShrines = play.shrines.filter((shrine) => shrine.active).length;
      if (activeShrines >= play.shrines.length && play.shrines.length && !play.flags.allShrinesLit) {
        play.flags.allShrinesLit = true;
        pushPrompt(play, '两座石台都亮了，守卫的巡逻节奏彻底慢了下来。');
      }
      const exitOpen = play.collectedLights >= play.level.collectibles.length;
      play.flags.exitOpen = exitOpen;
      if (exitOpen && onExitTile(play)) {
        clearCurrentLevel('你集齐了全部萤火之光，出口亮起来了。');
      }
    } else if (play.levelIndex === 0) {
      const readCount = play.loreMarks.filter((mark) => mark.read).length;
      if (readCount >= play.loreMarks.length && play.loreMarks.length && !play.flags.loreTrailShown) {
        play.flags.loreTrailShown = true;
        pushPrompt(play, '风声石与旧掌机壳发出微光，迷雾边缘浮出一条更清晰的路。');
      }
      if (onExitTile(play)) {
        clearCurrentLevel('你找到了暗夜迷宫出口。');
      }
    } else if (play.levelIndex === 2) {
      updateBoss(play, delta);
      updateBossMinions(play, delta);
      const hpRate = play.boss.hp / play.boss.maxHp;
      const phase = hpRate > 0.6 ? 1 : (hpRate > 0.3 ? 2 : 3);
      if (play.lastBossPhase !== phase) {
        play.lastBossPhase = phase;
        pushPrompt(play, phase === 2 ? '暗影巨人开始召小怪了，先别只顾着盯 Boss！' : '最终阶段开启，八方向弹幕和暗脉冲一起来了！');
      }
    }
  }

  function updateGuards(play, delta) {
    const frozen = play.randomEvent && play.randomEvent.timeFreezeTimer > 0;
    play.guards.forEach((guard) => {
      guard.hitTimer = Math.max(0, (guard.hitTimer || 0) - delta);
      guard.stunTimer = Math.max(0, (guard.stunTimer || 0) - delta);
      updateGuardAlert(play, guard, delta);
      const slowFactor = play.guardSlowTimer > 0 ? 0.35 : 1;
      const decoyTarget = getNearestDecoy(play, guard);
      if (guard.stunTimer > 0) {
        return;
      }
      if (frozen) {
        return;
      }
      if (guard.mode === 'chase') {
        const chaseX = decoyTarget ? decoyTarget.x : (guard.canSeePlayer ? play.player.x : guard.lastSeenX);
        const chaseY = decoyTarget ? decoyTarget.y : (guard.canSeePlayer ? play.player.y : guard.lastSeenY);
        const dx = chaseX - guard.x;
        const dy = chaseY - guard.y;
        const dist = Math.hypot(dx, dy);
        faceTarget(guard, dx, dy);
        if (dist > 1) {
          const speed = guard.speed * 1.5 * slowFactor;
          moveGuard(play, guard, (dx / dist) * speed * delta, (dy / dist) * speed * delta);
        }
      } else if (guard.mode === 'suspicious') {
        const dx = (decoyTarget ? decoyTarget.x : (guard.canSeePlayer ? play.player.x : guard.lastSeenX)) - guard.x;
        const dy = (decoyTarget ? decoyTarget.y : (guard.canSeePlayer ? play.player.y : guard.lastSeenY)) - guard.y;
        faceTarget(guard, dx, dy);
      } else {
        const patrol = guard.patrolRoute && guard.patrolRoute.length ? guard.patrolRoute : guard.path;
        const targetPoint = patrol[guard.pathIndex % patrol.length];
        const targetX = targetPoint.x * TILE_SIZE + 2;
        const targetY = targetPoint.y * TILE_SIZE + 1;
        const dx = targetX - guard.x;
        const dy = targetY - guard.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) {
          guard.pathIndex = (guard.pathIndex + 1) % patrol.length;
        } else {
          const speed = guard.speed * slowFactor;
          moveGuard(play, guard, (dx / dist) * speed * delta, (dy / dist) * speed * delta);
          faceTarget(guard, dx, dy);
        }
      }
      if ((rectsOverlap(play.player, { x: guard.x, y: guard.y, w: 12, h: 14 }) || guard.alert >= 100) && play.guardCooldown <= 0) {
        play.guardCooldown = GUARD_HIT_COOLDOWN;
        play.run.detectedCount += 1;
        play.run.damageTaken += 1;
        resetPlayerToStart(play);
        play.comboCount = 0;
        play.comboTimer = 0;
        spawnBurstEffect(play, play.player.x + 6, play.player.y + 7, '#ff8f95', 10, 30);
        pushPrompt(play, '被发现了！小心行动……');
      }
    });
    play.guardCooldown = Math.max(0, play.guardCooldown - delta);
  }

  function checkBattleCollectibles(play) {
    play.collectibles.forEach((item) => {
      if (!item.collected && distance(item.px, item.py, play.player.x + 6, play.player.y + 7) < 14) {
        item.collected = true;
        play.collectedLights += 1;
        noteCombo(play, '萤火连携');
        gainCoins(1, play, item.px + 8, item.py + 8, '萤火金币');
        spawnBurstEffect(play, item.px + 8, item.py + 8, '#fff2a8', 10, 24);
        pushPrompt(play, `拿到萤火之光 ${play.collectedLights} / ${play.collectibles.length}${play.comboCount > 1 ? `  连携 x${play.comboCount}` : ''}`);
      }
    });
  }

  function updateBoss(play, delta) {
    const boss = play.boss;
    if (boss.dying) {
      boss.deathTimer = Math.max(0, (boss.deathTimer || 1.25) - delta);
      boss.hitFlash = Math.max(0, boss.hitFlash - delta * 2.4);
      if (Math.random() < 0.45) {
        spawnBurstEffect(play, boss.x + 8 + Math.random() * 16, boss.y + 8 + Math.random() * 16, Math.random() < 0.5 ? '#d5edff' : '#ffbcb7', 4, 18);
      }
      if (boss.deathTimer <= 0) {
        if (play.hybrid.active && play.hybrid.phase === 'boss') {
          play.boss = null;
        } else {
          clearCurrentLevel('暗影巨人化成了温柔的夜风。');
        }
      }
      return;
    }
    if (boss.spawnTimer > 0) {
      boss.spawnTimer = Math.max(0, boss.spawnTimer - delta);
      boss.hitFlash = Math.max(boss.hitFlash || 0, 0.45 + boss.spawnTimer * 0.3);
      if (Math.random() < 0.35) {
        spawnBurstEffect(play, boss.x + 12 + Math.random() * 8, boss.y + 12 + Math.random() * 8, Math.random() < 0.5 ? '#e8f6ff' : '#ffd6f5', 3, 16);
      }
      if (boss.spawnTimer <= 0.05) {
        pushPrompt(play, `${boss.title || 'Boss'} 从裂隙里压了出来，准备接战。`);
      }
      return;
    }
    if (updateExecuteTimer(play, boss, 'boss', delta, boss.x + 16, boss.y + 16)) {
      return;
    }
    boss.hitFlash = Math.max(0, boss.hitFlash - delta * 4.2);
    boss.critShieldBreak = Math.max(0, (boss.critShieldBreak || 0) - delta);
    boss.touchCooldown = Math.max(0, (boss.touchCooldown || 0) - delta);
    const frozen = play.randomEvent && play.randomEvent.timeFreezeTimer > 0;
    play.darkPulse.timer = Math.max(0, play.darkPulse.timer - delta);
    play.darkPulse.flash = Math.max(0, play.darkPulse.flash - delta);
    const hpRate = boss.hp / boss.maxHp;
    const mercyPhase = hpRate <= 0.08;
    const nightBuff = play.theme === 'night' ? 1.16 : 1;
    let moveSpeed = 46 * nightBuff;
    if (hpRate <= 0.6) {
      moveSpeed = 63 * nightBuff;
    }
    if (hpRate <= 0.3) {
      moveSpeed = 84 * nightBuff;
    }
    moveSpeed *= 1 + Math.max(0, getCampaignStageNumber(play) - 1) * 0.05;

    if (!frozen) {
      const chase = getEnemyAimTarget(play, { x: boss.x + 16, y: boss.y + 16 });
      const dx = chase.x - (boss.x + 16);
      const dy = chase.y - (boss.y + 16);
      const dist = Math.max(1, Math.hypot(dx, dy));
      boss.x += (dx / dist) * moveSpeed * delta;
      boss.y += (dy / dist) * moveSpeed * delta;
      if (!mercyPhase) {
        boss.warningTimer -= delta;
        boss.summonTimer -= delta;
        boss.darkPulseTimer -= delta;
        if (boss.warningTimer <= 0) {
          boss.warningTimer = (hpRate > 0.6 ? 3.6 : (hpRate > 0.3 ? 2.8 : 2.1)) * (play.theme === 'night' ? 0.88 : 1);
          spawnBossWarnings(play, hpRate);
        }
        if (hpRate <= 0.6 && boss.summonTimer <= 0) {
          boss.summonTimer = (hpRate > 0.3 ? 6 : 4.6) * (play.theme === 'night' ? 0.88 : 1);
          spawnBossMinions(play, hpRate > 0.3 ? 1 : 2);
        }
        if (hpRate <= 0.3 && boss.darkPulseTimer <= 0) {
          boss.darkPulseTimer = 5.2 * (play.theme === 'night' ? 0.86 : 1);
          triggerDarkPulse(play);
        }
        if (boss.touchCooldown <= 0 && chase.type === 'player' && rectsOverlap(play.player, { x: boss.x, y: boss.y, w: 32, h: 32 })) {
          boss.touchCooldown = 1.1;
          applyPlayerDamage(play, 1, `Boss 砍中了你，还剩 ${Math.max(0, play.player.hp - 1)} 点生命。`, '#ff8f95');
          applyPlayerKnockback(play, boss.x + 16, boss.y + 16, 22);
        } else if (boss.touchCooldown <= 0 && chase.type === 'ally' && rectsOverlap(chase.actor, { x: boss.x, y: boss.y, w: 32, h: 32 })) {
          boss.touchCooldown = 1.1;
          applyCompanionDamage(play, chase.actor, 1, boss.x + 16, boss.y + 16);
        }
      } else {
        play.bossWarnings = [];
        play.bossMinions = [];
      }
    }

    updateBossWarnings(play, frozen || mercyPhase ? 0 : delta);

    if (boss.hp <= 0) {
      boss.hp = 0;
      boss.dying = true;
      boss.deathTimer = boss.deathTimer || 1.25;
      play.enemyBullets = [];
      play.bossWarnings = [];
      play.bossMinions = [];
      spawnBurstEffect(play, boss.x + 16, boss.y + 16, '#e8f6ff', 20, 34);
    }
  }

  function updateExtraBosses(play, delta) {
    const frozen = play.randomEvent && play.randomEvent.timeFreezeTimer > 0;
    const stageBoost = 1 + Math.max(0, getCampaignStageNumber(play) - 1) * 0.04;
    play.extraBosses.forEach((boss) => {
      if (boss.dying) {
        boss.deathTimer = Math.max(0, (boss.deathTimer || 1.05) - delta);
        boss.hitFlash = Math.max(0, boss.hitFlash - delta * 2.4);
        if (Math.random() < 0.32) {
          spawnBurstEffect(play, boss.x + 8 + Math.random() * 16, boss.y + 8 + Math.random() * 16, Math.random() < 0.5 ? '#d5edff' : '#ffbcb7', 3, 16);
        }
        return;
      }
      if (boss.spawnTimer > 0) {
        boss.spawnTimer = Math.max(0, boss.spawnTimer - delta);
        boss.hitFlash = Math.max(boss.hitFlash || 0, 0.32 + boss.spawnTimer * 0.28);
        if (Math.random() < 0.22) {
          spawnBurstEffect(play, boss.x + 12 + Math.random() * 8, boss.y + 12 + Math.random() * 8, Math.random() < 0.5 ? '#e8f6ff' : '#ffd6f5', 2, 14);
        }
        return;
      }
      if (updateExecuteTimer(play, boss, 'boss', delta, boss.x + 16, boss.y + 16)) {
        return;
      }
      boss.hitFlash = Math.max(0, boss.hitFlash - delta * 4.2);
      boss.touchCooldown = Math.max(0, (boss.touchCooldown || 0) - delta);
      if (!frozen) {
        const chase = getEnemyAimTarget(play, { x: boss.x + 16, y: boss.y + 16 });
        const dx = chase.x - (boss.x + 16);
        const dy = chase.y - (boss.y + 16);
        const dist = Math.max(1, Math.hypot(dx, dy));
        const speed = 56 * stageBoost * (boss.speedScale || 1) * (play.theme === 'night' ? 1.12 : 1);
        boss.x += (dx / dist) * speed * delta;
        boss.y += (dy / dist) * speed * delta;
        if (boss.touchCooldown <= 0 && chase.type === 'player' && rectsOverlap(play.player, { x: boss.x, y: boss.y, w: 32, h: 32 })) {
          boss.touchCooldown = 1.1;
          applyPlayerDamage(play, 1, `副王砍中了你，还剩 ${Math.max(0, play.player.hp - 1)} 点生命。`, '#ff8f95');
          applyPlayerKnockback(play, boss.x + 16, boss.y + 16, 22);
        } else if (boss.touchCooldown <= 0 && chase.type === 'ally' && rectsOverlap(chase.actor, { x: boss.x, y: boss.y, w: 32, h: 32 })) {
          boss.touchCooldown = 1.1;
          applyCompanionDamage(play, chase.actor, 1, boss.x + 16, boss.y + 16);
        }
      }
      if (boss.hp <= 0) {
        boss.hp = 0;
        boss.dying = true;
        boss.deathTimer = boss.deathTimer || 1.05;
        spawnBurstEffect(play, boss.x + 16, boss.y + 16, '#e8f6ff', 18, 30);
      }
    });
    play.extraBosses = play.extraBosses.filter((boss) => boss && !(boss.dying && boss.deathTimer <= 0));
  }

  function spawnQueuedBossWave(play, wave) {
    if (!play || !wave) {
      return;
    }
    const anchor = play.boss && !play.boss.dying
      ? { x: play.boss.x + 16, y: play.boss.y + 16 }
      : { x: play.player.x + 48, y: play.player.y + 8 };
    const angle = (play.hybrid.bossWaveIndex % 2 === 0) ? -0.75 : 0.75;
    const radius = 52 + play.hybrid.bossWaveIndex * 8;
    const hpBase = play.boss ? play.boss.maxHp : Math.round(54 * getCampaignBossPower(play));
    play.extraBosses.push({
      x: anchor.x + Math.cos(angle) * radius - 16,
      y: anchor.y + Math.sin(angle) * radius - 16,
      w: 32,
      h: 32,
      hp: Math.round(hpBase * (wave.hpScale || 0.48)),
      maxHp: Math.round(hpBase * (wave.hpScale || 0.48)),
      title: wave.title || `副王 ${play.hybrid.bossWaveIndex + 1}`,
      spriteFrames: wave.spriteFrames || ['stoneKnight'],
      touchCooldown: 0,
      deathTimer: 1.05,
      dying: false,
      spawnTimer: 0.9,
      hitFlash: 0,
      speedScale: wave.speedScale || 1
    });
    play.hybrid.bossWaveIndex += 1;
    pushPrompt(play, `${wave.title || '副王'} 作为第 ${play.hybrid.bossWaveIndex} 波压进了战场。`);
    spawnBurstEffect(play, anchor.x, anchor.y, '#ffd6f5', 16, 28);
    play.hybrid.bossWaveTimer = play.hybrid.bossWaveQueue.length ? play.hybrid.bossWaveQueue[0].delay : 0;
  }

  function updateBossWaveSpawner(play, delta) {
    if (!play || !play.hybrid || play.hybrid.phase !== 'boss') {
      return;
    }
    if (!play.hybrid.bossWaveQueue || !play.hybrid.bossWaveQueue.length) {
      return;
    }
    const activeExtra = (play.extraBosses || []).some((boss) => boss && !boss.dying);
    if (activeExtra) {
      return;
    }
    play.hybrid.bossWaveTimer = Math.max(0, (play.hybrid.bossWaveTimer || 0) - delta);
    if (play.hybrid.bossWaveTimer > 0) {
      return;
    }
    const wave = play.hybrid.bossWaveQueue.shift();
    spawnQueuedBossWave(play, wave);
  }

  function updateDecoys(play, delta) {
    if (!play.decoys || !play.decoys.length) {
      return;
    }
    play.decoys.forEach((decoy) => {
      decoy.ttl -= delta;
    });
    play.decoys = play.decoys.filter((decoy) => decoy.ttl > 0);
  }

  function getNearestDecoy(play, guard) {
    if (!play.decoys || !play.decoys.length) {
      return null;
    }
    let best = null;
    let bestDist = Infinity;
    play.decoys.forEach((decoy) => {
      const dist = distance(guard.x, guard.y, decoy.x, decoy.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = decoy;
      }
    });
    return bestDist < 132 ? best : null;
  }

  function applyPlayerDamage(play, amount, message, effectColor) {
    if (play.progression && play.progression.ascensionUnlocked) {
      return false;
    }
    if (play.player.invuln > 0) {
      return false;
    }
    if (play.inventory.shieldReady) {
      play.inventory.shieldReady = false;
      const slot = getQuickSlot(play, 'shield');
      if (slot) {
        slot.count = 0;
      }
      play.player.invuln = 0.6;
      spawnBurstEffect(play, play.player.x + 6, play.player.y + 7, '#95f2ff', 12, 28);
      triggerFeedbackEvent(play, 'shield');
      pushPrompt(play, '护盾挡下了这次冲击！');
      return true;
    }
    const reduced = Math.max(0.5, Math.round(Math.max(0.5, amount * (1 - (play.player.defense || 0))) * 2) / 2);
    play.player.hp -= reduced;
    play.run.damageTaken += reduced;
    play.player.invuln = 1.1;
    spawnBurstEffect(play, play.player.x + 6, play.player.y + 7, effectColor || '#ff8f95', 10, 26);
    triggerFeedbackEvent(play, 'damage');
    pushPrompt(play, message || `主角受到了冲击，还剩 ${play.player.hp} 点生命。`);
    if (play.player.hp <= 0) {
      play.player.hp = 0;
      openDeathOverlay(message || '这次推进失败了，重新整顿后再试一次。');
    }
    return true;
  }

  function spawnBossWarnings(play, hpRate) {
    const count = hpRate > 0.6 ? 1 : (hpRate > 0.3 ? 2 : 3);
    for (let i = 0; i < count; i += 1) {
      const targetPlayer = i === 0 || Math.random() < 0.45;
      const px = targetPlayer ? play.player.x + 6 : clamp(play.player.x + (Math.random() * 120 - 60), 28, play.worldWidth - 28);
      const py = targetPlayer ? play.player.y + 7 : clamp(play.player.y + (Math.random() * 120 - 60), 28, play.worldHeight - 28);
      play.bossWarnings.push({
        x: px,
        y: py,
        radius: hpRate > 0.3 ? 20 : 18,
        timer: 1.1,
        blastTimer: 0.18,
        exploded: false
      });
    }
  }

  function spawnBossMinions(play, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.PI * 2 * ((i + 1) / (count + 1));
      play.bossMinions.push({
        x: play.boss.x + 12 + Math.cos(angle) * 24,
        y: play.boss.y + 14 + Math.sin(angle) * 20,
        w: 14,
        h: 12,
        hp: 20,
        touchCooldown: 0,
        hitFlash: 0,
        spriteKey: play.theme === 'night' ? 'slimeFire' : 'slimeBlue'
      });
    }
    pushPrompt(play, count > 1 ? '暗影史莱姆被召了出来，先清场再找输出窗口。' : '暗影史莱姆出现了，会贴身干扰你走位。');
  }

  function updateBossMinions(play, delta) {
    if (!play.bossMinions || !play.bossMinions.length) {
      return;
    }
    const frozen = play.randomEvent && play.randomEvent.timeFreezeTimer > 0;
    play.bossMinions.forEach((minion) => {
      minion.touchCooldown = Math.max(0, minion.touchCooldown - delta);
      minion.hitFlash = Math.max(0, (minion.hitFlash || 0) - delta * 5);
      if (updateExecuteTimer(play, minion, 'bossMinion', delta, minion.x + 7, minion.y + 6)) {
        return;
      }
      if (!frozen) {
        const chase = getEnemyAimTarget(play, { x: minion.x + 7, y: minion.y + 6 });
        const dx = chase.x - (minion.x + 7);
        const dy = chase.y - (minion.y + 6);
        const dist = Math.max(1, Math.hypot(dx, dy));
        minion.x += (dx / dist) * 46 * delta;
        minion.y += (dy / dist) * 46 * delta;
        if (minion.touchCooldown <= 0 && chase.type === 'player' && rectsOverlap(play.player, minion)) {
          minion.touchCooldown = 0.9;
          const damage = 0.5;
          applyPlayerDamage(play, damage, `暗影史莱姆撞到了你，还剩 ${Math.max(0, play.player.hp - damage)} 点生命。`, '#b99cff');
        } else if (minion.touchCooldown <= 0 && chase.type === 'ally' && rectsOverlap(chase.actor, minion)) {
          minion.touchCooldown = 0.9;
          applyCompanionDamage(play, chase.actor, 0.5, minion.x + 7, minion.y + 6);
        }
      }
    });
    play.bossMinions = play.bossMinions.filter((minion) => minion.hp > 0);
  }

  function triggerDarkPulse(play) {
    play.darkPulse.timer = 0.55;
    play.darkPulse.flash = 0.18;
    spawnBurstEffect(play, play.boss.x + 16, play.boss.y + 16, '#a8a1ff', 18, 34);
    pushPrompt(play, '暗脉冲压了下来，先让开爆点再贴身反打。');
  }

  function updateBossWarnings(play, delta) {
    if (!play.bossWarnings.length) {
      return;
    }
    play.bossWarnings.forEach((warning) => {
      if (!warning.exploded) {
        warning.timer -= delta;
        if (warning.timer <= 0) {
          warning.exploded = true;
          spawnBurstEffect(play, warning.x, warning.y, '#ff9f84', 14, 30);
          if (distance(play.player.x + 6, play.player.y + 7, warning.x, warning.y) <= warning.radius + 6) {
            const damage = 1;
            applyPlayerDamage(play, damage, `预警区爆开了，还剩 ${Math.max(0, play.player.hp - damage)} 点生命。`, '#ff7e88');
          }
          (play.allies || []).slice().forEach((ally) => {
            if (distance(ally.x + 6, ally.y + 7, warning.x, warning.y) <= warning.radius + 4) {
              applyCompanionDamage(play, ally, 1, warning.x, warning.y);
            }
          });
        }
      } else {
        warning.blastTimer -= delta;
      }
    });
    play.bossWarnings = play.bossWarnings.filter((warning) => !warning.exploded || warning.blastTimer > 0);
  }

  function performPlayerAttack(play, angle) {
    spawnPlayerMeleeSwing(play, angle);
  }

  function spawnPlayerMeleeSwing(play, angle) {
    const stats = getWeaponStats(play);
    const reach = stats.reach;
    const cx = play.player.x + 6 + Math.cos(angle) * reach;
    const cy = play.player.y + 7 + Math.sin(angle) * reach;
    const swing = {
      x: cx,
      y: cy,
      angle,
      radius: stats.radius,
      damage: stats.damage,
      ttl: 0.22,
      maxTtl: 0.22
    };
    play.playerSwings.push(swing);
    triggerFeedbackEvent(play, 'swing');
    applyMeleeDamage(play, swing);
    spawnRingEffect(play, cx, cy, Math.max(10, stats.radius * 0.65), play.theme === 'night' ? '#9cf3ff' : '#ffd38d', 0.34, 120);
    if (stats.globalSlashChance > 0 && Math.random() < stats.globalSlashChance) {
      triggerSkybladeRift(play, angle, stats);
    }
    spawnBurstEffect(play, cx, cy, play.theme === 'night' ? '#9cf3ff' : '#ffd38d', 8, 20);
  }

  function rollWeaponStrike(play, baseDamage, targetType) {
    const stats = getWeaponStats(play);
    const bossBias = targetType === 'boss' ? 0.03 : 0;
    const critical = Math.random() < clamp((stats.critChance || 0.08) + bossBias, 0.04, 0.65);
    return {
      damage: Math.max(1, Math.round(baseDamage * (critical ? (stats.critMultiplier || 1.8) : 1))),
      critical
    };
  }

  function finishDirectEnemyStrike(play, target, targetType, damage, critical, tx, ty, reward, comboLabel, burstColor, flashAmount) {
    if (target.executeTimer > 0) {
      return;
    }
    target.hp -= damage;
    setHitFlash(target, flashAmount);
    spawnBurstEffect(play, tx, ty, burstColor, critical ? 10 : 6, critical ? 26 : 18);
    spawnRingEffect(play, tx, ty, critical ? 16 : 12, burstColor, critical ? 0.32 : 0.26, critical ? 140 : 110);
    spawnTextEffect(play, tx, ty - 4, String(damage), critical ? '#ff6b76' : '#ffffff', critical ? 13 : 11, critical ? -24 : -18, critical ? 0.8 : 0.62);
    if (critical) {
      spawnCritEffect(play, tx, ty - 10, damage);
      triggerFeedbackEvent(play, 'crit');
      if (isCampaignStage(play, 9) && targetType !== 'boss' && targetType !== 'miniboss') {
        play.special.critRampStacks = Math.min(40, (play.special.critRampStacks || 0) + 1);
        play.special.critRampReady = play.special.critRampStacks >= 40;
      }
    } else {
      triggerFeedbackEvent(play, target.hp <= 0 ? 'kill' : 'hit');
    }
    if (target.hp > 0) {
      maybeTriggerExecute(play, target, targetType, tx, ty);
    }
    if (targetType !== 'boss' && play.inventory.weapon !== 'sword') {
      applyEnemyKnockback(play, target, play.player.x + 6, play.player.y + 7, play.inventory.weapon === 'skyblade' ? 30 : (play.inventory.weapon === 'wand' ? 18 : (play.inventory.weapon === 'axe' ? 14 : 12)));
    }
    if (critical && targetType === 'boss') {
      target.critShieldBreak = 1.8;
    }
    if (target.hp <= 0 && reward > 0) {
      gainCoins(reward, play, tx, ty, comboLabel === '战场清理' ? '史莱姆赏金' : '清场金币');
      gainExp(play, comboLabel === '头目压制' ? 3 : 1, tx, ty, comboLabel);
      noteCombo(play, comboLabel);
    }
  }

  function triggerSkybladeRift(play, angle, stats) {
    const bonusDamage = Math.max(18, Math.round((stats.damage || 24) * 0.7));
    play.feedback.skySlash = 0.32;
    play.feedback.skySlashAngle = angle;
    spawnTextEffect(play, play.player.x + 6, play.player.y - 10, '裂穹斩', '#dff6ff', 16, -18, 0.8);
    pushPrompt(play, '裂穹刀撕开了整片战场，一道全图刀光压了过去。');
    play.roamers.forEach((roamer) => {
      if (roamer.hp > 0) {
        finishDirectEnemyStrike(play, roamer, 'roamer', Math.max(roamer.hp, bonusDamage), false, roamer.x + 6, roamer.y + 6, roamer.reward || 3, '清场推进', '#cfe8ff', 1.05);
        trySpawnEnemyDrop(play, roamer, 'roamer');
      }
    });
    play.minibosses.forEach((mini) => {
      if (mini.hp > 0) {
        const strike = rollWeaponStrike(play, bonusDamage + 10, 'miniboss');
        finishDirectEnemyStrike(play, mini, 'miniboss', Math.max(strike.damage, mini.hp > 30 ? strike.damage : mini.hp), strike.critical, mini.x + 7, mini.y + 7, mini.reward || 8, '头目压制', '#d7f3ff', 1.1);
        if (mini.hp <= 0) {
          trySpawnEnemyDrop(play, mini, 'miniboss');
        }
      }
    });
    play.bossMinions.forEach((minion) => {
      if (minion.hp > 0) {
        finishDirectEnemyStrike(play, minion, 'bossMinion', Math.max(minion.hp, bonusDamage), false, minion.x + 7, minion.y + 6, 0, '战场清理', '#d7f3ff', 1.05);
      }
    });
    if (play.boss && !play.boss.dying) {
      const strike = rollWeaponStrike(play, Math.max(22, Math.round(bonusDamage * 1.25)), 'boss');
      play.boss.hp = Math.max(0, play.boss.hp - strike.damage);
      setHitFlash(play.boss, 1.18);
      spawnBurstEffect(play, play.boss.x + 16, play.boss.y + 16, '#e8f6ff', strike.critical ? 18 : 12, 28);
      if (strike.critical) {
        spawnCritEffect(play, play.boss.x + 16, play.boss.y + 8, strike.damage);
        triggerFeedbackEvent(play, 'crit');
      } else {
        triggerFeedbackEvent(play, 'hit');
      }
    }
    (play.extraBosses || []).forEach((boss) => {
      if (boss.hp > 0 && !boss.dying) {
        const strike = rollWeaponStrike(play, Math.max(18, Math.round(bonusDamage * 1.05)), 'boss');
        boss.hp = Math.max(0, boss.hp - strike.damage);
        setHitFlash(boss, 1.05);
        spawnBurstEffect(play, boss.x + 16, boss.y + 16, '#e8f6ff', strike.critical ? 14 : 10, 24);
        if (strike.critical) {
          spawnCritEffect(play, boss.x + 16, boss.y + 8, strike.damage);
          triggerFeedbackEvent(play, 'crit');
        } else {
          triggerFeedbackEvent(play, 'hit');
        }
      }
    });
  }

  function applyMeleeDamage(play, swing) {
    const arc = Math.PI * 0.8;
    const canHitArc = (target) => {
      const tx = target.x + (target.w || 12) * 0.5;
      const ty = target.y + (target.h || 12) * 0.5;
      const dist = distance(swing.x, swing.y, tx, ty);
      if (dist > swing.radius + 10) {
        return false;
      }
      const delta = Math.atan2(ty - (play.player.y + 7), tx - (play.player.x + 6)) - swing.angle;
      const wrapped = Math.atan2(Math.sin(delta), Math.cos(delta));
      return Math.abs(wrapped) <= arc;
    };
    const hitTarget = (target, targetType, reward, comboLabel, burstColor, flashAmount) => {
      const tx = target.x + (target.w || 12) * 0.5;
      const ty = target.y + (target.h || 12) * 0.5;
      if (!canHitArc(target)) {
        return false;
      }
      const strike = rollWeaponStrike(play, swing.damage, targetType);
      finishDirectEnemyStrike(play, target, targetType, strike.damage, strike.critical, tx, ty, reward, comboLabel, burstColor, flashAmount);
      return true;
    };
    if (play.boss && canHitArc({ x: play.boss.x, y: play.boss.y, w: 32, h: 32 })) {
      const strike = rollWeaponStrike(play, swing.damage, 'boss');
      const damage = isCampaignStage(play, 9) && play.boss.damageReduction && !strike.critical && !(play.boss.critShieldBreak > 0)
        ? Math.max(1, Math.round(strike.damage * (1 - play.boss.damageReduction)))
        : strike.damage;
      play.boss.hp = Math.max(0, play.boss.hp - damage);
      setHitFlash(play.boss, 1.05);
      spawnBurstEffect(play, play.boss.x + 16, play.boss.y + 16, '#9cf3ff', strike.critical ? 12 : 6, strike.critical ? 28 : 18);
      spawnTextEffect(play, play.boss.x + 16, play.boss.y + 6, String(damage), strike.critical ? '#ff6b76' : '#ffffff', strike.critical ? 14 : 11, -18, 0.72);
      if (strike.critical) {
        spawnCritEffect(play, play.boss.x + 16, play.boss.y - 4, damage);
        triggerFeedbackEvent(play, 'crit');
        play.boss.critShieldBreak = 1.8;
      } else {
        triggerFeedbackEvent(play, 'hit');
      }
      if (play.boss.hp > 0) {
        maybeTriggerExecute(play, play.boss, 'boss', play.boss.x + 16, play.boss.y + 16);
      }
    }
    (play.extraBosses || []).forEach((boss) => {
      if (boss && !boss.dying && canHitArc({ x: boss.x, y: boss.y, w: 32, h: 32 })) {
        const strike = rollWeaponStrike(play, Math.round(swing.damage * 0.9), 'boss');
        boss.hp = Math.max(0, boss.hp - strike.damage);
        setHitFlash(boss, 1.05);
        spawnBurstEffect(play, boss.x + 16, boss.y + 16, '#9cf3ff', strike.critical ? 10 : 5, strike.critical ? 24 : 16);
        spawnTextEffect(play, boss.x + 16, boss.y + 6, String(strike.damage), strike.critical ? '#ff6b76' : '#ffffff', strike.critical ? 13 : 10, -16, 0.62);
        if (strike.critical) {
          spawnCritEffect(play, boss.x + 16, boss.y - 4, strike.damage);
          triggerFeedbackEvent(play, 'crit');
        } else {
          triggerFeedbackEvent(play, 'hit');
        }
        if (boss.hp > 0) {
          maybeTriggerExecute(play, boss, 'boss', boss.x + 16, boss.y + 16);
        }
      }
    });
    play.bossMinions.forEach((minion) => {
      if (hitTarget(minion, 'bossMinion', minion.hp <= 12 ? 5 : 0, '战场清理', '#c7b5ff', 0.98) && minion.hp <= 0) {
        spawnBurstEffect(play, minion.x + 7, minion.y + 6, '#d9c4ff', 10, 24);
        trySpawnEnemyDrop(play, minion, 'miniboss');
      }
    });
    play.minibosses.forEach((mini) => {
      if (hitTarget(mini, 'miniboss', mini.reward || 8, '头目压制', '#ffbf95', 0.92) && mini.hp <= 0) {
        spawnBurstEffect(play, mini.x + 7, mini.y + 7, '#ffd28f', 12, 24);
        trySpawnEnemyDrop(play, mini, 'miniboss');
      }
    });
    play.roamers.forEach((roamer) => {
      if (hitTarget(roamer, 'roamer', roamer.reward || 3, '清场推进', play.theme === 'night' ? '#9cf3ff' : '#f5cc84', 0.88) && roamer.hp <= 0) {
        spawnBurstEffect(play, roamer.x + 6, roamer.y + 6, '#bfa0ff', 10, 22);
        trySpawnEnemyDrop(play, roamer, 'roamer');
      }
    });
    play.guards.forEach((guard) => {
      if (canHitArc({ x: guard.x, y: guard.y, w: 12, h: 14 })) {
        stunGuard(play, guard, '挥砍', '#ffe58b');
      }
    });
  }

  function updatePlayerSwings(play, delta) {
    if (!play.playerSwings || !play.playerSwings.length) {
      return;
    }
    play.playerSwings = play.playerSwings.filter((swing) => swing.ttl > 0);
    play.playerSwings.forEach((swing) => {
      swing.ttl -= delta;
    });
  }

  function spawnPlayerBullet(play, angle) {
    const player = play.player;
    const isDagger = play.inventory.weapon === 'dagger';
    const isWand = play.inventory.weapon === 'wand';
    const spread = isWand ? [-0.22, 0, 0.22] : [0];
    const speed = isDagger ? 700 : (isWand ? 420 : 360);
    const startOffset = isDagger ? 18 : (isWand ? 16 : 12);
    const ttl = isDagger ? 1.55 : (isWand ? 1.45 : 1.18);
    const damage = isWand ? 8 : (isDagger ? 14 : 10);
    const hitRadius = isDagger ? 5 : 3;
    spread.forEach((spreadOffset) => {
      const bulletAngle = angle + spreadOffset;
      let spawnX = player.x + 6 + Math.cos(bulletAngle) * startOffset;
      let spawnY = player.y + 7 + Math.sin(bulletAngle) * startOffset;
      let spawnTile = getTile(play.level.grid, Math.floor(spawnX / TILE_SIZE), Math.floor(spawnY / TILE_SIZE));
      if ([TILE.WALL, TILE.WATER].includes(spawnTile)) {
        for (let offset = startOffset - 4; offset >= 6; offset -= 4) {
          spawnX = player.x + 6 + Math.cos(bulletAngle) * offset;
          spawnY = player.y + 7 + Math.sin(bulletAngle) * offset;
          spawnTile = getTile(play.level.grid, Math.floor(spawnX / TILE_SIZE), Math.floor(spawnY / TILE_SIZE));
          if (![TILE.WALL, TILE.WATER].includes(spawnTile)) {
            break;
          }
        }
      }
      play.playerBullets.push({
        x: spawnX,
        y: spawnY,
        vx: Math.cos(bulletAngle) * speed,
        vy: Math.sin(bulletAngle) * speed,
        prevX: player.x + 6,
        prevY: player.y + 7,
        wallGrace: isDagger ? 0.22 : (isWand ? 0.14 : 0),
        ttl,
        damage,
        hitRadius
      });
    });
  }

  function spawnEnemyBullet(play, x, y, angle, speed, damage) {
    play.enemyBullets.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      ttl: 3,
      damage: damage || 1
    });
  }

  function updateBullets(play, delta) {
    play.playerBullets = play.playerBullets.filter((bullet) => bullet.ttl > 0);
    play.enemyBullets = play.enemyBullets.filter((bullet) => bullet.ttl > 0);

    play.playerBullets.forEach((bullet) => {
      bullet.prevX = bullet.x;
      bullet.prevY = bullet.y;
      bullet.ttl -= delta;
      bullet.wallGrace = Math.max(0, (bullet.wallGrace || 0) - delta);
      if (bullet.kind === 'bomb') {
        const targetInfo = getNearestEnemyTarget(play, bullet.x, bullet.y);
        if (bullet.homing && targetInfo && targetInfo.target) {
          const tx = targetInfo.target.x + ((targetInfo.target.w || 12) * 0.5);
          const ty = targetInfo.target.y + ((targetInfo.target.h || 12) * 0.5);
          const ang = Math.atan2(ty - bullet.y, tx - bullet.x);
          bullet.vx = lerp(bullet.vx, Math.cos(ang) * 72, 0.14);
          bullet.vy = lerp(bullet.vy, Math.sin(ang) * 72, 0.14);
        }
      }
      bullet.x += bullet.vx * delta;
      bullet.y += bullet.vy * delta;
      const bulletTile = getTile(play.level.grid, Math.floor(bullet.x / TILE_SIZE), Math.floor(bullet.y / TILE_SIZE));
      if ([TILE.WALL, TILE.WATER].includes(bulletTile) && !bullet.ignoreWalls && (bullet.wallGrace || 0) <= 0) {
        bullet.ttl = 0;
      }
      if (bullet.kind === 'bomb') {
        let exploded = bullet.ttl <= 0;
        collectActiveEnemies(play).forEach((entry) => {
          if (!exploded && bulletHitsRect(bullet, entry.target, 2)) {
            exploded = true;
          }
        });
        if (exploded) {
          collectActiveEnemies(play).forEach((entry) => {
            const actor = entry.target;
            const tx = actor.x + ((actor.w || 12) * 0.5);
            const ty = actor.y + ((actor.h || 12) * 0.5);
            if (distance(bullet.x, bullet.y, tx, ty) <= (bullet.radius || 28)) {
              finishDirectEnemyStrike(play, actor, entry.type, bullet.damage || 14, true, tx, ty, entry.type === 'roamer' ? (actor.reward || 3) : (actor.reward || 0), '爆裂命中', '#ffbf7d', 1.02);
              applyEnemyKnockback(play, actor, bullet.x, bullet.y, 16);
              igniteEnemy(play, actor, tx, ty, 2.8);
            }
          });
          spawnBurstEffect(play, bullet.x, bullet.y, '#ffbf7d', 16, 30);
          play.special.fires.push({ x: bullet.x, y: bullet.y, ttl: 2.2, phase: Math.random() * Math.PI * 2 });
          bullet.ttl = 0;
          return;
        }
      }
      const bossTargets = []
        .concat(play.boss && !play.boss.dying ? [play.boss] : [])
        .concat((play.extraBosses || []).filter((boss) => boss && !boss.dying));
      bossTargets.forEach((boss) => {
        if (bullet.ttl > 0 && bulletHitsRect(bullet, { x: boss.x, y: boss.y, w: 32, h: 32 }, 3)) {
          bullet.ttl = 0;
          boss.hp = Math.max(0, boss.hp - (bullet.damage || 10));
          setHitFlash(boss, 1.05);
          spawnBurstEffect(play, bullet.x, bullet.y, '#9cf3ff', 6, 18);
          triggerFeedbackEvent(play, 'hit');
        }
      });
      play.bossMinions.forEach((minion) => {
        if (bullet.ttl > 0 && bulletHitsRect(bullet, minion, 2)) {
          bullet.ttl = 0;
          minion.hp -= bullet.damage || 10;
          setHitFlash(minion, 0.98);
          spawnBurstEffect(play, bullet.x, bullet.y, '#c7b5ff', 6, 18);
          triggerFeedbackEvent(play, minion.hp <= 0 ? 'kill' : 'hit');
          if (minion.hp <= 0) {
            gainCoins(5, play, minion.x + 7, minion.y + 6, '史莱姆赏金');
            noteCombo(play, '战场清理');
            spawnBurstEffect(play, minion.x + 7, minion.y + 6, '#d9c4ff', 10, 24);
            trySpawnEnemyDrop(play, minion, 'miniboss');
          }
        }
      });
      play.minibosses.forEach((mini) => {
        if (bullet.ttl > 0 && bulletHitsRect(bullet, mini, 2)) {
          bullet.ttl = 0;
          mini.hp -= bullet.damage || 10;
          setHitFlash(mini, 0.92);
          spawnBurstEffect(play, bullet.x, bullet.y, '#ffbf95', 6, 18);
          triggerFeedbackEvent(play, mini.hp <= 0 ? 'kill' : 'hit');
          if (mini.hp <= 0) {
            gainCoins(mini.reward || 8, play, mini.x + 7, mini.y + 7, '头目赏金');
            noteCombo(play, '头目压制');
            spawnBurstEffect(play, mini.x + 7, mini.y + 7, '#ffd28f', 12, 24);
            trySpawnEnemyDrop(play, mini, 'miniboss');
          }
        }
      });
      play.roamers.forEach((roamer) => {
        if (bullet.ttl > 0 && bulletHitsRect(bullet, roamer, 2)) {
          bullet.ttl = 0;
          roamer.hp -= bullet.damage || 10;
          setHitFlash(roamer, 0.88);
          spawnBurstEffect(play, bullet.x, bullet.y, play.theme === 'night' ? '#9cf3ff' : '#f5cc84', 6, 18);
          triggerFeedbackEvent(play, roamer.hp <= 0 ? 'kill' : 'hit');
          if (roamer.hp <= 0) {
            gainCoins(roamer.reward || 3, play, roamer.x + 6, roamer.y + 6, '清场金币');
            noteCombo(play, '清场推进');
            spawnBurstEffect(play, roamer.x + 6, roamer.y + 6, '#bfa0ff', 10, 22);
            trySpawnEnemyDrop(play, roamer, 'roamer');
          }
        }
      });
      play.guards.forEach((guard) => {
        if (bullet.ttl > 0 && bulletHitsRect(bullet, { x: guard.x, y: guard.y, w: 12, h: 14 }, 2)) {
          bullet.ttl = 0;
          stunGuard(play, guard, '近战冲击', '#9cf3ff');
        }
      });
    });

    play.enemyBullets.forEach((bullet) => {
      bullet.ttl -= delta;
      if (!(play.randomEvent && play.randomEvent.timeFreezeTimer > 0)) {
        bullet.x += bullet.vx * delta;
        bullet.y += bullet.vy * delta;
      }
      if (pointInRect(bullet.x, bullet.y, state.play.player) && state.play.player.invuln <= 0) {
        bullet.ttl = 0;
        const damage = bullet.damage || 1;
        applyPlayerDamage(play, damage, `主角受到了冲击，还剩 ${Math.max(0, play.player.hp - damage)} 点生命。`, '#ff8f95');
      }
    });
  }

  function updatePuzzleRoute(play, delta) {
    if (play.route !== 'puzzle') {
      return;
    }
    updateBonusGoal(play);
    updatePuzzleHints(play, delta);
    if (play.levelIndex === 1) {
      updateMirrorBeam(play);
      if (play.flags.mirrorSolved && !play.flags.bridgePrompted) {
        play.flags.bridgePrompted = true;
        pushPrompt(play, '日照锁已经亮起，去终端前完成这台掌机的解锁。');
      }
    } else if (play.levelIndex === 2) {
      updateValvePuzzle(play);
      if (play.flags.bridgeOpen && !play.flags.bridgePrompted) {
        play.flags.bridgePrompted = true;
        pushPrompt(play, '三道水渠已经校准，中央水桥升起了。');
      }
    }
  }

  function updatePuzzleHints(play, delta) {
    if (!play.puzzleHints || !play.puzzleHints.length) {
      return;
    }
    play.puzzleHints.forEach((hint) => {
      hint.timer -= delta;
    });
    play.puzzleHints = play.puzzleHints.filter((hint) => hint.timer > 0);
  }

  function addPuzzleHint(play, kind, id, color, timer) {
    if (!play.puzzleHints) {
      play.puzzleHints = [];
    }
    const existing = play.puzzleHints.find((hint) => hint.kind === kind && hint.id === id);
    if (existing) {
      existing.timer = Math.max(existing.timer, timer || 3.6);
      existing.color = color || existing.color;
      return;
    }
    play.puzzleHints.push({
      kind,
      id,
      color: color || 'rgba(255,229,139,0.18)',
      timer: timer || 3.6
    });
  }

  function activatePuzzleSign(play, sign) {
    sign.read = true;
    if (play.levelIndex === 0) {
      const map = {
        'sign-light': { runeId: 'sun', text: '这块石牌明确指向了最该先亮起的符石。' },
        'sign-wind': { runeId: 'wind', text: '风车方向已经提醒你第二枚该去哪找。' },
        'sign-water': { runeId: 'water', text: '最后一枚和水边有关，路线已经缩小了。' }
      };
      const info = map[sign.id];
      if (info) {
        addPuzzleHint(play, 'rune', info.runeId, 'rgba(255,229,139,0.22)', 4.2);
        pushPrompt(play, info.text);
      }
      return;
    }
    if (play.levelIndex === 1) {
      const map = {
        'mirror-note-a': { mirrorId: 'mirror-a', text: '第一折该往上送，先盯住最下面那面折镜。' },
        'mirror-note-b': { mirrorId: 'mirror-b', text: '中段要横折，说明中间这面折镜是关键。' },
        'mirror-note-c': { mirrorId: 'mirror-c', text: '最后一折会决定能不能打到锁芯。' }
      };
      const info = map[sign.id];
      if (info) {
        addPuzzleHint(play, 'mirror', info.mirrorId, 'rgba(129,195,232,0.2)', 4.2);
        pushPrompt(play, info.text);
      }
      return;
    }
    const related = sign.id === 'logic-a' ? ['left', 'middle', 'right']
      : (sign.id === 'logic-b' ? ['left', 'right'] : ['middle', 'left', 'right']);
    related.forEach((valveId) => addPuzzleHint(play, 'valve', valveId, 'rgba(144,210,160,0.18)', 4.2));
    pushPrompt(play, '这条渠牌条件已经记住了，可以拿现在的闸门组合去对照。');
  }

  function getValveRuleStates(play) {
    const signs = Object.fromEntries((play.signs || []).map((sign) => [sign.id, sign]));
    const left = Boolean(play.valves.find((valve) => valve.id === 'left')?.on);
    const middle = Boolean(play.valves.find((valve) => valve.id === 'middle')?.on);
    const right = Boolean(play.valves.find((valve) => valve.id === 'right')?.on);
    return [
      {
        id: 'logic-a',
        text: '两道闸门开启',
        read: Boolean(signs['logic-a'] && signs['logic-a'].read),
        ok: [left, middle, right].filter(Boolean).length === 2
      },
      {
        id: 'logic-b',
        text: '左闸与右闸同向',
        read: Boolean(signs['logic-b'] && signs['logic-b'].read),
        ok: left === right
      },
      {
        id: 'logic-c',
        text: '中闸与两侧相反',
        read: Boolean(signs['logic-c'] && signs['logic-c'].read),
        ok: middle !== left && middle !== right
      }
    ];
  }

  function getMirrorCheckpointStatus(play) {
    const signs = Object.fromEntries((play.signs || []).map((sign) => [sign.id, sign]));
    const a = play.mirrors.find((mirror) => mirror.id === 'mirror-a');
    const b = play.mirrors.find((mirror) => mirror.id === 'mirror-b');
    const c = play.mirrors.find((mirror) => mirror.id === 'mirror-c');
    return [
      { id: 'mirror-note-a', text: '先向上折', read: Boolean(signs['mirror-note-a'] && signs['mirror-note-a'].read), ok: a ? a.state === 1 : false },
      { id: 'mirror-note-b', text: '中段向右折', read: Boolean(signs['mirror-note-b'] && signs['mirror-note-b'].read), ok: b ? b.state === 0 : false },
      { id: 'mirror-note-c', text: '最后再向上', read: Boolean(signs['mirror-note-c'] && signs['mirror-note-c'].read), ok: c ? c.state === 1 : false }
    ];
  }

  function resetRunePuzzle(play) {
    play.runeProgress = 0;
    play.runes.forEach((rune) => {
      rune.active = false;
    });
  }

  function activateRune(play, rune) {
    if (play.flags.runeSolved) {
      startDialogue([{ speaker: rune.title, text: `${rune.hint} 这枚符石已经回应过你了。` }]);
      return;
    }
    const expectedId = play.level.runeSolution[play.runeProgress];
    if (rune.id === expectedId) {
      rune.active = true;
      play.runeProgress += 1;
      noteCombo(play, '符石顺序');
      spawnBurstEffect(play, rune.px + 8, rune.py + 8, '#ffe58b', 8, 20);
      if (play.runeProgress >= play.level.runeSolution.length) {
        play.flags.runeSolved = true;
        pushPrompt(play, '三枚符石依次亮起，底座已经准备回应。');
      } else {
        pushPrompt(play, `顺序正确，还差 ${play.level.runeSolution.length - play.runeProgress} 枚。`);
      }
      return;
    }
    play.bonusTracker.runeResetCount += 1;
    resetRunePuzzle(play);
    pushPrompt(play, '符石顺序错了，石阵已经重置。');
  }

  function rotateMirror(play, mirror) {
    mirror.state = mirror.state === 0 ? 1 : 0;
    play.bonusTracker.mirrorTurns += 1;
    addPuzzleHint(play, 'mirror', mirror.id, 'rgba(129,195,232,0.22)', 2.8);
    updateMirrorBeam(play);
    const checkpoints = getMirrorCheckpointStatus(play).filter((item) => item.read);
    const wrongRead = checkpoints.filter((item) => !item.ok).length;
    pushPrompt(play, wrongRead > 0
      ? `折镜翻到 ${mirror.state === 0 ? '\\' : '/'}，但已读刻痕里还有 ${wrongRead} 条没对上。`
      : `折镜翻到 ${mirror.state === 0 ? '\\' : '/'} 方向。`);
  }

  function reflectBeam(direction, mirrorState) {
    if (mirrorState === 0) {
      return { right: 'down', down: 'right', left: 'up', up: 'left' }[direction];
    }
    return { right: 'up', up: 'right', left: 'down', down: 'left' }[direction];
  }

  function updateMirrorBeam(play) {
    if (!play.level.beamSource) {
      return;
    }
    const dirs = {
      right: { x: 1, y: 0 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      up: { x: 0, y: -1 }
    };
    play.receivers.forEach((receiver) => {
      receiver.lit = false;
    });
    play.beamSegments = [];
    play.litReceivers = 0;
    let tileX = play.level.beamSource.x;
    let tileY = play.level.beamSource.y;
    let direction = play.level.beamSource.dir;
    for (let step = 0; step < 32; step += 1) {
      const delta = dirs[direction];
      const nextX = tileX + delta.x;
      const nextY = tileY + delta.y;
      const tile = getTile(play.level.grid, nextX, nextY);
      if (!tile && tile !== 0) {
        break;
      }
      play.beamSegments.push({
        x1: tileX * TILE_SIZE + 8,
        y1: tileY * TILE_SIZE + 8,
        x2: nextX * TILE_SIZE + 8,
        y2: nextY * TILE_SIZE + 8
      });
      if ([TILE.WALL, TILE.WATER, TILE.SHADOW].includes(tile)) {
        break;
      }
      tileX = nextX;
      tileY = nextY;
      const receiver = play.receivers.find((item) => item.x === tileX && item.y === tileY);
      if (receiver) {
        receiver.lit = true;
        play.litReceivers += 1;
        break;
      }
      const mirror = play.mirrors.find((item) => item.x === tileX && item.y === tileY);
      if (mirror) {
        direction = reflectBeam(direction, mirror.state);
      }
    }
    play.flags.mirrorSolved = play.receivers.length > 0 && play.receivers.every((receiver) => receiver.lit);
  }

  function updateValvePuzzle(play) {
    const goal = play.level.valveGoal || {};
    const correct = play.valves.every((valve) => goal[valve.id] === valve.on);
    if (correct && !play.flags.bridgeOpen) {
      play.flags.bridgeOpen = true;
      play.level.bridgeTiles.forEach((tile) => {
        play.level.grid[tile.y][tile.x] = TILE.BRIDGE;
      });
    } else if (!correct && play.flags.bridgeOpen) {
      play.flags.bridgeOpen = false;
      play.level.bridgeTiles.forEach((tile) => {
        play.level.grid[tile.y][tile.x] = TILE.WATER;
      });
    }
  }

  function toggleValve(play, valve) {
    valve.on = !valve.on;
    addPuzzleHint(play, 'valve', valve.id, 'rgba(144,210,160,0.2)', 2.8);
    const goal = play.level.valveGoal || {};
    if (goal[valve.id] !== valve.on) {
      play.bonusTracker.valveMistakes += 1;
    }
    updateValvePuzzle(play);
    const readRules = getValveRuleStates(play).filter((rule) => rule.read);
    const failedRules = readRules.filter((rule) => !rule.ok);
    pushPrompt(play, failedRules.length
      ? `${valve.title}${valve.on ? '已开启' : '已关闭'}，但当前组合与 ${failedRules.length} 条已读渠牌冲突。`
      : `${valve.title}${valve.on ? '已开启' : '已关闭'}。`);
  }

  function movePlayer(play, dx, dy) {
    if (dx !== 0) {
      const movedX = moveAxis(play, 'x', dx);
      if (!movedX) {
        play.player.walking = false;
      }
    }
    if (dy !== 0) {
      const movedY = moveAxis(play, 'y', dy);
      if (!movedY) {
        play.player.walking = false;
      }
    }
  }

  function moveAxis(play, axis, amount) {
    const player = play.player;
    const previous = player[axis];
    player[axis] += amount;

    const blockedTile = detectTileCollision(play, player);
    const blockedNpc = detectNpcCollision(play, player);

    if (blockedTile || blockedNpc) {
      player[axis] = previous;
      if (blockedTile === TILE.SHADOW) {
        pushPrompt(play, '小心暗影！');
      }
      return false;
    }
    return true;
  }

  function detectTileCollision(play, player) {
    const points = [
      { x: player.x + 1, y: player.y + 1 },
      { x: player.x + player.w - 1, y: player.y + 1 },
      { x: player.x + 1, y: player.y + player.h - 1 },
      { x: player.x + player.w - 1, y: player.y + player.h - 1 }
    ];
    for (const point of points) {
      const tx = Math.floor(point.x / TILE_SIZE);
      const ty = Math.floor(point.y / TILE_SIZE);
      const tile = getTile(play.level.grid, tx, ty);
      if ([TILE.WALL, TILE.WATER, TILE.SHADOW].includes(tile)) {
        return tile;
      }
      if (play.levelIndex === 1 && play.route === 'battle' && tile === TILE.EXIT && !play.flags.exitOpen) {
        return TILE.WALL;
      }
      if (play.route === 'puzzle' && play.levelIndex === 1 && tile === TILE.EXIT) {
        return TILE.WALL;
      }
      if (play.route === 'puzzle' && play.levelIndex === 2 && tile === TILE.EXIT && !play.flags.bridgeOpen) {
        return TILE.WALL;
      }
      if (play.hybrid.active && tile === TILE.EXIT && !play.hybrid.portalOpen) {
        return TILE.WALL;
      }
    }
    return 0;
  }

  function detectNpcCollision(play, player) {
    return play.npcs.some((npc) => npc.solid && rectsOverlap(player, { x: npc.px, y: npc.py, w: 12, h: 14 }));
  }

  function triggerInteract() {
    if (state.screen !== 'playing' || !state.play || state.dialogue || state.overlay) {
      return;
    }
    const play = state.play;
    const nearby = findNearbyInteractive(play);
    if (!nearby) {
      pushPrompt(play, '附近暂时没有可互动的内容。');
      return;
    }

    if ((nearby.kind === 'npc' || nearby.kind === 'mechanic') && nearby.target && nearby.target.id) {
      play.bonusTracker.talkedNpcs[nearby.target.id] = true;
      updateBonusGoal(play);
    }

    if (nearby.kind === 'npc') {
      startDialogue(nearby.target.dialogues.map((text) => ({ speaker: nearby.target.name, text })));
    } else if (nearby.kind === 'item') {
      collectPuzzleItem(play, nearby.target);
    } else if (nearby.kind === 'mechanic') {
      pushPrompt(play, '这段旧互动已经被新的谜题结构替换了。');
    } else if (nearby.kind === 'clue') {
      nearby.target.found = true;
      noteCombo(play, '线索串联');
      const dialogue = [{ speaker: nearby.target.title, text: nearby.target.text }];
      if (play.route === 'puzzle' && play.levelIndex === 1) {
        dialogue.push({
          speaker: '掌机笔记',
          text: nearby.target.reliable ? `这条线索看起来比较可靠，先记为第 ${nearby.target.order + 1} 位候选。` : '这条线索有点像临时猜的，先记着，但别急着信。'
        });
      }
      startDialogue(dialogue);
    } else if (nearby.kind === 'door') {
      if (play.route === 'puzzle') {
        if (play.levelIndex === 0) {
          if (play.flags.runeSolved) {
            clearCurrentLevel('你按照提示点亮了正确符石，掌机底座顺利解锁。');
          } else {
            startDialogue([{ speaker: play.door.title || '底座', text: play.door.text || '顺序还没对上。' }]);
          }
        } else if (play.levelIndex === 1) {
          if (play.flags.mirrorSolved) {
            clearCurrentLevel('折镜把日光准确送进了锁芯，这台晴日掌机重新启动了。');
          } else {
            startDialogue([{ speaker: play.door.title || '终端', text: play.door.text || '先让日照锁亮起来。' }]);
          }
        } else {
          startDialogue([{ speaker: play.door.title || '终端', text: play.door.text || '还不能使用。' }]);
        }
      } else {
        openKeypad();
      }
    } else if (nearby.kind === 'lore') {
      nearby.target.read = true;
      noteCombo(play, '夜路残页');
      spawnBurstEffect(play, nearby.target.px + 8, nearby.target.py + 8, '#95f2ff', 7, 20);
      startDialogue([{ speaker: nearby.target.title, text: nearby.target.text }]);
    } else if (nearby.kind === 'shrine') {
      const shrineText = nearby.target.active ? '石台再次亮起，守卫脚步又慢了下来。' : nearby.target.text;
      nearby.target.active = true;
      play.guardSlowTimer = 3.5;
      noteCombo(play, '静夜点灯');
      spawnBurstEffect(play, nearby.target.px + 8, nearby.target.py + 8, '#fff2a8', 10, 28);
      startDialogue([{ speaker: nearby.target.title, text: shrineText }]);
    } else if (nearby.kind === 'seed') {
      state.routeProgress.puzzle.hasSeed = true;
      clearCurrentLevel('你拿到了神秘种子，去下一片麦田试试吧。');
    } else if (nearby.kind === 'sign') {
      activatePuzzleSign(play, nearby.target);
      startDialogue([{ speaker: '提示牌', text: nearby.target.text }]);
    } else if (nearby.kind === 'site') {
      resolveEnvironmentSite(play, nearby.target);
    } else if (nearby.kind === 'rune') {
      activateRune(play, nearby.target);
    } else if (nearby.kind === 'mirror') {
      rotateMirror(play, nearby.target);
    } else if (nearby.kind === 'valve') {
      toggleValve(play, nearby.target);
    } else if (nearby.kind === 'plot') {
      plantSeed(play, nearby.target);
    } else if (nearby.kind === 'exit') {
      clearCurrentLevel('你根据线索校准了全部水闸，顺着升起的水桥离开了麦田。');
    } else if (nearby.kind === 'portal') {
      if (play.hybrid && play.hybrid.phase === 'reward') {
        clearCurrentLevel(`你带着 ${play.inventory.backpack.length} 种战利品穿过裂隙，顺利离场。`);
      } else {
        beginHybridTransition(play);
      }
    } else if (nearby.kind === 'chest') {
      openHybridRewardChest(play);
    } else if (nearby.kind === 'loot') {
      collectHybridLoot(play, nearby.target);
    } else if (nearby.kind === 'merchant') {
      openMerchantOverlay(nearby.target);
    } else if (nearby.kind === 'grave') {
      sacrificeCompanionGrave(play, nearby.target);
    }
  }

  function collectPuzzleItem(play, item) {
    item.collected = true;
    gainCoins(1, play, item.px + 8, item.py + 8, '零件奖励');
    spawnBurstEffect(play, item.px + 8, item.py + 8, '#9cf3ff', 8, 24);
    if (!state.routeProgress.puzzle.parts.includes(item.id)) {
      state.routeProgress.puzzle.parts.push(item.id);
    }
    noteCombo(play, '零件搜集');
    const firstPickup = !state.routeProgress.puzzle.firstPickupShown;
    state.routeProgress.puzzle.firstPickupShown = true;
    const dialogue = [
      { speaker: '提示', text: `拾取成功：${item.label}` }
    ];
    if (firstPickup) {
      dialogue.push({ speaker: '教学', text: '继续靠近 NPC 或道具，再按右下角“互”键就能互动。' });
    }
    startDialogue(dialogue);
  }

  function openKeypad() {
    state.overlay = {
      type: 'keypad',
      input: '',
      maxLength: state.play && state.play.level && state.play.level.keypadCode ? state.play.level.keypadCode.length : 4
    };
  }

  function openMerchantOverlay(merchant) {
    if (!merchant || !getMerchantOffers(merchant).length) {
      return;
    }
    if (merchant === state.play.merchantSpot) {
      merchant.visits = (merchant.visits || 0) + 1;
    }
    state.overlay = {
      type: 'merchant',
      merchant
    };
  }

  function buyMerchantOffer(offerIndex) {
    const play = state.play;
    if (!play || !state.overlay || state.overlay.type !== 'merchant') {
      return;
    }
    const merchant = state.overlay.merchant;
    const offers = getMerchantOffers(merchant);
    const chosenIndex = Number.isFinite(offerIndex) ? offerIndex : 0;
    const offer = offers[chosenIndex];
    if (!merchant || !offer) {
      state.overlay = null;
      return;
    }
    if (offer.sold) {
      pushPrompt(play, '这件货已经被你拿下了，商人不肯再卖第二次。');
      return;
    }
    if (state.profile.coins < offer.price) {
      pushPrompt(play, '金币不够，神秘商人笑着收起了货。');
      return;
    }
    state.profile.coins -= offer.price;
    applyShopPurchase(play, offer.itemId);
    refreshUnlocks();
    offer.sold = true;
    const burstPoint = getMerchantWorldPoint(merchant);
    pushPrompt(play, `神秘商人交易成功：${offer.name} 已加入本关补给。`);
    spawnBurstEffect(play, burstPoint.x, burstPoint.y, '#ffe58b', 10, 24);
    const remaining = offers.filter((item) => !item.sold).length;
    if (play.randomEvent.merchant === merchant) {
      if (remaining <= 0) {
        play.randomEvent.merchant = null;
        if (play.randomEvent.current === 'merchant') {
          play.randomEvent.current = null;
        }
      } else {
        merchant.offer = offers.find((item) => !item.sold) || null;
      }
    }
    if (play.merchantSpot === merchant && remaining <= 0) {
      play.merchantSpot.active = false;
      awardAchievement('marketMind');
      pushPrompt(play, '摊位上的货被你扫空了，神秘商人满意地收摊离开。');
    }
    if (remaining <= 0) {
      state.overlay = null;
    } else {
      state.overlay = {
        type: 'merchant',
        merchant
      };
    }
    saveProgress(false);
  }

  function plantSeed(play, plot) {
    if (!state.routeProgress.puzzle.hasSeed) {
      pushPrompt(play, '你还没有拿到神秘种子。');
      return;
    }
    const order = ['sun', 'water', 'shade'];
    const need = order[play.planted.length];
    if (plot.condition !== need) {
      play.bonusTracker.wrongPlantCount += 1;
      updateBonusGoal(play);
      pushPrompt(play, '这里不太合适......这次种错会让隐藏挑战失手。');
      return;
    }
    play.planted.push(plot.condition);
    play.plantAnimations.push({ plotId: plot.id, timer: 0 });
    noteCombo(play, '芽点接力');
    spawnBurstEffect(play, plot.px + plot.w * TILE_SIZE * 0.5, plot.py + plot.h * TILE_SIZE * 0.5, '#ffe58b', 12, 26);
    pushPrompt(play, `芽点成功扎根：${plot.condition === 'sun' ? '阳光' : plot.condition === 'water' ? '水源' : '遮阴'}条件已满足。`);
    if (play.planted.length >= 3) {
      play.flags.bridgeOpen = true;
      play.level.bridgeTiles.forEach((tile) => {
        play.level.grid[tile.y][tile.x] = TILE.BRIDGE;
      });
    }
    updateBonusGoal(play);
  }

  function findNearbyInteractive(play) {
    const px = play.player.x + play.player.w * 0.5;
    const py = play.player.y + play.player.h * 0.5;
    let best = null;
    let bestDistance = 999;

    function consider(kind, target, x, y, radius) {
      const dist = distance(px, py, x, y);
      if (dist <= radius && dist < bestDistance) {
        bestDistance = dist;
        best = { kind, target };
      }
    }

    play.npcs.forEach((npc) => {
      consider('npc', npc, npc.px + 6, npc.py + 7, 22);
    });

    play.items.forEach((item) => {
      if (!item.collected) {
        consider('item', item, item.px + 8, item.py + 8, 18);
      }
    });
    play.envSites.forEach((site) => {
      if (!site.done && play.hybrid.active && play.hybrid.phase === 'explore') {
        consider('site', site, site.px + 8, site.py + 8, 20);
      }
    });
    play.runes.forEach((rune) => consider('rune', rune, rune.px + 8, rune.py + 8, 18));
    play.mirrors.forEach((mirror) => consider('mirror', mirror, mirror.px + 8, mirror.py + 8, 18));
    play.valves.forEach((valve) => consider('valve', valve, valve.px + 8, valve.py + 8, 18));
    play.clues.forEach((clue) => consider('clue', clue, clue.px + 8, clue.py + 8, 18));
    play.signs.forEach((sign) => consider('sign', sign, sign.px + 8, sign.py + 8, 18));
    play.loreMarks.forEach((mark) => consider('lore', mark, mark.px + 8, mark.py + 8, 18));
    play.shrines.forEach((shrine) => consider('shrine', shrine, shrine.px + 8, shrine.py + 8, 18));
    if (play.door) {
      consider('door', play.door, play.door.px + 8, play.door.py + 8, 18);
    }
    if (play.seedSpot && !play.seedSpot.collected && play.flags.doorOpened) {
      consider('seed', play.seedSpot, play.seedSpot.px + 8, play.seedSpot.py + 8, 18);
    }
    play.plots.forEach((plot) => {
      consider('plot', plot, plot.px + plot.w * TILE_SIZE * 0.5, plot.py + plot.h * TILE_SIZE * 0.5, 24);
    });
    if (play.randomEvent && play.randomEvent.merchant) {
      consider('merchant', play.randomEvent.merchant, play.randomEvent.merchant.x + 6, play.randomEvent.merchant.y + 7, 22);
    }
    if (play.merchantSpot && play.merchantSpot.active) {
      consider('merchant', play.merchantSpot, play.merchantSpot.px + 6, play.merchantSpot.py + 7, 22);
    }
    if (play.portalSpot && play.portalSpot.active) {
      consider('portal', play.portalSpot, play.portalSpot.px + 8, play.portalSpot.py + 8, 22);
    }
    if (play.rewardChest && play.rewardChest.active) {
      consider('chest', play.rewardChest, play.rewardChest.px + 8, play.rewardChest.py + 8, 20);
    }
    play.lootDrops.forEach((drop) => {
      consider('loot', drop, drop.x, drop.y, 18);
    });
    (play.allyGraves || []).forEach((grave) => {
      consider('grave', grave, grave.x + 6, grave.y + 8, 20);
    });
    if (play.flags.bridgeOpen && onExitTile(play)) {
      consider('exit', { id: 'bridge-exit' }, px, py, 18);
    }
    return best;
  }

  function onExitTile(play) {
    const tx = Math.floor((play.player.x + play.player.w * 0.5) / TILE_SIZE);
    const ty = Math.floor((play.player.y + play.player.h * 0.5) / TILE_SIZE);
    return tx === play.level.exit.x && ty === play.level.exit.y;
  }

  function openPauseMenu() {
    if (state.screen !== 'playing' || state.dialogue || state.overlay) {
      return;
    }
    state.overlay = {
      type: 'pause'
    };
  }

  function toggleBackpack() {
    if (state.screen !== SCREEN.PLAYING || !state.play || state.dialogue) {
      return;
    }
    if (state.overlay && state.overlay.type === 'backpack') {
      state.overlay = null;
      return;
    }
    if (state.overlay) {
      return;
    }
    state.overlay = { type: 'backpack' };
  }

  function togglePause() {
    if (state.screen !== 'playing') {
      return;
    }
    if (state.overlay && state.overlay.type === 'pause') {
      state.overlay = null;
    } else {
      openPauseMenu();
    }
  }

  function toggleGmMenu() {
    if (state.screen !== SCREEN.PLAYING || !state.play || state.dialogue) {
      return;
    }
    if (state.overlay && state.overlay.type === 'gm') {
      closeGmMenu();
      return;
    }
    state.overlay = {
      type: 'gm',
      previousOverlay: state.overlay && state.overlay.type !== 'gm' ? state.overlay : null,
      message: 'Home 可随时关闭 GM 菜单，跳关默认直接载入目标战役。'
    };
  }

  function closeGmMenu() {
    if (!state.overlay || state.overlay.type !== 'gm') {
      return;
    }
    state.overlay = state.overlay.previousOverlay || null;
  }

  function setGmMenuMessage(text) {
    if (state.overlay && state.overlay.type === 'gm') {
      state.overlay.message = text;
    }
  }

  function gmJumpToCampaignStep(step) {
    const target = clamp(step, 0, getCampaignFinalStep());
    setGmMenuMessage(`正在载入第 ${target + 1} 幕...`);
    loadCampaignStep(target, true);
  }

  function gmJumpRelative(offset) {
    const currentStep = Number.isFinite(state.play && state.play.campaignStep) ? state.play.campaignStep : 0;
    gmJumpToCampaignStep(currentStep + offset);
  }

  function gmAddCoins(amount) {
    const play = state.play;
    if (!play) {
      return;
    }
    const grant = Math.max(1, amount || 50);
    gainCoins(grant, play, play.player.x + 6, play.player.y + 7, 'GM 金币');
    setGmMenuMessage(`已发放 ${grant} 金币。`);
  }

  function gmAddExp(amount) {
    const play = state.play;
    if (!play) {
      return;
    }
    const grant = Math.max(1, amount || 12);
    gainExp(play, grant, play.player.x + 6, play.player.y + 7, 'GM 历练');
    setGmMenuMessage(`已追加 ${grant} 点经验。`);
  }

  function gmRestorePlayer() {
    const play = state.play;
    if (!play) {
      return;
    }
    play.player.hp = play.player.maxHp;
    play.inventory.shieldReady = true;
    play.player.invuln = Math.max(play.player.invuln || 0, 0.8);
    triggerFeedbackEvent(play, 'heal');
    pushPrompt(play, 'GM 生效：生命、护盾与短暂无伤已补满。');
    setGmMenuMessage('角色状态已回满，并补上护盾。');
  }

  function gmClearFieldEnemies() {
    const play = state.play;
    if (!play) {
      return;
    }
    play.guards = [];
    play.roamers = [];
    play.minibosses = [];
    play.bossMinions = [];
    play.enemyBullets = [];
    play.bossWarnings = [];
    if (play.hybrid && play.hybrid.active && play.hybrid.phase === 'field') {
      play.hybrid.pendingRoamerWaves = [];
      play.hybrid.nextRoamerWaveDelay = 0;
      play.hybrid.wavePrompted = false;
      play.hybrid.phase = 'portal';
      play.hybrid.dangerCleared = true;
      play.hybrid.exitOpen = true;
      play.hybrid.portalOpen = true;
      play.flags.exitOpen = true;
      if (play.portalSpot) {
        play.portalSpot.active = true;
      }
      if (play.merchantSpot) {
        play.merchantSpot.active = true;
      }
    }
    pushPrompt(play, 'GM 生效：当前场上的普通敌人与弹幕已清空。');
    setGmMenuMessage('已清理场上普通敌人，并打开可推进区域。');
  }

  function gmEnterBossArea() {
    const play = state.play;
    if (!play) {
      return;
    }
    if (!(play.hybrid && play.hybrid.active)) {
      setGmMenuMessage('当前关卡没有独立 Boss 区。');
      return;
    }
    if (play.hybrid.phase === 'boss' || play.hybrid.phase === 'transition') {
      setGmMenuMessage('已经在 Boss 区了。');
      return;
    }
    play.roamers = [];
    play.minibosses = [];
    play.bossMinions = [];
    play.enemyBullets = [];
    play.bossWarnings = [];
    play.hybrid.pendingRoamerWaves = [];
    play.hybrid.nextRoamerWaveDelay = 0;
    play.hybrid.wavePrompted = false;
    enterHybridBossArena(play, false);
    setGmMenuMessage('已直接切入 Boss 区。');
  }

  function gmDefeatBosses() {
    const play = state.play;
    if (!play) {
      return;
    }
    let affected = 0;
    if (play.boss && !play.boss.dying) {
      play.boss.hp = 0;
      play.boss.dying = true;
      play.boss.deathTimer = 0.01;
      affected += 1;
    }
    (play.extraBosses || []).forEach((boss) => {
      if (!boss || boss.dying) {
        return;
      }
      boss.hp = 0;
      boss.dying = true;
      boss.deathTimer = 0.01;
      affected += 1;
    });
    play.bossMinions = [];
    play.enemyBullets = [];
    play.bossWarnings = [];
    if (play.hybrid) {
      play.hybrid.bossWaveQueue = [];
      play.hybrid.bossWaveTimer = 0;
      play.hybrid.bossWaveTotal = play.hybrid.bossWaveIndex;
    }
    if (affected > 0) {
      pushPrompt(play, 'GM 生效：当前 Boss 波次已被直接终结。');
      setGmMenuMessage(`已结算 ${affected} 个 Boss 目标。`);
    } else {
      setGmMenuMessage('当前没有可击杀的 Boss。');
    }
  }

  function gmGrantBombGearNow() {
    if (!state.play) {
      return;
    }
    grantBombGear(state.play, 'GM 特装');
    setGmMenuMessage('已激活追踪爆炸弹特装。');
  }

  function gmGrantEmberGearNow() {
    if (!state.play) {
      return;
    }
    grantEmberGear(state.play, 'GM 特装');
    setGmMenuMessage('已激活近身焚击特装。');
  }

  function restartCurrentLevel() {
    if (!state.play) {
      return;
    }
    if (Number.isFinite(state.play.campaignStep)) {
      loadCampaignStep(state.play.campaignStep, true);
      return;
    }
    loadLevel(state.play.route, state.play.levelIndex, true);
  }

  function clearCurrentLevel(summary) {
    const play = state.play;
    setScreen(SCREEN.SETTLEMENT);
    const campaignFinal = Number.isFinite(play.campaignStep) && play.campaignStep >= getCampaignFinalStep();
    const finalLevel = Number.isFinite(play.campaignStep) ? campaignFinal : play.levelIndex === 2;
    const rating = computeLevelRating(play);
    updateBonusGoal(play);
    const bonusReward = play.bonusGoal && play.bonusGoal.done ? play.bonusGoal.reward : 0;
    const rewardCoins = (finalLevel ? 10 : 4) + bonusReward;
    const rewardExp = 6 + (finalLevel ? 4 : 0) + Math.min(4, play.hybrid && play.hybrid.active ? play.hybrid.defeatedMinibosses : 0);
    state.settlement = {
      title: play.level.name,
      summary,
      route: play.route,
      campaignStep: Number.isFinite(play.campaignStep) ? play.campaignStep : null,
      final: finalLevel,
      rating,
      rewardCoins,
      rewardExp,
      ratingSummary: getRatingSummary(rating, play.route),
      bestRating: getBestStoredRating(play.route, play.levelIndex),
      bonusGoal: play.bonusGoal ? { ...play.bonusGoal } : null,
      shareLine: getShareLine({ route: play.route, rating })
    };
    if (!finalLevel) {
      state.routeProgress[play.route].currentLevel = play.levelIndex + 1;
    } else {
      state.routeProgress[play.route].cleared = true;
    }
    if (play.route === 'battle' && play.run.damageTaken === 0) {
      awardAchievement('perfectSneak');
    }
    state.profile.coins += rewardCoins;
    state.profile.totalExp += rewardExp;
    state.profile.supportLevel = Math.max(state.profile.supportLevel || 1, Math.floor(state.profile.totalExp / 18) + 1);
    storeBestRating(play.route, play.levelIndex, rating);
    checkProgressAchievements();
    refreshUnlocks();
    state.settlement.bestRating = getBestStoredRating(play.route, play.levelIndex);
    state.settlement.totalRatingScore = getTotalRatingScore();
    state.settlement.galleryUnlockCount = getGalleryUnlockCount();
    state.settlement.nextGalleryThreshold = getNextGalleryThreshold();
    if (Number.isFinite(play.campaignStep)) {
      state.profile.continueData = finalLevel ? null : { route: play.route, levelIndex: play.levelIndex, campaignStep: play.campaignStep + 1 };
    } else {
      state.profile.continueData = finalLevel ? null : { route: play.route, levelIndex: state.routeProgress[play.route].currentLevel };
    }
    saveProgress(false);
  }

  function continueAfterSettlement() {
    const info = state.settlement;
    if (!info) {
      return;
    }
    if (info.final) {
      beginEaster();
    } else {
      if (Number.isFinite(info.campaignStep)) {
        loadCampaignStep(info.campaignStep + 1, false);
        return;
      }
      loadLevel(info.route, state.routeProgress[info.route].currentLevel, false);
    }
  }

  function beginEaster() {
    startEasterScene(false);
  }

  function createEasterState() {
    return {
      stage: 0,
      freezeTimer: 0,
      wip: false,
      mode: 'intro',
      timer: 0,
      answerChosen: null,
      resultText: '',
      resultTimer: 0,
      wrongPulse: 0,
      chips: [],
      bursts: [],
      shockwaves: [],
      chipId: 0,
      spawnTimer: 0.7,
      arcadeTimer: 22,
      jiaMeter: 0,
      yiMeter: 0,
      harmony: 0,
      tension: 8,
      harmonyGoal: 96,
      chipGoal: 54,
      finaleTimer: 0,
      wordTimer: 0,
      finaleWordIndex: 0,
      completed: false,
      revealText: '因为医生是个湖南医生。\n“拔个牙喽！”'
    };
  }

  function startEasterScene(shortIntro) {
    setScreen(SCREEN.EASTER);
    clearTransientState();
    state.play = null;
    state.settlement = null;
    state.profile.continueData = null;
    state.easter = createEasterState();
    const introQueue = shortIntro
      ? [
        { speaker: '乙小孩', text: '来都来了，这次不打 Boss 了，先在麦田里分个胜负。' },
        { speaker: '甲小孩', text: '你想玩闯关和解密，我想玩对战和恐怖，那就按老规矩，比脑筋急转弯。' },
        { speaker: '旧像素掌机', text: '掌机屏幕发亮了，像在等你把两个玩法塞进同一局彩蛋里。' }
      ]
      : [
        { speaker: '旁白', text: '风吹稻花麦浪香，甲小孩和乙小孩并肩坐在麦田里，捧着一台旧旧的像素游戏机。' },
        { speaker: '甲小孩', text: '我要玩对战和恐怖，最好一上来就能打，还要有点吓人的东西。' },
        { speaker: '乙小孩', text: '我偏要玩闯关和解密，不如用古老办法解决争端，谁猜不出脑筋急转弯谁就输。' },
        { speaker: '旧像素掌机', text: '屏幕里的像素雪花一闪一闪，像在催你把两边的愿望都玩出来。' }
      ];
    startDialogue(introQueue, () => {
      if (state.easter) {
        state.easter.mode = 'riddle';
      }
    });
  }

  function answerEasterRiddle(answerId) {
    const easter = state.easter;
    if (!easter || easter.mode !== 'riddle' || easter.resultTimer > 0) {
      return;
    }
    easter.answerChosen = answerId;
    easter.resultTimer = 1.2;
    if (answerId === 'tooth') {
      easter.resultText = '甲先愣住，随后整片麦田一起憋笑。就是这句。';
      easter.stage = 1;
      spawnEasterShockwave(180, 270, '#9edcff', 62, 98);
      spawnEasterShockwave(180, 270, '#ffd0ef', 46, 82);
      spawnEasterBurst(180, 268, '#8fd8ff', 12, null, 11);
      spawnEasterBurst(180, 268, '#ffd0ef', 10, '哈', 12);
    } else {
      easter.resultText = '甲还是没猜到，乙把掌机往前一推：再想想，是一句会让人误会的第一句话。';
      easter.wrongPulse = 0.9;
    }
  }

  function startEasterArcade() {
    const easter = state.easter;
    if (!easter) {
      return;
    }
    easter.mode = 'arcade';
    easter.resultTimer = 0;
    easter.answerChosen = null;
    easter.jiaMeter = 12;
    easter.yiMeter = 12;
    easter.tension = 8;
    easter.harmony = 0;
    easter.arcadeTimer = 22;
    easter.spawnTimer = 0.55;
    easter.chips = [];
    easter.bursts = [];
    easter.shockwaves = [];
    startDialogue([
      { speaker: '乙小孩', text: '既然你笑出来了，那就继续第二回合，把对战、恐怖、闯关、解密全塞进一台掌机。' },
      { speaker: '甲小孩', text: '行，只要别让我只解题不动手。' },
      { speaker: '旧像素掌机', text: '轻触飞出来的模式芯片，左右口味都喂饱，别让噪点把画面撕裂。' }
    ]);
  }

  function spawnEasterChip() {
    const easter = state.easter;
    if (!easter) {
      return;
    }
    const lanes = [100, 140, 220, 260];
    const roll = Math.random();
    let type = 'battle';
    if (roll < 0.2) type = 'battle';
    else if (roll < 0.4) type = 'horror';
    else if (roll < 0.62) type = 'run';
    else if (roll < 0.84) type = 'puzzle';
    else type = 'glitch';
    const owner = (type === 'battle' || type === 'horror') ? 'jia' : (type === 'run' || type === 'puzzle' ? 'yi' : 'noise');
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    easter.chips.push({
      id: `chip-${easter.chipId += 1}`,
      x: lane + (Math.random() * 8 - 4),
      y: 210,
      vx: Math.random() * 10 - 5,
      vy: 58 + Math.random() * 24,
      phase: Math.random() * Math.PI * 2,
      type,
      owner,
      size: type === 'glitch' ? 15 : 14
    });
  }

  function spawnEasterShockwave(x, y, color, radius, speed) {
    const easter = state.easter;
    if (!easter) {
      return;
    }
    easter.shockwaves.push({
      x,
      y,
      radius: radius || 24,
      speed: speed || 82,
      alpha: 0.78,
      color: color || '#8fd8ff'
    });
  }

  function spawnEasterBurst(x, y, color, count, text, size) {
    const easter = state.easter;
    if (!easter) {
      return;
    }
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / Math.max(1, count) + Math.random() * 0.28;
      const speed = 26 + Math.random() * 38;
      easter.bursts.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (text ? 14 : 0),
        life: text ? 0.95 : 0.72,
        maxLife: text ? 0.95 : 0.72,
        gravity: text ? 10 : 22,
        color,
        text: text || null,
        size: size || 10
      });
    }
  }

  function tapEasterChip(id) {
    const easter = state.easter;
    if (!easter || easter.mode !== 'arcade') {
      return;
    }
    const chipIndex = easter.chips.findIndex((entry) => entry.id === id);
    if (chipIndex < 0) {
      return;
    }
    const chip = easter.chips[chipIndex];
    easter.chips.splice(chipIndex, 1);
    if (chip.owner === 'noise') {
      easter.tension = Math.min(40, easter.tension + 11);
      spawnEasterShockwave(chip.x, chip.y, '#ff9db8', 16, 104);
      spawnEasterBurst(chip.x, chip.y, '#ff9db8', 8, '噪', 10);
      return;
    }
    const meterDiff = easter.jiaMeter - easter.yiMeter;
    if (chip.owner === 'jia') {
      easter.jiaMeter = Math.min(84, easter.jiaMeter + (meterDiff < 0 ? 9 : 7));
      if (meterDiff > 12) {
        easter.tension = Math.min(40, easter.tension + 3);
      } else {
        easter.tension = Math.max(0, easter.tension - 2.5);
      }
    } else {
      easter.yiMeter = Math.min(84, easter.yiMeter + (meterDiff > 0 ? 9 : 7));
      if (meterDiff < -12) {
        easter.tension = Math.min(40, easter.tension + 3);
      } else {
        easter.tension = Math.max(0, easter.tension - 2.5);
      }
    }
    spawnEasterShockwave(chip.x, chip.y, chip.owner === 'jia' ? '#ffc8de' : '#98e2ff', 18, 88);
    spawnEasterBurst(chip.x, chip.y, chip.owner === 'jia' ? '#ffbdd7' : '#9ce2ff', 8, null, 10);
  }

  function finishEasterArcade() {
    const easter = state.easter;
    if (!easter || easter.mode === 'finale') {
      return;
    }
    easter.mode = 'finale';
    easter.stage = 2;
    easter.finaleTimer = 0;
    easter.wordTimer = 0;
    easter.finaleWordIndex = 0;
    easter.completed = true;
    easter.chips = [];
    awardAchievement('truth');
    saveProgress(false);
    spawnEasterShockwave(180, 250, '#8fd8ff', 26, 122);
    spawnEasterShockwave(180, 250, '#ffd2f3', 18, 104);
    startDialogue([
      { speaker: '乙小孩', text: '答案就是“拔个牙”。' },
      { speaker: '甲小孩', text: '原来如此，我卡住的是后半句。' },
      { speaker: '乙小孩', text: '因为医生是个湖南医生，所以他说的是: 拔个牙喽！' }
    ]);
  }

  function retryEasterArcade() {
    const easter = state.easter;
    if (!easter) {
      return;
    }
    easter.mode = 'arcade';
    easter.arcadeTimer = 22;
    easter.spawnTimer = 0.45;
    easter.jiaMeter = 12;
    easter.yiMeter = 12;
    easter.tension = 8;
    easter.harmony = 0;
    easter.chips = [];
    easter.bursts = [];
    easter.shockwaves = [];
  }

  function updateEaster(delta) {
    const easter = state.easter;
    if (!easter) {
      return;
    }
    easter.timer += delta;
    easter.wrongPulse = Math.max(0, easter.wrongPulse - delta);
    easter.bursts = easter.bursts.filter((burst) => {
      burst.life -= delta;
      burst.x += burst.vx * delta;
      burst.y += burst.vy * delta;
      burst.vy += (burst.gravity || 0) * delta;
      return burst.life > 0;
    });
    easter.shockwaves = easter.shockwaves.filter((wave) => {
      wave.radius += wave.speed * delta;
      wave.alpha -= delta * 0.58;
      return wave.alpha > 0;
    });
    if (easter.mode === 'riddle') {
      if (easter.resultTimer > 0) {
        easter.resultTimer -= delta;
        if (easter.resultTimer <= 0 && easter.answerChosen === 'tooth') {
          startEasterArcade();
        }
      }
      return;
    }
    if (easter.mode === 'arcade') {
      easter.arcadeTimer = Math.max(0, easter.arcadeTimer - delta);
      easter.spawnTimer -= delta;
      easter.tension = Math.max(0, easter.tension - delta * 1.8);
      if (easter.spawnTimer <= 0) {
        spawnEasterChip();
        if (Math.random() < 0.35) {
          spawnEasterChip();
        }
        easter.spawnTimer = 0.45 + Math.random() * 0.34;
      }
      for (let i = easter.chips.length - 1; i >= 0; i -= 1) {
        const chip = easter.chips[i];
        chip.y += chip.vy * delta;
        chip.x += Math.sin(easter.timer * 2.2 + chip.phase) * 18 * delta + chip.vx * delta;
        if (chip.y > 414) {
          if (chip.owner === 'jia') {
            easter.jiaMeter = Math.max(0, easter.jiaMeter - 5);
            easter.tension = Math.min(40, easter.tension + 4);
          } else if (chip.owner === 'yi') {
            easter.yiMeter = Math.max(0, easter.yiMeter - 5);
            easter.tension = Math.min(40, easter.tension + 4);
          } else {
            easter.tension = Math.min(40, easter.tension + 6);
          }
          easter.chips.splice(i, 1);
        }
      }
      const equalFill = Math.min(easter.jiaMeter, easter.yiMeter);
      const fillScore = clamp(equalFill / easter.chipGoal, 0, 1);
      const balanceScore = 1 - clamp(Math.abs(easter.jiaMeter - easter.yiMeter) / 38, 0, 1);
      const calmScore = 1 - clamp(easter.tension / 36, 0, 1);
      easter.harmony = Math.round(clamp(fillScore * 0.62 + balanceScore * 0.24 + calmScore * 0.14, 0, 1) * 100);
      if (equalFill >= easter.chipGoal && easter.harmony >= easter.harmonyGoal) {
        finishEasterArcade();
        return;
      }
      if (easter.arcadeTimer <= 0) {
        easter.mode = 'arcade-fail';
        easter.chips = [];
      }
      return;
    }
    if (easter.mode === 'finale') {
      easter.finaleTimer += delta;
      easter.wordTimer -= delta;
      if (easter.wordTimer <= 0) {
        const words = ['拔', '个', '牙', '喽', '哈', '哈'];
        const word = words[easter.finaleWordIndex % words.length];
        easter.finaleWordIndex += 1;
        spawnEasterShockwave(180, 250, word === '哈' ? '#ffd59b' : '#8fd8ff', 18 + (word === '哈' ? 4 : 0), 118);
        spawnEasterBurst(180 + Math.random() * 70 - 35, 250 + Math.random() * 36 - 18, word === '哈' ? '#ffd59b' : '#ffd2f3', 1, word, 16);
        easter.wordTimer = easter.finaleTimer < 3 ? 0.32 : 0.5;
      }
    }
  }

  function openCredits(backTarget) {
    if (state.screen === SCREEN.EASTER && state.easter && !state.easter.wip) {
      awardAchievement('truth');
    }
    setScreen(SCREEN.CREDITS, {
      menuBack: backTarget || ((state.screen === SCREEN.PLAYING || state.menuBack === 'pause') ? 'pause' : state.screen)
    });
    state.easter = null;
    state.dialogue = null;
    saveProgress(false);
  }

  function openAchievements(backTarget) {
    refreshUnlocks();
    setScreen(SCREEN.ACHIEVEMENTS, {
      menuBack: backTarget || (state.screen === SCREEN.PLAYING ? 'pause' : state.screen)
    });
  }

  function openGallery(backTarget) {
    refreshUnlocks();
    setScreen(SCREEN.GALLERY, {
      menuBack: backTarget || (state.screen === SCREEN.PLAYING ? 'pause' : state.screen)
    });
  }

  function returnFromMenu() {
    if (state.menuBack === 'pause' && state.play) {
      setScreen(SCREEN.PLAYING);
      state.overlay = { type: 'pause' };
      return;
    }
    if (state.menuBack === SCREEN.ROUTE_SELECT) {
      setScreen(SCREEN.ROUTE_SELECT);
      return;
    }
    resetToTitle();
  }

  function resetToTitle() {
    setScreen(SCREEN.TITLE, { menuBack: SCREEN.TITLE });
    clearTransientState();
    state.play = null;
    restoreRouteProgress(state.profile.routeProgress);
  }

  function loadRoute(route) {
    loadCampaignStep(0, false);
  }

  function loadCampaignStep(step, isRestart) {
    const info = getCampaignStepInfo(step);
    if (!info) {
      return;
    }
    if (info.route === 'easter') {
      startEasterScene(true);
      saveProgress(false);
      return;
    }
    loadLevel(info.route, info.index, isRestart, step);
  }

  function loadLevel(route, index, isRestart, campaignStep) {
    const level = window.GameMaps.cloneLevel(route, index);
    setScreen(SCREEN.PLAYING);
    clearTransientState();
    state.profile.continueData = Number.isFinite(campaignStep)
      ? { route, levelIndex: index, campaignStep }
      : { route, levelIndex: index };
    state.play = createPlayState(route, index, level);
    state.play.campaignStep = Number.isFinite(campaignStep) ? campaignStep : null;
    updateCamera(state.play);
    updateDiscovery(state.play);
    saveProgress(false);

    if (!isRestart) {
      state.overlay = {
        type: 'shop',
        bought: {},
        offers: createCampaignSupplyOffers(state.play, 5),
        message: Number.isFinite(campaignStep)
          ? `${getCampaignStageLabel(campaignStep, level.progress)} 的补给摊已经摆好了`
          : '战役补给已开启',
        pendingIntro: level.intro && level.intro.length ? level.intro.slice() : null
      };
    } else if (level.intro && level.intro.length) {
      startDialogue(level.intro);
    }
  }

  function resetPlayerToStart(play) {
    play.player.x = play.level.start.x * TILE_SIZE + 2;
    play.player.y = play.level.start.y * TILE_SIZE + 1;
    updateCamera(play);
  }

  function angleToPlayer(play, x, y) {
    return Math.atan2((play.player.y + 7) - y, (play.player.x + 6) - x);
  }

  function getFacingVector(facing) {
    return facing === 'left' ? { x: -1, y: 0 } :
      facing === 'right' ? { x: 1, y: 0 } :
        facing === 'up' ? { x: 0, y: -1 } : { x: 0, y: 1 };
  }

  function getGuardVisionAngle(guard) {
    return guard.mode === 'chase' ? Math.PI : (guard.mode === 'suspicious' ? (Math.PI * 2) / 3 : Math.PI / 2);
  }

  function getGuardVisionRadius(guard) {
    return guard.mode === 'chase' ? 88 : 80;
  }

  function moveGuard(play, guard, dx, dy) {
    moveGuardAxis(play, guard, 'x', dx);
    moveGuardAxis(play, guard, 'y', dy);
  }

  function moveGuardAxis(play, guard, axis, amount) {
    guard[axis] += amount;
    if (detectTileCollision(play, { x: guard.x, y: guard.y, w: 12, h: 14 })) {
      guard[axis] -= amount;
    }
  }

  function faceTarget(guard, dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) {
      guard.facing = dx >= 0 ? 'right' : 'left';
    } else if (Math.abs(dy) > 0.001) {
      guard.facing = dy >= 0 ? 'down' : 'up';
    }
  }

  function getGuardMode(alert) {
    return alert >= 70 ? 'chase' : (alert >= 30 ? 'suspicious' : 'patrol');
  }

  function getGuardModeLabel(mode) {
    return mode === 'chase' ? '追击中' : (mode === 'suspicious' ? '警觉中' : (mode === 'stunned' ? '晕眩中' : '巡逻中'));
  }

  function pushPrompt(play, text) {
    play.prompt = text;
    play.promptTimer = 1.6;
  }

  function noteCombo(play, label) {
    play.comboCount = play.comboTimer > 0 ? play.comboCount + 1 : 1;
    play.comboTimer = 3.2;
    play.comboBest = Math.max(play.comboBest, play.comboCount);
    if (play.comboCount >= 2) {
      pushPrompt(play, `${label}连携 x${play.comboCount}`);
    }
  }

  function triggerDash() {
    if (state.screen !== 'playing' || !state.play || state.dialogue || state.overlay) {
      return;
    }
    const play = state.play;
    if (play.player.dashCooldown > 0) {
      return;
    }
    const input = readMoveInput();
    let dashDx = input.dx;
    let dashDy = input.dy;
    if (dashDx === 0 && dashDy === 0) {
      const facingMap = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 }
      };
      dashDx = facingMap[play.player.facing].x;
      dashDy = facingMap[play.player.facing].y;
    }
    const startX = play.player.x + 6;
    const startY = play.player.y + 7;
    play.player.dashCooldown = 2.8;
    for (let step = 0; step < 6; step += 1) {
      spawnTrailEffect(play, play.player.x + 6, play.player.y + 7, play.route === 'battle' ? '#9cf3ff' : '#ffe58b');
      movePlayer(play, dashDx * 8, dashDy * 8);
    }
    const endX = play.player.x + 6;
    const endY = play.player.y + 7;
    spawnBurstEffect(play, play.player.x + 6, play.player.y + 7, play.route === 'battle' ? '#9cf3ff' : '#ffe58b', 6, 26);
    spawnTextEffect(play, endX, endY - 10, '突进', '#dff8ff', 12, -18, 0.6);
    if (Math.random() < getDashCataclysmChance(play)) {
      play.feedback.skySlash = 0.24;
      play.feedback.skySlashAngle = Math.atan2(dashDy, dashDx);
      spawnTextEffect(play, endX, endY - 24, '裂闪清屏', '#fff3a8', 16, -20, 0.82);
      play.roamers.forEach((roamer) => {
        if (roamer.hp > 0) {
          finishDirectEnemyStrike(play, roamer, 'roamer', Math.max(roamer.hp, 24 + getCampaignMutationTier(play) * 6), false, roamer.x + 6, roamer.y + 6, roamer.reward || 3, '清场推进', '#d6f6ff', 1);
          trySpawnEnemyDrop(play, roamer, 'roamer');
        }
      });
      play.bossMinions.forEach((minion) => {
        if (minion.hp > 0) {
          finishDirectEnemyStrike(play, minion, 'bossMinion', Math.max(minion.hp, 22), false, minion.x + 7, minion.y + 6, 0, '战场清理', '#d6f6ff', 1);
        }
      });
      play.minibosses.forEach((mini) => {
        if (mini.hp > 0) {
          const strike = rollWeaponStrike(play, 20 + getCampaignMutationTier(play) * 5, 'miniboss');
          finishDirectEnemyStrike(play, mini, 'miniboss', strike.damage, strike.critical, mini.x + 7, mini.y + 7, mini.reward || 8, '头目压制', '#d6f6ff', 1.08);
          if (mini.hp <= 0) {
            trySpawnEnemyDrop(play, mini, 'miniboss');
          }
        }
      });
      if (play.boss && !play.boss.dying && (!play.boss.spawnTimer || play.boss.spawnTimer <= 0)) {
        const strike = rollWeaponStrike(play, 18 + getCampaignMutationTier(play) * 8, 'boss');
        play.boss.hp = Math.max(0, play.boss.hp - strike.damage);
        setHitFlash(play.boss, 1.16);
        spawnBurstEffect(play, play.boss.x + 16, play.boss.y + 16, '#e8f6ff', 14, 28);
      }
      pushPrompt(play, '突进触发了裂闪异变，整片场地被扫了一刀。');
      return;
    }
    pushPrompt(play, '掌机推进器启动，快速滑行了一段距离。');
  }

  function updateGuardAlert(play, guard, delta) {
    if (guard.stunTimer > 0) {
      guard.alert = 0;
      guard.canSeePlayer = false;
      guard.mode = 'stunned';
      return 0;
    }
    const guardCenterX = guard.x + 6;
    const guardCenterY = guard.y + 7;
    const playerCenterX = play.player.x + 6;
    const playerCenterY = play.player.y + 7;
    const dist = distance(guardCenterX, guardCenterY, playerCenterX, playerCenterY);
    const facingVec = getFacingVector(guard.facing);
    const dirX = playerCenterX - guardCenterX;
    const dirY = playerCenterY - guardCenterY;
    const dirLen = Math.max(1, Math.hypot(dirX, dirY));
    const nx = dirX / dirLen;
    const ny = dirY / dirLen;
    const dot = clamp(nx * facingVec.x + ny * facingVec.y, -1, 1);
    const concealed = isPlayerInTallGrass(play);
    const halfAngle = getGuardVisionAngle(guard) * 0.5;
    const angleDiff = Math.acos(dot);
    const canSee = !concealed &&
      dist <= getGuardVisionRadius(guard) &&
      angleDiff <= halfAngle &&
      hasLineOfSight(play.level.grid, guardCenterX, guardCenterY, playerCenterX, playerCenterY);
    let alert = guard.alert || 0;
    if (canSee) {
      alert += delta * 30;
      guard.lastSeenX = play.player.x;
      guard.lastSeenY = play.player.y;
      guard.searchTimer = 1.6;
    } else if (dist < 18 && !concealed) {
      alert += delta * 22;
      guard.lastSeenX = play.player.x;
      guard.lastSeenY = play.player.y;
      guard.searchTimer = 1;
    } else {
      guard.searchTimer = Math.max(0, (guard.searchTimer || 0) - delta);
      alert -= delta * (concealed ? 28 : 18);
    }
    guard.alert = clamp(alert, 0, 100);
    guard.canSeePlayer = canSee;
    guard.mode = getGuardMode(guard.alert);
    if (guard.mode !== 'chase' && guard.searchTimer > 0.01 && guard.alert >= 30) {
      guard.mode = 'suspicious';
    }
    return guard.alert;
  }

  function stunGuard(play, guard, sourceLabel, effectColor) {
    if (!guard || (guard.hitTimer || 0) > 0) {
      return false;
    }
    guard.hitTimer = 0.24;
    guard.stunTimer = Math.max(guard.stunTimer || 0, 2.1);
    guard.alert = 0;
    guard.searchTimer = 0;
    guard.canSeePlayer = false;
    guard.mode = 'stunned';
    guard.lastSeenX = guard.x;
    guard.lastSeenY = guard.y;
    spawnBurstEffect(play, guard.x + 6, guard.y + 7, effectColor || '#9cf3ff', 8, 22);
    noteCombo(play, '压制守卫');
    pushPrompt(play, `${sourceLabel || '攻击'}打断了守卫，它短时间内起不来。`);
    return true;
  }

  function buildGuardPatrol(grid, anchors) {
    if (!anchors || anchors.length < 2) {
      return anchors || [];
    }
    const patrol = [anchors[0]];
    for (let i = 0; i < anchors.length; i += 1) {
      const from = anchors[i];
      const to = anchors[(i + 1) % anchors.length];
      const segment = findTilePath(grid, from, to);
      for (let j = 1; j < segment.length; j += 1) {
        patrol.push(segment[j]);
      }
    }
    return patrol.length ? patrol : anchors.slice();
  }

  function findTilePath(grid, start, end) {
    const queue = [start];
    const visited = new Set([`${start.x},${start.y}`]);
    const parent = new Map();
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ];
    while (queue.length) {
      const node = queue.shift();
      if (node.x === end.x && node.y === end.y) {
        const path = [end];
        let key = `${end.x},${end.y}`;
        while (parent.has(key)) {
          const prev = parent.get(key);
          path.push(prev);
          key = `${prev.x},${prev.y}`;
        }
        return path.reverse();
      }
      dirs.forEach((dir) => {
        const next = { x: node.x + dir.x, y: node.y + dir.y };
        const key = `${next.x},${next.y}`;
        if (visited.has(key) || !isGuardWalkableTile(grid, next.x, next.y)) {
          return;
        }
        visited.add(key);
        parent.set(key, node);
        queue.push(next);
      });
    }
    return [start, end];
  }

  function isGuardWalkableTile(grid, x, y) {
    const tile = getTile(grid, x, y);
    return ![TILE.WALL, TILE.WATER, TILE.SHADOW].includes(tile);
  }

  function hasLineOfSight(grid, x1, y1, x2, y2) {
    const steps = Math.max(6, Math.ceil(distance(x1, y1, x2, y2) / 4));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const sx = x1 + (x2 - x1) * t;
      const sy = y1 + (y2 - y1) * t;
      const tile = getTile(grid, Math.floor(sx / TILE_SIZE), Math.floor(sy / TILE_SIZE));
      if ([TILE.WALL, TILE.WATER, TILE.SHADOW].includes(tile)) {
        return false;
      }
    }
    return true;
  }

  function isPlayerInTallGrass(play) {
    if (play.route !== 'battle' || play.levelIndex !== 1) {
      return false;
    }
    const tx = Math.floor((play.player.x + play.player.w * 0.5) / TILE_SIZE);
    const ty = Math.floor((play.player.y + play.player.h * 0.5) / TILE_SIZE);
    return getTile(play.level.grid, tx, ty) === TILE.WHEAT;
  }

  function findHitArea(point) {
    for (let index = state.hitAreas.length - 1; index >= 0; index -= 1) {
      const area = state.hitAreas[index];
      if (area.shape === 'rect') {
        if (point.x >= area.x && point.x <= area.x + area.w && point.y >= area.y && point.y <= area.y + area.h) {
          return area;
        }
      } else if (distance(point.x, point.y, area.x, area.y) <= area.r) {
        return area;
      }
    }
    return null;
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, '#dff6f6');
    bg.addColorStop(0.55, '#f7fbff');
    bg.addColorStop(1, '#eef8ef');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(layout.scale * dpr, 0, 0, layout.scale * dpr, layout.offsetX * dpr, layout.offsetY * dpr);
    state.hitAreas = [];
    try {
      if (state.screen === SCREEN.TITLE) {
        drawTitle();
      } else if (state.screen === SCREEN.ROUTE_SELECT) {
        drawRouteSelect();
      } else if (state.screen === SCREEN.PLAYING) {
        drawPlaying();
      } else if (state.screen === SCREEN.SETTLEMENT) {
        drawSettlement();
      } else if (state.screen === SCREEN.EASTER) {
        drawEaster();
      } else if (state.screen === SCREEN.ACHIEVEMENTS) {
        drawAchievements();
      } else if (state.screen === SCREEN.GALLERY) {
        drawGallery();
      } else if (state.screen === SCREEN.CREDITS) {
        drawCredits();
      }
      if (state.dialogue) {
        drawDialogue();
      }
      if (state.overlay) {
        if (state.overlay.type === 'pause') {
          drawPauseMenu();
        } else if (state.overlay.type === 'gm') {
          drawGmMenu();
        } else if (state.overlay.type === 'keypad') {
          drawKeypad();
        } else if (state.overlay.type === 'shop') {
          drawShopOverlay();
        } else if (state.overlay.type === 'merchant') {
          drawMerchantOverlay();
        } else if (state.overlay.type === 'backpack') {
          drawBackpackOverlay();
        } else if (state.overlay.type === 'death') {
          drawDeathOverlay();
        }
      }
      if (state.achievementBanner) {
        drawAchievementBanner();
      }
    } catch (error) {
      console.error(error);
      lastFatalMessage = error && (error.message || String(error)) ? String(error.message || error) : '未知错误';
      drawEmergencyHome();
    }
  }

  function drawEmergencyHome() {
    ctx.setTransform(layout.scale * dpr, 0, 0, layout.scale * dpr, layout.offsetX * dpr, layout.offsetY * dpr);
    state.hitAreas = [];
    Sprite.rect(ctx, 0, 0, BASE_WIDTH, BASE_HEIGHT, '#f6fbff');
    Sprite.rect(ctx, 0, 350, BASE_WIDTH, 290, '#f3e2a1');
    Sprite.frame(ctx, 24, 78, 312, 264, '#fffef9', '#d6c7af');
    Sprite.label(ctx, '秘野破关行', 180, 106, '#5a5048', 24, 'center');
    Sprite.label(ctx, '安全回退首页', 180, 138, '#7b7368', 12, 'center');
    Sprite.label(ctx, '主界面绘制时出现异常，已临时切到可操作页面。', 180, 176, '#6f685f', 10, 'center');
    Sprite.label(ctx, '你现在至少可以继续进入战役总览，不会整页发白。', 180, 194, '#6f685f', 10, 'center');
    Sprite.frame(ctx, 48, 226, 264, 46, '#fff7e8', '#d6c7af');
    Sprite.label(ctx, `错误: ${lastFatalMessage.slice(0, 30)}`, 58, 238, '#8c5e58', 9, 'left');
    Sprite.label(ctx, '我会继续把主 UI 异常查干净。', 58, 254, '#8c7a68', 9, 'left');
    Sprite.frame(ctx, 94, 292, 172, 42, '#a8e6c3', '#d6c7af');
    Sprite.label(ctx, '进入战役', 180, 304, '#fffdf7', 14, 'center');
    state.hitAreas.push({ shape: 'rect', x: 94, y: 292, w: 172, h: 42, kind: 'tap', action: () => setScreen(SCREEN.ROUTE_SELECT) });
  }

  function drawTitle() {
    const ui = getGlobalUiTheme();
    drawSky('day');
    drawFieldBackdrop('day');
    drawKidsReality();
    drawMenuShell('秘野破关行', 'MIYE BREAKTHROUGH');
    const floatY = Math.sin(state.time * 1.6) * 2;
    drawPaperCard(24, 76, 312, 122, ui.panel, ui.shellBorder, ui.shadow);
    drawSticker(40, 64, 72, 18, '新版战役', ui.blue, '#4f463e', ui.stickerBorder);
    Sprite.label(ctx, '秘野破关行', 180, 92, ui.text, 30, 'center');
    Sprite.label(ctx, '清场、探索、机关、异变装备与裂隙 Boss 连锁战役', 180, 126, ui.softText, 12, 'center');
    drawUiAccentLine(54, 148, 252, ui.accent);
    drawIconTile(56, 160, 22, '#fffaf0', ui.stickerBorder, 'sword');
    drawIconTile(126, 160, 22, '#fffaf0', ui.stickerBorder, 'map');
    drawIconTile(196, 160, 22, '#fffaf0', ui.stickerBorder, 'shop');
    drawIconTile(266, 160, 22, '#fffaf0', ui.stickerBorder, 'coin');
    Sprite.label(ctx, '近战', 67, 184, ui.text, 10, 'center');
    Sprite.label(ctx, '探索', 137, 184, ui.text, 10, 'center');
    Sprite.label(ctx, '交易', 207, 184, ui.text, 10, 'center');
    Sprite.label(ctx, '金币', 277, 184, ui.text, 10, 'center');

    drawPaperCard(24, 214, 312, 92, ui.panelSoft, ui.shellBorder, ui.shadow);
    drawSectionTag(40, 206, '核心流程', ui, 'blue');
    Sprite.label(ctx, '1. 先贴身清怪稳住场面', 42, 234, ui.text, 13, 'left');
    Sprite.label(ctx, '2. 打开大地图去做环境点和神秘商人', 42, 256, ui.text, 13, 'left');
    Sprite.label(ctx, '3. 临时买装备、改节奏，再推进下一幕', 42, 278, ui.text, 13, 'left');

    drawPaperCard(24, 322 + floatY, 150, 98, '#eef8ff', ui.blue, ui.shadow);
    drawSectionTag(38, 314 + floatY, '危险区', ui, 'blue');
    Sprite.label(ctx, '近战打断', 50, 346 + floatY, ui.text, 15, 'left');
    Sprite.label(ctx, '压迫 / 异常 / 反打', 50, 370 + floatY, ui.softText, 10, 'left');
    //Sprite.drawIcon(ctx, 'shock', 132, 338 + floatY, 22);
    //Sprite.drawIcon(ctx, 'shieldFull', 104, 338 + floatY, 22);

    drawPaperCard(186, 322 - floatY, 150, 98, '#f4faff', ui.blue, ui.shadow);
    drawSectionTag(200, 314 - floatY, '环境区', ui, 'blue');
    Sprite.label(ctx, '探索收束', 212, 346 - floatY, ui.text, 15, 'left');
    Sprite.label(ctx, '事件 / 奖惩 / 交易', 212, 370 - floatY, ui.softText, 10, 'left');
    //Sprite.drawIcon(ctx, 'clover', 294, 338 - floatY, 22);
    //Sprite.drawIcon(ctx, 'shop', 266, 338 - floatY, 22);

    drawPaperCard(24, 438, 312, 58, ui.panel, ui.shellBorder, ui.shadow);
    Sprite.label(ctx, '现在已经扩成后期会明显失控的成长战役。', 180, 454, ui.text, 12, 'center');
    Sprite.label(ctx, '后段会继续解锁异变突进、暴击斩和更夸张的武器。', 180, 474, ui.softText, 10, 'center');
    drawButton(70, 532, 220, 34, hasContinueGame() ? '继续游戏' : '开始新游', () => {
      if (hasContinueGame()) {
        continueSavedGame();
        return;
      }
      loadCampaignStep(0, false);
    });
    drawSmallButton(30, 584, 96, 22, '战役入口', () => {
      loadCampaignStep(0, false);
    });
    drawSmallButton(132, 584, 96, 22, '成就馆', () => openAchievements('title'));
    drawSmallButton(234, 584, 96, 22, '像素画廊', () => openGallery('title'));
  }

  function drawRouteSelect() {
    const ui = getGlobalUiTheme();
    drawSky('day');
    drawFieldBackdrop('day');
    drawMenuShell('十幕战役', 'CAMPAIGN OVERVIEW');
    drawPaperCard(24, 84, 312, 56, ui.panel, ui.shellBorder, ui.shadow);
    Sprite.label(ctx, '这里只有一条统一战役，不再是左右分线入口。', 180, 100, ui.text, 12, 'center');
    Sprite.label(ctx, '前段铺节奏，后段会进入暴雨、异变与彩蛋关。', 180, 118, ui.softText, 10, 'center');

    drawPaperCard(24, 154, 312, 130, '#eef8ff', ui.blue, ui.shadow);
    drawSectionTag(40, 146, '前半段', ui, 'blue');
    Sprite.label(ctx, '危险区清场', 44, 176, ui.text, 16, 'left');
    Sprite.label(ctx, '近战起手、守卫追击、环境压迫、商人开张', 44, 202, ui.softText, 11, 'left');
    Sprite.label(ctx, '节奏更快，先扛住怪和地形，再一点点撬开大图。', 44, 224, ui.softText, 11, 'left');
    Sprite.drawIcon(ctx, 'sword', 276, 174, 22);
    Sprite.drawIcon(ctx, 'shock', 302, 174, 22);
    drawButton(68, 246, 224, 24, '从第一幕开始推进', () => loadCampaignStep(0, false));

    drawPaperCard(24, 300, 312, 144, '#fff7ee', ui.gold, ui.shadow);
    drawSectionTag(40, 292, '后半段', ui, 'gold');
    Sprite.label(ctx, '探索与收束', 44, 322, ui.text, 16, 'left');
    Sprite.label(ctx, '机关解锁、折镜路径、Boss 反打、总闸终章', 44, 348, ui.softText, 11, 'left');
    Sprite.label(ctx, '这一段不再单独列成另一条线，而是直接接在战斗推进后面。', 44, 370, ui.softText, 11, 'left');
    Sprite.drawIcon(ctx, 'map', 276, 318, 22);
    Sprite.drawIcon(ctx, 'shop', 302, 318, 22);
    Sprite.drawIcon(ctx, 'lock', 276, 346, 22);
    Sprite.drawIcon(ctx, 'trophy', 302, 346, 22);
    drawPaperCard(44, 396, 272, 34, ui.panel, ui.shellBorder, 'rgba(0,0,0,0)');
    Sprite.label(ctx, '十幕会直接连起来，后半段会一路进入异变强度。', 180, 406, ui.text, 11, 'center');

    drawPaperCard(24, 458, 312, 64, ui.panel, ui.shellBorder, ui.shadow);
    Sprite.label(ctx, '你现在看到的是新的流程页，而不是之前那种双列路线卡。', 180, 474, ui.text, 12, 'center');
    Sprite.label(ctx, '后续结算、商店和 HUD 也会继续统一成这套浅色结构。', 180, 494, ui.softText, 10, 'center');

    drawSmallButton(24, 582, 108, 22, '返回标题', () => {
      setScreen(SCREEN.TITLE);
    });
    drawSmallButton(228, 582, 108, 22, '制作名单', () => openCredits('route-select'));
  }

  function drawRouteCard(x, y, w, h, title, lines, accent, body, meta, action) {
    const ui = getGlobalUiTheme();
    const battleCard = accent === '#d7eef9';
    drawPaperCard(x, y, w, h, body, battleCard ? ui.blue : ui.gold, ui.shadow);
    drawSectionTag(x + 12, y - 8, battleCard ? '压场向' : '探索向', ui, battleCard ? 'blue' : 'gold');
    Sprite.frame(ctx, x + 8, y + 8, w - 16, 74, ui.panelMute, ui.shellBorder);
    if (!Sprite.drawAtlasGallery(ctx, battleCard ? 0 : 1, x + 11, y + 11, w - 22, 64)) {
      Sprite.rect(ctx, x + 10, y + 10, w - 20, 66, accent);
    }
    Sprite.rect(ctx, x + 10, y + 56, w - 20, 20, battleCard ? 'rgba(104,211,255,0.2)' : 'rgba(255,214,108,0.18)');
    drawParagraph(title, x + 12, y + 90, w - 24, 14, ui.text);
    drawParagraph(meta.hook, x + 12, y + 122, w - 24, 13, ui.softText);
    lines.forEach((line, index) => {
      Sprite.label(ctx, `- ${line}`, x + 14, y + 166 + index * 18, ui.softText, 10, 'left');
    });
    drawPaperCard(x + 14, y + 250, w - 28, 58, ui.panelMute, ui.shellBorder, 'rgba(0,0,0,0)');
    Sprite.label(ctx, `节奏：${meta.rhythm}`, x + w * 0.5, y + 264, ui.text, 10, 'center');
    Sprite.label(ctx, meta.spotlight, x + w * 0.5, y + 280, battleCard ? ui.blue : ui.coral, 9, 'center');
    Sprite.label(ctx, meta.challenge, x + w * 0.5, y + 294, ui.softText, 8, 'center');
    Sprite.frame(ctx, x + 14, y + h - 58, w - 28, 40, battleCard ? ui.blue : ui.gold, ui.shellBorder);
    Sprite.label(ctx, '进入战役', x + w * 0.5, y + h - 48, battleCard ? '#08131f' : '#17131a', 14, 'center');
    state.hitAreas.push({ shape: 'rect', x: x + 14, y: y + h - 58, w: w - 28, h: 40, kind: 'tap', action });
  }

  function drawPlaying() {
    const play = state.play;
    const ui = getUiTheme(play.theme);
    drawSky(play.theme);
    drawFieldBackdrop(play.theme);
    Sprite.drawHandheldFrame(ctx, VIEW, play.theme);
    drawWorld(play);
    drawDarkPulseOverlay(play);
    drawAttackAim(play);
    drawFeedbackOverlay(play);
    drawTopBar(play);
    drawObjectivePanel(play);
    if (play.hybrid.active && play.hybrid.mapExpanded) {
      drawHybridMapOverlay(play);
    }
    drawCompanionHud(play);
    drawQuickbar(play);
    drawVirtualButtons(play);

    if (play.promptTimer > 0 && play.prompt) {
      const glow = Math.sin(state.time * 8) * 2;
      Sprite.frame(ctx, 34, 418, 292, 24, '#fffefb', ui.shellBorder);
      Sprite.rect(ctx, 40 + glow, 422, 36, 2, ui.accent);
      Sprite.label(ctx, play.prompt, 180, 423, ui.text, 12, 'center');
    }
  }

  function drawWorld(play) {
    const ambientGlow = play.theme === 'night';
    const startTx = Math.floor(play.camera.x / TILE_SIZE);
    const startTy = Math.floor(play.camera.y / TILE_SIZE);
    const endTx = Math.ceil((play.camera.x + VIEW.w) / TILE_SIZE);
    const endTy = Math.ceil((play.camera.y + VIEW.h) / TILE_SIZE);

    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    ctx.clip();
    const shake = getCameraShakeOffset(play);
    ctx.translate(VIEW.x - play.camera.x + shake.x, VIEW.y - play.camera.y + shake.y);

    for (let y = startTy; y <= endTy; y += 1) {
      for (let x = startTx; x <= endTx; x += 1) {
        const tile = getTile(play.level.grid, x, y);
        Sprite.drawTile(ctx, tile, x * TILE_SIZE, y * TILE_SIZE, play.theme);
      }
    }

    play.particles.forEach((particle) => {
      Sprite.rect(ctx, particle.x, particle.y, play.theme === 'night' ? 2 : 3, play.theme === 'night' ? 2 : 3, particle.color);
    });
    play.effects.forEach((effect) => {
      ctx.globalAlpha = effect.alpha;
      if (effect.kind === 'text') {
        Sprite.label(ctx, effect.text, effect.x + 1, effect.y + 1, 'rgba(34,42,58,0.9)', effect.size, 'center');
        Sprite.label(ctx, effect.text, effect.x, effect.y, effect.color, effect.size, 'center');
      } else if (effect.kind === 'icon' && Sprite.drawIcon) {
        Sprite.drawIcon(ctx, effect.icon, effect.x - effect.size * 0.5, effect.y - effect.size * 0.5, effect.size);
      } else if (effect.kind === 'ring') {
        ctx.save();
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        Sprite.rect(ctx, effect.x - effect.size * 0.5, effect.y - effect.size * 0.5, effect.size, effect.size, effect.color);
      }
    });
    ctx.globalAlpha = 1;

    play.collectibles.forEach((item) => {
      if (!item.collected) {
        if (ambientGlow) {
          drawPulseHalo(item.px + 8, item.py + 8, 10 + Math.sin(state.time * 5 + item.px) * 2, 'rgba(255,242,168,0.18)');
        }
        Sprite.drawPickup(ctx, item.px, item.py, item.type, state.time * 4);
      }
    });
    play.items.forEach((item) => {
      if (!item.collected) {
        if (ambientGlow) {
          drawPulseHalo(item.px + 8, item.py + 8, 9 + Math.sin(state.time * 5 + item.px) * 2, 'rgba(156,243,255,0.16)');
        }
        Sprite.drawPickup(ctx, item.px, item.py, item.type, state.time * 4);
      }
    });
    if (play.route === 'puzzle' && play.levelIndex === 1) {
      drawMirrorBeam(play);
    }
    play.clues.forEach((clue) => {
      if (play.randomEvent && play.randomEvent.sunshineTimer > 0 && !clue.found) {
        drawPulseHalo(clue.px + 8, clue.py + 8, 11 + Math.sin(state.time * 6 + clue.px) * 2, 'rgba(129,195,232,0.18)');
      }
      if (play.route === 'puzzle' && play.levelIndex === 1 && play.flags.keypadHintActive && clue.reliable) {
        drawPulseHalo(clue.px + 8, clue.py + 8, 12 + Math.sin(state.time * 7 + clue.py) * 2, 'rgba(255,226,138,0.22)');
      }
      Sprite.drawPickup(ctx, clue.px, clue.py, 'gear', state.time);
    });
    play.loreMarks.forEach((mark) => {
      Sprite.drawSparkle(ctx, mark.px + 5, mark.py + 5, mark.read ? '#9fe8ff' : '#ffe58b');
    });
    if (play.flags.loreTrailShown && play.route === 'battle' && play.levelIndex === 0) {
      const exitGlowX = play.level.exit.x * TILE_SIZE + 4;
      const exitGlowY = play.level.exit.y * TILE_SIZE + 4;
      Sprite.drawSparkle(ctx, exitGlowX, exitGlowY, '#fff9df');
      Sprite.drawSparkle(ctx, exitGlowX - 16, exitGlowY - 10, '#95f2ff');
    }
    play.shrines.forEach((shrine) => {
      Sprite.drawShrine(ctx, shrine.px, shrine.py, shrine.active);
    });
    if (play.flags.allCluesLogged && play.door) {
      Sprite.drawSparkle(ctx, play.door.px + 5, play.door.py - 6, '#fff09a');
    }
    if (play.seedSpot && !play.seedSpot.collected && play.flags.doorOpened) {
      Sprite.drawPickup(ctx, play.seedSpot.px, play.seedSpot.py, 'seed', state.time);
    }
    play.runes.forEach((rune) => {
      if (play.theme === 'night' && play.puzzleHints.some((hint) => hint.kind === 'rune' && hint.id === rune.id)) {
        drawPulseHalo(rune.px + 8, rune.py + 8, 12 + Math.sin(state.time * 7 + rune.px) * 2, 'rgba(255,229,139,0.22)');
      }
      drawPuzzleRune(rune);
    });
    play.mirrors.forEach((mirror) => {
      if (play.theme === 'night' && play.puzzleHints.some((hint) => hint.kind === 'mirror' && hint.id === mirror.id)) {
        drawPulseHalo(mirror.px + 8, mirror.py + 8, 12 + Math.sin(state.time * 7 + mirror.py) * 2, 'rgba(129,195,232,0.22)');
      }
      drawPuzzleMirror(mirror);
    });
    play.receivers.forEach((receiver) => {
      drawPuzzleReceiver(receiver);
    });
    play.valves.forEach((valve) => {
      if (play.theme === 'night' && play.puzzleHints.some((hint) => hint.kind === 'valve' && hint.id === valve.id)) {
        drawPulseHalo(valve.px + 8, valve.py + 8, 12 + Math.sin(state.time * 7 + valve.px) * 2, 'rgba(144,210,160,0.2)');
      }
      drawPuzzleValve(valve);
    });
    if (play.door && play.route === 'puzzle') {
      drawPuzzleTerminal(play.door, (play.levelIndex === 0 && play.flags.runeSolved) || (play.levelIndex === 1 && play.flags.mirrorSolved));
    }

    play.plots.forEach((plot) => {
      const planted = play.planted.includes(plot.condition);
      if (planted) {
        const stage = Math.min(2, Math.floor((play.plantAnimations.find((anim) => anim.plotId === plot.id)?.timer || 0.5) * 5));
        const colors = ['#94b26c', '#d8c565', '#ffde78'];
        for (let row = 0; row < plot.h; row += 1) {
          for (let col = 0; col < plot.w; col += 1) {
            Sprite.rect(ctx, plot.px + col * TILE_SIZE + 5, plot.py + row * TILE_SIZE + 4, 6, 10, colors[Math.min(stage, 2)]);
          }
        }
      }
    });
    if (play.special && play.special.fires.length) {
      play.special.fires.forEach((fire) => {
        const flicker = Math.sin(fire.phase) * 1.2;
        const glow = 10 + Math.sin(fire.phase * 0.9) * 3;
        drawPulseHalo(fire.x, fire.y + 8, 10 + glow, 'rgba(255,138,79,0.22)');
        drawPulseHalo(fire.x, fire.y + 8, 16 + glow * 1.2, 'rgba(255,210,138,0.12)');
        Sprite.rect(ctx, fire.x - 10, fire.y + 7, 20, 3, 'rgba(255,136,79,0.32)');
        Sprite.rect(ctx, fire.x - 7, fire.y + 5, 14, 6, 'rgba(255,210,138,0.22)');
        Sprite.rect(ctx, fire.x - 2, fire.y + 2 + flicker, 4, 10, '#fff2ae');
        Sprite.rect(ctx, fire.x - 12, fire.y + 8, 6, 2, 'rgba(255,136,79,0.26)');
        Sprite.rect(ctx, fire.x + 6, fire.y + 8, 6, 2, 'rgba(255,136,79,0.26)');
        Sprite.rect(ctx, fire.x - 3, fire.y + 11, 6, 2, 'rgba(255,136,79,0.24)');
        Sprite.rect(ctx, fire.x - 3, fire.y + 4, 6, 2, 'rgba(255,136,79,0.24)');
      });
    }

    play.npcs.forEach((npc) => {
      if (play.theme === 'night' && play.randomEvent && play.randomEvent.sunshineTimer > 0) {
        drawPulseHalo(npc.px + 6, npc.py + 7, 12 + Math.sin(state.time * 5 + npc.px) * 2, 'rgba(144,210,160,0.16)');
      }
      drawPixelShadow(npc.px + 6, npc.py + 15, 10, 'rgba(24,18,16,0.18)');
      Sprite.drawNpc(ctx, npc.px, npc.py, npc, state.frameIndex);
    });
    if (play.randomEvent && play.randomEvent.merchant) {
      drawPixelShadow(play.randomEvent.merchant.x + 6, play.randomEvent.merchant.y + 15, 10, 'rgba(24,18,16,0.16)');
      drawMerchantNpc(play.randomEvent.merchant.x, play.randomEvent.merchant.y);
    }
    if (play.randomEvent && play.randomEvent.chests.length) {
      play.randomEvent.chests.forEach((chest) => {
        drawPixelShadow(chest.x + 7, chest.y + 14, 10, 'rgba(24,18,16,0.16)');
        drawEventChest(chest.x, chest.y, chest.reward);
      });
    }
    if (play.hybrid.active) {
      play.hybrid.hazards.forEach((hazard) => drawHybridHazard(hazard));
      play.envSites.forEach((site) => drawHybridSite(site));
      if (play.merchantSpot && play.merchantSpot.active) {
        drawPixelShadow(play.merchantSpot.px + 6, play.merchantSpot.py + 15, 10, 'rgba(24,18,16,0.16)');
        drawMerchantNpc(play.merchantSpot.px, play.merchantSpot.py);
      }
      (play.allyGraves || []).forEach((grave) => {
        drawPixelShadow(grave.x + 6, grave.y + 15, 10, 'rgba(24,18,16,0.12)');
        Sprite.frame(ctx, grave.x + 1, grave.y + 3, 10, 10, '#f4f0f8', '#b2a8c8');
        Sprite.rect(ctx, grave.x + 5, grave.y + 5, 2, 6, '#8f85a8');
        Sprite.rect(ctx, grave.x + 3, grave.y + 7, 6, 2, '#8f85a8');
      });
      play.roamers.forEach((roamer) => drawHybridRoamer(roamer));
      play.minibosses.forEach((mini) => drawHybridMiniBoss(mini));
      if (play.portalSpot && play.portalSpot.active) {
        drawHybridPortal(play.portalSpot);
      }
      if (play.rewardChest) {
        drawHybridChest(play.rewardChest);
      }
      play.lootDrops.forEach((drop) => drawLootDrop(drop));
    }
    play.guards.forEach((guard) => {
      if (play.route === 'battle' && play.levelIndex === 1) {
        drawGuardSensor(guard);
      }
      drawPixelShadow(guard.x + 6, guard.y + 15, 10, 'rgba(12,14,18,0.22)');
      Sprite.drawGuard(ctx, guard.x, guard.y, state.time * 8);
      if (play.route === 'battle' && play.levelIndex === 1) {
        drawGuardMarker(guard);
      }
    });
    play.decoys.forEach((decoy) => {
      drawPixelShadow(decoy.x + 6, decoy.y + 15, 10, 'rgba(40,24,58,0.18)');
      Sprite.frame(ctx, decoy.x, decoy.y + 2, 12, 12, '#d9c4ff', '#5d4425');
      Sprite.label(ctx, '饵', decoy.x + 6, decoy.y + 3, '#3a2948', 9, 'center');
    });
    if (play.boss) {
      play.bossWarnings.forEach((warning) => drawBossWarning(warning));
      if (play.boss.spawnTimer > 0) {
        const introRatio = play.boss.spawnTimer / 1.2;
        drawGroundRing(play.boss.x + 16, play.boss.y + 25, 18 + (1 - introRatio) * 18, '#b9ebff', 'rgba(185,235,255,0.08)', 2, 0.76);
        drawGroundRing(play.boss.x + 16, play.boss.y + 25, 10 + (1 - introRatio) * 12, '#ffd6f8', 'rgba(255,214,248,0.05)', 1.5, 0.58);
        drawPulseHalo(play.boss.x + 16, play.boss.y + 16, 14 + (1 - introRatio) * 8, 'rgba(233,247,255,0.18)');
      }
      ctx.save();
      const bossAlpha = play.boss.dying ? Math.max(0.18, play.boss.deathTimer / 1.25) : (play.boss.spawnTimer > 0 ? Math.max(0.2, 1 - play.boss.spawnTimer / 1.2) : 1);
      const bossScale = play.boss.dying
        ? 1 + (1 - (play.boss.deathTimer / 1.25)) * 0.22
        : (play.boss.spawnTimer > 0 ? 0.72 + (1 - play.boss.spawnTimer / 1.2) * 0.28 : 1);
      ctx.globalAlpha = bossAlpha;
      ctx.translate(play.boss.x + 16, play.boss.y + 16);
      ctx.scale(bossScale, bossScale);
      Sprite.drawBoss(ctx, -16, -16, play.boss, state.time);
      ctx.restore();
    }
    (play.extraBosses || []).forEach((boss) => {
      if (!boss) {
        return;
      }
      if (boss.spawnTimer > 0) {
        const introRatio = boss.spawnTimer / 0.8;
        drawGroundRing(boss.x + 16, boss.y + 25, 14 + (1 - introRatio) * 14, '#d7f3ff', 'rgba(215,243,255,0.06)', 1.6, 0.62);
      }
      ctx.save();
      const bossAlpha = boss.dying ? Math.max(0.18, (boss.deathTimer || 1.05) / 1.05) : (boss.spawnTimer > 0 ? Math.max(0.2, 1 - boss.spawnTimer / 0.8) : 1);
      const bossScale = boss.dying
        ? 0.92 + (1 - ((boss.deathTimer || 1.05) / 1.05)) * 0.18
        : (boss.spawnTimer > 0 ? 0.68 + (1 - boss.spawnTimer / 0.8) * 0.24 : 0.92);
      ctx.globalAlpha = bossAlpha;
      ctx.translate(boss.x + 16, boss.y + 16);
      ctx.scale(bossScale, bossScale);
      Sprite.drawBoss(ctx, -16, -16, boss, state.time);
      ctx.restore();
    });
    play.bossMinions.forEach((minion) => {
      drawBossMinion(minion);
    });

    play.playerSwings.forEach((swing) => {
      const ratio = swing.ttl / swing.maxTtl;
      const slashRadius = Math.max(10, swing.radius * 0.42);
      const start = -0.52 + (1 - ratio) * 0.08;
      const end = 0.36 + ratio * 0.14;
      ctx.save();
      ctx.translate(swing.x, swing.y);
      ctx.rotate(swing.angle);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.24 + ratio * 0.14;
      ctx.strokeStyle = play.theme === 'night' ? '#9feaff' : '#ffc890';
      ctx.lineWidth = 7 + ratio * 3;
      ctx.beginPath();
      ctx.arc(0, 0, slashRadius, start, end);
      ctx.stroke();
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = '#fff8e8';
      ctx.lineWidth = 3 + ratio * 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, slashRadius - 2, start + 0.08, end - 0.06);
      ctx.stroke();
      const tipX = Math.cos(end) * (slashRadius + 1);
      const tipY = Math.sin(end) * (slashRadius + 1);
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = play.inventory.weapon === 'skyblade' ? '#dff7ff' : '#ffd7a8';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 2 + ratio * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    play.playerBullets.forEach((bullet) => {
      Sprite.drawBullet(ctx, bullet.x, bullet.y, bullet.kind === 'bomb' ? 'bomb' : 'player');
    });
    play.enemyBullets.forEach((bullet) => {
      Sprite.drawBullet(ctx, bullet.x, bullet.y, 'enemy');
    });

    if (play.player.invuln <= 0 || Math.floor(state.time * 10) % 2 === 0) {
      drawPixelShadow(play.player.x + 6, play.player.y + 15, 10, play.inTallGrass ? 'rgba(255,229,139,0.22)' : 'rgba(12,14,18,0.18)');
      Sprite.drawPlayer(ctx, play.player.x, play.player.y, play.player, state.frameIndex);
    }
    if (play.special && play.special.rain) {
      for (let i = 0; i < 36; i += 1) {
        const rx = play.camera.x + ((i * 29 + state.time * 90) % VIEW.w);
        const ry = play.camera.y + ((i * 17 + state.time * 145) % VIEW.h);
        Sprite.rect(ctx, rx, ry, 1, 8, 'rgba(198,232,255,0.52)');
      }
    }
    (play.allies || []).forEach((ally) => {
      drawPixelShadow(ally.x + 6, ally.y + 15, 10, 'rgba(26,18,36,0.16)');
      Sprite.drawPlayer(ctx, ally.x, ally.y, ally, state.frameIndex);
    });
    if (play.portalSpot && play.portalSpot.active) {
      const portalDist = distance(play.player.x + 6, play.player.y + 7, play.portalSpot.px + 8, play.portalSpot.py + 8);
      if ((portalDist < 96 || play.hybrid.phase === 'transition') && play.theme === 'night') {
        const ringPulse = 10 + Math.sin(state.time * 7) * 2;
        drawGroundRing(play.player.x + 6, play.player.y + 13, ringPulse + 4, '#9bddff', 'rgba(141, 220, 255, 0.06)', 2, 0.5);
        drawGroundRing(play.player.x + 6, play.player.y + 13, ringPulse * 0.7, '#ffd6ff', 'rgba(255, 214, 255, 0.04)', 1.5, 0.42);
      }
    }
    if (play.inTallGrass && play.theme === 'night') {
      drawPulseHalo(play.player.x + 6, play.player.y + 8, 16 + Math.sin(state.time * 6) * 2, 'rgba(255,229,139,0.14)');
    }

    if (getActiveFogRadius(play) > 0) {
      drawFog(play);
    }

    ctx.restore();

    if (play.route === 'battle' && play.levelIndex === 1) {
      drawCollectibleGlow(play);
    }
    if ((play.boss || (play.extraBosses && play.extraBosses.length)) && (play.hybrid.active || (play.route === 'battle' && play.levelIndex === 2))) {
      drawBossUi(play);
    }
    drawNearbyPrompt(play);
    if (play.hybrid.active && play.hybrid.phase === 'transition') {
      drawHybridTransition(play);
    }
  }

  function drawFeedbackOverlay(play) {
    if (!play || !play.feedback) {
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    ctx.clip();
    if (play.feedback.flashHit > 0) {
      ctx.globalAlpha = Math.min(0.14, play.feedback.flashHit * 1.2);
      ctx.fillStyle = '#fff0a6';
      ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    }
    if (play.feedback.flashKill > 0) {
      ctx.globalAlpha = Math.min(0.16, play.feedback.flashKill);
      ctx.fillStyle = '#9cf3ff';
      ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    }
    if (play.feedback.flashShield > 0) {
      ctx.globalAlpha = Math.min(0.14, play.feedback.flashShield);
      ctx.fillStyle = '#79d8ff';
      ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    }
    if (play.feedback.flashHeal > 0) {
      ctx.globalAlpha = Math.min(0.12, play.feedback.flashHeal);
      ctx.fillStyle = '#8effb2';
      ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    }
    if (play.feedback.flashDamage > 0) {
      ctx.globalAlpha = Math.min(0.22, play.feedback.flashDamage);
      ctx.fillStyle = '#ff7e88';
      ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    }
    if (play.feedback.flashCrit > 0) {
      ctx.globalAlpha = Math.min(0.18, play.feedback.flashCrit);
      ctx.fillStyle = '#ff8f9a';
      ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    }
    if (play.feedback.executeFlash > 0) {
      ctx.globalAlpha = Math.min(0.16, play.feedback.executeFlash);
      ctx.fillStyle = '#cffff4';
      ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    }
    if (play.feedback.skySlash > 0) {
      const ratio = play.feedback.skySlash / 0.32;
      const cx = VIEW.x + VIEW.w * 0.5;
      const cy = VIEW.y + VIEW.h * 0.5;
      const len = VIEW.w * 0.88;
      const angle = play.feedback.skySlashAngle || -0.8;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.globalAlpha = 0.14 * ratio;
      ctx.fillStyle = '#dff7ff';
      ctx.fillRect(-len * 0.5, -8, len, 16);
      ctx.globalAlpha = 0.22 * ratio;
      ctx.fillStyle = '#fff7bf';
      ctx.fillRect(-len * 0.5, -3, len, 6);
      ctx.restore();
    }
    if (play.player.hp <= 1) {
      const pulse = 0.1 + ((Math.sin(state.time * 9) + 1) * 0.5) * 0.1;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ff5f6b';
      ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, 10);
      ctx.fillRect(VIEW.x, VIEW.y + VIEW.h - 10, VIEW.w, 10);
      ctx.fillRect(VIEW.x, VIEW.y, 10, VIEW.h);
      ctx.fillRect(VIEW.x + VIEW.w - 10, VIEW.y, 10, VIEW.h);
    }
    ctx.restore();
  }

  function drawFog(play) {
    const px = play.player.x + play.player.w * 0.5;
    const py = play.player.y + play.player.h * 0.5;
    const radius = getActiveFogRadius(play) * TILE_SIZE;
    if (radius <= 0) {
      return;
    }
    const dayFog = play.theme === 'day';
    const outerStart = radius * (dayFog ? 0.82 : 1);
    const innerFade = radius * (dayFog ? 0.66 : 0.78);
    for (let y = 0; y < play.level.grid.length; y += 1) {
      for (let x = 0; x < play.level.grid[0].length; x += 1) {
        const worldX = x * TILE_SIZE;
        const worldY = y * TILE_SIZE;
        const discovered = play.discovered[y][x];
        const dist = distance(worldX + 8, worldY + 8, px, py);
        if (dist > outerStart) {
          if (dayFog) {
            const driftTime = state.time * 0.12;
            const waveA = Math.sin(worldX * 0.024 + worldY * 0.012 + driftTime);
            const waveB = Math.cos(worldY * 0.02 - worldX * 0.01 + driftTime * 0.72 + 1.4);
            const waveC = Math.sin((worldX + worldY) * 0.014 - driftTime * 0.58 + 0.8);
            const mistField = clamp((((waveA + waveB + waveC) / 3) + 1) * 0.5, 0, 1);
            const edgeRatio = dist > radius
              ? 1
              : clamp((dist - innerFade) / Math.max(1, radius - innerFade), 0, 1);
            const alpha = (dist > radius
              ? (discovered ? 0.18 : 0.29)
              : (discovered ? 0.08 : 0.16))
              + mistField * (discovered ? 0.04 : 0.08)
              + edgeRatio * (discovered ? 0.03 : 0.06);
            ctx.fillStyle = mistField > 0.56
              ? `rgba(248,252,255,${alpha})`
              : (discovered ? `rgba(239,246,252,${alpha})` : `rgba(228,238,246,${alpha + 0.03})`);
          } else {
            ctx.fillStyle = discovered ? 'rgba(7,10,18,0.55)' : 'rgba(7,10,18,0.86)';
          }
          ctx.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);
        } else if (dayFog && dist > innerFade) {
          const edgeFlow = (Math.sin((worldX + state.time * 8) * 0.022) + Math.cos((worldY - state.time * 6) * 0.024)) * 0.5;
          const edgeAlpha = (discovered ? 0.05 : 0.08) + (edgeFlow + 1) * 0.016;
          ctx.fillStyle = `rgba(247,251,255,${edgeAlpha})`;
          ctx.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    if (dayFog) {
      const cameraX = play.camera ? play.camera.x : 0;
      const cameraY = play.camera ? play.camera.y : 0;
      const layers = [
        { speed: 4.5, y: 34, height: 14, alpha: 0.08, width: 126, color: '#f8fcff' },
        { speed: 3.2, y: 96, height: 18, alpha: 0.1, width: 154, color: '#eef7ff' },
        { speed: 2.1, y: 168, height: 24, alpha: 0.12, width: 182, color: '#f7fbff' }
      ];
      ctx.save();
      ctx.beginPath();
      ctx.rect(cameraX, cameraY, VIEW.w, VIEW.h);
      ctx.clip();
      layers.forEach((layer, layerIndex) => {
        ctx.fillStyle = layer.color;
        for (let i = -1; i < 4; i += 1) {
          const drift = ((state.time * layer.speed * 10) + layerIndex * 31) % layer.width;
          const mistX = cameraX - 56 + i * (layer.width - 18) + drift;
          const mistY = cameraY + layer.y + Math.sin(state.time * (0.32 + layerIndex * 0.08) + i * 0.9) * (4 + layerIndex * 2);
          ctx.globalAlpha = layer.alpha;
          ctx.fillRect(mistX, mistY, layer.width, layer.height);
          ctx.globalAlpha = layer.alpha * 0.6;
          ctx.fillRect(mistX + 16, mistY + layer.height, Math.max(30, layer.width - 42), 6 + layerIndex * 2);
          ctx.globalAlpha = layer.alpha * 0.38;
          ctx.fillRect(mistX + 34, mistY - 5, Math.max(26, layer.width - 70), 5);
        }
      });
      ctx.restore();
    }
  }

  function drawCollectibleGlow(play) {
    const nearest = play.collectibles.filter((item) => !item.collected).sort((a, b) => {
      const da = distance(play.player.x, play.player.y, a.px, a.py);
      const db = distance(play.player.x, play.player.y, b.px, b.py);
      return da - db;
    })[0];
    if (!nearest) {
      return;
    }
    const dist = distance(play.player.x, play.player.y, nearest.px, nearest.py);
    if (dist > 84) {
      return;
    }
    const dx = nearest.px - play.player.x;
    const dy = nearest.py - play.player.y;
    ctx.fillStyle = 'rgba(255, 242, 154, 0.25)';
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) ctx.fillRect(VIEW.x + VIEW.w - 6, VIEW.y + 24, 6, VIEW.h - 48);
      else ctx.fillRect(VIEW.x, VIEW.y + 24, 6, VIEW.h - 48);
    } else {
      if (dy > 0) ctx.fillRect(VIEW.x + 24, VIEW.y + VIEW.h - 6, VIEW.w - 48, 6);
      else ctx.fillRect(VIEW.x + 24, VIEW.y, VIEW.w - 48, 6);
    }
  }

  function drawPixelShadow(x, y, width, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x - width * 0.5), Math.round(y), Math.round(width), 2);
    ctx.fillRect(Math.round(x - width * 0.35), Math.round(y - 1), Math.round(width * 0.7), 1);
  }

  function drawPulseHalo(x, y, radius, color) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawGroundRing(x, y, radius, stroke, fill, lineWidth, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    if (fill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth || 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawDarkPulseOverlay(play) {
    if (!(play.route === 'battle' && play.levelIndex === 2) || play.darkPulse.timer <= 0) {
      return;
    }
    const ratio = play.darkPulse.timer / 0.55;
    ctx.save();
    ctx.globalAlpha = 0.22 + (1 - ratio) * 0.44;
    ctx.fillStyle = '#1d1831';
    ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = '#6f5de2';
    ctx.fillRect(VIEW.x, VIEW.y + 10, VIEW.w, 8);
    ctx.restore();
  }

  function drawHybridHazard(hazard) {
    const pulse = 0.7 + Math.sin(state.time * 10) * 0.12;
    ctx.save();
    if (hazard.warning > 0) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#ff9a9a';
      ctx.beginPath();
      ctx.arc(hazard.x, hazard.y, hazard.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#ff5f6b';
      ctx.beginPath();
      ctx.arc(hazard.x, hazard.y, hazard.radius * 1.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.92;
      ctx.strokeStyle = '#ff6670';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#ff666f';
      ctx.beginPath();
      ctx.arc(hazard.x, hazard.y, hazard.radius + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#ffb0b5';
      ctx.beginPath();
      ctx.arc(hazard.x, hazard.y, hazard.radius + 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (Sprite.drawIcon) {
      Sprite.drawIcon(ctx, getHazardIconName(hazard.kind), hazard.x - 7, hazard.y - 7, 14);
    }
  }

  function drawHybridSite(site) {
    const fill = site.done
      ? '#dff4e6'
      : (site.kind === 'gamble'
        ? '#fde7d9'
        : site.kind === 'tower'
          ? '#e2f2ff'
          : site.kind === 'relay'
            ? '#eef4ff'
            : site.kind === 'forge'
              ? '#fff0dd'
              : site.kind === 'altar'
                ? '#f4e9ff'
                : '#fff3cf');
    const border = site.done ? '#95c6a4' : '#ccb998';
    Sprite.frame(ctx, site.px + 1, site.py + 1, 14, 14, fill, border);
    if (Sprite.drawIcon) {
      Sprite.drawIcon(ctx, getSiteIconName(site.kind), site.px + 1, site.py + 1, 14);
    } else {
      Sprite.label(ctx, '点', site.px + 8, site.py + 4, '#5e544b', 9, 'center');
    }
    if (!site.done && state.play && state.play.theme === 'night') {
      drawPulseHalo(site.px + 8, site.py + 8, 12 + Math.sin(state.time * 6 + site.px) * 2, 'rgba(255,229,139,0.16)');
    }
  }

  function drawHybridRoamer(roamer) {
    drawPixelShadow(roamer.x + 6, roamer.y + 12, 10, 'rgba(36, 24, 45, 0.2)');
    if (roamer.executeTimer > 0) {
      drawPulseHalo(roamer.x + 6, roamer.y + 6, 12, 'rgba(207,255,244,0.22)');
    }
    const shake = roamer.hitFlash > 0 ? ((Math.floor(state.time * 50) % 2) ? 1 : -1) : 0;
    if (!Sprite.drawObjectSprite || !Sprite.drawObjectSprite(ctx, roamer.spriteKey || 'slimeGreen', roamer.x - 4 + shake, roamer.y - 6, 22, 22, roamer.hitFlash || 0)) {
      Sprite.frame(ctx, roamer.x + shake, roamer.y + 1, 12, 11, roamer.hitFlash > 0 ? '#ff9b9b' : '#e6dcff', '#8369b4');
      Sprite.rect(ctx, roamer.x + 2 + shake, roamer.y + 3, 8, 6, roamer.hitFlash > 0 ? '#ff6767' : '#b59de8');
      Sprite.rect(ctx, roamer.x + 3 + shake, roamer.y + 4, 2, 2, '#fffaf7');
      Sprite.rect(ctx, roamer.x + 7 + shake, roamer.y + 4, 2, 2, '#fffaf7');
      Sprite.rect(ctx, roamer.x + 4 + shake, roamer.y + 9, 4, 2, '#6c59a8');
    }
  }

  function drawHybridMiniBoss(mini) {
    drawPixelShadow(mini.x + 7, mini.y + 14, 12, 'rgba(82, 46, 24, 0.18)');
    if (mini.executeTimer > 0) {
      drawPulseHalo(mini.x + 7, mini.y + 7, 16, 'rgba(207,255,244,0.22)');
    }
    const shake = mini.hitFlash > 0 ? ((Math.floor(state.time * 44) % 2) ? 1 : -1) : 0;
    if (!Sprite.drawObjectSprite || !Sprite.drawObjectSprite(ctx, mini.spriteKey || 'bruteHorn', mini.x - 6 + shake, mini.y - 8, 28, 28, mini.hitFlash || 0)) {
      Sprite.frame(ctx, mini.x + shake, mini.y, 14, 14, mini.hitFlash > 0 ? '#ffb3b3' : '#fff0dd', '#c78855');
      Sprite.rect(ctx, mini.x + 2 + shake, mini.y + 3, 10, 7, mini.hitFlash > 0 ? '#ff6a6a' : '#f0b27a');
      Sprite.rect(ctx, mini.x + 3 + shake, mini.y + 5, 2, 2, '#fffaf7');
      Sprite.rect(ctx, mini.x + 9 + shake, mini.y + 5, 2, 2, '#fffaf7');
      Sprite.rect(ctx, mini.x + 4 + shake, mini.y + 10, 6, 2, '#8d5932');
    }
  }

  function drawHybridPortal(portal) {
    if (!portal) {
      return;
    }
    const pulse = 14 + Math.sin(state.time * 7) * 2;
    const cx = portal.px + 8;
    const cy = portal.py + 8;
    const rewardMode = state.play && state.play.hybrid && state.play.hybrid.phase === 'reward';
    for (let i = 0; i < 6; i += 1) {
      const orbit = state.time * (2.2 + i * 0.25) + i * 1.04;
      const ox = cx + Math.cos(orbit) * (10 + i * 2);
      const oy = cy + Math.sin(orbit * 1.2) * (5 + i);
      drawPulseHalo(ox, oy, 2 + (i % 2), i % 2 === 0 ? 'rgba(143,216,255,0.22)' : 'rgba(255,209,251,0.2)');
    }
    for (let i = 0; i < 12; i += 1) {
      const swirl = state.time * (3.4 + i * 0.08) + i * 0.52;
      const dist = 24 - (i % 4) * 4;
      Sprite.rect(ctx, cx + Math.cos(swirl) * dist - 1, cy + Math.sin(swirl * 1.3) * (8 + (i % 3) * 3) - 1, 3, 3, i % 2 === 0 ? '#dffbff' : '#ffc9f2');
      if (rewardMode) {
        Sprite.rect(ctx, cx + Math.cos(-swirl * 0.8) * (dist + 8) - 1, cy + Math.sin(-swirl) * 12 - 1, 2, 2, '#fff2a8');
      }
    }
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = '#97dfff';
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 8 + i * 5 + Math.sin(state.time * 5 + i) * 1.5, Math.PI * 0.2 + state.time * (0.8 + i * 0.2), Math.PI * 1.6 + state.time * (0.8 + i * 0.2));
      ctx.stroke();
    }
    ctx.restore();
    drawGroundRing(cx, cy + 6, pulse * 1.18, '#8fd8ff', 'rgba(143, 216, 255, 0.08)', 2, 0.6);
    drawGroundRing(cx, cy + 6, pulse * 0.74, '#ffd2fa', 'rgba(255, 210, 250, 0.06)', 1.5, 0.48);
    drawGroundRing(cx, cy + 6, pulse * 1.62, '#8ee8ff', 'rgba(130, 223, 255, 0.03)', 1.5, 0.44);
    drawGroundRing(cx, cy + 6, pulse * 2.08, rewardMode ? '#fff2a8' : '#8ee8ff', rewardMode ? 'rgba(255,242,168,0.03)' : 'rgba(130, 223, 255, 0.02)', 1.5, 0.32);
    drawPulseHalo(cx, cy, pulse * 1.45, 'rgba(138, 214, 255, 0.14)');
    drawPulseHalo(cx, cy, pulse, 'rgba(133, 197, 255, 0.26)');
    drawPulseHalo(cx, cy, pulse * 0.72, 'rgba(180, 233, 255, 0.3)');
    ctx.save();
    ctx.strokeStyle = '#8ac6ea';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.82;
    ctx.beginPath();
    ctx.arc(cx, cy, 10 + Math.sin(state.time * 9) * 1.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#dff8ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 14 + Math.sin(state.time * 8 + 0.4) * 1.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.translate(cx, cy);
    ctx.rotate(state.time * 2.8);
    ctx.strokeStyle = '#d9f5ff';
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 8);
    ctx.stroke();
    for (let i = 0; i < 4; i += 1) {
      ctx.rotate(Math.PI * 0.5);
      ctx.strokeStyle = i % 2 === 0 ? '#8fd7ff' : '#ffd7ff';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(18, 0);
      ctx.stroke();
    }
    ctx.restore();
    for (let i = 0; i < 8; i += 1) {
      const beam = state.time * 2.8 + (Math.PI * 2 * i) / 8;
      Sprite.rect(ctx, cx + Math.cos(beam) * 16 - 1, cy + Math.sin(beam) * 10 - 6, 2, 12, i % 2 === 0 ? '#dfffff' : '#ffcfff');
    }
    if (state.play) {
      const playerCx = state.play.player.x + 6;
      const playerCy = state.play.player.y + 7;
      const pullDist = distance(playerCx, playerCy, cx, cy);
      if (pullDist < 92) {
        for (let i = 0; i < 7; i += 1) {
          const t = (i + (state.time * 7 % 1)) / 7;
          const px = lerp(playerCx, cx, t);
          const py = lerp(playerCy, cy, t) + Math.sin(state.time * 6 + i) * 3;
          Sprite.rect(ctx, px - 1, py - 1, 3, 3, i % 2 === 0 ? '#cfffff' : '#ffd6ff');
        }
      }
    }
    Sprite.frame(ctx, portal.px + 1, portal.py + 1, 14, 14, '#eef7ff', '#8ac6ea');
    if (Sprite.drawIcon) {
      Sprite.drawIcon(ctx, 'anchor', portal.px + 1, portal.py + 1, 14);
    }
  }

  function drawHybridChest(chest) {
    if (!(chest.active || chest.opened)) {
      return;
    }
    drawPixelShadow(chest.px + 8, chest.py + 15, 12, 'rgba(52, 34, 18, 0.18)');
    if (!Sprite.drawChestSprite || !Sprite.drawChestSprite(ctx, chest.tier || 'common', chest.px + 8, chest.py + 18, chest.opened)) {
      Sprite.frame(ctx, chest.px, chest.py + 2, 16, 12, chest.opened ? '#fff7dc' : '#ffe7a8', '#b8893d');
      Sprite.rect(ctx, chest.px + 2, chest.py + 5, 12, 5, chest.opened ? '#f4dca2' : '#d89e4b');
      Sprite.rect(ctx, chest.px + 6, chest.py + 4, 4, 3, '#8d5c2a');
    }
  }

  function drawLootDrop(drop) {
    drawPixelShadow(drop.x, drop.y + 7, 8, 'rgba(46, 42, 34, 0.14)');
    if (drop.itemId === 'bombgear') {
      drawPulseHalo(drop.x, drop.y + 1, 18 + Math.sin(state.time * 6) * 2, 'rgba(255,96,72,0.22)');
      drawGroundRing(drop.x, drop.y + 8, 10 + Math.sin(state.time * 4.8) * 2, '#ff9a7a', 'rgba(255,96,72,0.08)', 1.6, 0.62);
    } else if (drop.itemId === 'embergear') {
      drawPulseHalo(drop.x, drop.y + 1, 18 + Math.sin(state.time * 6.4) * 2, 'rgba(255,164,74,0.2)');
      drawGroundRing(drop.x, drop.y + 8, 10 + Math.sin(state.time * 5.2) * 2, '#ffd18a', 'rgba(255,164,74,0.07)', 1.6, 0.62);
    }
    Sprite.frame(ctx, drop.x - 7, drop.y - 7, 14, 14, '#fffdf7', '#d7c9b0');
    if (Sprite.drawIcon) {
      Sprite.drawIcon(ctx, getItemIconName(drop.itemId), drop.x - 7, drop.y - 7, 14);
    }
  }

  function drawBossUi(play) {
    const activeBoss = (play.boss && !play.boss.dying) ? play.boss : ((play.extraBosses || []).find((boss) => boss && !boss.dying) || play.boss);
    if (!activeBoss) {
      return;
    }
    const ui = getUiTheme(play.theme);
    const hpRate = activeBoss.maxHp ? activeBoss.hp / activeBoss.maxHp : 0;
    Sprite.frame(ctx, 40, 60, 280, 26, 'rgba(255,255,255,0.84)', ui.shellBorder);
    Sprite.label(ctx, activeBoss.title || '区域 Boss', 50, 65, ui.text, 12, 'left');
    Sprite.label(ctx, `${Math.max(0, Math.ceil(hpRate * 100))}%`, 312, 65, hpRate <= 0.08 ? ui.gold : ui.coral, 11, 'right');
    Sprite.rect(ctx, 128, 69, 178, 10, '#edf2f7');
    Sprite.rect(ctx, 128, 69, 178 * hpRate, 10, hpRate <= 0.08 ? '#ffd36d' : '#ff878e');
    Sprite.frame(ctx, 22, 60, 86, 24, ui.panelSoft, ui.shellBorder);
    drawHealthHud(28, 64, play.player.hp, 3, 16, 0);
    if (play.bossMinions.length) {
      Sprite.frame(ctx, 244, 86, 68, 18, ui.panelSoft, ui.shellBorder);
      Sprite.label(ctx, `小怪 ${play.bossMinions.length}`, 278, 90, ui.text, 10, 'center');
    }
    if (play.darkPulse.timer > 0) {
      Sprite.frame(ctx, 48, 86, 88, 18, ui.accentSoft, ui.shellBorder);
      Sprite.label(ctx, '暗脉冲中', 92, 90, '#51697c', 10, 'center');
    }
    if (hpRate <= 0.08) {
      Sprite.frame(ctx, 214, 86, 98, 18, '#fff8d8', '#e1c26d');
      Sprite.label(ctx, '濒死停手', 263, 90, '#7d6020', 10, 'center');
    }
    if (activeBoss.damageReduction && !(activeBoss.critShieldBreak > 0)) {
      Sprite.frame(ctx, 46, 86, 128, 18, '#eef8ff', '#8fc3e6');
      Sprite.label(ctx, '暴雨护甲 35% 减伤', 110, 90, '#436782', 10, 'center');
    } else if (activeBoss.damageReduction) {
      Sprite.frame(ctx, 46, 86, 128, 18, '#fff4e1', '#f0be7d');
      Sprite.label(ctx, '暴击已破甲', 110, 90, '#8b5d25', 10, 'center');
    }
    if (play.hybrid && play.hybrid.bossWaveTotal > 0) {
      Sprite.frame(ctx, 170, 86, 132, 18, ui.panelSoft, ui.shellBorder);
      Sprite.label(ctx, `波次 ${play.hybrid.bossWaveIndex}/${play.hybrid.bossWaveTotal}`, 236, 90, ui.text, 10, 'center');
    }
  }

  function drawBossWarning(warning) {
    if (!warning.exploded) {
      const pulse = 0.72 + Math.sin(Math.max(0, warning.timer) * 18) * 0.18;
      ctx.save();
      ctx.globalAlpha = 0.16 + (1 - Math.max(0, warning.timer) / 1.1) * 0.2;
      ctx.fillStyle = '#ff9f84';
      ctx.beginPath();
      ctx.arc(warning.x, warning.y, warning.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#ff6f72';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(warning.x, warning.y, warning.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      drawPulseHalo(warning.x, warning.y, warning.radius + 4, 'rgba(255,159,132,0.24)');
    }
  }

  function drawBossMinion(minion) {
    drawPixelShadow(minion.x + 7, minion.y + 12, 10, 'rgba(39, 28, 54, 0.2)');
    if (minion.executeTimer > 0) {
      drawPulseHalo(minion.x + 7, minion.y + 6, 13, 'rgba(207,255,244,0.22)');
    }
    const shake = minion.hitFlash > 0 ? ((Math.floor(state.time * 52) % 2) ? 1 : -1) : 0;
    if (!Sprite.drawObjectSprite || !Sprite.drawObjectSprite(ctx, minion.spriteKey || 'slimeFire', minion.x - 5 + shake, minion.y - 5, 24, 24, minion.hitFlash || 0)) {
      Sprite.frame(ctx, minion.x + shake, minion.y + 2, 14, 10, minion.hitFlash > 0 ? '#ffb1b1' : '#d5c8ff', '#7c67b5');
      Sprite.rect(ctx, minion.x + 2 + shake, minion.y + 4, 10, 6, minion.hitFlash > 0 ? '#ff7171' : '#a08ce4');
      Sprite.rect(ctx, minion.x + 3 + shake, minion.y + 5, 2, 2, '#fff6ff');
      Sprite.rect(ctx, minion.x + 9 + shake, minion.y + 5, 2, 2, '#fff6ff');
      Sprite.rect(ctx, minion.x + 5 + shake, minion.y + 9, 4, 2, '#7f68c8');
    }
  }

  function drawEventChest(x, y, reward) {
    const kind = reward === 'coins' ? 'gold' : (reward === 'speed' ? 'supply' : 'rare');
    if (!Sprite.drawAtlasChest(ctx, kind, x, y, Math.floor(state.time * 6) % 4)) {
      const accent = reward === 'coins' ? '#ffe58b' : (reward === 'potion' ? '#ffb0b5' : reward === 'decoy' ? '#d9c4ff' : '#8ae59d');
      Sprite.frame(ctx, x, y, 14, 12, '#fff2cf', '#c9a66b');
      Sprite.rect(ctx, x + 1, y + 5, 12, 2, '#c99346');
      Sprite.rect(ctx, x + 5, y + 1, 4, 10, accent);
    }
  }

  function drawMerchantNpc(x, y) {
    const frame = Math.floor(state.time * 5) % 2;
    if (!Sprite.drawAtlasMerchant(ctx, x, y, frame)) {
      Sprite.frame(ctx, x, y + 1, 12, 14, '#f5e7d0', '#baa27d');
      Sprite.rect(ctx, x + 2, y + 2, 8, 4, '#f6c39a');
      Sprite.rect(ctx, x + 3, y + 6, 6, 4, '#98d3ff');
      Sprite.rect(ctx, x + 2, y - 3, 10, 3, '#f0d689');
      Sprite.label(ctx, '$', x + 6, y - 11, '#f0d689', 9, 'center');
      return;
    }
    Sprite.drawAtlasMerchantSign(ctx, x - 2, y - 16);
  }

  function drawPuzzleRune(rune) {
    const fill = rune.active ? '#ffe58b' : '#f3ecd8';
    const border = rune.active ? '#d7b867' : '#bda988';
    Sprite.frame(ctx, rune.px + 1, rune.py + 1, 14, 14, fill, border);
    Sprite.rect(ctx, rune.px + 4, rune.py + 4, 8, 8, rune.active ? '#fff9d8' : '#e7dcc4');
    Sprite.label(ctx, rune.label, rune.px + 8, rune.py + 4, rune.active ? '#765426' : '#6b6258', 9, 'center');
  }

  function drawPuzzleMirror(mirror) {
    Sprite.frame(ctx, mirror.px + 1, mirror.py + 1, 14, 14, '#eef7ff', '#9fbad1');
    Sprite.rect(ctx, mirror.px + 3, mirror.py + 3, 10, 10, '#d9f1ff');
    if (mirror.state === 0) {
      Sprite.rect(ctx, mirror.px + 4, mirror.py + 4, 2, 2, '#4e86a8');
      Sprite.rect(ctx, mirror.px + 6, mirror.py + 6, 2, 2, '#4e86a8');
      Sprite.rect(ctx, mirror.px + 8, mirror.py + 8, 2, 2, '#4e86a8');
      Sprite.rect(ctx, mirror.px + 10, mirror.py + 10, 2, 2, '#4e86a8');
    } else {
      Sprite.rect(ctx, mirror.px + 10, mirror.py + 4, 2, 2, '#4e86a8');
      Sprite.rect(ctx, mirror.px + 8, mirror.py + 6, 2, 2, '#4e86a8');
      Sprite.rect(ctx, mirror.px + 6, mirror.py + 8, 2, 2, '#4e86a8');
      Sprite.rect(ctx, mirror.px + 4, mirror.py + 10, 2, 2, '#4e86a8');
    }
  }

  function drawMirrorBeam(play) {
    ctx.save();
    ctx.strokeStyle = '#ffd972';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.9;
    play.beamSegments.forEach((segment) => {
      ctx.beginPath();
      ctx.moveTo(segment.x1, segment.y1);
      ctx.lineTo(segment.x2, segment.y2);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawPuzzleReceiver(receiver) {
    const fill = receiver.lit ? '#fff0aa' : '#d8e1e7';
    const border = receiver.lit ? '#d6b46a' : '#9db0bb';
    Sprite.frame(ctx, receiver.px + 1, receiver.py + 1, 14, 14, fill, border);
    Sprite.rect(ctx, receiver.px + 4, receiver.py + 4, 8, 8, receiver.lit ? '#fffbea' : '#f1f4f6');
    if (receiver.lit) {
      Sprite.drawSparkle(ctx, receiver.px + 5, receiver.py - 4, '#fff2a8');
    }
  }

  function drawPuzzleValve(valve) {
    Sprite.frame(ctx, valve.px + 1, valve.py + 1, 14, 14, valve.on ? '#dff6eb' : '#f2e6d6', valve.on ? '#86c79d' : '#b89f84');
    Sprite.rect(ctx, valve.px + 4, valve.py + 6, 8, 2, valve.on ? '#5da978' : '#936e4a');
    Sprite.rect(ctx, valve.px + 7, valve.py + 3, 2, 8, valve.on ? '#5da978' : '#936e4a');
  }

  function drawPuzzleTerminal(door, active) {
    Sprite.frame(ctx, door.px + 1, door.py + 1, 14, 14, active ? '#e8f8ea' : '#f2e8da', active ? '#8ac49b' : '#b9a489');
    Sprite.rect(ctx, door.px + 4, door.py + 4, 8, 4, active ? '#bdf0c9' : '#ddd0c0');
    Sprite.rect(ctx, door.px + 5, door.py + 10, 6, 2, active ? '#5daa78' : '#8a7762');
  }

  function drawGuardSensor(guard) {
    const centerX = guard.x + 6;
    const centerY = guard.y + 7;
    const facingAngle = Math.atan2(getFacingVector(guard.facing).y, getFacingVector(guard.facing).x);
    const halfAngle = getGuardVisionAngle(guard) * 0.5;
    const radius = getGuardVisionRadius(guard);
    const alertRatio = (guard.alert || 0) / 100;
    ctx.save();
    ctx.globalAlpha = 0.16 + alertRatio * 0.22;
    ctx.fillStyle = guard.mode === 'chase' ? '#ff8f95' : (guard.mode === 'suspicious' ? '#ffd58b' : '#ffe58b');
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, facingAngle - halfAngle, facingAngle + halfAngle);
    ctx.closePath();
    ctx.fill();
    if (guard.patrolRoute && guard.patrolRoute.length > 1) {
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = '#95f2ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      guard.patrolRoute.forEach((point, index) => {
        const px = point.x * TILE_SIZE + 8;
        const py = point.y * TILE_SIZE + 8;
        if (index === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      });
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGuardMarker(guard) {
    const x = guard.x - 1;
    const y = guard.y - 12;
    if (guard.mode === 'stunned') {
      Sprite.frame(ctx, x, y, 12, 10, '#e8f4ff', '#bdd7eb');
      if (Sprite.drawIcon) {
        Sprite.drawIcon(ctx, 'ice', x - 2, y - 3, 14);
      } else {
        Sprite.label(ctx, '*', x + 6, y + 1, '#6d97c8', 10, 'center');
      }
    } else if (guard.mode === 'suspicious') {
      Sprite.frame(ctx, x, y, 12, 10, '#fff7d8', '#e6d29a');
      Sprite.label(ctx, '?', x + 6, y + 1, '#b9892f', 10, 'center');
    } else if (guard.mode === 'chase') {
      const blink = Math.floor(state.time * 8) % 2 === 0;
      Sprite.frame(ctx, x, y, 12, 10, blink ? '#ffd9db' : '#ffecee', '#efc6b5');
      Sprite.label(ctx, '!', x + 6, y + 1, '#d87579', 10, 'center');
    }
  }

  function drawNearbyPrompt(play) {
    const ui = getUiTheme(play.theme);
    const nearby = findNearbyInteractive(play);
    if (!nearby) {
      return;
    }
    const promptMap = {
      merchant: '按 互 交易',
      site: '按 互 调查',
      portal: play.hybrid && play.hybrid.phase === 'reward' ? '按 互 离场' : '按 互 进入',
      chest: '按 互 开箱',
      loot: '按 互 收取',
      grave: '按 互 献祭',
      shrine: '按 互 点亮',
      sign: '按 互 读牌',
      rune: '按 互 启动',
      mirror: '按 互 翻面',
      valve: '按 互 扳动',
      door: '按 互 查看',
      npc: '按 互 交谈'
    };
    Sprite.frame(ctx, 130, 326, 100, 24, '#fffefb', ui.shellBorder);
    Sprite.rect(ctx, 138, 331, 12 + (Math.sin(state.time * 10) + 1) * 7, 2, ui.accent);
    if (Sprite.drawIcon) {
      Sprite.drawIcon(ctx, getNearbyIconName(nearby.kind, nearby.target), 138, 330, 16);
    }
    Sprite.label(ctx, promptMap[nearby.kind] || '按 互 互动', 185, 333, ui.text, 12, 'center');
  }

  function drawHybridMapFrame(play, x, y, w, h) {
    const cols = play.level.grid[0].length;
    const rows = play.level.grid.length;
    const cell = Math.max(2, Math.floor(Math.min((w - 8) / cols, (h - 8) / rows)));
    const mapW = cols * cell;
    const mapH = rows * cell;
    const originX = x + Math.floor((w - mapW) * 0.5);
    const originY = y + Math.floor((h - mapH) * 0.5);
    Sprite.frame(ctx, x, y, w, h, '#fffefb', '#d8c8ae');
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const discovered = play.hybrid.fullMapReveal || play.discovered[row][col];
        const tile = play.level.grid[row][col];
        let color = '#e8e1d4';
        if (!discovered) {
          color = '#f2ede4';
        } else if (tile === TILE.WALL) {
          color = '#bba98b';
        } else if (tile === TILE.WATER) {
          color = '#9fd8ff';
        } else if (tile === TILE.WHEAT) {
          color = '#f1da7b';
        } else if (tile === TILE.EXIT) {
          color = play.hybrid.exitOpen ? '#9ee0b0' : '#efc0b0';
        }
        Sprite.rect(ctx, originX + col * cell, originY + row * cell, cell, cell, color);
      }
    }
    play.envSites.forEach((site) => {
      const sx = originX + site.x * cell;
      const sy = originY + site.y * cell;
      Sprite.rect(ctx, sx, sy, Math.max(2, cell), Math.max(2, cell), site.done ? '#8fd2ab' : '#ffcf8b');
    });
    if (play.merchantSpot && play.merchantSpot.active) {
      Sprite.rect(ctx, originX + play.merchantSpot.x * cell, originY + play.merchantSpot.y * cell, Math.max(2, cell), Math.max(2, cell), '#8fd9ff');
    }
    if (play.portalSpot && play.portalSpot.active) {
      Sprite.rect(ctx, originX + play.portalSpot.x * cell, originY + play.portalSpot.y * cell, Math.max(2, cell), Math.max(2, cell), '#8ac6ea');
    }
    if (play.rewardChest && (play.rewardChest.active || play.rewardChest.opened)) {
      Sprite.rect(ctx, originX + play.rewardChest.x * cell, originY + play.rewardChest.y * cell, Math.max(2, cell), Math.max(2, cell), '#f2c96d');
    }
    play.roamers.forEach((roamer) => {
      Sprite.rect(ctx, originX + Math.floor(roamer.x / TILE_SIZE) * cell, originY + Math.floor(roamer.y / TILE_SIZE) * cell, Math.max(2, cell), Math.max(2, cell), '#d5b2ff');
    });
    play.minibosses.forEach((mini) => {
      Sprite.rect(ctx, originX + Math.floor(mini.x / TILE_SIZE) * cell, originY + Math.floor(mini.y / TILE_SIZE) * cell, Math.max(2, cell), Math.max(2, cell), '#ffba8f');
    });
    if (play.boss) {
      Sprite.rect(ctx, originX + Math.floor(play.boss.x / TILE_SIZE) * cell, originY + Math.floor(play.boss.y / TILE_SIZE) * cell, Math.max(2, cell), Math.max(2, cell), '#ff8f95');
    }
    Sprite.rect(ctx, originX + Math.floor((play.player.x + 6) / TILE_SIZE) * cell, originY + Math.floor((play.player.y + 7) / TILE_SIZE) * cell, Math.max(2, cell), Math.max(2, cell), '#ff8f95');
  }

  function drawHybridMapOverlay(play) {
    const ui = getUiTheme(play.theme);
    ctx.fillStyle = 'rgba(255, 252, 247, 0.86)';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    drawPaperCard(42, 108, 276, 214, '#fffefb', ui.shellBorder, ui.shadow);
    Sprite.label(ctx, '区域大地图', 180, 126, ui.text, 18, 'center');
    Sprite.label(ctx, play.hybrid.fullMapReveal ? '已完全标注' : '未完全标注', 180, 146, ui.softText, 10, 'center');
    drawHybridMapFrame(play, 62, 160, 236, 134);
    Sprite.label(ctx, `小怪 ${play.hybrid.defeatedRoamers}/${play.hybrid.totalRoamers} · 头目 ${play.hybrid.defeatedMinibosses}/${play.hybrid.totalMinibosses}`, 180, 302, ui.softText, 10, 'center');
    drawSmallButton(132, 328, 96, 22, '收起地图', toggleMapView);
  }

  function drawTopBar(play) {
    const ui = getUiTheme(play.theme);
    drawPaperCard(10, 8, 198, 28, 'rgba(255,255,255,0.84)', ui.shellBorder, ui.shadow);
    drawSticker(18, 11, 34, 13, play.theme === 'day' ? '晨雾' : '夜幕', play.theme === 'day' ? '#97dcff' : '#9a9fff', '#fffdf7', ui.stickerBorder);
    Sprite.label(ctx, '战役', 58, 7, getSceneAccent(play), 10, 'left');
    Sprite.label(ctx, '大地图行动', 58, 18, ui.text, 14, 'left');
    Sprite.label(ctx, Number.isFinite(play.campaignStep)
      ? `第 ${play.campaignStep + 1} 幕 · ${getCampaignStageLabel(play.campaignStep, play.level.progress)}`
      : getPlaySceneLabel(play), 58, 31, ui.softText, 9, 'left');
    if (play.hybrid.active) {
      Sprite.rect(ctx, play.ui.mapButton.x + 1, play.ui.mapButton.y + 3, play.ui.mapButton.w, play.ui.mapButton.h, ui.shadow);
      Sprite.frame(ctx, play.ui.mapButton.x, play.ui.mapButton.y, play.ui.mapButton.w, play.ui.mapButton.h, 'rgba(255,255,255,0.86)', ui.line);
      Sprite.rect(ctx, play.ui.mapButton.x + 3, play.ui.mapButton.y + 4, play.ui.mapButton.w - 6, 2, 'rgba(151,220,255,0.95)');
      Sprite.label(ctx, play.hybrid.mapExpanded ? '收图' : '地图', play.ui.mapButton.x + play.ui.mapButton.w * 0.5, play.ui.mapButton.y + 5, ui.text, 11, 'center');
      state.hitAreas.push({
        shape: 'rect',
        x: play.ui.mapButton.x,
        y: play.ui.mapButton.y,
        w: play.ui.mapButton.w,
        h: play.ui.mapButton.h,
        kind: 'tap',
        action: toggleMapView
      });
    }
    Sprite.rect(ctx, play.ui.bagButton.x + 1, play.ui.bagButton.y + 3, play.ui.bagButton.w, play.ui.bagButton.h, ui.shadow);
    Sprite.frame(ctx, play.ui.bagButton.x, play.ui.bagButton.y, play.ui.bagButton.w, play.ui.bagButton.h, 'rgba(255,255,255,0.86)', ui.line);
    Sprite.rect(ctx, play.ui.bagButton.x + 3, play.ui.bagButton.y + 4, play.ui.bagButton.w - 6, 2, 'rgba(255,211,109,0.95)');
    Sprite.label(ctx, '背包', play.ui.bagButton.x + play.ui.bagButton.w * 0.5, play.ui.bagButton.y + 5, ui.text, 11, 'center');
    state.hitAreas.push({
      shape: 'rect',
      x: play.ui.bagButton.x,
      y: play.ui.bagButton.y,
      w: play.ui.bagButton.w,
      h: play.ui.bagButton.h,
      kind: 'tap',
      action: toggleBackpack
    });
    Sprite.rect(ctx, play.ui.pauseButton.x + 1, play.ui.pauseButton.y + 3, play.ui.pauseButton.w, play.ui.pauseButton.h, ui.shadow);
    Sprite.frame(ctx, play.ui.pauseButton.x, play.ui.pauseButton.y, play.ui.pauseButton.w, play.ui.pauseButton.h, 'rgba(255,255,255,0.86)', ui.line);
    Sprite.rect(ctx, play.ui.pauseButton.x + 3, play.ui.pauseButton.y + 4, play.ui.pauseButton.w - 6, 2, 'rgba(255,163,177,0.95)');
    Sprite.label(ctx, '菜单', play.ui.pauseButton.x + play.ui.pauseButton.w * 0.5, play.ui.pauseButton.y + 5, ui.text, 11, 'center');
    state.hitAreas.push({
      shape: 'rect',
      x: play.ui.pauseButton.x,
      y: play.ui.pauseButton.y,
      w: play.ui.pauseButton.w,
      h: play.ui.pauseButton.h,
      kind: 'tap',
      action: openPauseMenu
    });
  }

  function drawQuickbar(play) {
    const ui = getUiTheme(play.theme);
    const barX = 12;
    const barY = 470;
    drawPaperCard(barX, barY + 1, 332, 44, 'rgba(255,255,255,0.86)', ui.shellBorder, ui.shadow);
    drawSticker(barX + 22, barY - 7, 42, 13, `Lv ${play.progression.level}`, play.progression.level >= MAX_LEVEL ? '#ffe08a' : '#95dfff', '#fffdf7', ui.stickerBorder);
    drawSticker(barX + 166, barY - 7, 40, 13, '补给', '#95dfff', '#fffdf7', ui.stickerBorder);
    drawHealthHud(barX + 10, barY + 8, play.player.hp, 3, 14, 0);
    drawShieldHud(barX + 58, barY + 7, play.inventory.shieldReady ? 1 : 0, 1, 15, 0);
    if (Sprite.drawIcon) {
      const weaponIcon = getItemIconName(play.inventory.weapon);
      Sprite.frame(ctx, barX + 80, barY + 5, 20, 20, 'rgba(255,255,255,0.3)', ui.line);
      Sprite.drawIcon(ctx, weaponIcon, barX + 82, barY + 7, 16);
      Sprite.drawIcon(ctx, 'coin', barX + 108, barY + 8, 14);
      Sprite.drawIcon(ctx, 'exp', barX + 108, barY + 20, 14);
    }
    Sprite.label(ctx, getWeaponDisplayName(play.inventory.weapon), barX + 126, barY + 6, ui.text, 11, 'left');
    Sprite.label(ctx, String(state.profile.coins), barX + 126, barY + 18, ui.gold, 10, 'left');
    Sprite.label(ctx, play.progression.level >= MAX_LEVEL ? '满级觉醒' : `经验 ${play.progression.exp}/${play.progression.nextExp}`, barX + 126, barY + 18, ui.blue, 9, 'left');
    drawMeter(barX + 126, barY + 25, 82, 5, play.progression.level >= MAX_LEVEL ? 1 : (play.progression.nextExp ? play.progression.exp / play.progression.nextExp : 0), play.progression.level >= MAX_LEVEL ? ui.gold : ui.blue, ui.panelMute);
    if (play.progression.ascensionUnlocked) {
      Sprite.label(ctx, '伤害 x2 / 本局免伤', barX + 126, barY + 31, ui.gold, 8, 'left');
    }
    if (play.special.bombGearTimer > 0 && Sprite.drawIcon) {
      Sprite.drawIcon(ctx, 'bomb', barX + 208, barY + 30, 12);
      Sprite.label(ctx, `${play.special.bombGearTimer.toFixed(1)}s`, barX + 222, barY + 31, '#ff9b53', 8, 'left');
    }
    if (play.special.emberGearTimer > 0 && Sprite.drawIcon) {
      Sprite.drawIcon(ctx, 'fire', barX + 258, barY + 30, 12);
      Sprite.label(ctx, `${play.special.emberGearTimer.toFixed(1)}s`, barX + 272, barY + 31, '#ffb56c', 8, 'left');
    }
    Sprite.label(ctx, '道具', barX + 178, barY - 4, ui.softText, 9, 'left');
    play.inventory.quickSlots.forEach((slot, index) => {
      const x = barX + 170 + index * 42;
      const active = slot.count > 0;
      Sprite.rect(ctx, x + 1, barY + 9, 30, 22, ui.shadow);
      Sprite.frame(ctx, x, barY + 6, 30, 22, active ? slot.color : 'rgba(255,255,255,0.58)', ui.line);
      if (active) {
        Sprite.rect(ctx, x + 3, barY + 9, 24, 2, 'rgba(255,255,255,0.72)');
      }
      if (Sprite.drawIcon) {
        Sprite.drawIcon(ctx, getItemIconName(slot.id), x + 2, barY + 8, 13);
      }
      Sprite.label(ctx, `x${slot.count}`, x + 20, barY + 10, active ? '#4f463e' : ui.softText, 8, 'center');
      state.hitAreas.push({
        shape: 'rect',
        x: x - 2,
        y: barY + 4,
        w: 34,
        h: 26,
        kind: 'tap',
        action: () => useQuickSlot(slot.id)
      });
    });
    if (isCampaignStage(play, 9)) {
      const stacks = play.special.critRampStacks || 0;
      drawPaperCard(250, 438, 94, 28, 'rgba(255,255,255,0.82)', ui.shellBorder, ui.shadow);
      Sprite.label(ctx, `暴击层数 ${stacks}/40`, 297, 444, ui.text, 9, 'center');
      Sprite.label(ctx, play.special.critRampReady ? '已满层 +30% 暴率' : `攻速 +${stacks * 2}%`, 297, 457, play.special.critRampReady ? ui.gold : ui.coral, 8, 'center');
    }
  }

  function drawCompanionHud(play) {
    if (!play.allies || !play.allies.length) {
      return;
    }
    const ui = getUiTheme(play.theme);
    play.allies.slice(0, 3).forEach((ally, index) => {
      const y = 104 + index * 52;
      const profile = getAllyWeaponProfile(ally.weapon);
      const ratio = ally.maxHp ? clamp(ally.hp / ally.maxHp, 0, 1) : 0;
      const cardX = VIEW.x + VIEW.w - 110;
      Sprite.rect(ctx, cardX + 2, y + 4, 100, 38, ui.shadow);
      Sprite.frame(ctx, cardX, y, 100, 38, 'rgba(255,255,255,0.82)', ui.line);
      Sprite.rect(ctx, cardX + 4, y + 4, 58, 2, profile.color);
      Sprite.rect(ctx, cardX + 70, y + 4, 22, 2, ui.gold);
      Sprite.label(ctx, ally.name.slice(0, 5), cardX + 6, y + 2, ui.text, 9, 'left');
      Sprite.label(ctx, `${Math.round(ratio * 100)}%`, cardX + 92, y + 2, ratio <= 0.3 ? ui.coral : ui.softText, 8, 'right');
      Sprite.label(ctx, profile.role, cardX + 6, y + 11, ui.softText, 8, 'left');
      Sprite.label(ctx, getWeaponDisplayName(ally.weapon).slice(0, 2), cardX + 92, y + 11, ui.plum, 9, 'right');
      drawHealthRatioHud(cardX + 6, y + 18, ratio, 4, 10, 0);
      drawMeter(cardX + 6, y + 31, 88, 5, ratio, profile.color, 'rgba(196,216,236,0.6)');
      Sprite.label(ctx, `四心制 ${Math.max(0, Math.round(ratio * 400)) / 100}/4`, cardX + 6, y + 36, ui.softText, 7, 'left');
    });
  }

  function drawControlHints(play) {
    const ui = getUiTheme(play.theme);
    ctx.save();
    ctx.globalAlpha = 0.65;
    Sprite.rect(ctx, 18, 79, 324, 1, ui.line);
    ctx.restore();
    if (Sprite.drawIcon) {
      Sprite.drawIcon(ctx, play.hybrid.active ? 'anchor' : 'question', 28, 70, 14);
    }
    if (play.hybrid.active) {
      Sprite.label(ctx, '先清小怪和小 Boss，再进传送门打大 Boss，宝箱掉落会进背包。', 188, 72, ui.text, 10, 'center');
    } else if (play.route === 'battle' && play.levelIndex === 2) {
      Sprite.label(ctx, '左下移动，右下摇杆蓄力；所有武器都改成了近战，松手就是一记挥砍。', 188, 72, ui.text, 10, 'center');
    } else if (play.route === 'battle') {
      Sprite.label(ctx, '左下摇杆移动，“冲”可突进；现在全武器都是近战，贴身压场更重要。', 188, 72, ui.text, 10, 'center');
    } else if (play.levelIndex === 0) {
      Sprite.label(ctx, '先读提示牌，再靠近符石按“互”尝试顺序；武器会一直陪你到终局。', 188, 72, ui.text, 10, 'center');
    } else if (play.levelIndex === 1) {
      Sprite.label(ctx, '靠近折镜按“互”翻面，让日光一路折到终点锁。', 188, 72, ui.text, 10, 'center');
    } else {
      Sprite.label(ctx, '先读三条渠牌，再决定三道闸门的开关组合。', 188, 72, ui.text, 10, 'center');
    }
  }

  function drawObjectivePanel(play) {
    const ui = getUiTheme(play.theme);
    if (play.special && play.special.duckrope) {
      const duck = play.special.duckrope;
      drawPaperCard(16, 102, 82, 142, ui.panel, ui.shellBorder, ui.shadow);
      drawSectionTag(28, 94, '拔河卡', ui, 'blue');
      Sprite.label(ctx, '手速', 26, 128, ui.text, 11, 'left');
      drawMeter(26, 146, 62, 8, duck.progress / duck.target, ui.blue, ui.panelMute);
      Sprite.label(ctx, `${Math.round(duck.progress)} / ${duck.target}`, 57, 160, ui.softText, 10, 'center');
      drawPaperCard(262, 102, 82, 142, ui.panel, ui.shellBorder, ui.shadow);
      drawSectionTag(274, 94, '剧情卡', ui, 'coral');
      Sprite.label(ctx, duck.npcA.arrived ? 'A 已到场' : 'A 入场中', 303, 128, ui.text, 10, 'center');
      Sprite.label(ctx, duck.npcB.active ? 'B 已围观' : 'B 未出现', 303, 146, ui.softText, 10, 'center');
      Sprite.label(ctx, duck.success ? '拔河完成' : '狂点攻击键', 303, 168, duck.success ? ui.gold : ui.coral, 10, 'center');
      return;
    }
    if (play.hybrid.active) {
      drawHybridObjectivePanel(play, ui);
      return;
    }
    const sideFill = ui.panel;
    const sideText = ui.text;
    const softText = ui.softText;
    const strongAccent = ui.gold;
    const okAccent = ui.ok;

    drawPaperCard(16, 102, 82, 142, sideFill, ui.shellBorder, ui.shadow);
    drawSectionTag(28, 94, '行动卡', ui, play.route === 'battle' ? 'blue' : 'gold');
    Sprite.frame(ctx, 24, 128, 66, 18, ui.panelSoft, ui.shellBorder);
    Sprite.label(ctx, getPlaySceneLabel(play), 57, 132, sideText, 10, 'center');

    if (play.route === 'battle') {
      const loreCount = play.loreMarks.filter((mark) => mark.read).length;
      const shrineCount = play.shrines.filter((shrine) => shrine.active).length;
      const maxAlert = play.guards.reduce((best, guard) => Math.max(best, guard.alert || 0), 0);
      const guardMode = play.guards.reduce((mode, guard) => {
        const rank = guard.mode === 'chase' ? 3 : (guard.mode === 'suspicious' ? 2 : 1);
        const bestRank = mode === 'chase' ? 3 : (mode === 'suspicious' ? 2 : 1);
        return rank > bestRank ? guard.mode : mode;
      }, 'patrol');
      Sprite.label(ctx, '状态', 26, 156, sideText, 11, 'left');
      drawHealthHud(26, 170, play.player.hp, 3, 16, 0);
      if (play.levelIndex === 0) {
        Sprite.label(ctx, `札记 ${loreCount}/${play.loreMarks.length || 0}`, 26, 188, sideText, 11, 'left');
      } else if (play.levelIndex === 1) {
        Sprite.label(ctx, `警戒 ${Math.ceil(maxAlert)}%`, 26, 188, sideText, 11, 'left');
        drawMeter(26, 204, 62, 8, maxAlert / 100, maxAlert > 70 ? ui.alert : okAccent, ui.panelMute);
      } else {
        Sprite.label(ctx, `阶段 ${play.lastBossPhase}`, 26, 188, sideText, 11, 'left');
        drawMeter(26, 204, 62, 8, play.boss.hp / play.boss.maxHp, strongAccent, ui.panelMute);
      }
      if (play.levelIndex === 0) {
        drawMeter(26, 204, 62, 8, play.loreMarks.length ? loreCount / play.loreMarks.length : 0, okAccent, ui.panelMute);
        Sprite.label(ctx, play.flags.loreTrailShown ? '路已显形' : '残页搜寻', 57, 218, softText, 10, 'center');
      } else if (play.levelIndex === 1) {
        Sprite.label(ctx, play.inTallGrass ? '已潜伏' : getGuardModeLabel(guardMode), 57, 218, softText, 10, 'center');
      } else {
        Sprite.label(ctx, play.attackState.aiming ? '正在瞄准' : (play.player.dashCooldown > 0 ? '冲刺冷却' : '冲刺就绪'), 57, 218, softText, 10, 'center');
      }
    } else {
      const readSigns = play.signs.filter((sign) => sign.read).length;
      Sprite.label(ctx, `冲刺 ${play.player.dashCooldown > 0 ? '冷却' : '就绪'}`, 26, 156, sideText, 11, 'left');
      drawMeter(26, 172, 62, 8, 1 - (play.player.dashCooldown / 2.8), okAccent, ui.panelMute);
      if (play.levelIndex === 0) {
        Sprite.label(ctx, `顺序 ${play.runeProgress}/${play.level.runeSolution.length}`, 26, 188, sideText, 11, 'left');
        drawMeter(26, 204, 62, 8, play.level.runeSolution.length ? play.runeProgress / play.level.runeSolution.length : 0, strongAccent, ui.panelMute);
        Sprite.label(ctx, play.flags.runeSolved ? '底座已亮' : `线索 ${readSigns}/${play.signs.length || 0}`, 57, 218, softText, 10, 'center');
      } else if (play.levelIndex === 1) {
        Sprite.label(ctx, `通光 ${play.litReceivers}/${play.receivers.length || 0}`, 26, 188, sideText, 11, 'left');
        drawMeter(26, 204, 62, 8, play.receivers.length ? play.litReceivers / play.receivers.length : 0, strongAccent, ui.panelMute);
        Sprite.label(ctx, play.flags.mirrorSolved ? '终端可用' : `刻痕 ${readSigns}/${play.signs.length || 0}`, 57, 218, softText, 10, 'center');
      } else {
        const rules = getValveRuleStates(play);
        const correctCount = rules.filter((rule) => rule.ok).length;
        Sprite.label(ctx, `逻辑 ${correctCount}/${rules.length}`, 26, 188, sideText, 11, 'left');
        drawMeter(26, 204, 62, 8, rules.length ? correctCount / rules.length : 0, strongAccent, ui.panelMute);
        Sprite.label(ctx, play.flags.bridgeOpen ? '水桥已升' : `渠牌 ${readSigns}/${play.signs.length || 0}`, 57, 218, softText, 10, 'center');
      }
    }

    drawPaperCard(262, 102, 82, 142, sideFill, ui.shellBorder, ui.shadow);
    drawSectionTag(274, 94, '目标卡', ui, 'coral');
    if (play.route === 'battle') {
      if (play.levelIndex === 0) {
        Sprite.label(ctx, '目标', 274, 132, sideText, 11, 'left');
        Sprite.label(ctx, '走出迷雾', 274, 148, sideText, 11, 'left');
        Sprite.label(ctx, '残页会照路', 274, 166, softText, 10, 'left');
        drawTinyFlag(274, 184, play.flags.loreTrailShown, '微光路径', okAccent, softText);
        drawTinyFlag(274, 204, onExitTile(play), '靠近出口', strongAccent, softText);
      } else if (play.levelIndex === 1) {
        Sprite.label(ctx, '目标', 274, 132, sideText, 11, 'left');
        Sprite.label(ctx, `萤火 ${play.collectedLights}/${play.collectibles.length}`, 274, 148, sideText, 11, 'left');
        Sprite.label(ctx, `连携 ${play.comboBest} / 点灯 ${play.shrines.filter((shrine) => shrine.active).length}`, 274, 166, softText, 10, 'left');
        drawTinyFlag(274, 184, play.inTallGrass, '高麦潜伏', okAccent, softText);
        drawTinyFlag(274, 204, play.flags.exitOpen, '出口开启', strongAccent, softText);
      } else {
        const hpRate = play.boss.hp / play.boss.maxHp;
        Sprite.label(ctx, '目标', 274, 132, sideText, 11, 'left');
        Sprite.label(ctx, hpRate > 0.6 ? '贴身试探' : (hpRate > 0.3 ? '预警压场' : '终局重压'), 274, 148, sideText, 11, 'left');
        Sprite.label(ctx, play.attackState.aiming ? '蓄势挥砍中' : getWeaponStats(play).status, 274, 166, softText, 10, 'left');
        drawTinyFlag(274, 184, play.player.attackCooldown <= 0.1 && !play.attackState.aiming, '可再挥砍', okAccent, softText);
        drawTinyFlag(274, 204, play.inventory.shieldReady || play.player.invuln > 0, play.inventory.shieldReady ? '护盾待命' : '受击保护', strongAccent, softText);
      }
    } else {
      if (play.levelIndex === 0) {
        const signMap = Object.fromEntries(play.signs.map((sign) => [sign.id, sign]));
        Sprite.label(ctx, '目标', 274, 132, sideText, 11, 'left');
        Sprite.label(ctx, '点亮石阵', 274, 148, sideText, 11, 'left');
        Sprite.label(ctx, '先读牌，再按顺序', 274, 166, softText, 10, 'left');
        drawTinyFlag(274, 184, signMap['sign-light']?.read, '迎光', okAccent, softText);
        drawTinyFlag(274, 204, signMap['sign-wind']?.read && signMap['sign-water']?.read, '风+水', strongAccent, softText);
      } else if (play.levelIndex === 1) {
        const checkpoints = getMirrorCheckpointStatus(play);
        Sprite.label(ctx, '目标', 274, 132, sideText, 11, 'left');
        Sprite.label(ctx, '让日光折到锁上', 274, 148, sideText, 10, 'left');
        Sprite.label(ctx, `${checkpoints.filter((item) => item.read && item.ok).length}/3 条刻痕已对上`, 274, 166, softText, 10, 'left');
        drawTinyFlag(274, 184, checkpoints[0].read && checkpoints[0].ok && checkpoints[1].read && checkpoints[1].ok, '前两折', okAccent, softText);
        drawTinyFlag(274, 204, play.flags.mirrorSolved, '锁芯点亮', strongAccent, softText);
      } else {
        const rules = getValveRuleStates(play);
        Sprite.label(ctx, '逻辑', 274, 132, sideText, 11, 'left');
        drawStepChip(274, 148, '左', play.valves.find((valve) => valve.id === 'left')?.on, strongAccent);
        drawStepChip(294, 148, '中', play.valves.find((valve) => valve.id === 'middle')?.on, okAccent);
        drawStepChip(314, 148, '右', play.valves.find((valve) => valve.id === 'right')?.on, '#bba1ff');
        Sprite.label(ctx, `${rules.filter((rule) => rule.read && rule.ok).length}/${rules.filter((rule) => rule.read).length || 0} 条已读条件成立`, 274, 176, softText, 10, 'left');
        drawTinyFlag(274, 194, rules.filter((rule) => rule.read && !rule.ok).length === 0, '无冲突', okAccent, softText);
        drawTinyFlag(274, 214, play.flags.bridgeOpen, '水桥升起', strongAccent, softText);
      }
    }

    drawPaperCard(96, 326, 168, 50, ui.panel, ui.shellBorder, ui.shadow);
    Sprite.label(ctx, play.bonusGoal ? `本章惊喜 · ${play.bonusGoal.title}` : '本章惊喜', 180, 334, sideText, 11, 'center');
    Sprite.label(ctx, play.bonusGoal ? getBonusGoalStatus(play) : (play.route === 'battle' ? `连携 ${play.comboBest}` : `探索连携 ${play.comboBest}`), 180, 348, softText, 10, 'center');
    if (play.route === 'battle') {
      const wave = play.levelIndex === 2 ? play.boss.hp / play.boss.maxHp : (play.levelIndex === 1 ? play.collectedLights / Math.max(1, play.collectibles.length) : play.loreMarks.filter((mark) => mark.read).length / Math.max(1, play.loreMarks.length));
      drawMeter(112, 362, 136, 8, wave, play.levelIndex === 2 ? ui.alert : ui.accent, ui.panelMute);
    } else {
      const reel = computePuzzleCompletion(play);
      drawMeter(112, 362, 136, 8, reel, ui.ok, ui.panelMute);
    }
  }

  function drawHybridObjectivePanel(play, ui) {
    const waveText = play.hybrid.totalRoamerWaves > 0
      ? `第 ${Math.max(1, play.hybrid.currentRoamerWave)}/${play.hybrid.totalRoamerWaves} 波`
      : '波次完成';
    const countdownText = play.hybrid.pendingRoamerWaves.length > 0 && play.roamers.length <= 0
      ? `下一拨 ${play.hybrid.nextRoamerWaveDelay.toFixed(1)}s`
      : `场上 ${play.roamers.length} 只`;
    ctx.save();
    ctx.globalAlpha = 0.6;
    Sprite.rect(ctx, VIEW.x + 8, VIEW.y + 21, 86, 1, ui.accent);
    Sprite.rect(ctx, VIEW.x + VIEW.w - 94, VIEW.y + 21, 86, 1, ui.coral);
    Sprite.rect(ctx, VIEW.x + 122, VIEW.y + VIEW.h - 20, 96, 1, ui.line);
    ctx.restore();
    drawFloatingTextBlock(VIEW.x + 10, VIEW.y + 8, [
      `波次 ${waveText}`,
      countdownText,
      `进度 ${play.hybrid.defeatedRoamers}/${play.hybrid.totalRoamers}`
    ], 'left', [ui.text, ui.softText, ui.gold]);
    drawFloatingTextBlock(VIEW.x + VIEW.w - 10, VIEW.y + 8, [
      play.hybrid.phase === 'field' ? '目标 清掉这一拨' : play.hybrid.phase === 'portal' ? '目标 进入裂隙' : play.hybrid.phase === 'boss' ? '目标 压制 Boss' : '目标 带着战利品离场',
      play.hybrid.phase === 'field' ? `头目 ${play.hybrid.defeatedMinibosses}/${play.hybrid.totalMinibosses}` : play.hybrid.phase === 'boss' ? getWeaponStats(play).status : `离场 ${play.hybrid.rewardTimer.toFixed(1)}s`,
      play.hybrid.phase === 'reward' ? `掉落 ${play.hybrid.lootCollected}/${play.hybrid.totalLoot || 0}` : `背包 ${play.inventory.backpack.length} 类`
    ], 'right', [ui.text, play.hybrid.phase === 'reward' ? ui.coral : ui.softText, ui.plum]);
  }

  function drawMeter(x, y, w, h, ratio, fill, back) {
    const clampedRatio = clamp(ratio || 0, 0, 1);
    Sprite.frame(ctx, x, y, w, h, back, '#9abaae');
    Sprite.rect(ctx, x + 2, y + 2, Math.max(0, (w - 4) * clampedRatio), h - 4, fill);
  }

  function drawHealthHud(x, y, hp, maxHearts, size, gap) {
    const heartSize = size || 16;
    const spacing = gap === undefined ? 1 : gap;
    const total = Math.max(1, maxHearts || 3);
    for (let i = 0; i < total; i += 1) {
      const remain = Math.max(0, Math.min(2, Math.round(((hp || 0) - i) * 2)));
      const stateName = remain >= 2 ? 'full' : (remain === 1 ? 'half' : 'empty');
      const dx = x + i * (heartSize + spacing);
      const drawn = Sprite.drawHealthHeart ? Sprite.drawHealthHeart(ctx, stateName, dx, y, heartSize, Math.round(heartSize * 0.78)) : false;
      if (!drawn && Sprite.drawIcon) {
        const fallback = stateName === 'half' ? 'heartHalf' : (stateName === 'empty' ? 'heartEmpty' : 'heartFull');
        Sprite.drawIcon(ctx, fallback, dx, y, heartSize);
      }
    }
  }

  function drawHealthRatioHud(x, y, ratio, totalHearts, size, gap) {
    const hearts = clamp(ratio || 0, 0, 1) * Math.max(1, totalHearts || 4);
    drawHealthHud(x, y, hearts, totalHearts || 4, size, gap);
  }

  function drawShieldHud(x, y, shield, maxShields, size, gap) {
    const shieldSize = size || 16;
    const spacing = gap === undefined ? 1 : gap;
    const total = Math.max(1, maxShields || 1);
    for (let i = 0; i < total; i += 1) {
      const remain = Math.max(0, Math.min(2, Math.round(((shield || 0) - i) * 2)));
      const stateName = remain >= 2 ? 'full' : (remain === 1 ? 'half' : 'empty');
      const dx = x + i * (shieldSize + spacing);
      const drawn = Sprite.drawSafeShield ? Sprite.drawSafeShield(ctx, stateName, dx, y, shieldSize, Math.round(shieldSize * 0.82)) : false;
      if (!drawn && Sprite.drawIcon) {
        const fallback = stateName === 'half' ? 'shieldHalf' : (stateName === 'empty' ? 'shieldEmpty' : 'shieldFull');
        Sprite.drawIcon(ctx, fallback, dx, y, shieldSize);
      }
    }
  }

  function drawHybridTransition(play) {
    const duration = Math.max(0.001, play.hybrid.transitionDuration || 1.55);
    const progress = clamp(1 - (play.hybrid.transitionTimer / duration), 0, 1);
    const origin = play.hybrid.transitionOrigin || { x: play.player.x + 6, y: play.player.y + 7, portalX: play.player.x + 6, portalY: play.player.y + 7 };
    const target = play.hybrid.transitionTarget || { x: play.player.x + 6, y: play.player.y + 7 };
    const swapStage = progress < 0.52;
    const fade = swapStage ? progress / 0.52 : (1 - progress) / 0.48;
    const pulse = 12 + Math.sin(state.time * 12) * 2;
    const portalScreenX = swapStage
      ? VIEW.x - play.camera.x + origin.portalX
      : VIEW.x - play.camera.x + target.x;
    const portalScreenY = swapStage
      ? VIEW.y - play.camera.y + origin.portalY
      : VIEW.y - play.camera.y + target.y;
    const actorX = swapStage
      ? VIEW.x - play.camera.x + lerp(origin.x, origin.portalX, Math.min(1, progress / 0.52))
      : VIEW.x - play.camera.x + target.x;
    const actorY = swapStage
      ? VIEW.y - play.camera.y + lerp(origin.y, origin.portalY, Math.min(1, progress / 0.52))
      : VIEW.y - play.camera.y + target.y;

    ctx.save();
    ctx.fillStyle = `rgba(239, 248, 255, ${0.1 + progress * 0.28})`;
    ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    for (let i = 0; i < 7; i += 1) {
      const bandY = VIEW.y + 26 + i * 54 + Math.sin(state.time * 8 + i) * 6;
      ctx.globalAlpha = 0.06 + progress * 0.08;
      ctx.fillStyle = i % 2 === 0 ? '#dff7ff' : '#ffe7fb';
      ctx.fillRect(VIEW.x + Math.sin(state.time * 5 + i) * 5, bandY, VIEW.w, 10);
    }
    drawGroundRing(portalScreenX, portalScreenY + 8, pulse * (swapStage ? (1 + progress * 1.5) : (2.1 - progress)), '#8fd8ff', 'rgba(143,216,255,0.08)', 2, 0.75);
    drawGroundRing(portalScreenX, portalScreenY + 8, pulse * (swapStage ? 0.75 : 1.35), '#ffd7fb', 'rgba(255,215,251,0.05)', 1.5, 0.55);
    drawPulseHalo(portalScreenX, portalScreenY, pulse * (swapStage ? 1.6 : 1.9), 'rgba(143, 216, 255, 0.16)');
    drawPulseHalo(portalScreenX, portalScreenY, pulse * (swapStage ? 1.0 : 1.25), 'rgba(255, 214, 255, 0.18)');
    for (let i = 0; i < 10; i += 1) {
      const t = (i + (state.time * 8 % 1)) / 10;
      const px = lerp(actorX, portalScreenX, t);
      const py = lerp(actorY, portalScreenY, t) + Math.sin(state.time * 10 + i) * 4;
      Sprite.rect(ctx, px - 1, py - 1, 3, 3, i % 2 === 0 ? '#dffcff' : '#ffd5f7');
    }
    ctx.globalAlpha = swapStage ? (1 - fade * 0.92) : fade;
    ctx.translate(actorX, actorY);
    ctx.scale(swapStage ? Math.max(0.18, 1 - fade * 0.9) : Math.max(0.2, fade), swapStage ? Math.max(0.18, 1 - fade * 0.9) : Math.max(0.2, fade));
    ctx.rotate((swapStage ? 1 : -1) * progress * 2.2);
    Sprite.drawPlayer(ctx, -6, -8, play.player, state.frameIndex);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.9;
    Sprite.label(ctx, swapStage ? '裂隙吸入中' : '裂隙落地中', 180, 206, '#5b6f7d', 16, 'center');
    Sprite.label(ctx, swapStage ? '正在切入 Boss 区' : '正在从裂隙中现身', 180, 224, '#7a8894', 10, 'center');
    ctx.restore();
  }

  function drawBackpackOverlay() {
    const ui = getGlobalUiTheme();
    const play = state.play;
    if (!play) {
      return;
    }
    ctx.fillStyle = 'rgba(255, 250, 244, 0.92)';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    drawPaperCard(34, 118, 292, 304, ui.panel, ui.shellBorder, ui.shadow);
    Sprite.label(ctx, '战利背包', 180, 142, ui.text, 22, 'center');
    Sprite.label(ctx, 'Boss 宝箱和地图掉落都会收在这里。', 180, 164, ui.softText, 10, 'center');
    const entries = play.inventory.backpack && play.inventory.backpack.length ? play.inventory.backpack : [];
    if (!entries.length) {
      Sprite.label(ctx, '当前背包还是空的。', 180, 240, ui.softText, 12, 'center');
    } else {
      entries.slice(0, 10).forEach((entry, index) => {
        const y = 196 + index * 20;
        Sprite.frame(ctx, 58, y, 244, 16, ui.panelSoft, ui.shellBorder);
        if (Sprite.drawIcon) {
          Sprite.drawIcon(ctx, getItemIconName(entry.id), 64, y + 1, 14);
        }
        Sprite.label(ctx, entry.name, 86, y + 3, ui.text, 10, 'left');
        Sprite.label(ctx, `x${entry.count}`, 286, y + 3, ui.gold, 10, 'right');
      });
    }
    drawButton(108, 384, 144, 26, '关闭背包', toggleBackpack);
  }

  function drawTinyFlag(x, y, active, text, activeColor, inactiveColor) {
    Sprite.frame(ctx, x, y, 60, 14, active ? activeColor : '#edf5ef', '#9abaae');
    Sprite.label(ctx, text, x + 30, y + 3, active ? '#26483f' : inactiveColor, 9, 'center');
  }

  function drawFloatingTextBlock(x, y, lines, align, colors) {
    const list = lines || [];
    const textAlign = align || 'left';
    list.forEach((line, index) => {
      const tone = colors && colors[index] ? colors[index] : (index === 0 ? '#4f463e' : '#6c7fa6');
      const size = index === 0 ? 12 : 10;
      const drawY = y + index * 13;
      ctx.save();
      ctx.globalAlpha = 0.82;
      Sprite.label(ctx, line, x + 1, drawY + 1, 'rgba(36,44,58,0.9)', size, textAlign);
      ctx.restore();
      Sprite.label(ctx, line, x, y + index * 13, tone, size, textAlign);
    });
  }

  function drawStepChip(x, y, text, active, fill) {
    Sprite.frame(ctx, x, y, 16, 16, active ? fill : '#edf5ef', '#9abaae');
    Sprite.label(ctx, text, x + 8, y + 4, active ? '#26483f' : '#6e8f86', 10, 'center');
  }

  function drawAttackAim(play) {
    if (!isCombatModeEnabled(play) || !play.attackState.aiming) {
      return;
    }
    const originX = VIEW.x - play.camera.x + play.player.x + 6;
    const originY = VIEW.y - play.camera.y + play.player.y + 7;
    const length = getWeaponStats(play).reach + 10;
    const endX = originX + Math.cos(play.attackState.angle) * length;
    const endY = originY + Math.sin(play.attackState.angle) * length;
    if (isMeleeWeapon(play)) {
      ctx.save();
      ctx.globalAlpha = 0.78;
      ctx.strokeStyle = '#86cfff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(originX + Math.cos(play.attackState.angle) * 20, originY + Math.sin(play.attackState.angle) * 20, 22, play.attackState.angle - Math.PI * 0.45, play.attackState.angle + Math.PI * 0.45);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const segments = 8;
    for (let i = 0; i < segments; i += 1) {
      if (i % 2 === 1) {
        continue;
      }
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      const sx = originX + (endX - originX) * t0;
      const sy = originY + (endY - originY) * t0;
      const ex = originX + (endX - originX) * t1;
      const ey = originY + (endY - originY) * t1;
      Sprite.rect(ctx, sx, sy, Math.max(2, Math.abs(ex - sx) + 1), Math.max(2, Math.abs(ey - sy) + 1), '#ffe58b');
    }
    Sprite.rect(ctx, endX - 2, endY - 6, 4, 12, '#fff2b8');
    Sprite.rect(ctx, endX - 6, endY - 2, 12, 4, '#fff2b8');
  }

  function drawVirtualButtons(play) {
    const ui = getUiTheme(play.theme);
    const joystick = play.ui.joystick;
    const pad = readPointerPad();
    const attackPad = readAttackPad(play);
    const nearby = findNearbyInteractive(play);
    const interactLabel = !nearby ? '感应'
      : nearby.kind === 'merchant' ? '交易'
        : nearby.kind === 'portal' ? '裂隙'
          : nearby.kind === 'chest' ? '开箱'
            : nearby.kind === 'loot' ? '拾取'
              : nearby.kind === 'grave' ? '献祭'
                : '交互';
    const dashPressed = pointerInCircle(play.ui.dashButton.x, play.ui.dashButton.y, play.ui.dashButton.r + 2);
    const interactPressed = pointerInCircle(play.ui.interactButton.x, play.ui.interactButton.y, play.ui.interactButton.r + 2);
    Sprite.drawJoystick(ctx, joystick.baseX, joystick.baseY, pad.thumbX, pad.thumbY, pad.active);
    Sprite.label(ctx, '摇杆', joystick.baseX, joystick.baseY + 40, ui.softText, 12, 'center');

    Sprite.drawRoundButton(ctx, play.ui.dashButton.x, play.ui.dashButton.y, play.ui.dashButton.r, '冲', getCampaignMutationTier(play) >= 3 ? '异变' : '突进', dashPressed, play.player.dashCooldown > 0);
    state.hitAreas.push({
      shape: 'rect',
      x: play.ui.dashButton.x - play.ui.dashButton.r,
      y: play.ui.dashButton.y - play.ui.dashButton.r,
      w: play.ui.dashButton.r * 2,
      h: play.ui.dashButton.r * 2,
      kind: 'dash'
    });

    Sprite.drawRoundButton(ctx, play.ui.interactButton.x, play.ui.interactButton.y, play.ui.interactButton.r, nearby ? '互' : '感', interactLabel, interactPressed, false);
    state.hitAreas.push({
      shape: 'rect',
      x: play.ui.interactButton.x - play.ui.interactButton.r,
      y: play.ui.interactButton.y - play.ui.interactButton.r,
      w: play.ui.interactButton.r * 2,
      h: play.ui.interactButton.r * 2,
      kind: 'interact'
    });

    const attackEnabled = isCombatModeEnabled(play);
    const attackStick = play.ui.attackStick;
    Sprite.drawJoystick(ctx, attackStick.baseX, attackStick.baseY, attackEnabled ? attackPad.thumbX : attackStick.baseX, attackEnabled ? attackPad.thumbY : attackStick.baseY, attackEnabled && attackPad.active);
    Sprite.label(ctx, attackEnabled ? (play.attackState.aiming ? '松手挥砍' : '拖动蓄力') : '未解锁', attackStick.baseX, attackStick.baseY + 38, attackEnabled ? ui.accent : '#8a93a7', 11, 'center');
  }

  function drawDialogue() {
    const ui = getGlobalUiTheme();
    const current = state.dialogue.queue[state.dialogue.index];
    if (!current) {
      return;
    }
    drawPaperCard(DIALOGUE_BOX.x, DIALOGUE_BOX.y, DIALOGUE_BOX.w, DIALOGUE_BOX.h, '#fffefc', ui.shellBorder, ui.shadow);
    Sprite.label(ctx, current.speaker, DIALOGUE_BOX.x + 14, DIALOGUE_BOX.y + 12, ui.accent, 14, 'left');
    const visible = current.text.slice(0, state.dialogue.visibleChars);
    const lines = wrapText(visible, 18).slice(0, 3);
    lines.forEach((line, index) => {
      Sprite.label(ctx, line, DIALOGUE_BOX.x + 14, DIALOGUE_BOX.y + 38 + index * 18, ui.text, 14, 'left');
    });
    Sprite.label(ctx, state.dialogue.visibleChars >= current.text.length ? '轻触继续' : '轻触补全', DIALOGUE_BOX.x + DIALOGUE_BOX.w - 18, DIALOGUE_BOX.y + 74, ui.softText, 12, 'right');
  }

  function drawPauseMenu() {
    const ui = getGlobalUiTheme();
    ctx.fillStyle = 'rgba(255, 251, 244, 0.86)';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    drawPaperCard(48, 136, 264, 300, ui.panel, ui.shellBorder, ui.shadow);
    drawSectionTag(64, 128, '菜单', ui, 'coral');
    Sprite.label(ctx, '当前战役', 180, 164, ui.text, 22, 'center');
    Sprite.label(ctx, '保存、查看图鉴或重新开始都在这里。', 180, 186, ui.softText, 10, 'center');
    drawButton(92, 212, 176, 30, '继续', () => {
      state.overlay = null;
    });
    drawButton(92, 250, 176, 30, '保存进度', () => {
      saveProgress(true);
      state.overlay = null;
    });
    drawButton(92, 288, 176, 30, '成就馆', () => {
      state.overlay = null;
      openAchievements('pause');
    });
    drawButton(92, 326, 176, 30, '像素画廊', () => {
      state.overlay = null;
      openGallery('pause');
    });
    drawButton(92, 364, 176, 30, '重新开始', () => {
      state.overlay = null;
      restartCurrentLevel();
    });
    drawButton(92, 402, 176, 30, '返回标题', () => {
      state.overlay = null;
      resetToTitle();
    });
  }

  function drawGmMenu() {
    const ui = getGlobalUiTheme();
    const overlay = state.overlay;
    const play = state.play;
    if (!overlay || overlay.type !== 'gm' || !play) {
      return;
    }
    const currentStep = Number.isFinite(play.campaignStep) ? play.campaignStep : 0;
    const currentInfo = getCampaignStepInfo(currentStep);
    ctx.fillStyle = 'rgba(255, 248, 240, 0.9)';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    drawPaperCard(14, 64, 332, 398, '#fffefb', ui.shellBorder, ui.shadow);
    drawSectionTag(30, 56, 'GM', ui, 'coral');
    Sprite.label(ctx, '调试菜单', 180, 92, ui.text, 24, 'center');
    Sprite.label(ctx, 'Home 显示 / 隐藏，Esc 也可以直接返回。', 180, 114, ui.softText, 10, 'center');
    Sprite.frame(ctx, 24, 128, 312, 28, ui.panelSoft, ui.shellBorder);
    Sprite.label(ctx, `当前幕数：${currentStep + 1} · ${currentInfo ? currentInfo.label : play.level.name}`, 180, 136, ui.text, 12, 'center');

    drawSmallButton(30, 166, 68, 18, '上一幕', () => gmJumpRelative(-1));
    drawSmallButton(106, 166, 68, 18, '下一幕', () => gmJumpRelative(1));
    drawSmallButton(182, 166, 72, 18, '进Boss区', gmEnterBossArea);
    drawSmallButton(262, 166, 68, 18, '关闭', closeGmMenu);

    Sprite.frame(ctx, 24, 194, 312, 92, ui.panel, ui.shellBorder);
    Sprite.label(ctx, '快速跳关', 180, 202, ui.accent, 11, 'center');
    CAMPAIGN_ORDER.forEach((info, index) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      const x = 31 + col * 60;
      const y = 218 + row * 24;
      const active = index === currentStep;
      if (active) {
        Sprite.frame(ctx, x - 2, y - 2, 56, 22, ui.accentSoft, ui.accent);
      }
      drawSmallButton(x, y, 52, 18, info.route === 'easter' ? '彩蛋' : `${index + 1}幕`, () => gmJumpToCampaignStep(index));
    });

    const actions = [
      { x: 30, y: 298, w: 142, label: '+50 金币', action: () => gmAddCoins(50) },
      { x: 188, y: 298, w: 142, label: '+12 经验', action: () => gmAddExp(12) },
      { x: 30, y: 324, w: 142, label: '回满血盾', action: gmRestorePlayer },
      { x: 188, y: 324, w: 142, label: '清场小怪', action: gmClearFieldEnemies },
      { x: 30, y: 350, w: 142, label: '秒当前 Boss', action: gmDefeatBosses },
      { x: 188, y: 350, w: 142, label: '重开本关', action: restartCurrentLevel },
      { x: 30, y: 376, w: 142, label: 'Bomb 特装', action: gmGrantBombGearNow },
      { x: 188, y: 376, w: 142, label: 'Ember 特装', action: gmGrantEmberGearNow }
    ];
    actions.forEach((entry) => {
      drawSmallButton(entry.x, entry.y, entry.w, 20, entry.label, entry.action);
    });

    Sprite.frame(ctx, 24, 410, 312, 40, ui.panelMute, ui.shellBorder);
    drawParagraph(overlay.message || 'GM 菜单已激活。', 34, 420, 292, 12, ui.softText);
  }

  function drawDeathOverlay() {
    const ui = getGlobalUiTheme();
    const overlay = state.overlay;
    ctx.fillStyle = 'rgba(255, 245, 247, 0.88)';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    drawPaperCard(48, 176, 264, 216, '#fffefc', ui.shellBorder, ui.shadow);
    drawSectionTag(64, 168, '战败', ui, 'coral');
    Sprite.label(ctx, overlay.title || '你倒下了', 180, 208, '#7a4e55', 24, 'center');
    Sprite.label(ctx, '这次推进被打断了。', 180, 238, ui.text, 12, 'center');
    drawParagraph(overlay.message || '重新整顿装备和节奏后再试一次。', 78, 266, 204, 16, ui.softText);
    drawButton(92, 328, 176, 28, '重新挑战', () => {
      state.overlay = null;
      restartCurrentLevel();
    });
    drawSmallButton(92, 364, 80, 20, '返回标题', () => {
      state.overlay = null;
      resetToTitle();
    });
    drawSmallButton(188, 364, 80, 20, '继续看图', () => {
      state.overlay = null;
    });
  }

  function drawShopOverlay() {
    const ui = getGlobalUiTheme();
    const overlay = state.overlay;
    const play = state.play;
    ctx.fillStyle = 'rgba(255, 251, 244, 0.9)';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    drawPaperCard(14, 110, 332, 304, ui.panel, ui.shellBorder, ui.shadow);
    drawSectionTag(30, 102, '补给台', ui, 'gold');
    Sprite.label(ctx, '战役补给', 180, 138, ui.text, 22, 'center');
    Sprite.label(ctx, `本地金币 ${state.profile.coins}`, 180, 162, ui.gold, 12, 'center');
    const offers = overlay.offers || [];
    offers.forEach((item, index) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      const x = 22 + col * 62;
      const y = 188 + row * 116;
      const bought = Boolean(overlay.bought[item.itemId]);
      state.hitAreas.push({
        shape: 'rect',
        x,
        y,
        w: 54,
        h: 110,
        kind: 'tap',
        action: () => purchaseShopItem(item.itemId)
      });
      Sprite.frame(ctx, x, y, 54, 110, bought ? ui.accentSoft : ui.panelSoft, bought ? ui.ok : ui.shellBorder);
      Sprite.frame(ctx, x + 9, y + 8, 36, 28, '#f7fbff', ui.stickerBorder);
      if (Sprite.drawIcon) {
        Sprite.drawIcon(ctx, getItemIconName(item.itemId), x + 18, y + 12, 16);
      }
      Sprite.label(ctx, item.name.slice(0, 3), x + 27, y + 42, ui.text, 10, 'center');
      Sprite.label(ctx, `${item.price}G`, x + 27, y + 57, ui.blue, 10, 'center');
      Sprite.label(ctx, item.desc.slice(0, 4), x + 27, y + 73, ui.softText, 8, 'center');
      Sprite.label(ctx, item.desc.slice(4, 8), x + 27, y + 83, ui.softText, 8, 'center');
      if (bought) {
        Sprite.frame(ctx, x + 36, y + 6, 12, 12, ui.ok, ui.stickerBorder);
        Sprite.label(ctx, '√', x + 42, y + 7, '#08131f', 10, 'center');
      }
      drawSmallButton(x + 4, y + 91, 46, 16, bought ? '取消' : '购买', () => purchaseShopItem(item.itemId));
    });
    Sprite.frame(ctx, 24, 310, 312, 22, ui.panelMute, ui.shellBorder);
    Sprite.label(ctx, overlay.message || '再次点击已购物品即可取消并退款。', 180, 315, ui.text, 10, 'center');
    Sprite.frame(ctx, 24, 340, 312, 20, ui.panelSoft, ui.shellBorder);
    Sprite.label(ctx, getShopLoadoutSummary(play), 180, 344, ui.softText, 9, 'center');
    drawSmallButton(30, 374, 120, 18, '清空购物', clearShopPurchases);
    drawButton(182, 370, 136, 24, '进入关卡', closeShopOverlay);
  }

  function drawKeypad() {
    const ui = getGlobalUiTheme();
    const maxLength = state.overlay.maxLength || 4;
    ctx.fillStyle = 'rgba(255, 252, 247, 0.8)';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    drawPaperCard(56, 150, 248, 276, '#fffefb', ui.shellBorder, ui.shadow);
    Sprite.label(ctx, '像素数字锁', 180, 170, ui.text, 20, 'center');
    Sprite.frame(ctx, 90, 204, 180, 32, '#fff9f0', ui.shellBorder);
    Sprite.label(ctx, state.overlay.input.padEnd(maxLength, '_'), 180, 212, ui.text, 20, 'center');
    Sprite.label(ctx, `需要 ${maxLength} 位密码`, 180, 228, ui.softText, 10, 'center');

    let number = 1;
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const x = 90 + col * 60;
        const y = 252 + row * 44;
        const value = String(number);
        drawSmallButton(x, y, 44, 32, value, () => {
          if (state.overlay.input.length < maxLength) {
            state.overlay.input += value;
          }
        });
        number += 1;
      }
    }
    drawSmallButton(90, 384, 44, 32, '清除', () => {
      state.overlay.input = '';
    });
    drawSmallButton(152, 384, 44, 32, '0', () => {
      if (state.overlay.input.length < maxLength) {
        state.overlay.input += '0';
      }
    });
    drawSmallButton(214, 384, 56, 32, '确认', confirmKeypad);
    drawSmallButton(152, 428, 56, 28, '关闭', () => {
      state.overlay = null;
    });
  }

  function drawMerchantOverlay() {
    const ui = getGlobalUiTheme();
    const merchant = state.overlay && state.overlay.merchant;
    const offers = getMerchantOffers(merchant);
    if (!merchant || !offers.length) {
      return;
    }
    ctx.fillStyle = 'rgba(255, 251, 244, 0.9)';
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    drawPaperCard(22, 132, 316, 276, ui.panel, ui.shellBorder, ui.shadow);
    drawSectionTag(38, 124, '商人站', ui, 'blue');
    Sprite.label(ctx, merchant.title || '神秘商人', 180, 162, ui.text, 22, 'center');
    Sprite.label(ctx, Number.isFinite(merchant.ttl) ? `限时摊位 · 剩余 ${Math.ceil(merchant.ttl)} 秒` : '常驻摊位 · 只在本关生效', 180, 184, ui.softText, 12, 'center');
    Sprite.label(ctx, `你持有 ${state.profile.coins} 金币`, 180, 204, ui.gold, 12, 'center');
    offers.forEach((offer, index) => {
      const width = offers.length === 1 ? 136 : 84;
      const gap = offers.length === 1 ? 0 : 12;
      const totalWidth = offers.length === 1 ? width : offers.length * width + (offers.length - 1) * gap;
      const x = Math.floor(180 - totalWidth * 0.5 + index * (width + gap));
      const y = 224;
      state.hitAreas.push({
        shape: 'rect',
        x,
        y,
        w: width,
        h: 112,
        kind: 'tap',
        action: () => buyMerchantOffer(index)
      });
      Sprite.frame(ctx, x, y, width, 112, offer.sold ? ui.accentSoft : ui.panelSoft, offer.sold ? ui.ok : ui.shellBorder);
      Sprite.frame(ctx, x + 14, y + 10, width - 28, 24, '#f7fbff', ui.stickerBorder);
      if (Sprite.drawIcon) {
        Sprite.drawIcon(ctx, getItemIconName(offer.itemId), x + Math.floor(width * 0.5) - 9, y + 13, 18);
      }
      Sprite.label(ctx, offer.name, x + width * 0.5, y + 42, ui.text, 10, 'center');
      Sprite.label(ctx, `${offer.price} 金币`, x + width * 0.5, y + 57, ui.blue, 10, 'center');
      Sprite.label(ctx, offer.desc.slice(0, 8), x + width * 0.5, y + 74, ui.softText, 8, 'center');
      Sprite.label(ctx, offer.sold ? '已带走' : '过关失效', x + width * 0.5, y + 87, ui.softText, 8, 'center');
      drawSmallButton(x + 8, y + 92, width - 16, 16, offer.sold ? '售罄' : '购买', () => buyMerchantOffer(index));
    });
    Sprite.frame(ctx, 34, 346, 292, 22, ui.panelMute, ui.shellBorder);
    Sprite.label(ctx, '商人货品只保留到本关结束，适合拿来赌节奏和容错。', 180, 350, ui.softText, 10, 'center');
    drawSmallButton(84, 376, 88, 18, '离开', () => {
      state.overlay = null;
    });
    drawButton(178, 372, 112, 24, '继续赶路', () => {
      state.overlay = null;
    });
  }

  function confirmKeypad() {
    const play = state.play;
    if (!play || !state.overlay || state.overlay.type !== 'keypad') {
      return;
    }
    if (state.overlay.input === play.level.keypadCode) {
      play.flags.doorOpened = true;
      play.level.grid[play.level.door.y][play.level.door.x] = TILE.PATH;
      state.overlay = null;
      startDialogue([{ speaker: '门锁', text: '滴答一声，房门打开了。进屋拿走神秘种子吧。' }]);
    } else {
      play.flags.keypadErrors += 1;
      if (play.levelIndex === 1 && play.flags.keypadErrors >= 3) {
        play.flags.keypadHintActive = true;
      }
      startDialogue([{
        speaker: '门锁',
        text: play.flags.keypadHintActive ? '密码还是不对......真正可靠的线索开始发亮了。' : `密码不对，再想想......当前已输错 ${play.flags.keypadErrors} 次。`
      }]);
      state.overlay.input = '';
    }
  }

  function drawSettlement() {
    const ui = getGlobalUiTheme();
    drawSky(state.settlement.route === 'battle' ? 'night' : 'day');
    drawFieldBackdrop(state.settlement.route === 'battle' ? 'night' : 'day');
    drawMenuShell('战役结算', 'MERGED CAMPAIGN CLEAR');
    drawPaperCard(24, 100, 312, 360, ui.panel, ui.shellBorder, ui.shadow);
    drawSectionTag(40, 92, '结算', ui, state.settlement.route === 'battle' ? 'blue' : 'gold');
    Sprite.label(ctx, '通关结算', 180, 132, ui.text, 24, 'center');
    Sprite.label(ctx, state.settlement.title, 180, 184, ui.text, 16, 'center');
    if (Number.isFinite(state.settlement.campaignStep)) {
      Sprite.label(ctx, `第 ${state.settlement.campaignStep + 1} 幕 · ${getCampaignStageLabel(state.settlement.campaignStep)}`, 180, 198, ui.softText, 10, 'center');
    }
    Sprite.frame(ctx, 108, 206, 144, 38, state.settlement.rating === 'S' ? ui.gold : state.settlement.rating === 'A' ? ui.blue : state.settlement.rating === 'B' ? ui.ok : ui.panelSoft, ui.shellBorder);
    Sprite.label(ctx, `评级 ${state.settlement.rating}`, 180, 217, '#17131a', 18, 'center');
    drawParagraph(state.settlement.summary, 54, 252, 252, 18, ui.text);
    drawParagraph(state.settlement.ratingSummary, 54, 286, 252, 17, ui.softText);
    drawPaperCard(42, 318, 276, 58, ui.panelMute, ui.shellBorder, 'rgba(0,0,0,0)');
    Sprite.label(ctx, '本局短评', 180, 322, ui.text, 11, 'center');
    drawParagraph(state.settlement.shareLine, 62, 338, 236, 15, ui.softText);
    Sprite.label(ctx, `本地金币 +${state.settlement.rewardCoins}`, 58, 376, ui.gold, 13, 'left');
    Sprite.label(ctx, `经验 +${state.settlement.rewardExp || 0}`, 180, 376, ui.blue, 13, 'center');
    Sprite.label(ctx, `最佳评级 ${state.settlement.bestRating}`, 302, 376, ui.gold, 13, 'right');
    if (state.settlement.bonusGoal) {
      Sprite.frame(ctx, 42, 392, 276, 22, state.settlement.bonusGoal.done ? ui.accentSoft : ui.panelSoft, ui.shellBorder);
      Sprite.label(ctx, state.settlement.bonusGoal.done ? `额外挑战达成：${state.settlement.bonusGoal.title}` : `额外挑战未达成：${state.settlement.bonusGoal.title}`, 180, 396, state.settlement.bonusGoal.done ? ui.ok : ui.coral, 11, 'center');
    }
    drawPaperCard(42, 420, 276, 34, ui.panelSoft, ui.shellBorder, 'rgba(0,0,0,0)');
    Sprite.label(ctx, `累计评级点 ${state.settlement.totalRatingScore}`, 60, 426, ui.text, 11, 'left');
    Sprite.label(ctx, state.settlement.nextGalleryThreshold ? `下张画廊需 ${state.settlement.nextGalleryThreshold}` : '画廊已全部解锁', 300, 426, ui.softText, 11, 'right');
    Sprite.label(ctx, `已解锁画廊 ${state.settlement.galleryUnlockCount} / ${GALLERY_THRESHOLDS.length}`, 180, 440, ui.softText, 10, 'center');
    drawButton(90, 468, 180, 26, state.settlement.final ? '继续剧情' : '进入下一关', continueAfterSettlement);
  }

  function drawEaster() {
    const ui = getGlobalUiTheme();
    const easter = state.easter;
    if (!easter) {
      return;
    }
    drawSky('day');
    drawFieldBackdrop('day');
    drawEasterWheatField(easter);
    drawEasterKidsScene(easter);
    drawPaperCard(20, 24, 320, 80, '#ffffff', ui.shellBorder, ui.shadow);
    drawSectionTag(36, 16, '彩蛋关', ui, easter.mode === 'finale' ? 'coral' : 'blue');
    Sprite.label(ctx, easter.mode === 'arcade' || easter.mode === 'arcade-fail' ? '麦浪掌机争端' : '麦田脑筋急转弯', 180, 42, ui.text, 24, 'center');
    Sprite.label(ctx, easter.mode === 'finale' ? '第十幕 · 湖南口音冲击波' : '甲想玩对战和恐怖，乙想玩闯关和解密', 180, 68, ui.softText, 11, 'center');
    if (easter.mode === 'riddle') {
      drawEasterRiddlePanel(easter, ui);
    } else if (easter.mode === 'arcade' || easter.mode === 'arcade-fail') {
      drawEasterArcadePanel(easter, ui);
    } else if (easter.mode === 'finale') {
      drawEasterFinalePanel(easter, ui);
    } else {
      drawPaperCard(32, 144, 296, 148, '#ffffff', ui.shellBorder, ui.shadow);
      Sprite.label(ctx, '彩蛋关载入中', 180, 182, ui.text, 24, 'center');
      drawParagraph('麦浪在动，掌机在亮，两个小孩正在为到底先玩什么游戏拌嘴。', 58, 220, 244, 18, ui.softText);
    }
    drawEasterEffects(easter);
    drawSmallButton(24, 586, 92, 22, '返回标题', resetToTitle);
    if (easter.mode === 'finale') {
      drawSmallButton(134, 586, 92, 22, '重看彩蛋', () => startEasterScene(true));
      drawSmallButton(244, 586, 92, 22, '制作名单', () => openCredits('title'));
    } else {
      drawSmallButton(244, 586, 92, 22, '成就馆', () => openAchievements('title'));
    }
  }

  function getEasterChipMeta(type) {
    if (type === 'battle') return { label: '战', fill: '#ffe4ef', accent: '#ffabc9', owner: 'jia', title: '对战' };
    if (type === 'horror') return { label: '怖', fill: '#f0e8ff', accent: '#c8b7ff', owner: 'jia', title: '恐怖' };
    if (type === 'run') return { label: '闯', fill: '#e3f5ff', accent: '#9cdfff', owner: 'yi', title: '闯关' };
    if (type === 'puzzle') return { label: '谜', fill: '#e7fff4', accent: '#93e4c1', owner: 'yi', title: '解密' };
    return { label: '噪', fill: '#ffe8ee', accent: '#ff9eb6', owner: 'noise', title: '噪点' };
  }

  function drawEasterWheatField(easter) {
    for (let i = 0; i < 22; i += 1) {
      const x = 6 + i * 16;
      const sway = Math.sin(easter.timer * 1.8 + i * 0.45) * 3;
      Sprite.rect(ctx, x, 450 + (i % 3), 2, 72, '#f7e7a0');
      Sprite.rect(ctx, x - 4 + sway, 468 + (i % 5), 10, 2, '#f4dd88');
      Sprite.rect(ctx, x - 2 + sway * 0.8, 490 + (i % 4), 8, 2, '#f7efbc');
    }
    for (let i = 0; i < 18; i += 1) {
      const x = 8 + i * 18;
      const pulse = 10 + Math.sin(easter.timer * 2.4 + i) * 2;
      drawPulseHalo(x + 6, 454 + (i % 4) * 5, pulse, 'rgba(255,235,155,0.08)');
    }
  }

  function drawEasterKidsScene(easter) {
    const consoleX = 110;
    const consoleY = 438;
    const floatY = Math.sin(easter.timer * 2) * 2;
    drawPixelShadow(86, 514, 18, 'rgba(28,24,18,0.12)');
    drawPixelShadow(272, 514, 18, 'rgba(28,24,18,0.12)');
    drawPixelShadow(180, 500, 28, 'rgba(22,28,36,0.14)');
    Sprite.drawPlayer(ctx, 62, 458 + floatY, { facing: 'right', walking: true, colorShirt: '#ff9fbd', colorPants: '#8f9eff' }, state.frameIndex);
    Sprite.drawPlayer(ctx, 246, 458 - floatY, { facing: 'left', walking: true, colorShirt: '#85d5ff', colorPants: '#efc25f' }, state.frameIndex);
    Sprite.frame(ctx, consoleX, consoleY, 140, 54, '#fdfefe', '#b3cae8');
    Sprite.frame(ctx, consoleX + 12, consoleY + 8, 116, 28, '#ddefff', '#8fb7d8');
    Sprite.rect(ctx, consoleX + 18, consoleY + 14, 104, 16, '#8fd8ff');
    Sprite.rect(ctx, consoleX + 22, consoleY + 18, 96, 8, 'rgba(255,255,255,0.5)');
    Sprite.frame(ctx, consoleX + 16, consoleY + 38, 20, 10, '#ffd7e8', '#b3cae8');
    Sprite.frame(ctx, consoleX + 104, consoleY + 38, 20, 10, '#dbf6ff', '#b3cae8');
    Sprite.rect(ctx, consoleX + 62, consoleY + 40, 16, 6, '#d0dff5');
    Sprite.frame(ctx, 40, 414, 46, 24, '#fff5fb', '#d8ddec');
    Sprite.frame(ctx, 274, 414, 46, 24, '#f1fbff', '#d8ddec');
    if (easter.mode === 'finale') {
      Sprite.label(ctx, '哈?', 63, 421, '#566a84', 10, 'center');
      Sprite.label(ctx, '哈!', 297, 421, '#566a84', 10, 'center');
    } else {
      Sprite.label(ctx, '对战', 63, 418, '#566a84', 9, 'center');
      Sprite.label(ctx, '恐怖', 63, 427, '#566a84', 9, 'center');
      Sprite.label(ctx, '闯关', 297, 418, '#566a84', 9, 'center');
      Sprite.label(ctx, '解密', 297, 427, '#566a84', 9, 'center');
    }
  }

  function drawEasterRiddlePanel(easter, ui) {
    const pulse = easter.wrongPulse > 0 ? Math.sin(state.time * 28) * 3 : 0;
    drawPaperCard(28 + pulse, 118, 304, 202, '#ffffff', easter.wrongPulse > 0 ? ui.alert : ui.shellBorder, ui.shadow);
    drawSectionTag(44 + pulse, 110, '谜面', ui, 'blue');
    drawParagraph('乙说：\n“一个日本人来找中国牙医看牙，牙医刚说完第一句话，两人就打了起来，请问牙医说的第一句话是什么？”', 52 + pulse, 150, 258, 18, ui.text);
    Sprite.frame(ctx, 52 + pulse, 250, 256, 36, '#f6fbff', ui.shellBorder);
    Sprite.label(ctx, easter.resultText || '先猜第一句话。猜对以后，掌机才会真正开机。', 180 + pulse, 262, easter.wrongPulse > 0 ? ui.coral : ui.softText, 10, 'center');
    drawButton(74, 340, 212, 28, 'A. 请张嘴', () => answerEasterRiddle('open'));
    drawButton(74, 378, 212, 28, 'B. 拔个牙', () => answerEasterRiddle('tooth'));
    drawButton(74, 416, 212, 28, 'C. 忍一下', () => answerEasterRiddle('wait'));
    drawPaperCard(36, 462, 288, 82, '#f8fcff', ui.shellBorder, 'rgba(0,0,0,0)');
    Sprite.label(ctx, '设计说明', 180, 472, ui.text, 11, 'center');
    drawParagraph('这一段是彩蛋关的第一层钥匙。先把梗猜出来，再把甲乙想玩的内容揉成一个小游戏。', 56, 492, 248, 16, ui.softText);
  }

  function drawEasterArcadePanel(easter, ui) {
    drawPaperCard(20, 110, 320, 70, '#ffffff', ui.shellBorder, ui.shadow);
    Sprite.label(ctx, '轻触下落的模式芯片，别点到噪点。', 180, 128, ui.text, 14, 'center');
    Sprite.label(ctx, '甲的对战/恐怖和乙的闯关/解密都要喂饱，条越平衡，和解度越高。', 180, 150, ui.softText, 10, 'center');
    drawPaperCard(46, 194, 268, 242, '#fdfefe', ui.shellBorder, ui.shadow);
    Sprite.frame(ctx, 64, 212, 232, 188, '#e9f6ff', '#9fc3e1');
    Sprite.rect(ctx, 74, 222, 212, 168, '#8ccff4');
    for (let i = 0; i < 12; i += 1) {
      Sprite.rect(ctx, 74, 224 + i * 14, 212, 1, 'rgba(255,255,255,0.16)');
    }
    drawGroundRing(180, 308, 48 + Math.sin(easter.timer * 3.2) * 3, '#d1efff', 'rgba(209,239,255,0.12)', 2, 0.7);
    drawGroundRing(180, 308, 28 + Math.sin(easter.timer * 3.8 + 1) * 2, '#ffd8f0', 'rgba(255,216,240,0.08)', 1.5, 0.58);
    easter.chips.forEach((chip) => {
      const meta = getEasterChipMeta(chip.type);
      drawPulseHalo(chip.x, chip.y, chip.size + 6, meta.owner === 'noise' ? 'rgba(255,158,182,0.22)' : 'rgba(157,223,255,0.18)');
      Sprite.frame(ctx, chip.x - chip.size, chip.y - chip.size, chip.size * 2, chip.size * 2, meta.fill, meta.accent);
      Sprite.label(ctx, meta.label, chip.x, chip.y - 4, ui.text, 12, 'center');
      state.hitAreas.push({ shape: 'circle', x: chip.x, y: chip.y, r: chip.size + 6, kind: 'tap', action: () => tapEasterChip(chip.id) });
    });
    drawPaperCard(26, 452, 308, 110, '#ffffff', ui.shellBorder, ui.shadow);
    Sprite.label(ctx, `甲口味 ${Math.round(easter.jiaMeter)} / ${easter.chipGoal}`, 44, 470, ui.text, 11, 'left');
    Sprite.label(ctx, `乙口味 ${Math.round(easter.yiMeter)} / ${easter.chipGoal}`, 316, 470, ui.text, 11, 'right');
    drawMeter(42, 488, 120, 12, easter.jiaMeter / easter.chipGoal, '#ffb7cf', '#f6f7ff');
    drawMeter(198, 488, 120, 12, easter.yiMeter / easter.chipGoal, '#9ddfff', '#f6f7ff');
    Sprite.label(ctx, `和解度 ${easter.harmony}%`, 44, 512, ui.text, 11, 'left');
    Sprite.label(ctx, `剩余 ${Math.ceil(easter.arcadeTimer)} 秒`, 316, 512, easter.arcadeTimer < 6 ? ui.alert : ui.softText, 11, 'right');
    drawMeter(42, 528, 276, 12, easter.harmony / 100, '#8fe0c6', '#f0f5ff');
    Sprite.label(ctx, `噪点压力 ${Math.round(easter.tension)} / 36`, 180, 542, ui.softText, 10, 'center');
    if (easter.mode === 'arcade-fail') {
      Sprite.frame(ctx, 78, 260, 204, 70, '#fffafc', ui.shellBorder);
      Sprite.label(ctx, '掌机失衡了', 180, 276, ui.coral, 18, 'center');
      Sprite.label(ctx, '甲乙其中一边没被喂饱，或者噪点太多。', 180, 300, ui.softText, 10, 'center');
      drawSmallButton(118, 312, 124, 18, '再试一次', retryEasterArcade);
    }
  }

  function drawEasterFinalePanel(easter, ui) {
    drawPaperCard(26, 112, 308, 176, '#ffffff', ui.shellBorder, ui.shadow);
    drawSectionTag(42, 104, '揭晓', ui, 'coral');
    Sprite.label(ctx, '答案公布', 180, 138, ui.text, 24, 'center');
    Sprite.label(ctx, '拔个牙喽！', 180, 176, '#ff8db1', 28, 'center');
    drawParagraph(easter.revealText, 86, 214, 188, 18, ui.text);
    Sprite.label(ctx, '甲总算懂了，乙笑得差点把掌机丢进麦田。', 180, 258, ui.softText, 11, 'center');
    drawPaperCard(34, 310, 292, 116, '#f8fcff', ui.shellBorder, ui.shadow);
    Sprite.label(ctx, '彩蛋关玩法设计', 180, 326, ui.text, 12, 'center');
    drawParagraph('第一段用脑筋急转弯定调，第二段把甲乙两种偏好做成同屏点触掌机，第三段再用口音梗做成整屏音浪和笑场特效。这样第十关就和前九关完全不同。', 56, 350, 248, 16, ui.softText);
    drawPaperCard(44, 444, 272, 86, '#fffefb', ui.shellBorder, 'rgba(0,0,0,0)');
    Sprite.label(ctx, '彩蛋奖励', 180, 456, ui.text, 12, 'center');
    Sprite.label(ctx, '成就“真相”已解锁', 180, 480, ui.ok, 18, 'center');
    Sprite.label(ctx, '以后从 GM 或第十幕跳入时也能直接体验这一关。', 180, 506, ui.softText, 10, 'center');
    drawButton(94, 538, 172, 30, '查看制作名单', () => openCredits('title'));
  }

  function drawEasterEffects(easter) {
    easter.shockwaves.forEach((wave) => {
      drawGroundRing(wave.x, wave.y, wave.radius, wave.color, 'rgba(255,255,255,0.02)', 2, wave.alpha);
    });
    easter.bursts.forEach((burst) => {
      const alpha = clamp(burst.life / burst.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (burst.text) {
        Sprite.label(ctx, burst.text, burst.x, burst.y, burst.color, burst.size, 'center');
      } else {
        Sprite.rect(ctx, burst.x - 1.5, burst.y - 1.5, 3, 3, burst.color);
      }
      ctx.restore();
    });
  }

  function drawCredits() {
    const ui = getGlobalUiTheme();
    drawSky('day');
    drawFieldBackdrop('day');
    drawMenuShell('制作名单', 'MIYE BREAKTHROUGH LOG');
    drawPaperCard(26, 72, 308, 404, ui.panel, ui.shellBorder, ui.shadow);
    Sprite.label(ctx, '制作名单', 180, 94, ui.text, 24, 'center');
    drawParagraph('作品名：秘野破关行\n形式：纯离线 HTML5 Canvas 竖屏互动游戏\n玩法：统一十幕战役 + 默认近战 + 大地图探索 + 环境事件 + 商人交易 + 后期异变装备\n资源：本地像素资源与程序化图标共同驱动 HUD、商店、画廊和地图提示\n程序：原生 JavaScript / Canvas / Tilemap / 状态机\n适配：移动端触控、离线运行、无外链资源', 54, 132, 252, 18, ui.text);
    Sprite.frame(ctx, 44, 344, 272, 72, ui.panelSoft, ui.shellBorder);
    Sprite.label(ctx, state.menuBack === 'pause' ? '轻触返回菜单' : '轻触返回上一页', 180, 358, ui.softText, 16, 'center');
  }

  function drawAchievements() {
    const ui = getGlobalUiTheme();
    drawSky('day');
    drawFieldBackdrop('day');
    drawMenuShell('成就馆', 'HANDHELD ARCHIVE');
    drawPaperCard(20, 72, 320, 502, ui.panel, ui.shellBorder, ui.shadow);
    const list = getAchievementList();
    list.forEach((item, index) => {
      const y = 92 + index * 46;
      const unlocked = Boolean(state.profile.achievements[item.id]);
      Sprite.frame(ctx, 30, y, 300, 36, unlocked ? ui.accentSoft : ui.panelSoft, unlocked ? ui.ok : ui.shellBorder);
      Sprite.frame(ctx, 38, y + 6, 24, 24, unlocked ? ui.ok : ui.panelMute, ui.shellBorder);
      if (Sprite.drawIcon) {
        Sprite.drawIcon(ctx, unlocked ? getAchievementIconName(item.id) : 'lock', 41, y + 7, 18);
      } else {
        Sprite.label(ctx, unlocked ? '✓' : '?', 54, y + 10, unlocked ? ui.text : ui.softText, 14, 'center');
      }
      Sprite.label(ctx, item.name, 72, y + 8, ui.text, 12, 'left');
      Sprite.label(ctx, unlocked ? item.desc : '尚未解锁', 72, y + 22, unlocked ? ui.softText : '#9cb2ab', 10, 'left');
    });
    drawSmallButton(30, 584, 84, 28, '返回', returnFromMenu);
    drawSmallButton(246, 584, 84, 28, '制作名单', () => openCredits(state.menuBack));
  }

  function drawGallery() {
    const ui = getGlobalUiTheme();
    const unlockCount = getGalleryUnlockCount();
    const score = getTotalRatingScore();
    drawSky('day');
    drawFieldBackdrop('day');
    drawMenuShell('像素画廊', 'PIXEL GALLERY');
    drawPaperCard(20, 72, 320, 502, ui.panel, ui.shellBorder, ui.shadow);
    if (!unlockCount) {
      Sprite.frame(ctx, 46, 188, 268, 112, ui.panelSoft, ui.shellBorder);
      Sprite.label(ctx, '画廊尚未解锁', 180, 206, ui.text, 18, 'center');
      drawParagraph(`当前累计评级点为 ${score}。至少拿到 ${GALLERY_THRESHOLDS[0]} 点后，就会开放第一张像素画。`, 72, 238, 216, 16, ui.softText);
    } else {
      drawGalleryCard(40, 98, 120, 134, '危险区', '#d8eef9', '#7ec9e8', '近战清场、守卫追击和环境压迫被压缩进同一幕。', unlockCount >= 1, GALLERY_THRESHOLDS[0]);
      drawGalleryCard(200, 98, 120, 134, '环境区', '#e6f3d1', '#79c49b', '探索、商人和奖惩事件会逐步展开整片麦野。', unlockCount >= 2, GALLERY_THRESHOLDS[1]);
      drawGalleryCard(40, 262, 120, 134, '终幕战役', '#f4e6b8', '#e7c978', '折镜、总闸与 Boss 反打共同组成统一战役收束。', unlockCount >= 3, GALLERY_THRESHOLDS[2]);
      drawGalleryCard(200, 262, 120, 134, '图集手记', '#e5dff3', '#97b4f0', '累计高评级后解锁的图集化界面与开发记录。', unlockCount >= 4, GALLERY_THRESHOLDS[3]);
    }
    Sprite.label(ctx, `累计评级点 ${score} / 已解锁 ${unlockCount} 张`, 180, 548, ui.softText, 11, 'center');
    drawSmallButton(30, 584, 84, 28, '返回', returnFromMenu);
    drawSmallButton(246, 584, 84, 28, '成就馆', () => openAchievements(state.menuBack));
  }

  function drawAchievementBanner() {
    const ui = getGlobalUiTheme();
    const banner = state.achievementBanner;
    const slide = Math.max(0, Math.min(1, banner.timer > 2.6 ? (3 - banner.timer) / 0.4 : banner.timer / 0.4));
    const y = 18 - (1 - slide) * 42;
    drawPaperCard(62, y, 236, 34, '#fffefb', ui.shellBorder, ui.shadow);
    Sprite.frame(ctx, 70, y + 6, 22, 22, '#dcf7e6', ui.shellBorder);
    if (Sprite.drawIcon) {
      Sprite.drawIcon(ctx, 'trophy', 72, y + 8, 18);
    } else {
      Sprite.label(ctx, '成', 81, y + 10, ui.text, 12, 'center');
    }
    Sprite.label(ctx, banner.title, 102, y + 6, ui.text, 12, 'left');
    Sprite.label(ctx, banner.desc, 102, y + 19, ui.softText, 9, 'left');
  }

  function drawSky(theme) {
    if (theme === 'night') {
      Sprite.rect(ctx, 0, 0, BASE_WIDTH, BASE_HEIGHT, '#3f617e');
      Sprite.rect(ctx, 0, 70, BASE_WIDTH, 180, '#6d97b6');
      Sprite.rect(ctx, 268, 42, 36, 36, '#fff0b6');
      for (let i = 0; i < 20; i += 1) {
        Sprite.rect(ctx, 18 + (i * 17) % 320, 16 + (i * 31) % 150, 2, 2, '#f8fbff');
      }
    } else {
      Sprite.rect(ctx, 0, 0, BASE_WIDTH, BASE_HEIGHT, '#b8e8ff');
      Sprite.rect(ctx, 0, 140, BASE_WIDTH, 220, '#e8f8ff');
      Sprite.rect(ctx, 256, 40, 50, 50, '#fff4b8');
      Sprite.rect(ctx, 80, 54, 42, 16, '#fbffff');
      Sprite.rect(ctx, 210, 72, 56, 16, '#fbffff');
    }
  }

  function drawFieldBackdrop(theme) {
    Sprite.rect(ctx, 0, 360, BASE_WIDTH, 280, theme === 'night' ? '#b7b17c' : '#dfc97a');
    Sprite.rect(ctx, 0, 544, BASE_WIDTH, 96, theme === 'night' ? '#8f7b53' : '#9c7b47');
    for (let x = 12; x < BASE_WIDTH; x += 22) {
      const color = theme === 'night' ? '#efe4ab' : '#fbebaa';
      Sprite.rect(ctx, x, 366 + (x % 3), 2, 16, color);
      Sprite.rect(ctx, x - 4, 374 + (x % 5), 8, 2, color);
    }
  }

  function drawKidsReality() {
    Sprite.drawPlayer(ctx, 98, 394, { facing: 'right', walking: true, colorShirt: '#7dc4ff', colorPants: '#efb454' }, state.frameIndex);
    Sprite.drawPlayer(ctx, 246, 394, { facing: 'left', walking: true, colorShirt: '#f08cac', colorPants: '#7d96f3' }, state.frameIndex);
    Sprite.rect(ctx, 162, 418, 36, 22, '#544f68');
    Sprite.rect(ctx, 168, 424, 16, 8, '#98e6f3');
    Sprite.rect(ctx, 186, 425, 4, 10, '#f0d689');
    Sprite.rect(ctx, 182, 429, 12, 3, '#f0d689');
  }

  function drawMenuShell(title, subtitle) {
    const ui = getGlobalUiTheme();
    Sprite.rect(ctx, 0, 0, BASE_WIDTH, BASE_HEIGHT, '#f7fbff');
    Sprite.rect(ctx, 0, 478, BASE_WIDTH, 162, '#edf7ff');
    Sprite.rect(ctx, 0, 0, BASE_WIDTH, 54, '#f4faff');
    Sprite.rect(ctx, 0, 54, BASE_WIDTH, 2, ui.gold);
    Sprite.label(ctx, title, 28, 20, ui.text, 22, 'left');
    Sprite.label(ctx, subtitle, 332, 24, ui.softText, 9, 'right');
    Sprite.rect(ctx, 24, 66, 312, 2, ui.accent);
  }

  function drawGalleryCard(x, y, w, h, title, fill, accent, text, unlocked, needScore) {
    const ui = getGlobalUiTheme();
    drawPaperCard(x, y, w, h, ui.panelSoft, ui.shellBorder, ui.shadow);
    Sprite.frame(ctx, x + 10, y + 10, w - 20, 56, ui.panelMute, ui.shellBorder);
    const galleryIndex = title === '危险区' ? 0 : title === '环境区' ? 1 : title === '终幕战役' ? 2 : 3;
    if (unlocked) {
      if (!Sprite.drawAtlasGallery(ctx, galleryIndex, x + 12, y + 12, w - 24, 52)) {
        Sprite.rect(ctx, x + 12, y + 12, w - 24, 52, fill);
        Sprite.rect(ctx, x + 22, y + 24, w - 44, 20, accent);
      }
    } else {
      Sprite.rect(ctx, x + 12, y + 12, w - 24, 52, '#eef1ed');
      Sprite.rect(ctx, x + 32, y + 26, w - 64, 14, '#cfd8d2');
    }
    Sprite.label(ctx, title, x + w * 0.5, y + 76, ui.text, 11, 'center');
    if (unlocked) {
      drawParagraph(text, x + 10, y + 92, w - 20, 12, ui.softText);
    } else {
      drawParagraph(`累计评级点达到 ${needScore} 后解锁。`, x + 10, y + 96, w - 20, 12, ui.softText);
    }
  }

  function getAchievementList() {
    return [
      { id: 'firstAdventure', name: '初次冒险', desc: '完成统一战役中的任意一幕。' },
      { id: 'darkWalker', name: '危险区专家', desc: '完成危险区侧重的三幕内容。' },
      { id: 'sunWalker', name: '环境区专家', desc: '完成探索解谜侧重的三幕内容。' },
      { id: 'dualRoutes', name: '战役合流', desc: '危险区与环境区两条路线都完成。' },
      { id: 'perfectSneak', name: '完美压场', desc: '任意战斗幕无伤通关。' },
      { id: 'collector', name: '收藏家', desc: '后三幕探索解谜内容全部拿到 S 级。' },
      { id: 'marketMind', name: '商人直觉', desc: '在常驻商人处买空整轮货架。' },
      { id: 'rhythmMaster', name: '节奏大师', desc: '音乐会关获得 S 级。' },
      { id: 'rich', name: '富翁', desc: '累计持有 100 金币。' },
      { id: 'truth', name: '真相', desc: '触发秘野破关行的隐藏秘档彩蛋。' }
    ];
  }

  function getAchievementMeta(id) {
    return getAchievementList().find((item) => item.id === id) || null;
  }

  function drawButton(x, y, w, h, text, action) {
    const ui = getGlobalUiTheme();
    Sprite.rect(ctx, x + 2, y + 4, w, h, ui.shadow);
    Sprite.frame(ctx, x, y, w, h, '#f5fbff', ui.shellBorder);
    Sprite.rect(ctx, x + 4, y + 4, w - 8, 2, '#ffffff');
    Sprite.rect(ctx, x + 6, y + h - 8, Math.max(22, Math.floor(w * 0.26)), 2, ui.accent);
    Sprite.rect(ctx, x + 6, y + 6, Math.max(20, Math.floor(w * 0.22)), 2, ui.coral);
    Sprite.rect(ctx, x + w - Math.max(26, Math.floor(w * 0.22)) - 6, y + 6, Math.max(20, Math.floor(w * 0.18)), 2, ui.blue);
    Sprite.rect(ctx, x + w - Math.max(28, Math.floor(w * 0.2)) - 6, y + h - 12, Math.max(18, Math.floor(w * 0.16)), 2, ui.plum);
    Sprite.label(ctx, text, x + w * 0.5, y + Math.max(8, Math.floor(h * 0.24)), '#4f463e', 14, 'center');
    state.hitAreas.push({ shape: 'rect', x, y, w, h, kind: 'tap', action });
  }

  function drawSmallButton(x, y, w, h, text, action) {
    const ui = getGlobalUiTheme();
    Sprite.rect(ctx, x + 1, y + 2, w, h, ui.shadow);
    Sprite.frame(ctx, x, y, w, h, '#fbfdff', ui.shellBorder);
    Sprite.rect(ctx, x + 3, y + 3, w - 6, 1, ui.accent);
    Sprite.rect(ctx, x + 4, y + 5, Math.max(10, Math.floor(w * 0.18)), 1, ui.coral);
    Sprite.rect(ctx, x + 4, y + h - 5, Math.max(12, Math.floor(w * 0.24)), 1, ui.blue);
    Sprite.rect(ctx, x + w - Math.max(12, Math.floor(w * 0.2)) - 4, y + h - 5, Math.max(10, Math.floor(w * 0.16)), 1, ui.plum);
    Sprite.label(ctx, text, x + w * 0.5, y + Math.max(5, Math.floor(h * 0.18)), ui.text, 10, 'center');
    state.hitAreas.push({ shape: 'rect', x, y, w, h, kind: 'tap', action });
  }

  function drawParagraph(text, x, y, maxWidth, lineHeight, color) {
    wrapText(text, Math.max(8, Math.floor(maxWidth / 11.5))).forEach((line, index) => {
      Sprite.label(ctx, line, x, y + index * lineHeight, color, 12, 'left');
    });
  }

  function wrapText(text, maxChars) {
    const source = String(text).split('\n');
    const lines = [];
    source.forEach((part) => {
      let line = '';
      for (let i = 0; i < part.length; i += 1) {
        line += part[i];
        if (line.length >= maxChars) {
          lines.push(line);
          line = '';
        }
      }
      if (line) {
        lines.push(line);
      }
      if (!part.length) {
        lines.push('');
      }
    });
    return lines;
  }

  function getTile(grid, x, y) {
    if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) {
      return TILE.WALL;
    }
    return grid[y][x];
  }

  function pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
  }

  function distance(x1, y1, x2, y2) {
    return Math.hypot(x1 - x2, y1 - y2);
  }

  function pointInExpandedRect(x, y, rect, padding) {
    const pad = padding || 0;
    return x >= rect.x - pad && x <= rect.x + rect.w + pad && y >= rect.y - pad && y <= rect.y + rect.h + pad;
  }

  function bulletHitsRect(bullet, rect, padding) {
    const startX = Number.isFinite(bullet.prevX) ? bullet.prevX : bullet.x;
    const startY = Number.isFinite(bullet.prevY) ? bullet.prevY : bullet.y;
    const dx = bullet.x - startX;
    const dy = bullet.y - startY;
    const pad = (padding || 0) + (bullet.hitRadius || 0);
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
    for (let index = 0; index <= steps; index += 1) {
      const ratio = index / steps;
      if (pointInExpandedRect(startX + dx * ratio, startY + dy * ratio, rect, pad)) {
        return true;
      }
    }
    return false;
  }

  function setHitFlash(target, amount) {
    if (!target) {
      return;
    }
    target.hitFlash = Math.max(target.hitFlash || 0, amount || 0.88);
  }

  function drawFatal() {
    fatalShown = true;
    console.error(lastFatalMessage || ERROR_TEXT);
  }

  function boot() {
    if (booted) {
      return;
    }
    booted = true;
    try {
      init();
    } catch (error) {
      lastFatalMessage = error && (error.message || String(error)) ? String(error.message || error) : '启动失败';
      console.error(error);
    }
  }

  if (document.getElementById('gameCanvas')) {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
    window.addEventListener('load', boot, { once: true });
  }
})();
