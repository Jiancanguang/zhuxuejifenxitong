const api = require('../../utils/api');
const util = require('../../utils/util');
const app = getApp();

Page({
  data: {
    loading: true,
    loadingMore: false,
    records: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
    hasMore: true,
    error: '',
  },

  onLoad() {
    this.loadRecords();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, records: [], hasMore: true });
    this.loadRecords().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMore();
    }
  },

  async loadRecords() {
    if (!app.globalData.token) {
      wx.redirectTo({ url: '/pages/index/index' });
      return;
    }

    this.setData({ loading: true, error: '' });

    try {
      const data = await api.getStudentHistory(1, this.data.pageSize);
      const records = this.formatRecords(data.records || []);

      this.setData({
        loading: false,
        records,
        page: 1,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
        hasMore: data.pagination.page < data.pagination.totalPages,
      });
    } catch (err) {
      this.setData({ loading: false, error: err.message });
    }
  },

  async loadMore() {
    const nextPage = this.data.page + 1;
    this.setData({ loadingMore: true });

    try {
      const data = await api.getStudentHistory(nextPage, this.data.pageSize);
      const newRecords = this.formatRecords(data.records || []);

      this.setData({
        loadingMore: false,
        records: [...this.data.records, ...newRecords],
        page: nextPage,
        hasMore: nextPage < data.pagination.totalPages,
      });
    } catch (err) {
      this.setData({ loadingMore: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  formatRecords(records) {
    return records.map(r => ({
      ...r,
      typeText: util.getRecordTypeText(r.type),
      timeText: util.formatTime(r.timestamp),
      relativeTime: util.formatRelativeTime(r.timestamp),
      isPositive: r.type === 'checkin' && (r.scoreValue || 0) > 0,
      isNegative: r.type === 'checkin' && (r.scoreValue || 0) < 0,
      isRedeem: r.type === 'redeem',
      isGraduate: r.type === 'graduate',
      displayValue: r.type === 'redeem' ? `-${r.cost}` : (r.scoreValue > 0 ? `+${r.scoreValue}` : `${r.scoreValue}`),
      description: r.type === 'checkin' ? r.scoreItemName :
                   r.type === 'redeem' ? `兑换 ${r.rewardName}` :
                   r.type === 'graduate' ? '宠物毕业' : '',
    }));
  },
});
