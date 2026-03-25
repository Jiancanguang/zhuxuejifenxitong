const util = require('../../utils/util');
const app = getApp();

Page({
  data: {
    badges: [],
    studentName: '',
  },

  onLoad() {
    const studentData = app.globalData.studentData;
    if (!studentData) {
      wx.redirectTo({ url: '/pages/index/index' });
      return;
    }

    const badges = (studentData.badges || []).map(b => ({
      ...b,
      earnedDate: util.formatDate(b.earnedAt),
      earnedTime: util.formatTime(b.earnedAt),
    }));

    this.setData({
      badges,
      studentName: studentData.student.name,
    });
  },
});
