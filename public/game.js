const buildVersion = 'v4.24-temper-full-refill';
const startHandSize = 5;
const maxHandSize = 7;
const maxTemper = 3;
const cleanVictoryGold = 2;
const finalEncounter = 16;
const colors = ['red', 'green', 'blue', 'purple'];
const modes = ['match', 'sequence', 'flush'];
const weaknessTypes = ['match', 'sequence', 'flush'];
const weaknessLabel = { match:'Match', sequence:'Sequence', flush:'Flush' };
const modeLabel = { match:'Match', sequence:'Sequence', flush:'Flush' };
const traitMult = { match:1.25, sequence:1.25, flush:1.5 };
const enemyNames = ['Moss Imp', 'Tin Goblin', 'Lantern Bat', 'Root Troll', 'Moon Fox', 'Bog Wyrm', 'Clockwork Crab', 'Ash Sprite', 'Cave Beetle', 'Glass Ogre'];
const bossNames = ['The Sleepy Dragon', 'Queen Briarback', 'The Three-Eyed Toad'];
const finalBossName = 'The Crown-Eating Dragon';
let state;
let random = Math.random;

function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function hashSeed(seed) { let h=2166136261; for (const ch of seed) { h^=ch.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; }
function seededRandom(seed) { let a=hashSeed(seed); return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function makeSeed() { return Math.random().toString(36).slice(2,8).toUpperCase(); }
function seedFromUrl() { return new URLSearchParams(location.search).get('seed') || makeSeed(); }
function setSeedUrl(seed) { const url=new URL(location.href); url.searchParams.set('seed',seed); history.replaceState(null,'',url); }
function shuffle(a) { for (let i=a.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function sample(a) { return a[Math.floor(random()*a.length)]; }
function makeCard(n, color) { return { n, color, id: uid() }; }
function makeDeck() { const deck=[]; for (let n=1;n<=8;n++) colors.forEach(c => deck.push(makeCard(n, c))); return shuffle(deck); }
function log(msg) { state.log.unshift(`<p>${msg}</p>`); renderLog(); }

function newEnemy() {
  const level = state.defeated + 1;
  const finalBoss = !state.finalDefeated && level === finalEncounter;
  const boss = finalBoss || (level < finalEncounter && level % 5 === 0) || (state.finalDefeated && level % 5 === 0);
  const weakness = sample(weaknessTypes);
  const hp = finalBoss ? 72 : boss ? 24 + Math.floor(level * 2.5) : 6 + Math.floor(level * 2.0) + Math.floor(random() * 3);
  return {
    name: finalBoss ? finalBossName : boss ? sample(bossNames) : sample(enemyNames),
    boss,
    finalBoss,
    weakness,
    hp,
    maxHp: hp,
    damage: finalBoss ? 7 : boss ? 3 + Math.floor(level / 5) : 1 + Math.floor(level / 5),
    temper: 0
  };
}

function start(seed=seedFromUrl()) {
  seed=seed.trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,24) || makeSeed();
  setSeedUrl(seed);
  random=seededRandom(seed);
  document.title = `Little Quest Deck ${buildVersion}`;
  document.getElementById('buildLabel').textContent = buildVersion;
  document.getElementById('buildStat').textContent = buildVersion;
  state = {
    hp: 16,
    maxHp: 16,
    defeated: 0,
    finalDefeated: false,
    deck: makeDeck(),
    discard: [],
    hand: [],
    handSize: startHandSize,
    sortMode: 'number',
    gold: 0,
    pendingReward: null,
    shopOffers: [],
    playerHit: false,
    monsterHit: false,
    equipment: {
      weapon: { slot:'weapon', icon:'🗡️', name:'Training Sword', mode:null, bonus:0, value:0 },
      armor: { slot:'armor', icon:'🛡️', name:'Cloth Armor', reduction:0, value:0 },
      item: { slot:'item', icon:'🪨', name:'Lucky Pebble', damageBonus:0, hpBonus:0, value:0 }
    },
    lastReward: 'No rewards yet.',
    selected: [],
    enemy: null,
    log: [],
    gameOver: false,
    seed,
    stats: { attacks:0, partialAttacks:0, discards:0, cleanVictories:0, biggestCombo:0, damageTaken:0 }
  };
  advanceEnemy();
  log('Back to basics: one enemy, one hand, one decision loop.');
  render();
}

function drawOne(announce=true) {
  if (!state.deck.length) {
    state.deck = shuffle(state.discard);
    state.discard = [];
    if (state.deck.length && announce) log('The discard pile is shuffled back into the deck.');
  }
  if (state.deck.length) {
    state.hand.push(state.deck.pop());
    return true;
  }
  return false;
}

function effectiveHandSize() { return state.handSize; }
function applyHandLimit() {
  const limit = effectiveHandSize();
  let removed = 0;
  while (state.hand.length > limit) { state.discard.push(state.hand.pop()); removed++; }
  if (removed) { state.selected = []; log(`${state.enemy.name}'s curse shrinks your hand by ${removed}.`); }
}
function fillHand() { while (state.hand.length < effectiveHandSize()) if (!drawOne()) break; sortHand(); }
function advanceEnemy() { state.enemy = newEnemy(); applyHandLimit(); fillHand(); }
function sortHand() {
  if (!state) return;
  if (state.sortMode === 'color') state.hand.sort((a,b)=>colors.indexOf(a.color)-colors.indexOf(b.color) || a.n-b.n);
  else state.hand.sort((a,b)=>a.n-b.n || colors.indexOf(a.color)-colors.indexOf(b.color));
}
function setSortMode(mode) { state.sortMode = mode; sortHand(); render(); }
function selectedCards() { return state.hand.filter(c => state.selected.includes(c.id)); }
function rankCounts(cards) { return Object.values(countCards(cards, c => c.n)).sort((a,b)=>b-a); }
function matchChunkScore(cards, finalPenalty=false) {
  if (cards.length < 2) return 0;
  const counts = rankCounts(cards);
  let penaltyUsed = false;
  let score = 0;
  counts.forEach(count => {
    let effectiveCount = count;
    if (finalPenalty && !penaltyUsed && effectiveCount > 1) { effectiveCount--; penaltyUsed = true; }
    if (effectiveCount >= 2) score += Math.floor(effectiveCount * sizeMultiplier(effectiveCount) * traitMult.match);
  });
  return score;
}
function isMatchCombo(cards) { return matchChunkScore(cards, false) > 0; }
function isSequenceCombo(cards) {
  if (cards.length < 3) return false;
  const nums = cards.map(c => c.n).sort((a,b)=>a-b);
  if (new Set(nums).size !== nums.length) return false;
  return nums.every((n,i) => i === 0 || n === nums[i-1] + 1);
}
function isFlushCombo(cards) { return cards.length >= 3 && cards.every(c => c.color === cards[0].color); }
function traitInfo(cards) {
  const traits = [];
  if (isMatchCombo(cards)) traits.push('match');
  if (isSequenceCombo(cards)) traits.push('sequence');
  if (isFlushCombo(cards)) traits.push('flush');
  return traits;
}
function isValidMode(cards, mode) { return traitInfo(cards).includes(mode); }
function sizeMultiplier(count) { return Math.pow(2, Math.max(0, count - 1)); }
function comboName(traits) { return traits.map(t => weaknessLabel[t]).join(' + '); }
function scoreCombo(cards) {
  const traits = traitInfo(cards);
  const valid = traits.length > 0;
  const finalPenalty = !!state.enemy?.finalBoss;
  const scoreCount = finalPenalty ? Math.max(1, cards.length - 1) : cards.length;
  const sizeMult = sizeMultiplier(scoreCount);
  const matchBase = traits.includes('match') ? matchChunkScore(cards, finalPenalty) : 0;
  const sequenceBase = traits.includes('sequence') ? Math.floor(scoreCount * sizeMult * traitMult.sequence) : 0;
  const flushBase = traits.includes('flush') ? Math.floor(scoreCount * sizeMult * traitMult.flush) : 0;
  const baseBeforeWeakness = matchBase + sequenceBase + flushBase;
  const weaknessMult = valid && traits.includes(state.enemy?.weakness) ? 1.5 : 1;
  const weaponBonus = state.equipment.weapon?.mode && traits.includes(state.equipment.weapon.mode) ? state.equipment.weapon.bonus : 0;
  const weaponAnyBonus = state.equipment.weapon?.damageBonus || 0;
  const itemBonus = state.equipment.item?.damageBonus || 0;
  const total = valid ? Math.floor(baseBeforeWeakness * weaknessMult) + weaponBonus + weaponAnyBonus + itemBonus : 0;
  const pieces = [];
  if (matchBase) pieces.push(`match chunks ${matchBase}`);
  if (finalPenalty) pieces.push(`final boss curse: scores as ${scoreCount} card${scoreCount === 1 ? '' : 's'}`);
  if (sequenceBase) pieces.push(`sequence ${scoreCount} scoring cards ×${sizeMult} ×${traitMult.sequence} = ${sequenceBase}`);
  if (flushBase) pieces.push(`flush ${scoreCount} scoring cards ×${sizeMult} ×${traitMult.flush} = ${flushBase}`);
  if (weaknessMult > 1) pieces.push('×1.5 weakness');
  if (weaponBonus) pieces.push(`+${weaponBonus} weapon`);
  if (weaponAnyBonus) pieces.push(`+${weaponAnyBonus} weapon`);
  if (itemBonus) pieces.push(`+${itemBonus} item`);
  const formula = valid ? `${pieces.join(' + ')} = ${total}` : '';
  return { mode: traits[0], traits, valid, total, multiplier: weaknessMult, formula, margin: valid ? total - state.enemy.hp : null };
}

function attackScore(cards, mode) {
  const score = scoreCombo(cards);
  return { ...score, mode, valid: score.traits.includes(mode) };
}

function bestAttack(cards) {
  const score = scoreCombo(cards);
  return score.valid ? score : null;
}

function scoreComboForTests(cards, options={}) {
  const previousState = state;
  state = {
    enemy: { hp: options.enemyHp ?? 99, weakness: options.weakness ?? null, finalBoss: !!options.finalBoss },
    equipment: {
      weapon: options.weapon || { mode:null, bonus:0, damageBonus:0 },
      item: options.item || { damageBonus:0 }
    }
  };
  try {
    return scoreCombo(cards);
  } finally {
    state = previousState;
  }
}

window.LittleQuestDeckScoring = {
  scoreCombo: scoreComboForTests,
  matchChunkScore,
  isMatchCombo,
  isSequenceCombo,
  isFlushCombo,
  traitInfo
};

function raiseTemper(reason) {
  if (!state.enemy || state.enemy.temper >= maxTemper) return false;
  state.enemy.temper++;
  log(`${state.enemy.name}'s Temper rises to ${state.enemy.temper}/${maxTemper}${reason ? ` after ${reason}` : ''}.`);
  return true;
}

function drawUpTo(limit) {
  let drawn = 0;
  for (let i = 0; i < limit; i++) {
    if (!drawOne()) break;
    drawn++;
  }
  sortHand();
  return drawn;
}

function cleanVictoryBonus(overkill, boss) {
  if (overkill < 0 || overkill > 3) return false;
  state.gold += cleanVictoryGold;
  state.stats.cleanVictories++;
  setReward(`Clean Victory: +${cleanVictoryGold} gold for winning with ${overkill} excess damage.`, true);
  if (boss) {
    const before = state.hp;
    state.hp = Math.min(state.maxHp, state.hp + 1);
    if (state.hp > before) log('Boss Clean Victory heals 1 HP.');
  }
  return true;
}

function enemyAttack(reason='', multiplier=1, extraBlock=0) {
  if (state.gameOver) return;
  const blocked = (state.equipment.armor?.reduction || 0) + extraBlock;
  const attackPower = state.enemy.damage + (state.enemy.temper || 0);
  const rawDamage = Math.floor(attackPower * multiplier);
  const damage = Math.max(0, rawDamage - blocked);
  state.hp -= damage;
  state.stats.damageTaken += damage;
  if (damage > 0) state.playerHit = true;
  const halfText = multiplier < 1 ? ' half-strength' : '';
  log(`${state.enemy.name} hits you for ${damage} HP${halfText}${state.enemy.temper ? ` (Attack ${state.enemy.damage} + Temper ${state.enemy.temper})` : ''}${blocked ? ` (${blocked} blocked by armor)` : ''}${reason ? ` after ${reason}` : ''}.`);
  if (state.hp <= 0) {
    state.hp = 0;
    state.gameOver = true;
    log('<span class="game-over">Run over. The forest keeps your lunch money.</span>');
  }
}

function setReward(text, append=false) {
  state.lastReward = append && state.lastReward ? `${state.lastReward} ${text}` : text;
  log(`<span class="game-over">${text}</span>`);
}

function itemDescription(item) {
  if (!item) return 'empty';
  const bits = [];
  if (item.mode && item.bonus) bits.push(`${modeLabel[item.mode]} +${item.bonus}`);
  if (item.reduction) bits.push(`Block ${item.reduction}`);
  if (item.damageBonus) bits.push(`All attacks +${item.damageBonus}`);
  if (item.hpBonus) bits.push(`Max HP +${item.hpBonus}`);
  if (item.discardBlock) bits.push(`Discard hit block +${item.discardBlock}`);
  if (item.goldBonus) bits.push(`Gold drops +${item.goldBonus}`);
  if (item.healAfterBoss) bits.push(`Heal ${item.healAfterBoss} after bosses`);
  if (item.extraDiscardDraw) bits.push(`Discard replaces +${item.extraDiscardDraw}`);
  return `${item.name}${bits.length ? ` — ${bits.join(', ')}` : ' — no bonus'}`;
}
function itemModalDescription(item) { return `${item.icon || ''} ${itemDescription(item)}`.trim(); }

function makeEquipmentPool(source='monster') {
  const scale = source === 'shop' ? 1 : 0;
  const weaponBonus = 4 + scale;
  const armorBonus = 1 + scale;
  const itemDamage = 3 + scale;
  return [
    { slot:'weapon', icon:'🗡️', name:'Balanced Blade', mode:null, bonus:2 + scale, damageBonus:2 + scale, value:7 },
    { slot:'weapon', icon:'🪓', name:'Match Axe', mode:'match', bonus:weaponBonus, value:7 },
    { slot:'weapon', icon:'🏹', name:'Sequence Bow', mode:'sequence', bonus:weaponBonus, value:7 },
    { slot:'weapon', icon:'🔱', name:'Flush Trident', mode:'flush', bonus:weaponBonus, value:7 },
    { slot:'weapon', icon:'✨', name:'Combo Wand', mode:null, bonus:0, damageBonus:itemDamage, value:9 },
    { slot:'armor', icon:'🛡️', name:'Patchwork Armor', reduction:armorBonus, value:7 },
    { slot:'armor', icon:'🥾', name:'Quick Boots', reduction:armorBonus, discardBlock:1, value:8 },
    { slot:'armor', icon:'🧥', name:'Padded Coat', reduction:armorBonus, hpBonus:2 + scale, value:8 },
    { slot:'armor', icon:'🪶', name:'Feather Cloak', reduction:Math.max(1, armorBonus - 1), discardBlock:1, value:8 },
    { slot:'item', icon:'❤️', name:'Heart Charm', hpBonus:4 + scale, value:8 },
    { slot:'item', icon:'🪓', name:'Sharpening Stone', damageBonus:itemDamage, value:8 },
    { slot:'item', icon:'🧲', name:'Lucky Magnet', goldBonus:1 + scale, value:8 },
    { slot:'item', icon:'🍎', name:'Snack Pouch', healAfterBoss:3 + scale, value:8 },
    { slot:'item', icon:'🃏', name:'Card Sleeve', extraDiscardDraw:1, value:8 }
  ];
}
function equipmentKey(item) { return `${item.slot}:${item.name}:${item.mode || ''}:${item.bonus || 0}:${item.damageBonus || 0}:${item.reduction || 0}:${item.hpBonus || 0}`; }
function isSameEquipment(a,b) { return !!a && !!b && equipmentKey(a) === equipmentKey(b); }
function isBetterThanCurrent(item) {
  const current = state.equipment[item.slot];
  return !isSameEquipment(item, current);
}
function makeRewardItem(source='monster', exclude=[]) {
  const excludeKeys = new Set(exclude.map(equipmentKey));
  let pool = makeEquipmentPool(source).filter(item => isBetterThanCurrent(item) && !excludeKeys.has(equipmentKey(item)));
  if (!pool.length) pool = makeEquipmentPool(source).filter(item => !excludeKeys.has(equipmentKey(item)));
  return sample(pool);
}


function applyEquipmentItem(item) {
  const old = state.equipment[item.slot];
  state.equipment[item.slot] = item;
  const oldHpBonus = old?.hpBonus || 0;
  const newHpBonus = item.hpBonus || 0;
  const delta = newHpBonus - oldHpBonus;
  if (delta) {
    state.maxHp += delta;
    state.hp = Math.max(1, Math.min(state.maxHp, state.hp + Math.max(0, delta)));
  }
  setReward(`Equipped ${itemModalDescription(item)}.`);
}

function addGold(amount, reason, append=false) {
  state.gold += amount;
  setReward(`${reason}: +${amount} gold. You have ${state.gold} gold.`, append);
}

function openRewardChoice(item) {
  state.pendingReward = item;
  const sellValue = item.value || 5;
  const current = state.equipment[item.slot];
  const slotLabel = item.slot[0].toUpperCase() + item.slot.slice(1);
  showModal(`<h2>Found ${slotLabel}</h2><p><strong>New:</strong><br>${itemModalDescription(item)}</p><p><strong>Current ${slotLabel}:</strong><br>${itemModalDescription(current)}</p><div class="modal-actions"><button onclick="equipPendingReward()">Equip new ${slotLabel}</button><button onclick="sellPendingReward()">Sell for ${sellValue} gold</button></div>`);
}


function equipPendingReward() {
  if (!state.pendingReward) return;
  applyEquipmentItem(state.pendingReward);
  state.pendingReward = null;
  hideModal();
  render();
}
function sellPendingReward() {
  if (!state.pendingReward) return;
  const value = state.pendingReward.value || 5;
  const name = state.pendingReward.name;
  state.gold += value;
  setReward(`Sold ${name} for ${value} gold. You have ${state.gold} gold.`);
  state.pendingReward = null;
  hideModal();
  render();
}
function makeShopOffers() {
  const offers = [];
  const used = [];
  for (let i=0; i<2; i++) {
    const item = makeRewardItem('shop', used);
    if (item) { used.push(item); offers.push({ kind:'gear', cost:10 + i * 2, item }); }
  }
  if (state.hp < state.maxHp) offers.push({ kind:'heal', cost:6, label:'Soup and bandages', text:'Heal 6 HP' });
  if (state.handSize < maxHandSize) offers.push({ kind:'hand', cost:14, label:'Bigger Backpack', text:`+1 hand size, max ${maxHandSize}` });
  if (!offers.length) offers.push({ kind:'gold', cost:0, label:'Window shopping', text:'Nothing useful today' });
  return offers;
}

function openShop() {
  state.shopOffers = makeShopOffers();
  const offers = state.shopOffers.map((offer,i)=>{
    const desc = offer.kind === 'gear' ? `${itemModalDescription(offer.item)}<br><small>Current ${offer.item.slot}: ${itemDescription(state.equipment[offer.item.slot])}</small>` : `${offer.label} — ${offer.text}`;
    return `<div class="shop-offer"><strong>${desc}</strong><br><small>${offer.cost} gold</small><button ${offer.kind === 'gold' || state.gold < offer.cost ? 'disabled' : ''} onclick="buyShopOffer(${i})">${offer.kind === 'gold' ? 'Sold out' : 'Buy'}</button></div>`;
  }).join('');
  showModal(`<h2>🛒 Roadside Supply Store</h2><p>The boss drops a purse and a suspiciously well-placed shop appears. Gold: <strong>${state.gold}</strong></p><div class="modal-actions">${offers}<button onclick="leaveShop()">Leave shop</button></div>`);
}
function buyShopOffer(i) {
  const offer = state.shopOffers[i];
  if (!offer || state.gold < offer.cost) return;
  state.gold -= offer.cost;
  if (offer.kind === 'gear') applyEquipmentItem(offer.item);
  if (offer.kind === 'heal') { const before = state.hp; state.hp = Math.min(state.maxHp, state.hp + 6); setReward(`Bought soup and bandages. Healed ${state.hp - before} HP.`); }
  if (offer.kind === 'hand') { if (state.handSize >= maxHandSize) { state.gold += offer.cost; setReward(`Hand size is already maxed at ${maxHandSize}. Refunded ${offer.cost} gold.`); } else { state.handSize++; fillHand(); setReward(`Bought Bigger Backpack. Hand size is now ${state.handSize}/${maxHandSize}.`); } }
  openShop();
  render();
}
function leaveShop() { hideModal(); render(); }
function showVictoryModal() { showModal(`<h2>👑 Forest Crown Won</h2><p>You beat the final boss on encounter ${finalEncounter}. Prize: the Forest Crown, 40 gold, and bragging rights over a browser tab.</p><div class="modal-actions"><button onclick="leaveShop()">Keep playing endless mode</button><button onclick="start()">Start a fresh run</button></div>`); }
function showModal(html) { const m=document.getElementById('modal'); document.getElementById('modalCard').innerHTML=html; m.classList.add('show'); }
function hideModal() { document.getElementById('modal').classList.remove('show'); }


function attack() {
  if (state.gameOver) return;
  const cards = selectedCards();
  if (!cards.length) { log('Choose at least one card first.'); return; }
  const best = bestAttack(cards);
  if (!best) { log('No valid combo in those cards. Try a Match, Sequence, Flush, or stacked combo like Sequence + Flush.'); render(); return; }

  const playedCount = cards.length;
  state.stats.attacks++;
  cards.forEach(c => state.discard.push(c));
  state.hand = state.hand.filter(c => !state.selected.includes(c.id));
  state.selected = [];
  const beforeDraw = state.hand.length;

  const previousHp = state.enemy.hp;
  const attackDamage = best.total;
  state.stats.biggestCombo = Math.max(state.stats.biggestCombo, attackDamage);
  state.enemy.hp = Math.max(0, state.enemy.hp - attackDamage);
  if (attackDamage > 0) state.monsterHit = true;

  if (state.enemy.hp <= 0) {
    const overkill = attackDamage - previousHp;
    log(`Success: ${comboName(best.traits)} deals ${attackDamage} and defeats ${state.enemy.name} (${previousHp}/${state.enemy.maxHp} HP left). Played ${playedCount}.`);
    const defeatedBoss = state.enemy.boss;
    state.lastReward = '';
    cleanVictoryBonus(overkill, defeatedBoss);
    state.defeated++;
    fillHand();
    const drawn = state.hand.length - beforeDraw;
    log(`Victory refill draws ${drawn} card${drawn === 1 ? '' : 's'} for the next encounter.`);
    if (state.defeated === finalEncounter && defeatedBoss) {
      state.finalDefeated = true;
      state.gold += 40;
      setReward('Final boss defeated: you win the Forest Crown and 40 gold.', true);
      advanceEnemy();
      log(`The path opens beyond the forest. A new enemy appears: ${state.enemy.name}.`);
      showVictoryModal();
    } else if (defeatedBoss) {
      addGold(12 + Math.floor(state.defeated / 5) * 3 + (state.equipment.item?.goldBonus || 0), 'Boss purse', true);
      if (state.equipment.item?.healAfterBoss) state.hp = Math.min(state.maxHp, state.hp + state.equipment.item.healAfterBoss);
      advanceEnemy();
      log(`A new enemy appears: ${state.enemy.name}.`);
      openShop();
    } else {
      addGold(2 + Math.floor(random() * 3) + (state.equipment.item?.goldBonus || 0), 'Monster loot', true);
      if (random() < 0.30) { const item = makeRewardItem('monster'); if (item) openRewardChoice(item); }
      advanceEnemy();
      log(`A new enemy appears: ${state.enemy.name}.`);
    }
  } else {
    state.stats.partialAttacks++;
    const drawn = drawUpTo(playedCount);
    log(`Hit: ${comboName(best.traits)} deals ${attackDamage}. ${state.enemy.name} drops from ${previousHp}/${state.enemy.maxHp} to ${state.enemy.hp}/${state.enemy.maxHp} HP. Played ${playedCount}, drew ${drawn}.`);
    raiseTemper('a partial attack');
    enemyAttack('a partial attack');
  }
  render();
}

function discardSelected() {
  if (state.gameOver) return;
  const cards = selectedCards();
  if (!cards.length) { log('Choose cards to discard first.'); return; }
  const count = cards.length;
  state.stats.discards++;
  cards.forEach(c => state.discard.push(c));
  state.hand = state.hand.filter(c => !state.selected.includes(c.id));
  state.selected = [];
  let drawn = 0;
  for (let i = 0; i < count + (state.equipment.item?.extraDiscardDraw || 0); i++) if (drawOne()) drawn++;
  sortHand();
  log(`You discard ${count} card${count > 1 ? 's' : ''} and replace ${drawn}.`);
  raiseTemper('discarding');
  enemyAttack('discarding cards', 0.5, state.equipment.armor?.discardBlock || 0);
  render();
}

function clearSelection() {
  if (state.gameOver || !state.selected.length) return;
  state.selected = [];
  render();
}

function renderEnemy() {
  const blocked = state.equipment.armor?.reduction || 0;
  const temperedAttack = state.enemy.damage + (state.enemy.temper || 0);
  const damage = Math.max(0, temperedAttack - blocked);
  const nextTemper = Math.min(maxTemper, (state.enemy.temper || 0) + 1);
  const nextDamage = Math.max(0, state.enemy.damage + nextTemper - blocked);
  const bossProgress = ((state.defeated % 5) + 1);
  const dots = [1,2,3,4,5].map(i=>`<span class="boss-dot ${i < bossProgress ? 'done' : ''} ${i === 5 ? 'boss' : ''}"></span>`).join('');
  const finalProgress = state.finalDefeated ? 100 : Math.min(100, Math.round(((state.defeated + 1) / finalEncounter) * 100));
  const pastFinal = Math.max(0, state.defeated - finalEncounter);
  const toFinal = state.finalDefeated ? `Forest Crown won — endless mode. Past final boss: ${pastFinal} turn${pastFinal === 1 ? '' : 's'}.` : `${Math.max(0, finalEncounter - state.defeated)} encounter${finalEncounter - state.defeated === 1 ? '' : 's'} to final boss.`;
  document.getElementById('enemy').innerHTML = `<div class="name">${state.enemy.finalBoss ? '👑🔥 ' : state.enemy.boss ? '👑 ' : ''}${state.enemy.name}</div><div class="line">Monster HP: <strong>${state.enemy.hp}/${state.enemy.maxHp}</strong></div><div class="line">Weakness: <strong>${weaknessLabel[state.enemy.weakness]}</strong> trait scores ×1.5.</div><div class="temper-row"><span>Temper</span><strong>${state.enemy.temper || 0}/${maxTemper}</strong><div class="temper-pips">${[1,2,3].map(i=>`<span class="temper-pip ${i <= (state.enemy.temper || 0) ? 'hot' : ''}"></span>`).join('')}</div></div><div class="line">Attack: <strong>${damage} HP</strong>${state.enemy.temper ? ` (base ${state.enemy.damage} + Temper ${state.enemy.temper})` : ''}${blocked ? ` after armor blocks ${blocked}` : ''}.</div><div class="line">Next non-lethal action raises Temper first, then this monster hits for <strong>${nextDamage} HP</strong>${blocked ? ' after armor' : ''}.</div><div class="line">${state.enemy.finalBoss ? 'Final boss: combos score as one card smaller. Win the run on defeat.' : state.enemy.boss ? 'Boss fight: shop after defeat.' : `${5 - (state.defeated % 5)} encounter${5 - (state.defeated % 5) === 1 ? '' : 's'} to next boss.`}</div><div class="boss-track" title="Boss every 5 encounters">${dots}</div><div class="final-track"><div class="line">${toFinal}</div><div class="final-bar"><div class="final-fill" style="width:${finalProgress}%"></div></div></div>`;
}
function renderHand() {
  const el=document.getElementById('hand');
  el.innerHTML='';
  state.hand.forEach(c=>{
    const d=document.createElement('div');
    d.className=`card ${c.color}${state.selected.includes(c.id)?' selected':''}`;
    d.onclick=()=>{ if(state.gameOver) return; state.selected=state.selected.includes(c.id)?state.selected.filter(id=>id!==c.id):[...state.selected,c.id]; render(); };
    d.innerHTML=`<div class="num">${c.n}</div><div></div>`;
    el.appendChild(d);
  });
}
function renderPreview() {
  const cards=selectedCards(), el=document.getElementById('scorePreview');
  if(!cards.length){ el.innerHTML='Select cards. Attack will automatically score the best valid combo.'; return; }
  const best = bestAttack(cards);
  if (!best) { el.innerHTML=`<div class="score-big"><span class="score-number">${cards.length}</span><strong>selected card${cards.length>1?'s':''}</strong></div><div>No valid combo yet.</div>`; return; }
  const leaves = Math.max(0, state.enemy.hp - best.total);
  const lethal = best.total >= state.enemy.hp;
  const kept = state.hand.length - cards.length;
  const drawn = lethal ? Math.max(0,effectiveHandSize()-kept) : cards.length;
  const nextTemper = Math.min(maxTemper,(state.enemy.temper||0)+1);
  const retaliation = Math.max(0,state.enemy.damage+nextTemper-(state.equipment.armor?.reduction||0));
  const clean = lethal && best.margin >= 0 && best.margin <= 3;
  const verdict = `${comboName(best.traits)}: <strong>${best.total}</strong> vs ${state.enemy.hp}/${state.enemy.maxHp} HP — ${best.margin >= 0 ? `defeats by ${best.margin}` : `leaves ${leaves} HP`}.`;
  el.innerHTML=`<div class="score-big"><span class="score-number">${best.total}</span><strong>${comboName(best.traits)}</strong></div><div>${verdict}</div><div class="forecast"><div class="forecast-item"><span>Cards after attack</span><strong>${kept} kept, ${drawn} drawn</strong></div><div class="forecast-item"><span>Enemy response</span><strong>${lethal?'Defeated':`${retaliation} damage at Temper ${nextTemper}`}</strong></div></div>${clean?`<div class="clean-forecast">Clean Victory: +${cleanVictoryGold} gold${state.enemy.boss?' and heal 1 HP':''}</div>`:''}<div style="margin-top:8px;"><small>${best.formula}</small></div>`;
}

function copySeed() {
  const url=location.href;
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(()=>{ log('Seed link copied.'); render(); });
  else prompt('Copy this seeded run link:',url);
}
function renderRunSummary(){
  const s=state.stats;
  document.getElementById('runSummary').innerHTML=`<div class="summary-stat"><strong>${state.defeated}</strong>defeated</div><div class="summary-stat"><strong>${state.hp}/${state.maxHp}</strong>HP left</div><div class="summary-stat"><strong>${s.attacks}</strong>attacks (${s.partialAttacks} partial)</div><div class="summary-stat"><strong>${s.discards}</strong>discards</div><div class="summary-stat"><strong>${s.cleanVictories}</strong>Clean Victories</div><div class="summary-stat"><strong>${s.biggestCombo}</strong>biggest combo</div><div class="summary-stat"><strong>${s.damageTaken}</strong>damage taken</div><div class="summary-stat"><strong>${state.gold}</strong>gold</div><div class="summary-stat summary-seed"><div>Seed <code>${state.seed}</code></div><button onclick="copySeed()">Copy Link</button></div>`;
}

function renderLog(){ document.getElementById('log').innerHTML=state.log.join(''); }
function countCards(cards, keyFn){ return cards.reduce((acc,c)=>{ const k=keyFn(c); acc[k]=(acc[k]||0)+1; return acc; },{}); }
function pills(counts, order){ return order.map(k=>`<span class="deck-pill">${k}: <strong>${counts[k]||0}</strong></span>`).join(''); }
function renderEquipment(){
  document.getElementById('equipment').innerHTML = `<div class="slot"><span class="icon">🗡️</span><strong>Weapon:</strong> ${itemDescription(state.equipment.weapon)}</div><div class="slot"><span class="icon">🛡️</span><strong>Armor:</strong> ${itemDescription(state.equipment.armor)}</div><div class="slot"><span class="icon">🎒</span><strong>Item:</strong> ${itemDescription(state.equipment.item)}</div><div class="slot"><span class="icon">🪙</span><strong>Gold:</strong> ${state.gold}</div>`;
  document.getElementById('rewardBanner').textContent = state.lastReward;
}
function renderDeckList(){
  const all=[...state.deck,...state.hand,...state.discard];
  const colorCounts=countCards(all,c=>c.color);
  const numberCounts=countCards(all,c=>c.n);
  document.getElementById('deckList').innerHTML=`<div class="deck-group"><h3>Colours</h3><div class="deck-counts">${pills(colorCounts,colors)}</div></div><div class="deck-group"><h3>Numbers</h3><div class="deck-counts">${pills(numberCounts,[1,2,3,4,5,6,7,8])}</div></div>`;
}
function pulseElement(id, cls) {
  const el = document.getElementById(id);
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(()=>el.classList.remove(cls), 950);
}
function render(){
  document.getElementById('hp').textContent=`${state.hp}/${state.maxHp}`;
  document.getElementById('playerHpValue').textContent=`${state.hp}/${state.maxHp}`;
  document.getElementById('monsterHpValue').textContent=`${state.enemy.hp}/${state.enemy.maxHp}`;
  document.getElementById('playerHp').classList.toggle('low', state.hp <= Math.ceil(state.maxHp / 3));
  document.getElementById('monsterHp').classList.toggle('low', state.enemy.hp <= Math.ceil(state.enemy.maxHp / 3));
  document.getElementById('encounter').textContent=`${state.defeated + 1}`;
  document.getElementById('handCount').textContent=`${state.hand.length}/${effectiveHandSize()}`;
  document.getElementById('deckCount').textContent=state.deck.length;
  document.getElementById('discardCount').textContent=state.discard.length;
  document.getElementById('goldCount').textContent=state.gold;
  renderEnemy(); renderHand(); renderPreview(); renderLog(); renderEquipment(); renderDeckList(); renderRunSummary();
  if (state.playerHit) { pulseElement('playerHp', 'hp-hit'); state.playerHit = false; }
  if (state.monsterHit) { pulseElement('monsterHp', 'hp-shake'); state.monsterHit = false; }
  const attackBtn = document.getElementById('attackBtn');
  const best = bestAttack(selectedCards());
  const weaknessHot = !!best && best.traits.includes(state.enemy.weakness) && !state.gameOver;
  attackBtn.innerHTML = `${weaknessHot ? '🔥 ' : ''}Attack${weaknessHot ? ' 🔥' : ''}<small>auto-best combo</small>`;
  attackBtn.disabled = state.gameOver;
  attackBtn.classList.toggle('attack-ready', !!best && best.total >= state.enemy.hp && !state.gameOver);
  attackBtn.classList.toggle('attack-short', !!best && best.total < state.enemy.hp && !state.gameOver);
  document.getElementById('discardBtn').disabled=state.gameOver;
  document.getElementById('clearSelectionBtn').disabled=state.gameOver || !state.selected.length;
}

document.getElementById('attackBtn').onclick=attack;
document.getElementById('discardBtn').onclick=discardSelected;
document.getElementById('clearSelectionBtn').onclick=clearSelection;
document.getElementById('sortNumberBtn').onclick=()=>setSortMode('number');
document.getElementById('sortColorBtn').onclick=()=>setSortMode('color');
document.getElementById('restartBtn').onclick=()=>start(state.seed);
document.getElementById('newSeedBtn').onclick=()=>start(makeSeed());
start(seedFromUrl());
