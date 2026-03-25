const api = require('../../utils/api');
const app = getApp();

Page({
  data: {
    // 步骤: 1=搜索班级, 2=输入账号密码
    step: 1,
    // 班级搜索
    classKeyword: '',
    classList: [],
    searchLoading: false,
    searchDone: false,
    // 选中的班级
    selectedClass: null,
    // 登录
    username: '',
    password: '',
    loginLoading: false,
    error: '',
    showPassword: false,
  },

  // 班级搜索
  onClassKeywordInput(e) {
    this.setData({ classKeyword: e.detail.value, error: '' });
  },

  async handleSearchClass() {
    const keyword = this.data.classKeyword.trim();
    if (!keyword) {
      this.setData({ error: '请输入班级名称' });
      return;
    }

    this.setData({ searchLoading: true, error: '', searchDone: false });

    try {
      const data = await api.searchClasses(keyword);
      this.setData({
        classList: data.classes || [],
        searchLoading: false,
        searchDone: true,
      });
      if ((data.classes || []).length === 0) {
        this.setData({ error: '未找到匹配的班级' });
      }
    } catch (err) {
      this.setData({ searchLoading: false, error: err.message || '搜索失败' });
    }
  },

  handleSelectClass(e) {
    const classItem = e.currentTarget.dataset.item;
    this.setData({
      selectedClass: classItem,
      step: 2,
      error: '',
      username: '',
      password: '',
    });
  },

  handleBackToSearch() {
    this.setData({
      step: 1,
      selectedClass: null,
      error: '',
    });
  },

  // 登录
  onUsernameInput(e) {
    this.setData({ username: e.detail.value, error: '' });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value, error: '' });
  },

  toggleShowPassword() {
    this.setData({ showPassword: !this.data.showPassword });
  },

  async handleLogin() {
    const { selectedClass, username, password } = this.data;
    const name = username.trim();
    const pwd = password.trim();

    if (!name) {
      this.setData({ error: '请输入学生姓名' });
      return;
    }
    if (!pwd) {
      this.setData({ error: '请输入密码' });
      return;
    }

    this.setData({ loginLoading: true, error: '' });

    try {
      const data = await api.login(selectedClass.id, name, pwd);

      // 保存登录信息
      app.saveLogin({
        token: data.token,
        classId: data.classId,
        classTitle: data.classTitle || selectedClass.title,
        username: data.username,
      });

      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500,
      });

      setTimeout(() => {
        wx.redirectTo({ url: '/pages/studentDetail/studentDetail' });
      }, 1500);
    } catch (err) {
      this.setData({
        error: err.message || '登录失败',
        loginLoading: false,
      });
    }
  },
});
