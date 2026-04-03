        function getWheelAbilityText(roleStr, player = null) {
            if ((player && isTravelerPlayer(player)) || isTravelerRole(roleStr)) {
                const preset = player ? findTravelerPresetByName(getTravelerName(player)) : null;
                const wheelText = preset?.wheel || travelerRoleTexts.wheel;
                const camp = player ? getTravelerCampValue(player) : 'undecided';
                return camp === 'undecided' ? wheelText : `${wheelText}·${getTravelerCampLabel(camp)}`;
            }
            return getCurrentWheelAbilityMap()[normalizeRoleName(roleStr)] || '待定';
        }
        function getRoleBasicPlay(roleStr, player = null) {
            if ((player && isTravelerPlayer(player)) || isTravelerRole(roleStr)) return travelerRoleTexts.basic;
            return getCurrentRoleBasicMap()[normalizeRoleName(roleStr)] || '先把自己的身份信息和站边逻辑说清，再根据局势慢慢推进。';
        }
        function getRoleAdvancedPlay(roleStr, player = null) {
            if ((player && isTravelerPlayer(player)) || isTravelerRole(roleStr)) return travelerRoleTexts.advanced;
            return getCurrentRoleAdvancedMap()[normalizeRoleName(roleStr)] || '进阶打法重点在于控制信息节奏，并让自己的发言和票型能持续服务胜利条件。';
        }
        function updatePlayerListLayoutUi() {
            const toolbar = document.getElementById('playerListToolbar');
            const btn = document.getElementById('playerListLayoutBtn');
            const tip = document.getElementById('playerListLayoutTip');
            const list = document.getElementById('playerList');
            if (!toolbar || !btn || !tip || !list) return;
            toolbar.style.display = players.length ? 'grid' : 'none';
            list.classList.remove('single-column', 'double-column');
            list.classList.add(playerListLayout === 'double' ? 'double-column' : 'single-column');
            btn.innerText = playerListLayout === 'double' ? '🧾 角色栏：双栏' : '🧾 角色栏：单栏';
            btn.classList.toggle('double', playerListLayout === 'double');
            tip.innerText = playerListLayout === 'double' ? '当前为双栏视图。' : '当前为单栏视图。';
        }
        function togglePlayerListLayout() {
            playerListLayout = playerListLayout === 'double' ? 'single' : 'double';
            saveData();
            updatePlayerListLayoutUi();
        }
        function normalizeScoreBoardEntry(entry) {
            if (typeof entry === 'number') {
                const legacyPoints = Math.max(0, Math.round(entry));
                return { points: legacyPoints, wins: legacyPoints, games: legacyPoints, seasonMvp: 0 };
            }
            const normalized = {
                points: Math.max(0, Math.round(Number(entry?.points ?? entry?.score ?? 0) || 0)),
                wins: Math.max(0, Math.round(Number(entry?.wins ?? 0) || 0)),
                games: Math.max(0, Math.round(Number(entry?.games ?? 0) || 0)),
                seasonMvp: Math.max(0, Math.round(Number(entry?.seasonMvp ?? entry?.mvpCount ?? entry?.mvp ?? 0) || 0))
            };
            if (normalized.games < normalized.wins) normalized.games = normalized.wins;
            return normalized;
        }
        function hasScoreBoardActivity(entry) {
            return !!entry && (entry.points > 0 || entry.wins > 0 || entry.games > 0 || entry.seasonMvp > 0);
        }
        function normalizeScoreBoardData(data) {
            return Object.entries(data || {}).reduce((acc, [name, entry]) => {
                const normalized = normalizeScoreBoardEntry(entry);
                if (hasScoreBoardActivity(normalized)) acc[name] = normalized;
                return acc;
            }, {});
        }
        function ensureScoreBoardEntry(name) {
            if (!name) return null;
            const normalized = normalizeScoreBoardEntry(scoreBoard[name]);
            scoreBoard[name] = normalized;
            return normalized;
        }
        function cleanupScoreBoardEntry(name) {
            if (!name || !(name in scoreBoard)) return;
            if (!hasScoreBoardActivity(scoreBoard[name])) delete scoreBoard[name];
        }
        function getScoreBoardWinRate(entry) {
            return entry && entry.games > 0 ? entry.wins / entry.games : 0;
        }
        function formatScoreBoardWinRate(entry) {
            return `${Math.round(getScoreBoardWinRate(entry) * 100)}%`;
        }
        function compareScoreBoardEntries([nameA, entryA], [nameB, entryB]) {
            const winRateDiff = getScoreBoardWinRate(entryB) - getScoreBoardWinRate(entryA);
            return (entryB.points - entryA.points)
                || winRateDiff
                || (entryB.wins - entryA.wins)
                || (entryB.games - entryA.games)
                || nameA.localeCompare(nameB, 'zh-CN');
        }
        function getSortedScoreBoardEntries() {
            scoreBoard = normalizeScoreBoardData(scoreBoard);
            return Object.entries(scoreBoard).sort(compareScoreBoardEntries);
        }
        function isSameCompetitiveStanding(entryA, entryB) {
            if (!entryA || !entryB) return false;
            return entryA.points === entryB.points
                && entryA.wins === entryB.wins
                && entryA.games === entryB.games
                && Math.abs(getScoreBoardWinRate(entryA) - getScoreBoardWinRate(entryB)) < 0.000001;
        }
        function getCurrentMvpEntries() {
            const eligibleEntries = getSortedScoreBoardEntries().filter(([, entry]) => entry.games >= COMPETITIVE_MVP_MIN_GAMES);
            if (!eligibleEntries.length) return [];
            const topEntry = eligibleEntries[0][1];
            return eligibleEntries.filter(([, entry]) => isSameCompetitiveStanding(entry, topEntry));
        }
        function getCurrentMvpNames() {
            return getCurrentMvpEntries().map(([name]) => name).sort((a, b) => a.localeCompare(b, 'zh-CN'));
        }
        function getCurrentMvpWinCount() {
            const currentMvpEntries = getCurrentMvpEntries();
            return currentMvpEntries.length ? currentMvpEntries[0][1].wins : 0;
        }
        function getValiantEntries(sortedEntries, excludedNames = []) {
            const excludedSet = new Set((excludedNames || []).filter(Boolean));
            const candidates = (sortedEntries || []).filter(([name]) => !excludedSet.has(name));
            if (!candidates.length) return [];
            const topEntry = candidates[0][1];
            return candidates.filter(([, entry]) => isSameCompetitiveStanding(entry, topEntry));
        }
        function clearFinalMvpAward() {
            if (!finalMvp) return;
            finalMvp.split('、').filter(Boolean).forEach(name => {
                const entry = ensureScoreBoardEntry(name);
                if (!entry) return;
                entry.seasonMvp = Math.max(0, entry.seasonMvp - 1);
                cleanupScoreBoardEntry(name);
            });
            finalMvp = '';
        }
        function applyFinalMvpAward(names) {
            const nextNames = Array.isArray(names) ? names.filter(Boolean) : [];
            const prevNames = finalMvp ? finalMvp.split('、').filter(Boolean) : [];
            const prevSet = new Set(prevNames);
            const nextSet = new Set(nextNames);
            prevNames.forEach(name => {
                if (nextSet.has(name)) return;
                const entry = ensureScoreBoardEntry(name);
                if (!entry) return;
                entry.seasonMvp = Math.max(0, entry.seasonMvp - 1);
                cleanupScoreBoardEntry(name);
            });
            nextNames.forEach(name => {
                if (prevSet.has(name)) return;
                const entry = ensureScoreBoardEntry(name);
                if (!entry) return;
                entry.seasonMvp += 1;
            });
            finalMvp = nextNames.join('、');
        }
        function renderScoreBoard() {
            const list = document.getElementById('scoreBoardList');
            const summary = document.getElementById('seriesSummary');
            const mvpSummary = document.getElementById('mvpSummary');
            if (!list || !summary || !mvpSummary) return;
            const entries = getSortedScoreBoardEntries();
            const currentMvpNames = getCurrentMvpNames();
            list.innerHTML = entries.length
                ? entries.map(([name, entry], index) => {
                    const encodedName = encodeURIComponent(name);
                    return `
                        <div class="scoreboard-item">
                            <div class="scoreboard-main">
                                <div class="scoreboard-rank">#${index + 1}</div>
                                <div class="scoreboard-text">
                                    <span class="scoreboard-name">${escapeHtml(name)}</span>
                                    <div class="scoreboard-meta">
                                        <span class="score-stat">胜场 ${entry.wins}</span>
                                        <span class="score-stat">出场 ${entry.games}</span>
                                        <span class="score-stat">胜率 ${formatScoreBoardWinRate(entry)}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="scoreboard-controls">
                                <button type="button" class="score-adjust-btn minus" onclick="adjustPlayerScore(decodeURIComponent('${encodedName}'), -1)">-</button>
                                <span class="scoreboard-score">${entry.points} 分</span>
                                <button type="button" class="score-adjust-btn plus" onclick="adjustPlayerScore(decodeURIComponent('${encodedName}'), 1)">+</button>
                            </div>
                        </div>
                    `;
                }).join('')
                : '<div class="score-empty">暂无记分记录。</div>';
            summary.innerText = `已记录 ${seriesGames} 局，当前共有 ${entries.length} 名玩家进入榜单。赛季 MVP 至少需出场 ${COMPETITIVE_MVP_MIN_GAMES} 局。`;
            mvpSummary.innerText = `当前赛季 MVP：${finalMvp || (currentMvpNames.length ? currentMvpNames.join('、') : `未产生（至少 ${COMPETITIVE_MVP_MIN_GAMES} 局）`)}`;
        }
        function addScoreToPlayer(name, amount = 1) {
            const entry = ensureScoreBoardEntry(name);
            if (!entry) return;
            entry.points = Math.max(0, entry.points + amount);
            cleanupScoreBoardEntry(name);
        }
        function adjustPlayerScore(name, delta) {
            if (!name || !delta) return;
            clearFinalMvpAward();
            addScoreToPlayer(name, delta);
            saveData();
            renderScoreBoard();
        }
        function getPlayersEligibleForScore() {
            return players.filter(player => {
                const roleName = normalizeRoleName(player.role);
                if (roleName === '❓ 未分配') return false;
                if (isTravelerPlayer(player)) return getTravelerCampValue(player) !== 'undecided';
                return true;
            });
        }
        function recordCampWin(camp) {
            if (!players.length) return alert('请先布置本局玩家和身份。');
            const participants = getPlayersEligibleForScore();
            const winners = participants.filter(player => isPlayerOnCamp(player, camp));
            if (!winners.length) return alert('当前没有可计分的胜利阵营玩家。');
            clearFinalMvpAward();
            participants.forEach(player => {
                const entry = ensureScoreBoardEntry(player.name);
                if (entry) entry.games += 1;
            });
            winners.forEach(player => {
                const entry = ensureScoreBoardEntry(player.name);
                if (!entry) return;
                entry.wins += 1;
                entry.points += 1;
            });
            seriesGames += 1;
            saveData();
            renderScoreBoard();
        }
        function clearScoreBoard() {
            scoreBoard = {};
            seriesGames = 0;
            finalMvp = '';
            saveData();
            renderScoreBoard();
        }
        function finalizeSeriesMvp() {
            const currentMvpEntries = getCurrentMvpEntries();
            if (!currentMvpEntries.length) return alert(`当前还没有达到 ${COMPETITIVE_MVP_MIN_GAMES} 局参评门槛的玩家。`);
            const currentMvpNames = currentMvpEntries.map(([name]) => name);
            const mvpWinCount = getCurrentMvpWinCount();
            const sortedEntries = getSortedScoreBoardEntries();
            const valiantEntries = getValiantEntries(sortedEntries, currentMvpNames);
            applyFinalMvpAward(currentMvpNames);
            saveData();
            renderScoreBoard();
            const canvas = createMvpAwardCanvas(currentMvpNames, mvpWinCount, seriesGames, sortedEntries, valiantEntries.map(([name]) => name));
            if (!canvas) {
                alert(`本轮赛季 MVP：${finalMvp}`);
                return;
            }
            canvasToBlob(canvas).then(blob => {
                if (!blob) {
                    alert(`本轮赛季 MVP：${finalMvp}`);
                    return;
                }
                const fileName = `${sanitizeFileName(getCurrentScriptDisplayName())}_${sanitizeFileName(finalMvp)}_赛季结算图.png`;
                openRoleCardPreviewModal(canvas, blob, fileName, {
                    title: '赛季结算图',
                    subtitle: '手机上可长按下方荣誉图保存到相册，或直接使用系统分享。',
                    shareTitle: '赛季结算图',
                    shareLabel: '📤 系统分享赛季结算图',
                    downloadLabel: '⬇️ 下载赛季结算图'
                });
            });
        }
        function migratePlayerScoreName(oldName, newName) {
            if (!oldName || !newName || oldName === newName || !(oldName in scoreBoard)) return;
            const oldEntry = normalizeScoreBoardEntry(scoreBoard[oldName]);
            const newEntry = normalizeScoreBoardEntry(scoreBoard[newName]);
            scoreBoard[newName] = {
                points: newEntry.points + oldEntry.points,
                wins: newEntry.wins + oldEntry.wins,
                games: newEntry.games + oldEntry.games,
                seasonMvp: newEntry.seasonMvp + oldEntry.seasonMvp
            };
            delete scoreBoard[oldName];
            if (finalMvp) {
                finalMvp = finalMvp
                    .split('、')
                    .filter(Boolean)
                    .map(name => name === oldName ? newName : name)
                    .join('、');
            }
        }
        function wrapProfileText(ctx, text, maxWidth) {
            const lines = [];
            `${text || ''}`.split('\n').forEach((paragraph, paragraphIndex, paragraphs) => {
                let currentLine = '';
                Array.from(paragraph || ' ').forEach(char => {
                    const testLine = currentLine + char;
                    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
                        lines.push(currentLine);
                        currentLine = char;
                    } else {
                        currentLine = testLine;
                    }
                });
                lines.push(currentLine || ' ');
                if (paragraphIndex < paragraphs.length - 1) lines.push('');
            });
            return lines;
        }
        function canvasToBlob(canvas) {
            return new Promise(resolve => {
                if (!canvas) {
                    resolve(null);
                    return;
                }
                canvas.toBlob(blob => resolve(blob), 'image/png');
            });
        }
        function sanitizeFileName(name) {
            return `${name || 'role-profile'}`
                .replace(/[\\/:*?"<>|]/g, '_')
                .replace(/\s+/g, '_');
        }
        function downloadRoleProfileImage(blob, fileName) {
            if (!blob) return false;
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            return true;
        }
        function canShareRoleCard(blob, fileName) {
            if (!blob || !navigator.share || typeof File === 'undefined') return false;
            try {
                const file = new File([blob], fileName || 'role-card.png', { type: 'image/png' });
                return typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : true;
            } catch (error) {
                return false;
            }
        }
        function closeRoleCardPreviewModal() {
            const modal = document.getElementById('roleCardPreviewModal');
            if (modal) modal.style.display = 'none';
        }
        function openRoleCardPreviewModal(canvas, blob, fileName, options = {}) {
            if (!canvas || !blob) return false;
            latestRoleCardBlob = blob;
            latestRoleCardFileName = fileName || 'role-card.png';
            latestPreviewShareTitle = options.shareTitle || '角色卡';
            const modal = document.getElementById('roleCardPreviewModal');
            const image = document.getElementById('roleCardPreviewImage');
            const tip = document.getElementById('roleCardPreviewTip');
            const title = document.getElementById('roleCardPreviewTitle');
            const subtitle = document.getElementById('roleCardPreviewSubtitle');
            const shareBtn = document.getElementById('roleCardShareBtn');
            const downloadBtn = document.getElementById('roleCardDownloadBtn');
            if (!modal || !image || !tip || !title || !subtitle || !shareBtn || !downloadBtn) return false;
            title.innerText = options.title || '角色卡预览';
            subtitle.innerText = options.subtitle || '手机上若无法直接复制图片，可长按下方图片保存到相册。';
            shareBtn.innerText = options.shareLabel || '📤 系统分享角色卡';
            downloadBtn.innerText = options.downloadLabel || '⬇️ 下载角色卡图片';
            image.src = canvas.toDataURL('image/png');
            const shareAvailable = canShareRoleCard(blob, latestRoleCardFileName);
            shareBtn.style.display = shareAvailable ? 'inline-flex' : 'none';
            tip.innerText = shareAvailable
                ? '可直接系统分享；如果分享不可用，也可以长按图片保存到相册。'
                : '当前环境更适合长按图片保存到相册，或点击下载角色卡图片。';
            modal.style.display = 'flex';
            return true;
        }
        async function shareLatestRoleCard() {
            if (!canShareRoleCard(latestRoleCardBlob, latestRoleCardFileName)) {
                alert('当前浏览器不支持系统分享图片，请长按图片保存或使用下载按钮。');
                return;
            }
            try {
                const file = new File([latestRoleCardBlob], latestRoleCardFileName || 'role-card.png', { type: 'image/png' });
                await navigator.share({
                    title: latestPreviewShareTitle || '角色卡',
                    files: [file]
                });
            } catch (error) {
                if (error && error.name !== 'AbortError') {
                    alert('系统分享失败，请长按图片保存或使用下载按钮。');
                }
            }
        }
        function downloadLatestRoleCard() {
            if (!latestRoleCardBlob) return;
            downloadRoleProfileImage(latestRoleCardBlob, latestRoleCardFileName || 'role-card.png');
        }
        function drawRoundedRect(ctx, x, y, width, height, radius) {
            const r = Math.min(radius, width / 2, height / 2);
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + width - r, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + r);
            ctx.lineTo(x + width, y + height - r);
            ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
            ctx.lineTo(x + r, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        }
        function wrapRoleCardText(ctx, text, maxWidth) {
            const lines = [];
            const stickyPunctuation = new Set(Array.from('，。！？；：、）》」』】）,.!?;:'));
            `${text || ''}`.split('\n').forEach((paragraph, paragraphIndex, paragraphs) => {
                const source = Array.from(`${paragraph || ''}`.trim() || ' ');
                let currentLine = '';
                source.forEach(char => {
                    const testLine = currentLine + char;
                    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
                        if (stickyPunctuation.has(char)) {
                            lines.push(testLine);
                            currentLine = '';
                        } else {
                            lines.push(currentLine);
                            currentLine = char;
                        }
                    } else {
                        currentLine = testLine;
                    }
                });
                lines.push(currentLine || ' ');
                if (paragraphIndex < paragraphs.length - 1) lines.push('');
            });
            return lines;
        }
        function isMobileLikeDevice() {
            return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
                || !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        }
        function isWeChatBrowser() {
            return /MicroMessenger/i.test(navigator.userAgent || '');
        }
        function getRoleCardPalette(roleName) {
            switch (getRoleCategory(roleName)) {
                case 'Townsfolk':
                    return {
                        accent: '#c8a86a',
                        accentSoft: '#8e7446',
                        bgTop: '#251a1f',
                        bgMid: '#151014',
                        bgBottom: '#0c0a0c',
                        glowA: 'rgba(197, 165, 106, 0.16)',
                        glowB: 'rgba(131, 83, 34, 0.10)',
                        sectionFill: 'rgba(80, 58, 32, 0.18)',
                        sectionEdge: 'rgba(197, 165, 106, 0.22)',
                        hookFill: 'rgba(92, 70, 36, 0.18)',
                        hookEdge: 'rgba(197, 165, 106, 0.22)',
                        badgeFill: 'rgba(197, 165, 106, 0.14)',
                        badgeText: '#e0c58f',
                        body: '#eadfce',
                        bodyDim: '#cdbda7',
                        rune: 'rgba(222, 190, 124, 0.88)',
                        runeGlow: 'rgba(197, 165, 106, 0.18)'
                    };
                case 'Outsider':
                    return {
                        accent: '#96a8bc',
                        accentSoft: '#64778b',
                        bgTop: '#1d1c22',
                        bgMid: '#121116',
                        bgBottom: '#0b0a0d',
                        glowA: 'rgba(124, 148, 176, 0.16)',
                        glowB: 'rgba(83, 102, 126, 0.10)',
                        sectionFill: 'rgba(70, 84, 103, 0.17)',
                        sectionEdge: 'rgba(129, 150, 176, 0.22)',
                        hookFill: 'rgba(73, 89, 108, 0.18)',
                        hookEdge: 'rgba(129, 150, 176, 0.22)',
                        badgeFill: 'rgba(124, 148, 176, 0.16)',
                        badgeText: '#d5dfeb',
                        body: '#e5edf3',
                        bodyDim: '#bdcad7',
                        rune: 'rgba(177, 197, 219, 0.9)',
                        runeGlow: 'rgba(124, 148, 176, 0.18)'
                    };
                case 'Traveler':
                    return {
                        accent: '#b7c9db',
                        accentSoft: '#748ca3',
                        bgTop: '#1a1f27',
                        bgMid: '#12151b',
                        bgBottom: '#0a0c10',
                        glowA: 'rgba(148, 176, 205, 0.18)',
                        glowB: 'rgba(76, 98, 122, 0.12)',
                        sectionFill: 'rgba(54, 71, 90, 0.20)',
                        sectionEdge: 'rgba(136, 165, 194, 0.22)',
                        hookFill: 'rgba(64, 81, 101, 0.18)',
                        hookEdge: 'rgba(136, 165, 194, 0.22)',
                        badgeFill: 'rgba(148, 176, 205, 0.15)',
                        badgeText: '#e2eef7',
                        body: '#e8eef2',
                        bodyDim: '#c2ced8',
                        rune: 'rgba(188, 210, 230, 0.92)',
                        runeGlow: 'rgba(148, 176, 205, 0.2)'
                    };
                case 'Minion':
                    return {
                        accent: '#c45d70',
                        accentSoft: '#7d3140',
                        bgTop: '#27151a',
                        bgMid: '#170e12',
                        bgBottom: '#0c090c',
                        glowA: 'rgba(173, 67, 90, 0.18)',
                        glowB: 'rgba(107, 26, 41, 0.12)',
                        sectionFill: 'rgba(101, 28, 41, 0.18)',
                        sectionEdge: 'rgba(181, 79, 101, 0.22)',
                        hookFill: 'rgba(116, 30, 48, 0.20)',
                        hookEdge: 'rgba(181, 79, 101, 0.24)',
                        badgeFill: 'rgba(173, 67, 90, 0.17)',
                        badgeText: '#f1c9d0',
                        body: '#f0ddd8',
                        bodyDim: '#d9beb8',
                        rune: 'rgba(220, 127, 146, 0.9)',
                        runeGlow: 'rgba(173, 67, 90, 0.22)'
                    };
                case 'Demon':
                    return {
                        accent: '#ddb16e',
                        accentSoft: '#8b392d',
                        bgTop: '#2a1717',
                        bgMid: '#170d10',
                        bgBottom: '#0c090b',
                        glowA: 'rgba(221, 177, 110, 0.18)',
                        glowB: 'rgba(139, 57, 45, 0.14)',
                        sectionFill: 'rgba(113, 54, 32, 0.20)',
                        sectionEdge: 'rgba(221, 177, 110, 0.24)',
                        hookFill: 'rgba(133, 56, 37, 0.22)',
                        hookEdge: 'rgba(221, 177, 110, 0.26)',
                        badgeFill: 'rgba(221, 177, 110, 0.16)',
                        badgeText: '#f3ddae',
                        body: '#f3e4d4',
                        bodyDim: '#dcc5af',
                        rune: 'rgba(240, 200, 125, 0.92)',
                        runeGlow: 'rgba(221, 177, 110, 0.24)'
                    };
                default:
                    return {
                        accent: '#c8a86a',
                        accentSoft: '#8e7446',
                        bgTop: '#24181d',
                        bgMid: '#151014',
                        bgBottom: '#0b090b',
                        glowA: 'rgba(197, 165, 106, 0.14)',
                        glowB: 'rgba(123, 43, 56, 0.08)',
                        sectionFill: 'rgba(78, 55, 31, 0.16)',
                        sectionEdge: 'rgba(197, 165, 106, 0.18)',
                        hookFill: 'rgba(92, 70, 36, 0.16)',
                        hookEdge: 'rgba(197, 165, 106, 0.20)',
                        badgeFill: 'rgba(197, 165, 106, 0.14)',
                        badgeText: '#e0c58f',
                        body: '#eadfce',
                        bodyDim: '#cdbda7',
                        rune: 'rgba(222, 190, 124, 0.84)',
                        runeGlow: 'rgba(197, 165, 106, 0.18)'
                    };
            }
        }
        function getRoleCardHook(roleName) {
            const source = `${getRoleBasicPlay(roleName) || getCurrentRoleAbilities()[roleName] || ''}`
                .replace(/\s+/g, '')
                .trim();
            if (!source) return '核心价值仍待本局命运揭示。';
            const sentence = source.split(/[。！？；]/)[0] || source;
            let brief = sentence.split(/[，、]/)[0] || sentence;
            if (brief.length < 12 && sentence.length > brief.length) brief = sentence;
            if (brief.length > 26) brief = `${brief.slice(0, 24)}…`;
            return /[。！？…]$/.test(brief) ? brief : `${brief}。`;
        }
        function drawRoleCardEmblem(ctx, category, centerX, centerY, radius, palette) {
            ctx.save();
            ctx.translate(centerX, centerY);

            const outerGlow = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius * 1.2);
            outerGlow.addColorStop(0, palette.runeGlow);
            outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = outerGlow;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 1.15, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = palette.rune;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.82;

            if (category === 'Townsfolk') {
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI / 4) * i;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(angle) * radius * 0.18, Math.sin(angle) * radius * 0.18);
                    ctx.lineTo(Math.cos(angle) * radius * 0.78, Math.sin(angle) * radius * 0.78);
                    ctx.stroke();
                }
                ctx.beginPath();
                ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
                ctx.stroke();
            } else if (category === 'Outsider') {
                ctx.beginPath();
                ctx.arc(-radius * 0.08, 0, radius * 0.42, Math.PI * 0.3, Math.PI * 1.7);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(0,0,0,0.45)';
                ctx.beginPath();
                ctx.arc(radius * 0.10, 0, radius * 0.34, Math.PI * 0.32, Math.PI * 1.68);
                ctx.stroke();
                ctx.strokeStyle = palette.rune;
                ctx.beginPath();
                ctx.arc(0, 0, radius * 0.68, Math.PI * 0.18, Math.PI * 0.82);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(radius * 0.56, -radius * 0.18, radius * 0.06, 0, Math.PI * 2);
                ctx.fillStyle = palette.rune;
                ctx.fill();
            } else if (category === 'Minion') {
                ctx.beginPath();
                ctx.moveTo(0, -radius * 0.62);
                ctx.lineTo(radius * 0.46, 0);
                ctx.lineTo(0, radius * 0.62);
                ctx.lineTo(-radius * 0.46, 0);
                ctx.closePath();
                ctx.stroke();
                ctx.beginPath();
                ctx.ellipse(0, 0, radius * 0.34, radius * 0.2, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, -radius * 0.12);
                ctx.lineTo(0, radius * 0.12);
                ctx.stroke();
            } else if (category === 'Demon') {
                ctx.beginPath();
                ctx.moveTo(-radius * 0.42, -radius * 0.02);
                ctx.quadraticCurveTo(-radius * 0.68, -radius * 0.58, -radius * 0.2, -radius * 0.78);
                ctx.moveTo(radius * 0.42, -radius * 0.02);
                ctx.quadraticCurveTo(radius * 0.68, -radius * 0.58, radius * 0.2, -radius * 0.78);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, radius * 0.08, radius * 0.34, Math.PI * 0.05, Math.PI * 0.95);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(-radius * 0.22, radius * 0.1);
                ctx.lineTo(0, radius * 0.48);
                ctx.lineTo(radius * 0.22, radius * 0.1);
                ctx.stroke();
            } else if (category === 'Traveler') {
                ctx.beginPath();
                ctx.arc(0, 0, radius * 0.42, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, -radius * 0.72);
                ctx.lineTo(0, radius * 0.72);
                ctx.moveTo(-radius * 0.72, 0);
                ctx.lineTo(radius * 0.72, 0);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, -radius * 0.72);
                ctx.lineTo(-radius * 0.12, -radius * 0.46);
                ctx.lineTo(radius * 0.12, -radius * 0.46);
                ctx.closePath();
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(radius * 0.72, 0);
                ctx.lineTo(radius * 0.46, -radius * 0.12);
                ctx.lineTo(radius * 0.46, radius * 0.12);
                ctx.closePath();
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(-radius * 0.48, -radius * 0.48);
                ctx.lineTo(radius * 0.48, radius * 0.48);
                ctx.moveTo(radius * 0.48, -radius * 0.48);
                ctx.lineTo(-radius * 0.48, radius * 0.48);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, radius * 0.24, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.restore();
        }
        function getMvpHonorTitle(winCount, nameCount) {
            if (nameCount > 1) return '并列星冕';
            if (winCount >= 8) return '烛夜王冕';
            if (winCount >= 5) return '审判冠冕';
            if (winCount >= 3) return '夜宴主宰';
            return '新月之星';
        }
        function drawMvpCrown(ctx, centerX, centerY, scale = 1) {
            ctx.save();
            ctx.translate(centerX, centerY);

            const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 120 * scale);
            glow.addColorStop(0, 'rgba(245, 218, 145, 0.34)');
            glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, 0, 118 * scale, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 246, 214, 0.18)';
            ctx.lineWidth = 1.5 * scale;
            ctx.beginPath();
            ctx.arc(0, 0, 102 * scale, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = 'rgba(111, 42, 57, 0.72)';
            ctx.strokeStyle = '#e1bb72';
            ctx.lineWidth = 5 * scale;
            ctx.beginPath();
            ctx.moveTo(-92 * scale, 38 * scale);
            ctx.lineTo(-92 * scale, 14 * scale);
            ctx.lineTo(-58 * scale, -40 * scale);
            ctx.lineTo(-18 * scale, 0);
            ctx.lineTo(0, -66 * scale);
            ctx.lineTo(18 * scale, 0);
            ctx.lineTo(58 * scale, -40 * scale);
            ctx.lineTo(92 * scale, 14 * scale);
            ctx.lineTo(92 * scale, 38 * scale);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#f3dca0';
            [[-58, -42], [0, -68], [58, -42]].forEach(([x, y]) => {
                ctx.beginPath();
                ctx.arc(x * scale, y * scale, 8 * scale, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.fillStyle = 'rgba(197, 165, 106, 0.18)';
            drawRoundedRect(ctx, -104 * scale, 34 * scale, 208 * scale, 34 * scale, 16 * scale);
            ctx.fill();
            ctx.strokeStyle = 'rgba(225, 187, 114, 0.5)';
            ctx.lineWidth = 3 * scale;
            ctx.stroke();

            ctx.fillStyle = '#f6ebc9';
            ctx.beginPath();
            ctx.arc(0, 52 * scale, 12 * scale, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
        function truncateCanvasText(ctx, text, maxWidth) {
            const source = `${text || ''}`;
            if (!source) return '';
            if (ctx.measureText(source).width <= maxWidth) return source;
            let output = source;
            while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) {
                output = output.slice(0, -1);
            }
            return `${output}…`;
        }
        function createMvpAwardCanvas(mvpNames, winCount, totalGames, rankedEntries = [], valiantNames = []) {
            const names = Array.isArray(mvpNames) ? mvpNames.filter(Boolean) : [];
            if (!names.length) return null;
            const portrait = isMobileLikeDevice();
            const width = portrait ? 980 : 1220;
            const paddingX = portrait ? 64 : 86;
            const topPad = portrait ? 64 : 78;
            const contentWidth = width - paddingX * 2;
            const honorTitle = getMvpHonorTitle(winCount, names.length);
            const nameFontSize = portrait ? 46 : 54;
            const bodyFontSize = portrait ? 24 : 28;
            const bodyLineHeight = portrait ? 34 : 38;
            const sectionGap = portrait ? 16 : 18;
            const headerTitleSize = portrait ? 54 : 66;
            const rowHeight = portrait ? 72 : 64;
            const boardHeaderHeight = 54;
            const nameBlock = names.join(' / ');
            const sortedEntries = Array.isArray(rankedEntries) && rankedEntries.length ? rankedEntries : getSortedScoreBoardEntries();
            const valiantList = Array.isArray(valiantNames) ? valiantNames.filter(Boolean) : [];
            const valiantBlock = valiantList.join(' / ');
            const mvpSet = new Set(names);
            const valiantSet = new Set(valiantList);
            const summaryLines = [
                `胜利局数  ${winCount} 局`,
                `记录局数  ${totalGames} 局`,
                names.length > 1 ? '本赛季由多位玩家并列摘得 MVP 冠冕。' : '本赛季由这位玩家摘得唯一 MVP 冠冕。',
                valiantList.length ? `虽败犹荣：${valiantBlock}` : '本赛季未产生“虽败犹荣”称号。'
            ];

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            ctx.font = `${nameFontSize}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
            const nameLines = wrapRoleCardText(ctx, nameBlock, contentWidth - 64);
            ctx.font = `${bodyFontSize}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
            const infoLines = summaryLines.flatMap((line, index) => {
                const wrapped = wrapRoleCardText(ctx, line, contentWidth - 64);
                if (index < summaryLines.length - 1) wrapped.push('');
                return wrapped;
            });

            let height = topPad + 220;
            height += nameLines.reduce((sum, line) => sum + (line === '' ? 16 : nameFontSize + 10), 0);
            height += 240;
            height += infoLines.reduce((sum, line) => sum + (line === '' ? 18 : bodyLineHeight), 0);
            height += 60;
            height += boardHeaderHeight + 26;
            height += sortedEntries.length * (rowHeight + 10);
            height += 96;

            canvas.width = width;
            canvas.height = height;
            ctx.clearRect(0, 0, width, height);

            const bg = ctx.createLinearGradient(0, 0, 0, height);
            bg.addColorStop(0, '#2b171b');
            bg.addColorStop(0.42, '#140d10');
            bg.addColorStop(1, '#09080a');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, width, height);

            const radial = ctx.createRadialGradient(width * 0.5, topPad + 60, 30, width * 0.5, topPad + 120, width * 0.72);
            radial.addColorStop(0, 'rgba(224, 184, 103, 0.28)');
            radial.addColorStop(0.4, 'rgba(123, 43, 56, 0.18)');
            radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = radial;
            ctx.fillRect(0, 0, width, height);

            ctx.strokeStyle = 'rgba(225, 187, 114, 0.46)';
            ctx.lineWidth = 2;
            ctx.strokeRect(22, 22, width - 44, height - 44);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.strokeRect(36, 36, width - 72, height - 72);

            for (let i = 0; i < width; i += 36) {
                ctx.strokeStyle = i % 72 === 0 ? 'rgba(255,255,255,0.012)' : 'rgba(255,255,255,0.006)';
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(0, i);
                ctx.stroke();
            }

            ctx.fillStyle = '#cdbda7';
            ctx.font = '20px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif';
            ctx.fillText('血染钟楼 · 赛季终局', paddingX, topPad);

            ctx.textAlign = 'right';
            ctx.fillStyle = '#d7c097';
            ctx.fillText(`${getCurrentScriptDisplayName()} · 第 ${Math.max(totalGames, 1)} 局封卷`, width - paddingX, topPad);
            ctx.textAlign = 'left';

            drawMvpCrown(ctx, width / 2, topPad + 92, portrait ? 0.8 : 0.9);

            ctx.fillStyle = '#f7e9cf';
            ctx.font = `${headerTitleSize}px "Georgia", "Noto Serif SC", serif`;
            ctx.textAlign = 'center';
            ctx.fillText('赛季结算', width / 2, topPad + 188);

            ctx.font = `${portrait ? 22 : 24}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
            drawRoundedRect(ctx, width / 2 - 150, topPad + 206, 300, 42, 21);
            ctx.fillStyle = 'rgba(197, 165, 106, 0.16)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(225, 187, 114, 0.34)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.fillStyle = '#f0d7a0';
            ctx.fillText(`${honorTitle} · 闪耀称号`, width / 2, topPad + 234);

            const nameCardY = topPad + 276;
            drawRoundedRect(ctx, paddingX, nameCardY, contentWidth, 120 + nameLines.length * (nameFontSize + 6), 28);
            ctx.fillStyle = 'rgba(61, 24, 31, 0.56)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(197, 165, 106, 0.22)';
            ctx.lineWidth = 1.4;
            ctx.stroke();

            ctx.fillStyle = '#c5a56a';
            ctx.font = '600 24px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif';
            ctx.textAlign = 'left';
            ctx.fillText('获奖玩家', paddingX + 28, nameCardY + 36);

            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(paddingX + 28, nameCardY + 54);
            ctx.lineTo(width - paddingX - 28, nameCardY + 54);
            ctx.stroke();

            ctx.fillStyle = '#f4eadc';
            ctx.font = `600 ${nameFontSize}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
            ctx.textAlign = 'center';
            let nameY = nameCardY + 104;
            nameLines.forEach(line => {
                if (line === '') {
                    nameY += 16;
                    return;
                }
                ctx.fillText(line, width / 2, nameY);
                nameY += nameFontSize + 10;
            });

            const summaryY = nameCardY + 148 + nameLines.length * (nameFontSize + 6);
            const summaryHeight = 194 + Math.max(0, infoLines.length - 4) * 10;
            drawRoundedRect(ctx, paddingX, summaryY, contentWidth, summaryHeight, 26);
            ctx.fillStyle = 'rgba(25, 21, 27, 0.68)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(197, 165, 106, 0.18)';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            const chipY = summaryY + 28;
            const chipWidth = (contentWidth - 52) / 3;
            [['胜利局数', `${winCount} 局`], ['赛季总局数', `${totalGames} 局`], ['参评门槛', `${COMPETITIVE_MVP_MIN_GAMES} 局`]].forEach(([label, value], index) => {
                const chipX = paddingX + 18 + index * (chipWidth + 8);
                drawRoundedRect(ctx, chipX, chipY, chipWidth, 74, 22);
                ctx.fillStyle = index === 0 ? 'rgba(116, 41, 56, 0.5)' : index === 1 ? 'rgba(69, 51, 31, 0.5)' : 'rgba(42, 58, 76, 0.46)';
                ctx.fill();
                ctx.strokeStyle = index === 0 ? 'rgba(193, 98, 118, 0.26)' : index === 1 ? 'rgba(225, 187, 114, 0.24)' : 'rgba(123, 144, 167, 0.26)';
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.fillStyle = '#cdbda7';
                ctx.font = '18px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif';
                ctx.textAlign = 'left';
                ctx.fillText(label, chipX + 18, chipY + 28);
                ctx.fillStyle = '#f6e3b1';
                ctx.font = '600 28px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif';
                ctx.fillText(value, chipX + 18, chipY + 58);
            });

            ctx.fillStyle = '#d9c8af';
            ctx.font = `${bodyFontSize}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
            ctx.textAlign = 'left';
            let infoY = chipY + 120;
            infoLines.forEach(line => {
                if (line === '') {
                    infoY += sectionGap;
                    return;
                }
                ctx.fillText(line, paddingX + 24, infoY);
                infoY += bodyLineHeight;
            });

            const boardY = summaryY + summaryHeight + 34;
            drawRoundedRect(ctx, paddingX, boardY, contentWidth, boardHeaderHeight + sortedEntries.length * (rowHeight + 10) + 28, 26);
            ctx.fillStyle = 'rgba(14, 12, 16, 0.76)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(197, 165, 106, 0.18)';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.fillStyle = '#f6e3b1';
            ctx.font = `600 ${portrait ? 28 : 30}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
            ctx.textAlign = 'left';
            ctx.fillText('全员战绩结算', paddingX + 24, boardY + 36);

            const headerY = boardY + 56;
            const tableLeft = paddingX + 24;
            const tableRight = width - paddingX - 24;
            const rankX = tableLeft + 10;
            const nameX = tableLeft + 92;
            const pointsX = tableRight - (portrait ? 264 : 292);
            const winsX = tableRight - (portrait ? 188 : 208);
            const gamesX = tableRight - (portrait ? 118 : 126);
            const rateX = tableRight - 12;

            ctx.fillStyle = '#a99c90';
            ctx.font = `600 ${portrait ? 18 : 19}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
            ctx.fillText('排名', rankX, headerY);
            ctx.fillText('玩家', nameX, headerY);
            ctx.textAlign = 'right';
            ctx.fillText('积分', pointsX, headerY);
            ctx.fillText('胜场', winsX, headerY);
            ctx.fillText('出场', gamesX, headerY);
            ctx.fillText('胜率', rateX, headerY);
            ctx.textAlign = 'left';

            let rowY = headerY + 18;
            sortedEntries.forEach(([playerName, entry], index) => {
                const isMvp = mvpSet.has(playerName);
                const isValiant = !isMvp && valiantSet.has(playerName);
                drawRoundedRect(ctx, tableLeft - 4, rowY, contentWidth - 40, rowHeight, 20);
                ctx.fillStyle = isMvp
                    ? 'rgba(105, 61, 26, 0.66)'
                    : isValiant
                        ? 'rgba(33, 51, 71, 0.62)'
                        : index % 2 === 0
                            ? 'rgba(39, 28, 33, 0.68)'
                            : 'rgba(23, 19, 23, 0.64)';
                ctx.fill();
                ctx.strokeStyle = isMvp
                    ? 'rgba(225, 187, 114, 0.42)'
                    : isValiant
                        ? 'rgba(123, 144, 167, 0.34)'
                        : 'rgba(255, 255, 255, 0.05)';
                ctx.lineWidth = 1;
                ctx.stroke();

                drawRoundedRect(ctx, rankX - 4, rowY + 14, 46, 30, 15);
                ctx.fillStyle = isMvp ? 'rgba(132, 92, 41, 0.9)' : isValiant ? 'rgba(56, 78, 108, 0.86)' : 'rgba(59, 45, 31, 0.72)';
                ctx.fill();
                ctx.fillStyle = '#f7e9cf';
                ctx.font = `600 ${portrait ? 17 : 18}px "Georgia", "Noto Serif SC", serif`;
                ctx.textAlign = 'center';
                ctx.fillText(`#${index + 1}`, rankX + 19, rowY + 35);

                if (isMvp || isValiant) {
                    const tagText = isMvp ? 'MVP' : '虽败犹荣';
                    ctx.font = `600 ${portrait ? 15 : 16}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
                    const tagWidth = ctx.measureText(tagText).width + 24;
                    const tagX = rateX - tagWidth - 8;
                    drawRoundedRect(ctx, tagX, rowY + 12, tagWidth, 28, 14);
                    ctx.fillStyle = isMvp ? 'rgba(160, 112, 52, 0.96)' : 'rgba(74, 108, 151, 0.92)';
                    ctx.fill();
                    ctx.fillStyle = '#fff5de';
                    ctx.fillText(tagText, tagX + tagWidth / 2, rowY + 31);
                }

                ctx.textAlign = 'left';
                ctx.fillStyle = isMvp ? '#fff3d2' : isValiant ? '#d9e6f2' : '#f2eadc';
                ctx.font = `600 ${portrait ? 22 : 23}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
                ctx.fillText(truncateCanvasText(ctx, playerName, pointsX - nameX - 26), nameX, rowY + 31);

                ctx.fillStyle = isMvp ? '#f4dd9d' : isValiant ? '#bad0e8' : '#a99c90';
                ctx.font = `${portrait ? 14 : 15}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
                ctx.fillText(`竞技积分榜`, nameX, rowY + 52);

                ctx.textAlign = 'right';
                ctx.fillStyle = isMvp ? '#ffe5ab' : '#f0d7a0';
                ctx.font = `600 ${portrait ? 22 : 24}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
                ctx.fillText(`${entry.points}`, pointsX, rowY + 34);
                ctx.fillStyle = '#d7c7b3';
                ctx.font = `${portrait ? 20 : 22}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
                ctx.fillText(`${entry.wins}`, winsX, rowY + 34);
                ctx.fillText(`${entry.games}`, gamesX, rowY + 34);
                ctx.fillText(formatScoreBoardWinRate(entry), rateX, rowY + 34);
                ctx.textAlign = 'left';

                rowY += rowHeight + 10;
            });

            ctx.fillStyle = 'rgba(245, 218, 145, 0.88)';
            ctx.font = '20px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif';
            ctx.textAlign = 'center';
            ctx.fillText('荣耀封存于烛火与审判之间', width / 2, height - 44);

            return canvas;
        }
        function createRoleProfileCanvasV2(player) {
            if (!player) return null;
            const roleName = normalizeRoleName(player.role);
            const isTraveler = isTravelerPlayer(player);
            const parts = `${roleName}`.split('：');
            const travelerCampLabel = getTravelerCampValue(player) === 'undecided' ? '' : ` · ${getTravelerCampLabel(player)}`;
            const categoryLabel = isTraveler ? `旅行者${travelerCampLabel}` : (parts.length > 1 ? parts[0] : '身份');
            const shortRoleName = isTraveler ? getTravelerName(player) : (parts.length > 1 ? parts[1] : roleName);
            const roleIcon = getRoleIcon(roleName, player);
            const scriptName = getCurrentScriptDisplayName();
            const palette = getRoleCardPalette(roleName);
            const portrait = isMobileLikeDevice();
            const width = portrait ? 860 : 1120;
            const paddingX = portrait ? 60 : 74;
            const topPad = portrait ? 62 : 56;
            const contentWidth = width - paddingX * 2;
            const bodyFontSize = portrait ? 28 : 24;
            const bodyLineHeight = portrait ? 40 : 34;
            const sectionLabelSize = portrait ? 24 : 22;
            const sectionPadX = portrait ? 26 : 28;
            const sectionPadY = portrait ? 22 : 20;
            const emblemRadius = portrait ? 88 : 98;
            const sections = [
                { label: '技能', text: getPlayerAbilityText(player) },
                { label: '初级玩法', text: getRoleBasicPlay(roleName, player) },
                { label: '进阶玩法', text: getRoleAdvancedPlay(roleName, player) }
            ];

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            ctx.font = `${bodyFontSize}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
            const sectionData = sections.map(section => ({
                ...section,
                lines: wrapRoleCardText(ctx, section.text, contentWidth - sectionPadX * 2)
            }));

            const headerHeight = portrait ? 248 : 214;
            let height = topPad + headerHeight + 24;
            sectionData.forEach(section => {
                height += 36 + sectionPadY * 2;
                height += section.lines.reduce((sum, line) => sum + (line === '' ? 16 : bodyLineHeight), 0);
                height += 22;
            });
            height += 38;

            canvas.width = width;
            canvas.height = height;
            ctx.clearRect(0, 0, width, height);

            const background = ctx.createLinearGradient(0, 0, 0, height);
            background.addColorStop(0, palette.bgTop);
            background.addColorStop(0.56, palette.bgMid);
            background.addColorStop(1, palette.bgBottom);
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, width, height);

            const topGlow = ctx.createRadialGradient(width * 0.52, topPad * 0.2, 30, width * 0.54, topPad + 30, width * 0.68);
            topGlow.addColorStop(0, palette.glowA);
            topGlow.addColorStop(0.45, palette.glowB);
            topGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = topGlow;
            ctx.fillRect(0, 0, width, height);

            ctx.strokeStyle = 'rgba(197, 165, 106, 0.34)';
            ctx.lineWidth = 2;
            ctx.strokeRect(18, 18, width - 36, height - 36);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.strokeRect(30, 30, width - 60, height - 60);

            for (let i = 0; i < width; i += 32) {
                ctx.strokeStyle = i % 64 === 0 ? 'rgba(255,255,255,0.012)' : 'rgba(255,255,255,0.006)';
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(0, i);
                ctx.stroke();
            }

            const emblemX = width - paddingX - emblemRadius * 0.86;
            const emblemY = topPad + (portrait ? 88 : 80);
            drawRoleCardEmblem(ctx, getRoleCategory(roleName), emblemX, emblemY, emblemRadius, palette);

            ctx.fillStyle = '#a99c90';
            ctx.font = '18px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif';
            ctx.fillText(`剧本  ${scriptName}`, paddingX, topPad);

            ctx.fillStyle = palette.bodyDim;
            ctx.textAlign = 'right';
            ctx.fillText(`座位  ${player.name || getDefaultSeatName(player.id)}`, width - paddingX, topPad);
            ctx.textAlign = 'left';

            ctx.fillStyle = '#f4eadc';
            ctx.font = `${portrait ? 64 : 58}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
            ctx.fillText(`${roleIcon} ${shortRoleName}`, paddingX, topPad + 82);

            ctx.font = '20px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif';
            const badgeText = ` ${categoryLabel} `;
            const badgeWidth = ctx.measureText(badgeText).width + 34;
            ctx.fillStyle = palette.badgeFill;
            drawRoundedRect(ctx, paddingX, topPad + 106, badgeWidth, 38, 19);
            ctx.fill();
            ctx.strokeStyle = palette.sectionEdge;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = palette.badgeText;
            ctx.fillText(badgeText, paddingX + 16, topPad + 131);

            const dividerY = topPad + headerHeight - 20;
            const hookFontSize = bodyFontSize;
            const hookLineHeight = bodyLineHeight;
            const hookLines = [];
            const hookHeight = -22;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.moveTo(paddingX, dividerY);
            ctx.lineTo(width - paddingX, dividerY);
            ctx.stroke();

            let y = topPad + headerHeight;
            ctx.globalAlpha = 0;

            ctx.fillStyle = palette.accent;
            ctx.font = '600 20px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif';
            ctx.fillText('核心卖点', paddingX + 20, y + 32);

            ctx.fillStyle = palette.body;
            ctx.font = `${hookFontSize}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
            let innerY = y + 68;
            hookLines.forEach(line => {
                if (line === '') {
                    innerY += 18;
                    return;
                }
                ctx.fillText(line, paddingX + 20, innerY);
                innerY += hookLineHeight;
            });
            y += hookHeight + 22;
            ctx.globalAlpha = 1;

            sectionData.forEach(section => {
                const sectionHeight = 34 + sectionPadY * 2 + section.lines.reduce((sum, line) => sum + (line === '' ? 16 : bodyLineHeight), 0);
                ctx.fillStyle = palette.sectionFill;
                drawRoundedRect(ctx, paddingX, y, contentWidth, sectionHeight, 24);
                ctx.fill();
                ctx.strokeStyle = palette.sectionEdge;
                ctx.lineWidth = 1.2;
                ctx.stroke();

                ctx.fillStyle = palette.accent;
                ctx.font = `600 ${sectionLabelSize}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
                ctx.fillText(section.label, paddingX + sectionPadX, y + 34);

                ctx.strokeStyle = 'rgba(255,255,255,0.06)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(paddingX + sectionPadX, y + 50);
                ctx.lineTo(width - paddingX - sectionPadX, y + 50);
                ctx.stroke();

                ctx.fillStyle = palette.body;
                ctx.font = `${bodyFontSize}px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
                let textY = y + 88;
                section.lines.forEach(line => {
                    if (line === '') {
                        textY += 16;
                        return;
                    }
                    ctx.fillText(line, paddingX + sectionPadX, textY);
                    textY += bodyLineHeight;
                });

                y += sectionHeight + 22;
            });

            return canvas;
        }
        function createRoleProfileCanvas(player) {
            if (!player) return null;
            const roleName = normalizeRoleName(player.role);
            const roleParts = `${roleName}`.split('：');
            const category = isTravelerPlayer(player) ? '旅行者' : (roleParts.length > 1 ? roleParts[0] : '身份');
            const shortRoleName = isTravelerPlayer(player) ? getTravelerName(player) : (roleParts.length > 1 ? roleParts[1] : roleName);
            const roleIcon = getRoleIcon(roleName, player);
            const scriptName = getCurrentScriptDisplayName();
            const sections = [
                { label: '技能', text: getPlayerAbilityText(player) },
                { label: '初级玩法', text: getRoleBasicPlay(roleName, player) },
                { label: '进阶玩法', text: getRoleAdvancedPlay(roleName, player) }
            ];
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            const width = 920;
            const paddingX = 68;
            const contentWidth = width - paddingX * 2;
            ctx.font = '28px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif';
            const sectionData = sections.map(section => ({
                ...section,
                lines: wrapProfileText(ctx, section.text, contentWidth - 16)
            }));

            let height = 170;
            sectionData.forEach(section => {
                height += 42;
                height += section.lines.reduce((sum, line) => sum + (line === '' ? 16 : 36), 0);
                height += 20;
            });
            height += 24;

            canvas.width = width;
            canvas.height = height;
            ctx.clearRect(0, 0, width, height);

            const background = ctx.createLinearGradient(0, 0, 0, height);
            background.addColorStop(0, '#1d1418');
            background.addColorStop(0.55, '#120e11');
            background.addColorStop(1, '#0b090b');
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, width, height);

            const glow = ctx.createRadialGradient(width * 0.5, 0, 40, width * 0.5, height * 0.2, width * 0.75);
            glow.addColorStop(0, 'rgba(197, 165, 106, 0.16)');
            glow.addColorStop(0.45, 'rgba(123, 43, 56, 0.08)');
            glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, width, height);

            ctx.strokeStyle = 'rgba(197, 165, 106, 0.42)';
            ctx.lineWidth = 2;
            ctx.strokeRect(18, 18, width - 36, height - 36);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.strokeRect(28, 28, width - 56, height - 56);

            ctx.fillStyle = '#a99c90';
            ctx.font = '18px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif';
            ctx.fillText(`剧本  ${scriptName}`, paddingX, 64);

            ctx.fillStyle = '#7c8996';
            ctx.textAlign = 'right';
            ctx.fillText(`座位  ${player.name}`, width - paddingX, 64);
            ctx.textAlign = 'left';

            ctx.fillStyle = '#f2eadc';
            ctx.font = '600 52px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif';
            ctx.fillText(`${roleIcon} ${shortRoleName}`, paddingX, 128);

            const badgeText = ` ${category} `;
            ctx.font = '20px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif';
            const badgeWidth = ctx.measureText(badgeText).width + 28;
            ctx.fillStyle = 'rgba(197, 165, 106, 0.14)';
            drawRoundedRect(ctx, paddingX, 146, badgeWidth, 34, 17);
            ctx.fill();
            ctx.strokeStyle = 'rgba(197, 165, 106, 0.28)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = '#d7c097';
            ctx.fillText(badgeText, paddingX + 14, 169);

            let y = 224;
            sectionData.forEach(section => {
                ctx.fillStyle = '#c5a56a';
                ctx.font = '600 24px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif';
                ctx.fillText(section.label, paddingX, y);
                y += 18;

                ctx.strokeStyle = 'rgba(197, 165, 106, 0.14)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(paddingX, y + 10);
                ctx.lineTo(width - paddingX, y + 10);
                ctx.stroke();
                y += 32;

                ctx.fillStyle = '#e7ded1';
                ctx.font = '28px "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif';
                section.lines.forEach(line => {
                    if (line === '') {
                        y += 16;
                        return;
                    }
                    ctx.fillText(line, paddingX, y);
                    y += 36;
                });
                y += 14;
            });

            return canvas;
        }
        function fallbackCopyText(text) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            textarea.style.pointerEvents = 'none';
            document.body.appendChild(textarea);
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length);
            let succeeded = false;
            try {
                succeeded = document.execCommand('copy');
            } catch (error) {
                succeeded = false;
            }
            document.body.removeChild(textarea);
            return succeeded;
        }
        async function copyRoleProfile(id, options = {}) {
            const player = players.find(item => item.id === id);
            if (!player) return;
            const roleName = normalizeRoleName(player.role);
            const roleLabel = getPlayerRoleLabel(player);
            const copyText = [
                `角色名：${roleLabel}`,
                `技能：${getPlayerAbilityText(player)}`,
                `初级玩法：${getRoleBasicPlay(roleName, player)}`,
                `进阶玩法：${getRoleAdvancedPlay(roleName, player)}`
            ].join('\n');
            const canvas = createRoleProfileCanvasV2(player);
            const imageBlob = await canvasToBlob(canvas);
            const scriptNameForFile = getCurrentScriptDisplayName();
            const imageFileName = `${sanitizeFileName(scriptNameForFile)}_${sanitizeFileName(roleLabel)}_角色卡.png`;
            const isMobileLike = isMobileLikeDevice();
            const preferWeChatPreview = !!options.preferWeChatPreview;
            if (imageBlob && isMobileLike) {
                if (preferWeChatPreview && isWeChatBrowser() && openRoleCardPreviewModal(canvas, imageBlob, imageFileName, {
                    title: '微信角色卡预览',
                    subtitle: '现在请直接长按下方角色卡图片，使用微信原生菜单转发给朋友。',
                    shareLabel: '📤 系统分享角色卡',
                    downloadLabel: '⬇️ 下载角色卡图片'
                })) {
                    return;
                }
                if (canShareRoleCard(imageBlob, imageFileName)) {
                    try {
                        const file = new File([imageBlob], imageFileName, { type: 'image/png' });
                        await navigator.share({
                            title: `${roleLabel} 角色卡`,
                            files: [file]
                        });
                        return;
                    } catch (error) {
                        if (error?.name === 'AbortError') return;
                    }
                }
                if (downloadRoleProfileImage(imageBlob, imageFileName)) {
                    alert('已直接为你保存/下载角色卡图片。');
                    return;
                }
                if (openRoleCardPreviewModal(canvas, imageBlob, imageFileName)) return;
            }

            if (imageBlob && navigator.clipboard && window.isSecureContext && typeof ClipboardItem !== 'undefined') {
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': imageBlob })]);
                    alert('已复制角色资料图片。');
                    return;
                } catch (error) {
                    if (openRoleCardPreviewModal(canvas, imageBlob, imageFileName)) return;
                    // Fall through to file download or text fallback.
                }
            }

            if (imageBlob && downloadRoleProfileImage(imageBlob, imageFileName)) {
                alert('当前环境不支持直接复制图片，已为你下载角色资料图片。');
                return;
            }

            let copied = false;
            if (navigator.clipboard && window.isSecureContext) {
                try {
                    await navigator.clipboard.writeText(copyText);
                    copied = true;
                } catch (error) {
                    copied = fallbackCopyText(copyText);
                }
            } else {
                copied = fallbackCopyText(copyText);
            }
            alert(copied ? '已复制角色资料。' : '复制失败，请重试。');
        }
        function assignSeatName(id, name) {
            const player = players.find(item => item.id === id);
            const cleanName = `${name || ''}`.trim();
            if (!player || !cleanName) return;
            const otherSeat = players.find(item => item.id !== id && item.name === cleanName);
            if (otherSeat) otherSeat.name = getDefaultSeatName(otherSeat.id);
            player.name = cleanName;
            saveData();
            renderAll();
            closeSeatAssignModal();
        }
        function openSeatAssignModal(id) {
            const player = players.find(item => item.id === id);
            if (!player) return;
            activeSeatAssignPlayerId = id;
            const modal = document.getElementById('seatAssignModal');
            const title = document.getElementById('seatAssignTitle');
            const input = document.getElementById('seatAssignInput');
            title.innerText = `${getDefaultSeatName(id)} 修改座位名`;
            input.value = isDefaultSeatName(player.name, player.id) ? '' : player.name;
            modal.style.display = 'flex';
        }
        function closeSeatAssignModal() {
            activeSeatAssignPlayerId = null;
            const modal = document.getElementById('seatAssignModal');
            if (modal) modal.style.display = 'none';
        }
        function applySeatAssignmentFromInput() {
            if (activeSeatAssignPlayerId === null) return;
            const input = document.getElementById('seatAssignInput');
            if (!input) return;
            const name = input.value.trim();
            if (!name) {
                alert('请输入要显示的座位姓名。');
                return;
            }
            assignSeatName(activeSeatAssignPlayerId, name);
        }
        function clearSeatAssignment() {
            if (activeSeatAssignPlayerId === null) return;
            const player = players.find(item => item.id === activeSeatAssignPlayerId);
            if (!player) return;
            player.name = getDefaultSeatName(player.id);
            saveData();
            renderAll();
            closeSeatAssignModal();
        }
        function updateRenameModeUi() {
            const toolbar = document.getElementById('circleToolbar');
            const btn = document.getElementById('renameToggleBtn');
            const tip = document.getElementById('circleToolbarTip');
            if (!toolbar || !btn || !tip) return;
            if (players.length === 0) {
                toolbar.style.display = 'none';
                return;
            }
            toolbar.style.display = 'grid';
            btn.innerText = isRenameMode ? '🪑 入座模式：开启' : '🪑 入座模式：关闭';
            btn.classList.toggle('mode-on', isRenameMode);
            tip.innerText = isRenameMode
                ? '当前点轮盘座位会弹出入座面板，可从已录入名单中选择玩家入座。'
                : '当前短按轮盘座位会打开状态面板；长按座位可直接保存或分享该玩家角色卡。';
        }
        function toggleRenameMode() {
            isRenameMode = !isRenameMode;
            if (isRenameMode) closeSeatTokenModal();
            else closeSeatAssignModal();
            updateRenameModeUi();
        }
        function bindSeatInteractions(seat, playerId) {
            if (!seat) return;
            let pressTimer = null;
            let pressPoint = null;
            let suppressClickUntil = 0;

            const clearPressTimer = () => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            };
            const getPoint = event => {
                if (event.touches && event.touches[0]) return event.touches[0];
                if (event.changedTouches && event.changedTouches[0]) return event.changedTouches[0];
                return event;
            };
            const beginPress = event => {
                if (event.button !== undefined && event.button !== 0) return;
                if (event.touches && event.touches.length > 1) return;
                const point = getPoint(event);
                if (!point) return;
                pressPoint = { x: point.clientX, y: point.clientY };
                clearPressTimer();
                pressTimer = setTimeout(() => {
                    pressTimer = null;
                    pressPoint = null;
                    suppressClickUntil = Date.now() + 900;
                    if (navigator.vibrate) navigator.vibrate(18);
                    copyRoleProfile(playerId, { preferWeChatPreview: true });
                }, SEAT_LONG_PRESS_MS);
            };
            const movePress = event => {
                if (!pressTimer || !pressPoint) return;
                const point = getPoint(event);
                if (!point) return;
                if (Math.abs(point.clientX - pressPoint.x) > 10 || Math.abs(point.clientY - pressPoint.y) > 10) {
                    clearPressTimer();
                    pressPoint = null;
                }
            };
            const endPress = event => {
                clearPressTimer();
                pressPoint = null;
                if (Date.now() < suppressClickUntil && event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            };

            seat.addEventListener('touchstart', beginPress, { passive: true });
            seat.addEventListener('touchmove', movePress, { passive: true });
            seat.addEventListener('touchend', endPress);
            seat.addEventListener('touchcancel', endPress);
            seat.addEventListener('mousedown', beginPress);
            seat.addEventListener('mousemove', movePress);
            seat.addEventListener('mouseup', endPress);
            seat.addEventListener('mouseleave', endPress);
            seat.addEventListener('contextmenu', event => {
                if (Date.now() < suppressClickUntil) event.preventDefault();
            });
            seat.addEventListener('click', event => {
                if (Date.now() < suppressClickUntil) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                handleSeatClick(playerId);
            });
        }
        function handleSeatClick(id) {
            if (isRenameMode) {
                openSeatAssignModal(id);
                return;
            }
            openSeatTokenModal(id);
        }
        function toggleMasterToken(id) {
            const alreadyMaster = players.find(player => player.id === id)?.tokens.includes('👑 主人');
            players.forEach(player => {
                player.tokens = player.tokens.filter(token => token !== '👑 主人' && token !== '👑主人');
            });
            if (!alreadyMaster) {
                const target = players.find(player => player.id === id);
                if (target) target.tokens.push('👑 主人');
            }
        }
        function toggleSeatToken(tokenStr) {
            const player = players.find(item => item.id === activeSeatTokenPlayerId);
            if (!player) return;
            if (tokenStr === '👑 主人') {
                toggleMasterToken(player.id);
            } else {
                const variants = [tokenStr, tokenStr.replace(' ', '')];
                const hasToken = player.tokens.some(token => variants.includes(token));
                player.tokens = player.tokens.filter(token => !variants.includes(token));
                if (!hasToken) player.tokens.push(tokenStr);
            }
            saveData();
            renderAll();
            openSeatTokenModal(player.id);
        }
        function clearSeatMarkers() {
            const player = players.find(item => item.id === activeSeatTokenPlayerId);
            if (!player) return;
            player.tokens = [];
            saveData();
            renderAll();
            openSeatTokenModal(player.id);
        }
        function setSeatDeathState(deathType) {
            const player = players.find(item => item.id === activeSeatTokenPlayerId);
            if (!player) return;
            if (deathType === 'demon' && isProtectedFromDemon(player)) return;
            player.isAlive = false;
            player.hasGhostVote = true;
            player.deathType = deathType;
            saveData();
            renderAll();
            openSeatTokenModal(player.id);
        }
        function reviveSeatFromModal() {
            const player = players.find(item => item.id === activeSeatTokenPlayerId);
            if (!player) return;
            player.isAlive = true;
            player.hasGhostVote = false;
            player.deathType = '';
            saveData();
            renderAll();
            openSeatTokenModal(player.id);
        }
        function openSeatTokenModal(id) {
            const player = players.find(item => item.id === id);
            if (!player) return;
            activeSeatTokenPlayerId = id;
            const modal = document.getElementById('seatTokenModal');
            const title = document.getElementById('seatTokenTitle');
            const grid = document.getElementById('seatTokenGrid');
            const tokenOptions = [
                { token: '🧪 中毒', label: '🧪 中毒' },
                { token: '🍺 醉酒', label: '🍺 醉酒' },
                { token: '🛡️ 保护', label: '🛡️ 保护' },
                { token: '🔮 死敌', label: '🔮 死敌' },
                { token: '👑 主人', label: '👑 主人' },
                { token: '🗳️ 今日投票', label: '🗳️ 今日投票' },
                { token: '📢 今日提名', label: '📢 今日提名' }
            ];
            const demonBlocked = player.isAlive && isProtectedFromDemon(player);
            title.innerText = `${player.name} 的状态标记`;
            const tokenButtons = tokenOptions.map(option => {
                const variants = [option.token, option.token.replace(' ', '')];
                const active = player.tokens.some(token => variants.includes(token));
                return `<button type="button" class="seat-token-btn ${active ? 'active' : ''}" onclick="toggleSeatToken('${option.token}')">${option.label}</button>`;
            }).join('');
            const deathButtons = player.isAlive
                ? `
                    <button type="button" class="seat-token-btn death" onclick="setSeatDeathState('execution')">☠️ 处决</button>
                    <button type="button" class="seat-token-btn demon ${demonBlocked ? 'blocked' : ''}" onclick="${demonBlocked ? '' : "setSeatDeathState('demon')"}" ${demonBlocked ? 'disabled' : ''}>${demonBlocked ? '🗡️ 免疫' : '🗡️ 恶魔刀'}</button>
                `
                : `
                    <button type="button" class="seat-token-btn death ${player.deathType === 'execution' ? 'active' : ''}" onclick="setSeatDeathState('execution')">☠️ 已处决</button>
                    <button type="button" class="seat-token-btn demon ${player.deathType === 'demon' ? 'active' : ''}" onclick="${isProtectedFromDemon(player) ? '' : "setSeatDeathState('demon')"}" ${isProtectedFromDemon(player) ? 'disabled' : ''}>${isProtectedFromDemon(player) ? '🗡️ 免疫' : '🗡️ 恶魔刀'}</button>
                    <button type="button" class="seat-token-btn revive wide" onclick="reviveSeatFromModal()">✨ 复活</button>
                `;
            grid.innerHTML = tokenButtons + deathButtons + `<button type="button" class="seat-token-btn clear" onclick="clearSeatMarkers()">清空状态标记</button>`;
            modal.style.display = 'flex';
        }

        // --- 杂项 ---
        function getRoleCategory(roleStr) {
            if(roleStr.startsWith('镇民')) return 'Townsfolk';
            if(roleStr.startsWith('外来者')) return 'Outsider';
            if(roleStr.startsWith('旅行者')) return 'Traveler';
            if(roleStr.startsWith('爪牙')) return 'Minion';
            if(roleStr.startsWith('恶魔')) return 'Demon';
            return 'Unknown';
        }
        function isEvil(roleStr) { return roleStr.startsWith('爪牙') || roleStr.startsWith('恶魔'); }
        function isTravelerRole(roleStr) {
            return normalizeRoleName(roleStr) === TRAVELER_ROLE || `${roleStr || ''}`.startsWith('旅行者：');
        }
        function isTravelerPlayer(player) {
            return !!player && isTravelerRole(player.role);
        }
        function getTravelerCampValue(player) {
            return travelerCampLabels[player?.travelerCamp] ? player.travelerCamp : 'undecided';
        }
        function getTravelerCampLabel(playerOrValue) {
            const campValue = typeof playerOrValue === 'string' ? playerOrValue : getTravelerCampValue(playerOrValue);
            return travelerCampLabels[campValue] || travelerCampLabels.undecided;
        }
        function getTravelerPresetList(script = selectedScript) {
            return travelerPresets[script] || travelerPresets.tb;
        }
        function findTravelerPresetByName(name, script = selectedScript) {
            return getTravelerPresetList(script).find(preset => preset.name === name) || null;
        }
        function applyTravelerPresetToPlayer(player, presetName, script = selectedScript) {
            if (!player) return;
            const preset = findTravelerPresetByName(presetName, script) || getTravelerPresetList(script)[0];
            if (!preset) return;
            player.role = TRAVELER_ROLE;
            player.travelerName = preset.name;
            player.travelerAbility = preset.ability;
            if (!travelerCampLabels[player.travelerCamp]) player.travelerCamp = 'undecided';
        }
        function getTravelerName(player) {
            const preset = findTravelerPresetByName(`${player?.travelerName || ''}`.trim());
            return preset?.name || `${player?.travelerName || ''}`.trim() || getTravelerPresetList()[0]?.name || '旅行者';
        }
        function getTravelerAbilityText(player) {
            const preset = findTravelerPresetByName(getTravelerName(player));
            return preset?.ability || `${player?.travelerAbility || ''}`.trim() || travelerRoleTexts.ability;
        }
        function getPlayerRoleLabel(player) {
            if (isTravelerPlayer(player)) return `旅行者：${getTravelerName(player)}`;
            return normalizeRoleName(player?.role);
        }
        function getPlayerRoleShortName(player) {
            if (isTravelerPlayer(player)) return getTravelerName(player);
            const roleName = normalizeRoleName(player?.role);
            return roleName === '❓ 未分配' ? '待分配' : (roleName.split('：')[1] || roleName);
        }
        function getPlayerRoleShortNameWithIcon(player) {
            const roleName = normalizeRoleName(player?.role);
            return `${getRoleIcon(roleName, player)} ${getPlayerRoleShortName(player)}`;
        }
        function getPlayerAbilityText(player) {
            if (isTravelerPlayer(player)) return getTravelerAbilityText(player);
            const roleName = normalizeRoleName(player?.role);
            return getCurrentRoleAbilities()[roleName] || '无技能描述';
        }
        function getTravelerSeatStatus(player) {
            if (!player) return '未分配';
            if (isTravelerPlayer(player)) {
                const campText = getTravelerCampValue(player) === 'undecided' ? '' : ` / ${getTravelerCampLabel(player)}`;
                return `旅行者 / ${getTravelerName(player)}${campText}`;
            }
            const roleName = normalizeRoleName(player.role);
            return roleName === '❓ 未分配' ? '未分配' : (roleName.split('：')[1] || roleName);
        }
        function isPlayerOnCamp(player, camp) {
            if (isTravelerPlayer(player)) return getTravelerCampValue(player) === camp;
            const roleName = normalizeRoleName(player.role);
            if (roleName === '❓ 未分配') return false;
            return camp === 'evil' ? isEvil(roleName) : !isEvil(roleName);
        }
        function getDefaultSeatName(id) { return `座位 ${id + 1}`; }
        function isDefaultSeatName(name, id) { return `${name || ''}`.trim() === getDefaultSeatName(id); }
        function escapeHtml(str) {
            return `${str || ''}`
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }
        function tokenVariants(tokenStr) {
            return [tokenStr, tokenStr.replace(' ', '')];
        }
        function hasPlayerToken(player, tokenStr) {
            return tokenVariants(tokenStr).some(token => player.tokens.includes(token));
        }
        function getPlayerImpairment(player) {
            const flags = [];
            if (hasPlayerToken(player, '🧪 中毒')) flags.push('中毒');
            if (hasPlayerToken(player, '🍺 醉酒')) flags.push('醉酒');
            return flags.join(' / ');
        }
        function isPlayerImpaired(player) {
            return !!getPlayerImpairment(player);
        }
        function normalizeRoleName(roleStr) {
            const aliasMap = {
                '镇民：处女': '镇民：贞洁者',
                '镇民：杀手': '镇民：猎人',
                '爪牙：毒药师': '爪牙：投毒者',
                '爪牙：荡妇': '爪牙：红唇女郎',
                '旅行者': TRAVELER_ROLE,
                '镇民：驱魔师': '镇民：驱魔人',
                '镇民：茶女郎': '镇民：茶艺师',
                '外来者：打手': '外来者：莽夫',
                '外来者：隐士': '外来者：陌客',
                '爪牙：黑手党首领': '爪牙：教父',
                '爪牙：恶魔拥护者': '爪牙：魔鬼代言人',
                '爪牙：幕后主谋': '爪牙：主谋',
                '恶魔：丧尸': '恶魔：僵怖',
                '恶魔：纯种恶魔': '恶魔：普卡',
                '恶魔：巨颚': '恶魔：沙巴洛斯',
                '恶魔：恶之花': '恶魔：朴'
            };
            return aliasMap[roleStr] || roleStr || '❓ 未分配';
        }
        function normalizePlayerData(player, index) {
            const roleName = normalizeRoleName(player.role);
            const isTraveler = isTravelerRole(roleName);
            const preset = isTraveler ? findTravelerPresetByName(`${player.travelerName || ''}`.trim()) : null;
            return {
                id: typeof player.id === 'number' ? player.id : index,
                name: player.name || getDefaultSeatName(index),
                role: roleName,
                isAlive: player.isAlive !== false,
                hasGhostVote: !!player.hasGhostVote,
                hasNominated: !!player.hasNominated,
                hasBeenNominated: !!player.hasBeenNominated,
                tokens: Array.isArray(player.tokens) ? player.tokens : [],
                deathType: player.deathType || (player.isAlive === false ? 'execution' : ''),
                travelerName: isTraveler ? (preset?.name || `${player.travelerName || ''}`.trim() || getTravelerPresetList()[0]?.name || '') : '',
                travelerAbility: isTraveler ? (preset?.ability || `${player.travelerAbility || ''}`.trim() || travelerRoleTexts.ability) : '',
                travelerCamp: isTraveler && travelerCampLabels[player.travelerCamp] ? player.travelerCamp : 'undecided'
            };
        }
        function createPlayer(id, preservedName = '') {
            return {
                id,
                name: preservedName || getDefaultSeatName(id),
                role: '❓ 未分配',
                isAlive: true,
                hasGhostVote: false,
                hasNominated: false,
                hasBeenNominated: false,
                tokens: [],
                deathType: '',
                travelerName: '',
                travelerAbility: '',
                travelerCamp: 'undecided'
            };
        }
        function getTravelerEditorPlayer() {
            const seatSelect = document.getElementById('travelerSeatSelect');
            if (!seatSelect || !players.length) return null;
            const travelerId = Number(seatSelect.value);
            return players.find(player => player.id === travelerId) || null;
        }
        function syncTravelerAbilityPreview(selectedTravelerName = '') {
            const roleSelect = document.getElementById('travelerRoleSelect');
            const preview = document.getElementById('travelerAbilityPreview');
            if (!roleSelect || !preview) return;
            const travelerName = selectedTravelerName || roleSelect.value;
            const preset = findTravelerPresetByName(travelerName);
            preview.innerHTML = preset ? `ℹ️ ${preset.ability}` : '请选择官方旅行者角色，技能会在这里显示。';
        }
        function syncTravelerEditorFromSeat() {
            const seatSelect = document.getElementById('travelerSeatSelect');
            const roleSelect = document.getElementById('travelerRoleSelect');
            const campSelect = document.getElementById('travelerCampSelect');
            const hint = document.getElementById('travelerHint');
            const player = getTravelerEditorPlayer();
            const defaultTraveler = getTravelerPresetList()[0];
            if (!seatSelect || !roleSelect || !campSelect || !hint) return;
            if (!player) {
                roleSelect.value = defaultTraveler?.name || '';
                campSelect.value = 'undecided';
                syncTravelerAbilityPreview(roleSelect.value);
                hint.innerText = '旅行者不参与随机发牌，请先布置座位后再从官方列表里选择。';
                return;
            }
            if (isTravelerPlayer(player)) {
                roleSelect.value = getTravelerName(player);
                campSelect.value = getTravelerCampValue(player);
                syncTravelerAbilityPreview(roleSelect.value);
                hint.innerText = `${player.name} 当前已设为旅行者 ${getTravelerName(player)}，可继续调整其阵营。`;
            } else {
                roleSelect.value = defaultTraveler?.name || '';
                campSelect.value = 'undecided';
                syncTravelerAbilityPreview(roleSelect.value);
                hint.innerText = `当前选中 ${player.name}，请选择一个官方旅行者角色。`;
            }
        }
        function initTravelerControls() {
            const seatSelect = document.getElementById('travelerSeatSelect');
            const roleSelect = document.getElementById('travelerRoleSelect');
            const campSelect = document.getElementById('travelerCampSelect');
            const applyBtn = document.getElementById('travelerApplyBtn');
            const clearBtn = document.getElementById('travelerClearBtn');
            const hint = document.getElementById('travelerHint');
            const preview = document.getElementById('travelerAbilityPreview');
            if (!seatSelect || !roleSelect || !campSelect || !applyBtn || !clearBtn || !hint || !preview) return;

            if (!players.length) {
                seatSelect.innerHTML = '<option value="">请先布置座位后再添加旅行者</option>';
                roleSelect.innerHTML = '<option value="">请先选择剧本与座位</option>';
                seatSelect.disabled = true;
                roleSelect.disabled = true;
                campSelect.disabled = true;
                applyBtn.disabled = true;
                clearBtn.disabled = true;
                campSelect.value = 'undecided';
                preview.innerHTML = '请选择官方旅行者角色，技能会在这里显示。';
                hint.innerText = '旅行者不参与随机发牌，请先一键布置并随机发牌。';
                return;
            }

            const previousValue = players.some(player => `${player.id}` === `${seatSelect.value}`) ? seatSelect.value : `${players[0].id}`;
            const previousTraveler = findTravelerPresetByName(roleSelect.value) ? roleSelect.value : '';
            seatSelect.innerHTML = players.map(player => `<option value="${player.id}">${escapeHtml(player.name)} · ${escapeHtml(getTravelerSeatStatus(player))}</option>`).join('');
            roleSelect.innerHTML = getTravelerPresetList().map(preset => `<option value="${preset.name}">${preset.name}</option>`).join('');
            seatSelect.value = previousValue;
            roleSelect.value = previousTraveler || getTravelerPresetList()[0]?.name || '';
            seatSelect.disabled = false;
            roleSelect.disabled = false;
            campSelect.disabled = false;
            applyBtn.disabled = false;
            clearBtn.disabled = false;
            syncTravelerEditorFromSeat();
        }
        function applyTravelerToSelectedSeat() {
            const player = getTravelerEditorPlayer();
            const roleSelect = document.getElementById('travelerRoleSelect');
            const campSelect = document.getElementById('travelerCampSelect');
            if (!player || !roleSelect || !campSelect) return alert('请先布置座位后再添加旅行者。');
            const preset = findTravelerPresetByName(roleSelect.value);
            if (!preset) return alert('请选择一个官方旅行者角色。');
            applyTravelerPresetToPlayer(player, preset.name);
            player.travelerCamp = travelerCampLabels[campSelect.value] ? campSelect.value : 'undecided';
            saveData();
            renderAll();
        }
        function clearTravelerFromSelectedSeat() {
            const player = getTravelerEditorPlayer();
            if (!player) return;
            if (!isTravelerPlayer(player)) {
                syncTravelerEditorFromSeat();
                return;
            }
            player.role = '❓ 未分配';
            player.travelerName = '';
            player.travelerAbility = '';
            player.travelerCamp = 'undecided';
            saveData();
            renderAll();
        }
        function updateTravelerField(id, field, value) {
            const player = players.find(item => item.id === id);
            if (!player || !isTravelerPlayer(player)) return;
            if (field === 'travelerName') applyTravelerPresetToPlayer(player, value);
            if (field === 'travelerCamp') player.travelerCamp = travelerCampLabels[value] ? value : 'undecided';
            saveData();
            renderAll();
        }
        function hasRole(roleStr) {
            return players.some(player => normalizeRoleName(player.role) === roleStr);
        }
        function getSpyPlayer() {
            return players.find(player => normalizeRoleName(player.role) === '爪牙：间谍');
        }
        function hasSpyInPlay() {
            return !!getSpyPlayer();
        }
        function registersAsEvil(player, includeSpyAsEvil = true) {
            const role = normalizeRoleName(player.role);
            if (!includeSpyAsEvil && role === '爪牙：间谍') return false;
            return isEvil(role);
        }
        function getChefPairs(includeSpyAsEvil = true) {
            let pairs = 0;
            for (let i = 0; i < players.length; i++) {
                if (registersAsEvil(players[i], includeSpyAsEvil) && registersAsEvil(players[(i + 1) % players.length], includeSpyAsEvil)) pairs++;
            }
            return pairs;
        }
        function getAliveNeighbors(playerId) {
            const n = players.length;
            const idx = players.findIndex(x => x.id === playerId);
            let left = (idx - 1 + n) % n;
            while (left !== idx && !players[left].isAlive) left = (left - 1 + n) % n;
            let right = (idx + 1) % n;
            while (right !== idx && !players[right].isAlive) right = (right + 1) % n;
            return { left, right };
        }
        function getEmpathCount(playerId, includeSpyAsEvil = true) {
            const idx = players.findIndex(x => x.id === playerId);
            if (idx === -1) return { count: 0, names: [] };
            const { left, right } = getAliveNeighbors(playerId);
            let count = 0;
            const names = [];
            if (left !== idx) {
                names.push(players[left].name);
                if (registersAsEvil(players[left], includeSpyAsEvil)) count++;
            }
            if (right !== idx) {
                names.push(players[right].name);
                if (registersAsEvil(players[right], includeSpyAsEvil)) count++;
            }
            return { count, names };
        }
        function getCircularPlayersBetween(firstId, secondId) {
            const total = players.length;
            const firstIndex = players.findIndex(player => player.id === firstId);
            const secondIndex = players.findIndex(player => player.id === secondId);
            if (firstIndex === -1 || secondIndex === -1 || firstIndex === secondIndex || total < 2) return 0;
            const clockwise = (secondIndex - firstIndex - 1 + total) % total;
            const counterClockwise = (firstIndex - secondIndex - 1 + total) % total;
            return Math.min(clockwise, counterClockwise);
        }
        function getClockmakerReading() {
            const demons = players.filter(player => getRoleCategory(normalizeRoleName(player.role)) === 'Demon');
            const minions = players.filter(player => getRoleCategory(normalizeRoleName(player.role)) === 'Minion');
            if (!demons.length || !minions.length) return null;
            let best = null;
            demons.forEach(demon => {
                minions.forEach(minion => {
                    const count = getCircularPlayersBetween(demon.id, minion.id);
                    if (!best || count < best.count) {
                        best = { count, demon, minion };
                    }
                });
            });
            return best;
        }
        function getOracleReading() {
            const evilDeadPlayers = players.filter(player => !player.isAlive && isPlayerOnCamp(player, 'evil'));
            return {
                count: evilDeadPlayers.length,
                names: evilDeadPlayers.map(player => player.name)
            };
        }
        function didDemonVoteToday() {
            const votedDemons = players.filter(player => getRoleCategory(normalizeRoleName(player.role)) === 'Demon' && hasPlayerToken(player, '🗳️ 今日投票'));
            return {
                result: votedDemons.length > 0,
                names: votedDemons.map(player => player.name)
            };
        }
        function didMinionNominateToday() {
            const nominatingMinions = players.filter(player => getRoleCategory(normalizeRoleName(player.role)) === 'Minion' && hasPlayerToken(player, '📢 今日提名'));
            return {
                result: nominatingMinions.length > 0,
                names: nominatingMinions.map(player => player.name)
            };
        }
        function getAvailableGoodBluffs() {
            const activeRoles = players.map(player => normalizeRoleName(player.role));
            const activePoolGood = getCurrentPoolGood();
            const source = players.length > 0 ? activePoolGood.filter(role => !activeRoles.includes(role)) : [...activePoolGood];
            return shuffle([...source]);
        }
        function isProtectedFromDemon(player) {
            return normalizeRoleName(player.role) === '镇民：士兵' || hasPlayerToken(player, '🛡️ 保护');
        }
        function getLibrarianTargets(currentPlayerId) {
            const targets = [];
            const seen = new Set();
            players.forEach(player => {
                if (player.id === currentPlayerId) return;
                let revealRole = '';
                if (hasPlayerToken(player, '🍺 醉酒')) revealRole = '外来者：酒鬼';
                else if (getRoleCategory(normalizeRoleName(player.role)) === 'Outsider') revealRole = normalizeRoleName(player.role);
                if (!revealRole) return;
                const key = `${player.id}|${revealRole}`;
                if (seen.has(key)) return;
                seen.add(key);
                targets.push({ id: player.id, name: player.name, role: normalizeRoleName(player.role), revealRole });
            });
            return targets;
        }
        function getNonTargetDecoys(currentPlayerId, excludedIds, predicate) {
            let decoys = players.filter(player => player.id !== currentPlayerId && !excludedIds.includes(player.id) && predicate(player));
            if (!decoys.length) decoys = players.filter(player => player.id !== currentPlayerId && !excludedIds.includes(player.id));
            return decoys;
        }
        function randomizeBluffs() {
            const pool = getAvailableGoodBluffs();
            bluffs = [pool[0] || '❓ 未分配', pool[1] || '❓ 未分配', pool[2] || '❓ 未分配'];
            initBluffSelects();
            saveData();
        }
        function getSeatBadgesHtml(player) {
            const badgeMap = {
                __execution: { icon: '☠️', className: 'execution' },
                __demonDeath: { icon: '🗡️', className: 'demon-death' },
                '🧪 中毒': { icon: '🧪', className: 'poison' },
                '🧪中毒': { icon: '🧪', className: 'poison' },
                '🍺 醉酒': { icon: '🍺', className: 'drunk' },
                '🍺醉酒': { icon: '🍺', className: 'drunk' },
                '🛡️ 保护': { icon: '🛡️', className: 'protect' },
                '🛡️保护': { icon: '🛡️', className: 'protect' },
                '🔮 死敌': { icon: '🔮', className: 'rival' },
                '🔮死敌': { icon: '🔮', className: 'rival' },
                '👑 主人': { icon: '👑', className: 'master' },
                '👑主人': { icon: '👑', className: 'master' },
                '🗳️ 今日投票': { icon: '🗳️', className: 'vote' },
                '🗳️今日投票': { icon: '🗳️', className: 'vote' },
                '📢 今日提名': { icon: '📢', className: 'nominate' },
                '📢今日提名': { icon: '📢', className: 'nominate' }
            };
            const badges = [];
            if (player.deathType === 'execution') badges.push(badgeMap.__execution);
            if (player.deathType === 'demon') badges.push(badgeMap.__demonDeath);
            badges.push(...player.tokens
                .map(token => badgeMap[token])
                .filter(Boolean));
            const visibleBadges = badges.slice(0, 5);
            if (!visibleBadges.length) return '';
            return `<div class="seat-badges">${visibleBadges.map(badge => `<div class="seat-badge ${badge.className}">${badge.icon}</div>`).join('')}</div>`;
        }
        function renderRevealButton(roleStr) {
            const shortRole = roleStr.split('：')[1] || roleStr;
            const escapedRole = roleStr.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            return `<button type="button" class="inline-reveal-btn" onclick="showRoleRevealModal('${escapedRole}')">[${shortRole}]</button>`;
        }
        function renderSuggestionBox(title, options) {
            return `
                <div class="ai-suggestion">
                    <div class="ai-suggestion-title">${title}</div>
                    ${options.map((option, index) => `<div class="ai-option"><b>${index + 1}.</b> ${option}</div>`).join('')}
                </div>
            `;
        }
        function buildRevealOptions(targets, decoys, currentPlayerId, limit = 4) {
            const options = [];
            const seen = new Set();
            targets.slice(0, 4).forEach(target => {
                const revealRole = target.revealRole || target.role;
                decoys.slice(0, 6).forEach(decoy => {
                    if (target.id === decoy.id || decoy.id === currentPlayerId) return;
                    const key = `${revealRole}|${target.id}|${decoy.id}`;
                    if (seen.has(key) || options.length >= limit) return;
                    seen.add(key);
                    options.push(`向其展示 ${renderRevealButton(revealRole)}，并指向 <b>[${target.name}]</b> 和 <b>[${decoy.name}]</b>。`);
                });
            });
            return options;
        }
        function getAlternativeCount(realValue, minValue, maxValue) {
            for (const delta of [1, -1, 2, -2]) {
                const candidate = realValue + delta;
                if (candidate >= minValue && candidate <= maxValue) return candidate;
            }
            return realValue === minValue ? maxValue : minValue;
        }
        function getAlternativeCountExcluding(realValue, minValue, maxValue, exclusions = []) {
            for (const delta of [1, -1, 2, -2, 3, -3]) {
                const candidate = realValue + delta;
                if (candidate >= minValue && candidate <= maxValue && !exclusions.includes(candidate)) return candidate;
            }
            for (let candidate = minValue; candidate <= maxValue; candidate++) {
                if (!exclusions.includes(candidate)) return candidate;
            }
            return realValue;
        }
        function pickFalseReveal(rolePool, currentPlayerId) {
            const normalizedRoles = players.map(player => normalizeRoleName(player.role));
            const fakeRole = rolePool.find(role => !normalizedRoles.includes(role))
                || rolePool.find(role => players.filter(player => player.id !== currentPlayerId && normalizeRoleName(player.role) !== role).length >= 2)
                || rolePool[0];
            if (!fakeRole) return null;
            let falseTargets = players.filter(player => player.id !== currentPlayerId && normalizeRoleName(player.role) !== fakeRole);
            if (falseTargets.length < 2) falseTargets = players.filter(player => player.id !== currentPlayerId);
            if (falseTargets.length < 2) return null;
            return { fakeRole, falseTargets: falseTargets.slice(0, 2) };
        }
        function getRoleRecommendationData(roleStr, currentPlayer) {
            if (roleStr === '镇民：图书管理员') {
                const targets = getLibrarianTargets(currentPlayer.id);
                const decoys = getNonTargetDecoys(currentPlayer.id, targets.map(target => target.id), player => !hasPlayerToken(player, '🍺 醉酒') && getRoleCategory(normalizeRoleName(player.role)) !== 'Outsider');
                if (targets.length > 0 && decoys.length > 0) {
                    return { title: '💡 推荐指引：可从下面几组中任选一组展示。', options: buildRevealOptions(targets, decoys, currentPlayer.id) };
                }
                return { title: '💡 提示', options: [`当前无外来者或无法构成有效两人组，请直接比出 <b>0</b> 的手势。`] };
            }
            if (roleStr === '镇民：洗衣妇') {
                const targets = players
                    .filter(player => getRoleCategory(normalizeRoleName(player.role)) === 'Townsfolk' && player.id !== currentPlayer.id)
                    .map(player => ({ ...player, revealRole: normalizeRoleName(player.role) }));
                const decoys = getNonTargetDecoys(currentPlayer.id, targets.map(target => target.id), player => getRoleCategory(normalizeRoleName(player.role)) !== 'Townsfolk');
                if (targets.length > 0 && decoys.length > 0) {
                    return { title: '💡 推荐指引：可从下面几组中任选一组展示。', options: buildRevealOptions(targets, decoys, currentPlayer.id) };
                }
            }
            if (roleStr === '镇民：调查员') {
                const targets = players
                    .filter(player => getRoleCategory(normalizeRoleName(player.role)) === 'Minion')
                    .map(player => ({ ...player, revealRole: normalizeRoleName(player.role) }));
                const decoys = getNonTargetDecoys(currentPlayer.id, targets.map(target => target.id), player => getRoleCategory(normalizeRoleName(player.role)) !== 'Minion');
                if (targets.length > 0 && decoys.length > 0) {
                    return { title: '💡 推荐指引：可从下面几组中任选一组展示。', options: buildRevealOptions(targets, decoys, currentPlayer.id) };
                }
            }
            if (roleStr === '镇民：厨师') {
                const realPairs = getChefPairs(true);
                if (hasSpyInPlay()) {
                    const spyPairs = getChefPairs(false);
                    return {
                        title: '💡 计算结果',
                        options: realPairs === spyPairs
                            ? [`场上邪恶邻座共有 <b>${realPairs}</b> 对。间谍在本局不会改变厨师读数。`]
                            : [`真实值为 <b>${realPairs}</b> 对。`, `若让间谍按善良注册，可给出 <b>${spyPairs}</b> 对。`]
                    };
                }
                return { title: '💡 计算结果', options: [`场上邪恶邻座共有 <b>${realPairs}</b> 对。`] };
            }
            if (roleStr === '镇民：共情者') {
                const real = getEmpathCount(currentPlayer.id, true);
                if (hasSpyInPlay()) {
                    const spy = getEmpathCount(currentPlayer.id, false);
                    return {
                        title: '💡 计算结果',
                        options: real.count === spy.count
                            ? [`存活邻座 [${real.names.join('] 和 [')}]，邪恶共有 <b>${real.count}</b> 人。间谍在本局不会改变共情者读数。`]
                            : [`存活邻座 [${real.names.join('] 和 [')}]，真实值为 <b>${real.count}</b>。`, `若让间谍按善良注册，可给出 <b>${spy.count}</b>。`]
                    };
                }
                return { title: '💡 计算结果', options: [`存活邻座 [${real.names.join('] 和 [')}]，邪恶共有 <b>${real.count}</b> 人。`] };
            }
            if (roleStr === '镇民：钟表匠') {
                const reading = getClockmakerReading();
                if (!reading) return { title: '💡 计算结果', options: ['当前缺少恶魔或爪牙，暂时无法计算钟表匠读数。'] };
                const options = [`最近的一组为恶魔 <b>[${reading.demon.name}]</b> 与爪牙 <b>[${reading.minion.name}]</b>，中间相隔 <b>${reading.count}</b> 人。`];
                if (hasRole('恶魔：涡流')) {
                    const fakeCount = getAlternativeCountExcluding(reading.count, 0, Math.max(0, Math.floor((players.length - 2) / 2)), [reading.count]);
                    options.push(`若按涡流给假信息，可改报 <b>${fakeCount}</b>。`);
                }
                return { title: '💡 计算结果', options };
            }
            if (roleStr === '镇民：卖花女孩') {
                const reading = didDemonVoteToday();
                const options = [reading.result
                    ? `按当前标记，恶魔 <b>[${reading.names.join(']、[')}]</b> 今天投过票，应向其 <b>点头</b>。`
                    : '按当前标记，恶魔今天没有投票，应向其 <b>摇头</b>。'];
                options.push('若你还没在轮盘上标记“🗳️ 今日投票”，请先补记后再结算。');
                if (hasRole('恶魔：涡流')) options.push(`若按涡流给假信息，则应${reading.result ? '摇头' : '点头'}。`);
                return { title: '💡 计算结果', options };
            }
            if (roleStr === '镇民：城镇公告员') {
                const reading = didMinionNominateToday();
                const options = [reading.result
                    ? `按当前标记，爪牙 <b>[${reading.names.join(']、[')}]</b> 今天提名过玩家，应向其 <b>点头</b>。`
                    : '按当前标记，今天没有爪牙提名，应向其 <b>摇头</b>。'];
                options.push('若你还没在轮盘上标记“📢 今日提名”，请先补记后再结算。');
                if (hasRole('恶魔：涡流')) options.push(`若按涡流给假信息，则应${reading.result ? '摇头' : '点头'}。`);
                return { title: '💡 计算结果', options };
            }
            if (roleStr === '镇民：神谕者') {
                const reading = getOracleReading();
                const options = [reading.count
                    ? `当前死亡的邪恶玩家共有 <b>${reading.count}</b> 名：<b>[${reading.names.join(']、[')}]</b>。`
                    : '当前死亡的邪恶玩家共有 <b>0</b> 名。'];
                if (hasRole('恶魔：涡流')) {
                    const fakeCount = getAlternativeCountExcluding(reading.count, 0, Math.max(players.filter(player => !player.isAlive).length, 1), [reading.count]);
                    options.push(`若按涡流给假信息，可改报 <b>${fakeCount}</b>。`);
                }
                return { title: '💡 计算结果', options };
            }
            if (roleStr === '镇民：占卜师') {
                return { title: '💡 结算提示', options: ['若其今夜点中恶魔或死敌，则点头；否则摇头。'] };
            }
            if (roleStr === '外来者：管家') {
                const master = players.find(player => hasPlayerToken(player, '👑 主人'));
                return {
                    title: '💡 结算提示',
                    options: [master ? `当前可把 <b>[${master.name}]</b> 视为主人。` : '当前还没有主人标记，可在轮盘上先指定一名主人。']
                };
            }
            return null;
        }

        function getRoleFalseOptions(roleStr, currentPlayer) {
            if (roleStr === '镇民：洗衣妇') {
                const reveal = pickFalseReveal(getCurrentPoolTownsfolk(), currentPlayer.id);
                return reveal ? [`展示 ${renderRevealButton(reveal.fakeRole)}，并指向 <b>[${reveal.falseTargets[0].name}]</b> 与 <b>[${reveal.falseTargets[1].name}]</b>。`] : [];
            }
            if (roleStr === '镇民：图书管理员') {
                const effectiveRoles = getLibrarianTargets(currentPlayer.id).map(target => target.revealRole);
                const activeOutsiders = getCurrentPoolOutsiders();
                const fakeRole = activeOutsiders.find(role => !effectiveRoles.includes(role)) || activeOutsiders[0];
                let falseTargets = players.filter(player => player.id !== currentPlayer.id && normalizeRoleName(player.role) !== fakeRole);
                if (falseTargets.length < 2) falseTargets = players.filter(player => player.id !== currentPlayer.id);
                return falseTargets.length >= 2 ? [`展示 ${renderRevealButton(fakeRole)}，并指向 <b>[${falseTargets[0].name}]</b> 与 <b>[${falseTargets[1].name}]</b>。`] : [];
            }
            if (roleStr === '镇民：调查员') {
                const reveal = pickFalseReveal(getCurrentPoolMinions(), currentPlayer.id);
                return reveal ? [`展示 ${renderRevealButton(reveal.fakeRole)}，并指向 <b>[${reveal.falseTargets[0].name}]</b> 与 <b>[${reveal.falseTargets[1].name}]</b>。`] : [];
            }
            if (roleStr === '镇民：厨师') {
                const realPairs = getChefPairs(true);
                const spyPairs = hasSpyInPlay() ? getChefPairs(false) : realPairs;
                const maxPairs = Math.max(0, Math.floor(players.length / 2));
                const fakePairs = getAlternativeCountExcluding(realPairs, 0, maxPairs, [realPairs, spyPairs]);
                return [`你也可以把厨师读数报成 <b>${fakePairs}</b> 对。`];
            }
            if (roleStr === '镇民：共情者') {
                const real = getEmpathCount(currentPlayer.id, true);
                const spy = hasSpyInPlay() ? getEmpathCount(currentPlayer.id, false) : real;
                const fakeCount = getAlternativeCountExcluding(real.count, 0, 2, [real.count, spy.count]);
                return [`对存活邻座 [${real.names.join('] 和 [')}] 也可以报 <b>${fakeCount}</b> 人邪恶。`];
            }
            if (roleStr === '镇民：钟表匠') {
                const reading = getClockmakerReading();
                if (!reading) return [];
                const fakeCount = getAlternativeCountExcluding(reading.count, 0, Math.max(0, Math.floor((players.length - 2) / 2)), [reading.count]);
                return [`你也可以把钟表匠读数改报为 <b>${fakeCount}</b>。`];
            }
            if (roleStr === '镇民：卖花女孩') {
                const reading = didDemonVoteToday();
                return [`你也可以把卖花女孩结果反着给：当前应${reading.result ? '点头' : '摇头'}，也可改成${reading.result ? '摇头' : '点头'}。`];
            }
            if (roleStr === '镇民：城镇公告员') {
                const reading = didMinionNominateToday();
                return [`你也可以把城镇公告员结果反着给：当前应${reading.result ? '点头' : '摇头'}，也可改成${reading.result ? '摇头' : '点头'}。`];
            }
            if (roleStr === '镇民：神谕者') {
                const reading = getOracleReading();
                const fakeCount = getAlternativeCountExcluding(reading.count, 0, Math.max(players.filter(player => !player.isAlive).length, 1), [reading.count]);
                return [`你也可以把神谕者读数改报为 <b>${fakeCount}</b>。`];
            }
            if (roleStr === '镇民：占卜师') {
                return ['你也可以反着给：命中恶魔或死敌时摇头，未命中时点头。'];
            }
            if (roleStr === '镇民：送葬者' || roleStr === '镇民：守鸦人') {
                const fakeRole = getAvailableGoodBluffs()[0] || getCurrentPoolTownsfolk()[0];
                return [`展示一个错误角色标记，例如 ${renderRevealButton(fakeRole)}。`];
            }
            if (roleStr === '外来者：管家') {
                const fallbackTarget = players.find(player => player.id !== currentPlayer.id);
                return fallbackTarget ? [`可让其错误地认定 <b>[${fallbackTarget.name}]</b> 为主人，或直接让本次指定不生效。`] : [];
            }
            return [];
        }

        function getImpairedNightSuggestion(roleStr, currentPlayer) {
            const impairment = getPlayerImpairment(currentPlayer);
            if (!impairment) return '';
            const normalData = getRoleRecommendationData(roleStr, currentPlayer);
            const normalOptions = normalData?.options?.length ? normalData.options : ['该技能本夜若要结算，请按真实信息正常给出。'];
            const correctBaseOptions = normalOptions.filter(option => !`${option}`.startsWith('若按涡流'));
            const extraNotes = normalOptions
                .filter(option => `${option}`.startsWith('若按涡流'))
                .map(option => `额外提示：${option}`);
            const correctOptions = (correctBaseOptions.length ? correctBaseOptions : ['该技能本夜若要结算，请按真实信息正常给出。'])
                .map(option => `正确结果（${impairment}）：${option}`);
            const falseOptions = getRoleFalseOptions(roleStr, currentPlayer)
                .map(option => `错误结果建议：${option}`);
            return renderSuggestionBox(`⚠️ ${currentPlayer.name} 当前为${impairment}结算`, [...correctOptions, ...extraNotes, ...falseOptions]);
        }

        function getAIRecommendation(roleStr, currentPlayer) {
            const impairedHtml = getImpairedNightSuggestion(roleStr, currentPlayer);
            if (impairedHtml) return impairedHtml;
            const recommendationData = getRoleRecommendationData(roleStr, currentPlayer);
            return recommendationData ? renderSuggestionBox(recommendationData.title, recommendationData.options) : '';
        }

        function updateRoleInfo(commitValue = true) {
            const { min, max } = getCurrentPlayerRange();
            const playerCountInput = document.getElementById('playerCountInput');
            const rawValue = `${playerCountInput.value || ''}`.trim();
            let count = parseInt(rawValue, 10);
            const hasValidNumber = !Number.isNaN(count);

            if (!hasValidNumber) {
                if (commitValue) {
                    count = min;
                    playerCountInput.value = count;
                }
            } else {
                if (count < min) count = min;
                if (count > max) count = max;
                if (commitValue) playerCountInput.value = count;
            }

            const displayCount = hasValidNumber ? Math.min(max, Math.max(min, count)) : min;
            const dist = roleDistribution[displayCount];
            const travelerCount = players.filter(player => isTravelerPlayer(player)).length;
            const travelerText = travelerCount ? ` | 旅行者: ${travelerCount}` : '';
            if(dist) document.getElementById('roleInfo').innerHTML = `支持 ${min}-${max} 人 | 基础配置: ${dist[0]}镇民 | ${dist[1]}外来者 | ${dist[2]}爪牙 | ${dist[3]}恶魔${travelerText}`;
        }

        function updateTimerDisplay() {
            const display = document.getElementById('timerDisplay');
            const m = Math.floor(timeLeft / 60).toString().padStart(2, '0'); const s = (timeLeft % 60).toString().padStart(2, '0');
            display.innerText = `${m}:${s}`;
            if (timeLeft <= 10 && timeLeft > 0) display.classList.add('danger'); else display.classList.remove('danger');
            if (timeLeft === 0 && isTimerRunning) {
                display.classList.add('danger'); pauseTimer(); 
                if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 500]);
                setTimeout(() => alert("⏳ 时间到！请打断玩家发言。"), 100);
            }
        }
        function setTimer(seconds) { pauseTimer(); timeLeft = seconds; updateTimerDisplay(); }
        function toggleTimer() {
            const btn = document.getElementById('timerToggleBtn');
            if (isTimerRunning) { pauseTimer(); } else {
                if(timeLeft <= 0) return; isTimerRunning = true;
                btn.innerText = '⏸️ 暂停计时'; btn.classList.add('is-running');
                timerInterval = setInterval(() => { timeLeft--; updateTimerDisplay(); }, 1000);
            }
        }
        function pauseTimer() {
            isTimerRunning = false; clearInterval(timerInterval);
            const btn = document.getElementById('timerToggleBtn');
            btn.innerText = '▶️ 开始/暂停计时'; btn.classList.remove('is-running');
        }

        function initBluffSelects() {
            const selects = [document.getElementById('bluff1'), document.getElementById('bluff2'), document.getElementById('bluff3')];
            const activePoolGood = getCurrentPoolGood();
            let options = activePoolGood.map(r => `<option value="${r}">${r.split('：')[1] || r}</option>`).join('');
            options = `<option value="❓ 未分配">未分配</option>` + options;
            selects.forEach((s, idx) => {
                s.innerHTML = options;
                const targetValue = activePoolGood.includes(bluffs[idx]) || bluffs[idx] === '❓ 未分配' ? bluffs[idx] : '❓ 未分配';
                s.value = targetValue;
                bluffs[idx] = targetValue;
            });
        }

        function shuffle(array) {
            let currentIndex = array.length, randomIndex;
            while (currentIndex !== 0) { randomIndex = Math.floor(Math.random() * currentIndex); currentIndex--; [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]; }
            return array;
        }

        function pickWeightedRole(candidates, weightMap = {}) {
            if (!Array.isArray(candidates) || !candidates.length) return '';
            const totalWeight = candidates.reduce((sum, role) => sum + Math.max(0, weightMap[role] ?? 1), 0);
            if (totalWeight <= 0) return candidates[0];
            let roll = Math.random() * totalWeight;
            for (const role of candidates) {
                roll -= Math.max(0, weightMap[role] ?? 1);
                if (roll <= 0) return role;
            }
            return candidates[candidates.length - 1];
        }

        function pickWeightedUniqueRoles(candidates, count, weightMap = {}) {
            const pool = [...candidates];
            const picked = [];
            while (picked.length < count && pool.length) {
                const role = pickWeightedRole(pool, weightMap);
                if (!role) break;
                picked.push(role);
                const idx = pool.indexOf(role);
                if (idx >= 0) pool.splice(idx, 1);
            }
            return picked;
        }

        function insertUniqueRole(list, role, index = list.length) {
            if (!role || list.includes(role)) return;
            const safeIndex = Math.max(0, Math.min(index, list.length));
            list.splice(safeIndex, 0, role);
        }

        function clearPlayerTokenEverywhere(tokenStr) {
            const variants = tokenVariants(tokenStr);
            players.forEach(player => {
                player.tokens = player.tokens.filter(token => !variants.includes(token));
            });
        }

        function getTbReasonableSetupStyle(count, outsiderRoles, minionRoles) {
            if (minionRoles.includes('爪牙：间谍') || outsiderRoles.includes('外来者：陌客')) return 'advanced';
            if (minionRoles.includes('爪牙：男爵') || outsiderRoles.includes('外来者：酒鬼') || outsiderRoles.length >= 2 || count <= 7) return 'info';
            return Math.random() < 0.5 ? 'info' : 'quiet';
        }

        function getTbMinionWeights(count) {
            return {
                '爪牙：投毒者': 4,
                '爪牙：红唇女郎': count >= 7 ? 3 : 4,
                '爪牙：间谍': count >= 7 ? 2 : 0,
                '爪牙：男爵': count >= 7 ? (count >= 11 ? 3 : 2) : 0
            };
        }

        function chooseReasonableTbMinions(count, minionCount) {
            let candidatePool = [...poolMinions];
            if (count <= 6) candidatePool = candidatePool.filter(role => !['爪牙：男爵', '爪牙：间谍'].includes(role));
            const picked = [];
            while (picked.length < minionCount) {
                let currentPool = candidatePool.filter(role => !picked.includes(role));
                if (count <= 8 && picked.includes('爪牙：间谍')) currentPool = currentPool.filter(role => role !== '爪牙：男爵');
                if (count <= 8 && picked.includes('爪牙：男爵')) currentPool = currentPool.filter(role => role !== '爪牙：间谍');
                if (!currentPool.length) currentPool = candidatePool.filter(role => !picked.includes(role));
                const role = pickWeightedRole(currentPool, getTbMinionWeights(count));
                if (!role) break;
                picked.push(role);
            }
            return picked;
        }

        function getTbOutsiderWeights(count, minionRoles) {
            const weights = {
                '外来者：酒鬼': 4,
                '外来者：管家': 3,
                '外来者：陌客': minionRoles.includes('爪牙：间谍') ? 3 : 2,
                '外来者：圣徒': count >= 9 ? 2 : 1
            };
            if (minionRoles.includes('爪牙：男爵')) {
                weights['外来者：酒鬼'] += 1;
                weights['外来者：管家'] += 1;
            }
            return weights;
        }

        function chooseReasonableTbOutsiders(count, outsiderCount, minionRoles) {
            if (outsiderCount <= 0) return [];
            let picked = pickWeightedUniqueRoles(poolOutsiders, outsiderCount, getTbOutsiderWeights(count, minionRoles));
            if (count <= 8 && picked.includes('外来者：酒鬼') && picked.includes('外来者：圣徒')) {
                const replacement = ['外来者：管家', '外来者：陌客'].find(role => !picked.includes(role));
                if (replacement) picked = picked.map(role => role === '外来者：圣徒' ? replacement : role);
            }
            return picked;
        }

        function chooseReasonableTbTownsfolk(count, townsfolkCount, outsiderRoles, minionRoles) {
            const templates = {
                info: {
                    core: ['镇民：厨师', '镇民：共情者', '镇民：占卜师', '镇民：送葬者', '镇民：贞洁者'],
                    extras: ['镇民：调查员', '镇民：图书管理员', '镇民：洗衣妇', '镇民：僧侣', '镇民：守鸦人', '镇民：猎人', '镇民：士兵', '镇民：镇长']
                },
                quiet: {
                    core: ['镇民：共情者', '镇民：占卜师', '镇民：守鸦人', '镇民：猎人', '镇民：镇长'],
                    extras: ['镇民：僧侣', '镇民：士兵', '镇民：送葬者', '镇民：洗衣妇', '镇民：调查员', '镇民：厨师', '镇民：图书管理员', '镇民：贞洁者']
                },
                advanced: {
                    core: ['镇民：洗衣妇', '镇民：占卜师', '镇民：送葬者', '镇民：猎人', '镇民：贞洁者'],
                    extras: ['镇民：调查员', '镇民：僧侣', '镇民：守鸦人', '镇民：共情者', '镇民：士兵', '镇民：镇长', '镇民：图书管理员', '镇民：厨师']
                }
            };
            const style = getTbReasonableSetupStyle(count, outsiderRoles, minionRoles);
            const template = templates[style];
            const smallCountVariants = {
                5: [
                    ['镇民：厨师', '镇民：共情者', '镇民：占卜师'],
                    ['镇民：洗衣妇', '镇民：调查员', '镇民：厨师'],
                    ['镇民：调查员', '镇民：僧侣', '镇民：送葬者'],
                    ['镇民：洗衣妇', '镇民：占卜师', '镇民：守鸦人'],
                    ['镇民：图书管理员', '镇民：共情者', '镇民：送葬者']
                ],
                6: [
                    ['镇民：图书管理员', '镇民：共情者', '镇民：占卜师'],
                    ['镇民：洗衣妇', '镇民：调查员', '镇民：僧侣'],
                    ['镇民：图书管理员', '镇民：厨师', '镇民：送葬者'],
                    ['镇民：调查员', '镇民：共情者', '镇民：守鸦人'],
                    ['镇民：洗衣妇', '镇民：占卜师', '镇民：送葬者']
                ]
            };
            const smallVariants = smallCountVariants[count] || null;
            const orderedCore = smallVariants
                ? [...smallVariants[Math.floor(Math.random() * smallVariants.length)]]
                : [...template.core];

            if (outsiderRoles.length) insertUniqueRole(orderedCore, '镇民：图书管理员', 1);
            if (outsiderRoles.includes('外来者：酒鬼')) insertUniqueRole(orderedCore, '镇民：调查员', 2);
            if (minionRoles.includes('爪牙：间谍') || outsiderRoles.includes('外来者：陌客')) {
                insertUniqueRole(orderedCore, '镇民：洗衣妇', 0);
                insertUniqueRole(orderedCore, '镇民：占卜师', 2);
            }
            if (minionRoles.includes('爪牙：男爵')) insertUniqueRole(orderedCore, '镇民：图书管理员', 0);

            const selected = [];
            const addRole = role => {
                if (!role || selected.includes(role) || selected.length >= townsfolkCount) return;
                selected.push(role);
            };

            orderedCore.forEach(addRole);
            shuffle([...template.extras]).forEach(addRole);
            shuffle([...poolTownsfolk.filter(role => !selected.includes(role))]).forEach(addRole);
            return selected.slice(0, townsfolkCount);
        }

        function buildReasonableTbSetup(count) {
            const dist = roleDistribution[count];
            const minionRoles = chooseReasonableTbMinions(count, dist[2]);
            let townsfolkCount = dist[0];
            let outsiderCount = dist[1];
            const hasBaron = minionRoles.includes('爪牙：男爵');
            if (hasBaron) {
                outsiderCount = Math.min(poolOutsiders.length, outsiderCount + 2);
                townsfolkCount = Math.max(0, townsfolkCount - 2);
            }
            const outsiderRoles = chooseReasonableTbOutsiders(count, outsiderCount, minionRoles);
            const townsfolkRoles = chooseReasonableTbTownsfolk(count, townsfolkCount, outsiderRoles, minionRoles);
            return {
                selectedRoles: [...townsfolkRoles, ...outsiderRoles, ...minionRoles, '恶魔：小恶魔'],
                hasBaron,
                hasDrunk: outsiderRoles.includes('外来者：酒鬼')
            };
        }

        function assignTbDrunkFacadeRole() {
            const drunkPlayer = players.find(player => normalizeRoleName(player.role) === '外来者：酒鬼');
            if (!drunkPlayer) return null;
            const preferredFacadePool = [
                '镇民：调查员',
                '镇民：图书管理员',
                '镇民：洗衣妇',
                '镇民：厨师',
                '镇民：共情者',
                '镇民：占卜师',
                '镇民：送葬者',
                '镇民：守鸦人',
                '镇民：僧侣',
                '镇民：士兵',
                '镇民：镇长',
                '镇民：猎人',
                '镇民：贞洁者'
            ];
            const inPlayRoles = players.map(player => normalizeRoleName(player.role));
            const availableFacadePool = preferredFacadePool.filter(role => !inPlayRoles.includes(role));
            const fallbackPool = poolTownsfolk.filter(role => !inPlayRoles.includes(role));
            const facadeRole = availableFacadePool[0] || fallbackPool[0] || '镇民：调查员';
            drunkPlayer.role = facadeRole;
            if (!hasPlayerToken(drunkPlayer, '🍺 醉酒')) drunkPlayer.tokens.push('🍺 醉酒');
            return drunkPlayer;
        }

        function assignTbFortuneTellerRedHerring() {
            const fortuneTeller = players.find(player => normalizeRoleName(player.role) === '镇民：占卜师');
            clearPlayerTokenEverywhere('🔮 死敌');
            if (!fortuneTeller) return null;
            const goodPlayers = players.filter(player => !isEvil(normalizeRoleName(player.role)) && !isTravelerPlayer(player));
            if (!goodPlayers.length) return null;
            let redHerring = null;
            if (players.length <= 6 && Math.random() < 0.65) {
                redHerring = fortuneTeller;
            } else if (players.length <= 8 && Math.random() < 0.35) {
                redHerring = fortuneTeller;
            } else {
                redHerring = shuffle([...goodPlayers])[0];
            }
            if (!redHerring.tokens.includes('🔮 死敌')) redHerring.tokens.push('🔮 死敌');
            return redHerring;
        }
        function getScarletWomanPromotionCandidate() {
            if (selectedScript !== 'tb') return null;
            const deadImp = players.find(player => normalizeRoleName(player.role) === '恶魔：小恶魔' && !player.isAlive);
            const scarletWoman = players.find(player => normalizeRoleName(player.role) === '爪牙：红唇女郎' && player.isAlive);
            if (!deadImp || !scarletWoman) return null;
            const aliveCount = players.filter(player => player.isAlive).length;
            return aliveCount >= 4 ? scarletWoman : null;
        }

        function generateAndDeal() {
            const { min, max } = getCurrentPlayerRange();
            let count = parseInt(document.getElementById('playerCountInput').value);
            if (isNaN(count) || count < min || count > max) return alert(`人数必须在 ${min} 到 ${max} 人之间！`);
            const preservedNames = players.map(player => player.name);
            isRenameMode = false;
            closeSeatTokenModal();
            closeSeatAssignModal();
            players = []; bluffs = ['❓ 未分配', '❓ 未分配', '❓ 未分配'];
            for (let i = 0; i < count; i++) players.push(createPlayer(i, preservedNames[i]));

            let selectedRoles = [];
            let setupNotes = [];
            if (selectedScript === 'tb') {
                const tbSetup = buildReasonableTbSetup(count);
                selectedRoles = [...tbSetup.selectedRoles];
                if (tbSetup.hasBaron) setupNotes.push('男爵已自动按 +2 外来者处理');
            } else {
                const dist = roleDistribution[count];
                let townsfolkCount = dist[0];
                let outsiderCount = dist[1];
                const chosenDemon = shuffle([...getCurrentPoolDemons()])[0];
                if (selectedScript === 'mycx' && chosenDemon === '恶魔：方古') {
                    townsfolkCount = Math.max(0, townsfolkCount - 1);
                    outsiderCount += 1;
                    setupNotes.push('方古已自动按 +1 外来者处理');
                }
                selectedRoles = [].concat(
                    shuffle([...getCurrentPoolTownsfolk()]).slice(0, townsfolkCount),
                    shuffle([...getCurrentPoolOutsiders()]).slice(0, outsiderCount),
                    shuffle([...getCurrentPoolMinions()]).slice(0, dist[2]),
                    [chosenDemon]
                );
            }
            selectedRoles = shuffle(selectedRoles);
            for (let i = 0; i < count; i++) players[i].role = selectedRoles[i];

            if (selectedScript === 'tb') {
                const drunkPlayer = assignTbDrunkFacadeRole();
                const redHerringPlayer = assignTbFortuneTellerRedHerring();
                if (drunkPlayer) setupNotes.push(`${drunkPlayer.name} 已自动以镇民身份入座并标记醉酒`);
                if (redHerringPlayer) setupNotes.push(`${redHerringPlayer.name} 已自动标记为占卜师死敌`);
            }

            const outOfPlayGood = getAvailableGoodBluffs();
            bluffs = [outOfPlayGood[0], outOfPlayGood[1], outOfPlayGood[2]];

            setTimer(300); document.getElementById('timerPanel').style.display = 'block'; 
            initBluffSelects();
            currentNightOrderType = 'first';
            saveData(); renderAll();
        }

        function editName(id) { openSeatAssignModal(id); }
        function markDeath(id, deathType) { const player = players.find(p => p.id === id); if (!player || !player.isAlive) return; if (deathType === 'demon' && isProtectedFromDemon(player)) return; player.isAlive = false; player.hasGhostVote = true; player.deathType = deathType; saveData(); renderAll(); }
        function revivePlayer(id) { const player = players.find(p => p.id === id); if (!player || player.isAlive) return; player.isAlive = true; player.hasGhostVote = false; player.deathType = ''; saveData(); renderAll(); }
        function toggleGhostVote(id) { const player = players.find(p => p.id === id); if (!player.isAlive) { player.hasGhostVote = !player.hasGhostVote; saveData(); renderAll(); } }
        function updateRole(id, newRole) {
            const player = players.find(p => p.id === id);
            if (!player) return;
            const normalizedRole = normalizeRoleName(newRole);
            player.role = normalizedRole;
            if (isTravelerRole(normalizedRole)) {
                applyTravelerPresetToPlayer(player, player.travelerName || getTravelerPresetList()[0]?.name);
                player.travelerCamp = travelerCampLabels[player.travelerCamp] ? player.travelerCamp : 'undecided';
            } else {
                player.travelerName = '';
                player.travelerAbility = '';
                player.travelerCamp = 'undecided';
            }
            saveData();
            renderAll();
        }
        function addToken(id, event) { if (event.key === 'Enter' && event.target.value.trim()) { const player = players.find(p => p.id === id); if (!player.tokens.includes(event.target.value.trim())) { player.tokens.push(event.target.value.trim()); saveData(); renderAll(); } } }
        function addSpecificToken(id, tokenStr) {
            if (tokenStr === '👑 主人') {
                toggleMasterToken(id);
                saveData();
                renderAll();
                return;
            }
            const player = players.find(p => p.id === id);
            if (!player.tokens.includes(tokenStr)) { player.tokens.push(tokenStr); saveData(); renderAll(); }
        }
        function removeToken(id, tokenIndex) { players.find(p => p.id === id).tokens.splice(tokenIndex, 1); saveData(); renderAll(); }
        function clearData() { players = []; bluffs = ['❓ 未分配', '❓ 未分配', '❓ 未分配']; currentNightOrderType = ''; isRenameMode = false; closeSeatTokenModal(); closeSeatAssignModal(); document.getElementById('nightOrderDisplay').style.display = 'none'; document.getElementById('timerPanel').style.display = 'none'; pauseTimer(); setTimer(300); initBluffSelects(); saveData(); renderAll(); }
        function renderHints() {
            const panel = document.getElementById('storytellerHints');
            if (players.length === 0) {
                panel.style.display = 'none';
                panel.innerHTML = '';
                return;
            }

            const hints = [];
            const fortuneTellerRival = players.find(player => hasPlayerToken(player, '🔮 死敌'));
            const drunkFacadePlayers = selectedScript === 'tb'
                ? players.filter(player => hasPlayerToken(player, '🍺 醉酒') && getRoleCategory(normalizeRoleName(player.role)) === 'Townsfolk')
                : [];
            const scarletWomanPromotion = getScarletWomanPromotionCandidate();
            if (hasRole('镇民：占卜师')) {
                if (fortuneTellerRival) {
                    hints.push({ type: 'system', text: `本局有占卜师：已自动将 [${fortuneTellerRival.name}] 标记为死敌。` });
                } else {
                    hints.push({ type: 'warning', text: '本局有占卜师：开始夜晚前先设定一名死敌，并提前记好“🔮 死敌”标记。' });
                }
            }
            if (hasRole('爪牙：男爵')) hints.push({ type: 'system', text: '本局有男爵：一键发牌时已按 +2 外来者处理；若你是手动改出的男爵，请自行检查阵容。' });
            if (selectedScript === 'mycx' && hasRole('恶魔：方古')) hints.push({ type: 'system', text: '本局有方古：一键发牌时已按 +1 外来者处理；若你是手动改出的方古，请自行检查阵容。' });
            if (selectedScript === 'mycx' && hasRole('恶魔：涡流')) hints.push({ type: 'warning', text: '本局有涡流：镇民信息都应为假，且白天若无人被处决，邪恶会直接获胜。' });
            if (selectedScript === 'mycx' && hasRole('镇民：博学者')) hints.push({ type: 'system', text: '本局有博学者：记得每天白天给出两条信息，其中一真一假。' });
            if (selectedScript === 'mycx' && hasRole('外来者：畸形秀演员')) hints.push({ type: 'warning', text: '本局有畸形秀演员：若其疯狂地宣称自己是外来者，可能会被立刻处决。' });
            if (selectedScript === 'mycx' && (hasRole('镇民：卖花女孩') || hasRole('镇民：城镇公告员'))) hints.push({ type: 'system', text: '本局有卖花女孩/城镇公告员：白天结束前可在轮盘上给对应玩家手动标记“🗳️ 今日投票 / 📢 今日提名”，夜晚顺序会按这些标记自动计算。' });
            if (drunkFacadePlayers.length) hints.push({ type: 'system', text: `本局含酒鬼伪装：${drunkFacadePlayers.map(player => `[${player.name}]`).join('、')} 已自动以镇民身份入座，并带有“🍺 醉酒”标记。` });
            if (scarletWomanPromotion) hints.push({ type: 'warning', text: `小恶魔已死亡，且 [${scarletWomanPromotion.name}] 满足红唇女郎接任条件。<button type="button" class="inline-reveal-btn" onclick="showScarletWomanPromotionModal()">全屏展示“你已成为小恶魔”</button>` });
            if (hasSpyInPlay() && (hasRole('镇民：厨师') || hasRole('镇民：共情者'))) hints.push({ type: 'system', text: '本局有间谍：夜晚顺序中的厨师/共情者会给出真实值与注册值两种结果，按说书人裁定任选其一。' });
            if (players.some(player => isTravelerPlayer(player))) hints.push({ type: 'system', text: '本局有旅行者：旅行者不参与随机发牌，建议公开其阵营与技能边界后再进入白天讨论。' });
            if (hints.length === 0) hints.push({ type: 'normal', text: '当前无特殊开局提醒，可直接进入夜晚流程。' });

            panel.innerHTML = `
                <div class="hints-title">说书人提示</div>
                <div class="hints-list">
                    ${hints.map(hint => `<div class="hint-item ${hint.type}">${hint.text}</div>`).join('')}
                </div>
            `;
            panel.style.display = 'block';
        }

        function generateNightOrder(type, options = {}) {
            if(players.length === 0) return;
            currentNightOrderType = type;
            const display = document.getElementById('nightOrderDisplay');
            const activeRoles = players.map(p => normalizeRoleName(p.role));
            const activeNightOrder = getCurrentNightOrder();
            const activeRoleDetails = getCurrentRoleDetails();
            const hideTbEvilIntroSteps = shouldHideTbEvilIntroSteps();
            let html = `<h3 class="night-order-title">${type === 'first' ? '🌙 首夜降临' : '🌘 其余夜晚'}</h3><ul class="night-list">`;
            let stepCount = 1;

            activeNightOrder[type].forEach(role => {
                if (hideTbEvilIntroSteps && (role === '【系统：爪牙互相确认】' || role === '【系统：恶魔确认爪牙及3个伪装】')) {
                    return;
                }
                const details = activeRoleDetails[role] || { ability: '', action: '无详细操作说明' };
                if (role.startsWith('【')) {
                    html += `<li class="night-item"><div class="night-header">${stepCount}. <span class="system-prompt">${role}</span></div><div class="storyteller-action">👉 <b>说书人：</b>${details.action}</div></li>`;
                    stepCount++;
                } else if (activeRoles.includes(role)) {
                    players.filter(p => normalizeRoleName(p.role) === role).forEach(p => {
                        const status = p.isAlive ? '' : ' <span class="status-dead">(已死亡)</span>';
                        const shortRole = role.split('：')[1]; 
                        const aiHtml = getAIRecommendation(role, p);

                        html += `
                        <li class="night-item">
                            <div class="night-header">${stepCount}. 唤醒 <span class="highlight">${shortRole}</span> [${p.name}] ${status}</div>
                            <div class="role-ability">${details.ability}</div>
                            <div class="storyteller-action">👉 <b>说书人：</b>${details.action}</div>
                            ${aiHtml}
                        </li>`;
                        stepCount++;
                    });
                }
            });
            html += '</ul>';
            display.innerHTML = html; display.style.display = 'block';
            if (options.scroll !== false) display.scrollIntoView({ behavior: 'smooth' });
        }

        function saveData() { 
            bluffs[0] = document.getElementById('bluff1').value; bluffs[1] = document.getElementById('bluff2').value; bluffs[2] = document.getElementById('bluff3').value;
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ players, bluffs, currentNightOrderType, playerListLayout, scoreBoard, seriesGames, finalMvp, selectedScript, travelerFeatureEnabled })); 
        }

        function loadData() { 
            const saved = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map(key => localStorage.getItem(key)).find(Boolean); 
            if (saved) { 
                const data = JSON.parse(saved);
                selectedScript = scriptMeta[data.selectedScript] ? data.selectedScript : 'tb';
                players = (data.players || []).map((player, index) => normalizePlayerData(player, index));
                bluffs = (data.bluffs || ['❓ 未分配', '❓ 未分配', '❓ 未分配']).map(normalizeRoleName);
                currentNightOrderType = data.currentNightOrderType || '';
                playerListLayout = data.playerListLayout || (window.innerWidth >= 720 ? 'double' : 'single');
                scoreBoard = normalizeScoreBoardData(data.scoreBoard || {});
                seriesGames = typeof data.seriesGames === 'number' ? data.seriesGames : 0;
                finalMvp = data.finalMvp || '';
                travelerFeatureEnabled = typeof data.travelerFeatureEnabled === 'boolean'
                    ? data.travelerFeatureEnabled
                    : players.some(player => isTravelerPlayer(player));
                if(players.length > 0) document.getElementById('timerPanel').style.display = 'block';
            } else {
                playerListLayout = window.innerWidth >= 720 ? 'double' : 'single';
                selectedScript = 'tb';
                travelerFeatureEnabled = false;
            }
            initBluffSelects(); initRoleRevealSelect(); updateScriptUi(); renderAll(); updateTimerDisplay();
        }
        function setupUiGuards() {
            const allowTextInteraction = target => target instanceof Element && !!target.closest('input, textarea, [contenteditable="true"]');
            if (!document.body.dataset.copyGuardBound) {
                document.addEventListener('copy', event => {
                    if (!allowTextInteraction(event.target)) event.preventDefault();
                });
                document.addEventListener('cut', event => {
                    if (!allowTextInteraction(event.target)) event.preventDefault();
                });
                document.addEventListener('selectstart', event => {
                    if (!allowTextInteraction(event.target)) event.preventDefault();
                });
                document.body.dataset.copyGuardBound = '1';
            }
            const seatTokenPanel = document.getElementById('seatTokenModalPanel');
            if (seatTokenPanel && !seatTokenPanel.dataset.bound) {
                seatTokenPanel.addEventListener('click', event => event.stopPropagation());
                seatTokenPanel.dataset.bound = '1';
            }
            const seatAssignPanel = document.getElementById('seatAssignModalPanel');
            if (seatAssignPanel && !seatAssignPanel.dataset.bound) {
                seatAssignPanel.addEventListener('click', event => event.stopPropagation());
                seatAssignPanel.dataset.bound = '1';
            }
            const roleCardPreviewPanel = document.getElementById('roleCardPreviewPanel');
            if (roleCardPreviewPanel && !roleCardPreviewPanel.dataset.bound) {
                roleCardPreviewPanel.addEventListener('click', event => event.stopPropagation());
                roleCardPreviewPanel.dataset.bound = '1';
            }
            const seatAssignInput = document.getElementById('seatAssignInput');
            if (seatAssignInput && !seatAssignInput.dataset.bound) {
                seatAssignInput.addEventListener('keydown', event => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        applySeatAssignmentFromInput();
                    }
                });
                seatAssignInput.dataset.bound = '1';
            }
        }

        function refreshNightOrderIfOpen() {
            if (players.length === 0 || !currentNightOrderType) return;
            generateNightOrder(currentNightOrderType, { scroll: false });
        }

        function renderAll() {
            initTravelerControls();
            updateTravelerFeatureUi();
            initRoleRevealSelect();
            updateRoleInfo();
            renderCircle();
            renderHints();
            renderList();
            updateRenameModeUi();
            updatePlayerListLayoutUi();
            renderScoreBoard();
            refreshNightOrderIfOpen();
        }

        function renderCircle() {
            const stage = document.getElementById('circleStage');
            const container = document.getElementById('circleView');
            if (players.length === 0) {
                stage.style.display = 'none';
                container.style.display = 'none';
                return;
            }
            stage.style.display = 'block';
            container.style.display = 'block';
            container.innerHTML = '';
            const stageStyle = window.getComputedStyle(stage);
            const horizontalPadding = parseFloat(stageStyle.paddingLeft) + parseFloat(stageStyle.paddingRight);
            const availableWidth = Math.max(250, stage.clientWidth - horizontalPadding);
            const size = availableWidth < 300 ? availableWidth : Math.min(availableWidth, 420);
            const seatSize = Math.min(players.length >= 12 ? 56 : players.length >= 9 ? 60 : 66, Math.floor(size * 0.21));
            container.style.setProperty('--altar-size', `${size}px`);
            container.style.setProperty('--seat-size', `${seatSize}px`);
            container.style.setProperty('--seat-name-size', `${Math.max(11, Math.round(seatSize * 0.22))}px`);
            container.style.setProperty('--seat-role-size', `${Math.max(9, Math.round(seatSize * 0.17))}px`);
            const center = size / 2;
            const radius = center - seatSize / 2 - 18;
            const angleStep = (2 * Math.PI) / players.length;
            players.forEach((p, index) => {
                const angle = index * angleStep - Math.PI / 2;
                const x = center + radius * Math.cos(angle); const y = center + radius * Math.sin(angle);
                const noteRadius = radius + seatSize * 1.02;
                const noteX = center + noteRadius * Math.cos(angle);
                const noteY = center + noteRadius * Math.sin(angle);
                const seat = document.createElement('div');
                const roleCategory = getRoleCategory(normalizeRoleName(p.role)).toLowerCase();
                const seatRoleClass = roleCategory === 'minion' ? 'seat-minion' : roleCategory === 'demon' ? 'seat-demon' : roleCategory === 'traveler' ? 'seat-traveler' : '';
                seat.className = `seat ${seatRoleClass} ${p.isAlive ? '' : 'dead-seat'}`.trim();
                seat.style.cssText = `left: ${x}px; top: ${y}px;`;
                seat.title = `${p.name}：短按切换状态，长按保存/分享角色卡`;
                bindSeatInteractions(seat, p.id);
                const roleName = normalizeRoleName(p.role);
                const shortRole = getPlayerRoleShortNameWithIcon(p);
                const badgeHtml = getSeatBadgesHtml(p);
                const abilityNote = document.createElement('div');
                abilityNote.className = `seat-ability ${roleCategory === 'demon' ? 'demon' : roleCategory === 'minion' ? 'evil' : roleCategory === 'traveler' ? 'traveler' : ''}`.trim();
                abilityNote.style.cssText = `left: ${noteX}px; top: ${noteY}px;`;
                abilityNote.innerText = getWheelAbilityText(roleName, p);

                seat.innerHTML = `
                    ${badgeHtml}
                    <div class="seat-name">${p.name}</div>
                    <div class="seat-role">${shortRole}</div>
                `;
                container.appendChild(abilityNote);
                container.appendChild(seat);
            });
        }

        function renderList() {
            const list = document.getElementById('playerList'); list.innerHTML = '';
            players.forEach(p => {
                const card = document.createElement('div'); card.className = `player-card ${p.isAlive ? '' : 'dead'}`;
                const roleName = normalizeRoleName(p.role);
                const roleChoices = getCurrentAllRoles().filter(role => travelerFeatureEnabled || role !== TRAVELER_ROLE || roleName === TRAVELER_ROLE);
                let roleOptions = roleChoices.map(r => `<option value="${r}" ${roleName === r ? 'selected' : ''}>${escapeHtml(getRoleLabelWithIcon(r))}</option>`).join('');
                let ghostBtnHtml = p.isAlive ? '' : `<button class="${p.hasGhostVote ? 'ghost-btn' : 'no-ghost'}" onclick="toggleGhostVote(${p.id})">${p.hasGhostVote ? '👻 有票' : '❌ 无票'}</button>`;
                let abilityDesc = getPlayerAbilityText(p);
                const deathLabel = p.deathType === 'demon' ? '🗡️ 恶魔刀' : '☠️ 已处决';
                const deathClass = p.deathType === 'demon' ? 'demon-mark' : 'execution-mark';
                const actionHtml = p.isAlive
                    ? ''
                    : `<div class="actions">${ghostBtnHtml}<button class="revive-btn" onclick="revivePlayer(${p.id})">✨ 复活</button><button class="death-mark ${deathClass}" disabled>${deathLabel}</button></div>`;
                const travelerPresetOptions = getTravelerPresetList().map(preset => `<option value="${preset.name}" ${getTravelerName(p) === preset.name ? 'selected' : ''}>${escapeHtml(`${travelerRoleIconMap[preset.name] || '🧳'} ${preset.name}`)}</option>`).join('');
                const showTravelerEditor = travelerFeatureEnabled && isTravelerPlayer(p);
                const primaryAbilityHtml = showTravelerEditor ? '' : `<div class="role-desc">ℹ️ ${abilityDesc}</div>`;
                const travelerEditorHtml = showTravelerEditor
                    ? `
                        <div class="traveler-editor">
                            <div class="traveler-editor-row">
                                <div>
                                    <div class="traveler-editor-label">旅行者角色</div>
                                    <select class="traveler-meta-input" onchange="updateTravelerField(${p.id}, 'travelerName', this.value)">${travelerPresetOptions}</select>
                                </div>
                                <div>
                                    <div class="traveler-editor-label">公开阵营</div>
                                    <select class="traveler-meta-input" onchange="updateTravelerField(${p.id}, 'travelerCamp', this.value)">
                                        <option value="undecided" ${getTravelerCampValue(p) === 'undecided' ? 'selected' : ''}>未定</option>
                                        <option value="good" ${getTravelerCampValue(p) === 'good' ? 'selected' : ''}>善良</option>
                                        <option value="evil" ${getTravelerCampValue(p) === 'evil' ? 'selected' : ''}>邪恶</option>
                                    </select>
                                </div>
                            </div>
                            <div class="role-desc">ℹ️ ${getTravelerAbilityText(p)}</div>
                        </div>
                    `
                    : '';

                card.innerHTML = `
                    <div class="row"><span class="player-name">${p.name}</span>${actionHtml}</div>
                    <div class="row" style="margin-bottom: 4px;"><select onchange="updateRole(${p.id}, this.value)">${roleOptions}</select></div>
                    ${primaryAbilityHtml}
                    ${travelerEditorHtml}
                `;
                list.appendChild(card);
            });
        }

var originalGenerateAndDeal = generateAndDeal;
