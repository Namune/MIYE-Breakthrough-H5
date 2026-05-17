window.PixelSprites = (() => {
  function loadImage(src) {
    const image = new Image();
    image.src = src;
    return image;
  }

  const healthImage = loadImage('image/health.png');
  let healthReady = false;
  healthImage.onload = () => {
    healthReady = true;
  };
  healthImage.onerror = () => {
    healthReady = false;
  };

  const HEALTH_ATLAS = Object.freeze({
    full: { sx: 0, sy: 0, sw: 111, sh: 87 },
    half: { sx: 111, sy: 0, sw: 112, sh: 87 },
    empty: { sx: 223, sy: 0, sw: 112, sh: 87 }
  });

  const safeImage = loadImage('image/safe.png');
  let safeReady = false;
  safeImage.onload = () => {
    safeReady = true;
  };
  safeImage.onerror = () => {
    safeReady = false;
  };

  const ITEM_ICON_FILES = Object.freeze({
    sword: 'image/funcitem_image (1).png',
    wand: 'image/funcitem_image (3).png',
    dagger: 'image/funcitem_image (4).png',
    axe: 'image/funcitem_image (5).png',
    coin: 'image/funcitem_image (6).png',
    crystal: 'image/funcitem_image (7).png',
    key: 'image/funcitem_image (8).png',
    potionRed: 'image/funcitem_image (9).png',
    potionBlue: 'image/funcitem_image (10).png',
    scroll: 'image/funcitem_image (11).png',
    map: 'image/funcitem_image (12).png',
    exp: 'image/funcitem_image (13).png',
    clover: 'image/funcitem_image (14).png',
    bomb: 'image/funcitem_image (15).png',
    hourglass: 'image/funcitem_image (16).png',
    feather: 'image/funcitem_image (17).png',
    amethyst: 'image/funcitem_image (18).png',
    web: 'image/funcitem_image (19).png',
    herb: 'image/funcitem_image (20).png',
    mushroom: 'image/funcitem_image (21).png',
    bread: 'image/funcitem_image (22).png',
    bottle: 'image/funcitem_image (23).png',
    fish: 'image/funcitem_image (24).png',
    torch: 'image/funcitem_image (25).png',
    attack: 'image/funcitem_image (26).png',
    defense: 'image/funcitem_image (27).png',
    speed: 'image/funcitem_image (28).png',
    crit: 'image/funcitem_image (29).png',
    poison: 'image/funcitem_image (30).png',
    fire: 'image/funcitem_image (31).png',
    ice: 'image/funcitem_image (32).png',
    shock: 'image/funcitem_image (33).png',
    heal: 'image/funcitem_image (34).png',
    alert: 'image/funcitem_image (35).png',
    question: 'image/funcitem_image (36).png',
    arrowUp: 'image/funcitem_image (37).png',
    shop: 'image/funcitem_image (38).png',
    save: 'image/funcitem_image (39).png',
    campfire: 'image/funcitem_image (40).png',
    anchor: 'image/funcitem_image (41).png',
    lock: 'image/funcitem_image (42).png',
    trophy: 'image/funcitem_image (43).png',
    settings: 'image/funcitem_image (44).png'
  });

  const ITEM_ICON_IMAGES = {};
  Object.entries(ITEM_ICON_FILES).forEach(([name, src]) => {
    ITEM_ICON_IMAGES[name] = loadImage(src);
  });

  const OBJECT_FILES = Object.freeze({
    slimeGreen: 'image/objects/图层 1.png',
    skeletonShield: 'image/objects/图层 2.png',
    goblinTorch: 'image/objects/图层 3.png',
    bruteHorn: 'image/objects/图层 4.png',
    tentacle: 'image/objects/图层 5.png',
    ghostBlue: 'image/objects/图层 6.png',
    slimeFire: 'image/objects/图层 7.png',
    cultistPurple: 'image/objects/图层 8.png',
    bat: 'image/objects/图层 9.png',
    mimicPlant: 'image/objects/图层 10.png',
    mushroom: 'image/objects/图层 11.png',
    rockGolem: 'image/objects/图层 12.png',
    zombie: 'image/objects/图层 13.png',
    skeletonTorch: 'image/objects/图层 14.png',
    slimeBlue: 'image/objects/图层 15.png',
    mageBlue: 'image/objects/图层 16.png',
    boarDemon: 'image/objects/图层 17.png',
    skeletonKnight: 'image/objects/图层 18.png',
    spider: 'image/objects/图层 19.png',
    magePurple: 'image/objects/图层 20.png',
    iceGolem: 'image/objects/图层 21.png',
    stoneKnight: 'image/objects/图层 22.png',
    ogreBoss: 'image/objects/图层 23.png',
    lavaBoss: 'image/objects/图层 24.png',
    dragonBoss: 'image/objects/图层 25.png',
    treeBoss: 'image/objects/图层 26.png',
    finalBossA: 'image/objects/图层 33.png',
    finalBossB: 'image/objects/图层 34.png'
  });

  const OBJECT_IMAGES = {};
  Object.entries(OBJECT_FILES).forEach(([name, src]) => {
    OBJECT_IMAGES[name] = loadImage(src);
  });

  const BOX_FILES = Object.freeze({
    commonClosed: 'image/box/image (6).png',
    commonOpen: 'image/box/image (9).png',
    rareClosed: 'image/box/image (4).png',
    rareOpen: 'image/box/image (3).png',
    epicClosed: 'image/box/Box_Max (2).png',
    epicOpen: 'image/box/Box_Max (3).png',
    bossClosed: 'image/box/Box_Max (1).png',
    bossOpen: 'image/box/Box_Max (6).png'
  });

  const BOX_IMAGES = {};
  Object.entries(BOX_FILES).forEach(([name, src]) => {
    BOX_IMAGES[name] = loadImage(src);
  });

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function frame(ctx, x, y, w, h, fill, border) {
    rect(ctx, x, y, w, h, border);
    rect(ctx, x + 2, y + 2, w - 4, h - 4, fill);
  }

  function label(ctx, text, x, y, color, size, align) {
    ctx.fillStyle = color;
    ctx.font = `bold ${size || 12}px "Lucida Console", "Courier New", monospace`;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
  }

  function drawAtlas(ctx, frame, dx, dy, dw, dh) {
    return true;
  }

  function drawAtlasMerchant(ctx, x, y, frameIndex) {
    return drawIcon(ctx, 'shop', x - 2, y - 4, 20);
  }

  function drawAtlasMerchantSign(ctx, x, y) {
    return drawIcon(ctx, 'question', x, y - 2, 16);
  }

  function drawAtlasChest(ctx, kind, x, y, frameIndex) {
    const icon = kind === 'rare' ? 'crystal' : (kind === 'supply' ? 'barrel' : 'crate');
    return drawIcon(ctx, icon, x - 1, y - 2, 18);
  }

  function drawAtlasGallery(ctx, index, x, y, w, h) {
    frame(ctx, x, y, w, h, '#fffef9', '#d7c7af');
    const layouts = [
      [
        'sword', 'wand', 'dagger', 'axe', 'defense',
        'coin', 'crystal', 'key', 'potionRed', 'potionBlue', 'scroll'
      ],
      [
        'map', 'exp', 'clover', 'bomb', 'hourglass',
        'feather', 'amethyst', 'web', 'herb', 'mushroom', 'bread'
      ],
      [
        'bottle', 'fish', 'torch', 'attack', 'defense',
        'speed', 'crit', 'poison', 'fire', 'ice', 'shock'
      ],
      [
        'heal', 'alert', 'question', 'arrowUp', 'shop',
        'save', 'campfire', 'anchor', 'lock', 'trophy', 'settings'
      ]
    ];
    const palette = [
      { top: '#dff4ff', bottom: '#f8fcff', stripe: '#b7e1f7' },
      { top: '#eef9dc', bottom: '#fffef2', stripe: '#d7ef9e' },
      { top: '#fff2dc', bottom: '#fffaf1', stripe: '#f3d29a' },
      { top: '#efe7ff', bottom: '#fcfbff', stripe: '#cfbff2' }
    ][index] || { top: '#eef5ff', bottom: '#fffef7', stripe: '#d6e1f4' };
    rect(ctx, x + 3, y + 3, w - 6, h - 6, palette.top);
    rect(ctx, x + 3, y + Math.floor(h * 0.58), w - 6, Math.ceil(h * 0.42) - 3, palette.bottom);
    rect(ctx, x + 8, y + h - 17, w - 16, 4, palette.stripe);
    const group = layouts[index] || layouts[0];
    let atlasUsed = false;
    group.forEach((name, itemIndex) => {
      const col = itemIndex % 4;
      const row = Math.floor(itemIndex / 4);
      atlasUsed = drawIcon(ctx, name, x + 8 + col * 22, y + 6 + row * 16, 14) || atlasUsed;
    });
    return atlasUsed;
  }

  function isItemImageReady(name) {
    const image = ITEM_ICON_IMAGES[name];
    return Boolean(image && image.complete && image.naturalWidth > 0);
  }

  function drawLoadedItemImage(ctx, name, x, y, size, alpha) {
    const image = ITEM_ICON_IMAGES[name];
    if (!isItemImageReady(name)) {
      return false;
    }
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, Math.round(x), Math.round(y), Math.round(size), Math.round(size));
    ctx.restore();
    return true;
  }

  function drawIcon(ctx, name, x, y, size) {
    const s = Math.max(12, Math.round(size || 18));
    if (name === 'heartFull' || name === 'heartHalf' || name === 'heartEmpty') {
      return drawHealthHeart(ctx, name === 'heartFull' ? 'full' : (name === 'heartHalf' ? 'half' : 'empty'), x, y, s, Math.round(s * 0.82));
    }
    const alias = name === 'shieldFull' || name === 'shieldHalf' || name === 'shieldEmpty' ? 'defense'
      : name === 'sign' ? 'scroll'
        : name === 'lamp' ? 'torch'
          : name === 'barrel' ? 'bomb'
            : name === 'crate' ? 'bread'
              : name === 'stealth' ? 'feather'
                : name;
    if (drawLoadedItemImage(ctx, alias, x, y, s, name === 'shieldHalf' ? 0.55 : (name === 'shieldEmpty' ? 0.22 : 1))) {
      return true;
    }
    frame(ctx, x, y, s, s, '#120f16', '#2c2230');
    label(ctx, alias.slice(0, 1).toUpperCase(), x + Math.floor(s * 0.5), y + 2, '#f6f1da', Math.max(9, s - 7), 'center');
    return true;
  }

  function isImageReady(image) {
    return Boolean(image && image.complete && image.naturalWidth > 0);
  }

  function drawTintedImage(ctx, image, x, y, w, h, tintColor, tintAlpha) {
    if (!isImageReady(image)) {
      return false;
    }
    const dx = Math.round(x);
    const dy = Math.round(y);
    const dw = Math.round(w);
    const dh = Math.round(h);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, dx, dy, dw, dh);
    if (tintColor && tintAlpha > 0) {
      ctx.globalAlpha = Math.min(1, tintAlpha * 0.45);
      ctx.drawImage(image, dx - 1, dy, dw, dh);
      ctx.drawImage(image, dx + 1, dy, dw, dh);
      ctx.drawImage(image, dx, dy - 1, dw, dh);
      ctx.drawImage(image, dx, dy + 1, dw, dh);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = Math.min(0.92, tintAlpha);
      ctx.fillStyle = tintColor;
      ctx.fillRect(dx, dy, dw, dh);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.55, tintAlpha * 0.8);
      ctx.fillStyle = '#ffd1d1';
      ctx.fillRect(dx, dy, dw, dh);
    }
    ctx.restore();
    return true;
  }

  function drawObjectSprite(ctx, key, x, y, w, h, hitFlash) {
    const image = OBJECT_IMAGES[key];
    return drawTintedImage(ctx, image, x, y, w, h, '#ff5c5c', Math.max(0, Math.min(0.82, hitFlash || 0)));
  }

  function drawAnimatedObjectSprite(ctx, keys, x, y, w, h, phase, hitFlash) {
    const frames = (keys || []).filter((key) => OBJECT_IMAGES[key]);
    if (!frames.length) {
      return false;
    }
    const index = Math.floor((phase || 0) * 5) % frames.length;
    return drawObjectSprite(ctx, frames[index], x, y, w, h, hitFlash);
  }

  function drawChestSprite(ctx, tier, x, y, opened) {
    const key = `${tier || 'common'}${opened ? 'Open' : 'Closed'}`;
    const image = BOX_IMAGES[key];
    if (!isImageReady(image)) {
      return false;
    }
    const naturalRatio = image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 1;
    const targetH = tier === 'boss' ? 28 : (tier === 'epic' ? 24 : 22);
    const targetW = Math.round(targetH * naturalRatio);
    return drawTintedImage(ctx, image, x - Math.floor(targetW * 0.5), y - targetH, targetW, targetH, null, 0);
  }

  function drawHealthHeart(ctx, state, x, y, w, h) {
    const frame = HEALTH_ATLAS[state];
    if (!healthReady || !frame) {
      return false;
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      healthImage,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      Math.round(x),
      Math.round(y),
      Math.round(w),
      Math.round(h)
    );
    ctx.restore();
    return true;
  }

  function drawSafeShield(ctx, state, x, y, w, h) {
    const width = Math.round(w || 16);
    const height = Math.round(h || width);
    if (safeReady && safeImage.naturalWidth > 0) {
      const frameWidth = safeImage.naturalWidth / 3;
      const sx = state === 'full' ? 0 : (state === 'half' ? frameWidth : frameWidth * 2);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(safeImage, sx, 0, frameWidth, safeImage.naturalHeight, Math.round(x), Math.round(y), width, height);
      ctx.restore();
      return true;
    }
    frame(ctx, x, y, width, height, '#f4fbff', '#c7d8e3');
    label(ctx, state === 'full' ? '盾' : (state === 'half' ? '半' : '空'), x + width * 0.5, y + 2, '#597183', Math.max(8, width - 6), 'center');
    return true;
  }

  function drawTile(ctx, tile, x, y, theme) {
    const night = theme === 'night';
    if (tile === 1) {
      rect(ctx, x, y, 16, 16, night ? '#395538' : '#5f8f50');
      rect(ctx, x + 2, y + 2, 4, 12, night ? '#5a7b46' : '#82b96e');
      rect(ctx, x + 8, y + 1, 5, 13, night ? '#4f6c3f' : '#77aa61');
    } else if (tile === 2) {
      rect(ctx, x, y, 16, 16, night ? '#7a6b34' : '#d3b758');
      rect(ctx, x + 2, y + 1, 2, 14, night ? '#a18d4a' : '#f6d77f');
      rect(ctx, x + 6, y + 3, 2, 12, night ? '#b59b55' : '#ffe28a');
      rect(ctx, x + 10, y + 2, 2, 13, night ? '#a78e49' : '#f0cf6f');
    } else if (tile === 3) {
      rect(ctx, x, y, 16, 16, night ? '#214f6d' : '#4ea5d9');
      rect(ctx, x, y + 4, 16, 3, night ? '#4e8dad' : '#9addff');
      rect(ctx, x, y + 11, 16, 2, night ? '#346a8a' : '#8ed3f1');
    } else if (tile === 4) {
      rect(ctx, x, y, 16, 16, '#5c4a65');
      rect(ctx, x + 2, y + 2, 2, 12, '#9985a6');
      rect(ctx, x + 6, y + 1, 2, 13, '#84728e');
      rect(ctx, x + 10, y + 3, 2, 11, '#b8a5c7');
    } else if (tile === 5) {
      rect(ctx, x, y, 16, 16, night ? '#6b5c3b' : '#b4935f');
      rect(ctx, x + 2, y + 4, 12, 2, night ? '#90774d' : '#d8b07a');
      rect(ctx, x + 1, y + 10, 12, 2, night ? '#87704a' : '#c9a36f');
    } else if (tile === 6) {
      rect(ctx, x, y, 16, 16, '#8b6a43');
      rect(ctx, x + 1, y + 1, 14, 6, '#c9995a');
      rect(ctx, x + 1, y + 9, 14, 6, '#b78548');
    } else if (tile === 7) {
      rect(ctx, x, y, 16, 16, '#6a502d');
      rect(ctx, x + 1, y + 1, 14, 14, '#8d6a3c');
      rect(ctx, x + 5, y + 1, 2, 14, '#73552f');
      rect(ctx, x + 10, y + 1, 2, 14, '#73552f');
    } else if (tile === 8) {
      rect(ctx, x, y, 16, 16, '#7e6c45');
      rect(ctx, x + 1, y + 1, 14, 14, '#c8428c');
      rect(ctx, x + 1, y + 5, 14, 2, '#ffe684');
      rect(ctx, x + 1, y + 9, 14, 2, '#8ce5ff');
    } else if (tile === 9) {
      rect(ctx, x, y, 16, 16, '#5b4a34');
      rect(ctx, x + 2, y + 2, 12, 12, '#d8c085');
      rect(ctx, x + 11, y + 7, 2, 2, '#5b4a34');
    } else {
      rect(ctx, x, y, 16, 16, night ? '#283426' : '#86af5a');
      rect(ctx, x + 1, y + 1, 14, 5, night ? '#324533' : '#a6cf73');
      rect(ctx, x + 4, y + 10, 2, 4, night ? '#526a3e' : '#6d9640');
      rect(ctx, x + 10, y + 8, 2, 6, night ? '#465d39' : '#6b9340');
    }
  }

  function drawPlayer(ctx, x, y, player, frameIndex) {
    const facing = player.facing || 'down';
    const swing = player.walking ? frameIndex % 2 : 0;
    const coat = player.colorShirt || '#79c6ff';
    const coatShade = '#5da0de';
    const scarf = '#ffd780';
    const pants = player.colorPants || '#546d9f';
    const boot = '#413025';
    const hair = '#6d4b3b';
    const skin = '#f4c7a1';
    const hat = '#7f94d6';
    const hatBand = '#f7e2a0';

    rect(ctx, x + 3, y + 0, 10, 2, hat);
    rect(ctx, x + 4, y + 2, 8, 2, hat);
    rect(ctx, x + 5, y + 3, 6, 1, hatBand);
    rect(ctx, x + 4, y + 4, 8, 2, hair);
    rect(ctx, x + 3, y + 6, 10, 3, skin);
    rect(ctx, x + 4, y + 8, 8, 5, coat);
    rect(ctx, x + 5, y + 13, 6, 2, pants);
    rect(ctx, x + 4, y + 15, 2, 1, boot);
    rect(ctx, x + 10, y + 15, 2, 1, boot);
    rect(ctx, x + 5, y + 8, 6, 1, scarf);
    rect(ctx, x + 4, y + 10, 8, 1, coatShade);
    rect(ctx, x + 3, y + 9, 1, 4, coatShade);
    rect(ctx, x + 12, y + 9, 1, 4, coatShade);

    if (facing === 'left') {
      rect(ctx, x + 5, y + 7, 1, 1, '#2b1a12');
      rect(ctx, x + 3, y + 8, 1, 4, skin);
      rect(ctx, x + 4 + swing, y + 15, 2, 1, boot);
      rect(ctx, x + 9 - swing, y + 15, 2, 1, boot);
      rect(ctx, x + 3, y + 3, 2, 4, hair);
    } else if (facing === 'right') {
      rect(ctx, x + 10, y + 7, 1, 1, '#2b1a12');
      rect(ctx, x + 12, y + 8, 1, 4, skin);
      rect(ctx, x + 5 + swing, y + 15, 2, 1, boot);
      rect(ctx, x + 10 - swing, y + 15, 2, 1, boot);
      rect(ctx, x + 11, y + 3, 2, 4, hair);
    } else if (facing === 'up') {
      rect(ctx, x + 4, y + 4, 8, 3, hair);
      rect(ctx, x + 4, y + 8, 8, 5, coatShade);
      rect(ctx, x + 6, y + 8, 4, 1, scarf);
      rect(ctx, x + 5 + swing, y + 15, 2, 1, boot);
      rect(ctx, x + 9 - swing, y + 15, 2, 1, boot);
    } else {
      rect(ctx, x + 6, y + 7, 1, 1, '#2b1a12');
      rect(ctx, x + 9, y + 7, 1, 1, '#2b1a12');
      rect(ctx, x + 5 + swing, y + 15, 2, 1, boot);
      rect(ctx, x + 9 - swing, y + 15, 2, 1, boot);
    }
  }

  function drawNpc(ctx, x, y, npc, frameIndex) {
    drawPlayer(ctx, x, y, {
      facing: npc.facing || 'down',
      walking: npc.walking,
      colorShirt: npc.shirt,
      colorPants: npc.pants
    }, frameIndex);
    rect(ctx, x + 2, y - 2, 12, 2, npc.badge || '#ffe08c');
  }

  function drawGuard(ctx, x, y, phase) {
    rect(ctx, x + 4, y + 1, 8, 6, '#d9c399');
    rect(ctx, x + 4, y + 7, 8, 8, '#69824e');
    rect(ctx, x + 2, y + 8, 2, 6, '#906a3b');
    rect(ctx, x + 12, y + 8, 2, 6, '#906a3b');
    rect(ctx, x + 1, y + 0, 14, 2, '#71532e');
    rect(ctx, x + 6 + Math.round(Math.sin(phase) * 1), y + 13, 2, 3, '#4b351d');
    rect(ctx, x + 9 - Math.round(Math.sin(phase) * 1), y + 13, 2, 3, '#4b351d');
    rect(ctx, x + 5, y + 3, 2, 2, '#2d2117');
    rect(ctx, x + 9, y + 3, 2, 2, '#2d2117');
  }

  function drawBoss(ctx, x, y, boss, time) {
    if (boss && boss.duckBoss) {
      const bob = Math.sin(time * 4) * 1.5;
      rect(ctx, x + 6, y + 10 + bob, 20, 14, '#fff7cf');
      rect(ctx, x + 10, y + 4 + bob, 12, 10, '#fff0a8');
      rect(ctx, x + 22, y + 10 + bob, 6, 4, '#ffb45f');
      rect(ctx, x + 12, y + 8 + bob, 2, 2, '#2b1a12');
      rect(ctx, x + 18, y + 8 + bob, 2, 2, '#2b1a12');
      rect(ctx, x + 9, y + 24 + bob, 4, 6, '#f58d54');
      rect(ctx, x + 19, y + 24 + bob, 4, 6, '#f58d54');
      rect(ctx, x + 8, y + 2 + bob, 16, 2, '#fffbe1');
      return;
    }
    const shake = boss.hitFlash > 0 ? ((Math.floor(time * 40) % 2) ? 1 : -1) : 0;
    if (boss.spriteFrames && drawAnimatedObjectSprite(ctx, boss.spriteFrames, x + shake - 10, y + shake - 8, 52, 52, time, boss.hitFlash * 2.8)) {
      return;
    }
    rect(ctx, x + shake, y + 6, 32, 20, boss.hitFlash > 0 ? '#ff8484' : '#2b3049');
    rect(ctx, x + 6 + shake, y, 20, 12, '#4c526f');
    rect(ctx, x + 10 + shake, y + 3, 4, 4, '#fff2cc');
    rect(ctx, x + 18 + shake, y + 3, 4, 4, '#fff2cc');
    rect(ctx, x + 12 + shake, y + 9, 8, 2, '#8892c2');
    rect(ctx, x + 2 + shake, y + 24, 6, 8, '#161f31');
    rect(ctx, x + 24 + shake, y + 24, 6, 8, '#161f31');
  }

  function drawPickup(ctx, x, y, type, phase) {
    if (type === 'glow') {
      rect(ctx, x + 4, y + 2, 8, 12, '#fff3a3');
      rect(ctx, x + 6, y, 4, 2, '#fffce4');
      rect(ctx, x + 3, y + 5, 10, 2, '#ffd35a');
    } else if (type === 'gear') {
      rect(ctx, x + 4, y + 4, 8, 8, '#9fd0ff');
      rect(ctx, x + 2, y + 6, 2, 4, '#d8f0ff');
      rect(ctx, x + 12, y + 6, 2, 4, '#d8f0ff');
      rect(ctx, x + 6, y + 2, 4, 2, '#d8f0ff');
      rect(ctx, x + 6, y + 12, 4, 2, '#d8f0ff');
    } else if (type === 'screw') {
      rect(ctx, x + 6, y + 2, 4, 12, '#d7d7df');
      rect(ctx, x + 4, y + 2, 8, 3, '#b7b8c2');
    } else if (type === 'battery') {
      rect(ctx, x + 4, y + 3, 8, 11, '#8ef0a2');
      rect(ctx, x + 6, y + 1, 4, 2, '#d7fff0');
      rect(ctx, x + 6, y + 5, 2, 6, '#1f4130');
      rect(ctx, x + 8, y + 7, 2, 2, '#1f4130');
    } else if (type === 'seed') {
      rect(ctx, x + 6, y + 4, 4, 6, '#dcb472');
      rect(ctx, x + 7, y + 2, 2, 2, '#7cd07a');
      rect(ctx, x + 4, y + 10 + Math.round(Math.sin(phase) * 1), 8, 2, '#f7df97');
    } else {
      rect(ctx, x + 5, y + 5, 6, 6, '#fff');
    }
  }

  function drawBullet(ctx, x, y, kind) {
    if (kind === 'bomb') {
      rect(ctx, x - 4, y - 4, 8, 8, '#5f4d41');
      rect(ctx, x - 2, y - 6, 4, 2, '#ffd88a');
      rect(ctx, x - 1, y - 2, 2, 2, '#fff0c3');
      rect(ctx, x + 4, y - 1, 2, 2, '#ff8748');
      return;
    }
    if (kind === 'player') {
      rect(ctx, x - 4, y - 1, 8, 2, '#7fd7ff');
      rect(ctx, x - 1, y - 4, 2, 8, '#b9eeff');
      rect(ctx, x - 2, y - 2, 4, 4, '#effcff');
      rect(ctx, x + 3, y - 1, 2, 2, '#ffe7a6');
      return;
    }
    rect(ctx, x - 2, y - 2, 4, 4, '#f48da0');
    rect(ctx, x - 1, y - 1, 2, 2, '#fffce3');
  }

  function drawDpadButton(ctx, x, y, size, labelText, active) {
    frame(ctx, x, y, size, size, active ? '#f3dd84' : '#e3c76c', '#5d4425');
    label(ctx, labelText, x + size * 0.5, y + 12, '#4c341c', 18, 'center');
  }

  function drawRoundButton(ctx, x, y, radius, labelTop, labelBottom, active, disabled) {
    const size = radius * 2;
    const left = x - radius;
    const top = y - radius;
    const border = disabled ? '#c6d3df' : (active ? '#86d6ff' : '#c4d7ea');
    const body = disabled ? '#eef3f8' : (active ? '#fef5ff' : '#f7fbff');
    const core = disabled ? '#dde7f1' : (active ? '#ffd7f2' : '#dff5ff');
    const glow = disabled ? 'rgba(167,181,195,0.12)' : (active ? 'rgba(255,214,247,0.22)' : 'rgba(151,220,255,0.16)');
    rect(ctx, left + 3, top + 5, size, size, 'rgba(123, 166, 207, 0.14)');
    rect(ctx, left - 3, top - 3, size + 6, size + 6, glow);
    frame(ctx, left, top, size, size, body, border);
    frame(ctx, left + 4, top + 4, size - 8, size - 8, core, border);
    frame(ctx, left + 8, top + 8, size - 16, size - 16, active ? '#fff7ff' : '#f5fbff', border);
    rect(ctx, left + 8, top + 8, size - 16, 2, active ? '#fff8ff' : '#ffffff');
    rect(ctx, x - 8, y - 18, 16, 3, active ? '#ffe58b' : '#ffffff');
    rect(ctx, x - 12, y - 10, 24, 14, active ? '#fff0bd' : '#ffffff');
    rect(ctx, x - 6, y - 4, 12, 6, active ? '#fff7db' : '#f5fbff');
    rect(ctx, x - 16, y + 11, 32, 2, active ? '#ffd7f4' : '#d7efff');
    rect(ctx, left + 5, top + size - 8, size - 10, 2, active ? '#86d6ff' : '#bfd8eb');
    rect(ctx, left + 8, top + size - 14, size - 16, 2, active ? '#fff7de' : '#edf7ff');
    rect(ctx, left + 10, top + size - 11, size - 20, 1, active ? '#ffd4ef' : '#cfe8f6');
    label(ctx, labelTop, x, y - 12, disabled ? '#7f8a93' : '#4e5e78', 12, 'center');
    label(ctx, labelBottom, x, y + 3, disabled ? '#7f8a93' : '#4e5e78', 10, 'center');
  }

  function drawJoystick(ctx, baseX, baseY, thumbX, thumbY, active) {
    const shell = '#d4e4ef';
    const plate = active ? '#eef8ff' : '#f9fcff';
    const guide = active ? '#f3d48f' : '#c7d8e6';
    const thumbOuter = active ? '#ffe8b4' : '#f2f6fb';
    const thumbInner = active ? '#fff9de' : '#ffffff';
    rect(ctx, baseX - 36, baseY - 36, 72, 72, 'rgba(167, 184, 196, 0.14)');
    frame(ctx, baseX - 32, baseY - 32, 64, 64, '#ecf4fb', shell);
    frame(ctx, baseX - 28, baseY - 28, 56, 56, plate, shell);
    rect(ctx, baseX - 6, baseY - 24, 12, 48, guide);
    rect(ctx, baseX - 24, baseY - 6, 48, 12, guide);
    rect(ctx, baseX - 4, baseY - 20, 8, 40, active ? '#fff6dd' : '#eef6fc');
    rect(ctx, baseX - 20, baseY - 4, 40, 8, active ? '#fff6dd' : '#eef6fc');
    rect(ctx, baseX - 1, baseY - 1, 2, 2, '#9caebb');
    rect(ctx, Math.round((baseX + thumbX) * 0.5) - 1, Math.round((baseY + thumbY) * 0.5) - 1, 3, 3, active ? '#f0c76e' : '#bfd0de');
    frame(ctx, thumbX - 16, thumbY - 16, 32, 32, thumbOuter, active ? '#d6b46a' : '#c9d5df');
    frame(ctx, thumbX - 10, thumbY - 10, 20, 20, thumbInner, active ? '#ead599' : '#dfe7ee');
  }

  function drawShrine(ctx, x, y, active) {
    rect(ctx, x + 4, y + 2, 8, 12, active ? '#98f0ff' : '#8b759d');
    rect(ctx, x + 2, y + 12, 12, 3, '#5d4425');
    rect(ctx, x + 5, y + 5, 6, 4, active ? '#fff4aa' : '#d9cbef');
    if (active) {
      rect(ctx, x + 1, y + 6, 2, 2, '#fff9df');
      rect(ctx, x + 13, y + 6, 2, 2, '#fff9df');
    }
  }

  function drawSparkle(ctx, x, y, color) {
    rect(ctx, x, y + 2, 6, 2, color);
    rect(ctx, x + 2, y, 2, 6, color);
  }

  function drawHandheldFrame(ctx, rectBox, theme) {
    const rim = theme === 'night' ? '#b7d7e6' : '#c8d9c7';
    const body = theme === 'night' ? '#f8fcff' : '#fffaf0';
    const glass = theme === 'night' ? '#def4fb' : '#ebfaf3';
    frame(ctx, rectBox.x - 10, rectBox.y - 12, rectBox.w + 20, rectBox.h + 24, body, rim);
    rect(ctx, rectBox.x - 4, rectBox.y - 6, rectBox.w + 8, rectBox.h + 12, theme === 'night' ? '#ebf8fe' : '#f3fbf7');
    rect(ctx, rectBox.x, rectBox.y, rectBox.w, rectBox.h, glass);
    rect(ctx, rectBox.x + 8, rectBox.y - 10, 34, 2, '#ffffff');
    rect(ctx, rectBox.x + rectBox.w - 42, rectBox.y - 10, 22, 2, theme === 'night' ? '#a7e5ff' : '#a7e6c8');
    rect(ctx, rectBox.x - 18, rectBox.y + 26, 4, 26, rim);
    rect(ctx, rectBox.x - 18, rectBox.y + 62, 4, 14, theme === 'night' ? '#b8f0ff' : '#bfe7d4');
    rect(ctx, rectBox.x + rectBox.w + 14, rectBox.y + 28, 4, 22, rim);
    rect(ctx, rectBox.x + rectBox.w + 14, rectBox.y + 58, 4, 22, rim);
  }

  return {
    rect,
    frame,
    label,
    drawAtlas,
    drawAtlasMerchant,
    drawAtlasMerchantSign,
    drawAtlasChest,
    drawAtlasGallery,
    drawIcon,
    drawObjectSprite,
    drawAnimatedObjectSprite,
    drawChestSprite,
    drawHealthHeart,
    drawSafeShield,
    drawTile,
    drawPlayer,
    drawNpc,
    drawGuard,
    drawBoss,
    drawPickup,
    drawBullet,
    drawDpadButton,
    drawRoundButton,
    drawJoystick,
    drawShrine,
    drawSparkle,
    drawHandheldFrame
  };
})();
