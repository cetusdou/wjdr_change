/**
 * Firebase 配置
 * 注意：这个文件需要在 Firebase SDK 之后、db.js 之前加载
 */

// 使用 var 而不是 const，确保在全局作用域中
var firebaseConfig = {
  apiKey: "AIzaSyDhHs7kZ7KXpBvKZOEMd3zK1Es2ruI2c_0",
  authDomain: "wjdr-change.firebaseapp.com",
  projectId: "wjdr-change",
  storageBucket: "wjdr-change.firebasestorage.app",
  messagingSenderId: "618241342586",
  appId: "1:618241342586:web:93e1ac94ed8dac096f6fc3",
  measurementId: "G-F263PF0VKP"
};

// 导出模块（用于 Node.js 测试）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { firebaseConfig };
}
