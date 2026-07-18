(function () {
  'use strict';

  const Rules = window.LittleQuestDeckRules;
  const { config } = Rules;
  const enemyNames = ['Moss Imp', 'Tin Goblin', 'Lantern Bat', 'Root Troll', 'Moon Fox', 'Bog Wyrm', 'Clockwork Crab', 'Ash Sprite', 'Cave Beetle', 'Glass Ogre'];
  const bossNames = ['The Sleepy Dragon', 'Queen Briarback', 'The Three-Eyed Toad'];
  const finalBossName = 'The Crown-Eating Dragon';

  function hashSeed(seed) {
    let hash = 2166136261;
    for (const character of seed) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let value = hashSeed(seed);
    return () => {
      value |= 0;
      value = value + 0x6D2B79F5 | 0;
      let mixed = Math.imul(value ^ value >>> 15, 1 | value);
      mixed = mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed) ^ mixed;
      return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
    };
  }

  function makeSeed() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function sanitizeSeed(seed) {
    return String(seed || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24) || makeSeed();
  }

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  }

  function createGame(inputSeed, options = {}) {
    const seed = sanitizeSeed(inputSeed);
    const random = options.random || seededRandom(seed);

    function shuffle(cards) {
      for (let index = cards.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(random() * (index + 1));
        [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
      }
      return cards;
    }

    function sample(values) {
      return values[Math.floor(random() * values.length)];
    }

    function makeCard(n, color) {
      return { n, color, id: uid() };
    }

    function makeDeck() {
      const deck = [];
      for (let number = 1; number <= 8; number++) {
        config.colors.forEach(color => deck.push(makeCard(number, color)));
      }
      return shuffle(deck);
    }

    const state = {
      hp: 16,
      maxHp: 16,
      defeated: 0,
      finalDefeated: false,
      finalBossCrownReduction: 0,
      deck: makeDeck(),
      discard: [],
      hand: [],
      handSize: config.startHandSize,
      sortMode: 'number',
      gold: 0,
      pendingReward: null,
      shopOffers: [],
      playerHit: false,
      monsterHit: false,
      equipment: {
        weapon: { slot: 'weapon', icon: '🗡️', name: 'Training Sword', mode: null, bonus: 0, value: 0 },
        armor: { slot: 'armor', icon: '🛡️', name: 'Cloth Armor', reduction: 0, value: 0 },
        item: { slot: 'item', icon: '🪨', name: 'Lucky Pebble', damageBonus: 0, hpBonus: 0, value: 0 }
      },
      lastReward: 'No rewards yet.',
      selected: [],
      enemy: null,
      log: [],
      gameOver: false,
      seed,
      stats: { attacks: 0, partialAttacks: 0, discards: 0, cleanVictories: 0, biggestCombo: 0, damageTaken: 0 }
    };

    function log(message) {
      state.log.unshift(`<p>${message}</p>`);
    }

    function newEnemy() {
      const level = state.defeated + 1;
      const finalBoss = !state.finalDefeated && level === config.finalEncounter;
      const boss = finalBoss || (level < config.finalEncounter && level % 5 === 0) || (state.finalDefeated && level % 5 === 0);
      const weakness = sample(config.weaknessTypes);
      const crownCrackReduction = finalBoss ? Rules.crownCrackReduction(state.stats.cleanVictories) : 0;
      const hp = finalBoss
        ? config.finalBossBaseHp - crownCrackReduction
        : boss
          ? 24 + Math.floor(level * 2.5)
          : 6 + Math.floor(level * 2) + Math.floor(random() * 3);
      return {
        name: finalBoss ? finalBossName : boss ? sample(bossNames) : sample(enemyNames),
        boss,
        finalBoss,
        weakness,
        hp,
        maxHp: hp,
        crownCrackReduction,
        damage: finalBoss ? 7 : boss ? 3 + Math.floor(level / 5) : 1 + Math.floor(level / 5),
        temper: 0,
        freeDiscardUsed: false
      };
    }

    function sortHand() {
      if (state.sortMode === 'color') {
        state.hand.sort((a, b) => config.colors.indexOf(a.color) - config.colors.indexOf(b.color) || a.n - b.n);
      } else {
        state.hand.sort((a, b) => a.n - b.n || config.colors.indexOf(a.color) - config.colors.indexOf(b.color));
      }
    }

    function drawOne(announce = true) {
      if (!state.deck.length) {
        state.deck = shuffle(state.discard);
        state.discard = [];
        if (state.deck.length && announce) log('The discard pile is shuffled back into the deck.');
      }
      if (!state.deck.length) return false;
      state.hand.push(state.deck.pop());
      return true;
    }

    function drawUpTo(limit) {
      let drawn = 0;
      for (let index = 0; index < limit; index++) {
        if (!drawOne()) break;
        drawn++;
      }
      sortHand();
      return drawn;
    }

    function fillHand() {
      while (state.hand.length < state.handSize) {
        if (!drawOne()) break;
      }
      sortHand();
    }

    function applyHandLimit() {
      let removed = 0;
      while (state.hand.length > state.handSize) {
        state.discard.push(state.hand.pop());
        removed++;
      }
      if (removed) {
        state.selected = [];
        log(`${state.enemy.name}'s curse shrinks your hand by ${removed}.`);
      }
    }

    function advanceEnemy() {
      state.enemy = newEnemy();
      if (state.enemy.finalBoss) {
        state.finalBossCrownReduction = state.enemy.crownCrackReduction;
        if (state.enemy.crownCrackReduction > 0) {
          log(`Crown Cracks: ${state.stats.cleanVictories} Clean Victories remove ${state.enemy.crownCrackReduction} HP from the final boss (${config.finalBossBaseHp} → ${state.enemy.maxHp}).`);
        }
      }
      applyHandLimit();
      fillHand();
    }

    function selectedCards() {
      return state.hand.filter(card => state.selected.includes(card.id));
    }

    function scoreCards(cards) {
      return Rules.scoreCombo(cards, {
        enemyHp: state.enemy.hp,
        weakness: state.enemy.weakness,
        finalBoss: state.enemy.finalBoss,
        weapon: state.equipment.weapon,
        item: state.equipment.item
      });
    }

    function bestAttack(cards = selectedCards()) {
      const score = scoreCards(cards);
      return score.valid ? score : null;
    }

    function setReward(text, append = false) {
      state.lastReward = append && state.lastReward ? `${state.lastReward} ${text}` : text;
      log(`<span class="game-over">${text}</span>`);
    }

    function addGold(amount, reason, append = false) {
      state.gold += amount;
      setReward(`${reason}: +${amount} gold. You have ${state.gold} gold.`, append);
    }

    function raiseTemper(reason) {
      if (!state.enemy || state.enemy.temper >= config.maxTemper) return false;
      state.enemy.temper++;
      log(`${state.enemy.name}'s Temper rises to ${state.enemy.temper}/${config.maxTemper}${reason ? ` after ${reason}` : ''}.`);
      return true;
    }

    function enemyAttack(reason = '', multiplier = 1, extraBlock = 0) {
      if (state.gameOver) return { damage: 0, dead: true, modal: 'defeat' };
      const blocked = (state.equipment.armor.reduction || 0) + extraBlock;
      const attackPower = state.enemy.damage + (state.enemy.temper || 0);
      const rawDamage = Math.floor(attackPower * multiplier);
      const damage = Math.max(0, rawDamage - blocked);
      state.hp -= damage;
      state.stats.damageTaken += damage;
      if (damage > 0) state.playerHit = true;
      const halfText = multiplier < 1 ? ' half-strength' : '';
      log(`${state.enemy.name} hits you for ${damage} HP${halfText}${state.enemy.temper ? ` (Attack ${state.enemy.damage} + Temper ${state.enemy.temper})` : ''}${blocked ? ` (${blocked} blocked by armor)` : ''}${reason ? ` after ${reason}` : ''}.`);
      if (state.hp > 0) return { damage, dead: false, modal: null };
      state.hp = 0;
      state.gameOver = true;
      log('<span class="game-over">Run over. The forest keeps your lunch money.</span>');
      return { damage, dead: true, modal: 'defeat' };
    }

    function cleanVictoryBonus(overkill, boss, finalBoss = false) {
      if (overkill < 0 || overkill > 3) return false;
      const crownBefore = Rules.crownCrackReduction(state.stats.cleanVictories);
      state.gold += config.cleanVictoryGold;
      state.stats.cleanVictories++;
      const crownAfter = Rules.crownCrackReduction(state.stats.cleanVictories);
      const crownAdded = !state.finalDefeated && !finalBoss ? crownAfter - crownBefore : 0;
      const crownText = crownAdded > 0 ? ` Crown Cracks remove another ${crownAdded} HP from the final boss.` : '';
      setReward(`Clean Victory: +${config.cleanVictoryGold} gold for winning with ${overkill} excess damage.${crownText}`, true);
      if (boss) {
        const before = state.hp;
        state.hp = Math.min(state.maxHp, state.hp + 1);
        if (state.hp > before) log('Boss Clean Victory heals 1 HP.');
      }
      return true;
    }

    function makeEquipmentPool(source = 'monster') {
      const scale = source === 'shop' ? 1 : 0;
      const weaponBonus = 4 + scale;
      const armorBonus = 1 + scale;
      const itemDamage = 3 + scale;
      return [
        { slot: 'weapon', icon: '🗡️', name: 'Balanced Blade', mode: null, bonus: 2 + scale, damageBonus: 2 + scale, value: 7 },
        { slot: 'weapon', icon: '🪓', name: 'Match Axe', mode: 'match', bonus: weaponBonus, value: 7 },
        { slot: 'weapon', icon: '🏹', name: 'Sequence Bow', mode: 'sequence', bonus: weaponBonus, value: 7 },
        { slot: 'weapon', icon: '🔱', name: 'Flush Trident', mode: 'flush', bonus: weaponBonus, value: 7 },
        { slot: 'weapon', icon: '✨', name: 'Combo Wand', mode: null, bonus: 0, damageBonus: itemDamage, value: 9 },
        { slot: 'armor', icon: '🛡️', name: 'Patchwork Armor', reduction: armorBonus, value: 7 },
        { slot: 'armor', icon: '🥾', name: 'Quick Boots', reduction: armorBonus, discardBlock: 1, value: 8 },
        { slot: 'armor', icon: '🧥', name: 'Padded Coat', reduction: armorBonus, hpBonus: 2 + scale, value: 8 },
        { slot: 'armor', icon: '🪶', name: 'Feather Cloak', reduction: Math.max(1, armorBonus - 1), discardBlock: 1, value: 8 },
        { slot: 'item', icon: '❤️', name: 'Heart Charm', hpBonus: 4 + scale, value: 8 },
        { slot: 'item', icon: '🪓', name: 'Sharpening Stone', damageBonus: itemDamage, value: 8 },
        { slot: 'item', icon: '🧲', name: 'Lucky Magnet', goldBonus: 1 + scale, value: 8 },
        { slot: 'item', icon: '🍎', name: 'Snack Pouch', healAfterBoss: 3 + scale, value: 8 },
        { slot: 'item', icon: '🃏', name: 'Card Sleeve', extraDiscardDraw: 1, value: 8 }
      ];
    }

    function equipmentKey(item) {
      return `${item.slot}:${item.name}:${item.mode || ''}:${item.bonus || 0}:${item.damageBonus || 0}:${item.reduction || 0}:${item.hpBonus || 0}`;
    }

    function makeRewardItem(source = 'monster', exclude = []) {
      const excluded = new Set(exclude.map(equipmentKey));
      const different = item => !state.equipment[item.slot] || equipmentKey(item) !== equipmentKey(state.equipment[item.slot]);
      let pool = makeEquipmentPool(source).filter(item => different(item) && !excluded.has(equipmentKey(item)));
      if (!pool.length) pool = makeEquipmentPool(source).filter(item => !excluded.has(equipmentKey(item)));
      return sample(pool);
    }

    function applyEquipmentItem(item) {
      const old = state.equipment[item.slot];
      state.equipment[item.slot] = item;
      const delta = (item.hpBonus || 0) - (old.hpBonus || 0);
      if (delta) {
        state.maxHp += delta;
        state.hp = Math.max(1, Math.min(state.maxHp, state.hp + Math.max(0, delta)));
      }
      setReward(`Equipped ${itemDescription(item)}.`);
    }

    function itemDescription(item, includeIcon = true) {
      if (!item) return 'empty';
      const bits = [];
      if (item.mode && item.bonus) bits.push(`${config.weaknessLabel[item.mode]} +${item.bonus}`);
      if (item.reduction) bits.push(`Block ${item.reduction}`);
      if (item.damageBonus) bits.push(`All attacks +${item.damageBonus}`);
      if (item.hpBonus) bits.push(`Max HP +${item.hpBonus}`);
      if (item.discardBlock) bits.push(`Discard hit block +${item.discardBlock}`);
      if (item.goldBonus) bits.push(`Gold drops +${item.goldBonus}`);
      if (item.healAfterBoss) bits.push(`Heal ${item.healAfterBoss} after bosses`);
      if (item.extraDiscardDraw) bits.push(`Discard replaces +${item.extraDiscardDraw}`);
      const description = `${item.name}${bits.length ? ` — ${bits.join(', ')}` : ' — no bonus'}`;
      return includeIcon ? `${item.icon || ''} ${description}`.trim() : description;
    }

    function makeShopOffers() {
      const offers = [];
      const used = [];
      for (let index = 0; index < 2; index++) {
        const item = makeRewardItem('shop', used);
        if (item) {
          used.push(item);
          offers.push({ kind: 'gear', cost: 10 + index * 2, item });
        }
      }
      if (state.hp < state.maxHp) offers.push({ kind: 'heal', cost: 6, label: 'Soup and bandages', text: 'Heal 6 HP' });
      if (state.handSize < config.maxHandSize) offers.push({ kind: 'hand', cost: 14, label: 'Bigger Backpack', text: `+1 hand size, max ${config.maxHandSize}` });
      if (!offers.length) offers.push({ kind: 'gold', cost: 0, label: 'Window shopping', text: 'Nothing useful today' });
      state.shopOffers = offers;
      return offers;
    }

    function attack() {
      if (state.gameOver) return { ok: false };
      const cards = selectedCards();
      if (!cards.length) {
        log('Choose at least one card first.');
        return { ok: false };
      }
      const best = bestAttack(cards);
      if (!best) {
        log('No valid combo in those cards. Try a Match, Sequence, Flush, or stacked combo like Sequence + Flush.');
        return { ok: false };
      }

      const playedCount = cards.length;
      state.stats.attacks++;
      cards.forEach(card => state.discard.push(card));
      state.hand = state.hand.filter(card => !state.selected.includes(card.id));
      state.selected = [];
      const beforeDraw = state.hand.length;
      const previousHp = state.enemy.hp;
      const attackDamage = best.total;
      state.stats.biggestCombo = Math.max(state.stats.biggestCombo, attackDamage);
      state.enemy.hp = Math.max(0, state.enemy.hp - attackDamage);
      if (attackDamage > 0) state.monsterHit = true;

      if (state.enemy.hp > 0) {
        state.stats.partialAttacks++;
        const drawn = drawUpTo(playedCount);
        log(`Hit: ${Rules.comboName(best.traits)} deals ${attackDamage}. ${state.enemy.name} drops from ${previousHp}/${state.enemy.maxHp} to ${state.enemy.hp}/${state.enemy.maxHp} HP. Played ${playedCount}, drew ${drawn}.`);
        raiseTemper('a partial attack');
        const retaliation = enemyAttack('a partial attack');
        return { ok: true, lethal: false, modal: retaliation.modal, drawn, best };
      }

      const overkill = attackDamage - previousHp;
      log(`Success: ${Rules.comboName(best.traits)} deals ${attackDamage} and defeats ${state.enemy.name} (${previousHp}/${state.enemy.maxHp} HP left). Played ${playedCount}.`);
      const defeatedBoss = state.enemy.boss;
      state.lastReward = '';
      cleanVictoryBonus(overkill, defeatedBoss, state.enemy.finalBoss);
      state.defeated++;
      fillHand();
      const drawn = state.hand.length - beforeDraw;
      log(`Victory refill draws ${drawn} card${drawn === 1 ? '' : 's'} for the next encounter.`);

      let modal = null;
      if (state.defeated === config.finalEncounter && defeatedBoss) {
        state.finalDefeated = true;
        state.gold += 40;
        setReward('Final boss defeated: you win the Forest Crown and 40 gold.', true);
        advanceEnemy();
        log(`The path opens beyond the forest. A new enemy appears: ${state.enemy.name}.`);
        modal = 'victory';
      } else if (defeatedBoss) {
        addGold(12 + Math.floor(state.defeated / 5) * 3 + (state.equipment.item.goldBonus || 0), 'Boss purse', true);
        if (state.equipment.item.healAfterBoss) state.hp = Math.min(state.maxHp, state.hp + state.equipment.item.healAfterBoss);
        advanceEnemy();
        log(`A new enemy appears: ${state.enemy.name}.`);
        makeShopOffers();
        modal = 'shop';
      } else {
        addGold(2 + Math.floor(random() * 3) + (state.equipment.item.goldBonus || 0), 'Monster loot', true);
        if (random() < config.monsterEquipmentDropChance) {
          const item = makeRewardItem('monster');
          if (item) {
            state.pendingReward = item;
            modal = 'reward';
          }
        }
        advanceEnemy();
        log(`A new enemy appears: ${state.enemy.name}.`);
      }
      return { ok: true, lethal: true, modal, drawn, best };
    }

    function discardSelected() {
      if (state.gameOver) return { ok: false };
      const cards = selectedCards();
      if (!cards.length) {
        log('Choose cards to discard first.');
        return { ok: false };
      }
      const count = cards.length;
      state.stats.discards++;
      cards.forEach(card => state.discard.push(card));
      state.hand = state.hand.filter(card => !state.selected.includes(card.id));
      state.selected = [];
      const drawn = drawUpTo(count + (state.equipment.item.extraDiscardDraw || 0));
      const freeRegroup = !state.enemy.freeDiscardUsed;
      state.enemy.freeDiscardUsed = true;
      log(`You discard ${count} card${count > 1 ? 's' : ''} and replace ${drawn}.${freeRegroup ? ' First regroup: no Temper gained.' : ''}`);
      if (!freeRegroup) raiseTemper('discarding again');
      const retaliation = enemyAttack('discarding cards', 0.5, state.equipment.armor.discardBlock || 0);
      return { ok: true, freeRegroup, drawn, modal: retaliation.modal };
    }

    function equipPendingReward() {
      if (!state.pendingReward) return false;
      applyEquipmentItem(state.pendingReward);
      state.pendingReward = null;
      return true;
    }

    function sellPendingReward() {
      if (!state.pendingReward) return false;
      const value = state.pendingReward.value || 5;
      const name = state.pendingReward.name;
      state.gold += value;
      setReward(`Sold ${name} for ${value} gold. You have ${state.gold} gold.`);
      state.pendingReward = null;
      return true;
    }

    function buyShopOffer(index) {
      const offer = state.shopOffers[index];
      if (!offer || state.gold < offer.cost) return false;
      state.gold -= offer.cost;
      if (offer.kind === 'gear') applyEquipmentItem(offer.item);
      if (offer.kind === 'heal') {
        const before = state.hp;
        state.hp = Math.min(state.maxHp, state.hp + 6);
        setReward(`Bought soup and bandages. Healed ${state.hp - before} HP.`);
      }
      if (offer.kind === 'hand') {
        if (state.handSize >= config.maxHandSize) {
          state.gold += offer.cost;
          setReward(`Hand size is already maxed at ${config.maxHandSize}. Refunded ${offer.cost} gold.`);
        } else {
          state.handSize++;
          fillHand();
          setReward(`Bought Bigger Backpack. Hand size is now ${state.handSize}/${config.maxHandSize}.`);
        }
      }
      makeShopOffers();
      return true;
    }

    function setSortMode(mode) {
      state.sortMode = mode;
      sortHand();
    }

    function clearSelection() {
      if (state.gameOver || !state.selected.length) return false;
      state.selected = [];
      return true;
    }

    function toggleCard(cardId) {
      if (state.gameOver) return false;
      state.selected = state.selected.includes(cardId)
        ? state.selected.filter(id => id !== cardId)
        : [...state.selected, cardId];
      return true;
    }

    advanceEnemy();
    log('Back to basics: one enemy, one hand, one decision loop.');

    return {
      state,
      attack,
      discardSelected,
      clearSelection,
      toggleCard,
      setSortMode,
      selectedCards,
      bestAttack,
      scoreCards,
      equipPendingReward,
      sellPendingReward,
      buyShopOffer,
      makeShopOffers,
      itemDescription
    };
  }

  window.LittleQuestDeckState = Object.freeze({ createGame, hashSeed, seededRandom, sanitizeSeed, makeSeed });
})();
