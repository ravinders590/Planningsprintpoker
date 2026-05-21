/* global io */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    // --- Hide loading screen, reveal app ---
    const loadingScreen = $('loadingScreen');
    function hideLoading() {
        document.querySelector('.topbar').classList.remove('hidden');
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => { loadingScreen.remove(); }, 500);
        }
    }
    // Show app after a brief delay so the animation is visible
    setTimeout(hideLoading, 800);

    // Screens
    const createScreen = $('createScreen');
    const nameScreen = $('nameScreen');
    const gameScreen = $('gameScreen');

    // Step 1 - create
    const gameName = $('gameName');
    const votingSelect = $('votingSelect');
    const votingSelectValue = $('votingSelectValue');
    const votingSelectList = $('votingSelectList');
    const whoReveal = $('whoReveal');
    const whoManage = $('whoManage');
    const optAutoReveal = $('optAutoReveal');
    const optFun = $('optFun');
    const optAvg = $('optAvg');
    const optCountdown = $('optCountdown');
    const btnCreate = $('btnCreate');

    // --- Custom voting-system dropdown ---
    let selectedDeckId = 'fibonacci';
    let customDeck = null; // array of strings when user creates a custom deck

    // --- Saved custom decks (localStorage) ---
    const SAVED_DECKS_KEY = 'pp:customDecks';
    function loadSavedDecks() {
        try {
            const raw = localStorage.getItem(SAVED_DECKS_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }
    function saveSavedDecks(decks) {
        try { localStorage.setItem(SAVED_DECKS_KEY, JSON.stringify(decks)); } catch (e) { /* ignore */ }
    }
    function upsertSavedDeck(label, values) {
        const decks = loadSavedDecks();
        const idx = decks.findIndex((d) => d.label === label);
        const entry = { id: 'custom:' + (idx >= 0 ? decks[idx].id.split(':')[1] : Date.now().toString(36)), label, values };
        if (idx >= 0) decks[idx] = entry; else decks.push(entry);
        saveSavedDecks(decks);
        return entry;
    }
    function renderSavedDecks(selectedId) {
        // Remove existing saved items
        Array.from(votingSelectList.querySelectorAll('li.cs-saved')).forEach((n) => n.remove());
        const action = votingSelectList.querySelector('li.cs-action');
        const decks = loadSavedDecks();
        decks.forEach((d) => {
            const li = document.createElement('li');
            li.setAttribute('role', 'option');
            li.dataset.value = d.id;
            li.className = 'cs-saved' + (d.id === selectedId ? ' selected' : '');
            li.textContent = d.label + ' ( ' + d.values.join(', ') + ' )';
            votingSelectList.insertBefore(li, action);
        });
    }
    renderSavedDecks();

    function setVotingValue(deckId, label) {
        selectedDeckId = deckId;
        votingSelectValue.textContent = label;
        Array.from(votingSelectList.querySelectorAll('li')).forEach((li) => {
            li.classList.toggle('selected', li.dataset.value === deckId);
        });
    }

    function openVotingList(open) {
        votingSelect.classList.toggle('open', open);
        votingSelect.setAttribute('aria-expanded', String(open));
    }

    votingSelect.addEventListener('click', (e) => {
        // Ignore clicks bubbling from list items (handled below)
        if (e.target.closest('.cs-list')) return;
        openVotingList(!votingSelect.classList.contains('open'));
    });
    votingSelect.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openVotingList(!votingSelect.classList.contains('open'));
        } else if (e.key === 'Escape') {
            openVotingList(false);
        }
    });
    document.addEventListener('click', (e) => {
        if (!votingSelect.contains(e.target)) openVotingList(false);
    });

    votingSelectList.addEventListener('click', (e) => {
        const li = e.target.closest('li[role="option"]');
        if (!li) return;
        const val = li.dataset.value;
        if (val === '__custom__') {
            openVotingList(false);
            openCustomDeckModal();
            return;
        }
        if (val && val.indexOf('custom:') === 0) {
            const saved = loadSavedDecks().find((d) => d.id === val);
            if (saved) {
                customDeck = saved.values.slice();
                customDeckLabel = saved.label;
                setVotingValue(val, saved.label + ' ( ' + saved.values.join(', ') + ' )');
                openVotingList(false);
                return;
            }
        }
        setVotingValue(val, li.textContent.trim());
        customDeck = null;
        openVotingList(false);
    });

    // --- Custom deck modal ---
    const customDeckModal = $('customDeckModal');
    const customDeckClose = $('customDeckClose');
    const customDeckCancel = $('customDeckCancel');
    const customDeckName = $('customDeckName');
    const customDeckInput = $('customDeckInput');
    const customDeckSave = $('customDeckSave');
    const customDeckPreview = $('customDeckPreview');

    let customDeckLabel = 'My custom deck';

    function parseCustomDeck(raw) {
        return (raw || '')
            .split(',')
            .map((s) => s.trim().slice(0, 3))
            .filter(Boolean);
    }

    function renderCustomPreview() {
        customDeckPreview.innerHTML = '';
        const vals = parseCustomDeck(customDeckInput.value);
        const unique = Array.from(new Set(vals));
        unique.forEach((v, i) => {
            const c = document.createElement('div');
            c.className = 'deck-card' + (i === Math.floor(unique.length / 2) ? ' selected' : '');
            c.textContent = v;
            customDeckPreview.appendChild(c);
        });
    }

    function openCustomDeckModal() {
        customDeckName.value = customDeckLabel || 'My custom deck';
        customDeckInput.value = customDeck ? customDeck.join(',') : '';
        renderCustomPreview();
        customDeckModal.classList.remove('hidden');
        setTimeout(() => { customDeckName.select(); }, 50);
    }
    function closeCustomDeckModal() { customDeckModal.classList.add('hidden'); }

    customDeckClose.addEventListener('click', closeCustomDeckModal);
    customDeckCancel.addEventListener('click', closeCustomDeckModal);
    customDeckModal.addEventListener('click', (e) => { if (e.target === customDeckModal) closeCustomDeckModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !customDeckModal.classList.contains('hidden')) closeCustomDeckModal();
    });
    customDeckInput.addEventListener('input', renderCustomPreview);
    customDeckInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') customDeckSave.click(); });

    customDeckSave.addEventListener('click', () => {
        const values = parseCustomDeck(customDeckInput.value);
        const unique = Array.from(new Set(values));
        if (unique.length < 2) {
            alert('Please enter at least 2 values, separated by commas.');
            return;
        }
        if (unique.length > 20) {
            alert('Custom deck supports up to 20 values.');
            return;
        }
        customDeck = unique;
        customDeckLabel = (customDeckName.value || '').trim() || 'My custom deck';
        const entry = upsertSavedDeck(customDeckLabel, unique);
        renderSavedDecks(entry.id);
        setVotingValue(entry.id, customDeckLabel + ' ( ' + unique.join(', ') + ' )');
        closeCustomDeckModal();
    });

    // Advanced settings toggle
    const btnToggleAdvanced = $('btnToggleAdvanced');
    const advancedSettings = $('advancedSettings');
    if (btnToggleAdvanced && advancedSettings) {
        btnToggleAdvanced.addEventListener('click', () => {
            const isHidden = advancedSettings.classList.toggle('hidden');
            btnToggleAdvanced.setAttribute('aria-expanded', String(!isHidden));
            btnToggleAdvanced.textContent = isHidden ? 'Show advanced settings...' : 'Hide advanced settings';
        });
    }

    // Step 2 - name
    const inputName = $('inputName');
    const inputSpectator = $('inputSpectator');
    const btnJoin = $('btnJoin');

    // Step 3 - game
    const roomTitle = $('roomTitle');
    const userBadge = $('userBadge');
    const roomLabel = $('roomLabel');
    const usersTop = $('usersTop');
    const usersBottom = $('usersBottom');
    const deckEl = $('deck');
    const btnReveal = $('btnReveal');
    const btnReset = $('btnReset');
    const btnToggleSpectator = $('btnToggleSpectator');
    const results = $('results');
    const distribution = $('distribution');
    const avgBlock = $('avgBlock');
    const avgValue = $('avgValue');
    const agreementIcon = $('agreementIcon');
    const countdownEl = $('countdown');
    const confettiEl = $('confetti');
    const btnLeaveGame = $('btnLeaveGame');
    const btnVotingHistoryTop = $('btnVotingHistoryTop');
    const topbarActions = $('topbarActions');
    const votingHistoryModal = $('votingHistoryModal');
    const votingHistoryClose = $('votingHistoryClose');
    const votingHistoryBody = $('votingHistoryBody');
    const votingHistoryEmpty = $('votingHistoryEmpty');

    let socket = null;
    let selfId = null;
    let pendingRoomId = null;
    let state = null;
    let myVote = null;
    let prevRevealed = false;

    function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    // --- Game History (localStorage) ---
    const HISTORY_KEY = 'pp:gameHistory';
    function loadHistory() {
        try { const r = localStorage.getItem(HISTORY_KEY); return r ? JSON.parse(r) : []; }
        catch (e) { return []; }
    }
    function saveHistory(list) {
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 20))); } catch (e) {}
    }
    function addToHistory(roomId, name, deckId, votingHistory) {
        const list = loadHistory();
        const existing = list.findIndex((g) => g.roomId === roomId);
        if (existing >= 0) list.splice(existing, 1);
        list.unshift({ roomId, name, deckId, lastAccessed: Date.now(), votingHistory: votingHistory || [] });
        saveHistory(list);
        renderHistory();
    }
    function removeFromHistory(roomId) {
        const list = loadHistory().filter((g) => g.roomId !== roomId);
        saveHistory(list);
        renderHistory();
    }
    function timeAgo(ts) {
        const diff = Date.now() - ts;
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
        if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
        return Math.floor(diff / 86400000) + 'd ago';
    }
    function renderHistory() {
        const historySection = $('gameHistory');
        const historyList = $('historyList');
        const list = loadHistory();
        if (!list.length) { historySection.classList.add('hidden'); return; }
        historySection.classList.remove('hidden');
        historyList.innerHTML = '';
        list.forEach((g) => {
            const row = document.createElement('div');
            row.className = 'history-item-wrapper';
            const header = document.createElement('div');
            header.className = 'history-item';
            const info = document.createElement('div');
            info.className = 'history-info';
            info.innerHTML = '<strong>' + escapeHtml(g.name) + '</strong><span class="history-meta">' + escapeHtml(g.deckId || '') + ' · ' + timeAgo(g.lastAccessed) + '</span>';
            const actions = document.createElement('div');
            actions.className = 'history-actions';
            const removeBtn = document.createElement('button');
            removeBtn.className = 'ghost small danger';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', () => removeFromHistory(g.roomId));
            actions.appendChild(removeBtn);
            header.appendChild(info);
            header.appendChild(actions);
            row.appendChild(header);

            if (g.votingHistory && g.votingHistory.length) {
                const table = document.createElement('table');
                table.className = 'history-voting-table';
                table.innerHTML = '<thead><tr><th>Issue Name</th><th>Result</th><th>Agreement</th><th>Duration</th><th>Date</th><th>Voted</th><th>Players</th></tr></thead>';
                const tbody = document.createElement('tbody');
                g.votingHistory.forEach((h) => {
                    const tr = document.createElement('tr');
                    const dur = h.duration < 60 ? h.duration + 's' : Math.floor(h.duration / 60) + 'm ' + (h.duration % 60) + 's';
                    const d = new Date(h.date);
                    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    const dateStr = d.getDate() + ' ' + months[d.getMonth()] + ', ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
                    const agreeClass = 'agreement-' + h.agreement;
                    tr.innerHTML =
                        '<td>' + escapeHtml(h.issue) + '</td>' +
                        '<td class="result-cell"><strong>' + escapeHtml(h.result) + '</strong></td>' +
                        '<td><span class="agreement-dot ' + agreeClass + '"></span></td>' +
                        '<td>' + dur + '</td>' +
                        '<td>' + dateStr + '</td>' +
                        '<td>' + h.votedCount + '/' + h.totalCount + '</td>' +
                        '<td class="players-cell">' + escapeHtml(h.playerResults) + '</td>';
                    tbody.appendChild(tr);
                });
                table.appendChild(tbody);
                row.appendChild(table);
            }

            historyList.appendChild(row);
        });
    }
    renderHistory();

    // Restore last-used name
    inputName.value = localStorage.getItem('pp:name') || '';

    // --- Step routing ---
    const params = new URLSearchParams(location.search);
    const urlRoom = params.get('room');
    if (urlRoom) {
        // Validate room exists, then auto-join if we have a saved name
        fetch('/api/rooms/' + encodeURIComponent(urlRoom)).then((res) => {
            if (res.ok) {
                pendingRoomId = urlRoom;
                const savedName = localStorage.getItem('pp:name');
                if (savedName) {
                    inputName.value = savedName;
                    join();
                } else {
                    showStep('name');
                }
            } else {
                const url = new URL(location.href);
                url.searchParams.delete('room');
                history.replaceState({}, '', url);
                showStep('create');
            }
        }).catch(() => {
            pendingRoomId = urlRoom;
            showStep('name');
        });
    } else {
        showStep('create');
    }

    function showStep(step) {
        createScreen.classList.toggle('hidden', step !== 'create');
        nameScreen.classList.toggle('hidden', step !== 'name');
        gameScreen.classList.toggle('hidden', step !== 'game');
        document.querySelector('.topbar').classList.toggle('hidden', step === 'create');
    }

    // --- Step 1: create game ---
    btnCreate.addEventListener('click', async () => {
        const payload = {
            name: gameName.value.trim() || 'Planning Poker',
            deckId: customDeck ? 'custom' : selectedDeckId,
            deck: customDeck || undefined,
            settings: {
                whoReveal: whoReveal.value,
                whoManage: whoManage.value,
                autoReveal: optAutoReveal.checked,
                funFeatures: optFun.checked,
                showAverage: optAvg.checked,
                showCountdown: optCountdown.checked,
            },
        };
        btnCreate.disabled = true;
        try {
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            pendingRoomId = data.roomId;
            const url = new URL(location.href);
            url.searchParams.set('room', pendingRoomId);
            history.replaceState({}, '', url);
            showStep('name');
            setTimeout(() => inputName.focus(), 50);
        } catch (e) {
            alert('Failed to create game. Please try again.');
        } finally {
            btnCreate.disabled = false;
        }
    });

    // --- Step 2: join with display name ---
    btnJoin.addEventListener('click', join);
    inputName.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });

    function join() {
        const name = inputName.value.trim();
        if (!name) { inputName.focus(); return; }
        if (!pendingRoomId) { showStep('create'); return; }
        localStorage.setItem('pp:name', name);

        socket = io();
        wireSocket();
        socket.emit('room:join', {
            roomId: pendingRoomId,
            userName: name,
            spectator: inputSpectator.checked,
        });

        showStep('game');
        userBadge.classList.remove('hidden');
        btnVotingHistoryTop.classList.remove('hidden');
        topbarActions.classList.remove('hidden');
        userBadge.textContent = name;
        roomLabel.textContent = pendingRoomId;
    }

    function wireSocket() {
        socket.on('room:joined', ({ selfId: id }) => {
            selfId = id;
        });
        socket.on('room:state', (s) => {
            const wasRevealed = prevRevealed;
            state = s;
            // Save to history on first state
            if (pendingRoomId) addToHistory(pendingRoomId, state.name, state.deckId, state.votingHistory);
            // Clear local vote when reset happens (revealed -> not revealed)
            if (wasRevealed && !state.revealed) {
                myVote = null;
            }
            render();
            if (!facilitatorsModal.classList.contains('hidden')) renderFacilitators();
            if (!wasRevealed && state.revealed) onReveal();
            prevRevealed = state.revealed;
        });
        socket.on('reveal:countdown', ({ duration }) => {
            if (duration > 0) runCountdown(duration);
        });
        socket.on('room:left', () => {
            leaveCleanup();
        });
        socket.on('room:error', ({ code }) => {
            if (code === 'not_found') {
                if (pendingRoomId) removeFromHistory(pendingRoomId);
                leaveCleanup();
                showToast('That room no longer exists.');
            }
        });
    }

    function leaveCleanup() {
        if (socket) { socket.disconnect(); socket = null; }
        selfId = null;
        state = null;
        myVote = null;
        prevRevealed = false;
        pendingRoomId = null;
        const url = new URL(location.href);
        url.searchParams.delete('room');
        history.replaceState({}, '', url);
        userBadge.classList.add('hidden');
        btnVotingHistoryTop.classList.add('hidden');
        topbarActions.classList.add('hidden');
        showStep('create');
    }

    // --- Rendering ---
    function render() {
        if (!state) return;

        renderUsers();
        renderDeck();
        renderResults();

        const me = state.users.find((u) => u.id === selfId);
        const canIReveal = state.settings.whoReveal === 'all' || (me && (me.isModerator || me.isFacilitator));
        const anyVoted = state.users.some((u) => !u.spectator && u.hasVoted);
        btnReveal.classList.toggle('hidden', state.revealed || !canIReveal || !anyVoted);
        btnReset.classList.toggle('hidden', !state.revealed || !canIReveal);

        const tablePrompt = document.getElementById('tablePrompt');
        if (tablePrompt) tablePrompt.classList.toggle('hidden', anyVoted || state.revealed);
    }

    function renderUsers() {
        const voters = state.users.filter((u) => !u.spectator);
        let top = [], bottom = [];
        if (voters.length <= 1) {
            bottom = voters.slice();
        } else {
            const half = Math.ceil(voters.length / 2);
            top = voters.slice(0, half);
            bottom = voters.slice(half);
        }
        const spectators = state.users.filter((u) => u.spectator);

        usersTop.innerHTML = '';
        usersBottom.innerHTML = '';
        top.forEach((u) => usersTop.appendChild(userEl(u)));
        bottom.forEach((u) => usersBottom.appendChild(userEl(u)));
        spectators.forEach((u) => usersBottom.appendChild(userEl(u)));

        const lonely = document.getElementById('lonelyAbove');
        if (lonely) lonely.classList.toggle('hidden', state.users.length > 1);
    }

    function userEl(u) {
        const wrap = document.createElement('div');
        wrap.className = 'user' + (u.id === selfId ? ' self' : '');

        const slot = document.createElement('div');
        slot.className = 'card-slot';
        if (u.spectator) {
            slot.classList.add('spectator');
            slot.textContent = '👁';
        } else if (state.revealed && u.vote != null) {
            slot.classList.add('revealed');
            slot.textContent = u.vote;
        } else if (u.hasVoted) {
            slot.classList.add('voted');
        }

        // Edit button (only for self, already voted, not revealed, not spectator)
        if (u.id === selfId && !u.spectator && !state.revealed && u.hasVoted) {
            const editBtn = document.createElement('button');
            editBtn.className = 'card-edit-btn';
            editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditPopup(wrap, u);
            });
            slot.appendChild(editBtn);
        }

        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = u.name + (u.isModerator ? ' ★' : '');

        // Facilitator toggle (only visible to current moderator, on other users)
        const me = state.users.find((x) => x.id === selfId);
        if (me && me.isModerator && u.id !== selfId && !u.isModerator) {
            const modBtn = document.createElement('button');
            modBtn.className = 'mod-toggle-btn';
            modBtn.title = 'Make facilitator';
            modBtn.textContent = '👑';
            modBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                socket && socket.emit('user:setModerator', { targetId: u.id, isModerator: true });
            });
            wrap.appendChild(modBtn);
        }

        wrap.appendChild(slot);
        wrap.appendChild(name);
        return wrap;
    }

    // --- Edit vote popup ---
    let activeEditPopup = null;
    function openEditPopup(anchor, user) {
        closeEditPopup();
        const popup = document.createElement('div');
        popup.className = 'edit-popup';
        const grid = document.createElement('div');
        grid.className = 'edit-popup-grid';
        state.deck.forEach((value) => {
            const btn = document.createElement('button');
            btn.className = 'edit-popup-card' + (myVote === value ? ' selected' : '');
            btn.textContent = value;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                myVote = myVote === value ? null : value;
                socket.emit('vote:cast', { value });
                closeEditPopup();
                render();
            });
            grid.appendChild(btn);
        });
        popup.appendChild(grid);
        anchor.appendChild(popup);
        activeEditPopup = popup;
        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', closeEditPopupOutside);
        }, 0);
    }
    function closeEditPopup() {
        if (activeEditPopup) {
            activeEditPopup.remove();
            activeEditPopup = null;
            document.removeEventListener('click', closeEditPopupOutside);
        }
    }
    function closeEditPopupOutside(e) {
        if (activeEditPopup && !activeEditPopup.contains(e.target)) {
            closeEditPopup();
        }
    }

    function renderDeck() {
        deckEl.innerHTML = '';
        const me = state.users.find((u) => u.id === selfId);
        if (me && me.spectator) {
            deckEl.innerHTML = '<span style="color:#6b7693;font-size:14px;">You are spectating.</span>';
            return;
        }
        const meVote = state.revealed
            ? (me || {}).vote
            : myVote;

        state.deck.forEach((value) => {
            const c = document.createElement('button');
            c.className = 'deck-card' + (meVote === value ? ' selected' : '');
            c.textContent = value;
            c.disabled = state.revealed;
            c.addEventListener('click', () => {
                if (state.revealed) return;
                myVote = myVote === value ? null : value;
                socket.emit('vote:cast', { value });
                render();
            });
            deckEl.appendChild(c);
        });
    }

    function renderResults() {
        if (!state.revealed) {
            results.classList.add('hidden');
            return;
        }
        results.classList.remove('hidden');

        const votes = state.users
            .filter((u) => !u.spectator && u.vote != null)
            .map((u) => u.vote);

        const counts = {};
        votes.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
        const present = state.deck.filter((v) => counts[v]);
        const maxCount = Math.max(0, ...Object.values(counts));

        distribution.innerHTML = '';
        present.forEach((v) => {
            const item = document.createElement('div');
            item.className = 'dist-item';
            const bar = document.createElement('div');
            bar.className = 'dist-bar' + (counts[v] === maxCount ? ' top' : '');
            const h = maxCount ? Math.round((counts[v] / maxCount) * 80) + 10 : 10;
            bar.style.height = h + 'px';
            const card = document.createElement('div');
            card.className = 'dist-card';
            card.textContent = v;
            const lbl = document.createElement('div');
            lbl.className = 'dist-count';
            lbl.textContent = counts[v] + (counts[v] === 1 ? ' Vote' : ' Votes');
            item.appendChild(bar);
            item.appendChild(card);
            item.appendChild(lbl);
            distribution.appendChild(item);
        });

        // Average (numeric only)
        const showAvg = state.settings.showAverage;
        avgBlock.classList.toggle('hidden', !showAvg);
        if (showAvg) {
            const nums = votes.map(Number).filter((n) => !Number.isNaN(n));
            if (nums.length) {
                const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
                avgValue.textContent = (Math.round(avg * 10) / 10).toString();
            } else {
                avgValue.textContent = '–';
            }
        }

        // Agreement
        const unique = Object.keys(counts).length;
        agreementIcon.classList.remove('high', 'mid', 'low');
        if (votes.length === 0) {
            agreementIcon.innerHTML = '–';
        } else if (unique === 1) {
            agreementIcon.classList.add('high');
            agreementIcon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="12.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="12.5" r="1.5" fill="currentColor"/><path d="M9 16h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 6V3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="2" r="1" fill="#22a06b"/></svg>';
        } else if (unique === 2) {
            agreementIcon.classList.add('mid');
            agreementIcon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="12.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="12.5" r="1.5" fill="currentColor"/><path d="M9 16h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 6V3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="2" r="1" fill="#f5a623"/></svg>';
        } else {
            agreementIcon.classList.add('low');
            agreementIcon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="12.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="12.5" r="1.5" fill="currentColor"/><path d="M9 16h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 6V3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="2" r="1" fill="#e94f4f"/></svg>';
        }
    }

    // --- Reveal effects ---
    function onReveal() {
        if (!state.settings.funFeatures) return;
        const votes = state.users.filter((u) => !u.spectator && u.vote != null).map((u) => u.vote);
        if (votes.length > 1 && new Set(votes).size === 1) {
            launchConfetti();
        }
    }

    function runCountdown(seconds) {
        let n = seconds;
        countdownEl.classList.remove('hidden');
        countdownEl.textContent = n;
        const tick = setInterval(() => {
            n -= 1;
            if (n <= 0) {
                clearInterval(tick);
                countdownEl.classList.add('hidden');
            } else {
                countdownEl.textContent = n;
            }
        }, 1000);
    }

    function launchConfetti() {
        confettiEl.classList.remove('hidden');
        confettiEl.innerHTML = '';
        const colors = ['#2f6bff', '#22a06b', '#f5a623', '#e94f4f', '#9b59f5'];
        for (let i = 0; i < 80; i++) {
            const p = document.createElement('span');
            p.className = 'confetti-piece';
            p.style.left = Math.random() * 100 + '%';
            p.style.background = colors[i % colors.length];
            p.style.animationDelay = (Math.random() * 0.4) + 's';
            p.style.animationDuration = (1.5 + Math.random() * 1.2) + 's';
            confettiEl.appendChild(p);
        }
        setTimeout(() => { confettiEl.classList.add('hidden'); confettiEl.innerHTML = ''; }, 3000);
    }

    // --- Actions ---
    btnReveal.addEventListener('click', () => socket && socket.emit('vote:reveal'));
    btnReset.addEventListener('click', () => {
        myVote = null;
        socket && socket.emit('vote:reset');
    });
    btnToggleSpectator.addEventListener('click', () => {
        myVote = null;
        socket && socket.emit('user:toggleSpectator');
    });

    // --- Cancel / Leave game ---
    btnLeaveGame.addEventListener('click', () => {
        if (socket) socket.emit('room:leave');
        else leaveCleanup();
    });

    // --- Voting History modal ---
    btnVotingHistoryTop.addEventListener('click', () => {
        renderVotingHistory();
        votingHistoryModal.classList.remove('hidden');
    });
    votingHistoryClose.addEventListener('click', () => votingHistoryModal.classList.add('hidden'));
    votingHistoryModal.addEventListener('click', (e) => {
        if (e.target === votingHistoryModal) votingHistoryModal.classList.add('hidden');
    });

    function renderVotingHistory() {
        const history = state ? state.votingHistory || [] : [];
        votingHistoryBody.innerHTML = '';
        votingHistoryEmpty.classList.toggle('hidden', history.length > 0);
        history.forEach((h) => {
            const tr = document.createElement('tr');
            const dur = formatDuration(h.duration);
            const dateStr = formatHistoryDate(h.date);
            const agreeClass = 'agreement-' + h.agreement;
            tr.innerHTML =
                '<td>' + escapeHtml(h.issue) + '</td>' +
                '<td class="result-cell"><strong>' + escapeHtml(h.result) + '</strong></td>' +
                '<td><span class="agreement-dot ' + agreeClass + '"></span></td>' +
                '<td>' + dur + '</td>' +
                '<td>' + dateStr + '</td>' +
                '<td>' + h.votedCount + '/' + h.totalCount + '</td>' +
                '<td class="players-cell">' + escapeHtml(h.playerResults) + '</td>';
            votingHistoryBody.appendChild(tr);
        });
    }

    function formatDuration(seconds) {
        if (seconds < 60) return seconds + 's';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m + 'm ' + s + 's';
    }

    function formatHistoryDate(ts) {
        const d = new Date(ts);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return d.getDate() + ' ' + months[d.getMonth()] + ', ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    }

    // --- Facilitators modal ---
    const btnManageFacilitators = $('btnManageFacilitators');
    const facilitatorsModal = $('facilitatorsModal');
    const facilitatorsClose = $('facilitatorsClose');
    const facilitatorsList = $('facilitatorsList');

    btnManageFacilitators.addEventListener('click', () => {
        renderFacilitators();
        facilitatorsModal.classList.remove('hidden');
    });
    facilitatorsClose.addEventListener('click', () => facilitatorsModal.classList.add('hidden'));
    facilitatorsModal.addEventListener('click', (e) => {
        if (e.target === facilitatorsModal) facilitatorsModal.classList.add('hidden');
    });

    function renderFacilitators() {
        if (!state) return;
        facilitatorsList.innerHTML = '';
        const me = state.users.find((u) => u.id === selfId);
        const canManage = me && (me.isModerator || me.isFacilitator);

        state.users.forEach((u) => {
            const row = document.createElement('div');
            row.className = 'facilitator-row';
            const nameEl = document.createElement('span');
            nameEl.className = 'facilitator-name';
            nameEl.textContent = u.name;
            if (u.isModerator) nameEl.textContent += ' (Owner)';
            else if (u.isFacilitator) nameEl.textContent += ' (Facilitator)';
            row.appendChild(nameEl);

            if (canManage && !u.isModerator && u.id !== selfId) {
                const btn = document.createElement('button');
                if (u.isFacilitator) {
                    btn.className = 'ghost small danger';
                    btn.textContent = 'Remove';
                    btn.addEventListener('click', () => {
                        socket && socket.emit('user:removeFacilitator', { targetId: u.id });
                    });
                } else {
                    btn.className = 'ghost small';
                    btn.textContent = 'Make Facilitator';
                    btn.addEventListener('click', () => {
                        socket && socket.emit('user:addFacilitator', { targetId: u.id });
                    });
                }
                row.appendChild(btn);
            }
            facilitatorsList.appendChild(row);
        });
    }

    // --- Invite modal ---
    const inviteModal = document.getElementById('inviteModal');
    const inviteClose = document.getElementById('inviteClose');
    const inviteUrl = document.getElementById('inviteUrl');
    const inviteCopy = document.getElementById('inviteCopy');
    const inviteQrToggle = document.getElementById('inviteQrToggle');
    const inviteQrWrap = document.getElementById('inviteQrWrap');
    const inviteQrImg = document.getElementById('inviteQrImg');

    function openInvite() {
        inviteUrl.value = location.href;
        inviteQrWrap.classList.add('hidden');
        inviteQrImg.removeAttribute('src');
        inviteQrToggle.textContent = 'QR Code';
        inviteCopy.textContent = 'Copy invitation link';
        inviteModal.classList.remove('hidden');
        setTimeout(() => inviteUrl.select(), 50);
    }
    function closeInvite() { inviteModal.classList.add('hidden'); }

    document.addEventListener('click', (e) => {
        if (e.target && (e.target.id === 'btnInvite' || e.target.id === 'btnInviteMain')) openInvite();
    });
    inviteClose.addEventListener('click', closeInvite);
    inviteModal.addEventListener('click', (e) => { if (e.target === inviteModal) closeInvite(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !inviteModal.classList.contains('hidden')) closeInvite();
    });

    inviteCopy.addEventListener('click', () => {
        const url = inviteUrl.value;
        const done = () => {
            inviteCopy.textContent = 'Link copied!';
            showToast('Invitation link copied to clipboard');
            setTimeout(() => { inviteCopy.textContent = 'Copy invitation link'; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done, () => {
                inviteUrl.select(); document.execCommand && document.execCommand('copy'); done();
            });
        } else {
            inviteUrl.select(); document.execCommand && document.execCommand('copy'); done();
        }
    });

    inviteQrToggle.addEventListener('click', () => {
        if (inviteQrWrap.classList.contains('hidden')) {
            const url = encodeURIComponent(inviteUrl.value);
            inviteQrImg.src = `/api/qr?text=${url}`;
            inviteQrWrap.classList.remove('hidden');
            inviteQrToggle.textContent = 'Hide QR Code';
        } else {
            inviteQrWrap.classList.add('hidden');
            inviteQrToggle.textContent = 'QR Code';
        }
    });

    // Toast helper
    const toastEl = document.getElementById('toast');
    let toastTimer = null;
    function showToast(message) {
        if (!toastEl) return;
        toastEl.textContent = message;
        toastEl.classList.remove('hidden');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2200);
    }
})();
