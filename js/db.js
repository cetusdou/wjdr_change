/**
 * 数据库配置和操作模块
 * 封装所有 Firebase 数据库操作
 */

// ==============================================
// 数据库管理类
// ==============================================
class Database {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.initAttempted = false;
    // 不再在构造函数中立即初始化，而是等待显式调用或延迟初始化
  }

  // 初始化 Firebase
  init() {
    // 防止重复初始化
    if (this.initAttempted) {
      return this.isInitialized;
    }
    this.initAttempted = true;
    
    try {
      console.log("正在检查 Firebase 配置...");
      
      // 检查全局的 firebaseConfig（从 firebase-config.js 加载）
      if (typeof firebaseConfig === 'undefined') {
        console.error("Firebase 配置未找到！请确保:");
        console.error("1. firebase-config.js 已正确加载");
        console.error("2. firebase-config.js 在 db.js 之前加载");
        this.isInitialized = false;
        return false;
      }
      console.log("✓ Firebase 配置已找到");
      
      if (typeof firebase === 'undefined') {
        console.error("Firebase SDK 未加载！请确保:");
        console.error("1. Firebase SDK 脚本已正确加载");
        console.error("2. Firebase SDK 在 firebase-config.js 之前加载");
        this.isInitialized = false;
        return false;
      }
      console.log("✓ Firebase SDK 已加载");
      
      // 检查是否已初始化
      if (firebase.apps && firebase.apps.length > 0) {
        this.db = firebase.firestore();
        this.isInitialized = true;
        console.log("✓ Firebase 已存在，直接使用");
        return true;
      }
      
      // 初始化 Firebase
      console.log("正在初始化 Firebase App...");
      firebase.initializeApp(firebaseConfig);
      this.db = firebase.firestore();
      this.isInitialized = true;
      console.log("✓ Firebase 初始化成功");
      return true;
      
    } catch (e) {
      console.error("✗ Firebase 初始化失败:", e);
      this.isInitialized = false;
      return false;
    }
  }

  // 确保已初始化（异步）
  async ensureInitialized() {
    if (this.isInitialized) {
      return true;
    }
    
    // 尝试初始化
    if (this.init()) {
      return true;
    }
    
    // 如果失败，等待一段时间后重试（最多3次）
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (this.init()) {
        return true;
      }
    }
    
    return false;
  }

  // 检查是否已配置
  async checkConfig() {
    const initialized = await this.ensureInitialized();
    if (!initialized || !this.db) {
      throw new Error("Firebase 未配置，请检查 firebase-config.js 是否正确加载");
    }
  }

  // ==============================================
  // 用户注册/创建
  // ==============================================

  // 检查用户是否存在
  async userExists(name) {
    await this.checkConfig();
    const doc = await this.db.collection("puzzleUsers").doc(name).get();
    return doc.exists;
  }

  // 注册新用户
  async registerUser(name) {
    await this.checkConfig();
    
    // 检查用户是否已存在
    const exists = await this.userExists(name);
    if (exists) {
      throw new Error(`用户 "${name}" 已存在，请直接登录`);
    }

    // 创建新用户数据
    const newUser = new UserData(name);
    
    // 保存到数据库
    await this.db.collection("puzzleUsers").doc(name).set(newUser.toObject());
    
    return newUser;
  }

  // ==============================================
  // 用户数据操作
  // ==============================================

  // 保存用户数据
  async saveUser(userData) {
    await this.checkConfig();
    const docRef = this.db.collection("puzzleUsers").doc(userData.name);
    await docRef.set(userData.toObject());
    return true;
  }

  // 加载用户数据
  async loadUser(name) {
    await this.checkConfig();
    const doc = await this.db.collection("puzzleUsers").doc(name).get();
    if (doc.exists) {
      return UserData.fromObject(doc.data());
    }
    return null;
  }

  // 获取所有用户
  async getAllUsers() {
    await this.checkConfig();
    const snapshot = await this.db.collection("puzzleUsers").get();
    return snapshot.docs.map(doc => UserData.fromObject(doc.data()));
  }

  // ==============================================
  // 批量操作（用于交换）
  // ==============================================

  // 批量保存多个用户
  async saveUsers(userDataList) {
    await this.checkConfig();
    const batch = this.db.batch();
    
    for (const userData of userDataList) {
      const docRef = this.db.collection("puzzleUsers").doc(userData.name);
      batch.set(docRef, userData.toObject());
    }
    
    await batch.commit();
    return true;
  }

  // ==============================================
  // 监听功能（实时更新）
  // ==============================================

  // 监听所有用户数据变化
  onAllUsersChange(callback) {
    this.ensureInitialized().then(() => {
      if (!this.db) {
        console.error("Firebase 未初始化，无法监听用户变化");
        return;
      }
      return this.db.collection("puzzleUsers").onSnapshot(snapshot => {
        const users = snapshot.docs.map(doc => UserData.fromObject(doc.data()));
        callback(users);
      });
    });
  }

  // 监听单个用户数据变化
  onUserChange(name, callback) {
    this.ensureInitialized().then(() => {
      if (!this.db) {
        console.error("Firebase 未初始化，无法监听用户变化");
        return;
      }
      return this.db.collection("puzzleUsers").doc(name).onSnapshot(doc => {
        if (doc.exists) {
          callback(UserData.fromObject(doc.data()));
        } else {
          callback(null);
        }
      });
    });
  }

  // ==============================================
  // 匹配结果缓存操作
  // ==============================================

  // 保存匹配结果到数据库
  async saveMatchResult(matchResult) {
    await this.checkConfig();
    
    const data = {
      date: getToday(),
      calculateTime: new Date().toISOString(),
      matchCount: matchResult.getMatchCount(),
      matches: matchResult.matches.map(m => ({
        sender: m.sender,
        receiver: m.receiver,
        puzzleId: m.puzzleId
      }))
    };
    
    await this.db.collection("system").doc("matchResult").set(data);
    return true;
  }

  // 从数据库加载匹配结果
  async loadMatchResult() {
    await this.checkConfig();
    
    const doc = await this.db.collection("system").doc("matchResult").get();
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    
    // 检查是否是今天的数据
    if (data.date !== getToday()) {
      return null; // 过期数据
    }
    
    // 重建 GlobalMatchResult 对象
    const result = new GlobalMatchResult();
    result.calculateTime = new Date(data.calculateTime);
    
    for (const m of data.matches) {
      result.addMatch(new MatchPair(m.sender, m.receiver, m.puzzleId));
    }
    
    return result;
  }

  // 检查是否需要重新计算（今天是否已计算过）
  async shouldRecalculate() {
    await this.checkConfig();
    
    const doc = await this.db.collection("system").doc("matchResult").get();
    if (!doc.exists) {
      return true; // 从未计算过
    }
    
    const data = doc.data();
    return data.date !== getToday(); // 如果不是今天的数据，需要重新计算
  }
}

// 创建全局数据库实例
const database = new Database();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Database, database };
}
