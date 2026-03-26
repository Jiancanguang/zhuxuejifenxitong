const api = require('../../utils/api');
const util = require('../../utils/util');
const pets = require('../../utils/pets');
const app = getApp();

Page({
  data: {
    loading: true,
    error: '',
    student: null,
    classInfo: null,
    badges: [],
    ranking: null,
    stageProgress: 0,
    stageName: '',
    nextThreshold: 0,
    petImageUrl: '',
    recentRecords: [],
    username: '',
  },

  onLoad() {
    this.setData({ username: app.globalData.username || '' });
    this.loadData();
  },

  onShow() {
    if (!this.data.loading && app.globalData.token) {
      this.loadData();
    }
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadData() {
    const token = app.globalData.token;
    if (!token) {
      wx.redirectTo({ url: '/pages/index/index' });
      return;
    }

    this.setData({ loading: true, error: '' });

    try {
      const [studentData, rankingData, historyData] = await Promise.all([
        api.getStudentInfo(),
        api.getStudentRanking(),
        api.getStudentHistory(1, 5),
      ]);

      const { student, badges } = studentData;
      const classInfo = studentData.class;
      const thresholds = classInfo.stageThresholds || [0, 5, 10, 20, 30, 45, 60, 75, 90, 100];
      const stage = student.petStage || util.calculateStage(student.foodCount, thresholds);
      const progress = util.getStageProgress(student.foodCount, stage, thresholds);
      const stageName = util.getStageName(stage);
      const nextThreshold = stage < thresholds.length ? thresholds[stage] : thresholds[thresholds.length - 1];

      // 宠物图片 URL
      const petImageUrl = student.petId ? pets.getPetImageUrl(app.globalData.apiBaseUrl, student.petId, stage) : '';

      const recentRecords = (historyData.records || []).map(r => ({
        ...r,
        typeText: util.getRecordTypeText(r.type),
        timeText: util.formatRelativeTime(r.timestamp),
        isPositive: r.type === 'checkin' && (r.scoreValue || 0) > 0,
        isNegative: r.type === 'checkin' && (r.scoreValue || 0) < 0,
        isRedeem: r.type === 'redeem',
        isGraduate: r.type === 'graduate',
        displayValue: r.type === 'redeem' ? `-${r.cost}` : (r.scoreValue > 0 ? `+${r.scoreValue}` : `${r.scoreValue}`),
      }));

      this.setData({
        loading: false,
        student,
        classInfo,
        badges,
        ranking: rankingData,
        stageProgress: Math.round(progress),
        stageName,
        nextThreshold,
        petImageUrl,
        recentRecords,
      });

      app.globalData.studentData = studentData;
    } catch (err) {
      if (err.message.includes('过期') || err.message.includes('重新登录')) {
        app.clearLogin();
        wx.redirectTo({ url: '/pages/index/index' });
        return;
      }
      this.setData({ loading: false, error: err.message || '加载失败' });
    }
  },

  goToHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  goToBadges() {
    wx.navigateTo({ url: '/pages/badges/badges' });
  },

  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需重新登录，确定退出吗？',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          app.clearLogin();
          wx.redirectTo({ url: '/pages/index/index' });
        }
      },
    });
  },
});
