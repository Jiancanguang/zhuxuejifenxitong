const app = getApp();

Page({
  data: {
    loading: true,
  },

  onLoad() {
    const token = app.globalData.token;
    if (token) {
      this.setData({ loading: false });
      wx.redirectTo({ url: '/pages/studentDetail/studentDetail' });
    } else {
      this.setData({ loading: false });
    }
  },

  onShow() {
    if (app.globalData.token) {
      wx.redirectTo({ url: '/pages/studentDetail/studentDetail' });
    }
  },

  goToLogin() {
    wx.navigateTo({ url: '/pages/bindStudent/bindStudent' });
  },
});
