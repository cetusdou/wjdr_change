/**
 * 交换逻辑模块
 * 包含匹配计算和个人交易记录功能
 */

// ==============================================
// 全局匹配计算器
// ==============================================
class MatchCalculator {
  constructor() {
    this.allMatches = []; // 缓存的匹配结果
    this.lastCalculateTime = null;
  }

  // 计算所有用户间的匹配
  calculateAllMatches(users) {
    this.allMatches = [];
    
    if (users.length < 2) {
      return [];
    }

    // 双重循环计算所有配对
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const match = MatchResult.calculate(users[i], users[j]);
        if (match.isValid()) {
          this.allMatches.push(match);
        }
      }
    }

    // 按交换数量降序排序
    this.allMatches.sort((a, b) => b.exchangeCount - a.exchangeCount);
    this.lastCalculateTime = new Date();
    
    return this.allMatches;
  }

  // 获取与指定用户相关的匹配
  getMatchesForUser(userName) {
    return this.allMatches.filter(m => m.userA === userName || m.userB === userName);
  }

  // 获取匹配数量
  getMatchCount() {
    return this.allMatches.length;
  }

  // 清除缓存
  clearCache() {
    this.allMatches = [];
    this.lastCalculateTime = null;
  }
}

// ==============================================
// 个人交易记录器（简化版 - 不需要对方）
// ==============================================
class PersonalRecorder {
  constructor(userData) {
    this.user = userData;
  }

  // 记录收到拼图
  // 场景：用户从任何地方收到了一张拼图
  recordReceive(puzzleId) {
    // 检查收到限额
    const remainingRecv = this.user.getRemainingRecv();
    if (remainingRecv <= 0) {
      return {
        success: false,
        error: `今日收到限额已用完 (${CONFIG.DAILY_RECV_LIMIT}/${CONFIG.DAILY_RECV_LIMIT})`
      };
    }

    // 增加拼图数量
    const newCount = this.user.addPuzzle(puzzleId);
    
    // 记录收到
    this.user.recordReceived(1);

    return {
      success: true,
      puzzleId: puzzleId,
      newCount: newCount,
      remainingRecv: this.user.getRemainingRecv()
    };
  }

  // 批量记录收到拼图
  recordReceiveMultiple(puzzleIds) {
    const results = [];
    const successful = [];

    for (const id of puzzleIds) {
      const result = this.recordReceive(id);
      results.push(result);
      if (result.success) {
        successful.push(id);
      }
    }

    return {
      success: successful.length > 0,
      results: results,
      successful: successful,
      failed: puzzleIds.filter(id => !successful.includes(id))
    };
  }

  // 记录送出拼图
  // 场景：用户送出了一张拼图给任何地方
  recordSend(puzzleId) {
    // 检查送出限额
    const remainingSend = this.user.getRemainingSend();
    if (remainingSend <= 0) {
      return {
        success: false,
        error: `今日送出限额已用完 (${CONFIG.DAILY_SEND_LIMIT}/${CONFIG.DAILY_SEND_LIMIT})`
      };
    }

    // 减少拼图数量
    const removeResult = this.user.removePuzzle(puzzleId);
    if (!removeResult.success) {
      return removeResult;
    }

    // 记录送出
    this.user.recordSent(1);

    return {
      success: true,
      puzzleId: puzzleId,
      newCount: removeResult.newCount,
      remainingSend: this.user.getRemainingSend()
    };
  }

  // 批量记录送出拼图
  recordSendMultiple(puzzleIds) {
    const results = [];
    const successful = [];

    for (const id of puzzleIds) {
      const result = this.recordSend(id);
      results.push(result);
      if (result.success) {
        successful.push(id);
      }
    }

    return {
      success: successful.length > 0,
      results: results,
      successful: successful,
      failed: puzzleIds.filter(id => !successful.includes(id))
    };
  }

  // 撤销收到记录
  undoReceive(puzzleId) {
    const removeResult = this.user.removePuzzle(puzzleId);
    if (!removeResult.success) {
      return removeResult;
    }

    // 如果数量变少了，加回限额（可选，取决于业务逻辑）
    // 这里暂时不减限额，因为撤销通常需要管理员权限

    return {
      success: true,
      puzzleId: puzzleId,
      message: "已撤销收到记录（限额未恢复）"
    };
  }

  // 撤销送出记录
  undoSend(puzzleId) {
    this.user.addPuzzle(puzzleId);

    return {
      success: true,
      puzzleId: puzzleId,
      message: "已撤销送出记录（限额未恢复）"
    };
  }
}

// ==============================================
// 双人交换执行器（可选，用于系统推荐的一键交换）
// ==============================================
class ExchangeExecutor {
  constructor(db) {
    this.db = db;
  }

  // 执行双向交换
  async executeTwoWayExchange(userAName, userBName, aGive, aGet) {
    // 加载双方数据
    const [userA, userB] = await Promise.all([
      this.db.loadUser(userAName),
      this.db.loadUser(userBName)
    ]);

    if (!userA || !userB) {
      throw new Error("用户数据不存在");
    }

    // 验证交换可行性
    const validation = this.validateExchange(userA, userB, aGive, aGet);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 执行数据更新
    // A送出给B
    for (const id of aGive) {
      userA.removePuzzle(id);
      userB.addPuzzle(id);
    }

    // B送出给A
    for (const id of aGet) {
      userB.removePuzzle(id);
      userA.addPuzzle(id);
    }

    // 更新限额
    userA.recordSent(aGive.length);
    userA.recordReceived(aGet.length);
    userB.recordSent(aGet.length);
    userB.recordReceived(aGive.length);

    // 保存到数据库
    await this.db.saveUsers([userA, userB]);

    return {
      success: true,
      userA: userA.toObject(),
      userB: userB.toObject()
    };
  }

  // 验证交换是否可行
  validateExchange(userA, userB, aGive, aGet) {
    // 检查A是否有足够的拼图送出
    for (const id of aGive) {
      if ((userA.have[id] || 0) < 2) {
        return { valid: false, error: `${userA.name} 没有足够的拼图 #${id}` };
      }
    }

    // 检查B是否有足够的拼图送出
    for (const id of aGet) {
      if ((userB.have[id] || 0) < 2) {
        return { valid: false, error: `${userB.name} 没有足够的拼图 #${id}` };
      }
    }

    // 检查限额
    if (userA.getRemainingSend() < aGive.length) {
      return { valid: false, error: `${userA.name} 今日送出限额不足` };
    }
    if (userA.getRemainingRecv() < aGet.length) {
      return { valid: false, error: `${userA.name} 今日收到限额不足` };
    }
    if (userB.getRemainingSend() < aGet.length) {
      return { valid: false, error: `${userB.name} 今日送出限额不足` };
    }
    if (userB.getRemainingRecv() < aGive.length) {
      return { valid: false, error: `${userB.name} 今日收到限额不足` };
    }

    return { valid: true };
  }
}

// ==============================================
// 创建全局实例
// ==============================================
const matchCalculator = new MatchCalculator();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    MatchCalculator, 
    PersonalRecorder, 
    ExchangeExecutor,
    matchCalculator 
  };
}
