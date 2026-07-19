(function () {
  'use strict';

  const Rules = window.LittleQuestDeckRules;
  const State = window.LittleQuestDeckState;
  const { config } = Rules;
  let game;

  function seedFromUrl() {
    return new URLSearchParams(location.search).get('seed') || State.makeSeed();
  }

  function setSeedUrl(seed) {
    const url = new URL(location.href);
    url.searchParams.set('seed', seed);
    history.replaceState(null, '', url);
  }

  function start(seed = seedFromUrl()) {
    game = State.createGame(seed);
    setSeedUrl(game.state.seed);
    document.title = `Little Quest Deck ${config.buildVersion}`;
    document.getElementById('buildLabel').textContent = config.buildVersion;
    document.getElementById('buildStat').textContent = config.buildVersion;
    hideModal();
    render();
  }

  function showModal(html) {
    document.getElementById('modalCard').innerHTML = html;
    document.getElementById('modal').classList.add('show');
  }

  function hideModal() {
    document.getElementById('modal').classList.remove('show');
  }

  function slotLabel(slot) {
    return slot[0].toUpperCase() + slot.slice(1);
  }

  function gearCard(item, eyebrow = '') {
    const stats = game.itemStats(item);
    const statHtml = stats.length
      ? stats.map(stat => `<span class="gear-stat">${stat.label} <strong>+${stat.value}</strong></span>`).join('')
      : '<span class="gear-stat muted">No bonus</span>';
    return `<div class="gear-card"><div class="gear-icon" aria-hidden="true">${item.icon || '🎒'}</div><div class="gear-copy">${eyebrow ? `<div class="gear-eyebrow">${eyebrow}</div>` : ''}<div class="gear-name">${item.name}</div><div class="gear-stats">${statHtml}</div></div></div>`;
  }

  function comparisonHtml(candidate, current) {
    const comparison = game.compareEquipment(candidate, current);
    const changes = comparison.changes.length
      ? comparison.changes.map(change => `<div class="comparison-change ${change.delta > 0 ? 'gain' : 'loss'}"><span>${change.label}</span><strong>${change.before} → ${change.after}</strong></div>`).join('')
      : '<div class="comparison-change"><span>Effects</span><strong>unchanged</strong></div>';
    return `<div class="gear-comparison ${comparison.verdict}"><div class="comparison-badge">${comparison.label}</div>${changes}</div>`;
  }

  function specialOfferCard(offer) {
    const standout = offer.kind === 'hand' ? ' backpack-offer' : '';
    return `<div class="shop-special${standout}"><div class="gear-icon" aria-hidden="true">${offer.icon || '🎁'}</div><div><div class="gear-eyebrow">${offer.kind === 'hand' ? 'Permanent upgrade' : 'Supply'}</div><div class="gear-name">${offer.label}</div><div class="special-effect">${offer.text}</div>${offer.detail ? `<div class="special-detail">${offer.detail}</div>` : ''}</div></div>`;
  }

  function openRewardChoice() {
    const { state } = game;
    const item = state.pendingReward;
    if (!item) return;
    const sellValue = item.value || 5;
    const current = state.equipment[item.slot];
    const label = slotLabel(item.slot);
    showModal(`<h2>Found ${label}</h2><div class="gear-compare-grid">${gearCard(current, `Current ${label}`)}${gearCard(item, `New ${label}`)}</div>${comparisonHtml(item, current)}<div class="modal-actions"><button onclick="equipPendingReward()">Equip new ${label}</button><button onclick="sellPendingReward()">Sell for ${sellValue} gold</button></div>`);
  }

  function equipPendingReward() {
    if (!game.equipPendingReward()) return;
    hideModal();
    render();
  }

  function sellPendingReward() {
    if (!game.sellPendingReward()) return;
    hideModal();
    render();
  }

  function openShop() {
    const { state } = game;
    const offers = state.shopOffers.map((offer, index) => {
      const disabled = offer.sold || offer.kind === 'gold' || state.gold < offer.cost ? 'disabled' : '';
      const content = offer.kind === 'gear'
        ? `${gearCard(offer.item, `New ${slotLabel(offer.item.slot)}`)}${comparisonHtml(offer.item, state.equipment[offer.item.slot])}`
        : specialOfferCard(offer);
      const buttonText = offer.sold ? 'Sold' : `Buy · ${offer.cost} gold`;
      return `<div class="shop-offer${offer.sold ? ' sold' : ''}">${content}<button ${disabled} onclick="buyShopOffer(${index})">${buttonText}</button></div>`;
    }).join('');
    const rerollDisabled = state.gold < state.shopRerollCost ? 'disabled' : '';
    showModal(`<h2>🛒 Roadside Supply Store</h2><div class="shop-wallet"><span>🪙 Your gold</span><strong>${state.gold}</strong></div><p>Buy what you want; purchased cards stay sold. Only a paid reroll changes the shelf.</p><div class="modal-actions">${offers}<button class="reroll-btn" ${rerollDisabled} onclick="rerollShop()">🔄 Reroll stock · ${state.shopRerollCost} gold<small>Next reroll costs ${state.shopRerollCost + config.shopRerollCostStep}</small></button><button onclick="leaveShop()">Leave shop with ${state.gold} gold</button></div>`);
  }

  function buyShopOffer(index) {
    if (!game.buyShopOffer(index)) return;
    openShop();
    render();
  }

  function rerollShop() {
    if (!game.rerollShop()) return;
    openShop();
    render();
  }

  function leaveShop() {
    hideModal();
    render();
  }

  function showVictoryModal() {
    const cracked = game.state.finalBossCrownReduction;
    const crackText = cracked > 0 ? ` Your Clean Victories cracked ${cracked} HP from its crown before the fight.` : '';
    showModal(`<h2>👑 Forest Crown Won</h2><p>You beat the final boss on encounter ${config.finalEncounter}.${crackText} Prize: the Forest Crown, 40 gold, and bragging rights over a browser tab.</p><div class="modal-actions"><button onclick="leaveShop()">Keep playing endless mode</button><button onclick="start()">Start a fresh run</button></div>`);
  }

  function showDefeatModal() {
    const { state } = game;
    const stats = state.stats;
    showModal(`<h2>💀 Run Over</h2><p><strong>${state.enemy.name}</strong> knocked you out on encounter ${state.defeated + 1}.</p><p>You defeated ${state.defeated} enemies, made ${stats.cleanVictories} Clean Victories, and dealt a best attack of ${stats.biggestCombo}.</p><div class="modal-actions"><button onclick="start('${state.seed}')">Retry Same Seed</button><button onclick="start(makeSeed())">Start New Seed</button></div>`);
  }

  function handleModal(modal) {
    if (modal === 'reward') openRewardChoice();
    if (modal === 'shop') openShop();
    if (modal === 'victory') showVictoryModal();
    if (modal === 'defeat') showDefeatModal();
  }

  function attack() {
    const result = game.attack();
    render();
    handleModal(result.modal);
  }

  function discardSelected() {
    const result = game.discardSelected();
    render();
    handleModal(result.modal);
  }

  function renderEnemy() {
    const { state } = game;
    const blocked = state.equipment.armor.reduction || 0;
    const damage = Math.max(0, state.enemy.damage + (state.enemy.temper || 0) - blocked);
    const nextTemper = Math.min(config.maxTemper, (state.enemy.temper || 0) + 1);
    const nextDamage = Math.max(0, state.enemy.damage + nextTemper - blocked);
    const bossProgress = (state.defeated % 5) + 1;
    const dots = [1, 2, 3, 4, 5].map(index => `<span class="boss-dot ${index < bossProgress ? 'done' : ''} ${index === 5 ? 'boss' : ''}"></span>`).join('');
    const finalProgress = state.finalDefeated ? 100 : Math.min(100, Math.round(((state.defeated + 1) / config.finalEncounter) * 100));
    const pastFinal = Math.max(0, state.defeated - config.finalEncounter);
    const toFinal = state.finalDefeated
      ? `Forest Crown won — endless mode. Past final boss: ${pastFinal} turn${pastFinal === 1 ? '' : 's'}.`
      : `${Math.max(0, config.finalEncounter - state.defeated)} encounter${config.finalEncounter - state.defeated === 1 ? '' : 's'} to final boss.`;
    const bossText = state.enemy.finalBoss
      ? 'Final boss: combos score as one card smaller. Win the run on defeat.'
      : state.enemy.boss
        ? 'Boss fight: shop after defeat.'
        : `${5 - (state.defeated % 5)} encounter${5 - (state.defeated % 5) === 1 ? '' : 's'} to next boss.`;
    const crownText = state.enemy.finalBoss
      ? `<div class="line"><strong>Crown Cracks:</strong> ${state.stats.cleanVictories} Clean Victories removed ${state.enemy.crownCrackReduction} HP (${config.finalBossBaseHp} → ${state.enemy.maxHp}).</div>`
      : '';
    const weakness = state.enemy.weakness;
    const weaknessBadge = `<div class="weakness-badge ${weakness}"><span>${config.weaknessIcon[weakness]}</span><div><small>Weak to</small><strong>${config.weaknessLabel[weakness]}</strong><em>×1.5 base score</em></div></div>`;
    const regroupText = state.regroupTokens > 0
      ? `<strong>Swap bank:</strong> ${state.regroupTokens}/${config.maxRegroupTokens}. Spend 1 to Regroup a single card; weakness finishes earn more.`
      : `<strong>Swap bank empty:</strong> finish an enemy with its weakness to earn a single-card Regroup.`;

    document.getElementById('enemy').innerHTML = `<div class="name">${state.enemy.finalBoss ? '👑🔥 ' : state.enemy.boss ? '👑 ' : ''}${state.enemy.name}</div><div class="line">Monster HP: <strong>${state.enemy.hp}/${state.enemy.maxHp}</strong></div>${weaknessBadge}<div class="temper-row"><span>Temper</span><strong>${state.enemy.temper || 0}/${config.maxTemper}</strong><div class="temper-pips">${[1, 2, 3].map(index => `<span class="temper-pip ${index <= (state.enemy.temper || 0) ? 'hot' : ''}"></span>`).join('')}</div></div><div class="line">Attack: <strong>${damage} HP</strong>${state.enemy.temper ? ` (base ${state.enemy.damage} + Temper ${state.enemy.temper})` : ''}${blocked ? ` after armor blocks ${blocked}` : ''}.</div><div class="line">A partial attack raises Temper first, then this monster hits for <strong>${nextDamage} HP</strong>${blocked ? ' after armor' : ''}.</div><div class="line regroup-status">${regroupText}</div><div class="line">${bossText}</div>${crownText}<div class="boss-track" title="Boss every 5 encounters">${dots}</div><div class="final-track"><div class="line">${toFinal}</div><div class="final-bar"><div class="final-fill" style="width:${finalProgress}%"></div></div></div>`;
  }

  function renderHand() {
    const { state } = game;
    const hand = document.getElementById('hand');
    const selectedBest = game.bestAttack();
    const weaknessHot = !!selectedBest && selectedBest.traits.includes(state.enemy.weakness);
    const finisherHot = !!selectedBest && selectedBest.total >= state.enemy.hp;
    hand.innerHTML = '';
    state.hand.forEach(card => {
      const element = document.createElement('div');
      const selected = state.selected.includes(card.id);
      element.className = `card ${card.color}${selected ? ' selected' : ''}${selected && weaknessHot ? ' weakness-hit' : ''}${selected && finisherHot ? ' finisher-ready' : ''}`;
      element.onclick = () => {
        game.toggleCard(card.id);
        render();
      };
      const tags = `${selected && weaknessHot ? '<span class="weakness-tag">×1.5!</span>' : ''}${selected && finisherHot ? '<span class="finisher-tag">LETHAL</span>' : ''}`;
      element.innerHTML = `<div class="num">${card.n}</div><div class="card-tags">${tags}</div>`;
      hand.appendChild(element);
    });
  }

  function renderPreview() {
    const { state } = game;
    const cards = game.selectedCards();
    const preview = document.getElementById('scorePreview');
    if (!cards.length) {
      preview.innerHTML = 'Select any cards. A Match, Sequence, or Flush uses its combo score; cards with no combo make a Basic Hit for 1 damage each.';
      return;
    }
    const best = game.bestAttack(cards);
    if (!best) {
      preview.innerHTML = `<div class="score-big"><span class="score-number">${cards.length}</span><strong>selected card${cards.length > 1 ? 's' : ''}</strong></div><div>No valid combo yet.</div>`;
      return;
    }
    const leaves = Math.max(0, state.enemy.hp - best.total);
    const lethal = best.total >= state.enemy.hp;
    const kept = state.hand.length - cards.length;
    const drawn = lethal ? Math.max(0, state.handSize - kept) : cards.length;
    const nextTemper = Math.min(config.maxTemper, state.enemy.temper + 1);
    const retaliation = Math.max(0, state.enemy.damage + nextTemper - (state.equipment.armor.reduction || 0));
    const clean = lethal && best.margin >= 0 && best.margin <= 3;
    const bigOverkill = lethal && best.margin >= config.overkillThreshold;
    const weaknessFinish = lethal && best.breakdown.weaknessBonus > 0;
    const crownBefore = Rules.crownCrackReduction(state.stats.cleanVictories);
    const crownAfter = Rules.crownCrackReduction(state.stats.cleanVictories + 1);
    const crownAdded = !state.finalDefeated && !state.enemy.finalBoss ? crownAfter - crownBefore : 0;
    const crownForecast = crownAdded > 0 ? ` and -${crownAdded} final boss HP` : '';
    const verdict = `${Rules.comboName(best.traits)}: <strong>${best.total}</strong> vs ${state.enemy.hp}/${state.enemy.maxHp} HP — ${best.margin >= 0 ? `defeats by ${best.margin}` : `leaves ${leaves} HP`}.`;
    const breakdown = best.breakdown;
    const parts = [];
    if (breakdown.basic) parts.push(`<div class="score-part basic"><span>Basic · ${cards.length} card${cards.length === 1 ? '' : 's'}</span><b>${breakdown.basic}</b></div>`);
    if (breakdown.match) parts.push(`<div class="score-part"><span>Match</span><b>${breakdown.match}</b></div>`);
    if (breakdown.sequence) parts.push(`<div class="score-part"><span>Sequence</span><b>${breakdown.sequence}</b></div>`);
    if (breakdown.flush) parts.push(`<div class="score-part"><span>Flush</span><b>${breakdown.flush}</b></div>`);
    if (breakdown.weaknessBonus) parts.push(`<div class="score-part weakness"><span>Weakness ×1.5</span><b>+${breakdown.weaknessBonus}</b></div>`);
    if (breakdown.weaponModeBonus) parts.push(`<div class="score-part gear"><span>Weapon trait</span><b>+${breakdown.weaponModeBonus}</b></div>`);
    if (breakdown.weaponDamageBonus) parts.push(`<div class="score-part gear"><span>Weapon</span><b>+${breakdown.weaponDamageBonus}</b></div>`);
    if (breakdown.itemDamageBonus) parts.push(`<div class="score-part gear"><span>Item</span><b>+${breakdown.itemDamageBonus}</b></div>`);
    const weaknessBanner = breakdown.weaknessBonus
      ? `<div class="weakness-hit-banner">${config.weaknessIcon[state.enemy.weakness]} WEAKNESS HIT! Base ${breakdown.base} becomes ${breakdown.base + breakdown.weaknessBonus}</div>`
      : '';
    const finisherBanner = lethal ? '<div class="finisher-banner">💀 FINISHER READY · This attack defeats the monster</div>' : '';
    const curseText = breakdown.finalPenalty ? `<div class="curse-note">Final boss curse: this combo scores as ${breakdown.scoreCount} card${breakdown.scoreCount === 1 ? '' : 's'}.</div>` : '';
    const overkillForecast = bigOverkill
      ? `<div class="overkill-forecast">Big Overkill: +${config.overkillGold} gold${state.enemy.boss ? '' : ` and gear chance ${Math.round(config.monsterEquipmentDropChance * 100)}% → ${Math.round((config.monsterEquipmentDropChance + config.overkillTreasureBonus) * 100)}%`}</div>`
      : '';
    const weaknessFinishForecast = weaknessFinish
      ? `<div class="swap-forecast">Weakness Finish: +1 Swap token${state.regroupTokens >= config.maxRegroupTokens ? ' becomes +1 gold because the bank is full' : ` (${state.regroupTokens} → ${Math.min(config.maxRegroupTokens, state.regroupTokens + 1)})`}</div>`
      : '';
    preview.innerHTML = `${weaknessBanner}${finisherBanner}<div class="score-big"><span class="score-number">${best.total}</span><strong>${Rules.comboName(best.traits)}</strong></div><div>${verdict}</div><div class="score-breakdown-label">Score breakdown</div><div class="score-formula">${parts.join('')}</div>${curseText}<div class="forecast"><div class="forecast-item"><span>Cards after attack</span><strong>${kept} kept, ${drawn} drawn</strong></div><div class="forecast-item"><span>Enemy response</span><strong>${lethal ? 'Defeated' : `${retaliation} damage at Temper ${nextTemper}`}</strong></div></div>${clean ? `<div class="clean-forecast">Clean Victory: +${config.cleanVictoryGold} gold${state.enemy.boss ? ' and heal 1 HP' : ''}${crownForecast}</div>` : ''}${overkillForecast}${weaknessFinishForecast}`;
  }

  function renderRunSummary() {
    const { state } = game;
    const stats = state.stats;
    document.getElementById('runSummary').innerHTML = `<div class="summary-stat"><strong>${state.defeated}</strong>defeated</div><div class="summary-stat"><strong>${state.hp}/${state.maxHp}</strong>HP left</div><div class="summary-stat"><strong>${stats.attacks}</strong>attacks (${stats.partialAttacks} partial)</div><div class="summary-stat"><strong>${stats.discards}</strong>Swaps spent</div><div class="summary-stat"><strong>${state.regroupTokens}/${config.maxRegroupTokens}</strong>Swap bank</div><div class="summary-stat"><strong>${stats.weaknessFinishes}</strong>Weakness Finishes</div><div class="summary-stat"><strong>${stats.cleanVictories}</strong>Clean Victories</div><div class="summary-stat"><strong>${stats.overkillVictories}</strong>Big Overkills</div><div class="summary-stat"><strong>${stats.biggestCombo}</strong>biggest hit</div><div class="summary-stat"><strong>${stats.damageTaken}</strong>damage taken</div><div class="summary-stat money-summary"><strong>🪙 ${state.gold}</strong>gold</div><div class="summary-stat summary-seed"><div>Seed <code>${state.seed}</code></div><button onclick="copySeed()">Copy Link</button></div>`;
  }

  function pills(counts, order) {
    return order.map(key => `<span class="deck-pill">${key}: <strong>${counts[key] || 0}</strong></span>`).join('');
  }

  function renderEquipment() {
    const { state } = game;
    document.getElementById('equipment').innerHTML = `${gearCard(state.equipment.weapon, 'Weapon')}${gearCard(state.equipment.armor, 'Armor')}${gearCard(state.equipment.item, 'Item')}<div class="gear-card gold-card"><div class="gear-icon" aria-hidden="true">🪙</div><div class="gear-copy"><div class="gear-eyebrow">Purse</div><div class="gear-name">${state.gold} gold</div></div></div>`;
    document.getElementById('rewardBanner').textContent = state.lastReward;
  }

  function renderDeckList() {
    const { state } = game;
    const allCards = [...state.deck, ...state.hand, ...state.discard];
    const colorCounts = Rules.countCards(allCards, card => card.color);
    const numberCounts = Rules.countCards(allCards, card => card.n);
    document.getElementById('deckList').innerHTML = `<div class="deck-group"><h3>Colours</h3><div class="deck-counts">${pills(colorCounts, config.colors)}</div></div><div class="deck-group"><h3>Numbers</h3><div class="deck-counts">${pills(numberCounts, [1, 2, 3, 4, 5, 6, 7, 8])}</div></div>`;
  }

  function pulseElement(id, className) {
    const element = document.getElementById(id);
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    setTimeout(() => element.classList.remove(className), 950);
  }

  function render() {
    const { state } = game;
    document.getElementById('hp').textContent = `${state.hp}/${state.maxHp}`;
    document.getElementById('playerHpValue').textContent = `${state.hp}/${state.maxHp}`;
    document.getElementById('monsterHpValue').textContent = `${state.enemy.hp}/${state.enemy.maxHp}`;
    document.getElementById('playerHp').classList.toggle('low', state.hp <= Math.ceil(state.maxHp / 3));
    document.getElementById('monsterHp').classList.toggle('low', state.enemy.hp <= Math.ceil(state.enemy.maxHp / 3));
    document.getElementById('encounter').textContent = state.defeated + 1;
    document.getElementById('handCount').textContent = `${state.hand.length}/${state.handSize}`;
    document.getElementById('deckCount').textContent = state.deck.length;
    document.getElementById('discardCount').textContent = `${state.regroupTokens}/${config.maxRegroupTokens}`;
    document.getElementById('goldCount').textContent = `${state.gold} gold`;
    renderEnemy();
    renderHand();
    renderPreview();
    document.getElementById('log').innerHTML = state.log.join('');
    renderEquipment();
    renderDeckList();
    renderRunSummary();
    if (state.playerHit) {
      pulseElement('playerHp', 'hp-hit');
      state.playerHit = false;
    }
    if (state.monsterHit) {
      pulseElement('monsterHp', 'hp-shake');
      state.monsterHit = false;
    }
    const attackButton = document.getElementById('attackBtn');
    const discardButton = document.getElementById('discardBtn');
    const best = game.bestAttack();
    const weaknessHot = !!best && best.traits.includes(state.enemy.weakness) && !state.gameOver;
    const lethalHot = !!best && best.total >= state.enemy.hp && !state.gameOver;
    attackButton.innerHTML = lethalHot && weaknessHot
      ? `💀 Weakness Finisher<small>lethal + ×1.5 + Swap token</small>`
      : lethalHot
        ? '💀 Finish<small>this attack defeats the monster</small>'
        : weaknessHot
          ? `💥 Weakness Attack ×1.5<small>${config.weaknessLabel[state.enemy.weakness]} bonus active</small>`
          : 'Attack <small>combo or 1 damage per Basic card</small>';
    attackButton.disabled = state.gameOver;
    attackButton.classList.toggle('attack-ready', !!best && best.total >= state.enemy.hp && !state.gameOver);
    attackButton.classList.toggle('attack-short', !!best && best.total < state.enemy.hp && !state.gameOver);
    const selectedOne = state.selected.length === 1;
    if (state.regroupTokens > 0) {
      discardButton.innerHTML = `Regroup · ${state.regroupTokens} banked<small>spend 1 to swap exactly 1 card; half hit</small>`;
    } else {
      discardButton.innerHTML = 'Swap bank empty<small>earn tokens with Weakness Finishes</small>';
    }
    discardButton.disabled = state.gameOver || !selectedOne || state.regroupTokens <= 0;
    document.getElementById('clearSelectionBtn').disabled = state.gameOver || !state.selected.length;
  }

  function copySeed() {
    const url = location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        game.state.log.unshift('<p>Seed link copied.</p>');
        render();
      });
    } else {
      prompt('Copy this seeded run link:', url);
    }
  }

  function makeSeed() {
    return State.makeSeed();
  }

  window.start = start;
  window.makeSeed = makeSeed;
  window.copySeed = copySeed;
  window.equipPendingReward = equipPendingReward;
  window.sellPendingReward = sellPendingReward;
  window.buyShopOffer = buyShopOffer;
  window.rerollShop = rerollShop;
  window.leaveShop = leaveShop;

  document.getElementById('attackBtn').onclick = attack;
  document.getElementById('discardBtn').onclick = discardSelected;
  document.getElementById('clearSelectionBtn').onclick = () => {
    game.clearSelection();
    render();
  };
  document.getElementById('sortNumberBtn').onclick = () => {
    game.setSortMode('number');
    render();
  };
  document.getElementById('sortColorBtn').onclick = () => {
    game.setSortMode('color');
    render();
  };
  document.getElementById('restartBtn').onclick = () => start(game.state.seed);
  document.getElementById('newSeedBtn').onclick = () => start(State.makeSeed());

  start(seedFromUrl());
})();
