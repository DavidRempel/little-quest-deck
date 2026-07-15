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

  function openRewardChoice() {
    const { state } = game;
    const item = state.pendingReward;
    if (!item) return;
    const sellValue = item.value || 5;
    const current = state.equipment[item.slot];
    const slotLabel = item.slot[0].toUpperCase() + item.slot.slice(1);
    showModal(`<h2>Found ${slotLabel}</h2><p><strong>New:</strong><br>${game.itemDescription(item)}</p><p><strong>Current ${slotLabel}:</strong><br>${game.itemDescription(current)}</p><div class="modal-actions"><button onclick="equipPendingReward()">Equip new ${slotLabel}</button><button onclick="sellPendingReward()">Sell for ${sellValue} gold</button></div>`);
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
      const description = offer.kind === 'gear'
        ? `${game.itemDescription(offer.item)}<br><small>Current ${offer.item.slot}: ${game.itemDescription(state.equipment[offer.item.slot], false)}</small>`
        : `${offer.label} — ${offer.text}`;
      const disabled = offer.kind === 'gold' || state.gold < offer.cost ? 'disabled' : '';
      return `<div class="shop-offer"><strong>${description}</strong><br><small>${offer.cost} gold</small><button ${disabled} onclick="buyShopOffer(${index})">${offer.kind === 'gold' ? 'Sold out' : 'Buy'}</button></div>`;
    }).join('');
    showModal(`<h2>🛒 Roadside Supply Store</h2><p>The boss drops a purse and a suspiciously well-placed shop appears. Gold: <strong>${state.gold}</strong></p><div class="modal-actions">${offers}<button onclick="leaveShop()">Leave shop</button></div>`);
  }

  function buyShopOffer(index) {
    if (!game.buyShopOffer(index)) return;
    openShop();
    render();
  }

  function leaveShop() {
    hideModal();
    render();
  }

  function showVictoryModal() {
    showModal(`<h2>👑 Forest Crown Won</h2><p>You beat the final boss on encounter ${config.finalEncounter}. Prize: the Forest Crown, 40 gold, and bragging rights over a browser tab.</p><div class="modal-actions"><button onclick="leaveShop()">Keep playing endless mode</button><button onclick="start()">Start a fresh run</button></div>`);
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

    document.getElementById('enemy').innerHTML = `<div class="name">${state.enemy.finalBoss ? '👑🔥 ' : state.enemy.boss ? '👑 ' : ''}${state.enemy.name}</div><div class="line">Monster HP: <strong>${state.enemy.hp}/${state.enemy.maxHp}</strong></div><div class="line">Weakness: <strong>${config.weaknessLabel[state.enemy.weakness]}</strong> trait scores ×1.5.</div><div class="temper-row"><span>Temper</span><strong>${state.enemy.temper || 0}/${config.maxTemper}</strong><div class="temper-pips">${[1, 2, 3].map(index => `<span class="temper-pip ${index <= (state.enemy.temper || 0) ? 'hot' : ''}"></span>`).join('')}</div></div><div class="line">Attack: <strong>${damage} HP</strong>${state.enemy.temper ? ` (base ${state.enemy.damage} + Temper ${state.enemy.temper})` : ''}${blocked ? ` after armor blocks ${blocked}` : ''}.</div><div class="line">Next non-lethal action raises Temper first, then this monster hits for <strong>${nextDamage} HP</strong>${blocked ? ' after armor' : ''}.</div><div class="line">${bossText}</div><div class="boss-track" title="Boss every 5 encounters">${dots}</div><div class="final-track"><div class="line">${toFinal}</div><div class="final-bar"><div class="final-fill" style="width:${finalProgress}%"></div></div></div>`;
  }

  function renderHand() {
    const { state } = game;
    const hand = document.getElementById('hand');
    hand.innerHTML = '';
    state.hand.forEach(card => {
      const element = document.createElement('div');
      element.className = `card ${card.color}${state.selected.includes(card.id) ? ' selected' : ''}`;
      element.onclick = () => {
        game.toggleCard(card.id);
        render();
      };
      element.innerHTML = `<div class="num">${card.n}</div><div></div>`;
      hand.appendChild(element);
    });
  }

  function renderPreview() {
    const { state } = game;
    const cards = game.selectedCards();
    const preview = document.getElementById('scorePreview');
    if (!cards.length) {
      preview.innerHTML = 'Select cards. Attack will automatically score the best valid combo.';
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
    const verdict = `${Rules.comboName(best.traits)}: <strong>${best.total}</strong> vs ${state.enemy.hp}/${state.enemy.maxHp} HP — ${best.margin >= 0 ? `defeats by ${best.margin}` : `leaves ${leaves} HP`}.`;
    preview.innerHTML = `<div class="score-big"><span class="score-number">${best.total}</span><strong>${Rules.comboName(best.traits)}</strong></div><div>${verdict}</div><div class="forecast"><div class="forecast-item"><span>Cards after attack</span><strong>${kept} kept, ${drawn} drawn</strong></div><div class="forecast-item"><span>Enemy response</span><strong>${lethal ? 'Defeated' : `${retaliation} damage at Temper ${nextTemper}`}</strong></div></div>${clean ? `<div class="clean-forecast">Clean Victory: +${config.cleanVictoryGold} gold${state.enemy.boss ? ' and heal 1 HP' : ''}</div>` : ''}<div style="margin-top:8px;"><small>${best.formula}</small></div>`;
  }

  function renderRunSummary() {
    const { state } = game;
    const stats = state.stats;
    document.getElementById('runSummary').innerHTML = `<div class="summary-stat"><strong>${state.defeated}</strong>defeated</div><div class="summary-stat"><strong>${state.hp}/${state.maxHp}</strong>HP left</div><div class="summary-stat"><strong>${stats.attacks}</strong>attacks (${stats.partialAttacks} partial)</div><div class="summary-stat"><strong>${stats.discards}</strong>discards</div><div class="summary-stat"><strong>${stats.cleanVictories}</strong>Clean Victories</div><div class="summary-stat"><strong>${stats.biggestCombo}</strong>biggest combo</div><div class="summary-stat"><strong>${stats.damageTaken}</strong>damage taken</div><div class="summary-stat"><strong>${state.gold}</strong>gold</div><div class="summary-stat summary-seed"><div>Seed <code>${state.seed}</code></div><button onclick="copySeed()">Copy Link</button></div>`;
  }

  function pills(counts, order) {
    return order.map(key => `<span class="deck-pill">${key}: <strong>${counts[key] || 0}</strong></span>`).join('');
  }

  function renderEquipment() {
    const { state } = game;
    document.getElementById('equipment').innerHTML = `<div class="slot"><span class="icon">🗡️</span><strong>Weapon:</strong> ${game.itemDescription(state.equipment.weapon, false)}</div><div class="slot"><span class="icon">🛡️</span><strong>Armor:</strong> ${game.itemDescription(state.equipment.armor, false)}</div><div class="slot"><span class="icon">🎒</span><strong>Item:</strong> ${game.itemDescription(state.equipment.item, false)}</div><div class="slot"><span class="icon">🪙</span><strong>Gold:</strong> ${state.gold}</div>`;
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
    document.getElementById('discardCount').textContent = state.discard.length;
    document.getElementById('goldCount').textContent = state.gold;
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
    attackButton.innerHTML = `${weaknessHot ? '🔥 ' : ''}Attack${weaknessHot ? ' 🔥' : ''}<small>auto-best combo</small>`;
    attackButton.disabled = state.gameOver;
    attackButton.classList.toggle('attack-ready', !!best && best.total >= state.enemy.hp && !state.gameOver);
    attackButton.classList.toggle('attack-short', !!best && best.total < state.enemy.hp && !state.gameOver);
    discardButton.innerHTML = state.enemy.freeDiscardUsed ? 'Discard <small>raises Temper; half hit</small>' : 'Regroup <small>first discard: no Temper; half hit</small>';
    discardButton.disabled = state.gameOver;
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
