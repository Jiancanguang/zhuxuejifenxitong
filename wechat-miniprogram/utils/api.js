/**
 * API 请求封装
 */

const app = getApp();

/**
 * 发起 API 请求
 */
function request(options) {
  const { path, method = 'GET', data = {} } = options;
  const baseUrl = app.globalData.apiBaseUrl;

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}${path}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
      },
      success(res) {
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
 * 通过查看码获取学生信息
 */
function getStudentByCode(code) {
  return request({
    path: `/api/parent/student?code=${encodeURIComponent(code)}`,
    method: 'GET',
  });
}

/**
 * 获取学生积分记录
 */
function getStudentHistory(code, page = 1, pageSize = 20) {
  return request({
    path: `/api/parent/history?code=${encodeURIComponent(code)}&page=${page}&pageSize=${pageSize}`,
    method: 'GET',
  });
}

/**
 * 获取学生排名
 */
function getStudentRanking(code) {
  return request({
    path: `/api/parent/ranking?code=${encodeURIComponent(code)}`,
    method: 'GET',
  });
}

module.exports = {
  request,
  getStudentByCode,
  getStudentHistory,
  getStudentRanking,
};
