const app = getApp();

Page({
  data: {
    hasCode: false,
    loading: true,
  },

  onLoad() {
    const code = app.globalData.accessCode;
    if (code) {
      // 已有查看码，直接跳转到详情页
      this.setData({ hasCode: true, loading: false });
      wx.redirectTo({ url: '/pages/studentDetail/studentDetail' });
    } else {
      this.setData({ loading: false });
    }
  },

  onShow() {
    const code = app.globalData.accessCode;
    if (code) {
      wx.redirectTo({ url: '/pages/studentDetail/studentDetail' });
    }
  },

  goToBind() {
    wx.navigateTo({ url: '/pages/bindStudent/bindStudent' });
  },
});
