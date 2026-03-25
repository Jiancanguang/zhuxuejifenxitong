const api = require('../../utils/api');
const app = getApp();

Page({
  data: {
    code: '',
    loading: false,
    error: '',
  },

  onCodeInput(e) {
    const value = e.detail.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    this.setData({ code: value, error: '' });
  },

  async onSubmit() {
    const code = this.data.code.trim();
    if (code.length !== 6) {
      this.setData({ error: '请输入6位查看码' });
      return;
    }

    this.setData({ loading: true, error: '' });

    try {
      const data = await api.getStudentByCode(code);

      // 保存到全局和本地存储
      app.globalData.accessCode = code;
      app.globalData.studentData = data;
      wx.setStorageSync('parentAccessCode', code);

      wx.showToast({
        title: '绑定成功',
        icon: 'success',
        duration: 1500,
      });

      setTimeout(() => {
        wx.redirectTo({ url: '/pages/studentDetail/studentDetail' });
      }, 1500);
    } catch (err) {
      this.setData({
        error: err.message || '查看码无效，请重新输入',
        loading: false,
      });
    }
  },
});
