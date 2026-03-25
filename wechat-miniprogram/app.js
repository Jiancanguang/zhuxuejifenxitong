App({
  globalData: {
    // 修改为你的服务器地址（腾讯云服务器IP或域名）
    // 例如: https://your-domain.com 或 https://1.2.3.4:3001
    // 注意：微信小程序正式版要求 HTTPS 域名，开发时可在开发者工具中关闭域名校验
    apiBaseUrl: 'https://your-server-domain.com',
    accessCode: '',
    studentData: null,
  },

  onLaunch() {
    // 从本地存储恢复查看码
    const code = wx.getStorageSync('parentAccessCode');
    if (code) {
      this.globalData.accessCode = code;
    }
  },
});
