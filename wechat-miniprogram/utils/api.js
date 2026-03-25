/**
 * API 请求封装
 */

const app = getApp();

/**
 * 发起 API 请求
 */
function request(options) {
  const { path, method = 'GET', data = {}, needAuth = false } = options;
  const baseUrl = app.globalData.apiBaseUrl;
  const header = { 'Content-Type': 'application/json' };

  if (needAuth) {
    const token = app.globalData.token;
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}${path}`,
      method,
      data,
      header,
      success(res) {
        if (res.statusCode === 401) {
          // token 过期，清除登录状态
          app.globalData.token = '';
          wx.removeStorageSync('parentToken');
          reject(new Error('登录已过期，请重新登录'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data.success) {
          resolve(res.data.data);
        } else {
          const message = res.data.message || '请求失败';
          reject(new Error(message));
        }
      },
      fail(err) {
        reject(new Error('网络请求失败，请检查网络连接'));
      },
    });
  });
}

/**
 * 搜索班级
 */
function searchClasses(keyword) {
  return request({
    path: `/api/parent/classes?keyword=${encodeURIComponent(keyword)}`,
    method: 'GET',
  });
}

/**
 * 家长登录
 */
function login(classId, username, password) {
  return request({
    path: '/api/parent/login',
    method: 'POST',
    data: { classId, username, password },
  });
}

/**
 * 通过 token 获取学生信息
 */
function getStudentInfo() {
  return request({
    path: '/api/parent/student',
    method: 'GET',
    needAuth: true,
  });
}

/**
 * 获取学生积分记录
 */
function getStudentHistory(page = 1, pageSize = 20) {
  return request({
    path: `/api/parent/history?page=${page}&pageSize=${pageSize}`,
    method: 'GET',
    needAuth: true,
  });
}

/**
 * 获取学生排名
 */
function getStudentRanking() {
  return request({
    path: '/api/parent/ranking',
    method: 'GET',
    needAuth: true,
  });
}

/**
 * 修改密码
 */
function changePassword(oldPassword, newPassword) {
  return request({
    path: '/api/parent/change-password',
    method: 'POST',
    data: { oldPassword, newPassword },
    needAuth: true,
  });
}

module.exports = {
  request,
  searchClasses,
  login,
  getStudentInfo,
  getStudentHistory,
  getStudentRanking,
  changePassword,
};
