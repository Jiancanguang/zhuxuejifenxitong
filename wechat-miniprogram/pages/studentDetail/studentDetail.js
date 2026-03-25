const api = require('../../utils/api');
const util = require('../../utils/util');
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
    recentRecords: [],
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    // 每次显示时刷新数据
    if (!this.data.loading && app.globalData.accessCode) {
      this.loadData();
    }
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadData() {
    const code = app.globalData.accessCode;
    if (!code) {
      wx.redirectTo({ url: '/pages/index/index' });
      return;
    }

    this.setData({ loading: true, error: '' });

    try {
      // 并行请求学生信息和排名
      const [studentData, rankingData, historyData] = await Promise.all([
        api.getStudentByCode(code),
        api.getStudentRanking(code),
        api.getStudentHistory(code, 1, 5),
      ]);

      const { student, badges } = studentData;
      const classInfo = studentData.class;
      const thresholds = classInfo.stageThresholds || [0, 5, 10, 20, 30, 45, 60, 75, 90, 100];
      const stage = student.petStage || util.calculateStage(student.foodCount, thresholds);
      const progress = util.getStageProgress(student.foodCount, stage, thresholds);
      const stageName = util.getStageName(stage);
      const nextThreshold = stage < thresholds.length ? thresholds[stage] : thresholds[thresholds.length - 1];

      // 处理最近记录
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
        stageProgress: progress,
        stageName,
        nextThreshold,
        recentRecords,
      });

      // 缓存数据
      app.globalData.studentData = studentData;
    } catch (err) {
      if (err.message.includes('无效') || err.message.includes('过期')) {
        // 查看码失效，清除缓存
        app.globalData.accessCode = '';
        app.globalData.studentData = null;
        wx.removeStorageSync('parentAccessCode');
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

  handleUnbind() {
    wx.showModal({
      title: '解除绑定',
      content: '解除绑定后需重新输入查看码才能查看，确定解除吗？',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          app.globalData.accessCode = '';
          app.globalData.studentData = null;
          wx.removeStorageSync('parentAccessCode');
          wx.redirectTo({ url: '/pages/index/index' });
        }
      },
    });
  },
});
