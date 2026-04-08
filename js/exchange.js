/**
 * 交换逻辑模块
 * 包含匹配计算和个人交易记录功能
 */

// ==============================================
// 全局匹配计算器（使用新的统筹分配算法）
// ==============================================
class MatchCalculator {
  constructor() {
    this.globalCalculator = new GlobalMatchCalculator();
    this.lastCalculateTime = null;
    this.cachedResult = null;
  }

  /**
   * 获取匹配结果（优先从缓存/数据库读取）
   * 如果今天还没有计算过，会自动计算并保存
   */
  async getMatchResult(forceRecalculate = false) {
    // 如果强制重新计算，或者是管理员手动触发
    if (forceRecalculate) {
      return await this.calculateAndSave();
    }
    
    // 先尝试从内存缓存读取
    if (this.cachedResult && this.isTodayResult(this.cachedResult)) {
      return this.cachedResult;
    }
    
    // 再尝试从数据库读取
    if (database.loadMatchResult) {
      try {
        const dbResult = await database.loadMatchResult();
        if (dbResult) {
          this.cachedResult = dbResult;
          this.lastCalculateTime = dbResult.calculateTime;
          return dbResult;
        }
      } catch (e) {
        console.warn("从数据库加载匹配结果失败:", e);
      }
    }
    
    // 数据库中没有今天的数据，需要重新计算
    return await this.calculateAndSave();
  }

  /**
   * 计算并保存匹配结果
   */
  async calculateAndSave() {
    // 确保 database 已定义
    if (typeof database === 'undefined' || !database) {
      throw new Error("数据库未初始化");
    }
    
    const users = await database.getAllUsers();
    const result = this.globalCalculator.calculate(users);
    
    // 保存到数据库
    if (database.saveMatchResult) {
      await database.saveMatchResult(result);
    } else {
      console.warn("database.saveMatchResult 不可用，匹配结果仅缓存在内存中");
    }
    
    // 更新缓存
    this.cachedResult = result;
    this.lastCalculateTime = new Date();
    
    return result;
  }

  /**
   * 检查缓存结果是否是今天的
   */
  isTodayResult(result) {
    if (!result || !result.calculateTime) return false;
    const resultDate = new Date(result.calculateTime).toISOString().split('T')[0];
    return resultDate === getToday();
  }

  /**
   * 手动触发重新计算（仅管理员可用）
   */
  async recalculate() {
    return await this.calculateAndSave();
  }

  // 获取与指定用户相关的匹配
  getMatchesForUser(userName) {
    if (!this.cachedResult) return [];
    return this.cachedResult.getMatchesForUser(userName);
  }

  // 获取匹配数量
  getMatchCount() {
    if (!this.cachedResult) return 0;
    return this.cachedResult.getMatchCount();
  }

  // 清除缓存
  clearCache() {
    this.globalCalculator = new GlobalMatchCalculator();
    this.lastCalculateTime = null;
    this.cachedResult = null;
  }

  // 获取原始结果
  getResult() {
    return this.cachedResult;
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
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MatchCalculator, PersonalRecorder };
}
