/**
 * 数据结构定义模块
 * 定义用户数据结构和常量配置
 */

// ==============================================
// 常量配置
// ==============================================
const CONFIG = {
  DAILY_SEND_LIMIT: 5,    // 每日送出上限（仅用于匹配计算）
  DAILY_RECV_LIMIT: 3,    // 每日收到上限（仅用于匹配计算）
  CATEGORIES: [],         // 将在初始化时填充
  
  // 管理员账号
  ADMIN_NAME: '一只荔枝',
  
  // 计算总拼图数
  get TOTAL_PUZZLE() {
    if (typeof getTotalPuzzleCount === 'function') {
      return getTotalPuzzleCount();
    }
    return 0;
  },
  
  // 获取拼图信息
  getPuzzleInfo: function(id) {
    if (typeof getPuzzleInfo === 'function') {
      return getPuzzleInfo(id);
    }
    return null;
  }
};

// ==============================================
// 用户数据类
// ==============================================
class UserData {
  constructor(name = "") {
    this.name = name;
    this.have = {};        // { puzzleId: count } - 拥有的拼图及数量
    this.want = [];        // [ puzzleId ] - 缺少的拼图列表
    this.dailyLimit = {    // 每日限额记录
      date: getToday(),
      sent: 0,
      received: 0
    };
    this.updateTime = new Date().toISOString();
  }

  // 静态方法：从普通对象创建 UserData 实例
  static fromObject(obj) {
    const user = new UserData(obj.name);
    user.have = obj.have || {};
    user.want = obj.want || [];
    user.dailyLimit = obj.dailyLimit || { date: getToday(), sent: 0, received: 0 };
    user.updateTime = obj.updateTime || new Date().toISOString();
    return user;
  }

  // 序列化为普通对象（用于保存到数据库）
  toObject() {
    return {
      name: this.name,
      have: this.have,
      want: this.want,
      dailyLimit: this.dailyLimit,
      updateTime: new Date().toISOString()
    };
  }

  // 检查并刷新每日限额
  refreshDailyLimit() {
    const today = getToday();
    if (this.dailyLimit.date !== today) {
      this.dailyLimit = { date: today, sent: 0, received: 0 };
      return true; // 已重置
    }
    return false; // 未重置
  }

  // 获取今日剩余送出限额
  getRemainingSend() {
    this.refreshDailyLimit();
    return CONFIG.DAILY_SEND_LIMIT - this.dailyLimit.sent;
  }

  // 获取今日剩余收到限额
  getRemainingRecv() {
    this.refreshDailyLimit();
    return CONFIG.DAILY_RECV_LIMIT - this.dailyLimit.received;
  }

  // 获取多余拼图列表（数量>0的，表示可送出的）
  getExtraPuzzles() {
    return Object.entries(this.have)
      .filter(([_, count]) => count > 0)
      .map(([id, count]) => ({ id: id, count }));
  }

  // 获取拥有的拼图列表（数量>0的）
  getOwnedPuzzles() {
    return Object.entries(this.have)
      .filter(([_, count]) => count > 0)
      .map(([id, count]) => ({ id: id, count }));
  }

  // 增加拼图数量（收到拼图时使用）
  addPuzzle(puzzleId) {
    this.have[puzzleId] = (this.have[puzzleId] || 0) + 1;
    
    // 如果从want列表中收到了，移除它
    const wantIdx = this.want.indexOf(puzzleId);
    if (wantIdx !== -1) {
      this.want.splice(wantIdx, 1);
    }
    
    this.updateTime = new Date().toISOString();
    return this.have[puzzleId];
  }

  // 减少拼图数量（送出拼图时使用）
  removePuzzle(puzzleId) {
    const current = this.have[puzzleId] || 0;
    
    if (current <= 0) {
      return { success: false, error: `没有该拼图` };
    }
    
    this.have[puzzleId] = current - 1;
    if (this.have[puzzleId] === 0) {
      delete this.have[puzzleId];
    }
    
    this.updateTime = new Date().toISOString();
    return { success: true, newCount: this.have[puzzleId] || 0 };
  }

  // 标记缺少的拼图
  addWant(puzzleId) {
    if (!this.want.includes(puzzleId)) {
      this.want.push(puzzleId);
      this.updateTime = new Date().toISOString();
    }
  }

  // 移除缺少标记
  removeWant(puzzleId) {
    const idx = this.want.indexOf(puzzleId);
    if (idx !== -1) {
      this.want.splice(idx, 1);
      this.updateTime = new Date().toISOString();
    }
  }

  // 记录送出（增加限额计数）
  recordSent(count = 1) {
    this.refreshDailyLimit();
    this.dailyLimit.sent += count;
    this.updateTime = new Date().toISOString();
    return this.getRemainingSend();
  }

  // 记录收到（增加限额计数）
  recordReceived(count = 1) {
    this.refreshDailyLimit();
    this.dailyLimit.received += count;
    this.updateTime = new Date().toISOString();
    return this.getRemainingRecv();
  }
}

// ==============================================
// 全局匹配结果类（统筹分配）
// ==============================================
class GlobalMatchResult {
  constructor() {
    this.matches = [];      // 所有匹配对 [MatchPair]
    this.calculateTime = new Date();
  }

  // 添加一个匹配对
  addMatch(matchPair) {
    this.matches.push(matchPair);
  }

  // 获取与指定用户相关的匹配（按对方分组）
  getMatchesForUser(userName) {
    const userMatches = this.matches.filter(m => m.sender === userName || m.receiver === userName);
    
    // 按对方分组
    const grouped = {};
    for (const match of userMatches) {
      const partner = match.sender === userName ? match.receiver : match.sender;
      if (!grouped[partner]) {
        grouped[partner] = {
          partner: partner,
          iGive: [],
          iGet: []
        };
      }
      
      if (match.sender === userName) {
        // 我给对方
        grouped[partner].iGive.push(match.puzzleId);
      } else {
        // 我从对方得到
        grouped[partner].iGet.push(match.puzzleId);
      }
    }
    
    return Object.values(grouped);
  }

  // 获取匹配数量
  getMatchCount() {
    return this.matches.length;
  }
}

// ==============================================
// 匹配对类（单向：sender给receiver一张拼图）
// ==============================================
class MatchPair {
  constructor(sender, receiver, puzzleId) {
    this.sender = sender;       // 送出者
    this.receiver = receiver;   // 接收者
    this.puzzleId = puzzleId;   // 拼图ID
  }
}

// ==============================================
// 全局匹配计算器（统筹分配，防止重复）
// ==============================================
class GlobalMatchCalculator {
  constructor() {
    this.result = null;
  }

  /**
   * 计算全局最优匹配
   * 核心约束：
   * 1. 同一张拼图（来自同一个sender的同一个puzzleId）只能送给一个人
   * 2. 同一个人（receiver）不能从多人收到同一张拼图（同一个puzzleId）
   * 3. 受每日送出/收到限额限制
   * 
   * 算法思路：
   * - 构建"供应"列表：谁有什么拼图可以送出多少张
   * - 构建"需求"列表：谁想要什么拼图
   * - 贪心匹配：优先匹配供需平衡的
   */
  calculate(users) {
    const result = new GlobalMatchResult();
    
    if (users.length < 2) {
      return result;
    }

    // 转换为UserData对象
    const userObjects = users.map(u => {
      if (u instanceof UserData) return u;
      return UserData.fromObject(u);
    });

    // 追踪每个用户的剩余送出/收到限额
    const userLimits = {};
    for (const user of userObjects) {
      userLimits[user.name] = {
        remainingSend: user.getRemainingSend(),
        remainingRecv: user.getRemainingRecv()
      };
    }

    // 追踪每张拼图已经被分配了多少张（从某个sender送出的数量）
    // puzzleAllocations[senderName][puzzleId] = 已分配数量
    const puzzleAllocations = {};
    for (const user of userObjects) {
      puzzleAllocations[user.name] = {};
      for (const { id, count } of user.getExtraPuzzles()) {
        puzzleAllocations[user.name][id] = 0; // 已分配0张
      }
    }

    // 追踪每个receiver已经收到了哪些拼图（防止重复收到同一张）
    // receiverPuzzles[receiverName][puzzleId] = true
    const receiverPuzzles = {};
    for (const user of userObjects) {
      receiverPuzzles[user.name] = {};
    }

    // 构建所有可能的匹配（供需对）
    // 格式: { sender, receiver, puzzleId, priority }
    const possibleMatches = [];
    
    for (const sender of userObjects) {
      const extraPuzzles = sender.getExtraPuzzles();
      
      for (const { id: puzzleId, count } of extraPuzzles) {
        // 找到所有想要这个拼图的人
        for (const receiver of userObjects) {
          if (sender.name === receiver.name) continue; // 不能送给自己
          
          if (receiver.want.includes(puzzleId)) {
            // 计算优先级：双方限额充足程度
            const senderLimit = userLimits[sender.name].remainingSend;
            const receiverLimit = userLimits[receiver.name].remainingRecv;
            
            // 优先级 = 双方剩余限额之和（越大越优先）
            const priority = senderLimit + receiverLimit;
            
            possibleMatches.push({
              sender: sender.name,
              receiver: receiver.name,
              puzzleId: puzzleId,
              priority: priority,
              senderLimit: senderLimit,
              receiverLimit: receiverLimit
            });
          }
        }
      }
    }

    // 按优先级降序排序
    possibleMatches.sort((a, b) => b.priority - a.priority);

    // 贪心匹配
    for (const match of possibleMatches) {
      const { sender, receiver, puzzleId } = match;
      
      // 检查sender是否还有送出限额
      if (userLimits[sender].remainingSend <= 0) continue;
      
      // 检查receiver是否还有收到限额
      if (userLimits[receiver].remainingRecv <= 0) continue;
      
      // 检查sender的这张拼图是否还有剩余可送
      const senderObj = userObjects.find(u => u.name === sender);
      const senderHaveCount = senderObj.have[puzzleId] || 0;
      const senderAllocated = puzzleAllocations[sender][puzzleId] || 0;
      if (senderAllocated >= senderHaveCount) continue;
      
      // 检查receiver是否已经收到过这张拼图
      if (receiverPuzzles[receiver][puzzleId]) continue;
      
      // 执行匹配
      result.addMatch(new MatchPair(sender, receiver, puzzleId));
      
      // 更新限额
      userLimits[sender].remainingSend--;
      userLimits[receiver].remainingRecv--;
      
      // 更新拼图分配记录
      puzzleAllocations[sender][puzzleId] = (puzzleAllocations[sender][puzzleId] || 0) + 1;
      
      // 更新receiver已收到的拼图记录
      receiverPuzzles[receiver][puzzleId] = true;
    }

    this.result = result;
    return result;
  }

  // 获取计算结果
  getResult() {
    return this.result;
  }
}

// ==============================================
// 旧的匹配结果类（保留用于兼容性）
// ==============================================
class MatchResult {
  constructor(userA, userB) {
    this.userA = userA;     // 用户A名称
    this.userB = userB;     // 用户B名称
    this.aGive = [];        // A给B的拼图ID列表
    this.aGet = [];         // A从B得到的拼图ID列表
    this.exchangeCount = 0; // 交换数量
    this.aRemaining = { send: 0, recv: 0 };
    this.bRemaining = { send: 0, recv: 0 };
  }

  // 从两个用户数据计算匹配（旧方法，现在只用于显示）
  static calculate(userA, userB) {
    const match = new MatchResult(userA.name, userB.name);
    
    // 刷新限额
    userA.refreshDailyLimit();
    userB.refreshDailyLimit();
    
    // 剩余限额
    match.aRemaining = {
      send: CONFIG.DAILY_SEND_LIMIT - userA.dailyLimit.sent,
      recv: CONFIG.DAILY_RECV_LIMIT - userA.dailyLimit.received
    };
    match.bRemaining = {
      send: CONFIG.DAILY_SEND_LIMIT - userB.dailyLimit.sent,
      recv: CONFIG.DAILY_RECV_LIMIT - userB.dailyLimit.received
    };
    
    // A可以给B的：A有多余的 且 B想要的
    for (const { id, count } of userA.getExtraPuzzles()) {
      if (userB.want.includes(id)) {
        for (let i = 0; i < count; i++) {
          match.aGive.push(id);
        }
      }
    }
    
    // B可以给A的：B有多余的 且 A想要的
    for (const { id, count } of userB.getExtraPuzzles()) {
      if (userA.want.includes(id)) {
        for (let i = 0; i < count; i++) {
          match.aGet.push(id);
        }
      }
    }
    
    // 计算单向交换数量
    const aGiveCount = Math.min(
      match.aGive.length,
      match.aRemaining.send,
      match.bRemaining.recv
    );
    
    const bGiveCount = Math.min(
      match.aGet.length,
      match.bRemaining.send,
      match.aRemaining.recv
    );
    
    match.exchangeCount = aGiveCount + bGiveCount;
    match.aGive = match.aGive.slice(0, aGiveCount);
    match.aGet = match.aGet.slice(0, bGiveCount);
    
    return match;
  }

  // 是否有效匹配
  isValid() {
    return this.exchangeCount > 0;
  }

  // 获取以指定用户为视角的匹配信息
  getPerspective(userName) {
    const isUserA = this.userA === userName;
    return {
      partner: isUserA ? this.userB : this.userA,
      iGive: isUserA ? this.aGive : this.aGet,
      iGet: isUserA ? this.aGet : this.aGive,
      exchangeCount: this.exchangeCount,
      myRemaining: isUserA ? this.aRemaining : this.bRemaining,
      partnerRemaining: isUserA ? this.bRemaining : this.aRemaining
    };
  }
}

// ==============================================
// 工具函数
// ==============================================
function getToday() {
  return new Date().toISOString().split('T')[0];
}

// 检查是否为管理员
function isAdmin(userName) {
  return userName === CONFIG.ADMIN_NAME;
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    CONFIG, 
    UserData, 
    MatchResult, 
    GlobalMatchResult,
    GlobalMatchCalculator,
    MatchPair,
    getToday,
    isAdmin
  };
}
