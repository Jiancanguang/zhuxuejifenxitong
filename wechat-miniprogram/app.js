App({
  globalData: {
    // 修改为你的服务器地址（腾讯云服务器IP或域名）
    // 例如: https://your-domain.com
    // 注意：微信小程序正式版要求 HTTPS 域名，开发时可在开发者工具中关闭域名校验
    apiBaseUrl: 'https://your-server-domain.com',
    token: '',
    classId: '',
    classTitle: '',
    username: '',
    studentData: null,
  },

  onLaunch() {
    // 从本地存储恢复登录状态
    const token = wx.getStorageSync('parentToken');
    const classId = wx.getStorageSync('parentClassId');
    const classTitle = wx.getStorageSync('parentClassTitle');
    const username = wx.getStorageSync('parentUsername');
    if (token) {
      this.globalData.token = token;
      this.globalData.classId = classId;
      this.globalData.classTitle = classTitle;
      this.globalData.username = username;
    }
  },

  // 保存登录信息
  saveLogin(data) {
    this.globalData.token = data.token;
    this.globalData.classId = data.classId;
    this.globalData.classTitle = data.classTitle;
    this.globalData.username = data.username;
    wx.setStorageSync('parentToken', data.token);
    wx.setStorageSync('parentClassId', data.classId);
    wx.setStorageSync('parentClassTitle', data.classTitle);
    wx.setStorageSync('parentUsername', data.username);
  },

  // 清除登录信息
  clearLogin() {
    this.globalData.token = '';
    this.globalData.classId = '';
    this.globalData.classTitle = '';
    this.globalData.username = '';
    this.globalData.studentData = null;
    wx.removeStorageSync('parentToken');
    wx.removeStorageSync('parentClassId');
    wx.removeStorageSync('parentClassTitle');
    wx.removeStorageSync('parentUsername');
  },
});
