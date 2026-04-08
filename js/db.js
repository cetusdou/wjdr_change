/**
 * 数据库配置和操作模块
 * 封装所有 Firebase 数据库操作
 */

// ==============================================
// Firebase 配置
// ==============================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ==============================================
// 数据库管理类
// ==============================================
class Database {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.init();
  }

  // 初始化 Firebase
  init() {
    try {
      if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        this.db = firebase.firestore();
        this.isInitialized = true;
        console.log("Firebase 初始化成功");
      }
    } catch (e) {
      console.error("Firebase 初始化失败:", e);
      this.isInitialized = false;
    }
  }

  // 检查是否已配置
  checkConfig() {
    if (!this.isInitialized || !this.db) {
      throw new Error("Firebase 未配置，请先在 db.js 中设置 Firebase 配置");
    }
  }

  // ==============================================
  // 用户数据操作
  // ==============================================

  // 保存用户数据
  async saveUser(userData) {
    this.checkConfig();
    const docRef = this.db.collection("puzzleUsers").doc(userData.name);
    await docRef.set(userData.toObject());
    return true;
  }

  // 加载用户数据
  async loadUser(name) {
    this.checkConfig();
    const doc = await this.db.collection("puzzleUsers").doc(name).get();
    if (doc.exists) {
      return UserData.fromObject(doc.data());
    }
    return null;
  }

  // 获取所有用户
  async getAllUsers() {
    this.checkConfig();
    const snapshot = await this.db.collection("puzzleUsers").get();
    return snapshot.docs.map(doc => UserData.fromObject(doc.data()));
  }

  // 用户是否存在
  async userExists(name) {
    this.checkConfig();
    const doc = await this.db.collection("puzzleUsers").doc(name).get();
    return doc.exists;
  }

  // ==============================================
  // 批量操作（用于交换）
  // ==============================================

  // 批量保存多个用户
  async saveUsers(userDataList) {
    this.checkConfig();
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
    this.checkConfig();
    return this.db.collection("puzzleUsers").onSnapshot(snapshot => {
      const users = snapshot.docs.map(doc => UserData.fromObject(doc.data()));
      callback(users);
    });
  }

  // 监听单个用户数据变化
  onUserChange(name, callback) {
    this.checkConfig();
    return this.db.collection("puzzleUsers").doc(name).onSnapshot(doc => {
      if (doc.exists) {
        callback(UserData.fromObject(doc.data()));
      } else {
        callback(null);
      }
    });
  }
}

// 创建全局数据库实例
const database = new Database();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Database, database, firebaseConfig };
}
