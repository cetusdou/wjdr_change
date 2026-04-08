/**
 * 用户操作模块
 * 处理UI渲染和用户交互
 */

// ==============================================
// UI 控制器
// ==============================================
class UIController {
  constructor() {
    this.currentUser = null;
    this.allUsers = [];
    this.recorder = null;
    this.currentTab = 'inventory';
    
    // 手动交易选择状态
    this.manualSendSelected = [];
    this.manualReceiveSelected = [];
    
    // 展开状态
    this.expandedCategories = new Set();
  }

  // 初始化UI
  async init() {
    // 等待拼图配置加载完成
    const loaded = await loadPuzzleConfig();
    if (!loaded) {
      console.error('拼图配置加载失败');
      return;
    }
    
    this.createGrids();
    this.updateDateDisplay();
    this.bindEvents();
  }

  // ==============================================
  // 创建可展开的大类/小类结构
  // ==============================================
  createGrids() {
    this.createInventoryView('haveContainer', true);
    this.createInventoryView('wantContainer', false);
  }
  
  createInventoryView(containerId, isHave) {
    const container = document.getElementById(containerId);
    if (!container || !PUZZLE_DATA) return;
    
    container.innerHTML = "";
    
    for (const category of PUZZLE_DATA.categories) {
      // 创建大类卡片
      const catCard = document.createElement("div");
      catCard.className = "category-card";
      catCard.dataset.categoryId = category.id;
      
      // 大类标题（可点击展开）
      const catHeader = document.createElement("div");
      catHeader.className = "category-header";
      catHeader.innerHTML = `
        <span class="expand-icon">▶</span>
        <span class="category-name">${category.id}. ${category.name}</span>
        <span class="category-count"></span>
      `;
      catHeader.onclick = () => this.toggleCategory(category.id, catCard);
      
      // 小类容器（初始隐藏）
      const puzzlesContainer = document.createElement("div");
      puzzlesContainer.className = "puzzles-container";
      puzzlesContainer.style.display = "none";
      
      // 创建每个小类
      for (let pi = 0; pi < category.puzzles.length; pi++) {
        const puzzle = category.puzzles[pi];
        const puzzleIndex = pi + 1;
        
        const puzzleRow = document.createElement("div");
        puzzleRow.className = "puzzle-row";
        puzzleRow.dataset.puzzleIndex = puzzleIndex;
        
        // 小类名称
        const puzzleName = document.createElement("span");
        puzzleName.className = "puzzle-name";
        puzzleName.innerText = puzzle.name;
        
        // 碎片按钮容器
        const piecesContainer = document.createElement("div");
        piecesContainer.className = "pieces-container";
        
        // 创建碎片按钮 [1] [2] [3]...
        for (let pieceNum = 1; pieceNum <= puzzle.pieces; pieceNum++) {
          const pieceBtn = document.createElement("button");
          pieceBtn.className = "piece-btn";
          pieceBtn.innerText = pieceNum;
          pieceBtn.dataset.puzzleId = generatePuzzleId(category.id, puzzleIndex, pieceNum);
          pieceBtn.dataset.categoryId = category.id;
          pieceBtn.dataset.puzzleIndex = puzzleIndex;
          pieceBtn.dataset.pieceNum = pieceNum;
          
          if (isHave) {
            pieceBtn.onclick = () => this.onHavePieceClick(pieceBtn);
          } else {
            pieceBtn.onclick = () => this.onWantPieceClick(pieceBtn);
          }
          
          piecesContainer.appendChild(pieceBtn);
        }
        
        puzzleRow.appendChild(puzzleName);
        puzzleRow.appendChild(piecesContainer);
        puzzlesContainer.appendChild(puzzleRow);
      }
      
      catCard.appendChild(catHeader);
      catCard.appendChild(puzzlesContainer);
      container.appendChild(catCard);
    }
  }
  
  // 展开/折叠大类
  toggleCategory(categoryId, catCard) {
    const puzzlesContainer = catCard.querySelector('.puzzles-container');
    const expandIcon = catCard.querySelector('.expand-icon');
    const isExpanded = puzzlesContainer.style.display !== 'none';
    
    if (isExpanded) {
      puzzlesContainer.style.display = 'none';
      expandIcon.innerText = '▶';
      this.expandedCategories.delete(categoryId);
    } else {
      puzzlesContainer.style.display = 'block';
      expandIcon.innerText = '▼';
      this.expandedCategories.add(categoryId);
    }
  }
  
  // 点击碎片按钮（我的库存 - 增加数量）
  onHavePieceClick(btn) {
    if (!this.currentUser) {
      alert("请先加载用户数据");
      return;
    }
    
    const puzzleId = btn.dataset.puzzleId;
    const current = this.currentUser.have[puzzleId] || 0;
    
    // 循环：0→1→2→3→0
    let newCount;
    if (current === 0) {
      newCount = 1;
    } else if (current < 3) {
      newCount = current + 1;
    } else {
      newCount = 0;
    }
    
    if (newCount === 0) {
      delete this.currentUser.have[puzzleId];
    } else {
      this.currentUser.have[puzzleId] = newCount;
    }
    
    this.updatePieceBtnDisplay(btn, newCount);
    this.updateCategoryCount(btn.dataset.categoryId);
  }
  
  // 点击碎片按钮（我想要 - 标记/取消）
  onWantPieceClick(btn) {
    if (!this.currentUser) {
      alert("请先加载用户数据");
      return;
    }
    
    const puzzleId = btn.dataset.puzzleId;
    const isWanting = this.currentUser.want.includes(puzzleId);
    
    if (isWanting) {
      this.currentUser.removeWant(puzzleId);
    } else {
      this.currentUser.addWant(puzzleId);
    }
    
    this.updateWantBtnDisplay(btn, !isWanting);
  }
  
  // 更新碎片按钮显示状态
  updatePieceBtnDisplay(btn, count) {
    btn.classList.remove('have-1', 'have-2', 'have-3');
    
    if (count === 1) {
      btn.classList.add('have-1');
      btn.title = '多余 1 张（可交换）';
    } else if (count === 2) {
      btn.classList.add('have-2');
      btn.title = '多余 2 张（可交换）';
    } else if (count === 3) {
      btn.classList.add('have-3');
      btn.title = '多余 3 张（可交换）';
    } else {
      btn.title = '';
    }
  }
  
  // 更新想要按钮显示状态
  updateWantBtnDisplay(btn, isWanting) {
    if (isWanting) {
      btn.classList.add('want');
      btn.title = '想要';
    } else {
      btn.classList.remove('want');
      btn.title = '';
    }
  }
  
  // 更新大类统计
  updateCategoryCount(categoryId) {
    const catCard = document.querySelector(`.category-card[data-category-id="${categoryId}"]`);
    if (!catCard || !this.currentUser) return;
    
    const countEl = catCard.querySelector('.category-count');
    if (!countEl) return;
    
    // 统计该大类下的拼图
    let haveCount = 0;
    let extraCount = 0;
    let wantCount = 0;
    
    const category = PUZZLE_DATA.categories.find(c => c.id === parseInt(categoryId));
    if (!category) return;
    
    for (let pi = 0; pi < category.puzzles.length; pi++) {
      const puzzle = category.puzzles[pi];
      for (let pieceNum = 1; pieceNum <= puzzle.pieces; pieceNum++) {
        const puzzleId = generatePuzzleId(parseInt(categoryId), pi + 1, pieceNum);
        const haveCount_for_id = this.currentUser.have[puzzleId] || 0;
        
        if (haveCount_for_id > 0) {
          haveCount++;
          extraCount++;  // count > 0 即为可交换
        }
        if (this.currentUser.want.includes(puzzleId)) wantCount++;
      }
    }
    
    const parts = [];
    if (haveCount > 0) parts.push(`有${haveCount}`);
    if (extraCount > 0) parts.push(`多余${extraCount}`);
    if (wantCount > 0) parts.push(`缺${wantCount}`);
    
    countEl.innerText = parts.length > 0 ? `(${parts.join(' ')})` : '';
  }

  // ==============================================
  // 显示更新
  // ==============================================
  refreshAllDisplay() {
    if (!this.currentUser || !PUZZLE_DATA) return;
    
    // 刷新所有按钮状态
    for (const category of PUZZLE_DATA.categories) {
      for (let pi = 0; pi < category.puzzles.length; pi++) {
        const puzzle = category.puzzles[pi];
        for (let pieceNum = 1; pieceNum <= puzzle.pieces; pieceNum++) {
          const puzzleId = generatePuzzleId(category.id, pi + 1, pieceNum);
          
          // 更新 have 按钮
          const haveBtn = document.querySelector(`#haveContainer .piece-btn[data-puzzle-id="${puzzleId}"]`);
          if (haveBtn) {
            const count = this.currentUser.have[puzzleId] || 0;
            this.updatePieceBtnDisplay(haveBtn, count);
          }
          
          // 更新 want 按钮
          const wantBtn = document.querySelector(`#wantContainer .piece-btn[data-puzzle-id="${puzzleId}"]`);
          if (wantBtn) {
            const isWanting = this.currentUser.want.includes(puzzleId);
            this.updateWantBtnDisplay(wantBtn, isWanting);
          }
        }
      }
      
      // 更新大类统计
      this.updateCategoryCount(category.id);
    }
    
    this.updateDateDisplay();
  }
  
  updateDateDisplay() {
    const todayEl = document.getElementById("todayDate");
    if (todayEl) todayEl.innerText = getToday();
  }

  // ==============================================
  // 用户注册/加载/保存
  // ==============================================
  
  // 注册新用户
  async registerUser(name) {
    try {
      // 检查昵称是否为空
      if (!name || name.trim() === '') {
        return { success: false, error: "请输入昵称" };
      }
      
      // 检查昵称长度
      if (name.length < 2 || name.length > 20) {
        return { success: false, error: "昵称长度应为2-20个字符" };
      }
      
      // 检查昵称格式（只允许字母、数字、中文、下划线）
      if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(name)) {
        return { success: false, error: "昵称只能包含中文、字母、数字和下划线" };
      }
      
      // 调用数据库注册
      const newUser = await database.registerUser(name);
      
      // 设置当前用户
      this.currentUser = newUser;
      this.recorder = new PersonalRecorder(this.currentUser);
      this.refreshAllDisplay();
      
      const userLabel = document.getElementById("currentUser");
      if (userLabel) userLabel.innerText = `注册成功: ${name}（请设置库存）`;
      
      return { success: true, isNew: true, message: `用户 "${name}" 注册成功！` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  
  async loadUser(name) {
    try {
      const userData = await database.loadUser(name);
      
      if (userData) {
        this.currentUser = userData;
        this.recorder = new PersonalRecorder(this.currentUser);
        this.refreshAllDisplay();
        this.updateAdminUI();
        
        const userLabel = document.getElementById("currentUser");
        if (userLabel) userLabel.innerText = `当前用户: ${name}`;
        
        return { success: true, isNew: false };
      } else {
        return { success: false, error: `用户 "${name}" 不存在，请先注册` };
      }
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  
  // 更新管理员UI（显示/隐藏重新计算按钮）
  updateAdminUI() {
    const recalculateBtn = document.getElementById("recalculateBtn");
    const adminOnlyTip = document.getElementById("adminOnlyTip");
    
    if (this.currentUser && isAdmin(this.currentUser.name)) {
      // 管理员：显示按钮
      if (recalculateBtn) recalculateBtn.style.display = 'inline-flex';
      if (adminOnlyTip) adminOnlyTip.style.display = 'none';
    } else {
      // 普通用户：隐藏按钮，显示提示
      if (recalculateBtn) recalculateBtn.style.display = 'none';
      if (adminOnlyTip) adminOnlyTip.style.display = 'inline';
    }
  }
  
  // 更新最后计算时间显示
  updateLastCalculateTime() {
    const timeEl = document.getElementById("lastCalculateTime");
    if (!timeEl) return;
    
    const result = matchCalculator.getResult();
    if (result && result.calculateTime) {
      const time = new Date(result.calculateTime);
      const timeStr = time.toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      timeEl.innerText = `最后更新: ${timeStr}`;
      timeEl.style.display = 'block';
    } else {
      timeEl.style.display = 'none';
    }
  }

  async saveUser() {
    if (!this.currentUser) {
      return { success: false, error: "没有用户数据" };
    }

    try {
      await database.saveUser(this.currentUser);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ==============================================
  // 匹配相关
  // ==============================================
  
  /**
   * 加载匹配结果（自动处理缓存和计算）
   * 普通用户：从缓存/数据库读取今天的匹配结果
   * 管理员：可以强制重新计算
   */
  async loadMatchResult(forceRecalculate = false) {
    try {
      // 如果是强制重新计算，检查管理员权限
      if (forceRecalculate) {
        if (!this.currentUser || !isAdmin(this.currentUser.name)) {
          return { success: false, error: "只有管理员可以重新计算全局匹配" };
        }
      }
      
      // 获取匹配结果（会自动处理缓存逻辑）
      const result = await matchCalculator.getMatchResult(forceRecalculate);
      
      // 更新全局匹配显示
      const totalEl = document.getElementById("totalMatchPairs");
      if (totalEl) totalEl.innerText = result.getMatchCount();
      
      this.renderAllMatches(result);
      
      // 更新最后计算时间
      this.updateLastCalculateTime();
      
      // 如果当前有用户，同时刷新个人匹配
      if (this.currentUser) {
        this.loadMyMatches();
      }
      
      return { success: true, count: result.getMatchCount() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  
  /**
   * 管理员手动重新计算（供按钮调用）
   */
  async calculateAllMatches() {
    return await this.loadMatchResult(true);
  }

  loadMyMatches() {
    if (!this.currentUser) {
      this.renderMatches([]);
      return;
    }

    const myMatches = matchCalculator.getMatchesForUser(this.currentUser.name);
    this.renderMatches(myMatches);
  }

  // ==============================================
  // 渲染函数
  // ==============================================
  renderMatches(matches) {
    const el = document.getElementById("matchResult");
    if (!el) return;

    if (matches.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">😔</div>
          <div>暂无可行交换建议</div>
          <div style="font-size:12px;color:#999;margin-top:8px">
            可能是：1)没有互补需求 2)今日限额已用完 3)缺少其他用户数据
          </div>
        </div>
      `;
      return;
    }

    el.innerHTML = matches.map(m => {
      const givePuzzles = m.iGive.map(id => this.getPuzzleDisplayName(id)).join(", ");
      const getPuzzles = m.iGet.map(id => this.getPuzzleDisplayName(id)).join(", ");
      const exchangeCount = m.iGive.length + m.iGet.length;
      
      return `
      <div class="match-card ${exchangeCount >= 3 ? 'match-optimal' : 'match-normal'}">
        <div class="match-header">
          <div class="match-user">👤 ${m.partner}</div>
          <div class="match-score">可交换 ${exchangeCount} 张</div>
        </div>
        <div class="match-detail">
          ${m.iGive.length > 0 ? `<div>� 你给 ${m.partner}: <strong>${givePuzzles}</strong> (${m.iGive.length}张)</div>` : ''}
          ${m.iGet.length > 0 ? `<div>📥 你从 ${m.partner} 得: <strong>${getPuzzles}</strong> (${m.iGet.length}张)</div>` : ''}
        </div>
      </div>
    `}).join("");
  }

  renderAllMatches(result) {
    const el = document.getElementById("allMatchesResult");
    if (!el) return;

    const matches = result.matches || [];

    if (matches.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">😔</div>
          <div>暂无可行交换对</div>
          <div style="font-size:12px;color:#999;margin-top:8px">
            当前数据库中没有互补需求的用户组合
          </div>
        </div>
      `;
      return;
    }

    // 按配对分组显示
    const pairs = {};
    for (const match of matches) {
      const key = [match.sender, match.receiver].sort().join('⇄');
      if (!pairs[key]) {
        pairs[key] = {
          userA: match.sender,
          userB: match.receiver,
          aGive: [],
          bGive: []
        };
      }
      if (match.sender === pairs[key].userA) {
        pairs[key].aGive.push(match.puzzleId);
      } else {
        pairs[key].bGive.push(match.puzzleId);
      }
    }

    el.innerHTML = Object.values(pairs).map(m => {
      const aGivePuzzles = m.aGive.map(id => this.getPuzzleDisplayName(id)).join(", ") || '无';
      const bGivePuzzles = m.bGive.map(id => this.getPuzzleDisplayName(id)).join(", ") || '无';
      const exchangeCount = m.aGive.length + m.bGive.length;
      
      return `
      <div class="match-card ${exchangeCount >= 3 ? 'match-optimal' : 'match-normal'}">
        <div class="match-header">
          <div class="match-user">👤 ${m.userA} ⇄ 👤 ${m.userB}</div>
          <div class="match-score">可交换 ${exchangeCount} 张</div>
        </div>
        <div class="match-detail">
          <div>📤 ${m.userA} 给 ${m.userB}: <strong>${aGivePuzzles}</strong> (${m.aGive.length}张)</div>
          <div>� ${m.userB} 给 ${m.userA}: <strong>${bGivePuzzles}</strong> (${m.bGive.length}张)</div>
        </div>
      </div>
    `}).join("");
  }
  
  getPuzzleDisplayName(puzzleId) {
    const info = getPuzzleInfo(puzzleId);
    if (!info) return puzzleId;
    return `${info.categoryName}-${info.puzzleName}-${info.pieceNumber}`;
  }

  renderMembersList(users) {
    const el = document.getElementById("membersList");
    if (!el) return;

    if (!users || users.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <div>暂无成员数据</div>
        </div>
      `;
      return;
    }

    el.innerHTML = users.map(u => {
      const extraPuzzles = Object.entries(u.have || {})
        .filter(([_, c]) => c > 0)
        .map(([id, c]) => ({ id: id, count: c }));
      const wantList = u.want || [];

      // 限制显示数量
      const displayExtra = extraPuzzles.slice(0, 10);
      const displayWant = wantList.slice(0, 15);
      const extraMore = extraPuzzles.length > 10 ? `等${extraPuzzles.length}种` : '';
      const wantMore = wantList.length > 15 ? `等${wantList.length}种` : '';

      return `
        <div class="user-card">
          <div class="user-header">
            <span class="user-name">👤 ${u.name}</span>
            <span class="user-stats">多余: ${extraPuzzles.length}种 | 缺少: ${wantList.length}种</span>
          </div>
          <div style="font-size:12px;color:#666">
            <div style="margin-bottom:4px">🟢 多余拼图 ${extraMore}:</div>
            <div class="puzzle-tags">
              ${displayExtra.length > 0 
                ? displayExtra.map(p => `<span class="tag tag-have" title="${this.getPuzzleDisplayName(p.id)}">${this.getPuzzleShortName(p.id)}×${p.count}</span>`).join("") 
                : '<span style="color:#999">无</span>'}
            </div>
            <div style="margin:8px 0 4px">🔴 缺少拼图 ${wantMore}:</div>
            <div class="puzzle-tags">
              ${displayWant.length > 0 
                ? displayWant.map(id => `<span class="tag tag-want" title="${this.getPuzzleDisplayName(id)}">${this.getPuzzleShortName(id)}</span>`).join("") 
                : '<span style="color:#999">无</span>'}
            </div>
          </div>
        </div>
      `;
    }).join("");
  }
  
  getPuzzleShortName(puzzleId) {
    const info = getPuzzleInfo(puzzleId);
    if (!info) return puzzleId;
    // 简写格式: C1-P1-3 (大类1-小类1-第3个碎片)
    return `C${info.categoryId}-P${info.puzzleIndex}-${info.pieceNumber}`;
  }

  // ==============================================
  // 手动交易（简化版）- 支持层级展示
  // ==============================================
  renderManualExchangeOptions() {
    if (!this.currentUser) return;

    // 渲染"我要送出"选项
    const sendEl = document.getElementById("manualSend");
    if (sendEl) {
      this.renderPuzzleSelector(sendEl, this.currentUser.getExtraPuzzles(), "send");
    }

    // 渲染"我要收到"选项
    const receiveEl = document.getElementById("manualReceive");
    if (receiveEl) {
      const missingPuzzles = [];
      if (PUZZLE_DATA) {
        for (const category of PUZZLE_DATA.categories) {
          for (let pi = 0; pi < category.puzzles.length; pi++) {
            const puzzle = category.puzzles[pi];
            for (let pieceNum = 1; pieceNum <= puzzle.pieces; pieceNum++) {
              const puzzleId = generatePuzzleId(category.id, pi + 1, pieceNum);
              const count = this.currentUser.have[puzzleId] || 0;
              if (count === 0) {
                missingPuzzles.push({ 
                  id: puzzleId, 
                  inWant: this.currentUser.want.includes(puzzleId),
                  categoryId: category.id,
                  puzzleIndex: pi + 1,
                  pieceNum: pieceNum
                });
              }
            }
          }
        }
      }
      this.renderMissingPuzzleSelector(receiveEl, missingPuzzles);
    }

    this.updateManualSummary();
  }
  
  renderPuzzleSelector(container, puzzles, type) {
    container.innerHTML = "";
    
    if (puzzles.length === 0) {
      container.innerHTML = "<div style='color:#999;font-size:12px'>暂无</div>";
      return;
    }
    
    if (!PUZZLE_DATA) return;
    
    // 按类别分组
    for (const cat of PUZZLE_DATA.categories) {
      const catPuzzles = puzzles.filter(p => {
        const parsed = parsePuzzleId(p.id);
        return parsed.categoryId === cat.id;
      });
      
      if (catPuzzles.length === 0) continue;
      
      const catDiv = document.createElement("div");
      catDiv.style.cssText = "width:100%;margin-top:8px;margin-bottom:4px;font-size:12px;font-weight:bold;color:#555;";
      catDiv.innerText = cat.name;
      container.appendChild(catDiv);
      
      // 按小类分组
      for (let pi = 0; pi < cat.puzzles.length; pi++) {
        const subPuzzles = catPuzzles.filter(p => {
          const parsed = parsePuzzleId(p.id);
          return parsed.puzzleIndex === pi + 1;
        });
        
        if (subPuzzles.length === 0) continue;
        
        const puzzle = cat.puzzles[pi];
        const subDiv = document.createElement("div");
        subDiv.style.cssText = "width:100%;margin-bottom:4px;font-size:11px;color:#666;padding-left:8px;";
        subDiv.innerText = puzzle.name;
        
        const itemsDiv = document.createElement("div");
        itemsDiv.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;padding-left:8px;";
        
        for (const p of subPuzzles) {
          const div = document.createElement("div");
          div.className = "select-item";
          div.innerText = `${p.pieceNum}(${p.count})`;
          div.dataset.id = p.id;
          div.onclick = () => this.toggleManualSend(div, p.id);
          itemsDiv.appendChild(div);
        }
        
        container.appendChild(subDiv);
        container.appendChild(itemsDiv);
      }
    }
  }
  
  renderMissingPuzzleSelector(container, puzzles) {
    container.innerHTML = "";
    
    if (puzzles.length === 0) {
      container.innerHTML = "<div style='color:#999;font-size:12px'>暂无缺少的拼图</div>";
      return;
    }
    
    if (!PUZZLE_DATA) return;
    
    // 按类别分组
    for (const cat of PUZZLE_DATA.categories) {
      const catPuzzles = puzzles.filter(p => p.categoryId === cat.id);
      if (catPuzzles.length === 0) continue;
      
      const catDiv = document.createElement("div");
      catDiv.style.cssText = "width:100%;margin-top:8px;margin-bottom:4px;font-size:12px;font-weight:bold;color:#555;";
      catDiv.innerText = cat.name;
      container.appendChild(catDiv);
      
      // 按小类分组
      for (let pi = 0; pi < cat.puzzles.length; pi++) {
        const subPuzzles = catPuzzles.filter(p => p.puzzleIndex === pi + 1);
        if (subPuzzles.length === 0) continue;
        
        const puzzle = cat.puzzles[pi];
        const subDiv = document.createElement("div");
        subDiv.style.cssText = "width:100%;margin-bottom:4px;font-size:11px;color:#666;padding-left:8px;";
        subDiv.innerText = puzzle.name;
        
        const itemsDiv = document.createElement("div");
        itemsDiv.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;padding-left:8px;";
        
        for (const puzzle of subPuzzles) {
          const div = document.createElement("div");
          div.className = "select-item";
          div.innerText = `${puzzle.pieceNum}`;
          div.dataset.id = puzzle.id;
          
          // 如果在want列表中高亮显示
          if (puzzle.inWant) {
            div.style.borderColor = "#f44336";
            div.style.color = "#f44336";
          }
          
          div.onclick = () => this.toggleManualReceive(div, puzzle.id);
          itemsDiv.appendChild(div);
        }
        
        container.appendChild(subDiv);
        container.appendChild(itemsDiv);
      }
    }
  }
  
  toggleManualSend(el, id) {
    const idx = this.manualSendSelected.indexOf(id);
    if (idx === -1) {
      this.manualSendSelected.push(id);
      el.classList.add("selected");
    } else {
      this.manualSendSelected.splice(idx, 1);
      el.classList.remove("selected");
    }
    this.updateManualSummary();
  }
  
  toggleManualReceive(el, id) {
    const idx = this.manualReceiveSelected.indexOf(id);
    if (idx === -1) {
      this.manualReceiveSelected.push(id);
      el.classList.add("selected");
    } else {
      this.manualReceiveSelected.splice(idx, 1);
      el.classList.remove("selected");
    }
    this.updateManualSummary();
  }
  
  updateManualSummary() {
    const summary = document.getElementById("manualExchangeSummary");
    if (!summary) return;

    if (this.manualSendSelected.length === 0 && this.manualReceiveSelected.length === 0) {
      summary.innerText = "请选择要交换的拼图";
    } else {
      summary.innerText = `送出: ${this.manualSendSelected.length}张 | 收到: ${this.manualReceiveSelected.length}张`;
    }
  }
  
  async executeManualRecord() {
    if (!this.recorder) {
      alert("请先加载用户数据");
      return;
    }

    const results = {
      sent: [],
      received: [],
      errors: []
    };

    // 记录送出
    for (const id of this.manualSendSelected) {
      const result = this.recorder.recordSend(id);
      if (result.success) {
        results.sent.push(id);
      } else {
        results.errors.push(`送出 ${this.getPuzzleDisplayName(id)}: ${result.error}`);
      }
    }

    // 记录收到
    for (const id of this.manualReceiveSelected) {
      const result = this.recorder.recordReceive(id);
      if (result.success) {
        results.received.push(id);
      } else {
        results.errors.push(`收到 ${this.getPuzzleDisplayName(id)}: ${result.error}`);
      }
    }

    if (results.errors.length > 0) {
      alert("部分操作失败:\n" + results.errors.join("\n"));
    }

    if (results.sent.length > 0 || results.received.length > 0) {
      // 保存更新后的数据
      await this.saveUser();
      
      // 刷新显示
      this.refreshAllDisplay();
      this.renderManualExchangeOptions();
      
      // 清空选择
      this.manualSendSelected = [];
      this.manualReceiveSelected = [];
      this.updateManualSummary();
      
      alert(`操作成功！\n送出: ${results.sent.length}张\n收到: ${results.received.length}张`);
      
      // 重新计算匹配
      await this.calculateAllMatches();
    }
  }

  // ==============================================
  // 执行系统推荐的交换
  // ==============================================
  async executeMatchExchange(partnerName, iGive, iGet) {
    if (!confirm(`确认与 ${partnerName} 交换？\n你给出: ${iGive.map(id => this.getPuzzleDisplayName(id)).join(', ')}\n你得到: ${iGet.map(id => this.getPuzzleDisplayName(id)).join(', ')}`)) {
      return;
    }

    try {
      const executor = new ExchangeExecutor(database);
      await executor.executeTwoWayExchange(
        this.currentUser.name,
        partnerName,
        iGive,
        iGet
      );

      // 重新加载当前用户数据
      await this.loadUser(this.currentUser.name);
      
      // 重新计算匹配
      await this.calculateAllMatches();
      
      alert("交换成功！");
    } catch (e) {
      alert("交换失败: " + e.message);
    }
  }

  // ==============================================
  // 标签页切换
  // ==============================================
  switchTab(tabName, element) {
    this.currentTab = tabName;
    
    // 更新标签样式
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    
    if (element) {
      element.classList.add("active");
    }
    document.getElementById(`tab-${tabName}`).classList.add("active");

    // 标签页特定逻辑
    if (tabName === "members") {
      database.getAllUsers().then(users => this.renderMembersList(users));
    } else if (tabName === "manual") {
      this.renderManualExchangeOptions();
    } else if (tabName === "match") {
      if (this.currentUser) {
        this.loadMyMatches();
      }
    } else if (tabName === "allmatches") {
      this.calculateAllMatches();
    }
  }
  
  bindEvents() {
    // 全局事件绑定
  }
}

// 创建全局实例
const ui = new UIController();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UIController, ui };
}
